import math
import os

import httpx


EMBEDDING_DIMENSIONS = 1024


def embedding_model() -> str:
    return os.getenv("OLLAMA_EMBEDDING_MODEL", "bge-m3")


async def embed_texts(texts: list[str]) -> list[list[float]]:
    if not texts:
        return []

    base_url = os.getenv("OLLAMA_EMBEDDING_URL", "http://host.docker.internal:11434").rstrip("/")
    try:
        async with httpx.AsyncClient(timeout=120) as client:
            response = await client.post(
                f"{base_url}/api/embed",
                json={"model": embedding_model(), "input": texts},
            )
    except httpx.TimeoutException as exc:
        raise RuntimeError("Ollama embedding request timed out.") from exc
    except httpx.HTTPError as exc:
        raise RuntimeError("Cannot connect to Ollama for embeddings. Start Ollama and retry.") from exc

    if response.status_code == 404:
        raise RuntimeError(f"Embedding model '{embedding_model()}' is not installed. Pull it with: ollama pull {embedding_model()}")
    if response.is_error:
        raise RuntimeError(f"Ollama embedding request failed with HTTP {response.status_code}.")

    try:
        vectors = response.json()["embeddings"]
        if len(vectors) != len(texts):
            raise ValueError("embedding count mismatch")
        normalized_vectors = [[float(value) for value in vector] for vector in vectors]
        if any(
            len(vector) != EMBEDDING_DIMENSIONS or any(not math.isfinite(value) for value in vector)
            for vector in normalized_vectors
        ):
            raise ValueError("embedding dimension or value is invalid")
        return normalized_vectors
    except (ValueError, KeyError, TypeError) as exc:
        raise RuntimeError(f"Ollama must return finite {EMBEDDING_DIMENSIONS}-dimensional embeddings from {embedding_model()}.") from exc


def to_pgvector(vector: list[float]) -> str:
    if len(vector) != EMBEDDING_DIMENSIONS or any(not math.isfinite(value) for value in vector):
        raise ValueError("Embedding vector has an invalid shape or value.")
    return "[" + ",".join(format(value, ".8g") for value in vector) + "]"
