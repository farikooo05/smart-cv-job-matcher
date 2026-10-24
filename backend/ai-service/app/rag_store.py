import asyncio

import asyncpg

from .chunking import chunk_resume
from .embeddings import embed_texts, embedding_model, to_pgvector
from .schemas import RetrievedChunk


async def index_resume(pool: asyncpg.Pool, user_id: str, cv_text: str) -> int:
    chunks = chunk_resume(cv_text)
    if not chunks:
        raise ValueError("No readable CV text was found to index.")

    embeddings = await embed_texts([chunk.content for chunk in chunks])
    async with pool.acquire() as connection:
        async with connection.transaction():
            await connection.execute("DELETE FROM resume_chunks WHERE user_id = $1", user_id)
            await connection.executemany(
                """
                INSERT INTO resume_chunks
                    (user_id, chunk_index, section, start_word, end_word, content, embedding)
                VALUES ($1, $2, $3, $4, $5, $6, $7::text::vector)
                """,
                [
                    (
                        user_id,
                        chunk.chunk_index,
                        chunk.section,
                        chunk.start_word,
                        chunk.end_word,
                        chunk.content,
                        to_pgvector(embedding),
                    )
                    for chunk, embedding in zip(chunks, embeddings, strict=True)
                ],
            )
    return len(chunks)


async def search_resume(
    pool: asyncpg.Pool,
    user_id: str,
    requirements: list[str],
    top_k: int,
) -> dict[str, list[RetrievedChunk]]:
    embeddings = await embed_texts(requirements)

    async def search_one(requirement: str, embedding: list[float]) -> tuple[str, list[RetrievedChunk]]:
        async with pool.acquire() as connection:
            rows = await connection.fetch(
                """
                SELECT id, section, content, 1 - (embedding <=> $2::text::vector) AS similarity
                FROM resume_chunks
                WHERE user_id = $1
                ORDER BY embedding <=> $2::text::vector
                LIMIT $3
                """,
                user_id,
                to_pgvector(embedding),
                top_k,
            )
        return requirement, [
            RetrievedChunk(
                chunk_id=row["id"],
                section=row["section"],
                text=row["content"],
                similarity=float(row["similarity"]),
            )
            for row in rows
        ]

    results = await asyncio.gather(
        *(search_one(requirement, embedding) for requirement, embedding in zip(requirements, embeddings, strict=True))
    )
    return dict(results)


def store_metadata() -> dict[str, int | str]:
    return {"embedding_model": embedding_model(), "dimensions": 1024}
