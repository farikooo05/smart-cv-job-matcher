"""Monitoring: every LLM call and every pipeline run is logged and stored.

Only numbers and identifiers are recorded. CV text, vacancy text and quotes never go
into logs or these tables.
"""

from __future__ import annotations

import asyncio
import json
import logging
from contextvars import ContextVar
from dataclasses import asdict

import asyncpg

from .config import Settings
from .gemini_client import CallRecord
from .schemas import AnalysisMeta

logger = logging.getLogger("optijob.ai")
request_id_var: ContextVar[str] = ContextVar("request_id", default="")


class Telemetry:
    def __init__(self, pool: asyncpg.Pool | None, settings: Settings):
        self._pool = pool
        self._settings = settings
        self._tasks: set[asyncio.Task] = set()

    def _store(self, query: str, *values: object) -> None:
        """Write in the background; monitoring must never slow down or fail a request."""
        if self._pool is None:
            return
        try:
            loop = asyncio.get_running_loop()
        except RuntimeError:
            return

        async def write() -> None:
            try:
                await self._pool.execute(query, *values)
            except (asyncpg.PostgresError, OSError) as exc:
                logger.warning(json.dumps({"event": "telemetry_write_failed", "error": type(exc).__name__}))

        task = loop.create_task(write())
        self._tasks.add(task)
        task.add_done_callback(self._tasks.discard)

    def record_call(self, record: CallRecord) -> None:
        request_id = request_id_var.get()
        logger.info(json.dumps({"event": "llm_call", "request_id": request_id, **asdict(record)}))
        self._store(
            """
            INSERT INTO llm_calls (request_id, stage, model, model_version, prompt_version, ok, error_kind,
                                   attempts, latency_ms, prompt_tokens, output_tokens, thought_tokens, cached)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
            """,
            request_id, record.stage, record.model, record.model_version, record.prompt_version, record.ok,
            record.error_kind, record.attempts, record.latency_ms, record.prompt_tokens, record.output_tokens,
            record.thought_tokens, record.cached,
        )

    def record_run(self, kind: str, meta: AnalysisMeta, *, requirements: int = 0, matched: int = 0, score: int = 0) -> None:
        request_id = request_id_var.get()
        logger.info(json.dumps({
            "event": "pipeline_run", "request_id": request_id, "kind": kind, "requirements": requirements,
            "matched": matched, "score": score, **meta.model_dump(exclude={"warnings", "requestId"}),
            "injection_flags": len(meta.warnings),
        }))
        self._store(
            """
            INSERT INTO pipeline_runs (request_id, kind, model, prompt_version, latency_ms, requirements, matched,
                                       score, dropped_requirements, unverified_quotes, unassessed_requirements,
                                       pii_redactions, injection_flags, cached)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
            """,
            request_id, kind, meta.model, meta.promptVersion, meta.latencyMs, requirements, matched, score,
            meta.droppedRequirements, meta.unverifiedQuotes, meta.unassessedRequirements, meta.piiRedactions,
            len(meta.warnings), meta.cached,
        )

    async def summary(self, hours: int) -> dict:
        """Aggregates for a dashboard: volume, errors, cache hits, latency, tokens, and guardrail hit rates."""
        if self._pool is None:
            return {"available": False, "reason": "The database is not connected."}
        calls = await self._pool.fetch(
            """
            SELECT stage,
                   COUNT(*) AS calls,
                   COUNT(*) FILTER (WHERE NOT ok) AS errors,
                   COUNT(*) FILTER (WHERE cached) AS cache_hits,
                   COALESCE(SUM(prompt_tokens), 0) AS prompt_tokens,
                   COALESCE(SUM(output_tokens + thought_tokens), 0) AS output_tokens,
                   percentile_cont(0.5) WITHIN GROUP (ORDER BY latency_ms) FILTER (WHERE ok AND NOT cached) AS p50_ms,
                   percentile_cont(0.95) WITHIN GROUP (ORDER BY latency_ms) FILTER (WHERE ok AND NOT cached) AS p95_ms
            FROM llm_calls
            WHERE created_at >= NOW() - make_interval(hours => $1)
            GROUP BY stage ORDER BY stage
            """,
            hours,
        )
        runs = await self._pool.fetchrow(
            """
            SELECT COUNT(*) AS runs,
                   COALESCE(SUM(matched), 0) AS matched,
                   COALESCE(SUM(unverified_quotes), 0) AS unverified_quotes,
                   COALESCE(SUM(dropped_requirements), 0) AS dropped_requirements,
                   COUNT(*) FILTER (WHERE injection_flags > 0) AS runs_with_injection_flags,
                   AVG(score) FILTER (WHERE kind = 'analysis') AS average_score
            FROM pipeline_runs
            WHERE created_at >= NOW() - make_interval(hours => $1)
            """,
            hours,
        )
        prompt_tokens = sum(row["prompt_tokens"] for row in calls)
        output_tokens = sum(row["output_tokens"] for row in calls)
        price_in, price_out = self._settings.price_input_per_million, self._settings.price_output_per_million
        claimed = runs["matched"] + runs["unverified_quotes"]
        return {
            "available": True,
            "window_hours": hours,
            "stages": [
                {
                    **{key: row[key] for key in ("stage", "calls", "errors", "cache_hits", "prompt_tokens", "output_tokens")},
                    "p50_ms": round(row["p50_ms"]) if row["p50_ms"] is not None else None,
                    "p95_ms": round(row["p95_ms"]) if row["p95_ms"] is not None else None,
                }
                for row in calls
            ],
            "runs": runs["runs"],
            "average_score": round(float(runs["average_score"]), 1) if runs["average_score"] is not None else None,
            # Share of "matched" verdicts whose quote was not in the CV: the production hallucination rate.
            "unverified_quote_rate": round(runs["unverified_quotes"] / claimed, 4) if claimed else None,
            "dropped_requirements": runs["dropped_requirements"],
            "runs_with_injection_flags": runs["runs_with_injection_flags"],
            "estimated_cost_usd": (
                round((prompt_tokens * price_in + output_tokens * price_out) / 1_000_000, 4)
                if price_in is not None and price_out is not None else None
            ),
        }
