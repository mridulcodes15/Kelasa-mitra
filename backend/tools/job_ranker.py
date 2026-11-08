"""
job_ranker.py — deterministic job matching and ranking tool.

Algorithm:
    score = 0.6 * skill_overlap + 0.3 * (1 - distance_penalty) + 0.1 * language_bonus
    normalised to 0-100 integer.

Reasons are template-based: no LLM, no hallucination.
"""
from __future__ import annotations

import math
from typing import Any

from models.worker import WorkerProfile
from models.job import Job, JobMatch


# ── Reason templates ─────────────────────────────────────────────────────────

_REASON_TEMPLATES: dict[str, dict[str, str]] = {
    "en": {
        "skills_and_near": "Matched because you have {skills} experience and it's in your area.",
        "skills_and_location": "Matched because you have {skills} experience and it's ~{dist} km away.",
        "skills_only": "Matched because you have {skills} experience.",
        "location_near": "Opportunity in your area.",
        "location_only": "Nearby opportunity — ~{dist} km away.",
        "generic": "Good match based on your profile.",
    },
    "kn": {
        "skills_and_near": "ನಿಮ್ಮ {skills} ಅನುಭವ ಮತ್ತು ನಿಮ್ಮ ಪ್ರದೇಶದಲ್ಲಿ ಇರುವ ಕಾರಣ ಸೂಕ್ತವಾಗಿದೆ.",
        "skills_and_location": "ನಿಮ್ಮ {skills} ಅನುಭವ ಮತ್ತು ಸರಿಸುಮಾರು {dist} ಕಿಮೀ ದೂರದ ಕಾರಣ ಸೂಕ್ತವಾಗಿದೆ.",
        "skills_only": "ನಿಮ್ಮ {skills} ಅನುಭವದ ಕಾರಣ ಸೂಕ್ತವಾಗಿದೆ.",
        "location_near": "ನಿಮ್ಮ ಪ್ರದೇಶದಲ್ಲಿ ಅವಕಾಶ.",
        "location_only": "ಹತ್ತಿರದ ಅವಕಾಶ — ಸರಿಸುಮಾರು {dist} ಕಿಮೀ ದೂರ.",
        "generic": "ನಿಮ್ಮ ಪ್ರೊಫೈಲ್ ಆಧಾರದ ಮೇಲೆ ಉತ್ತಮ ಹೊಂದಾಣಿಕೆ.",
    },
    "hi": {
        "skills_and_near": "आपके {skills} अनुभव और यह आपके इलाके में होने के कारण यह काम उपयुक्त है।",
        "skills_and_location": "आपके {skills} अनुभव और लगभग {dist} किमी दूर होने के कारण यह काम उपयुक्त है।",
        "skills_only": "आपके {skills} अनुभव के कारण यह काम उपयुक्त है।",
        "location_near": "आपके इलाके में अवसर।",
        "location_only": "पास में अवसर — लगभग {dist} किमी दूर।",
        "generic": "आपकी प्रोफ़ाइल के आधार पर अच्छा मिलान।",
    },
}

# Human-readable skill label (from ID) — kept in three languages for reason lines
_SKILL_LABELS: dict[str, dict[str, str]] = {
    "hotel_helper":        {"en": "hotel helper",     "kn": "ಹೋಟೆಲ್ ಹೆಲ್ಪರ್",  "hi": "होटल हेल्पर"},
    "cook":                {"en": "cooking",           "kn": "ಅಡುಗೆ",            "hi": "खाना बनाना"},
    "housekeeping":        {"en": "housekeeping",      "kn": "ಹೌಸ್‌ಕೀಪಿಂಗ್",   "hi": "हाउसकीपिंग"},
    "security_guard":      {"en": "security guard",   "kn": "ಸೆಕ್ಯೂರಿಟಿ",       "hi": "सुरक्षा"},
    "driver_car":          {"en": "car driving",       "kn": "ಕಾರ್ ಚಾಲನೆ",       "hi": "कार चलाना"},
    "two_wheeler":         {"en": "bike riding",       "kn": "ಬೈಕ್ ಓಡಿಸುವಿಕೆ",   "hi": "बाइक चलाना"},
    "delivery":            {"en": "delivery",          "kn": "ಡೆಲಿವರಿ",            "hi": "डिलीवरी"},
    "electrician":         {"en": "electrical work",   "kn": "ವಿದ್ಯುತ್ ಕೆಲಸ",     "hi": "बिजली का काम"},
    "plumber":             {"en": "plumbing",          "kn": "ಪ್ಲಂಬಿಂಗ್",         "hi": "प्लंबिंग"},
    "tailoring":           {"en": "tailoring",         "kn": "ಹೊಲಿಗೆ",             "hi": "सिलाई"},
    "construction_helper": {"en": "construction",      "kn": "ನಿರ್ಮಾಣ ಕೆಲಸ",      "hi": "निर्माण काम"},
    "mason":               {"en": "masonry",           "kn": "ಗಾರೆ ಕೆಲಸ",         "hi": "राजमिस्त्री"},
    "pos_billing":         {"en": "billing/POS",       "kn": "ಬಿಲ್ಲಿಂಗ್",         "hi": "बिलिंग"},
    "retail_sales":        {"en": "retail sales",      "kn": "ಮಾರಾಟ",              "hi": "बिक्री"},
    "warehouse":           {"en": "warehouse packing", "kn": "ಗೋದಾಮು",             "hi": "गोदाम"},
    "data_entry":          {"en": "data entry",        "kn": "ಡೇಟಾ ಎಂಟ್ರಿ",       "hi": "डेटा एंट्री"},
    "ac_technician":       {"en": "AC repair",         "kn": "ಎಸಿ ರಿಪೇರಿ",        "hi": "एसी रिपेयर"},
    "mobile_repair":       {"en": "mobile repair",     "kn": "ಮೊಬೈಲ್ ರಿಪೇರಿ",     "hi": "मोबाइल रिपेयर"},
    "painting":            {"en": "painting",          "kn": "ಪೇಂಟಿಂಗ್",          "hi": "पेंटिंग"},
    "welder":              {"en": "welding",           "kn": "ವೆಲ್ಡಿಂಗ್",          "hi": "वेल्डिंग"},
    "carpenter":           {"en": "carpentry",         "kn": "ಮರಗೆಲಸ",             "hi": "बढ़ईगीरी"},
    "auto_driver":         {"en": "auto driving",      "kn": "ಆಟೋ ಚಾಲನೆ",         "hi": "ऑटो चलाना"},
    "truck_driver":        {"en": "truck driving",     "kn": "ಲಾರಿ ಚಾಲನೆ",        "hi": "ट्रक चलाना"},
    "watchman":            {"en": "watchman",          "kn": "ಕಾವಲುಗಾರ",           "hi": "चौकीदार"},
    "barber":              {"en": "barbering",         "kn": "ಕ್ಷೌರ",              "hi": "बाल काटना"},
    "beautician":          {"en": "beauty services",   "kn": "ಬ್ಯೂಟಿ",             "hi": "ब्यूटी सेवाएं"},
    "gardener":            {"en": "gardening",         "kn": "ತೋಟಗಾರಿಕೆ",          "hi": "बागबानी"},
    "babysitter":          {"en": "childcare",         "kn": "ಮಕ್ಕಳ ಆರೈಕೆ",        "hi": "बच्चों की देखभाल"},
    "elder_care":          {"en": "elder care",        "kn": "ಹಿರಿಯರ ಆರೈಕೆ",       "hi": "बुजुर्ग देखभाल"},
    "laundry":             {"en": "laundry",           "kn": "ಲಾಂಡ್ರಿ",            "hi": "कपड़े धोना"},
    "factory_worker":      {"en": "factory work",      "kn": "ಕಾರ್ಖಾನೆ",           "hi": "फैक्ट्री काम"},
    "sanitation":          {"en": "sanitation",        "kn": "ಸ್ವಚ್ಛತೆ",           "hi": "सफाई"},
    "event_helper":        {"en": "event work",        "kn": "ಈವೆಂಟ್",             "hi": "इवेंट काम"},
    "gym_trainer":         {"en": "fitness training",  "kn": "ಫಿಟ್ನೆಸ್",           "hi": "फिटनेस"},
    "basic_english":       {"en": "English skills",    "kn": "ಇಂಗ್ಲಿಷ್",           "hi": "अंग्रेजी"},
    "driving_licence":     {"en": "driving licence",   "kn": "ಡ್ರೈವಿಂಗ್ ಲೈಸೆನ್ಸ್", "hi": "ड्राइविंग लाइसेंस"},
    "forklift":            {"en": "forklift",          "kn": "ಫೋರ್ಕ್‌ಲಿಫ್ಟ್",     "hi": "फोर्कलिफ्ट"},
    "food_handler":        {"en": "food handling",     "kn": "ಆಹಾರ ಸುರಕ್ಷತೆ",     "hi": "खाद्य सुरक्षा"},
    "swimming_pool":       {"en": "pool attendance",   "kn": "ಈಜುಕೊಳ",             "hi": "स्विमिंग पूल"},
    "farm_worker":         {"en": "farm work",         "kn": "ಕೃಷಿ",               "hi": "खेती"},
    "telecalling":         {"en": "telecalling",       "kn": "ಟೆಲಿಕಾಲಿಂಗ್",        "hi": "टेलीकालिंग"},
}


def _skill_label(skill_id: str, lang: str) -> str:
    entry = _SKILL_LABELS.get(skill_id)
    if entry:
        return entry.get(lang) or entry.get("en") or skill_id.replace("_", " ")
    return skill_id.replace("_", " ")


def _join_skills(skills: list[str], lang: str) -> str:
    labels = [_skill_label(s, lang) for s in skills[:3]]  # max 3 in reason
    if lang == "kn":
        return " ಮತ್ತು ".join(labels)
    if lang == "hi":
        return " और ".join(labels)
    if len(labels) == 1:
        return labels[0]
    return ", ".join(labels[:-1]) + " and " + labels[-1]


_NEAR_KM = 1.0  # threshold for "in your area" vs distance string


def _build_reason(matched: list[str], dist: float, lang: str) -> str:
    lang_key = lang if lang in _REASON_TEMPLATES else "en"
    tmpl = _REASON_TEMPLATES[lang_key]
    near = dist < _NEAR_KM
    dist_str = str(round(dist, 1))

    if matched and near:
        return tmpl["skills_and_near"].format(skills=_join_skills(matched, lang_key))
    if matched and dist <= 20:
        return tmpl["skills_and_location"].format(skills=_join_skills(matched, lang_key), dist=dist_str)
    if matched:
        return tmpl["skills_only"].format(skills=_join_skills(matched, lang_key))
    if near:
        return tmpl["location_near"]
    if dist <= 20:
        return tmpl["location_only"].format(dist=dist_str)
    return tmpl["generic"]


# ── Haversine distance ────────────────────────────────────────────────────────

def _haversine_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    R = 6371.0
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    a = math.sin(dlat / 2) ** 2 + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(dlon / 2) ** 2
    return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))


MAX_DISTANCE_KM = 20.0
MIN_SKILL_MATCHES = 3  # below this, nearby jobs without a skill match are still shown


def _score(worker_skills: list[str], job: dict[str, Any], worker_lat: float, worker_lon: float, worker_langs: list[str]) -> tuple[float, float, list[str], list[str]]:
    req = job["skills_required"]
    matched = [s for s in req if s in worker_skills]
    missing = [s for s in req if s not in worker_skills]

    skill_overlap = (len(matched) / len(req)) if req else 0.0
    dist = _haversine_km(worker_lat, worker_lon, job["lat"], job["lon"])
    distance_penalty = min(dist, MAX_DISTANCE_KM) / MAX_DISTANCE_KM
    lang_bonus = 1.0 if any(l in (job.get("languages") or []) for l in worker_langs) else 0.0

    raw = 0.6 * skill_overlap + 0.3 * (1.0 - distance_penalty) + 0.1 * lang_bonus
    return raw, dist, matched, missing


def rank_jobs(profile: WorkerProfile, all_jobs: list[dict[str, Any]], top_n: int = 10) -> list[JobMatch]:
    """
    Rank jobs for a worker profile.  Returns up to top_n JobMatch objects,
    sorted by score descending, excluding jobs > MAX_DISTANCE_KM away.
    """
    if not profile.area:
        return []

    worker_langs = profile.languages or []
    detected_lang = profile.detected_language or "en"
    lang_key = detected_lang if detected_lang in _REASON_TEMPLATES else "en"

    results: list[tuple[int, float, JobMatch]] = []
    for job_dict in all_jobs:
        raw, dist, matched, missing = _score(
            profile.skills,
            job_dict,
            profile.area.lat,
            profile.area.lon,
            worker_langs,
        )
        if dist > MAX_DISTANCE_KM:
            continue
        score = max(0, min(100, round(raw * 100)))

        job_obj = Job(
            id=job_dict["id"],
            title=job_dict["title"],
            employer=job_dict["employer"],
            area=job_dict["area"],
            lat=job_dict["lat"],
            lon=job_dict["lon"],
            pay_min=job_dict["pay_min"],
            pay_max=job_dict["pay_max"],
            skills_required=job_dict["skills_required"],
            languages=job_dict["languages"],
            type=job_dict["type"],
            posted_at=job_dict["posted_at"],
            is_synthetic=job_dict["is_synthetic"],
        )
        reason = _build_reason(matched, dist, lang_key)
        results.append((score, dist, JobMatch(
            job=job_obj,
            score=score,
            distance_km=round(dist, 2),
            matched_skills=matched,
            missing_skills=missing,
            reason=reason,
        )))

    # A job that uses none of the worker's skills is not a "match". Show such jobs only when
    # fewer than MIN_SKILL_MATCHES skill-matched jobs exist within MAX_DISTANCE_KM.
    skill_matched = [r for r in results if r[2].matched_skills]
    if len(skill_matched) >= MIN_SKILL_MATCHES:
        results = skill_matched

    results.sort(key=lambda x: (-x[0], x[1]))
    return [jm for _, _, jm in results[:top_n]]
