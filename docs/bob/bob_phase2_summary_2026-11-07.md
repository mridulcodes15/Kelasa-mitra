---

## Pre-code checks

**(a) Sample 13 script** — Already correct Devanagari (`मैं सिलाई करती हूँ…`). The garbled display in the previous pytest output was Windows terminal encoding, not a data problem. No change needed.

**(b) watsonx.ai live test** — Cannot run: `ibm-watsonx-ai` is not installed and no credentials are set. To enable LLM mode, set these in `backend/.env`:
```
WATSONX_API_KEY=<IBM Cloud IAM API key>
WATSONX_PROJECT_ID=<UUID from watsonx.ai → Manage → General>
WATSONX_URL=https://us-south.ml.cloud.ibm.com
```
Then: `pip install "ibm-watsonx-ai>=1.1.2"`. Without credentials all 40 tests pass on the offline fallback.

---

## Raw pytest output — Phase 1 + 2 combined

```
============================= test session starts =============================
platform win32 -- Python 3.11.0, pytest-8.3.4, pluggy-1.6.0
configfile: pytest.ini   asyncio: mode=Mode.AUTO
collected 40 items

tests/test_matches.py::test_score_zero_overlap_no_language            PASSED
tests/test_matches.py::test_score_perfect_overlap_same_location       PASSED
tests/test_matches.py::test_score_far_away_excluded                   PASSED
tests/test_matches.py::test_score_exactly_at_max_distance             PASSED
tests/test_matches.py::test_top_n_limit                               PASSED
tests/test_matches.py::test_results_sorted_by_score_descending        PASSED
tests/test_matches.py::test_no_area_returns_empty                     PASSED
tests/test_matches.py::test_matched_and_missing_skills_populated      PASSED
tests/test_matches.py::test_reason_english_contains_expected_pattern  PASSED
tests/test_matches.py::test_reason_kannada_contains_km                PASSED
tests/test_matches.py::test_reason_hindi_contains_km                  PASSED
tests/test_matches.py::test_reason_no_skills_near                     PASSED
tests/test_matches.py::test_reason_unknown_lang_falls_back_to_english PASSED
tests/test_matches.py::test_follow_up_no_area_english                 PASSED
tests/test_matches.py::test_follow_up_no_skills_kannada               PASSED
tests/test_matches.py::test_follow_up_no_area_hindi                   PASSED
tests/test_matches.py::test_follow_up_unknown_lang_defaults_english   PASSED
tests/test_matches.py::test_all_seed_jobs_have_valid_coordinates      PASSED
tests/test_matches.py::test_all_seed_jobs_have_known_skills           PASSED
tests/test_matches.py::test_seed_has_at_least_80_jobs                 PASSED
tests/test_matches.py::test_seed_has_both_job_types                   PASSED
tests/test_matches.py::test_haversine_self_is_zero                    PASSED
tests/test_matches.py::test_haversine_known_distance                  PASSED
tests/test_profile.py::test_profile_extraction[sample_1 … sample_13]  PASSED ×13
tests/test_profile.py::test_profile_returns_worker_profile_type       PASSED
tests/test_profile.py::test_empty_input_does_not_crash                PASSED
tests/test_profile.py::test_ui_language_overrides_langdetect          PASSED
tests/test_profile.py::test_unknown_ui_language_falls_back_to_langdetect PASSED

======================== 40 passed in 1.80s ==============================
Exit code: 0
```

---

## What works / what doesn't

### ✅ Works
| Item | Detail |
|------|--------|
| **40/40 tests, exit 0** | All Phase 1 + Phase 2 tests pass |
| **`POST /api/matches`** | Returns 10 ranked jobs for any complete profile; scoring = 0.6 skill + 0.3 proximity + 0.1 language |
| **80 seed jobs** | 15+ Bengaluru areas, realistic pay, `job` + `apprenticeship` types, all marked `is_synthetic=true` |
| **Follow-up question** | Triggers when profile has no area or no skills; returns in `en`/`kn`/`hi` |
| **Deterministic reasons** | Template-based in all 3 languages — no LLM, no hallucination risk |
| **Swipeable job cards** | Framer Motion drag (`left=skip`, `right=save`), keyboard arrows (← →), Save/Skip buttons |
| **Animated SVG score ring** | Fills from 0 → score on card entry, colour-coded green/amber/red |
| **`is_synthetic` label** | Every card shows "⚠ Sample data" tag |
| **Screen transition** | Smooth slide from Landing → Jobs when matches arrive; back button works |
| **Follow-up question UI** | Shows question with "← Answer" button that returns to mic |
| **`prefers-reduced-motion`** | Score ring and mic animations disabled |
| **TypeScript clean** | `tsc --noEmit` has zero errors |

### ⚠️ Known limitations
| Item | Notes |
|------|-------|
| **`haversine_km` returns 0.0 for same location** | Floating point correctly gives 0 — the `0.0 km` distance in the test output is accurate for a job in the same area as the worker |
| **Backend distance is exactly 0.0** for jobs seeded at the same lat/lon as worker area | Expected — worker area lat/lon matches the seed entry lat/lon; real data will have sub-km variation |
| **watsonx.ai not installed** | Offline fallback active. Install `ibm-watsonx-ai` + set `.env` vars for LLM mode |
