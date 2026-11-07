"""SQLite database setup using SQLAlchemy Core (no ORM overhead for this size)."""
from __future__ import annotations

import json
from pathlib import Path

from sqlalchemy import (
    Boolean, Column, Float, Integer, MetaData, String, Table, Text,
    create_engine, event,
)
from sqlalchemy.engine import Engine

DB_PATH = Path(__file__).parent / "kelasa_mitra.db"
ENGINE = create_engine(f"sqlite:///{DB_PATH}", connect_args={"check_same_thread": False})

# Enable WAL mode for better concurrent read performance
@event.listens_for(ENGINE, "connect")
def _set_wal(dbapi_conn, _):
    dbapi_conn.execute("PRAGMA journal_mode=WAL")

metadata = MetaData()

jobs_table = Table(
    "jobs",
    metadata,
    Column("id", String, primary_key=True),
    Column("title", String, nullable=False),
    Column("employer", String, nullable=False),
    Column("area", String, nullable=False),
    Column("lat", Float, nullable=False),
    Column("lon", Float, nullable=False),
    Column("pay_min", Integer, nullable=False),
    Column("pay_max", Integer, nullable=False),
    Column("skills_required", Text, nullable=False),   # JSON array of skill IDs
    Column("languages", Text, nullable=False),         # JSON array of lang names
    Column("type", String, nullable=False),            # "job" | "apprenticeship"
    Column("posted_at", String, nullable=False),       # ISO8601
    Column("is_synthetic", Boolean, nullable=False, default=True),
)


def init_db() -> None:
    """Create tables if they do not exist."""
    metadata.create_all(ENGINE)


def get_all_jobs() -> list[dict]:
    """Return all jobs as plain dicts."""
    with ENGINE.connect() as conn:
        rows = conn.execute(jobs_table.select()).mappings().all()
    result = []
    for row in rows:
        d = dict(row)
        d["skills_required"] = json.loads(d["skills_required"])
        d["languages"] = json.loads(d["languages"])
        result.append(d)
    return result
