#!/usr/bin/env python3
"""
Prototype benchmark of the deterministic pipeline on 15 synthetic inputs (en/kn/hi).

Runs entirely offline: rule-based extraction (GROQ_API_KEY is cleared before import),
ranking and skill gap over the sample jobs. It never calls Groq or Orchestrate and
never reads backend/.env.

The agent round trip is NOT timed here. Measure it with agent_warmup.py and pass its saved
output with --warmup-log; only "OK after N s" lines from that output are used.

Usage (from the repo root):
    python backend/scripts/run_eval.py
    python backend/scripts/agent_warmup.py > agent_warmup_log.txt   (owner, any number of runs, append with >>)
    python backend/scripts/run_eval.py --warmup-log agent_warmup_log.txt
"""
from __future__ import annotations

import argparse
import json
import os
import platform
import re
import statistics
import sys
import time
from datetime import date
from pathlib import Path
from typing import Any

os.environ["GROQ_API_KEY"] = ""  # rules only, no network

BACKEND = Path(__file__).resolve().parent.parent
ROOT = BACKEND.parent
sys.path.insert(0, str(BACKEND))

from db.seed_jobs import build_seed_rows  # noqa: E402
from tools.follow_up import follow_up_for  # noqa: E402
from tools.job_ranker import rank_jobs  # noqa: E402
from tools.profile_extractor import extract_profile  # noqa: E402
from tools.skill_gap import compute_skill_gap  # noqa: E402

SAMPLES_PATH = BACKEND / "tests" / "eval_samples.json"
DEFAULT_OUTPUT = ROOT / "docs" / "eval_results.md"
WARMUP_OK = re.compile(r"^OK after ([0-9.]+) s", re.M)


def load_samples(path: Path = SAMPLES_PATH) -> list[dict[str, Any]]:
    return json.loads(path.read_text(encoding="utf-8"))["samples"]


def _median_ms(fn, repeats: int) -> float:
    times = []
    for _ in range(repeats):
        start = time.perf_counter()
        fn()
        times.append((time.perf_counter() - start) * 1000)
    return statistics.median(times)


def evaluate(samples: list[dict[str, Any]], repeats: int = 30) -> list[dict[str, Any]]:
    jobs = build_seed_rows()
    rows = []
    for s in samples:
        text, lang, exp = s["input"], s["language"], s["expected"]
        profile = extract_profile(text, ui_language=lang)
        question = follow_up_for(profile)
        matches = rank_jobs(profile, jobs) if not question else []
        gaps = compute_skill_gap(profile, jobs).gaps if not question else []

        expected_skills = set(exp["skills_contain"])
        found = set(profile.skills)
        wanted_top = set(exp["top_match_requires_any"])
        top3 = matches[:3]
        rows.append({
            "id": s["id"], "language": lang,
            "skills_found": sorted(found),
            "skill_recall": len(expected_skills & found) / len(expected_skills),
            "extra_skills": sorted(found - expected_skills),
            "area_ok": (profile.area.id if profile.area else None) == exp["area_id"],
            "area_found": profile.area.id if profile.area else None,
            "experience_ok": profile.experience_years == exp["experience_years"],
            "experience_found": profile.experience_years,
            "follow_up": question,
            "top1_ok": bool(matches) and bool(wanted_top & set(matches[0].job.skills_required)),
            "top1": f"{matches[0].job.title} ({matches[0].score})" if matches else None,
            "top3_relevant": sum(bool(wanted_top & set(m.job.skills_required)) for m in top3),
            "gaps": len(gaps),
            "label_status": exp.get("label_status", ""),
            "profile_ms": _median_ms(lambda: extract_profile(text, ui_language=lang), repeats),
            "pipeline_ms": _median_ms(
                lambda: (lambda p: (rank_jobs(p, jobs), compute_skill_gap(p, jobs)))(
                    extract_profile(text, ui_language=lang)),
                repeats),
        })
    return rows


def read_warmup_seconds(paths: list[Path]) -> list[float]:
    seconds: list[float] = []
    for p in paths:
        seconds += [float(x) for x in WARMUP_OK.findall(p.read_text(encoding="utf-8", errors="replace"))]
    return seconds


def _pct(x: float) -> str:
    return f"{x * 100:.0f}%"


def render(rows: list[dict[str, Any]], repeats: int, warmup: list[float]) -> str:
    n = len(rows)
    drafts = sum("DRAFT" in r["label_status"] for r in rows)
    by_lang: dict[str, list[dict[str, Any]]] = {}
    for r in rows:
        by_lang.setdefault(r["language"], []).append(r)

    def summary(rs):
        return (
            f"| {len(rs)} | {_pct(statistics.mean(r['skill_recall'] for r in rs))} "
            f"| {sum(bool(r['extra_skills']) for r in rs)} "
            f"| {sum(r['area_ok'] for r in rs)}/{len(rs)} "
            f"| {sum(r['experience_ok'] for r in rs)}/{len(rs)} "
            f"| {sum(r['top1_ok'] for r in rs)}/{len(rs)} "
            f"| {sum(r['top3_relevant'] for r in rs)}/{3 * len(rs)} "
            f"| {statistics.median(r['profile_ms'] for r in rs):.2f} "
            f"| {statistics.median(r['pipeline_ms'] for r in rs):.2f} |"
        )

    L = [
        "# Evaluation results: prototype benchmark",
        "",
        f"Generated by `backend/scripts/run_eval.py` on {date.today().isoformat()}.",
        "",
        "**This is a prototype benchmark on synthetic inputs, not a field study.** The 15 inputs were",
        "written by an AI tool, with no real workers; the Kannada and Hindi inputs have not been",
        f"checked by a native speaker; and the jobs are the {len(build_seed_rows())} sample jobs.",
        "",
        "**Likely optimistic.** The inputs were written by the same AI tool that can see the",
        "extractor's synonym list (`backend/data/skills.json`) and area aliases, so most of them use",
        "words the rules already know. Real speech, spelling and code-mixing will score lower. Inputs",
        "written by people who have not seen the synonym list would be a fairer test.",
        "",
        f"**Expected labels: {drafts} of {n} are still marked \"DRAFT, owner to review\"** in",
        "`backend/tests/eval_samples.json`. Until they are reviewed, the accuracy figures below only",
        "measure agreement with draft labels.",
        "",
        "## What was measured",
        "",
        "- **Skill recall**: share of expected skills that the rule-based extractor found.",
        "- **Extra skills**: inputs where it also found a skill not in the expected list.",
        "- **Area, experience**: exact match with the expected value (null means none expected).",
        "- **Top-1 relevant**: the first-ranked job requires at least one expected skill.",
        "- **Top-3 relevant**: how many of the first three jobs require an expected skill.",
        f"- **Times**: median of {repeats} runs per input, in milliseconds, on one laptop",
        f"  ({platform.system()}, Python {platform.python_version()}).",
        "  *Profile* is rule-based extraction only; *pipeline* is extraction + ranking + skill gap,",
        "  i.e. the work behind one worker message. Rules only: no Groq, no network.",
        "",
        "## Summary",
        "",
        "| Language | Inputs | Skill recall | With extra skills | Area | Experience | Top-1 relevant | Top-3 relevant | Profile ms | Pipeline ms |",
        "|---|---|---|---|---|---|---|---|---|---|",
    ]
    for lang in ("en", "kn", "hi"):
        if lang in by_lang:
            L.append(f"| {lang} " + summary(by_lang[lang]))
    L.append("| **all** " + summary(rows))

    L += ["", "## Agent round trip (IBM watsonx Orchestrate)", ""]
    if warmup:
        L += [
            f"Measured with `backend/scripts/agent_warmup.py` ({len(warmup)} successful run(s)):",
            f"median {statistics.median(warmup):.1f} s, min {min(warmup):.1f} s, max {max(warmup):.1f} s.",
            "Each run includes getting an access token, the agent's model calls and its three tool calls",
            "in the Orchestrate cloud, so it is timed separately from the local pipeline above.",
        ]
    else:
        L += [
            "Not measured in this run. Run `python backend/scripts/agent_warmup.py >> agent_warmup_log.txt`",
            "a few times, then `python backend/scripts/run_eval.py --warmup-log agent_warmup_log.txt`.",
        ]

    L += [
        "",
        "## Comparison with a typical job form: assumption only",
        "",
        "**Assumption, not measured:** filling in a typical online job-portal form takes a worker",
        "noticeably longer than speaking or typing one sentence, especially for someone not comfortable",
        "with English forms. This project has not timed any form or any real user, so no speed-up",
        "figure should be claimed from these results. The times above measure only how fast the",
        "software answers once the worker has spoken or typed.",
        "",
        "## Per input",
        "",
        "| ID | Skills found | Recall | Extra | Area | Experience | Follow-up asked | Top-1 job (score) | Top-1 ok | Top-3 ok | Gaps | Profile ms | Pipeline ms |",
        "|---|---|---|---|---|---|---|---|---|---|---|---|---|",
    ]
    for r in rows:
        L.append(
            f"| {r['id']} | {', '.join(r['skills_found']) or '—'} | {_pct(r['skill_recall'])} "
            f"| {', '.join(r['extra_skills']) or '—'} "
            f"| {r['area_found'] or '—'} {'✓' if r['area_ok'] else '✗'} "
            f"| {r['experience_found'] if r['experience_found'] is not None else '—'} {'✓' if r['experience_ok'] else '✗'} "
            f"| {'yes' if r['follow_up'] else 'no'} | {r['top1'] or '—'} | {'✓' if r['top1_ok'] else '✗'} "
            f"| {r['top3_relevant']}/3 | {r['gaps']} | {r['profile_ms']:.2f} | {r['pipeline_ms']:.2f} |"
        )
    L += ["", "Inputs and expected labels: `backend/tests/eval_samples.json`."]
    return "\n".join(L) + "\n"


def main() -> int:
    parser = argparse.ArgumentParser(description="Prototype benchmark on synthetic inputs.")
    parser.add_argument("--repeats", type=int, default=30)
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT)
    parser.add_argument("--warmup-log", type=Path, action="append", default=[],
                        help="saved agent_warmup.py output; may be given more than once")
    args = parser.parse_args()

    rows = evaluate(load_samples(), repeats=args.repeats)
    warmup = read_warmup_seconds(args.warmup_log)
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(render(rows, args.repeats, warmup), encoding="utf-8", newline="\n")
    print(f"Wrote {args.output}")
    for r in rows:
        print(f"{r['id']:5} recall={_pct(r['skill_recall']):>4} area={'ok' if r['area_ok'] else 'MISS':4} "
              f"exp={'ok' if r['experience_ok'] else 'MISS':4} top1={'ok' if r['top1_ok'] else 'MISS':4} "
              f"top3={r['top3_relevant']}/3 extra={r['extra_skills']} pipeline={r['pipeline_ms']:.2f} ms")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
