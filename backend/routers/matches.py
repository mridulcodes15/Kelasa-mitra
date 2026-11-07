"""POST /api/matches"""
from __future__ import annotations

from fastapi import APIRouter
from pydantic import BaseModel

from db.database import get_all_jobs
from models.worker import WorkerProfile
from models.job import MatchResponse
from tools.job_ranker import rank_jobs

router = APIRouter(prefix="/api", tags=["matches"])

# Follow-up question strings when profile is incomplete
_FOLLOW_UP: dict[str, dict[str, str]] = {
    "no_area": {
        "en": "Where in Bengaluru do you live? (e.g. Whitefield, Koramangala, Jayanagar)",
        "kn": "ನೀವು ಬೆಂಗಳೂರಿನ ಯಾವ ಭಾಗದಲ್ಲಿ ವಾಸಿಸುತ್ತೀರಿ? (ಉದಾ: ವೈಟ್‌ಫೀಲ್ಡ್, ಕೋರಮಂಗಲ, ಜಯನಗರ)",
        "hi": "आप बेंगलुरु के किस इलाके में रहते हैं? (जैसे व्हाइटफील्ड, कोरमंगला, जयनगर)",
    },
    "no_skills": {
        "en": "What kind of work have you done? (e.g. cooking, security, delivery, tailoring)",
        "kn": "ನೀವು ಯಾವ ರೀತಿಯ ಕೆಲಸ ಮಾಡಿದ್ದೀರಿ? (ಉದಾ: ಅಡುಗೆ, ಸೆಕ್ಯೂರಿಟಿ, ಡೆಲಿವರಿ, ಹೊಲಿಗೆ)",
        "hi": "आपने किस तरह का काम किया है? (जैसे खाना बनाना, सुरक्षा, डिलीवरी, सिलाई)",
    },
}


def _follow_up(reason: str, lang: str) -> str:
    lang_key = lang if lang in ("en", "kn", "hi") else "en"
    return _FOLLOW_UP[reason][lang_key]


class MatchRequest(BaseModel):
    profile: WorkerProfile


@router.post("/matches", response_model=MatchResponse)
def get_matches(req: MatchRequest) -> MatchResponse:
    """
    Return top-10 ranked job matches for a worker profile.

    If the profile has no area or no skills, returns a follow_up_question
    in the worker's language instead of results.
    """
    p = req.profile
    lang = p.detected_language or "en"

    if not p.area:
        return MatchResponse(matches=[], follow_up_question=_follow_up("no_area", lang))

    if not p.skills:
        return MatchResponse(matches=[], follow_up_question=_follow_up("no_skills", lang))

    all_jobs = get_all_jobs()
    matches = rank_jobs(p, all_jobs)
    return MatchResponse(matches=matches)
