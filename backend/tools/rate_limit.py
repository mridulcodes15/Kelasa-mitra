"""
A small in-memory, per-client rate limit for public endpoints (no extra dependency).

Each limit counts requests per client IP in a sliding window. Over the limit, the request
gets HTTP 429 with a Retry-After header. State lives in this process only: it resets on
restart and is not shared between workers, which is enough for a single-instance demo.

Behind a proxy (Render, Hugging Face), start uvicorn with --proxy-headers so
request.client.host is the visitor's IP rather than the proxy's.
"""
from __future__ import annotations

import math
import threading
import time
from collections import deque
from typing import Callable

from fastapi import HTTPException, Request

MAX_TRACKED_CLIENTS = 10_000  # bounds memory: the oldest-seen clients are dropped first


class RateLimiter:
    def __init__(self, limit: int, window_s: float = 60.0, clock: Callable[[], float] = time.monotonic):
        self.limit = limit
        self.window_s = window_s
        self._clock = clock
        self._hits: dict[str, deque[float]] = {}
        self._lock = threading.Lock()

    def check(self, client: str) -> float:
        """Record one request. Returns 0 if allowed, else the seconds until the next is allowed."""
        now = self._clock()
        with self._lock:
            hits = self._hits.pop(client, None) or deque()
            while hits and now - hits[0] >= self.window_s:
                hits.popleft()
            if len(hits) >= self.limit:
                self._hits[client] = hits  # re-insert as most recently seen
                return max(0.0, self.window_s - (now - hits[0]))
            hits.append(now)
            self._hits[client] = hits
            while len(self._hits) > MAX_TRACKED_CLIENTS:
                self._hits.pop(next(iter(self._hits)))
            return 0.0

    def reset(self) -> None:
        with self._lock:
            self._hits.clear()


def client_ip(request: Request) -> str:
    return request.client.host if request.client else "unknown"


def rate_limited(limiter: RateLimiter) -> Callable[[Request], None]:
    """A FastAPI dependency that answers 429 when this client is over the limit."""
    def dependency(request: Request) -> None:
        wait = limiter.check(client_ip(request))
        if wait > 0:
            raise HTTPException(
                status_code=429,
                detail="Too many requests. Please wait a minute and try again.",
                headers={"Retry-After": str(max(1, math.ceil(wait)))},
            )
    return dependency


# Per client IP, per minute. The agent call is the costly one (an Orchestrate round trip).
EXTRACT_LIMITER = RateLimiter(limit=30)
AGENT_LIMITER = RateLimiter(limit=10)
