# Kelasa Mitra — Project Plan
**IBM Bobathon: Build for Bengaluru** · Theme: *More Opportunity, Greater Together*

> "ಕೆಲಸ ಮಿತ್ರ" — *Work Friend* in Kannada.  
> A voice-first job-matching companion for blue-collar and gig workers in Bengaluru.

*Last updated: 2026-11-07. Author: Solo student.*

---

## 1. Problem & Solution

### Problem
Blue-collar and gig workers in Bengaluru — construction labourers, delivery riders, hotel staff, domestic help — are effectively locked out of digital job portals that assume English literacy, stable internet, and keyboard proficiency.

### Solution
A mobile-first Progressive Web App (PWA) where a worker:
1. **Speaks or types** their experience in Kannada, Hindi, or English.
2. **Receives a structured profile** extracted automatically (skills, experience, location, languages spoken).
3. **Gets ranked job matches** from a curated local dataset, each explained in plain language in their own language.
4. **Sees a skill gap & learning path** showing exactly which one or two skills unlock more jobs near them.
5. An **employer micro-flow** (≤ 30 seconds) lets a small business post a job *(Phase 5 — on cut list)*.

---

## 2. Architecture

### 2.1 High-Level Stack

```
┌─────────────────────────────────────────────────────────────┐
│                    MOBILE BROWSER (PWA)                      │
│  React 19 + Vite 8 · Tailwind 4 · Framer Motion 14          │
│  Web Speech API (STT) · SpeechSynthesisUtterance (TTS)      │
└──────────────────────────┬──────────────────────────────────┘
                           │ HTTPS / REST
┌──────────────────────────▼──────────────────────────────────┐
│                 FASTAPI BACKEND (Python 3.11)                │
│                                                             │
│  POST /api/profile/extract-profile                          │
│  POST /api/matches                                          │
│  POST /api/skill-gap          ← written, not yet wired      │
│  POST /api/employer/jobs      ← Phase 5, not yet built      │
│                                                             │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  TOOL FUNCTIONS (deterministic Python)               │  │
│  │  extract_profile · rank_jobs · compute_skill_gap     │  │
│  │  Scoring/matching/numbers: always rule-based         │  │
│  │  NL extraction: Groq (optional) → fallback           │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                             │
│  SQLite (WAL mode) · 80 synthetic Bengaluru jobs           │
└─────────────────────────────────────────────────────────────┘
                           │
                  ┌────────▼────────┐   ← PENDING ACCESS
                  │ IBM watsonx     │
                  │ Orchestrate     │   Agent layer:
                  │ (cloud agent)   │   calls our FastAPI
                  │                 │   endpoints as tools
                  └─────────────────┘
```

### 2.2 IBM Products in the Stack

| IBM Product | Role | Status |
|-------------|------|--------|
| **IBM Bob** | Built every line of code for this submission; used throughout the 7-day build | Active — required by contest |
| **IBM watsonx Orchestrate** | Agentic layer: decides when to call `extract-profile`, `matches`, `skill-gap`; asks follow-up if profile is incomplete | **Pending access** — integration planned, not yet live |

### 2.3 AI / Tool Design

The backend exposes three deterministic FastAPI endpoints. IBM watsonx Orchestrate calls them as HTTP tools (registered via the app's OpenAPI spec). The Orchestrate agent handles the conversational loop:

1. User speaks/types their experience.
2. Agent calls `POST /api/profile/extract-profile` → receives structured profile.
3. If profile is incomplete (no area, no skills), agent asks a follow-up question in the worker's language.
4. Once profile is complete, agent calls `POST /api/matches` → receives ranked job cards.
5. On request, agent calls `POST /api/skill-gap` → returns the top-3 skill gaps.

**What the LLM controls**: conversational follow-up phrasing.  
**What is always deterministic code**: all scores, job rankings, skill gap numbers, match reasons. The LLM never generates numbers.

#### Tool functions

| Tool | Endpoint | Purpose |
|------|----------|---------|
| `extract_profile` | `POST /api/profile/extract-profile` | Parse free-form text → structured WorkerProfile |
| `rank_jobs` | `POST /api/matches` | Score and rank 80 seeded jobs by skill + distance |
| `compute_skill_gap` | `POST /api/skill-gap` | Identify top-3 missing skills + jobs each unlocks |

**Offline / rule-based fallback**: if Orchestrate is unreachable, the React frontend calls the FastAPI endpoints directly. If Groq is also unconfigured, the rule-based fallback extractor (`tools/fallback.py`) runs with zero external dependencies. All 40 tests pass without any API key.

### 2.4 Language Handling

- **Primary language**: set by the frontend language picker → `ui_language` field in every API request. Always reliable.
- **Fallback detection**: `langdetect` library when `ui_language` is absent.
- **STT**: Web Speech API (`lang` attribute set to `kn-IN`, `hi-IN`, or `en-IN`).
- **Match reasons**: template-built in EN/KN/HI from `tools/job_ranker.py` — no LLM needed.
- **Skill gap explanations**: template-built in EN/KN/HI from `tools/skill_gap.py` — no LLM needed.
- **TTS**: `SpeechSynthesisUtterance` with matched `lang` for voice feedback *(Phase 4)*.

---

## 3. Folder Structure (actual as of 2026-11-07)

```
kelasa-mitra/
├── PLAN.md                          ← this file
├── README.md
│
├── backend/
│   ├── main.py                      ← FastAPI app; skill_gap_router not yet wired
│   ├── requirements.txt
│   ├── pytest.ini                   ← asyncio_mode=auto
│   ├── .env.example
│   │
│   ├── tools/
│   │   ├── fallback.py              ← rule-based extractor, inflection-aware (KN/HI)
│   │   ├── provider.py              ← Groq provider + LRU cache + graceful fallback
│   │   ├── profile_extractor.py     ← extract_profile(text, ui_language)
│   │   ├── job_ranker.py            ← rank_jobs(), _score(), _build_reason()
│   │   └── skill_gap.py             ← compute_skill_gap() — written, router not wired
│   │
│   ├── models/
│   │   ├── worker.py                ← WorkerProfile, AreaLocation (Pydantic)
│   │   ├── job.py                   ← Job, JobMatch, MatchResponse (Pydantic)
│   │   └── skill_gap.py             ← SkillGapItem, SkillGapResponse, LearningStep
│   │
│   ├── db/
│   │   ├── database.py              ← SQLAlchemy Core, SQLite WAL, get_all_jobs()
│   │   └── seed_jobs.py             ← 80 synthetic Bengaluru jobs, ±1.5 km jitter
│   │                                   (kelasa_mitra.db is stale — delete to re-seed)
│   │
│   ├── routers/
│   │   ├── __init__.py              ← exports profile_router, matches_router, skill_gap_router
│   │   ├── profile.py               ← POST /api/profile/extract-profile
│   │   ├── matches.py               ← POST /api/matches
│   │   └── skill_gap.py             ← POST /api/skill-gap (written, not in main.py yet)
│   │
│   ├── data/
│   │   ├── skills.json              ← 40 skills with EN/KN/HI synonyms + inflected forms
│   │   ├── areas.json               ← 30 Bengaluru areas with lat/lon + spelling aliases
│   │   └── learning_paths.json      ← 35 skills × 3-step learning paths
│   │
│   ├── scripts/
│   │   └── compare_providers.py     ← Groq vs fallback comparison table
│   │
│   └── tests/
│       ├── samples.json             ← 13 test samples (EN/KN/HI, inflections)
│       ├── test_profile.py          ← 17 tests (all passing)
│       ├── test_matches.py          ← 23 tests (all passing)
│       └── test_skill_gap.py        ← NOT YET WRITTEN (Phase 3)
│
└── frontend/
    ├── vite.config.ts               ← proxy /api → localhost:8000
    ├── package.json
    ├── index.html
    └── src/
        ├── main.tsx
        ├── App.tsx                  ← screen router: landing ↔ jobs
        ├── index.css                ← animations, prefers-reduced-motion
        │
        ├── pages/
        │   ├── Landing.tsx          ← mic orb, language picker, profile card, text fallback
        │   ├── Jobs.tsx             ← swipeable job cards, follow-up question UI
        │   └── SkillGap.tsx         ← NOT YET BUILT (Phase 3)
        │
        ├── components/
        │   ├── MicButton.tsx        ← pulsing teal mic orb
        │   ├── ProfileCard.tsx      ← live-building profile display
        │   ├── JobCard.tsx          ← draggable card, score ring, reason, save/skip
        │   ├── MatchRing.tsx        ← animated SVG score ring
        │   ├── LanguagePicker.tsx   ← KN / HI / EN toggle
        │   └── SkillGapStepper.tsx  ← NOT YET BUILT (Phase 3)
        │
        ├── hooks/
        │   ├── useSpeech.ts         ← Web Speech API wrapper
        │   └── useProfile.ts        ← extract + fetchMatches pipeline
        │
        ├── store/
        │   └── appStore.ts          ← Zustand: lang, profile, matches, followUp, screen
        │
        └── lib/
            ├── api.ts               ← extractProfile(), fetchMatches()
            │                           fetchSkillGap() NOT YET ADDED (Phase 3)
            ├── i18n.ts              ← UI strings in EN/KN/HI
            └── types.ts             ← WorkerProfile, Job, JobMatch, MatchResponse
                                        SkillGap types NOT YET ADDED (Phase 3)
```

### Files that do not exist (deliberate)

| File | Reason absent |
|------|--------------|
| `backend/agent.py` | No Google ADK / Gemini used. Orchestrate is the agent layer. |
| `backend/tools/translator.py` | Phase 4 (TTS/translation) not yet built. |
| `backend/models/employer.py` | Phase 5 on cut list. |
| `backend/db/jobs_seed.json` | Seed data is inline in `seed_jobs.py` as `_SEED`. |
| `frontend/tailwind.config.ts` | Tailwind 4 uses `@tailwindcss/vite` — no separate config file needed. |
| `eval/` directory | Phase 6 — not yet started. |

---

## 4. Data Schema

### 4.1 WorkerProfile
```json
{
  "skills": ["hotel_helper", "cook"],
  "experience_years": 3,
  "area": { "id": "majestic", "name": "Majestic", "lat": 12.9773, "lon": 77.5713 },
  "languages": ["kannada", "hindi"],
  "detected_language": "kn",
  "raw_input": "ನಾನು ಹೋಟೆಲ್‌ನಲ್ಲಿ 3 ವರ್ಷ ಕೆಲಸ ಮಾಡಿದ್ದೇನೆ"
}
```

### 4.2 Job (seeded, read-only)
```json
{
  "id": "uuid",
  "title": "Hotel Room Attendant",
  "employer": "Chancery Pavilion",
  "area": "Residency Road",
  "lat": 12.9741,
  "lon": 77.6025,
  "pay_min": 12000,
  "pay_max": 16000,
  "skills_required": ["hotel_helper", "housekeeping"],
  "languages": ["kannada", "english"],
  "type": "job",
  "posted_at": "2026-01-01T00:00:00+00:00",
  "is_synthetic": true
}
```

### 4.3 JobMatch (computed, not stored)
```json
{
  "job": { "...job fields..." },
  "score": 87,
  "distance_km": 2.4,
  "matched_skills": ["hotel_helper"],
  "missing_skills": ["housekeeping"],
  "reason": "Matched because you have hotel experience and live 2.4 km away."
}
```

### 4.4 SkillGap
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
        { "step": 1, "action": "Apply for LMV learner licence at RTO", "weeks": 1, "approx_cost_inr": 200 },
        { "step": 2, "action": "Take driving practice (30 hrs)", "weeks": 4, "approx_cost_inr": 2000 },
        { "step": 3, "action": "Sit LMV driving test at RTO", "weeks": 1, "approx_cost_inr": 300 }
      ]
    }
  ],
  "is_synthetic": true
}
```

### 4.5 JobPosting (Employer — Phase 5, not yet built)
```json
{
  "title": "Security Guard",
  "area": "whitefield",
  "pay_min": 14000,
  "contact_phone": "+91XXXXXXXXXX",
  "skills_required": ["security_guard"]
}
```

---

## 5. Six Demoable Phases

### Phase 1 — Voice Input & Profile Extraction ✅ DONE
**Goal**: Worker speaks or types; a structured profile appears on screen.

- FastAPI + SQLite + 80-job seed.
- `extract_profile` tool: Groq (optional) or rule-based extractor for Kannada/Hindi/English.
- Rule-based fallback handles Kannada agglutinative inflections (ಹೆಲ್ಪರ್ ಇದ್ದೇನೆ, ಡ್ರೈವರ್ ಆಗಿದ್ದೆ).
- Frontend: Landing screen, pulsing mic orb, live transcript, profile card.
- Language picker drives `ui_language` — overrides langdetect.
- **17 tests passing**.

**Demo**: Speak "ನಾನು ಹೋಟೆಲ್‌ನಲ್ಲಿ 3 ವರ್ಷ ಕೆಲಸ ಮಾಡಿದ್ದೇನೆ" → profile card populates live.

---

### Phase 2 — Job Matching & Ranked Cards ✅ DONE
**Goal**: Swipeable job cards with match scores and plain-language reasons.

- 80 synthetic Bengaluru jobs across 8 categories (hotel, delivery, security, retail, construction, domestic, driver, factory).
- `rank_jobs`: `0.6 × skill_overlap + 0.3 × (1 − distance_penalty) + 0.1 × language_bonus`, normalised 0–100.
- Reasons are template-built (not LLM-generated) in EN/KN/HI. Numbers always come from data.
- `< 1 km` → "in your area" template; distances shown as `~X km`.
- Frontend: draggable job card deck, animated SVG score ring, save/skip buttons, sample-data label.
- Follow-up question logic: if profile has no area or no skills, a question is returned instead of matches.
- **23 tests passing**.

**Demo**: Profile from Phase 1 → 5 ranked cards, teal score ring animates to score, reason in Kannada.

---

### Phase 3 — Skill Gap & Learning Path 🔶 IN PROGRESS
**Goal**: Worker sees exactly what to learn to unlock more jobs.

Backend: `compute_skill_gap` tool and `POST /api/skill-gap` router are **written** but the router is **not yet wired** into `main.py` (`app.include_router(skill_gap_router)` missing — one line).

Still to do:
- Wire the router into `main.py`.
- Write `tests/test_skill_gap.py` (ranking order, zero-gap case, language templates).
- Add `SkillGapItem`, `SkillGapResponse` types to `frontend/src/lib/types.ts`.
- Add `fetchSkillGap()` to `frontend/src/lib/api.ts`.
- Add skill-gap state to `store/appStore.ts`.
- Build `SkillGapStepper.tsx` component and `pages/SkillGap.tsx`.
- Wire "See Skill Gaps" button on Jobs screen → SkillGap page.

**Demo target**: Worker profile lacks delivery licence → stepper shows "Learning Driving Licence could unlock 12 more jobs near you" + 3-step learning path.

---

### Phase 4 — Multilingual TTS ❌ PENDING
**Goal**: Job card match reasons are read aloud in the worker's language.

- Add `SpeechSynthesisUtterance` call when a job card is saved (right-swipe).
- Pass the `reason` string with `lang` set to `kn-IN` / `hi-IN` / `en-IN`.
- No translation API needed — reasons are already in the worker's language from Phase 2 templates.
- Graceful fallback: if the device has no Kannada TTS voice, use `en-IN`.

**Demo**: Swipe right on a Kannada job card → device speaks the reason aloud.

---

### Phase 5 — Employer Job-Post Flow ❌ ON CUT LIST
**Goal**: Any small employer can post a job in ≤ 30 seconds.

- Three-field form: title, area (dropdown), contact phone.
- `POST /api/employer/jobs` → job appears in worker feed.
- **Cut if time runs short.** Pre-seeded jobs are sufficient for a demo.

---

### Phase 6 — Orchestrate Integration, PWA & Demo Mode ❌ PENDING
**Goal**: Submission-ready, IBM products demonstrated, installable.

- **IBM watsonx Orchestrate** integration (see §8 below) — *pending access*.
- PWA manifest + service worker (offline landing + last-fetched jobs cached).
- Demo mode: auto-fill "Raju" persona for judges with no mic.
- Performance: Lighthouse ≥ 85.
- Error states: no mic permission, no location, network offline.
- Eval dataset: 10 scenarios (kn/hi/en inputs) in `eval/datasets/worker_scenarios.json`.
- Record 2-minute demo video.

---

## 6. Main Screen Designs

### Screen 1 — Landing (Mic)
```
┌──────────────────────────────┐
│  [kn] [hi] [en]  ←lang pick  │
│                              │
│        ಕೆಲಸ ಮಿತ್ರ           │
│      Work Friend             │
│                              │
│     ╔════════════════╗       │
│     ║   ●  (mic)     ║   ←  animated pulse rings
│     ║  TAP TO SPEAK  ║       │
│     ╚════════════════╝       │
│                              │
│  [──────────────────────]    │
│   or type your experience    │
└──────────────────────────────┘
```
- Mic button 80px, deep teal `#0d6e6e`, three concentric rings pulse while recording.
- Background: soft cream `#fdf8f0`.

### Screen 2 — Live Profile Builder
```
┌──────────────────────────────┐
│  ← Back     Your Profile     │
│  ┌────────────────────────┐  │
│  │ 🛠 Skills  Hotel · Cook  │  │  ← chips fade in
│  │ 📅 Exp    3 years       │  │
│  │ 📍 Area   Majestic      │  │
│  │ 🗣 Lang   ಕನ್ನಡ · हिंदी  │  │
│  └────────────────────────┘  │
│  [  FIND JOBS FOR ME →  ]    │
└──────────────────────────────┘
```
- Each field fades in with Framer Motion `staggerChildren`.
- Skill chips: amber `#f59e0b` pill badges.

### Screen 3 — Swipeable Job Cards
```
┌──────────────────────────────┐
│  ← Profile   5 Jobs Found    │
│  ┌────────────────────────┐  │
│  │  Hotel Room Attendant  │  │
│  │  Chancery Pavilion     │  │
│  │  Residency Road · 2.4km│  │
│  │  ₹12,000 – ₹16,000/mo  │  │
│  │                        │  │
│  │     ╔════════╗          │  │
│  │     ║  87%   ║  ← ring  │  │  SVG fills on card entry
│  │     ╚════════╝          │  │
│  │                        │  │
│  │  "ನಿಮ್ಮ ಹೋಟೆಲ್ ಅನುಭವ   │  │
│  │   ಮತ್ತು 2.4km ದೂರ…"    │  │
│  │  ⚠ Sample data          │  │
│  │  [Skip ✕]  [Save ✓]    │  │
│  └────────────────────────┘  │
│  ← skip · save →             │
└──────────────────────────────┘
```
- Cards: `drag="x"`, flung left = skip, right = save.
- Score ring: SVG `stroke-dashoffset` animates to score on mount (~600 ms spring).
- Colour: green ≥ 80, amber 60–79, red < 60.

### Screen 4 — Skill Gap Stepper
```
┌──────────────────────────────┐
│  ← Jobs     Grow Your Skills │
│  ┌──────┐                    │
│  │ +12  │  Driving Licence   │  ← amber badge
│  │ jobs │  +₹3,500/mo        │
│  └──────┘                    │
│  ● Step 1  LMV learner       │  ← active (teal dot)
│  │         licence at RTO    │
│  │         ⏱ ~1 week · ₹200  │
│  ○ Step 2  Driving practice  │  ← upcoming (grey)
│  │         ⏱ ~4 weeks · ₹2k  │
│  ○ Step 3  Driving test      │
│            ⏱ ~1 week · ₹300  │
│  ────────────────────────    │
│  ┌──────┐                    │
│  │ + 8  │  Security Guard    │
│  │ jobs │  Cert              │
│  └──────┘                    │
└──────────────────────────────┘
```
- Active step: solid teal dot + teal left border.
- "Jobs unlocked" badge: amber pill, font-weight 700.
- Numbers come from seed data, not from the LLM.

---

## 7. Matching Algorithm

```
match_score(worker, job) =
    0.6 × skill_overlap_score
  + 0.3 × (1 − distance_penalty)
  + 0.1 × language_bonus

skill_overlap_score = |worker.skills ∩ job.skills_required|
                      ──────────────────────────────────────
                      |job.skills_required|

distance_penalty    = min(distance_km, 20) / 20   (linear, capped at 20 km)

language_bonus      = 1 if any(worker.languages) ∈ job.languages
                      else 0
```

Jobs > 20 km away are excluded. Score is normalised to 0–100, rounded to integer.

---

## 8. IBM watsonx Orchestrate Integration

> **Status: PENDING ACCESS**  
> The integration plan below is based on publicly known Orchestrate behaviour
> and the IBM watsonx Orchestrate developer documentation at
> `developer.watson-orchestrate.ibm.com`. Exact UI steps and SDK method names
> could not be verified from the IBM docs index available in Bob — see
> §8.6 "What I could not verify" for the list of gaps.

### 8.1 What Orchestrate Does in This App

Orchestrate acts as the conversational agent layer. It receives the worker's text (from the React frontend), decides which backend tools to call, sequences the calls correctly, and asks follow-up questions when the profile is incomplete. The FastAPI backend stays dumb and deterministic — it never orchestrates; it only computes.

```
Worker types/speaks
       ↓
React frontend
       ↓   POST /chat (Orchestrate REST API or embedded chat widget)
IBM watsonx Orchestrate agent
       ↓   calls tool: POST /api/profile/extract-profile
FastAPI backend
       ↓   returns WorkerProfile JSON
Orchestrate
  - if profile.area is null  → ask "Where in Bengaluru do you live?"
  - if profile.skills == []  → ask "What kind of work have you done?"
  - else                     → call POST /api/matches
       ↓   returns JobMatch list
Orchestrate
       ↓   formats response in worker's language → returns to frontend
React frontend renders job cards
```

### 8.2 How Our FastAPI Endpoints Become Orchestrate Tools

**Method: OpenAPI import (preferred)**

Our FastAPI app already auto-generates an OpenAPI 3.0 spec at `GET /openapi.json`. In Orchestrate, this is imported as an "HTTP skill" or "custom tool":

1. Export `http://localhost:8000/openapi.json` (or the deployed URL once hosted).
2. In the Orchestrate agent builder, create a new tool → choose "Import from OpenAPI".
3. Upload or paste the spec. Orchestrate parses each `POST` endpoint as a callable tool.
4. Set authentication (none for dev; API key for production if needed).
5. Register three tools: `extract_profile`, `get_matches`, `get_skill_gap`.

**Alternative method: Python tool function**

If OpenAPI import is not available in the provisioned Orchestrate plan, register tools as Python functions using the Orchestrate ADK (Python SDK at `developer.watson-orchestrate.ibm.com`). Each function wraps an `httpx.post()` call to the FastAPI endpoint.

### 8.3 What I Need From You (Access Checklist)

Before Orchestrate integration can be implemented:

- [ ] IBM watsonx Orchestrate instance URL (format: `https://<region>.assistant.watson.cloud.ibm.com/instances/<id>`)
- [ ] IBM Cloud API key with at minimum `Viewer` + `Agent Builder` role on the Orchestrate instance
- [ ] Confirmation that the instance supports **custom HTTP tools** or **OpenAPI tool import**
- [ ] Whether the instance is on IBM Cloud (US-South, EU-DE, etc.) or AWS

Once access is confirmed:
- [ ] Deploy the FastAPI backend to a publicly reachable URL (IBM Cloud Code Engine or `ngrok` for demo)
- [ ] Import the OpenAPI spec into Orchestrate
- [ ] Configure the system prompt with Kelasa Mitra context + language instructions
- [ ] Test with Kannada/Hindi inputs end-to-end in the Orchestrate chat preview

### 8.4 Offline Fallback (if Orchestrate is unreachable during demo)

The React frontend already calls the FastAPI endpoints directly in its `lib/api.ts`. If Orchestrate is not yet integrated:

- `Landing.tsx` calls `extractProfile()` → `fetchMatches()` on form submit.
- Follow-up question logic runs inside `routers/matches.py` on the backend.
- The demo is fully functional without Orchestrate — just without the conversational agent layer.

This is the current working state and can be demonstrated independently.

### 8.5 What the Demo Shows with Orchestrate

When integrated, the demo narrative becomes:

> "I'm going to talk to the IBM watsonx Orchestrate agent — it's running in the cloud. I'll type in Kannada."  
> Worker types: "ನಾನು ಡ್ರೈವರ್ ಆಗಿದ್ದೆ, ಮಾರಾಥಹಳ್ಳಿಯಲ್ಲಿ ಇದ್ದೇನೆ"  
> Orchestrate calls `extract_profile` → profile extracted.  
> Orchestrate calls `get_matches` → 5 ranked jobs returned.  
> Jobs rendered on screen with animated score rings and Kannada reasons.  
> Judge asks for skill gap → Orchestrate calls `get_skill_gap` → stepper renders.

### 8.6 What I Could Not Verify From Documentation

The following details could **not be confirmed** from the IBM documentation available during planning. They must be verified once access is obtained:

| Item | Uncertainty |
|------|-------------|
| OpenAPI import UI path | The exact menu path in Orchestrate to import an OpenAPI spec is not confirmed. It may be called "Import skill", "Add tool", "HTTP skill" or similar. |
| Authentication model for tools | Whether HTTP tools use a bearer token, API key header, or no auth by default. |
| Orchestrate REST API endpoint for chat | The exact URL format for sending a chat message to an Orchestrate agent programmatically (for React frontend integration) — may require using the embedded chat widget instead. |
| Python ADK method names | The exact `ibm-watsonx-orchestrate` SDK method for registering a Python function as a tool (if OpenAPI import is not available). |
| Kannada language support | Whether Orchestrate's built-in LLM supports Kannada script in system prompts and tool call reasoning. |
| Free-tier tool limits | Whether the hackathon-provided Orchestrate access allows custom tool/skill import, or is restricted to built-in skills only. |

---

## 9. Risks & Mitigations

| # | Risk | Likelihood | Impact | Mitigation |
|---|------|-----------|--------|-----------|
| 1 | Orchestrate access not confirmed before demo | High | High | Offline fallback (direct FastAPI) always works; demo phases 1–3 without Orchestrate if needed |
| 2 | Orchestrate plan does not support OpenAPI tool import | Medium | High | Fall back to Python ADK function wrapper (same logic, different registration method) |
| 3 | Kannada TTS voice not available on test device | Medium | Medium | Use English TTS as fallback; written text always shown |
| 4 | Web Speech API unreliable / not supported | High | High | Text input always available; test on Chrome Android Day 1 |
| 5 | LLM extraction misses skills in Kannada script | Medium | High | Rule-based fallback always active; 40 tests confirm correctness |
| 6 | Stale SQLite DB (79 rows, non-jittered) affects demo | High | Medium | Delete `kelasa_mitra.db` + `.db-shm` + `.db-wal`; server re-seeds on next startup |
| 7 | 7-day timeline too aggressive for full scope | High | High | See cut list below |

---

## 10. Cut List (if time runs short)

Cut in this order — each item is independent and won't break the rest:

1. **Orchestrate integration** — the app is fully demoable without it (direct FastAPI calls). Demonstrate Orchestrate in the conversation script only if access is confirmed and working.
2. **TTS voice readback** — text display alone is sufficient; cut if Speech Synthesis causes issues.
3. **Employer job-post flow** — pre-seeded jobs are sufficient for demo; cut Phase 5 entirely.
4. **PWA / service worker** — web app works without offline support for a demo.
5. **Skill gap stepper animations** — replace with a plain bulleted list.
6. **Swipe gestures on job cards** — replace with Previous / Next buttons.

**Absolute minimum viable demo** (Phases 1 + 2):  
Worker speaks → profile extracts → top 3 ranked job cards shown with scores and reasons in their language.  
Everything else is enhancement.

---

## 11. Key Dependencies

| Package | Purpose | Version |
|---------|---------|---------|
| `fastapi` | Backend API | ≥ 0.110 |
| `groq` | Optional LLM (Groq free tier — `llama-3.3-70b-versatile`) | ≥ 0.9.0 |
| `sqlalchemy` | SQLite ORM-free access | 2.1.8 |
| `langdetect` | Language detection fallback | ≥ 1.0 |
| `pydantic` | Data models | ≥ 2.0 |
| `python-dotenv` | Env var loading | ≥ 1.0 |
| `react` | UI framework | 19 |
| `framer-motion` | Animations | ≥ 14 |
| `zustand` | State management | ≥ 5 |
| `tailwindcss` | Styling | 4 (via `@tailwindcss/vite`) |
| `vite` | Build tool | 8 |

---

## 12. 7-Day Timeline (revised)

| Day | Focus | Deliverable | Status |
|-----|-------|------------|--------|
| 1–2 | Backend (profile extraction, DB, seed), Frontend (Landing, mic, profile card) | Phase 1 fully demoable | ✅ Done |
| 2–3 | Job ranking algorithm, 80-job seed, swipeable cards, follow-up logic | Phase 2 fully demoable | ✅ Done |
| 3–4 | Wire skill-gap router; Phase 3 tests; SkillGap frontend page + stepper | Phase 3 demoable | 🔶 In progress |
| 4 | TTS via SpeechSynthesisUtterance on job card save | Phase 4 demoable | ❌ Pending |
| 5 | Orchestrate access + tool import + end-to-end test | Orchestrate integration | ❌ Pending access |
| 6 | PWA manifest, service worker, demo mode, Lighthouse ≥ 85 | Phase 6 / polish | ❌ Pending |
| 7 | Fix regressions, record demo video, final submission | Submitted | ❌ Pending |

---

*Plan written: 2026-11-07. Revised: 2026-11-07 to reflect Orchestrate as agentic layer, remove Google ADK/Gemini, correct folder tree to match actual codebase, and add Orchestrate integration section (§8).*
