"""Kelasa Mitra – FastAPI entry point."""
from __future__ import annotations

import logging
from pathlib import Path

from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

load_dotenv(Path(__file__).parent / ".env")

logging.basicConfig(level=logging.INFO)

from routers import profile_router, matches_router, skill_gap_router, agent_router  # noqa: E402 (after dotenv load)
from db.seed_jobs import seed_jobs  # noqa: E402

app = FastAPI(
    title="Kelasa Mitra API",
    description="Voice-first job-matching for Bengaluru blue-collar workers",
    version="0.1.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(profile_router)
app.include_router(matches_router)
app.include_router(skill_gap_router)
app.include_router(agent_router)


@app.on_event("startup")
def _startup() -> None:
    n = seed_jobs()
    if n:
        logging.getLogger(__name__).info("Seeded %d jobs.", n)


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}
