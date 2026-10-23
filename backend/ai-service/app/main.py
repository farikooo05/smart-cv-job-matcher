from fastapi import FastAPI, HTTPException

from .gemini_provider import analyze_with_gemini
from .schemas import AnalysisResponse, AnalyzeRequest


app = FastAPI(title="OptiJob AI Service", version="0.1.0")


@app.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok"}


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
