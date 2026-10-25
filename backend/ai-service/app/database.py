import os
from contextlib import asynccontextmanager
from urllib.parse import unquote, urlsplit

import asyncpg
from fastapi import FastAPI


async def connect_database() -> asyncpg.Pool:
    database_url = os.getenv("DATABASE_URL", "").strip()
    if not database_url:
        raise RuntimeError("DATABASE_URL is required for the RAG vector store.")

    parsed = urlsplit(database_url)
    if parsed.scheme not in {"postgres", "postgresql"} or not parsed.hostname:
        raise RuntimeError("DATABASE_URL must be a PostgreSQL connection URL.")

    return await asyncpg.create_pool(
        host=parsed.hostname,
        port=parsed.port or 5432,
        user=unquote(parsed.username or ""),
        password=unquote(parsed.password or ""),
        database=parsed.path.lstrip("/"),
        min_size=1,
        max_size=5,
        command_timeout=15,
    )


async def initialize_vector_store(pool: asyncpg.Pool) -> None:
    async with pool.acquire() as connection:
        await connection.execute("CREATE EXTENSION IF NOT EXISTS vector")
        await connection.execute(
            """
            CREATE TABLE IF NOT EXISTS resume_chunks (
                id BIGSERIAL PRIMARY KEY,
                user_id TEXT NOT NULL REFERENCES "User"(id) ON DELETE CASCADE,
                chunk_index INTEGER NOT NULL,
                section TEXT NOT NULL,
                start_word INTEGER NOT NULL,
                end_word INTEGER NOT NULL,
                content TEXT NOT NULL,
                embedding vector(1024) NOT NULL,
                created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                UNIQUE (user_id, chunk_index)
            )
            """
        )
        await connection.execute(
            """
            CREATE INDEX IF NOT EXISTS resume_chunks_embedding_hnsw_idx
            ON resume_chunks USING hnsw (embedding vector_cosine_ops)
            """
        )
        await connection.execute(
            "CREATE INDEX IF NOT EXISTS resume_chunks_user_id_idx ON resume_chunks (user_id)"
        )


@asynccontextmanager
async def database_lifespan(app: FastAPI):
    pool = await connect_database()
    try:
        await initialize_vector_store(pool)
        app.state.database_pool = pool
        yield
    finally:
        await pool.close()
