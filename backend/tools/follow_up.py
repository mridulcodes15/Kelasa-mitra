"""
Follow-up questions for an incomplete worker profile, in en/kn/hi.

No FastAPI or database imports: this module is shared by the /api/matches router
and the watsonx Orchestrate tools package (see orchestrate/build_kelasa_tools.py).
"""
from __future__ import annotations

import re

from models.worker import WorkerProfile

# Follow-up question strings when profile is incomplete
_FOLLOW_UP: dict[str, dict[str, str]] = {
    "no_area": {
        "en": "Where in Bengaluru do you live? (e.g. Whitefield, Koramangala, Jayanagar)",
        "kn": "ನೀವು ಬೆಂಗಳೂರಿನ ಯಾವ ಭಾಗದಲ್ಲಿ ವಾಸಿಸುತ್ತೀರಿ? (ಉದಾ: ವೈಟ್‌ಫೀಲ್ಡ್, ಕೋರಮಂಗಲ, ಜಯನಗರ)",
        "hi": "आप बेंगलुरु के किस इलाके में रहते हैं? (जैसे व्हाइटफील्ड, कोरमंगला, जयनगर)",
    },
    # The worker named the city, not an area: say why we ask again instead of repeating.
    "city_only": {
        "en": "Bengaluru is a big city. Which area do you live in? (e.g. Whitefield, Koramangala, Jayanagar)",
        "kn": "ಬೆಂಗಳೂರು ದೊಡ್ಡ ನಗರ. ನೀವು ಯಾವ ಪ್ರದೇಶದಲ್ಲಿ ವಾಸಿಸುತ್ತೀರಿ? (ಉದಾ: ವೈಟ್‌ಫೀಲ್ಡ್, ಕೋರಮಂಗಲ, ಜಯನಗರ)",
        "hi": "बेंगलुरु बड़ा शहर है। आप किस इलाके में रहते हैं? (जैसे व्हाइटफील्ड, कोरमंगला, जयनगर)",
    },
    "no_skills": {
        "en": "What kind of work have you done? (e.g. cooking, security, delivery, tailoring)",
        "kn": "ನೀವು ಯಾವ ರೀತಿಯ ಕೆಲಸ ಮಾಡಿದ್ದೀರಿ? (ಉದಾ: ಅಡುಗೆ, ಸೆಕ್ಯೂರಿಟಿ, ಡೆಲಿವರಿ, ಹೊಲಿಗೆ)",
        "hi": "आपने किस तरह का काम किया है? (जैसे खाना बनाना, सुरक्षा, डिलीवरी, सिलाई)",
    },
}


# The city name is not an area: "I live in Bangalore" gives no distance to any job.
_CITY_LATIN = re.compile(
    r"(?<![a-z])(bangalore|banglore|bengalore|bengaluru|bangaluru|bengalooru|bangalooru|blr)(?![a-z])"
)
_CITY_NATIVE = ("ಬೆಂಗಳೂರ", "ಬೆಂಗಳೂರು", "बेंगलुरु", "बेंगलूरु", "बेंगलोर", "बैंगलोर", "बंगलौर", "बंगलोर")


def mentions_city_only_name(text: str) -> bool:
    """True if the text names Bengaluru itself (any common spelling, en/kn/hi)."""
    lower = text.lower()
    return bool(_CITY_LATIN.search(lower)) or any(term in text for term in _CITY_NATIVE)


def follow_up(reason: str, lang: str) -> str:
    lang_key = lang if lang in ("en", "kn", "hi") else "en"
    return _FOLLOW_UP[reason][lang_key]


def follow_up_for(profile: WorkerProfile) -> str | None:
    """The question to ask next, or None when the profile has an area and skills."""
    lang = profile.detected_language or "en"
    if not profile.area:
        reason = "city_only" if mentions_city_only_name(profile.raw_input) else "no_area"
        return follow_up(reason, lang)
    if not profile.skills:
        return follow_up("no_skills", lang)
    return None
