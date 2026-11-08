"""
Follow-up questions for an incomplete worker profile, in en/kn/hi.

No FastAPI or database imports: this module is shared by the /api/matches router
and the watsonx Orchestrate tools package (see orchestrate/build_kelasa_tools.py).
"""
from __future__ import annotations

from models.worker import WorkerProfile

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


def follow_up(reason: str, lang: str) -> str:
    lang_key = lang if lang in ("en", "kn", "hi") else "en"
    return _FOLLOW_UP[reason][lang_key]


def follow_up_for(profile: WorkerProfile) -> str | None:
    """The question to ask next, or None when the profile has an area and skills."""
    lang = profile.detected_language or "en"
    if not profile.area:
        return follow_up("no_area", lang)
    if not profile.skills:
        return follow_up("no_skills", lang)
    return None
