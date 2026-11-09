# Kelasa Mitra — Project Plan (as built)

**IBM Bobathon: Build for Bengaluru** · Theme: *More Opportunity, Greater Together* · Solo student entry

*Rewritten 2026-11-09 to match the code. The original plan by IBM Bob (2026-11-07) is kept
unedited in [docs/bob/bob_PLAN_baseline.md](docs/bob/bob_PLAN_baseline.md); how the project got
from there to here is in [BOB_STORY.md](BOB_STORY.md).*

---

## 1. Problem and solution

**Problem.** Blue-collar and gig workers in Bengaluru are poorly served by job portals that assume
English, typing and form-filling.

**Solution.** A mobile-first web app: the worker speaks or types one sentence in Kannada, Hindi or
English; the app extracts a profile, ranks nearby (synthetic) jobs with a reason for each, and
shows which skill would unlock the most nearby jobs. An IBM watsonx Orchestrate agent answers
the same sentence by calling the same logic as tools.

---

## 2. Architecture

```
Phone browser (React 19 · Vite 8 · Tailwind 4 · Framer Motion 14 · Zustand 5)
  Web Speech API (speech to text, en-IN / kn-IN / hi-IN) · speechSynthesis (read-aloud)
        │  /api/*  (Vite dev proxy, same origin)
        ▼
FastAPI backend (Python 3.11)
  POST /api/profile/extract-profile ─ rules (tools/fallback.py), optional Groq (tools/provider.py)
  POST /api/matches                 ─ tools/job_ranker.py + tools/follow_up.py
  POST /api/skill-gap               ─ tools/skill_gap.py
  POST /api/agent/chat              ─ tools/orchestrate_client.py ──► IBM watsonx Orchestrate
  GET  /health                                                         kelasa_mitra_agent
  SQLite (SQLAlchemy Core): 130 synthetic jobs, seeded on start          │ calls 3 Python tools
                                                                          ▼
                                          orchestrate/kelasa_tools/ (byte-for-byte copies of the
                                          backend logic + jobs_snapshot.json, no database)
```

- **Cards never come from the agent.** The frontend calls the four deterministic endpoints for
  the profile, cards and skill gap, and asks the agent in parallel; the agent's text is shown
  in a separate panel. If the agent is off or fails, a banner says the rules answered.
- **Numbers never come from an LLM.** Scores, distances, pay, job counts and the uplift are
  computed in Python from the data. Groq, when enabled, may return only skill IDs, an area name
  and spoken languages, which are validated; coordinates come from `areas.json` and experience
  from the rules.
- **Language.** The picker value is sent as `ui_language` to extract-profile and agent/chat and
  as `profile.detected_language` to matches and skill-gap; every reply (reasons, follow-up
  questions, skill-gap text, the tools' `reply_lines`) uses it. `langdetect` is only a fallback
  when no language is given.

---

## 3. Folder structure (2026-11-09)

```
backend/
  main.py                    FastAPI app, CORS (local dev server or CORS_ALLOWED_ORIGINS), lifespan seeding
  routers/                   profile.py, matches.py, skill_gap.py, agent.py
  tools/                     fallback.py (rules), provider.py (optional Groq), profile_extractor.py,
                             profile_builder.py, follow_up.py, job_ranker.py, skill_gap.py,
                             orchestrate_client.py (token, chat call, https checks)
  models/                    worker.py, job.py, skill_gap.py (Pydantic)
  db/                        database.py, seed_jobs.py (130 jobs, single source)
  data/                      skills.json (41), areas.json (31), learning_paths.json (41),
                             jobs_snapshot.json (copy of the seed for the Orchestrate tools)
  scripts/                   agent_warmup.py, export_jobs_snapshot.py, run_eval.py,
                             gen_templates_review.py, compare_providers.py
  tests/                     14 test files, samples.json (13), eval_samples.json (15)
frontend/
  src/pages/                 Landing.tsx, Jobs.tsx
  src/components/            MicButton, ListeningWave, LanguagePicker, LanguageNudge, SpeakToggle,
                             ProfileCard, SaveOnDevice, AgentPanel, JobCard, DragFeedback,
                             MatchRing, SaveBurst, SkillGapSection, SkillGapStepper
  src/hooks/                 useSpeech, useProfile, useReadAloud
  src/lib/                   api, i18n (en/kn/hi), types, skills, areaChips, scriptLanguage,
                             savedProfile, tts, motion, deck, agentSteps
  src/store/appStore.ts      Zustand state
  src/test/                  vitest tests (20 files)
orchestrate/
  build_kelasa_tools.py      builds kelasa_tools/ from backend files + kelasa_tools_src/
  kelasa_tools_src/          kelasa_core.py, kelasa_mitra_tools.py (entry file), requirements.txt
  kelasa_tools/              generated tool package (17 files); never edit by hand
  agents/kelasa_agent.yaml   kelasa_mitra_agent
  hello-world-agent.yaml     first access check
docs/                        eval_results.md, a11y_review.md, TEMPLATES_TO_REVIEW.md,
                             learning_paths_changes.md, provider_comparison.md,
                             SUBMISSION_CHECKLIST.md, bob/ (IBM Bob evidence)
.bob/                        Bob's rules and audit report (kept as Bob left them)
sonar-project.properties, .sonarcloud.properties   duplication exclusions only
```

---

## 4. Matching and skill gap

```
score = 0.6 × (matched required skills / all required skills)
      + 0.3 × (1 − min(distance_km, 20) / 20)
      + 0.1 × (1 if the job uses a language the worker speaks, else 0)      → 0–100
```

- Jobs more than 20 km away are excluded; the top 10 are returned.
- If at least 3 jobs within 20 km use one of the worker's skills, jobs that use none are hidden.
- Equal scores are ordered by distance, then by seed order, so results are deterministic.
- Reasons come from templates in en/kn/hi; distances under 1 km read "in your area", others "~X km".
- **Follow-up**: no area → "Where in Bengaluru do you live?" (or "Bengaluru is a big city…" when
  only the city was named); no skills → "What kind of work have you done?". Area chips appear
  for the area question.
- **Skill gap**: for each skill the worker lacks, count nearby jobs that would become strong
  matches (score ≥ 60) if they had it; return the top 3 by jobs unlocked, then pay uplift. The
  uplift is the average pay of those jobs minus the average pay of current strong matches, and
  0 when negative or when there are no current matches.
- **Seed**: 130 jobs (118 jobs, 12 apprenticeships) in 25 areas, fixed IDs `job-001`–`job-130`,
  coordinates jittered by up to ±0.008° (about 1.2 km at most) with a fixed random seed.
  `job-095`–`job-130` were added for demo coverage: for each of the 8 area chips and the 8
  skills most common in the sample inputs, the top match uses that skill within 5 km
  (`backend/tests/test_demo_quality.py`).

---

## 5. Phases (real status)

| Phase | What | Status | Built by |
|---|---|---|---|
| 1 | Voice/text input, profile extraction (en/kn/hi), language picker | ✅ Done | IBM Bob; extraction guards and fixes by Claude Code |
| 2 | Ranked job cards, reasons, follow-up question, sample jobs | ✅ Done | IBM Bob; seed IDs, invented employer names, ranking rule, extra jobs by Claude Code |
| 3 | Skill gap and learning path | ✅ Done | Claude Code (Bob wrote the tool and router; the router was unwired) |
| 4 | Replies in the worker's language, read-aloud | ✅ Built; **not tested on a real phone** in kn/hi | Claude Code |
| 5 | Employer job-post flow | ❌ Cut | — |
| 6 | Orchestrate agent | ✅ Verified 2026-11-09 (see §6) | Claude Code; ADK installed by Bob |
| 6 | Evaluation | ✅ Done, synthetic, labels still DRAFT ([docs/eval_results.md](docs/eval_results.md)) | Claude Code |
| 6 | Accessibility review, design upgrade, language nudge, save-on-device | ✅ Done | Claude Code |
| 6 | PWA (manifest, service worker) | ❌ Not built (cut list) | — |
| 6 | Demo video | ⏳ Owner | — |

---

## 6. IBM watsonx Orchestrate, as built

- **Tool package** `orchestrate/kelasa_tools/`, generated by `orchestrate/build_kelasa_tools.py`.
  It copies the backend's models, rule-based tools and data byte for byte, adds
  `kelasa_core.py` and the entry file `kelasa_mitra_tools.py` from `kelasa_tools_src/`, and
  reads jobs from `jobs_snapshot.json` (no database in the tool runtime).
  `backend/tests/test_orchestrate_package.py` fails if the copies drift or the results differ
  from the backend endpoints. The entry file must not be named `kelasa_tools.py`: the ADK imports
  it as `<folder>.<file>` and a same-named file shadowed the folder.
- **Three tools**, each taking only `worker_text` and `ui_language` and returning plain JSON with
  `reply_lines` already written in that language: `extract_profile`, `find_matches`,
  `skill_gap`. No number passes through the model.
- **Agent** `orchestrate/agents/kelasa_agent.yaml`: `kelasa_mitra_agent`, native,
  `groq/openai/gpt-oss-120b`, `react_core`. Its instructions call `extract_profile` first on
  every message, reply with the follow-up question if there is one, otherwise call
  `find_matches` then `skill_gap` and reply with their lines; never answer from its own
  knowledge or mention anything a tool did not return. (A spike showed the model skipping the
  tool for an open question, hence the strict wording.)
- **Proxy** `POST /api/agent/chat` (`backend/routers/agent.py`, `tools/orchestrate_client.py`):
  one stateless chat call with a 20 s budget; the API key and token stay on the server. The
  token is obtained like the ADK does (IBM Cloud IAM for `*.cloud.ibm.com`, MCSP v1/v2 for
  other hosts, or `ORCHESTRATE_AUTH_TYPE`). Instance and IAM URLs must be https.
- **Rules fallback**: when the agent is not configured or fails (`not_configured`, `timeout`,
  `network_error`, `agent_http_error`, …), the endpoint returns `source: "rules"` and the app
  shows a 3-language "agent offline" banner; the cards are unaffected. The panel never repeats a
  follow-up question the app has already asked.
- **Warm-up** `backend/scripts/agent_warmup.py`: the first tool call after an import can take
  over a minute; run it twice before a demo.
- **Verified 2026-11-09 (owner)**: console trace of `extract_profile` → `find_matches` →
  `skill_gap` for "I cook, 2 years, I live in Whitefield"; warm-up got HTTP 200; the app's panel
  showed the tools' text. **UNVERIFIED**: that the agent's final wording always stays in the
  picker language, its response time, and the trial end date.

---

## 7. Decisions and why

| Decision | Why |
|---|---|
| No login or sign-up | The users should not need an email or password; nothing about them is stored server-side; the contest asks for no personal data. |
| Deterministic matching and skill gap | Explainable, testable, fast, and no invented jobs, pay or distances. |
| Groq optional, rules always work | No key, no network and no cost are needed to run or test; Groq output is validated and never gives numbers. |
| Python tools instead of an OpenAPI import | Orchestrate runs the tools itself: no public URL, tunnel or paid hosting for the backend. |
| `https` required for Orchestrate URLs, CORS restricted, 2000-character input limit | Keys never travel in clear text; no open cross-origin access; bounded work on untrusted input (two regexes with catastrophic backtracking were also fixed). |
| Synthetic data only, invented employers | Contest rules; a test rejects known real company names. |
| Optional on-device save with Delete | Lets a worker come back without an account; nothing leaves the browser except what a search sends. |
| Never switch language automatically | A suggestion button only; nothing is translated. |

---

## 8. Cut list

Cut, in this order, if needed: **employer job-post view** (cut), **PWA** manifest and service
worker (not built), card and skill-gap animations (already off under reduced motion), swipe
gestures (buttons and arrow keys remain). **IBM watsonx Orchestrate is required by the contest
and is not on the cut list.**

---

## 9. Risks

| Risk | Mitigation |
|---|---|
| Orchestrate trial ends or the agent is slow during judging | Warm-up before the demo; the app keeps working on the rules with a visible banner. Trial end date UNVERIFIED. |
| Speech recognition or Kannada/Hindi voices missing on a phone | Typing always works; text is always shown; not yet tested on a real phone (UNVERIFIED). |
| Kannada/Hindi wording wrong | All strings listed in docs/TEMPLATES_TO_REVIEW.md for a native speaker (not reviewed yet). |
| Stale SQLite file after the seed changes | Seeding skips a filled table: delete `backend/db/kelasa_mitra.db` with the backend stopped. |
| Tool package out of date after a backend change | Rebuild and re-import; a test fails until rebuilt. |
| Agent wording drifts from the tools | Strict instructions; cards never depend on it; the panel hides repeated questions. |

---

## 10. Dependencies (from requirements.txt and package.json)

Backend (Python 3.11): fastapi 0.115.5, uvicorn[standard] 0.32.1, pydantic 2.10.3,
sqlalchemy 2.1.8, langdetect 1.0.9, python-dotenv 1.0.1, httpx 0.27.2, groq ≥ 0.9.0,
pytest 8.3.4, pytest-asyncio 0.24.0. Orchestrate tools: ibm-watsonx-orchestrate 2.19.1,
pydantic 2.14.3.

Frontend: react ^19.3.1, vite ^8.3.6, tailwindcss ^4.3.5 (via `@tailwindcss/vite`, no config
file), framer-motion ^14.10.1, zustand ^5.1.0, typescript ~7.0.2, vitest ^5.1.0, oxlint.
