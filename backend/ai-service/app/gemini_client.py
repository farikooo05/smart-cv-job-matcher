"""Thin async client for the Gemini REST API.

It owns everything that is about talking to the provider rather than about CVs:
retries with backoff, a fallback model, rate limiting, response validation and
per-call usage records. The pipeline never sees HTTP.
"""

from __future__ import annotations

import asyncio
import math
import random
import time
from collections.abc import Awaitable, Callable
from dataclasses import dataclass
from typing import TypeVar

import httpx
from pydantic import BaseModel, ValidationError

from .config import Settings

API_ROOT = "https://generativelanguage.googleapis.com/v1beta/models"
EMBEDDING_BATCH_SIZE = 50
# Roughly 2-4k tokens in any of the supported languages, well inside the embedding input limit.
EMBEDDING_MAX_CHARS = 8_000
BLOCKED_FINISH_REASONS = {"SAFETY", "PROHIBITED_CONTENT", "BLOCKLIST", "SPII", "RECITATION"}

ModelT = TypeVar("ModelT", bound=BaseModel)
ResultT = TypeVar("ResultT")


class GeminiError(RuntimeError):
    """A provider failure with a stable `kind` the API layer can map to an HTTP status."""

    def __init__(self, kind: str, message: str, *, retryable: bool = False, retry_after: float | None = None):
        super().__init__(message)
        self.kind = kind
        self.retryable = retryable
        self.retry_after = retry_after


@dataclass
class CallRecord:
    stage: str
    prompt_version: str
    model: str
    model_version: str = ""
    ok: bool = True
    error_kind: str = ""
    attempts: int = 0
    latency_ms: int = 0
    prompt_tokens: int = 0
    output_tokens: int = 0
    thought_tokens: int = 0
    cached: bool = False


class RateLimiter:
    """Token bucket: bursts up to `per_minute`, then one request every 60/per_minute seconds."""

    def __init__(self, per_minute: int):
        self._capacity = per_minute
        self._tokens = float(per_minute)
        self._updated = time.monotonic()
        self._lock = asyncio.Lock()

    async def acquire(self) -> None:
        if self._capacity <= 0:
            return
        while True:
            async with self._lock:
                now = time.monotonic()
                self._tokens = min(self._capacity, self._tokens + (now - self._updated) * self._capacity / 60)
                self._updated = now
                if self._tokens >= 1:
                    self._tokens -= 1
                    return
                wait = (1 - self._tokens) * 60 / self._capacity
            await asyncio.sleep(wait)


def retry_delay_seconds(payload: dict) -> float | None:
    """Read google.rpc.RetryInfo from a 429 body, e.g. {"retryDelay": "34s"}."""
    for detail in (payload.get("error") or {}).get("details") or []:
        delay = detail.get("retryDelay") if isinstance(detail, dict) else None
        if isinstance(delay, str) and delay.endswith("s"):
            try:
                return float(delay[:-1])
            except ValueError:
                return None
    return None


def normalize_vector(vector: list[float]) -> list[float]:
    norm = math.sqrt(sum(value * value for value in vector))
    return [value / norm for value in vector] if norm else vector


class GeminiClient:
    def __init__(self, settings: Settings, sink: Callable[[CallRecord], None] | None = None):
        self.settings = settings
        self._sink = sink
        self._http = httpx.AsyncClient(timeout=settings.request_timeout_seconds)
        self._limiter = RateLimiter(settings.requests_per_minute)
        self._semaphore = asyncio.Semaphore(settings.max_concurrency)

    async def aclose(self) -> None:
        await self._http.aclose()

    def emit(self, record: CallRecord) -> None:
        if self._sink:
            self._sink(record)

    def generation_config(self) -> dict:
        """Sampling settings sent with every generation call. Also part of the cache key."""
        config: dict = {"temperature": self.settings.temperature}
        if self.settings.top_p is not None:
            config["topP"] = self.settings.top_p
        if self.settings.top_k is not None:
            config["topK"] = self.settings.top_k
        if self.settings.seed is not None:
            config["seed"] = self.settings.seed
        return config

    def model_plan(self) -> list[str]:
        """Which model each attempt uses: the primary first, the fallback for the last attempt."""
        primary, fallback = self.settings.model, self.settings.fallback_model
        attempts = self.settings.max_attempts
        if not fallback or fallback == primary or attempts == 1:
            return [primary] * attempts
        return [primary] * (attempts - 1) + [fallback]

    async def _post(self, model: str, method: str, body: dict) -> dict:
        if not self.settings.gemini_configured:
            raise GeminiError("not_configured", "Gemini is not configured. Set GEMINI_API_KEY for the AI service.")
        async with self._semaphore:
            await self._limiter.acquire()
            try:
                response = await self._http.post(
                    f"{API_ROOT}/{model}:{method}",
                    # Header, not a query parameter: URLs end up in access logs.
                    headers={"x-goog-api-key": self.settings.gemini_api_key},
                    json=body,
                )
            except httpx.TimeoutException as exc:
                raise GeminiError("timeout", "Gemini did not respond in time.", retryable=True) from exc
            except httpx.HTTPError as exc:
                raise GeminiError("unavailable", "Could not connect to Gemini.", retryable=True) from exc

        if response.is_success:
            return response.json()
        try:
            payload = response.json()
        except ValueError:
            payload = {}
        # Upstream error bodies can echo request content, so only the status is surfaced.
        if response.status_code == 429:
            raise GeminiError(
                "quota",
                "Gemini quota is currently exhausted. Try again later.",
                retryable=True,
                retry_after=retry_delay_seconds(payload),
            )
        if response.status_code >= 500:
            raise GeminiError("unavailable", f"Gemini is temporarily unavailable (HTTP {response.status_code}).", retryable=True)
        status = " ".join(filter(None, [str(response.status_code), (payload.get("error") or {}).get("status", "")]))
        raise GeminiError("bad_request", f"Gemini rejected the request (HTTP {status}).")

    async def _with_retries(
        self,
        record: CallRecord,
        call: Callable[[str], Awaitable[ResultT]],
        plan: list[str],
    ) -> ResultT:
        """Run `call(model)` across the plan, backing off between retryable failures."""
        started = time.perf_counter()
        index = 0
        error: GeminiError | None = None
        while index < len(plan):
            model = plan[index]
            record.model = model
            record.attempts += 1
            try:
                result = await call(model)
            except GeminiError as exc:
                error = exc
                if not exc.retryable:
                    break
                is_quota = exc.kind == "quota"
                if is_quota and plan[-1] != model:
                    # Quotas are per model, so waiting on the primary is pointless when a fallback exists.
                    index = len(plan) - 1
                    continue
                index += 1
                if index >= len(plan):
                    break
                wait = exc.retry_after if exc.retry_after is not None else 0.8 * 2 ** (record.attempts - 1)
                if wait > self.settings.max_retry_wait_seconds:
                    if is_quota:
                        break
                    wait = self.settings.max_retry_wait_seconds
                await asyncio.sleep(wait + random.uniform(0, 0.4))
                continue
            record.ok = True
            record.error_kind = ""
            record.latency_ms = round((time.perf_counter() - started) * 1000)
            self.emit(record)
            return result

        record.ok = False
        record.error_kind = error.kind if error else "unknown"
        record.latency_ms = round((time.perf_counter() - started) * 1000)
        self.emit(record)
        raise error or GeminiError("unavailable", "Gemini request failed.")

    async def generate_json(
        self,
        *,
        stage: str,
        prompt_version: str,
        system: str,
        prompt: str,
        schema: dict,
        response_model: type[ModelT],
        max_output_tokens: int = 8192,
    ) -> tuple[ModelT, CallRecord]:
        """One structured-output call. The reply is validated against `response_model` before it is returned."""
        record = CallRecord(stage=stage, prompt_version=prompt_version, model=self.settings.model)

        async def call(model: str) -> ModelT:
            payload = await self._post(model, "generateContent", {
                "systemInstruction": {"parts": [{"text": system}]},
                "contents": [{"role": "user", "parts": [{"text": prompt}]}],
                "generationConfig": {
                    "responseMimeType": "application/json",
                    "responseSchema": schema,
                    "maxOutputTokens": max_output_tokens,
                    **self.generation_config(),
                },
            })
            usage = payload.get("usageMetadata") or {}
            record.model_version = payload.get("modelVersion", model)
            record.prompt_tokens = int(usage.get("promptTokenCount") or 0)
            record.output_tokens = int(usage.get("candidatesTokenCount") or 0)
            record.thought_tokens = int(usage.get("thoughtsTokenCount") or 0)

            candidates = payload.get("candidates") or []
            if not candidates:
                if (payload.get("promptFeedback") or {}).get("blockReason"):
                    raise GeminiError("blocked", "Gemini declined to process this text.")
                raise GeminiError("invalid_response", "Gemini returned no answer.", retryable=True)
            candidate = candidates[0]
            finish_reason = candidate.get("finishReason", "")
            if finish_reason in BLOCKED_FINISH_REASONS:
                raise GeminiError("blocked", "Gemini declined to process this text.")
            if finish_reason == "MAX_TOKENS":
                raise GeminiError("invalid_response", "Gemini's answer was cut off.", retryable=True)
            text = "".join(
                part.get("text", "")
                for part in (candidate.get("content") or {}).get("parts") or []
                if not part.get("thought")
            )
            try:
                return response_model.model_validate_json(text)
            except (ValidationError, ValueError) as exc:
                raise GeminiError("invalid_response", "Gemini returned an invalid structured response.", retryable=True) from exc

        result = await self._with_retries(record, call, self.model_plan())
        return result, record

    async def embed(self, texts: list[str], *, task_type: str) -> list[list[float]]:
        """Embed texts as unit vectors. `task_type` is RETRIEVAL_DOCUMENT for jobs, RETRIEVAL_QUERY for CVs."""
        model = self.settings.embedding_model
        dimensions = self.settings.embedding_dimensions
        vectors: list[list[float]] = []
        for start in range(0, len(texts), EMBEDDING_BATCH_SIZE):
            batch = texts[start:start + EMBEDDING_BATCH_SIZE]
            record = CallRecord(stage="embed", prompt_version="", model=model, model_version=model)

            async def call(_: str, batch: list[str] = batch, record: CallRecord = record) -> list[list[float]]:
                payload = await self._post(model, "batchEmbedContents", {
                    "requests": [
                        {
                            "model": f"models/{model}",
                            "content": {"parts": [{"text": text[:EMBEDDING_MAX_CHARS]}]},
                            "taskType": task_type,
                            "outputDimensionality": dimensions,
                        }
                        for text in batch
                    ],
                })
                record.prompt_tokens = int((payload.get("usageMetadata") or {}).get("promptTokenCount") or 0)
                try:
                    values = [[float(value) for value in item["values"]] for item in payload["embeddings"]]
                except (KeyError, TypeError, ValueError) as exc:
                    raise GeminiError("invalid_response", "Gemini returned invalid embeddings.", retryable=True) from exc
                if len(values) != len(batch) or any(
                    len(vector) != dimensions or not all(math.isfinite(value) for value in vector) for vector in values
                ):
                    raise GeminiError("invalid_response", "Gemini returned embeddings with an unexpected shape.", retryable=True)
                # Unit vectors: cosine similarity is then a plain dot product everywhere.
                return [normalize_vector(vector) for vector in values]

            # No fallback model here: vectors from different embedding models are not comparable.
            vectors.extend(await self._with_retries(record, call, [model] * self.settings.max_attempts))
        return vectors
