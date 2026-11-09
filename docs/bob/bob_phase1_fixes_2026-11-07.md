---

## Raw pytest output

```
============================= test session starts =============================
platform win32 -- Python 3.11.0, pytest-8.3.4, pluggy-1.6.0
asyncio: mode=Mode.STRICT

collected 17 items

tests/test_profile.py::test_profile_extraction[sample_1_English – hotel helper, two-wheeler, Whi]  PASSED [  5%]
tests/test_profile.py::test_profile_extraction[sample_2_Kannada – hotel helper, bike, Whitefield] PASSED [ 11%]
tests/test_profile.py::test_profile_extraction[sample_3_Hindi – driver, car, Electronic City]      PASSED [ 17%]
tests/test_profile.py::test_profile_extraction[sample_4_English – tailoring, Yelahanka, multilin]  PASSED [ 23%]
tests/test_profile.py::test_profile_extraction[sample_5_Hindi – cook/canteen, Marathahalli]        PASSED [ 29%]
tests/test_profile.py::test_profile_extraction[sample_6_Kannada – security guard, Jayanagar]       PASSED [ 35%]
tests/test_profile.py::test_profile_extraction[sample_7_GENERATED – Mixed Hinglish, electrician,]  PASSED [ 41%]
tests/test_profile.py::test_profile_extraction[sample_8_GENERATED – Kannada + English mix, house]  PASSED [ 47%]
tests/test_profile.py::test_profile_extraction[sample_9_GENERATED – Spelling variant (whitefeild)] PASSED [ 52%]
tests/test_profile.py::test_profile_extraction[sample_10_GENERATED – Hindi plumber, Koramangala, ] PASSED [ 58%]
tests/test_profile.py::test_profile_extraction[sample_11_INFLECTION – Kannada ಹೆಲ್ಪರ್ ಇದ್ದೇನೆ]   PASSED [ 64%]
tests/test_profile.py::test_profile_extraction[sample_12_INFLECTION – Kannada ಡ್ರೈವರ್ ಆಗಿದ್ದೆ]   PASSED [ 70%]
tests/test_profile.py::test_profile_extraction[sample_13_INFLECTION – Hindi ಸಿಲಾಈ ಕರತೀ ಹೂ]       PASSED [ 76%]
tests/test_profile.py::test_profile_returns_worker_profile_type                                     PASSED [ 82%]
tests/test_profile.py::test_empty_input_does_not_crash                                              PASSED [ 88%]
tests/test_profile.py::test_ui_language_overrides_langdetect                                        PASSED [ 94%]
tests/test_profile.py::test_unknown_ui_language_falls_back_to_langdetect                            PASSED [100%]

======================== 17 passed in 0.81s ==============================
```

**Exit code: 0** (after adding [`backend/pytest.ini`](backend/pytest.ini) to silence the asyncio deprecation warning).

---

## Summary of all three fixes

### 1 — IBM technology (Gemini → watsonx.ai)

| Before | After |
|--------|-------|
| `google-generativeai` in requirements | `ibm-watsonx-ai>=1.1.2` |
| Gemini 2.0 Flash | **IBM Granite 3.3 8B Instruct** (`ibm/granite-3-3-8b-instruct`) |
| Google ADK `LlmAgent` | **Plain Python tool-calling loop** — each route calls the tool directly |
| `GEMINI_API_KEY` in `.env.example` | `WATSONX_API_KEY` + `WATSONX_PROJECT_ID` + `WATSONX_URL` + `WATSONX_MODEL_ID` |

[`PLAN.md`](PLAN.md), [`README.md`](README.md), and [`backend/.env.example`](backend/.env.example) are all updated. No Google/ADK references remain in code.

### 2 — Tests tightened

`detected_language` is now exact (e.g. `"kn"`, `"hi"`, `"en"`) because `ui_language` from the picker is passed to [`extract_profile()`](backend/tools/profile_extractor.py) and used as the primary language — `langdetect` is only the fallback. Every sample in [`tests/samples.json`](backend/tests/samples.json) now has a `"ui_language"` field and a single `"detected_language"` string. The 4 generated samples that previously had wide allow-lists like `["en","cy","so"]` now assert exactly `"en"`.

### 3 — Kannada/Hindi inflection handling

[`fallback.py`](backend/tools/fallback.py) now builds a `_STEM_MAP` at startup: for every Kannada synonym it strips 10 common postpositional/copula suffixes (`ಆಗಿದ್ದೆ`, `ಇದ್ದೇನೆ`, `ಆಗಿ`, `ಅನ್ನು`, …) and for every Hindi synonym it strips verbal suffixes (`करती हूँ`, `का काम`, …). A second pass in the extraction loop checks stems, so inflected forms that never appeared as exact synonyms now match correctly. Three new inflection test cases (samples 11–13) cover `ಹೆಲ್ಪರ್ ಇದ್ದೇನೆ`, `ಡ್ರೈವರ್ ಆಗಿದ್ದೆ`, and `सिलाई करती हूँ` — all three pass.
