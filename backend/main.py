"""Kelasa Mitra – FastAPI entry point."""
from __future__ import annotations

import logging
import os
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from pathlib import Path

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse

load_dotenv(Path(__file__).parent / ".env")

logging.basicConfig(level=logging.INFO)

from routers import profile_router, matches_router, skill_gap_router, agent_router  # noqa: E402 (after dotenv load)
from db.seed_jobs import seed_jobs  # noqa: E402

# The frontend calls the API through the Vite proxy (same origin), so CORS is only needed
# when a page on another origin calls the API directly. Allow only known origins, never "*".
DEFAULT_CORS_ORIGINS = ("http://localhost:5173", "http://127.0.0.1:5173")


def cors_origins() -> list[str]:
    """Origins from CORS_ALLOWED_ORIGINS (comma-separated), else the local Vite dev server."""
    configured = [o.strip() for o in os.getenv("CORS_ALLOWED_ORIGINS", "").split(",") if o.strip()]
    return [o for o in configured if o != "*"] or list(DEFAULT_CORS_ORIGINS)


@asynccontextmanager
async def lifespan(_: FastAPI) -> AsyncIterator[None]:
    n = seed_jobs()
    if n:
        logging.getLogger(__name__).info("Seeded %d jobs.", n)
    yield


app = FastAPI(
    title="Kelasa Mitra API",
    description="Voice-first job-matching for Bengaluru blue-collar workers",
    version="0.1.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins(),
    allow_methods=["GET", "POST"],
    allow_headers=["Content-Type"],
)

app.include_router(profile_router)
app.include_router(matches_router)
app.include_router(skill_gap_router)
app.include_router(agent_router)


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


# ── Built frontend (single-service deployment) ───────────────────────────────
# When frontend/dist exists (after `npm run build`, or in the Docker image), the same server
# also serves the app, so the page and /api share one origin and CORS is not needed. In
# development the folder is usually absent and Vite serves the app with its /api proxy.

DEFAULT_FRONTEND_DIST = Path(__file__).resolve().parent.parent / "frontend" / "dist"


def mount_frontend(target: FastAPI, dist: Path) -> bool:
    """Serve files from `dist`, and index.html for any other non-API GET path. Registered last,
    so every API route, /health and the API docs still match first."""
    root = dist.resolve()
    if not (root / "index.html").is_file():
        return False

    @target.get("/{path:path}", include_in_schema=False)
    def frontend(path: str) -> FileResponse:
        if path == "api" or path.startswith("api/"):
            raise HTTPException(status_code=404, detail="Not Found")  # unknown API path: no HTML
        candidate = (root / path).resolve()
        if path and candidate.is_file() and candidate.is_relative_to(root):
            return FileResponse(candidate)
        return FileResponse(root / "index.html")

    return True


if mount_frontend(app, Path(os.getenv("FRONTEND_DIST", "") or DEFAULT_FRONTEND_DIST)):
    logging.getLogger(__name__).info("Serving the built frontend.")
