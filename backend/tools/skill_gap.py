"""
skill_gap.py — deterministic skill gap analysis tool.

All numbers (jobs_unlocked, avg_pay_uplift) are computed from the seed jobs
in the DB, and explanations come from templates. No LLM is involved.

Algorithm:
  1. Collect all jobs within MAX_DISTANCE_KM of the worker.
  2. A job is a "strong match" (score ≥ STRONG_MATCH_THRESHOLD) when scored
     against the worker's current profile.
  3. For each skill NOT in the worker's profile:
     a. Hypothetically add it to the profile and re-score all nearby jobs.
     b. Count how many NEW strong matches appear → jobs_unlocked.
     c. Compute average midpoint pay of those new jobs → avg_pay_uplift_inr
        (relative to worker's current average strong-match pay).
        With no current strong matches there is nothing to compare against, so
        the uplift is 0 and no pay claim is made.
  4. Return top 3 gaps sorted by jobs_unlocked desc, then pay_uplift desc, then
     skill id, so ties give the same result on every run.
"""
from __future__ import annotations

import json
import logging
from pathlib import Path
from typing import Any

from models.worker import WorkerProfile
from models.skill_gap import SkillGapItem, SkillGapResponse, LearningStep
from tools.job_ranker import _score, MAX_DISTANCE_KM, _haversine_km

logger = logging.getLogger(__name__)

_DATA = Path(__file__).parent.parent / "data"

STRONG_MATCH_THRESHOLD = 60    # score >= this counts as a "strong match"

# ── Explanation templates ────────────────────────────────────────────────────

_GAP_TEMPLATES: dict[str, str] = {
    "en": "Learning {skill} could unlock {n} more job{pl} near you, paying about ₹{pay} more per month.",
    "kn": "{skill} ಕಲಿತರೆ ನಿಮ್ಮ ಹತ್ತಿರ {n} ಹೊಸ ಕೆಲಸದ ಅವಕಾಶ ಸಿಗಬಹುದು, ತಿಂಗಳಿಗೆ ಸುಮಾರು ₹{pay} ಹೆಚ್ಚು ಸಂಪಾದಿಸಬಹುದು.",
    "hi": "{skill} सीखने से आपके आस-पास {n} नए काम का मौका मिल सकता है, और महीने में लगभग ₹{pay} ज़्यादा कमाई हो सकती है।",
}

_GAP_NO_UPLIFT_TEMPLATES: dict[str, str] = {
    "en": "Learning {skill} could unlock {n} more job{pl} near you.",
    "kn": "{skill} ಕಲಿತರೆ ನಿಮ್ಮ ಹತ್ತಿರ {n} ಹೊಸ ಕೆಲಸದ ಅವಕಾಶ ಸಿಗಬಹುದು.",
    "hi": "{skill} सीखने से आपके आस-पास {n} नए काम का मौका मिल सकता है।",
}


def _load_learning_paths() -> dict[str, Any]:
    path = _DATA / "learning_paths.json"
    with open(path, encoding="utf-8") as f:
        return json.load(f)


def _load_skill_labels() -> dict[str, dict[str, str]]:
    path = _DATA / "skills.json"
    with open(path, encoding="utf-8") as f:
        skills = json.load(f)
    return {s["id"]: {"en": s["label_en"], "kn": s["label_kn"], "hi": s["label_hi"]} for s in skills}


def _skill_label(skill_id: str, lang: str, labels: dict[str, dict[str, str]]) -> str:
    entry = labels.get(skill_id, {})
    return entry.get(lang) or entry.get("en") or skill_id.replace("_", " ")


def _strong_match_score(worker_skills: list[str], job: dict[str, Any],
                        wlat: float, wlon: float, worker_langs: list[str]) -> int:
    raw, dist, _, _ = _score(worker_skills, job, wlat, wlon, worker_langs)
    return max(0, min(100, round(raw * 100)))


def _avg_midpoint_pay(jobs: list[dict[str, Any]]) -> float:
    if not jobs:
        return 0.0
    return sum((j["pay_min"] + j["pay_max"]) / 2 for j in jobs) / len(jobs)


def compute_skill_gap(profile: WorkerProfile, all_jobs: list[dict[str, Any]]) -> SkillGapResponse:
    """
    Compute top-3 skill gaps for a worker profile.
    Numbers come exclusively from `all_jobs` (seed data).
    """
    if not profile.area:
        return SkillGapResponse(gaps=[])

    wlat = profile.area.lat
    wlon = profile.area.lon
    worker_langs = profile.languages or []
    lang = profile.detected_language or "en"
    lang_key = lang if lang in _GAP_TEMPLATES else "en"

    # Filter to nearby jobs only
    nearby = [j for j in all_jobs
              if _haversine_km(wlat, wlon, j["lat"], j["lon"]) <= MAX_DISTANCE_KM]

    # Current strong matches
    current_strong = {j["id"] for j in nearby
                      if _strong_match_score(profile.skills, j, wlat, wlon, worker_langs)
                      >= STRONG_MATCH_THRESHOLD}
    current_avg_pay = _avg_midpoint_pay([j for j in nearby if j["id"] in current_strong])

    # Collect all skills present in nearby jobs that worker doesn't have
    all_skills_in_area: set[str] = set()
    for j in nearby:
        all_skills_in_area.update(j["skills_required"])
    missing_skills = all_skills_in_area - set(profile.skills)

    learning_paths = _load_learning_paths()
    skill_labels = _load_skill_labels()

    gaps: list[tuple[int, int, SkillGapItem]] = []  # (jobs_unlocked, uplift, item)

    for skill_id in sorted(missing_skills):
        # Hypothetically add the skill
        hypothetical_skills = list(profile.skills) + [skill_id]
        new_strong = {j["id"] for j in nearby
                      if _strong_match_score(hypothetical_skills, j, wlat, wlon, worker_langs)
                      >= STRONG_MATCH_THRESHOLD}
        newly_unlocked_ids = new_strong - current_strong
        jobs_unlocked = len(newly_unlocked_ids)
        if jobs_unlocked == 0:
            continue

        newly_unlocked_jobs = [j for j in nearby if j["id"] in newly_unlocked_ids]
        new_avg_pay = _avg_midpoint_pay(newly_unlocked_jobs)
        # No current matches means no baseline, so make no pay-uplift claim.
        uplift = max(0, round(new_avg_pay - current_avg_pay)) if current_strong else 0

        label = _skill_label(skill_id, lang_key, skill_labels)
        pl = "s" if jobs_unlocked != 1 else ""

        if uplift > 0:
            explanation = _GAP_TEMPLATES[lang_key].format(
                skill=label, n=jobs_unlocked, pl=pl, pay=f"{uplift:,}",
            )
        else:
            explanation = _GAP_NO_UPLIFT_TEMPLATES[lang_key].format(
                skill=label, n=jobs_unlocked, pl=pl,
            )

        raw_steps = learning_paths.get(skill_id, {}).get("steps", [])
        steps = [LearningStep(step=s["step"], action=s["action"],
                              weeks=s["weeks"], approx_cost_inr=s["approx_cost_inr"])
                 for s in raw_steps]

        item = SkillGapItem(
            skill_id=skill_id,
            label_en=skill_labels.get(skill_id, {}).get("en", skill_id),
            label=label,
            jobs_unlocked=jobs_unlocked,
            avg_pay_uplift_inr=uplift,
            explanation=explanation,
            learning_path=steps,
        )
        gaps.append((jobs_unlocked, uplift, item))

    # Sort: most jobs unlocked first, then highest pay uplift, then skill id
    gaps.sort(key=lambda x: (-x[0], -x[1], x[2].skill_id))
    top3 = [item for _, _, item in gaps[:3]]
    return SkillGapResponse(gaps=top3)
