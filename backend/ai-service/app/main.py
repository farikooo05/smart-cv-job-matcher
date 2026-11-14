"""HTTP API of the OptiJob AI service."""

from __future__ import annotations

import logging
import secrets
from contextlib import asynccontextmanager
from uuid import uuid4

from fastapi import Depends, FastAPI, Header, HTTPException, Query, Request
from fastapi.responses import JSONResponse

from .cache import MemoryCache, PostgresCache
from .config import load_settings
from .database import connect_database
from .gemini_client import GeminiClient, GeminiError
from .job_index import index_jobs, search_jobs
from .pipeline import PipelineContext, analyze, extract_profile
from .schemas import (
    AnalysisResponse,
    AnalyzeRequest,
    IndexJobsRequest,
    IndexJobsResponse,
    ProfileRequest,
    ProfileResponse,
    SearchJobsRequest,
    SearchJobsResponse,
)
from .telemetry import Telemetry, request_id_var

logging.basicConfig(level=logging.INFO, format="%(message)s")

ERROR_STATUS = {
    "not_configured": 503,
    "quota": 429,
    "timeout": 503,
    "unavailable": 503,
    "invalid_response": 502,
    "bad_request": 502,
    "blocked": 422,
}


@asynccontextmanager
async def lifespan(app: FastAPI):
    settings = load_settings()
    pool = await connect_database(settings)
    telemetry = Telemetry(pool, settings)
    llm = GeminiClient(settings, sink=telemetry.record_call)
    app.state.settings = settings
    app.state.pool = pool
    app.state.telemetry = telemetry
    app.state.ctx = PipelineContext(llm=llm, cache=PostgresCache(pool) if pool else MemoryCache())
    try:
        yield
    finally:
        await llm.aclose()
        if pool:
            await pool.close()


async def request_context(request: Request, x_ai_service_key: str = Header(default="")) -> str:
    """Runs for every protected route: checks the optional shared secret and assigns a request id."""
    expected = request.app.state.settings.service_key
    if expected and not secrets.compare_digest(x_ai_service_key, expected):
        raise HTTPException(status_code=401, detail="Invalid AI service key.")
    request_id = uuid4().hex[:16]
    request_id_var.set(request_id)
    return request_id


def require_pool(request: Request):
    if request.app.state.pool is None:
        raise HTTPException(status_code=503, detail="The vector store is not available. Start PostgreSQL and restart the AI service.")
    return request.app.state.pool


app = FastAPI(title="OptiJob AI Service", version="1.0.0", lifespan=lifespan)


@app.exception_handler(GeminiError)
async def gemini_error_handler(_: Request, error: GeminiError) -> JSONResponse:
    return JSONResponse(status_code=ERROR_STATUS.get(error.kind, 502), content={"detail": str(error), "code": error.kind})


@app.get("/health")
async def health(request: Request) -> dict:
    settings = request.app.state.settings
    return {
        "status": "ok",
        "gemini_configured": settings.gemini_configured,
        "model": settings.model,
        "fallback_model": settings.fallback_model,
        "embedding_model": settings.embedding_model,
        "generation_config": request.app.state.ctx.llm.generation_config(),
        "retrieval": {
            "top_k": settings.retrieval_top_k,
            "min_similarity": settings.retrieval_min_similarity,
            "duplicate_similarity": settings.duplicate_similarity,
        },
        "vector_store": "ready" if request.app.state.pool else "unavailable",
    }


@app.post("/analyze", response_model=AnalysisResponse)
async def analyze_cv(body: AnalyzeRequest, request: Request, request_id: str = Depends(request_context)) -> AnalysisResponse:
    result = await analyze(request.app.state.ctx, body.cv_text, body.job_description)
    result.meta.requestId = request_id
    request.app.state.telemetry.record_run(
        "analysis",
        result.meta,
        requirements=len(result.requirements),
        matched=result.skillsSummary.matched,
        score=result.compatibilityScore,
    )
    return result


@app.post("/profile", response_model=ProfileResponse)
async def profile(body: ProfileRequest, request: Request, request_id: str = Depends(request_context)) -> ProfileResponse:
    result = await extract_profile(request.app.state.ctx, body.cv_text)
    result.meta.requestId = request_id
    request.app.state.telemetry.record_run("profile", result.meta, matched=len(result.keywords))
    return result


@app.post("/jobs/index", response_model=IndexJobsResponse, dependencies=[Depends(request_context)])
async def index_job_postings(body: IndexJobsRequest, request: Request) -> IndexJobsResponse:
    return await index_jobs(require_pool(request), request.app.state.ctx.llm, body.jobs)


@app.post("/jobs/search", response_model=SearchJobsResponse, dependencies=[Depends(request_context)])
async def search_job_postings(body: SearchJobsRequest, request: Request) -> SearchJobsResponse:
    ctx = request.app.state.ctx
    return await search_jobs(
        require_pool(request),
        ctx.llm,
        ctx.cache,
        query_text=body.query_text,
        top_k=body.top_k,
        min_similarity=body.min_similarity,
        job_ids=body.job_ids,
    )


@app.get("/metrics/summary", dependencies=[Depends(request_context)])
async def metrics_summary(request: Request, hours: int = Query(default=24, ge=1, le=720)) -> dict:
    return await request.app.state.telemetry.summary(hours)
