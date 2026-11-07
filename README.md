# ಕೆಲಸ ಮಿತ್ರ — Kelasa Mitra

**IBM Bobathon: Build for Bengaluru** | Theme: *More Opportunity, Greater Together*

> *Work Friend* — a voice-first job-matching companion for blue-collar and gig
> workers in Bengaluru.  
> Workers speak or type in Kannada, Hindi, or English. The app extracts their
> profile, ranks nearby jobs, and explains each match in their own language.

---

## The Problem

Blue-collar and gig workers in Bengaluru — hotel staff, delivery riders,
construction workers, domestic help — are effectively locked out of most digital
job portals. Those portals assume English literacy, a desktop browser, and the
patience to fill in forms. Most of these workers have none of those.

---

## What It Does

1. **Speak or type** your work history in Kannada, Hindi, or English.
2. The app extracts a structured profile: skills, years of experience, your
   area in Bengaluru, and the languages you speak.
3. Nearby jobs from a seeded dataset are ranked by skill fit and distance, with
   a plain-language reason for each match — *"Matched because you have hotel
   experience and live 2.4 km away."*
4. A skill gap screen shows which one skill unlocks the most new jobs near you,
   with a 3-step learning path and approximate cost.
5. Every response is in the worker's chosen language.

---

## IBM Technology Used

| Product | How it is used | Status |
|---------|---------------|--------|
| **IBM Bob** | Built every file in this project — code, tests, data, docs | Active throughout |
| **IBM watsonx Orchestrate** | Agentic layer: decides when to call each tool, asks follow-up questions when the profile is incomplete | **Pending access** — integration planned, not yet live |

### IBM Bob

Every line of code in this repository was written with IBM Bob in Agent mode.
Bob read the existing files before editing, kept the changes minimal and
targeted, ran the tests after each change, and caught issues (stale DB, missing
router registration, unused scaffold files) before they became problems.

The project plan in `PLAN.md` and this README were also written with Bob.

### IBM watsonx Orchestrate

Orchestrate is the intended agentic layer. The three FastAPI endpoints
(`/api/profile/extract-profile`, `/api/matches`, `/api/skill-gap`) are
registered as HTTP tools via the app's OpenAPI spec. The Orchestrate agent:

- Calls `extract-profile` when the worker submits text.
- Asks a follow-up question if the profile is missing an area or skills.
- Calls `matches` once the profile is complete.
- Calls `skill-gap` when the worker asks what to learn next.

**The app works without Orchestrate.** The React frontend calls the FastAPI
endpoints directly if the agent is unavailable. All 40 tests pass with no
external API keys at all.

> ⚠ Orchestrate access is not yet confirmed. This section will be updated once
> integration is live. Do not treat it as demonstrated until then.

---

## Features (current state)

| Feature | Status |
|---------|--------|
| Voice input (Kannada / Hindi / English) via Web Speech API | ✅ Done |
| Text fallback for browsers without mic | ✅ Done |
| Language picker (KN / HI / EN) — drives UI strings + `detected_language` | ✅ Done |
| Profile extraction from free-form text | ✅ Done |
| Kannada agglutinative inflection handling (ಹೆಲ್ಪರ್ ಇದ್ದೇನೆ, ಡ್ರೈವರ್ ಆಗಿದ್ದೆ) | ✅ Done |
| 80 synthetic Bengaluru jobs, 8 categories, ±1.5 km coordinate jitter | ✅ Done |
| Job ranking: skill fit + haversine distance + language bonus | ✅ Done |
| Swipeable job cards with animated SVG score ring | ✅ Done |
| Match reasons in EN / KN / HI (template-built, not LLM-generated) | ✅ Done |
| Follow-up question when profile is incomplete | ✅ Done |
| Skill gap tool: top-3 missing skills + jobs each unlocks | ✅ Written, router not wired |
| Skill gap frontend page + stepper component | ❌ Not yet built |
| TTS readback via SpeechSynthesisUtterance | ❌ Pending |
| IBM watsonx Orchestrate integration | ❌ Pending access |
| PWA manifest + service worker | ❌ Pending |

---

## Quick Start

### Backend

```bash
cd backend
pip install -r requirements.txt

# Optional: configure Groq (leave blank to use the rule-based fallback)
cp .env.example .env
# Edit .env and set GROQ_API_KEY

# Delete stale DB on first run (re-seeds with 80 jittered jobs)
# Windows: del db\kelasa_mitra.db db\kelasa_mitra.db-shm db\kelasa_mitra.db-wal
# macOS/Linux: rm -f db/kelasa_mitra.db db/kelasa_mitra.db-shm db/kelasa_mitra.db-wal

python -m uvicorn main:app --reload --port 8000
```

API: `http://localhost:8000`  
Swagger: `http://localhost:8000/docs`  
OpenAPI spec (for Orchestrate tool import): `http://localhost:8000/openapi.json`

### Frontend

```bash
cd frontend
npm install
npm run dev
```

App: `http://localhost:5173`

### Run Tests

```bash
cd backend
python -m pytest tests/ -v
# Expected: 40 passed
```

---

## Environment Variables (`backend/.env`)

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `GROQ_API_KEY` | No | *(empty)* | Groq cloud API key — get one free at `console.groq.com` |
| `GROQ_MODEL` | No | `llama-3.3-70b-versatile` | Groq model ID |

If `GROQ_API_KEY` is empty, the app runs in **rule-based offline mode**. All 40 tests pass without any key.

---

## Project Structure

```
kelasa-mitra/
├── PLAN.md                    # Full project plan, architecture, Orchestrate integration
├── README.md                  # This file
│
├── backend/
│   ├── main.py                # FastAPI app (skill_gap_router not yet wired)
│   ├── tools/
│   │   ├── fallback.py        # Rule-based extractor, Kannada/Hindi inflection-aware
│   │   ├── provider.py        # Groq provider + LRU cache + graceful offline fallback
│   │   ├── profile_extractor.py
│   │   ├── job_ranker.py      # Scoring, ranking, template reasons in EN/KN/HI
│   │   └── skill_gap.py       # Skill gap analysis (written, router not wired yet)
│   ├── models/
│   │   ├── worker.py          # WorkerProfile, AreaLocation
│   │   ├── job.py             # Job, JobMatch, MatchResponse
│   │   └── skill_gap.py       # SkillGapItem, SkillGapResponse, LearningStep
│   ├── db/
│   │   ├── database.py        # SQLAlchemy Core, SQLite WAL
│   │   └── seed_jobs.py       # 80 synthetic jobs + ±1.5 km jitter
│   ├── routers/
│   │   ├── profile.py         # POST /api/profile/extract-profile
│   │   ├── matches.py         # POST /api/matches
│   │   └── skill_gap.py       # POST /api/skill-gap (written, not in main.py yet)
│   ├── data/
│   │   ├── skills.json        # 40 skills with EN/KN/HI synonyms
│   │   ├── areas.json         # 30 Bengaluru areas with lat/lon
│   │   └── learning_paths.json # 35 skills × 3-step learning paths
│   └── tests/
│       ├── test_profile.py    # 17 tests
│       └── test_matches.py    # 23 tests
│
└── frontend/src/
    ├── pages/
    │   ├── Landing.tsx        # Mic orb, language picker, profile card
    │   └── Jobs.tsx           # Swipeable cards, follow-up question UI
    ├── components/
    │   ├── MicButton.tsx      # Pulsing teal mic orb
    │   ├── ProfileCard.tsx
    │   ├── JobCard.tsx        # Draggable card with score ring and reason
    │   ├── MatchRing.tsx      # Animated SVG score ring
    │   └── LanguagePicker.tsx
    ├── hooks/
    │   ├── useSpeech.ts       # Web Speech API wrapper
    │   └── useProfile.ts      # extract + fetchMatches pipeline
    ├── store/appStore.ts      # Zustand global state
    └── lib/
        ├── api.ts             # extractProfile(), fetchMatches()
        ├── i18n.ts            # UI strings in EN/KN/HI
        └── types.ts           # TypeScript types
```

---

## API Reference

### `POST /api/profile/extract-profile`

```json
{
  "text": "ನಾನು ಹೋಟೆಲ್‌ನಲ್ಲಿ ಎರಡು ವರ್ಷ ಹೆಲ್ಪರ್ ಆಗಿ ಕೆಲಸ ಮಾಡಿದ್ದೇನೆ",
  "ui_language": "kn"
}
```

Response:
```json
{
  "skills": ["hotel_helper"],
  "experience_years": 2,
  "area": { "id": "whitefield", "name": "Whitefield", "lat": 12.9698, "lon": 77.7499 },
  "languages": ["kannada"],
  "detected_language": "kn",
  "raw_input": "..."
}
```

### `POST /api/matches`

```json
{ "profile": { "...WorkerProfile fields..." } }
```

Response:
```json
{
  "matches": [
    {
      "job": { "title": "Hotel Room Attendant", "pay_min": 12000, "pay_max": 16000, "..." },
      "score": 87,
      "distance_km": 2.4,
      "matched_skills": ["hotel_helper"],
      "missing_skills": ["housekeeping"],
      "reason": "ನಿಮ್ಮ ಹೋಟೆಲ್ ಅನುಭವ ಮತ್ತು 2.4 ಕಿಮೀ ದೂರದಿಂದಾಗಿ ಈ ಕೆಲಸ ಸೂಕ್ತ.",
      "follow_up_question": null
    }
  ]
}
```

### `POST /api/skill-gap` *(written, not yet wired)*

```json
{ "profile": { "...WorkerProfile fields..." } }
```

Response:
```json
{
  "gaps": [
    {
      "skill_id": "driving_licence",
      "label_en": "Driving Licence",
      "jobs_unlocked": 12,
      "avg_pay_uplift_inr": 3500,
      "explanation": "Learning Driving Licence could unlock 12 more jobs near you, paying about ₹3,500 more per month.",
      "learning_path": [
        { "step": 1, "action": "Apply for LMV learner licence at RTO", "weeks": 1, "approx_cost_inr": 200 }
      ]
    }
  ],
  "is_synthetic": true
}
```

---

## Limitations

| Limitation | Details |
|-----------|---------|
| **Sample data only** | All 80 jobs have `"is_synthetic": true`. The UI displays a "Sample data — for demonstration only" label on every job card. No real employers are listed. |
| **Rule-based by design** | Match scores, skill gap numbers, and match reasons are computed entirely from the seed data by deterministic Python code. The LLM (when configured) is used only for free-form text understanding, not for generating numbers. |
| **Coordinates are approximate** | Job coordinates are area-centre values ± up to 1.5 km random jitter. Distance figures shown to workers are estimates, not precise addresses. |
| **Bengaluru only** | The 30 area look-up table and all seed jobs are Bengaluru-specific. |
| **Web Speech API** | Voice input requires Chrome on Android or Safari on iOS. Firefox does not support the Web Speech API. A text input fallback is always available. |
| **Kannada TTS** | `SpeechSynthesisUtterance` Kannada voice availability depends on the device OS. The app gracefully falls back to no TTS if the voice is absent. |

---

## Privacy

- No worker data is stored. Profile extraction is stateless — the profile JSON is computed per request and never written to a database.
- No audio is transmitted to the server. The Web Speech API runs entirely in the browser; only the resulting transcript text is sent to the backend.
- All job data is synthetic. No real employer names, phone numbers, or addresses are stored or shown.

---

## Built with IBM Bob

This project was built as a solo student submission for IBM Bobathon: Build for Bengaluru 2026. Every file — Python backend, React frontend, test suite, seed data, and documentation — was created with IBM Bob in Agent mode.

Bob was used to:
- Design the architecture and write the project plan.
- Scaffold and implement all backend tools, models, routers, and tests.
- Build the React frontend with animated components and Framer Motion.
- Run `pytest` and `tsc --noEmit` after each change to catch regressions immediately.
- Audit the project for stale files, DB inconsistencies, and doc mismatches.
- Write this README.

---

*IBM Bobathon Build for Bengaluru — 2026. Solo student submission.*
