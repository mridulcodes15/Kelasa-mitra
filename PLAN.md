# Kelasa Mitra — Project Plan (as built)

**IBM Bobathon: Build for Bengaluru** · Theme: *More Opportunity, Greater Together* · Solo student entry

*Updated 2026-11-14 to match the code (final docs update, submission day). The original plan by IBM Bob
(2026-11-07) is kept unedited in [docs/bob/bob_PLAN_baseline.md](docs/bob/bob_PLAN_baseline.md);
how the project got from there to here is in [BOB_STORY.md](BOB_STORY.md).*

---

## 1. Problem and solution

**Problem.** Blue-collar and gig workers in Bengaluru are poorly served by job portals that assume
English, typing and form-filling.

**Solution.** A mobile-first web app: the worker chooses Kannada, Hindi or English, then speaks or
types one sentence; the app extracts a profile, ranks nearby (synthetic) jobs with a reason for
each, and shows which skills would unlock the most nearby jobs. An IBM watsonx Orchestrate agent
answers the same sentence by calling the same logic as tools.

---

## 2. Architecture

```
Phone browser (React 19 · Vite 8 · Tailwind 4 · Framer Motion 14 · Zustand 5)
  Welcome (language cards) → Landing (mic / text) → Jobs (cards, skill gap, saved jobs list)
  localStorage: optional saved profile, saved jobs, read-aloud mute (this browser only)
  Web Speech API (speech to text, en-IN / kn-IN / hi-IN) · speechSynthesis (read-aloud)
        │  /api/*  (dev: Vite proxy; Docker/Render: same FastAPI origin)
        ▼
FastAPI backend (Python 3.11)
  POST /api/profile/extract-profile ─ rules (tools/fallback.py), optional Groq (tools/provider.py)
                                      rate limit 30/min per IP, 2000-character cap
  POST /api/matches                 ─ tools/job_ranker.py + tools/follow_up.py
  POST /api/skill-gap               ─ tools/skill_gap.py
  POST /api/agent/chat              ─ tools/orchestrate_client.py ──► IBM watsonx Orchestrate
                                      rate limit 10/min per IP, 20 s budget    kelasa_mitra_agent
  GET  /health                                                                    │ calls 3 tools
  GET  /* (frontend/dist, only when built)                                        ▼
  SQLite (SQLAlchemy Core): 130 synthetic jobs,       orchestrate/kelasa_tools/ (byte-for-byte
  seeded on start                                     copies of the backend logic +
                                                      jobs_snapshot.json, no database)
```

- **Cards never come from the agent.** The frontend calls the deterministic endpoints for the
  profile, cards and skill gap, and asks the agent in parallel; the agent's text is shown in a
  separate panel. If the agent is off, fails or exceeds 20 s, a banner says the rules answered.
- **Numbers never come from an LLM.** Scores, distances, pay, job counts and the uplift are
  computed in Python from the data. Groq, when enabled, may return only skill IDs, an area name
  and spoken languages, which are validated; coordinates come from `areas.json` and experience
  from the rules. Reasons, skill-gap text and follow-up questions are templates in en/kn/hi.
- **Language.** The picker value is sent as `ui_language` to extract-profile and agent/chat and
  as `profile.detected_language` to matches and skill-gap; every reply (reasons, follow-up
  questions, skill-gap text, the tools' `reply_lines`) uses it. `langdetect` is only a fallback
  when no language is given.
- **Only the latest search counts.** An older, slower search is dropped; a new search clears the
  follow-up card and the previous agent reply first.

---

## 3. Folder structure (from `git ls-files`, 2026-11-14)

```
Dockerfile, .dockerignore       one image: Node build stage + Python runtime (non-root UID 1000)
LICENSE (MIT), NOTICE, OFL.txt  NOTICE credits the ಕ outline (Noto Sans Kannada, OFL 1.1)
README.md, PLAN.md, BOB_STORY.md
sonar-project.properties, .sonarcloud.properties   duplication exclusions only
backend/
  main.py                    FastAPI app, CORS, lifespan seeding, serves frontend/dist if present
  requirements.txt, .env.example, pytest.ini
  routers/                   profile.py, matches.py, skill_gap.py, agent.py
  tools/                     fallback.py (rules, spelling normalisation, one-letter tolerance),
                             provider.py (optional Groq), profile_extractor.py, profile_builder.py,
                             follow_up.py, job_ranker.py, skill_gap.py, rate_limit.py,
                             orchestrate_client.py (token, chat call, https checks)
  models/                    worker.py, job.py, skill_gap.py (Pydantic)
  db/                        database.py, seed_jobs.py (130 jobs, single source)
  data/                      skills.json (41), areas.json (31), learning_paths.json (41),
                             jobs_snapshot.json (copy of the seed for the Orchestrate tools)
  scripts/                   agent_warmup.py, export_jobs_snapshot.py, run_eval.py,
                             gen_templates_review.py, compare_providers.py
  tests/                     17 test files; samples.json (13), eval_samples.json (15),
                             no_skill_sentences.json (67), extraction_baseline.json (28)
frontend/
  public/                    favicon.svg (the ಕ mark)
  src/pages/                 Welcome.tsx, Landing.tsx, Jobs.tsx
  src/components/            AgentPanel, BrandMark, DemoNote, DragFeedback, JobCard, LanguageNudge,
                             LanguagePicker, ListeningWave, MatchRing, MicButton, NoSpeechHint,
                             ProfileCard, SaveBurst, SaveOnDevice, SavedJobsList, SkillGapSection,
                             SkillGapStepper, SpeakToggle, TraceButton
  src/hooks/                 useSpeech, useProfile, useReadAloud
  src/lib/                   agentSteps, api, areaChips, brand, deck, i18n (en/kn/hi), motion,
                             savedJobs, savedProfile, scriptLanguage, skillChips, skills,
                             speechText, trace, tts, types, welcome
  src/store/appStore.ts      Zustand state
  src/test/                  vitest: 26 test files, plus fixtures and setup
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
```

Not tracked: `design/` (the font file used to draw the mark; excluded from the image),
`backend/.env`, the SQLite file, working notes.

---

## 4. Language-first design

- **Why.** Chrome's speech recognition must be told the language before it listens and cannot
  detect it; Hindi or Kannada spoken under the English setting gives no words. Typed text can be
  checked by script (the switch-language suggestion), speech cannot. A service that detects the
  spoken language would have to receive the worker's voice, so none was added, and the app never
  records audio itself.
- **Flow.** Splash (the ಕ mark and "Kelasa Mitra", about 1.2 s, fade; a tap or key skips; reduced
  motion and coming back start at the cards) → three cards **English / हिन्दी / ಕನ್ನಡ** that turn
  teal-green under a mouse, a finger tracing across them or keyboard focus, choosing on release
  → mic screen with a **"Language: …" chip** (goes back to the cards, typed text kept) and
  **"Listening in: …"** while listening. The cards are in the page under the splash, so screen
  readers and keyboards never wait. The choice is kept for the visit only.
- **No speech heard.** A hint offers the other two languages as 48 px buttons; tapping one
  switches the picker and listens again. The worker chooses; nothing is detected.
- **Mark.** The ಕ is an outline path from Noto Sans Kannada Condensed Bold (SIL OFL 1.1),
  credited in NOTICE; favicon and in-app mark are the same path. Clear at 32 and 180 px, only
  roughly legible at 16 px.

---

## 5. Speech and recognition

- **Android partial results.** Android Chrome re-sends the whole result list and lists growing
  partials ("I", "I am", "I am a") as separate, sometimes final, entries. `lib/speechText.ts`
  stores results by index, drops entries the next one repeats, and the hook reports the whole
  confirmed text (replace, never append). Found on a real phone.
- **Final transcript.** When the mic is stopped, the search waits for the browser to end the
  session (at most 1.5 s) and runs on the final text, including words confirmed only after stop.
- **Spelling normalisation (matching only).** Unicode NFC, ZWJ/ZWNJ removed, nukta dropped,
  chandrabindu → anusvara, nasal consonant + virama before a consonant → anusvara, long vowels →
  short (Devanagari i/u; Kannada i/u/e/o). Applied to the text and to every synonym. Found on a
  real phone: इलेक्ट्रिशियन (short i, U+093F) did not match the listed इलेक्ट्रीशियन (long ii,
  U+0940).
- **Variants and tolerance.** 25 plausible Hindi/Kannada spellings for 10 loanword skills
  (electrician, car driver, plumber, delivery, security guard, housekeeping, hotel helper,
  two-wheeler, tailoring, cook), marked in `skills.json` as not verified. For those skills only, a
  Devanagari or Kannada word of 6+ letters matches at edit distance 1, and only when exactly one
  skill is that close.
- **Scope.** 41 skills. Anything else (teacher, doctor, student, …) is deliberately not
  recognised: the app says so and shows 10 skill chips. "farmer", "किसान", "ರೈತ" and "shopkeeper"
  were removed as synonyms (owners of a farm or shop are not looking for these jobs).
- **Guards (tests).** 67 sentences in en/hi/kn must match no skill; the 13 samples and 15
  evaluation inputs give the same results as before the change; no new synonym shared between
  two skills (six older overlaps, such as watchman/security guard, are listed in the test).

---

## 6. Matching and skill gap

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
  only the city was named), with 8 area chips; area known but no skill → "I did not recognise
  that kind of work yet…" with 10 skill chips (or "What kind of work have you done?" when there
  was no text at all).
- **Skill gap**: for each skill the worker lacks, count nearby jobs that would become strong
  matches (score ≥ 60) if they had it; return the top 3 by jobs unlocked, then pay uplift. The
  uplift is the average pay of those jobs minus the average pay of current strong matches, and
  0 when negative or when there are no current matches.
- **Seed**: 130 jobs (118 jobs, 12 apprenticeships) in 25 of the 31 areas, fixed IDs
  `job-001`–`job-130`, coordinates jittered by up to ±0.008° (about 1.2 km at most) with a fixed
  random seed. Pay and coverage were designed for the demo: `job-095`–`job-130` (36 jobs) were
  added so that for each of the 8 area chips and the 8 skills most common in the sample inputs,
  the top match uses that skill within 5 km (`backend/tests/test_demo_quality.py`).

---

## 7. Saved jobs

- **What it does.** Swiping right, the Save button and the right-arrow key add the top job to a
  "Saved jobs" list; swiping left, Skip and the left-arrow key never save. A job already in the
  list is not added again. Before this, Save only raised an in-page counter and recorded no job;
  the header counter now always matches the list.
- **Storage** (`frontend/src/lib/savedJobs.ts`): this browser's localStorage only, every call in
  try/catch. Stored per job: id, title, employer, area, pay range, the distance text as shown,
  matched skill ids, the sample-data flag, and the picker language. No profile text, no audio,
  nothing sent to a server; entries are validated and extra fields dropped when read back. If
  storage is blocked, the list lives in memory for the visit and a note says so.
- **Screen** (`components/SavedJobsList.tsx`, `components/TraceButton.tsx`, `pages/Jobs.tsx`): a
  full-width "Saved jobs (N)" button below the deck and its Skip/Save buttons (also after the
  last card) opens the list inside the jobs screen (no router). One rectangular card per job with
  Remove, a privacy line ("Saved only in this browser on this device, never on our server."), an
  empty state, and "Back to Search", which shows the deck again exactly as it was (the deck state
  stays in the page; profile, matches and the list are untouched).
- **Green trace** (`frontend/src/lib/trace.ts`, shared with the language cards on the welcome
  screen): the item under a mouse, or a finger pressing or dragging, turns teal-green with white
  text (6:1) and a small lift; on the list a fill glides between cards (`layoutId`). Keyboard focus
  gives the same state. The list keeps vertical scrolling (`touch-action: pan-y`), so a finger
  drag that becomes a scroll ends the trace. Under reduced motion nothing moves; the green stays.
- **Delete my data** clears the saved jobs, the saved profile and the visit state.
- **Why per browser.** There are no accounts by design, so the list is not synced to other
  devices. A live-jobs version would need stable job ids and employer contact details.

---

## 8. Phases (real status)

| Phase | What | Status | Built by |
|---|---|---|---|
| 1 | Voice/text input, profile extraction (en/kn/hi), language picker | ✅ Done | IBM Bob; guards, spelling normalisation and fixes by Claude Code |
| 2 | Ranked job cards, reasons, follow-up question, sample jobs | ✅ Done | IBM Bob; seed IDs, invented employer names, ranking rule, extra jobs by Claude Code |
| 3 | Skill gap and learning path | ✅ Done | Claude Code (Bob wrote the tool and router; the router was unwired) |
| 4 | Replies in the worker's language, read-aloud | ✅ Built; read-aloud and Kannada speech **not verified on a phone** | Claude Code |
| 5 | Employer job-post flow | ❌ Cut | — |
| 6 | Orchestrate agent | ✅ Verified 2026-11-09 (see §10) | Claude Code; Orchestrate ADK installed by Bob |
| 6 | Evaluation | ✅ Done, synthetic, labels still DRAFT ([docs/eval_results.md](docs/eval_results.md)) | Claude Code |
| 6 | Accessibility review, design upgrade, language suggestion, save-on-device | ✅ Done | Claude Code |
| 6 | Language-first welcome flow, app mark, Android speech fixes, spelling variants | ✅ Done; partly checked on a real phone (see README Limitations) | Claude Code |
| 6 | Security pass, rate limits, public demo note | ✅ Done | Claude Code |
| 6 | Saved jobs shortlist (browser only) | ✅ Done; real-finger trace on a phone NOT VERIFIED | Claude Code |
| 6 | Deployment (Docker, Render) | ✅ Image built and run locally by the owner; live at https://kelasa-mitra.onrender.com/ (whether it runs the newest commit: UNVERIFIED until the owner confirms) | Claude Code; deployed by the owner |
| 6 | PWA (manifest, service worker) | ❌ Not built (cut list) | — |
| 6 | Demo video | ⏳ Owner; not linked yet | — |

---

## 9. Validation

- **Benchmark** (`backend/scripts/run_eval.py`, [docs/eval_results.md](docs/eval_results.md)):
  15 synthetic inputs (5 each in en/kn/hi); 42 of 45 top-3 suggestions need a skill the worker
  mentioned, skill recall 97%, median pipeline time 17.8 ms on one laptop (rules only). Limits:
  inputs written by an AI tool, labels drafted by the same tool and still DRAFT, Kannada/Hindi
  not reviewed by a native speaker, likely optimistic, not a field study.
- **Guards in the tests**: 67 sentences in en/hi/kn that must match no skill; the 13 samples and
  15 evaluation inputs give the same results as before the spelling changes.
- **Early user test (informal, not a study).** Three people in the owner's building who had not seen the app tried it for a few minutes: a watchman and a domestic worker who spoke Hindi, and a garbage collector. All three used the microphone. The two Hindi speakers were understood on the first try. The garbage collector first tried to speak Marathi, which the app does not support; she was told so, switched to Hindi, and was then understood. Nothing else confused them. They swiped cards left and right, said it was very easy to use, and liked choosing the language first when the app opens. The Marathi attempt is the clearest finding: a worker's first instinct is her own language, so Marathi is the next language to add. Limits: three people in one building (in Mumbai, so they picked a random Bengaluru area and saw sample jobs); what the Marathi attempt produced in the text box was not recorded; device and browser not recorded; no names, photos, audio or personal details recorded; not a measure of accuracy.

---

## 10. IBM watsonx Orchestrate, as built

- **Tool package** `orchestrate/kelasa_tools/`, generated by `orchestrate/build_kelasa_tools.py`.
  It copies the backend's models, rule-based tools and data byte for byte, adds
  `kelasa_core.py` and the entry file `kelasa_mitra_tools.py` from `kelasa_tools_src/`, and
  reads jobs from `jobs_snapshot.json` (no database in the tool runtime).
  `backend/tests/test_orchestrate_package.py` fails if the copies drift or the results differ
  from the backend endpoints. The entry file must not be named `kelasa_tools.py`: the Orchestrate ADK
  imports it as `<folder>.<file>` and a same-named file shadowed the folder.
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
  token is obtained like the Orchestrate ADK does (IBM Cloud IAM for `*.cloud.ibm.com`, MCSP v1/v2 for
  other hosts, or `ORCHESTRATE_AUTH_TYPE`). Instance and IAM URLs must be https.
- **Rules fallback**: when the agent is not configured or fails (`not_configured`, `timeout`,
  `network_error`, `agent_http_error`, …), the endpoint returns `source: "rules"` and the app
  shows a 3-language "agent offline" banner; the cards are unaffected. The panel never repeats a
  follow-up question the app has already asked, and hides the agent's text while the "not
  recognised" card is shown.
- **Warm-up** `backend/scripts/agent_warmup.py`: the first tool call after an import can take
  over a minute; run it twice before a demo.
- **Verified 2026-11-09 (owner)**: console trace of `extract_profile` → `find_matches` →
  `skill_gap` for "I cook, 2 years, I live in Whitefield"; warm-up got HTTP 200; the app's panel
  showed the tools' text, locally and on the live site that evening. The package was re-imported
  several times since and the agent kept answering. **UNVERIFIED**: console runs coming from the
  live site, that the agent's final wording always stays in the picker language, its response
  time, and the exact trial end date.

---

## 11. Deployment

- **One container.** `Dockerfile`: `node:22-slim` builds the frontend; `python:3.11-slim` runs
  FastAPI, which serves `frontend/dist` and the API from one origin (no CORS needed). Non-root
  user UID 1000, `backend/db` writable for the SQLite file (seeded on start), health check
  `/health`, listens on `$PORT` (default 8000), `--proxy-headers` so rate limits see the
  visitor's IP. `.dockerignore` keeps `.env`, databases, `design/`, `.bob/`, `docs/bob/` and the
  Orchestrate venv out of the image.
- **Local.** `docker run --rm -p 8080:8000 kelasa-mitra`, open `http://localhost:8080`; add
  `--env-file backend\.env` for the agent (values without quotes). The owner built and ran it
  both ways.
- **Render.** https://kelasa-mitra.onrender.com/, a free web service built from the Dockerfile on
  branch `main`; whether it already runs the newest commit (saved jobs) is UNVERIFIED until the
  owner confirms. The agent is on via
  host secrets set in Render's Environment settings (`ORCHESTRATE_INSTANCE_URL`,
  `ORCHESTRATE_API_KEY` — a separate key, to be deleted after the contest — and
  `ORCHESTRATE_AGENT_ID`); `GROQ_API_KEY` is not set. Without the variables the same image runs
  on the rules only.

---

## 12. Security notes

- CORS: the local Vite dev server or `CORS_ALLOWED_ORIGINS`; `*` is ignored; GET/POST only.
- Input: 2000-character cap on extract-profile and agent/chat; two experience regexes with
  catastrophic backtracking (800 letters took 5.7 s) were rewritten to run in linear time.
- Orchestrate: instance and IAM URLs must be https; odd agent IDs are refused; the key never
  reaches the browser.
- Rate limits (in memory, per client IP, per process): 30/min extract-profile, 10/min
  agent/chat; 429 with `Retry-After` and a short message in en/kn/hi.
- Public demo note in en/kn/hi: do not enter personal details.
- Browser storage holds only what the worker chose to keep (the optional profile without their
  words, and saved jobs as card fields); Delete my data removes both.
- No keys in the repo; `.env` is git-ignored and excluded from the image.

---

## 13. Decisions and why

| Decision | Why |
|---|---|
| No login or sign-up | The users should not need an email or password; nothing about them is stored server-side; the contest asks for no personal data. |
| Language chosen first, never detected | Browser speech recognition needs the language in advance; detection would send voice to a third party. |
| Deterministic matching and skill gap | Explainable, testable, fast, and no invented jobs, pay or distances. |
| Normalise spellings instead of adding an LLM | Same answer every time, works offline, numbers untouched; tolerance kept narrow to avoid false matches. |
| Groq optional, rules always work | No key, no network and no cost are needed to run or test; Groq output is validated and never gives numbers. |
| Python tools instead of an OpenAPI import | Orchestrate runs the tools itself: no public URL or tunnel needed for the agent. |
| `https` required for Orchestrate URLs, CORS restricted, input cap, rate limits | Keys never travel in clear text; no open cross-origin access; bounded work on untrusted input on a public demo. |
| Synthetic data only, invented employers | Contest rules; a test rejects known real company names. |
| Optional on-device save with Delete | Lets a worker come back without an account; nothing leaves the browser except what a search sends. |
| Saved jobs in the browser, card fields only | A shortlist without an account; nothing to store or secure on the server. |
| Never switch language automatically | A suggestion button only; nothing is translated. |

---

## 14. Cut list

Not built, with the reason:

- **Employer job-post view**: cut for time; all jobs are synthetic.
- **PWA** (manifest, service worker): not needed for the demo.
- **Automatic language detection**: browser speech recognition cannot do it, and a detecting
  service would have to receive the worker's voice.
- **Accounts**: by design; workers should not need an email or password, and nothing about them
  is stored on the server (so saved jobs are per browser).
- **Marathi**: not supported yet; it is the natural next language (the person in the README's
  story spoke Marathi and Hindi), but it needs its own synonyms, templates and native review.
- **Live job feed**: needs real employers, stable job ids and contact details; the demo uses
  synthetic jobs only.

Cut next, in this order, if needed: card and skill-gap animations (already off under reduced
motion), swipe gestures (buttons and arrow keys remain).
**IBM watsonx Orchestrate is required by the contest and is not on the cut list.**

---

## 15. Risks

| Risk | Mitigation |
|---|---|
| Orchestrate trial ends (around 2026-12-08, owner to confirm) or the agent is slow during judging | Warm-up before the demo; the app keeps working on the rules with a visible banner. |
| Render free service sleeps (about 15 min idle; first request about a minute) | Open the site a few minutes before judging; the agent falls back to the rules after 20 s. |
| Rate limit hit during a demo (30/min, 10/min for the agent) | Limits are per IP and reset each minute (and on restart). |
| Free-tier limits (Render hours, Orchestrate trial usage) | UNVERIFIED; not measured. |
| Unseen speech spellings of loanwords, and verb forms (e.g. "मैं खाना बनाता हूँ" finds no skill) | Normalisation and one-letter tolerance; the skill chips are the safety net. |
| Live site not yet on the newest commit | UNVERIFIED until the owner confirms Render redeployed `main`. |
| Saved jobs lost when browser data is cleared or on another device | Stated on screen; no accounts by design. |
| Speech recognition or Kannada/Hindi voices missing on a phone | Typing always works; text is always shown; Kannada speech and read-aloud on a phone UNVERIFIED. |
| Kannada/Hindi wording wrong | All strings listed in docs/TEMPLATES_TO_REVIEW.md for a native speaker (not reviewed yet). |
| Stale SQLite file after the seed changes | Seeding skips a filled table: delete `backend/db/kelasa_mitra.db` with the backend stopped. |
| Tool package out of date after a backend change | Rebuild and re-import; a test fails until rebuilt. |
| Agent wording drifts from the tools | Strict instructions; cards never depend on it; the panel hides repeated questions. |

---

## 16. Dependencies (from requirements.txt and package.json)

Backend (Python 3.11): fastapi 0.115.5, uvicorn[standard] 0.32.1, pydantic 2.10.3,
sqlalchemy 2.1.8, langdetect 1.0.9, python-dotenv 1.0.1, httpx 0.27.2, groq ≥ 0.9.0,
pytest 8.3.4, pytest-asyncio 0.24.0. Orchestrate tools: ibm-watsonx-orchestrate 2.19.1,
pydantic 2.14.3.

Frontend: react ^19.3.1, vite ^8.3.6, tailwindcss ^4.3.5 (via `@tailwindcss/vite`, no config
file), framer-motion ^14.10.1, zustand ^5.1.0, typescript ~7.0.2, vitest ^5.1.0, oxlint ^1.90.0.
