# Submission checklist

State on 2026-11-15. Each row says what was checked and what was not.

**Deadline:** 14 November 2026, 11:59 p.m. IST (as shown on the IBM submission page).
**Plan:** the plan was to submit on 13 November; submit today, well before 11:59 p.m. IST.

## The four items the README must cover

| Item | Where | Status |
|---|---|---|
| The problem | [README.md §1](../README.md#1-the-problem) | Done |
| The prototype (what works, how to run it on Windows and with Docker, live demo, tests, env variables) | [README.md §2](../README.md#2-the-prototype), [PLAN.md](../PLAN.md) | Done; live URL in the README |
| The Bob story | [README.md §3](../README.md#3-the-bob-story), [BOB_STORY.md](../BOB_STORY.md), [docs/bob/](bob/) | Done; two Bob panel screenshots added; demo video not linked yet |
| The impact | [README.md §4](../README.md#4-the-impact), [docs/eval_results.md](eval_results.md) | Done, with limits stated: the benchmark and an informal early user test with three people |

## Judging criteria and where each is shown

The official criteria wording is not in this repo; the names below are a summary, not the
official wording.

| Criterion (summary) | Shown in |
|---|---|
| Use of IBM Bob | BOB_STORY.md, docs/bob/, commit `a8117a6`, `.bob/` |
| Use of IBM watsonx Orchestrate | `orchestrate/` (tool package, build script, agent YAML), `backend/routers/agent.py`, `backend/tools/orchestrate_client.py`, PLAN.md §10, the agent panel in the app (locally and on the live site), the console trace (owner's demo) |
| Problem fit and impact for Bengaluru | README §1 and §4 (benchmark, early user test), docs/eval_results.md, PLAN.md §9 |
| Working prototype and technical quality | README §2 (tech stack: React 19.3.1, FastAPI 0.115.5, 5 REST endpoints), 779 backend + 300 frontend tests run (2026-11-15), Dockerfile, `docs/a11y_review.md`, sonar settings |
| Design and accessibility | Language-first welcome flow, saved jobs list with keyboard and trace states, phone-width layout, 48 px targets, `prefers-reduced-motion`, en/kn/hi UI, docs/a11y_review.md |
| Honesty about limits | README §5 Limitations, PLAN.md §15 Risks |

## Contest rule points (rule numbers are not given here; the official rules are not in this repo)

| Point | Status in the repo |
|---|---|
| No API keys or secrets in the repo | `.env` is git-ignored and was never committed; a pattern search of the git history (Groq `gsk_`, AWS, private keys, long `API_KEY=` values) found nothing on 2026-11-09. Docs use variable names only. Test files use only fake values. The Docker image excludes `.env`; the live site gets its values from Render's Environment settings. |
| Synthetic data only | All 130 jobs are invented and marked `is_synthetic`; every card shows "Sample data"; a test rejects known real company names. |
| No biometric or children's data | None collected. The app never receives or stores audio; the browser's speech service processes it (see README Limitations). |
| No personal data | No accounts, no phone numbers, IDs, photos or addresses; nothing stored server-side; optional on-device profile and saved jobs (card fields only) with Delete; the early user test recorded no names, photos, audio or personal details; a public demo note asks visitors not to enter personal details. |
| No confidential data in AI tools | Only synthetic data and project code were given to IBM Bob, Claude Code, Groq (only if a key is set; not set on the live site) and Orchestrate. This rests on the owner's own statement and cannot be checked from the repo. |

## Status of each item

| Item | Status |
|---|---|
| Licence | Done: MIT ([LICENSE](../LICENSE)). |
| NOTICE | Done: [NOTICE](../NOTICE) credits the ಕ outline from Noto Sans Kannada (SIL OFL 1.1), with [OFL.txt](../OFL.txt). |
| Repository visibility for judges | Public: GitHub reported the repository `mridulcodes15/kelasa-mitra` as public on 2026-11-15, with `main` at the latest local commit. |
| Live URL | https://kelasa-mitra.onrender.com/ (Render free web service, Dockerfile, branch `main`), in the README top block and "Live demo" section. Checked on 2026-11-15: it serves the saved-jobs build and `/health` answers `ok`; the first load after idle took about 22 s. |
| Live site checks | The owner saw the agent panel with the tools' text on 2026-11-09 evening. Speech and read-aloud over the live https link have not been tested by the owner on a phone, and the Orchestrate console was not checked for runs coming from the live site. |
| Demo video | Not linked yet. The owner adds the link when the video exists (suggested place: README, directly under the "Live demo" line). |
| SonarCloud | GitHub shows a SonarCloud check on commits up to `44170dc` (2026-11-09) and none on any later commit, so the latest code has not been analysed by SonarCloud. Whether the app is suspended or disconnected cannot be seen from GitHub. |
| Earlier failed code-quality check | The SonarCloud quality gate failed on every analysed commit (`bb9dddf`, `43a35b2`, `a01f53e`, `5ff5924`, `44170dc`). On `43a35b2` it failed on duplication (18.9% on new code, 3% allowed) and on reliability and security ratings (C, A required). Commit `44170dc` fixed two regexes with catastrophic backtracking, capped input, restricted CORS, required https for Orchestrate and added `sonar-project.properties` / `.sonarcloud.properties` (duplication exclusions only, for the generated `orchestrate/kelasa_tools/` copy and the test folders); the duplication failure went away, but its gate still failed on reliability and security ratings (C, A required). The individual issues are only listed on SonarCloud and were not checked here. |
| Orchestrate trial end | About 29 days from 2026-11-09, so around 2026-12-08; the exact date has not been confirmed. After it ends the app answers with the rules and the banner. |
| Early user test | Three people in one building: a watchman and a domestic worker who spoke Hindi, and a garbage collector. All used the microphone. The two Hindi speakers were understood on the first try. The garbage collector first tried Marathi, which the app does not support, was told so, switched to Hindi and was then understood. Informal, not a study; device and browser not recorded; what the Marathi attempt produced in the text box was not recorded. README §4, PLAN.md §9. |
| Key hygiene | The Render key is separate from the laptop key: **delete it after the contest**, then remove the three `ORCHESTRATE_*` variables from Render. |

## Open items and their state

- **Live URL**: in the README (https://kelasa-mitra.onrender.com/).
- **Live site on the newest code**: checked on 2026-11-15 (serves the saved-jobs build).
- **Repository visibility**: public on GitHub (checked 2026-11-15).
- **Demo video**: no link is in the README or BOB_STORY.md yet; when it exists, it goes under the
  "Live demo" line in the README and in BOB_STORY.md's "Demo clip" section.
- **Bob panel screenshots**: two in `docs/bob/screenshots/`, shown in BOB_STORY.md.
- **Bob credits reply**: no reply is recorded in the repo.
- **Phone tests**: Hindi and English speech worked on an Android phone over http, and the three
  people in the early user test used the microphone in Hindi. Speech and read-aloud over the
  live https link, and Kannada speech and read-aloud on a phone, have not been tested; no record
  of them is in the repo.
- **Native-speaker review**: not recorded. `docs/TEMPLATES_TO_REVIEW.md` has no reviewer or date,
  and the 15 evaluation labels in `backend/tests/eval_samples.json` are still marked DRAFT.
- **Saved jobs on a phone**: tested in a desktop browser with mouse, keyboard and simulated touch;
  not tried with a real finger on a phone.
- **Agent language**: whether the agent's final wording always stays in the picker language has
  not been checked.
- **Before judging**: open the live site a few minutes early (cold start) and run
  `agent_warmup.py` twice.
- **After any data or logic change**: delete `backend/db/kelasa_mitra.db` with the backend
  stopped, then rebuild and re-import the tool package.
- **After the contest**: delete the Render Orchestrate key and remove the three `ORCHESTRATE_*`
  variables from Render.
- **`.bob/rules`** still says React 18 (installed: React 19.3.1); left as Bob wrote it.
