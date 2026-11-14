"""PostgreSQL connection and the tables this service owns."""

from __future__ import annotations

import logging
from urllib.parse import unquote, urlsplit

import asyncpg

from .config import Settings

logger = logging.getLogger("optijob.ai")


async def connect_database(settings: Settings) -> asyncpg.Pool | None:
    """Return a pool, or None when the database is not reachable.

    CV analysis does not need the database, so the service still starts without it;
    job search, the shared cache and stored metrics are then switched off.
    """
    parsed = urlsplit(settings.database_url)
    if parsed.scheme not in {"postgres", "postgresql"} or not parsed.hostname:
        logger.warning("DATABASE_URL is not a PostgreSQL URL: starting without the vector store.")
        return None
    try:
        pool = await asyncpg.create_pool(
            host=parsed.hostname,
            port=parsed.port or 5432,
            user=unquote(parsed.username or ""),
            password=unquote(parsed.password or ""),
            database=parsed.path.lstrip("/"),
            min_size=1,
            max_size=5,
            command_timeout=15,
            timeout=10,
        )
        await initialize_schema(pool, settings.embedding_dimensions)
        return pool
    except (OSError, asyncpg.PostgresError, TimeoutError) as exc:
        logger.warning("Database unavailable (%s): starting without the vector store.", type(exc).__name__)
        return None


async def initialize_schema(pool: asyncpg.Pool, embedding_dimensions: int) -> None:
    dimensions = int(embedding_dimensions)
    async with pool.acquire() as connection:
        await connection.execute("CREATE EXTENSION IF NOT EXISTS vector")
        # One row per job: the primary key is what prevents duplicate vectors for the same posting.
        await connection.execute(
            f"""
            CREATE TABLE IF NOT EXISTS job_embeddings (
                job_id TEXT PRIMARY KEY,
                content_hash TEXT NOT NULL,
                dedupe_key TEXT NOT NULL,
                embedding_model TEXT NOT NULL,
                embedding vector({dimensions}) NOT NULL,
                updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
            )
            """
        )
        await connection.execute(
            """
            CREATE TABLE IF NOT EXISTS llm_cache (
                key TEXT PRIMARY KEY,
                stage TEXT NOT NULL,
                value JSONB NOT NULL,
                created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
            )
            """
        )
        await connection.execute(
            """
            CREATE TABLE IF NOT EXISTS llm_calls (
                id BIGSERIAL PRIMARY KEY,
                created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                request_id TEXT NOT NULL,
                stage TEXT NOT NULL,
                model TEXT NOT NULL,
                model_version TEXT NOT NULL,
                prompt_version TEXT NOT NULL,
                ok BOOLEAN NOT NULL,
                error_kind TEXT NOT NULL,
                attempts INTEGER NOT NULL,
                latency_ms INTEGER NOT NULL,
                prompt_tokens INTEGER NOT NULL,
                output_tokens INTEGER NOT NULL,
                thought_tokens INTEGER NOT NULL,
                cached BOOLEAN NOT NULL
            )
            """
        )
        await connection.execute("CREATE INDEX IF NOT EXISTS llm_calls_created_at_idx ON llm_calls (created_at)")
        await connection.execute(
            """
            CREATE TABLE IF NOT EXISTS pipeline_runs (
                id BIGSERIAL PRIMARY KEY,
                created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                request_id TEXT NOT NULL,
                kind TEXT NOT NULL,
                model TEXT NOT NULL,
                prompt_version TEXT NOT NULL,
                latency_ms INTEGER NOT NULL,
                requirements INTEGER NOT NULL,
                matched INTEGER NOT NULL,
                score INTEGER NOT NULL,
                dropped_requirements INTEGER NOT NULL,
                unverified_quotes INTEGER NOT NULL,
                unassessed_requirements INTEGER NOT NULL,
                pii_redactions INTEGER NOT NULL,
                injection_flags INTEGER NOT NULL,
                cached BOOLEAN NOT NULL
            )
            """
        )
        await connection.execute("CREATE INDEX IF NOT EXISTS pipeline_runs_created_at_idx ON pipeline_runs (created_at)")
