from fastapi import FastAPI, HTTPException

from .database import database_lifespan
from .gemini_provider import analyze_with_gemini
from .rag_store import index_resume, search_resume, store_metadata
from .schemas import (
    AnalysisResponse,
    AnalyzeRequest,
    IndexResumeRequest,
    IndexResumeResponse,
    SearchResumeRequest,
    SearchResumeResponse,
)


app = FastAPI(title="OptiJob AI Service", version="0.2.0", lifespan=database_lifespan)


@app.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok", "vector_store": "ready"}


@app.post("/rag/index", response_model=IndexResumeResponse)
async def index_cv(request: IndexResumeRequest) -> IndexResumeResponse:
    try:
        indexed_chunks = await index_resume(
            app.state.database_pool,
            request.user_id,
            request.cv_text,
        )
        return IndexResumeResponse(
            indexed_chunks=indexed_chunks,
            embedding_model=store_metadata()["embedding_model"],
        )
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    except RuntimeError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc


@app.post("/rag/search", response_model=SearchResumeResponse)
async def retrieve_cv_chunks(request: SearchResumeRequest) -> SearchResumeResponse:
    try:
        results = await search_resume(
            app.state.database_pool,
            request.user_id,
            request.requirements,
            request.top_k,
        )
        return SearchResumeResponse(results=results)
    except RuntimeError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc


@app.post("/analyze", response_model=AnalysisResponse)
async def analyze(request: AnalyzeRequest) -> AnalysisResponse:
    try:
        result = await analyze_with_gemini(request)
        return AnalysisResponse.model_validate(result)
    except RuntimeError as exc:
        message = str(exc)
        status_code = 503 if "not configured" in message else 502
        if "quota" in message.casefold():
            status_code = 429
        raise HTTPException(status_code=status_code, detail=message) from exc
