# ಕೆಲಸ ಮಿತ್ರ — Kelasa Mitra

**Built by:** Mridul Paradkar, Smt. Indira Gandhi College of Engineering, 3rd year, CSE (AI & ML)
**Entry:** IBM Bobathon: Build for Bengaluru · Student category · Theme: *More Opportunity, Greater Together* · Solo

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
time and cost), and so does knowing which single skill would open more and better-paid work.

---

## 2. The prototype

### What works today

- **Speak or type** in Kannada, Hindi or English. The language picker sets the speech language
  (`kn-IN`, `hi-IN`, `en-IN`) and the reply language; changing it while the mic is on restarts
  recognition in the new language. Words appear live as the browser hears them; a decorative
  waveform shows that the mic is on.
- **Profile extraction** (skills, years of experience, area, spoken languages) by deterministic
  rules that handle common Kannada and Hindi word endings. Groq can be switched on as an optional
  extractor; its output is validated and it never supplies numbers.
- **Follow-up question** when the area or skills are missing, with 8 tappable area chips
  (Whitefield, Koramangala, Jayanagar, Electronic City, Yelahanka, Marathahalli, HSR Layout,
  Hoodi). Naming only the city ("Bangalore") counts as no area and gets its own question.
- **Ranked job cards** with a match score, approximate distance (`~2.4 km`), pay, matched and
  missing skills, and a template-written reason in the worker's language. Swipe, buttons or
  arrow keys to skip or save.
- **Skill gap**: up to 3 skills that would unlock the most nearby jobs, with the job count, the
  pay difference computed from the sample jobs, and a short learning path that can be ticked off.
- **IBM watsonx Orchestrate agent panel**: the same sentence is sent to the
  `kelasa_mitra_agent`, which calls our three tools; its reply is shown above the cards. If the
  agent is not configured or does not answer, a banner says the built-in rules answered; the
  cards always come from the deterministic endpoints.
- **Read-aloud** of the follow-up question and the top match reason (browser speech synthesis,
  mute toggle), a **switch-language nudge** when the words are clearly in another language,
  **optional save on this device** with **Delete my data**, and a phone-width layout that
  respects `prefers-reduced-motion` with 48 px touch targets.

### Run it on Windows

You need Python 3.11 and Node.js. There are two Pythons in this project, used for different
things:

| Step | Which Python |
|---|---|
| Backend server, tests, `backend/scripts/*`, `orchestrate/build_kelasa_tools.py` | Normal Python with `backend/requirements.txt` installed (not the Orchestrate venv) |
| `orchestrate ...` CLI commands (import tools and agent) | `orchestrate\.venv` with `ibm-watsonx-orchestrate==2.19.1` |

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
backend on port 8000, so no CORS setting is needed. To test on a phone, a Cloudflare quick
tunnel to port 5173 works (`*.trycloudflare.com` is allowed in `vite.config.ts`); the tunnel URL
is public while it runs. Without speech recognition (e.g. Firefox), type instead.

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
```

Measured on 2026-11-09: **573 backend tests passed**, **191 frontend tests passed** (20 files),
`tsc` exit 0, build OK (JS 440.72 kB, 140.73 kB gzip). Use `-p tsconfig.app.json`: plain
`tsc --noEmit` checks nothing here because the root `tsconfig.json` has `files: []`.

### Environment variables (`backend/.env`, see `.env.example`)

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

If any `ORCHESTRATE_*` value is missing or not https, the agent stays off and the app uses the
rules. Never commit `.env`.

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
save-on-device, the design upgrade, language handling, 36 extra demo jobs, a security and
reliability pass, and a favicon. The owner reviewed, tested and committed every change.

Full dated timeline, including Bob's mistakes and how they were caught: [BOB_STORY.md](BOB_STORY.md).

---

## 4. The impact

**One measurable outcome, with its limits.** On a 15-input benchmark (5 each in English, Kannada
and Hindi), **42 of the 45 top-3 job suggestions require a skill the worker mentioned**
(English 15/15, Kannada 15/15, Hindi 12/15), skill recall is 97%, and the whole pipeline behind
one message (extraction, ranking, skill gap) takes a median of **17.8 ms** on one laptop
([docs/eval_results.md](docs/eval_results.md)).

What that number does **not** show:

- the 15 inputs are synthetic, written by an AI tool, with no real workers;
- the expected labels were drafted by the same tool that built the extractor and can see its
  synonym list, and all 15 are still marked "DRAFT, owner to review"; the Kannada and Hindi
  inputs have not been reviewed by a native speaker; the score is likely optimistic;
- timing is rules only (no Groq, no network, no agent round trip, which was not measured);
- it is a prototype benchmark, **not a field study**; no time saved against a job portal form
  has been measured.

The skill-gap pay differences (e.g. a Whitefield cook is told food-safety training could pay about
₹4,283 more a month) are computed from the sample jobs, whose pay ranges were designed for the
demo; they are not market data.

---

## 5. IBM products

| Product | What it did here | Verified | Not verified |
|---|---|---|---|
| **IBM Bob** | Planning and the first build (Phases 1–2, Groq swap, audit, first docs, Orchestrate ADK install) on 2026-11-07, until the 50 trial Bobcoins ran out. | Bob's outputs in `docs/bob/`, baseline commit `a8117a6`. | Bob's own statements in those files (e.g. test results) were not re-run at the time; see BOB_STORY.md for the ones later found wrong. |
| **IBM watsonx Orchestrate** | The agent layer: `kelasa_mitra_agent` (`orchestrate/agents/kelasa_agent.yaml`) calls three Python tools, `extract_profile`, `find_matches` and `skill_gap` (`orchestrate/kelasa_tools/`). The app asks it through `POST /api/agent/chat`, which keeps the API key on the server. | 2026-11-09, by the owner: the console trace showed `extract_profile`, `find_matches` and `skill_gap` called in order for "I cook, 2 years, I live in Whitefield"; `agent_warmup.py` got HTTP 200 replies; the app's agent panel showed the tools' text. | Whether the agent's final wording always stays in the picker language; agent response time; why it once repeated an already answered question (the panel now hides such replies); the trial end date. |

---

## 6. Limitations

- **Synthetic data only.** All 130 jobs and their employers are invented (`is_synthetic: true`,
  "Sample data" label on every card). 36 jobs were added on 2026-11-09 so that every area chip
  and the 8 most common skills in the sample inputs have a matching job within 5 km: demo
  coverage, not real supply.
- **No directions or contact.** There is no real workplace or employer to contact or navigate to.
- **English in places.** Job titles, employer and area names, learning-path steps, and "years"
  and language names on the profile card stay in English in Kannada and Hindi.
- **Kannada and Hindi text is not reviewed** by a native speaker
  ([docs/TEMPLATES_TO_REVIEW.md](docs/TEMPLATES_TO_REVIEW.md)).
- **Speech.** Chrome's Web Speech API sends the audio to the browser vendor's speech service to
  turn it into text. Our app never receives or stores audio, only the text, but Chrome does
  process the audio. Speech recognition and read-aloud in Kannada and Hindi have **not** been
  tested on a real phone; voice availability depends on the device. Firefox has no speech
  recognition; typing always works.
- **Skill suggestions are data-driven**, counting which skills unlock the most nearby sample
  jobs; they are not tailored to a worker's trade, so a cook may be shown an unrelated skill.
- **Learning paths** were hand-written; weeks and costs are rough estimates with no source
  ([docs/learning_paths_changes.md](docs/learning_paths_changes.md)).
- **Distances are approximate**: job coordinates are area centres with up to about 1.2 km of
  random offset.
- **Groq quality is unmeasured**: the provider comparison ran without a key, so it compares the
  rules with themselves ([docs/provider_comparison.md](docs/provider_comparison.md)).
- **Not a PWA**: there is no manifest or service worker. No employer view.

---

## 7. Privacy

- **No accounts, by design.** No login or sign-up: the users are workers who should not need an
  email or password, nothing about them is kept on the server, and the contest asks for no
  personal data.
- **Nothing is stored server-side.** Each request is computed and forgotten. The profile is sent
  to our backend to find jobs; the backend does not write it anywhere.
- **Optional save on this device.** Off by default. If ticked, only the profile (skills,
  experience, area, languages, with the worker's words blanked) is kept in this browser's
  localStorage. **Delete my data** removes it and clears the visit.
- **No audio** reaches or is stored by our app (see Speech above). When `GROQ_API_KEY` is set,
  the typed or spoken text is sent to Groq for extraction.
- **No personal data** is asked for: no phone number, ID, photo or exact address; areas are
  neighbourhood names. No children's or biometric data.
- **Security**: CORS allows only the local dev server or configured origins, input text is
  limited to 2000 characters, and Orchestrate URLs must be https.

---

## Credits

Built by a solo student for IBM Bobathon: Build for Bengaluru 2026. **IBM Bob** produced the plan
and the first build (2026-11-07); **Claude Code** (Anthropic), a second AI coding tool, was used
for the rest after Bob's trial credits ran out. Neither tool wrote every line; the owner directed,
reviewed, tested and committed all of it. Project plan: [PLAN.md](PLAN.md). Submission checklist:
[docs/SUBMISSION_CHECKLIST.md](docs/SUBMISSION_CHECKLIST.md).
