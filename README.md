# ಕೆಲಸ ಮಿತ್ರ — Kelasa Mitra

**Built by:** Mridul Paradkar, Smt. Indira Gandhi College of Engineering, 3rd year, CSE (AI & ML)
**Entry:** IBM Bobathon: Build for Bengaluru · Student category · Theme: *More Opportunity, Greater Together* · Solo
**Live demo:** https://kelasa-mitra.onrender.com/ (free hosting, so the first load can take about a minute to wake up; sample data only, please do not enter personal details)

*Kelasa Mitra* means "work friend" in Kannada. A blue-collar or gig worker in Bengaluru speaks or
types one sentence about their work in Kannada, Hindi or English, and gets nearby jobs with a
reason for each match, plus the one skill that would open the most new jobs near them. The
prompts, match reasons and skill suggestions are in their own language; job titles and
employer names stay in English. All jobs are synthetic sample data.

## Why I built this

A friend of my uncle moved to Hyderabad for work. He was a good driver, but he and his family knew only Marathi and Hindi, most people around him spoke neither, and he was not comfortable in English. He had to ask people here and there just to find a job, and it took a long time. He did eventually get one, but he struggled far more than his skills should have made necessary. His problem was language, not ability.

Many people who move to a new city face the same thing: the person is skilled, but the job portals, forms and instructions are in a language they cannot comfortably use. Bengaluru draws workers from many places, so I built Kelasa Mitra for it. A person can just say what work they do, in Kannada, Hindi or English, and see jobs near them, with the reason each one fits explained in that same language. It is a prototype and it uses sample data.

---

## 1. The problem

**Who.** Hotel and kitchen staff, drivers and delivery riders, security guards, tailors,
domestic workers and other blue-collar workers in Bengaluru, many of whom are more comfortable
speaking Kannada or Hindi than filling in English forms.

**What needs to improve.** Most job portals assume English literacy, typing on a form, and the
patience to search by category. A worker who can say "I cook, 2 years, I live in Whitefield" in
their own language should be able to find work near home without that. Distance matters (travel
time and cost), and so does knowing which skill would open more and better-paid work.

---

## 2. The prototype

### What works today

- **Language first.** The app opens with a short splash (the Kannada letter ಕ mark and "Kelasa
  Mitra", about 1.2 s, then a fade; a tap or key skips it, reduced motion starts at the cards).
  Then three large cards, **English, हिन्दी, ಕನ್ನಡ**, turn teal-green under the mouse, a finger
  or keyboard focus; releasing chooses. The mic screen then shows a **"Language: …" chip** (tap
  it to choose again, typed text is kept) and **"Listening in: …"** while the mic is on.
  *Why:* the browser's speech recognition must be told the language before it listens and cannot
  detect it; Hindi or Kannada spoken under the English setting gives no words. Typed text can
  trigger a switch-language suggestion, speech cannot. No automatic language detection and no
  audio recording were added, because a service that detects the language would have to send
  the worker's voice to a third party.
- **Speak or type** in Kannada, Hindi or English (`kn-IN`, `hi-IN`, `en-IN`). Words appear live
  as the browser hears them; a decorative waveform shows the mic is on. Android Chrome's
  repeated partial results no longer duplicate words (found on a real phone), and when the mic
  is stopped the search waits for the browser's final text (at most 1.5 s) and runs on exactly
  what the box shows. If nothing was heard, a hint offers the other two languages as buttons.
- **Profile extraction** (skills, years of experience, area, spoken languages) by deterministic
  rules that handle common Kannada and Hindi word endings. Groq can be switched on as an optional
  extractor; its output is validated and it never supplies numbers.
- **Spelling variants.** Speech engines write English loanwords in Devanagari and Kannada script
  in different ways; on a real phone one vowel sign (इलेक्ट्रिशियन vs इलेक्ट्रीशियन) stopped
  "electrician" from matching. Matching now normalises both the text and the synonym list
  (Unicode NFC, zero-width joiners removed, nukta dropped, chandrabindu and half-nasals folded to
  anusvara, long and short vowels folded); 25 plausible Hindi/Kannada spellings were added for 10
  loanword skills (marked unverified in `skills.json`); and for those 10 skills a Devanagari or
  Kannada word of 6 or more letters may differ by one letter, only when exactly one skill is
  that close. What the worker sees is never changed.
- **41 skills only, on purpose.** Work outside the list (for example "I am a teacher") is not
  recognised; the app says "I did not recognise that kind of work yet" in the chosen language and
  shows 10 tappable skill chips. "farmer" and "shopkeeper" (and the Hindi/Kannada words for
  farmer) were removed as synonyms because owners of a farm or shop are not looking for these
  jobs; a test checks 67 such sentences match nothing.
- **Follow-up question** when the area or skills are missing, with 8 tappable area chips
  (Whitefield, Koramangala, Jayanagar, Electronic City, Yelahanka, Marathahalli, HSR Layout,
  Hoodi). Naming only the city ("Bangalore") counts as no area and gets its own question.
- **Ranked job cards** with a match score, approximate distance (`~2.4 km`), pay, matched and
  missing skills, and a template-written reason in the worker's language. Swipe, buttons or
  arrow keys to skip or save.
- **Skill gap**: up to 3 skills that would unlock the most nearby jobs, with the job count, the
  pay difference computed from the sample jobs, and a short learning path that can be ticked off.
- **Numbers never come from an LLM.** Match reasons, skill-gap text and follow-up questions are
  templates in en/kn/hi; scores, distances, pay, counts and uplift are computed from the data.
- **IBM watsonx Orchestrate agent panel**: the same sentence is sent to `kelasa_mitra_agent`,
  which calls our three tools; its reply is shown above the cards. If the agent is not configured,
  fails or takes longer than 20 s, a banner says the built-in rules answered; the cards always
  come from the deterministic endpoints. While the "not recognised" card is on screen the agent's
  text is not shown, so the rules' message is not contradicted.
- **Read-aloud** of the follow-up question and the top match reason (browser speech synthesis,
  mute toggle), a **switch-language suggestion** when typed words are clearly in another
  language (never automatic), **optional save on this device** with **Delete my data**, a
  **public demo note** in en/kn/hi asking not to enter personal details, and a phone-width layout
  that respects `prefers-reduced-motion` with 48 px touch targets.

### Run it on Windows

You need Python 3.11 and Node.js. There are two Pythons in this project, used for different
things:

| Step | Which Python |
|---|---|
| Backend server, tests, `backend/scripts/*`, `orchestrate/build_kelasa_tools.py` | Normal Python with `backend/requirements.txt` installed (not the Orchestrate venv) |
| `orchestrate ...` CLI commands only (import tools and agent) | `orchestrate\.venv` with `ibm-watsonx-orchestrate==2.19.1` |

If a prompt starts with `(.venv)`, run `deactivate` (or open a new terminal) before starting the
backend: the Orchestrate venv has no FastAPI or uvicorn.

**Terminal 1, backend** (from the repo root):

```bash
cd backend
python -m pip install -r requirements.txt
copy .env.example .env
python -m uvicorn main:app --reload --port 8000
```

Wait for `Application startup complete.` The first start seeds `backend/db/kelasa_mitra.db`
with the 130 sample jobs. Seeding is skipped when the table already has rows, so after the
sample jobs change, stop the backend and delete the old database first:
`del db\kelasa_mitra.db`.

**Terminal 2, frontend:**

```bash
cd frontend
npm install
npm run dev
```

Open `http://localhost:5173` (use `localhost`, not `127.0.0.1`). Vite proxies `/api` to the
backend on port 8000, so no CORS setting is needed. Browsers allow the microphone only on
`https` or `localhost`. To test on a phone, a Cloudflare quick tunnel to port 5173 works
(`*.trycloudflare.com` is allowed in `vite.config.ts`); the tunnel URL is public while it runs.
Without speech recognition (e.g. Firefox), type instead.

### Run it with Docker

One container builds the frontend and serves it from FastAPI, together with the API:

```bash
docker build -t kelasa-mitra .
docker run --rm -p 8080:8000 kelasa-mitra
```

Open `http://localhost:8080` (health check: `http://localhost:8080/health`). The server inside
listens on `0.0.0.0:8000`; that is a listening address, not one to open in a browser. With no
variables the container uses the rules only and the agent panel shows the offline banner. To turn
the agent on, pass the variables from a file:

```bash
docker run --rm -p 8080:8000 --env-file backend\.env kelasa-mitra
```

**Gotcha:** `--env-file` takes values literally, so write `NAME=value` with **no quotes** around
the value, or the quotes become part of it. The image runs as a non-root user (UID 1000), makes
`backend/db` writable for the SQLite file, has a `/health` check, and never contains `.env`
(excluded by `.dockerignore`). The owner built and ran the image locally both without keys
(rules) and with `--env-file` (agent on).

### Live demo

- **URL:** UNVERIFIED (the owner has not added it here yet). TODO: owner to add the https address.
- **What runs there:** the Docker image above on Render's free web service, built from branch
  `main`. `ORCHESTRATE_INSTANCE_URL`, `ORCHESTRATE_API_KEY` and `ORCHESTRATE_AGENT_ID` are set in
  Render's Environment settings (a separate key from the owner's laptop key, to be deleted after
  the contest); `GROQ_API_KEY` is not set, so extraction is rules only. On the evening of
  2026-11-09 the live site showed the agent panel with the tools' text.
- **Cold start:** the free service sleeps after about 15 minutes idle; the first request can take
  about a minute. The agent's first call after a pause is slower too; after about 20 s the app
  shows the "agent offline" banner and answers with the rules.
- **Banner meaning:** "agent offline" means the cards came from the built-in rules only; the
  cards are the same either way.
- **Rate limits** per visitor IP: 30 requests a minute to extract-profile, 10 a minute to the
  agent; over that, a short message in the chosen language. Kept in memory, so a restart resets it.
- **Sample data only.** Every job is invented. Please do not enter personal details (name, phone
  number, address); the app shows the same note.

### Orchestrate agent (optional for running, required for the contest demo)

```bash
python -m venv orchestrate\.venv
orchestrate\.venv\Scripts\python -m pip install ibm-watsonx-orchestrate==2.19.1
```

Rebuild the tool package after any change to the backend logic or sample jobs (normal Python):

```bash
python backend\scripts\export_jobs_snapshot.py
python orchestrate\build_kelasa_tools.py
```

Then, with the venv active (`orchestrate\.venv\Scripts\Activate.ps1`), add your environment
once with `orchestrate env add -n <name> -u <instance URL>` and `orchestrate env activate <name>`,
and import:

```bash
orchestrate tools import -k python -p orchestrate\kelasa_tools -f orchestrate\kelasa_tools\kelasa_mitra_tools.py -r orchestrate\kelasa_tools\requirements.txt
orchestrate agents import -f orchestrate\agents\kelasa_agent.yaml
```

Put the `ORCHESTRATE_*` values in `backend\.env`, then check the agent with normal Python
(`deactivate` first). The first tool call after an import can take over a minute, so run it twice:

```bash
python backend\scripts\agent_warmup.py
```

### Tests

```bash
cd backend
python -m pytest tests/ -q
```

```bash
cd frontend
npm test
npx tsc --noEmit -p tsconfig.app.json
npm run build
npx oxlint src
```

Measured on 2026-11-09 (many tests are parametrised, so these are tests run, not separate
behaviours): **779 backend tests run, all passed** (17 test files); **272 frontend tests run,
all passed** (25 test files); `tsc` exit 0; `oxlint` exit 0; build OK (JS 454.67 kB, 144.96 kB
gzip; CSS 24.97 kB, 6.08 kB gzip). Use `-p tsconfig.app.json`: plain `tsc --noEmit` checks
nothing here because the root `tsconfig.json` has `files: []`.

### Environment variables (`backend/.env`, see `.env.example`; names only, never commit values)

| Variable | Needed | Purpose |
|---|---|---|
| `GROQ_API_KEY` | No | Turns on Groq extraction. Empty = rules only, no network. |
| `GROQ_MODEL` | No | Groq model id (default `llama-3.3-70b-versatile`). |
| `ORCHESTRATE_INSTANCE_URL` | For the agent | Orchestrate instance URL; must be `https://`. |
| `ORCHESTRATE_API_KEY` | For the agent | Kept on the server; never sent to the browser. |
| `ORCHESTRATE_AGENT_ID` | For the agent | From `orchestrate agents list -k native`. |
| `ORCHESTRATE_AUTH_TYPE` | No | `ibm_iam`, `mcsp`, `mcsp_v1`, `mcsp_v2`; empty = inferred like the ADK. |
| `ORCHESTRATE_IAM_URL` | No | Token service base URL; must be `https://` if set. |
| `CORS_ALLOWED_ORIGINS` | No | Extra origins allowed to call the API directly; `*` is ignored. |
| `PORT` | No | Port the Docker image listens on (default 8000). |

If any required `ORCHESTRATE_*` value is missing or not https, the agent stays off and the app
uses the rules. Never commit `.env`.

---

## 3. The Bob story

IBM Bob planned and built the first version on 2026-11-07: the plan, Phases 1 and 2 (profile
extraction, 80 sample jobs, ranking, swipeable cards), the switch from Gemini to watsonx.ai and
then to Groq, an audit, a first rewrite of these docs and the Orchestrate ADK install. That
evening the free trial's 50 Bobcoins ran out. Bob's work is preserved in commit `a8117a6`
("Bob baseline before Claude Code") and in [`docs/bob/`](docs/bob/), because Bob's panel keeps
no history.

The rest was built with **Claude Code**, a second AI coding tool: bug fixes, Phase 3, the
Orchestrate tool package and agent, the evaluation, accessibility fixes, read-aloud, area chips,
save-on-device, the design upgrade, language handling, 50 extra demo jobs, a security and
reliability pass, rate limits, the language-first welcome flow and app mark, Android speech
fixes, spelling normalisation, and the Docker deployment. The owner reviewed, tested and
committed every change.

Full dated timeline, including Bob's mistakes and how they were caught: [BOB_STORY.md](BOB_STORY.md).

---

## 4. The impact

**One measurable outcome, with its limits.** On a 15-input benchmark (5 each in English, Kannada
and Hindi), **42 of the 45 top-3 job suggestions require a skill the worker mentioned**
(English 15/15, Kannada 15/15, Hindi 12/15), skill recall is 97%, and the whole pipeline behind
one message (extraction, ranking, skill gap) takes a median of **17.8 ms** on one laptop
([docs/eval_results.md](docs/eval_results.md); a rerun on 2026-11-09 after the spelling changes
gave the same accuracy and 18.2 ms).

What that number does **not** show:

- the 15 inputs are synthetic, written by an AI tool, with no real workers;
- the expected labels were drafted by the same tool that built the extractor and can see its
  synonym list, and all 15 are still marked "DRAFT, owner to review"; the Kannada and Hindi
  inputs have not been reviewed by a native speaker; the score is likely optimistic;
- timing is rules only (no Groq, no network, no agent round trip, which was not measured);
- it is a prototype benchmark, **not a field study**; no time saved against a job portal form
  has been measured;
- the jobs are 130 synthetic jobs whose pay and coverage were designed to make the demo
  meaningful (36 were added for demo coverage).

The skill-gap pay differences (e.g. a Whitefield cook is told food-safety training could pay about
₹4,283 more a month) are computed from those sample jobs; they are not market data.

---

## 5. IBM products

| Product | What it did here | Verified | Not verified |
|---|---|---|---|
| **IBM Bob** | Planning and the first build (Phases 1–2, Groq swap, audit, first docs, Orchestrate ADK install) on 2026-11-07, until the 50 trial Bobcoins ran out. | Bob's outputs in `docs/bob/`, baseline commit `a8117a6`. | Bob's own statements in those files (e.g. test results) were not re-run at the time; see BOB_STORY.md for the ones later found wrong. |
| **IBM watsonx Orchestrate** | The agent layer: `kelasa_mitra_agent` (`orchestrate/agents/kelasa_agent.yaml`) calls three Python tools, `extract_profile`, `find_matches` and `skill_gap` (`orchestrate/kelasa_tools/`). The app asks it through `POST /api/agent/chat`, which keeps the API key on the server. | 2026-11-09, by the owner: the console trace showed `extract_profile`, `find_matches` and `skill_gap` called in order for "I cook, 2 years, I live in Whitefield"; `agent_warmup.py` got HTTP 200 replies; the app's agent panel showed the tools' text, locally and on the live site that evening. The tool package was re-imported several times since and the agent kept answering. | Whether the console trace shows runs coming from the live site (UNVERIFIED); whether the agent's final wording always stays in the picker language; agent response time; the exact trial end date (about 2026-12-08, owner to confirm). |

---

## 6. Limitations

- **The worker chooses the language first.** Speech recognition runs in the browser and must be
  told the language in advance; it cannot detect it, and the app does not try.
- **Speech goes to Chrome's speech service.** Chrome's Web Speech API sends the audio to the
  browser vendor's speech service to turn it into text. Our app never receives or stores audio,
  only the text. Firefox has no speech recognition; typing always works.
- **Phone testing is partial.** On an Android phone in Chrome over http (with a Chrome flag), the
  owner saw the welcome screen, finger tracing across the cards, the language chip and the
  switch-language suggestion work, Hindi speech produce Devanagari text, and English speech work.
  Over the live https link, English, Hindi and Kannada speech and read-aloud are **NOT VERIFIED**.
  Kannada speech and read-aloud on a phone are not verified at all; voice availability depends
  on the device.
- **Loanword spelling varies.** Speech engines spell English loanwords in Devanagari and Kannada
  in different ways; matching normalises them and tolerates one letter, but spellings not yet
  seen can still miss. The skill chips are the safety net.
- **Only 41 skills.** Other work is deliberately not recognised.
- **Synthetic data only.** All 130 jobs and their employers are invented (`is_synthetic: true`,
  "Sample data" label on every card). 36 jobs were added on 2026-11-09 so that every area chip
  and the 8 most common skills in the sample inputs have a matching job within 5 km: demo
  coverage, not real supply. Pay ranges were designed for the demo.
- **No directions or contact.** There is no real workplace or employer to contact or navigate to.
- **English in places.** Job titles, employer and area names, learning-path steps, and "years"
  and language names on the profile card stay in English in Kannada and Hindi.
- **Kannada and Hindi text is not reviewed** by a native speaker
  ([docs/TEMPLATES_TO_REVIEW.md](docs/TEMPLATES_TO_REVIEW.md)).
- **Skill suggestions are data-driven**, counting which skills unlock the most nearby sample
  jobs; they are not tailored to a worker's trade, so a cook may be shown an unrelated skill.
- **Learning paths** were hand-written; weeks and costs are rough estimates with no source
  ([docs/learning_paths_changes.md](docs/learning_paths_changes.md)).
- **Distances are approximate**: job coordinates are area centres with up to about 1.2 km of
  random offset.
- **Groq quality is unmeasured**: the provider comparison ran without a key, so it compares the
  rules with themselves ([docs/provider_comparison.md](docs/provider_comparison.md)).
- **The app mark at 16 px** (browser tab) is only roughly legible.
- **The live agent depends on the Orchestrate trial**, which ends around 2026-12-08 (owner to
  confirm); after that the app answers with the rules and the banner.
- **Not a PWA**: there is no manifest or service worker. No employer view.

---

## 7. Privacy and security

- **No accounts, by design.** No login or sign-up: the users are workers who should not need an
  email or password, nothing about them is kept on the server, and the contest asks for no
  personal data.
- **Nothing is stored server-side.** Each request is computed and forgotten. The profile is sent
  to our backend to find jobs; the backend does not write it anywhere.
- **Optional save on this device.** Off by default. If ticked, only the profile (skills,
  experience, area, languages, with the worker's words blanked) is kept in this browser's
  localStorage. **Delete my data** removes it and clears the visit.
- **No audio** reaches or is stored by our app (see Limitations). When `GROQ_API_KEY` is set,
  the typed or spoken text is sent to Groq for extraction; on the live demo it is not set.
- **No personal data** is asked for: no phone number, ID, photo or exact address; areas are
  neighbourhood names. No children's or biometric data.
- **Security**: CORS allows only the local dev server or configured origins (never `*`); input
  text is limited to 2000 characters; two experience regexes with catastrophic backtracking were
  made linear; Orchestrate URLs must be https; per-IP rate limits as above; keys stay on the
  server and are passed to the container as environment variables, never baked into the image.

---

## Licence and credits

The code is under the MIT License ([LICENSE](LICENSE)). The ಕ in the app mark is an outline from
Noto Sans Kannada (SIL Open Font License 1.1), credited in [NOTICE](NOTICE) with
[OFL.txt](OFL.txt); the favicon and the in-app mark use the same path.

Built by a solo student for IBM Bobathon: Build for Bengaluru 2026. **IBM Bob** produced the plan
and the first build (2026-11-07); **Claude Code** (Anthropic), a second AI coding tool, was used
for the rest after Bob's trial credits ran out. Neither tool wrote every line; the owner directed,
reviewed, tested and committed all of it. Project plan: [PLAN.md](PLAN.md). Submission checklist:
[docs/SUBMISSION_CHECKLIST.md](docs/SUBMISSION_CHECKLIST.md).
