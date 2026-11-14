"""Response cache for LLM calls.

The key is a hash of everything that can change the answer: stage, model, sampling
settings, prompt version and the full prompt text. The same vacancy is analysed for
many users, so its requirement list is extracted once and reused.
"""

from __future__ import annotations

import hashlib
import json
from pathlib import Path
from typing import Protocol

import asyncpg


def cache_key(*parts: object) -> str:
    payload = json.dumps(parts, ensure_ascii=False, sort_keys=True, default=str)
    return hashlib.sha256(payload.encode("utf-8")).hexdigest()


class Cache(Protocol):
    async def get(self, key: str) -> dict | None: ...

    async def set(self, key: str, stage: str, value: dict) -> None: ...


class NullCache:
    async def get(self, key: str) -> dict | None:
        return None

    async def set(self, key: str, stage: str, value: dict) -> None:
        return None


class MemoryCache:
    def __init__(self) -> None:
        self._items: dict[str, dict] = {}

    async def get(self, key: str) -> dict | None:
        return self._items.get(key)

    async def set(self, key: str, stage: str, value: dict) -> None:
        self._items[key] = value


class FileCache(MemoryCache):
    """Used by the evaluation runner so an interrupted run resumes without paying for the same calls again."""

    def __init__(self, path: Path) -> None:
        super().__init__()
        self._path = path
        if path.exists():
            self._items = json.loads(path.read_text(encoding="utf-8"))

    async def set(self, key: str, stage: str, value: dict) -> None:
        await super().set(key, stage, value)
        self._path.parent.mkdir(parents=True, exist_ok=True)
        self._path.write_text(json.dumps(self._items, ensure_ascii=False), encoding="utf-8")


class PostgresCache:
    def __init__(self, pool: asyncpg.Pool) -> None:
        self._pool = pool

    async def get(self, key: str) -> dict | None:
        try:
            value = await self._pool.fetchval("SELECT value FROM llm_cache WHERE key = $1", key)
        except (asyncpg.PostgresError, OSError):
            return None  # A cache outage must never fail a request.
        return json.loads(value) if value else None

    async def set(self, key: str, stage: str, value: dict) -> None:
        try:
            await self._pool.execute(
                """
                INSERT INTO llm_cache (key, stage, value) VALUES ($1, $2, $3::jsonb)
                ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, created_at = NOW()
                """,
                key,
                stage,
                json.dumps(value, ensure_ascii=False),
            )
        except (asyncpg.PostgresError, OSError):
            return None
