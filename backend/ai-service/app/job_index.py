"""Vector index of job postings (the retrieval half of RAG).

Jobs are embedded once and stored in pgvector. A CV profile is embedded as the query and
the nearest jobs come back as the candidates the LLM pipeline then analyses in detail.

Duplicates are handled at three points:
  1. the primary key is the job id, so re-indexing a job updates its row instead of adding one;
  2. a content hash skips the embedding call when the job text has not changed;
  3. at search time, the same vacancy posted on several job boards (same title and company,
     or a near-identical vector) is collapsed into one result so it cannot fill the top-k.
"""

from __future__ import annotations

import hashlib
import json
import math
from dataclasses import dataclass, field

import asyncpg

from .cache import Cache, cache_key
from .gemini_client import GeminiClient
from .guardrails import normalize_for_match, sanitize_text
from .schemas import IndexJobsResponse, JobDocument, JobHit, SearchJobsResponse

# Over-fetch so that collapsing duplicates still leaves `top_k` distinct jobs.
CANDIDATE_MULTIPLIER = 4


def job_text(job: JobDocument) -> str:
    """The text that represents a job in the index. Postings without a description are indexed by title."""
    lines = [job.title, job.company, job.location, sanitize_text(job.description)]
    return "\n".join(line for line in lines if line)


def dedupe_key(job: JobDocument) -> str:
    return f"{normalize_for_match(job.title)}|{normalize_for_match(job.company)}"


def content_hash(model: str, dimensions: int, text: str) -> str:
    return hashlib.sha256(f"{model}|{dimensions}|{text}".encode("utf-8")).hexdigest()


def to_pgvector(vector: list[float]) -> str:
    if not vector or not all(math.isfinite(value) for value in vector):
        raise ValueError("Embedding vector has an invalid shape or value.")
    return "[" + ",".join(format(value, ".8g") for value in vector) + "]"


def cosine(left: list[float], right: list[float]) -> float:
    """Dot product; both vectors are stored as unit vectors."""
    return sum(a * b for a, b in zip(left, right, strict=True))


@dataclass
class Candidate:
    job_id: str
    similarity: float
    key: str
    vector: list[float]
    duplicate_job_ids: list[str] = field(default_factory=list)


def collapse_duplicates(
    candidates: list[Candidate],
    *,
    top_k: int,
    min_similarity: float,
    duplicate_similarity: float,
) -> tuple[list[Candidate], int]:
    """Greedy pass over candidates in similarity order.

    A candidate that repeats an already chosen job is attached to it instead of taking a
    result slot. Returns the chosen jobs and the number of duplicates collapsed.
    """
    chosen: list[Candidate] = []
    collapsed = 0
    for candidate in sorted(candidates, key=lambda item: -item.similarity):
        if candidate.similarity < min_similarity:
            break
        original = next(
            (
                item for item in chosen
                if item.key == candidate.key or cosine(item.vector, candidate.vector) >= duplicate_similarity
            ),
            None,
        )
        if original is not None:
            original.duplicate_job_ids.append(candidate.job_id)
            collapsed += 1
        elif len(chosen) < top_k:
            chosen.append(candidate)
    return chosen, collapsed


async def index_jobs(pool: asyncpg.Pool, llm: GeminiClient, jobs: list[JobDocument]) -> IndexJobsResponse:
    settings = llm.settings
    model, dimensions = settings.embedding_model, settings.embedding_dimensions
    documents = {job.job_id: (job_text(job), dedupe_key(job)) for job in jobs}
    hashes = {job_id: content_hash(model, dimensions, text) for job_id, (text, _) in documents.items()}

    rows = await pool.fetch(
        "SELECT job_id, content_hash FROM job_embeddings WHERE job_id = ANY($1::text[])", list(documents),
    )
    stored = {row["job_id"]: row["content_hash"] for row in rows}
    changed = [job_id for job_id in documents if stored.get(job_id) != hashes[job_id]]

    # Identical text under different job ids is embedded once.
    texts = list(dict.fromkeys(documents[job_id][0] for job_id in changed))
    vectors = dict(zip(texts, await llm.embed(texts, task_type="RETRIEVAL_DOCUMENT"), strict=True)) if texts else {}

    if changed:
        await pool.executemany(
            """
            INSERT INTO job_embeddings (job_id, content_hash, dedupe_key, embedding_model, embedding)
            VALUES ($1, $2, $3, $4, $5::text::vector)
            ON CONFLICT (job_id) DO UPDATE SET
                content_hash = EXCLUDED.content_hash,
                dedupe_key = EXCLUDED.dedupe_key,
                embedding_model = EXCLUDED.embedding_model,
                embedding = EXCLUDED.embedding,
                updated_at = NOW()
            """,
            [
                (job_id, hashes[job_id], documents[job_id][1], model, to_pgvector(vectors[documents[job_id][0]]))
                for job_id in changed
            ],
        )
    return IndexJobsResponse(embedded=len(changed), unchanged=len(documents) - len(changed), embedding_model=model)


async def embed_query(llm: GeminiClient, cache: Cache, text: str) -> list[float]:
    settings = llm.settings
    key = cache_key("embed-query", settings.embedding_model, settings.embedding_dimensions, text)
    cached = await cache.get(key)
    if cached and isinstance(cached.get("vector"), list):
        return cached["vector"]
    vector = (await llm.embed([text], task_type="RETRIEVAL_QUERY"))[0]
    await cache.set(key, "embed-query", {"vector": vector})
    return vector


async def search_jobs(
    pool: asyncpg.Pool,
    llm: GeminiClient,
    cache: Cache,
    *,
    query_text: str,
    top_k: int | None = None,
    min_similarity: float | None = None,
    job_ids: list[str] | None = None,
) -> SearchJobsResponse:
    settings = llm.settings
    top_k = top_k or settings.retrieval_top_k
    min_similarity = settings.retrieval_min_similarity if min_similarity is None else min_similarity
    query = await embed_query(llm, cache, sanitize_text(query_text))

    # Exact nearest-neighbour scan. The table holds thousands of jobs at most, where an exact
    # scan takes milliseconds and, unlike an approximate (HNSW) index, cannot miss a result
    # when the search is filtered to a subset of job ids.
    rows = await pool.fetch(
        """
        SELECT job_id, dedupe_key, embedding::text AS embedding,
               1 - (embedding <=> $1::text::vector) AS similarity
        FROM job_embeddings
        WHERE embedding_model = $2 AND ($3::text[] IS NULL OR job_id = ANY($3::text[]))
        ORDER BY embedding <=> $1::text::vector
        LIMIT $4
        """,
        to_pgvector(query),
        settings.embedding_model,
        job_ids,
        top_k * CANDIDATE_MULTIPLIER,
    )
    candidates = [
        Candidate(row["job_id"], float(row["similarity"]), row["dedupe_key"], json.loads(row["embedding"]))
        for row in rows
    ]
    chosen, collapsed = collapse_duplicates(
        candidates,
        top_k=top_k,
        min_similarity=min_similarity,
        duplicate_similarity=settings.duplicate_similarity,
    )
    return SearchJobsResponse(
        results=[
            JobHit(job_id=item.job_id, similarity=round(item.similarity, 4), duplicate_job_ids=item.duplicate_job_ids)
            for item in chosen
        ],
        top_k=top_k,
        candidates_considered=len(candidates),
        duplicates_collapsed=collapsed,
    )
