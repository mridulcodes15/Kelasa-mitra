#!/usr/bin/env python3
"""
Write backend/data/jobs_snapshot.json from db.seed_jobs.build_seed_rows().

The Orchestrate tools run on a read-only filesystem and cannot open our SQLite
file, so they read this snapshot instead. It holds exactly the rows the backend
seeds into SQLite (tests/test_orchestrate_package.py checks this).

Usage (from the repo root):
    python backend/scripts/export_jobs_snapshot.py
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

BACKEND = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BACKEND))

from db.seed_jobs import build_seed_rows  # noqa: E402

SNAPSHOT = BACKEND / "data" / "jobs_snapshot.json"


def snapshot_text() -> str:
    return json.dumps(build_seed_rows(), ensure_ascii=False, indent=1) + "\n"


def main() -> None:
    SNAPSHOT.write_text(snapshot_text(), encoding="utf-8", newline="\n")
    print(f"Wrote {len(build_seed_rows())} jobs to {SNAPSHOT.relative_to(BACKEND.parent)}")


if __name__ == "__main__":
    main()
