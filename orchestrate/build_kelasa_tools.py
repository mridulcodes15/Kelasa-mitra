#!/usr/bin/env python3
"""
Build orchestrate/kelasa_tools/, the Python tool package imported into watsonx Orchestrate.

The package is assembled, never hand-written:
  - backend modules and data are copied byte for byte (BACKEND_FILES below),
  - kelasa_core.py, kelasa_mitra_tools.py and requirements.txt come from kelasa_tools_src/,
    (the entry file must NOT be named kelasa_tools.py: the ADK imports it as
    <package folder>.<entry file>, and a kelasa_tools.py inside the kelasa_tools folder
    shadows the folder, giving "'kelasa_tools' is not a package"),
  - the two package __init__.py files are written empty, because the backend's own
    __init__.py files import FastAPI, langdetect and the Groq provider, which the
    tools do not use.

tests/test_orchestrate_package.py checks that the copies match the backend and that
the tools give the same results as the backend endpoints.

Usage (from the repo root):
    python backend/scripts/export_jobs_snapshot.py
    python orchestrate/build_kelasa_tools.py
"""
from __future__ import annotations

import shutil
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
BACKEND = ROOT / "backend"
SOURCE = Path(__file__).resolve().parent / "kelasa_tools_src"
DEFAULT_OUTPUT = Path(__file__).resolve().parent / "kelasa_tools"

BACKEND_FILES = [
    "models/worker.py",
    "models/job.py",
    "models/skill_gap.py",
    "tools/fallback.py",
    "tools/follow_up.py",
    "tools/job_ranker.py",
    "tools/profile_builder.py",
    "tools/skill_gap.py",
    "data/skills.json",
    "data/areas.json",
    "data/learning_paths.json",
    "data/jobs_snapshot.json",
]
SOURCE_FILES = ["kelasa_core.py", "kelasa_mitra_tools.py", "requirements.txt"]
EMPTY_INITS = {
    "models/__init__.py": '"""Package marker written by build_kelasa_tools.py."""\n',
    "tools/__init__.py": '"""Package marker written by build_kelasa_tools.py."""\n',
}


def build(output: Path = DEFAULT_OUTPUT) -> list[str]:
    """Rebuild the package at `output`. Returns the relative paths written."""
    if output.exists():
        shutil.rmtree(output)
    written = []
    for rel in BACKEND_FILES:
        target = output / rel
        target.parent.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(BACKEND / rel, target)
        written.append(rel)
    for rel in SOURCE_FILES:
        shutil.copyfile(SOURCE / rel, output / rel)
        written.append(rel)
    for rel, text in EMPTY_INITS.items():
        (output / rel).write_text(text, encoding="utf-8", newline="\n")
        written.append(rel)
    return written


def main() -> None:
    snapshot = BACKEND / "data" / "jobs_snapshot.json"
    if not snapshot.exists():
        sys.exit("backend/data/jobs_snapshot.json is missing; run backend/scripts/export_jobs_snapshot.py first")
    written = build()
    print(f"Built {DEFAULT_OUTPUT.relative_to(ROOT)} with {len(written)} files:")
    for rel in written:
        print(f"  {rel}")


if __name__ == "__main__":
    main()
