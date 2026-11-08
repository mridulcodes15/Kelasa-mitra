# Kelasa Mitra

Voice-first job and skill matcher for blue-collar and gig workers in Bengaluru
(en/kn/hi). Solo student entry for IBM Bobathon: Build for Bengaluru (theme: More
Opportunity, Greater Together). Deadline: 14 Nov 2026.

Derived from `.bob/rules`, updated to the current stack. IBM Bob built the baseline;
Claude Code is continuing it. Keep Bob's work: fix and finish, do not redo.

## Contest rules

- IBM Bob and IBM watsonx Orchestrate are both required and must be demonstrated.
  Orchestrate is never on a cut list.
- Nothing paid, no credit card.
- No personal data, no stored audio, no children's data, no government IDs.
- No keys in the repo. `.env` stays in `.gitignore`.
- Judges read the code and docs, so docs must never claim more than the code does.
- Other AI tools are allowed.

## Stack

- Backend: Python FastAPI, SQLite (SQLAlchemy Core).
- Frontend: React 19, Vite 8, Tailwind 4, Framer Motion 14, Zustand 5.
- Voice input: browser Web Speech API.
- Removed, do not reintroduce: Google ADK, Gemini, watsonx.ai.

## Core logic

- Deterministic: rule-based extraction, scoring, and template reasons in en/kn/hi.
- Numbers never come from an LLM.
- Groq is an optional runtime LLM behind `backend/tools/provider.py`. The rule-based
  fallback must always work with no key and no network.

## Data

- Synthetic only, always labelled "sample data".

## Design

- Mobile-first, warm teal/marigold/cream, 48px touch targets (`touch-target`),
  `prefers-reduced-motion` respected.

## Working rules

- Never read, print, log or commit `.env` or any key.
- Do not edit `README.md` or `PLAN.md` until the owner says "docs stage". When something
  in them is wrong or outdated, append one line to `DOCS_TODO.md`.
- Report only what was actually run or read. Do not trust earlier summaries; verify.
- If a command fails, paste the raw error and stop.
- Make small changes. No features beyond what the current stage asks for.
- Run pytest after each task and show raw output with the exit code.
- Never run a git command that writes (add, commit, push, branch, checkout, switch, merge,
  reset, stash, tag, rebase). Read-only git is fine. The owner controls all version control.
- At the end of each stage, leave changes uncommitted, give the changed-file list, a
  suggested one-line commit message and raw test output, then wait for "continue".
- The owner runs all `orchestrate` commands and logins. Never read the Orchestrate CLI
  config or credentials in the home folder. Do not edit `.claude/settings.local.json`.
- Do not call the app "integrated" with Orchestrate until the real agent has called our
  tools end to end.
- The project folder is inside OneDrive. On a file-lock error, stop and report it; do not
  work around it.

## Commands (Windows, from the repo root)

```bash
cd backend && python -m pytest tests/ -v
cd backend && python -m uvicorn main:app --reload --port 8000
cd frontend && npx tsc --noEmit -p tsconfig.app.json
cd frontend && npx vite build
cd frontend && npm run dev
```

Orchestrate tool package (rebuild after any change to the copied backend modules or data;
`tests/test_orchestrate_package.py` fails until you do):

```bash
python backend/scripts/export_jobs_snapshot.py
python orchestrate/build_kelasa_tools.py
python backend/scripts/gen_templates_review.py
python backend/scripts/agent_warmup.py
```

The owner runs every `orchestrate ...` import, deploy and remove command. Never edit files
under `orchestrate/kelasa_tools/` by hand; edit the backend or `orchestrate/kelasa_tools_src/`.

`seed_jobs()` skips seeding when the jobs table already has rows, so a stale
`backend/db/kelasa_mitra.db` persists until it is deleted with the backend stopped.
