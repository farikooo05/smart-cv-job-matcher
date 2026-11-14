"""Runtime settings for the AI service, read from environment variables."""

from __future__ import annotations

import os
from dataclasses import dataclass


def _text(name: str, default: str = "") -> str:
    return os.getenv(name, "").strip() or default


def _number(name: str, default: float) -> float:
    try:
        return float(_text(name)) if _text(name) else default
    except ValueError:
        return default


def _optional_number(name: str) -> float | None:
    try:
        return float(_text(name)) if _text(name) else None
    except ValueError:
        return None


@dataclass(frozen=True)
class Settings:
    gemini_api_key: str
    # Pinned model ids, not "-latest" aliases: an alias can change under us and silently
    # invalidate evaluation results. The resolved version is still logged with every call.
    model: str
    fallback_model: str
    embedding_model: str
    embedding_dimensions: int

    # Sampling. The pipeline extracts and classifies, so it wants the most likely answer,
    # not a varied one: temperature 0. top_p and top_k are left to the provider default
    # unless set, because at temperature 0 they have nothing left to choose between.
    temperature: float
    top_p: float | None
    top_k: int | None
    seed: int | None

    # Retrieval. top_k is how many jobs a search returns; candidates above the duplicate
    # threshold (cosine similarity to an already chosen job) are collapsed into one.
    retrieval_top_k: int
    retrieval_min_similarity: float
    duplicate_similarity: float

    request_timeout_seconds: float
    max_attempts: int
    max_retry_wait_seconds: float
    requests_per_minute: int
    max_concurrency: int
    database_url: str
    service_key: str
    # Prices are optional because they change; cost is reported only when both are set.
    price_input_per_million: float | None
    price_output_per_million: float | None

    @property
    def gemini_configured(self) -> bool:
        return bool(self.gemini_api_key) and not self.gemini_api_key.casefold().startswith("your-")


def load_settings() -> Settings:
    top_k = _optional_number("GEMINI_TOP_K")
    seed = _optional_number("GEMINI_SEED")
    return Settings(
        gemini_api_key=_text("GEMINI_API_KEY"),
        model=_text("GEMINI_MODEL", "gemini-3.5-flash-lite"),
        fallback_model=_text("GEMINI_FALLBACK_MODEL", "gemini-3.1-flash-lite"),
        embedding_model=_text("GEMINI_EMBEDDING_MODEL", "gemini-embedding-2"),
        embedding_dimensions=int(_number("EMBEDDING_DIMENSIONS", 768)),
        temperature=_number("GEMINI_TEMPERATURE", 0.0),
        top_p=_optional_number("GEMINI_TOP_P"),
        top_k=int(top_k) if top_k is not None else None,
        seed=int(seed) if seed is not None else None,
        retrieval_top_k=max(1, int(_number("RETRIEVAL_TOP_K", 10))),
        retrieval_min_similarity=_number("RETRIEVAL_MIN_SIMILARITY", 0.0),
        duplicate_similarity=_number("RETRIEVAL_DUPLICATE_SIMILARITY", 0.97),
        request_timeout_seconds=_number("GEMINI_TIMEOUT_SECONDS", 40),
        max_attempts=max(1, int(_number("GEMINI_MAX_ATTEMPTS", 3))),
        max_retry_wait_seconds=_number("GEMINI_MAX_RETRY_WAIT_SECONDS", 8),
        requests_per_minute=int(_number("GEMINI_REQUESTS_PER_MINUTE", 10)),
        max_concurrency=max(1, int(_number("GEMINI_MAX_CONCURRENCY", 4))),
        database_url=_text("DATABASE_URL"),
        service_key=_text("AI_SERVICE_KEY"),
        price_input_per_million=_optional_number("GEMINI_PRICE_INPUT_PER_MILLION"),
        price_output_per_million=_optional_number("GEMINI_PRICE_OUTPUT_PER_MILLION"),
    )
