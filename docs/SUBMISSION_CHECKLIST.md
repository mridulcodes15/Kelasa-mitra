# Submission checklist

State on 2026-11-09 (final docs pass). "UNVERIFIED" means nobody has checked it yet; do not
claim it.

**Deadline:** 14 November 2026, 11:59 p.m. IST (as shown on the IBM submission page).
**Plan:** submit on 13 November 2026, a day early.

## The four items the README must cover

| Item | Where | Status |
|---|---|---|
| The problem | [README.md §1](../README.md#1-the-problem) | Done |
| The prototype (what works, how to run it on Windows and with Docker, live demo, tests, env variables) | [README.md §2](../README.md#2-the-prototype), [PLAN.md](../PLAN.md) | Done; live URL still to add |
| The Bob story | [README.md §3](../README.md#3-the-bob-story), [BOB_STORY.md](../BOB_STORY.md), [docs/bob/](bob/) | Done; Bob screenshots and demo clip still to add |
| The impact | [README.md §4](../README.md#4-the-impact), [docs/eval_results.md](eval_results.md) | Done, with limits stated |

## Judging criteria and where each is shown

The official criteria wording is not in this repo, so the names below are UNVERIFIED; replace
them with the official wording.

| Criterion (UNVERIFIED name) | Shown in |
|---|---|
| Use of IBM Bob | BOB_STORY.md, docs/bob/, commit `a8117a6`, `.bob/` |
| Use of IBM watsonx Orchestrate | `orchestrate/` (tool package, build script, agent YAML), `backend/routers/agent.py`, `backend/tools/orchestrate_client.py`, PLAN.md §8, the agent panel in the app (locally and on the live site), the console trace (owner's demo) |
| Problem fit and impact for Bengaluru | README §1 and §4, docs/eval_results.md |
| Working prototype and technical quality | README §2, 779 backend + 272 frontend tests run (2026-11-09), Dockerfile, `docs/a11y_review.md`, sonar settings |
| Design and accessibility | Language-first welcome flow, phone-width layout, 48 px targets, `prefers-reduced-motion`, en/kn/hi UI, docs/a11y_review.md |
| Honesty about limits | README §6 Limitations, PLAN.md §13 Risks |

## Contest rule points (rule numbers 8.x UNVERIFIED; check against the official rules)

| Point | Status in the repo |
|---|---|
| No API keys or secrets in the repo | `.env` is git-ignored and was never committed; a pattern search of the git history (Groq `gsk_`, AWS, private keys, long `API_KEY=` values) found nothing on 2026-11-09. Docs use variable names only. Test files use only fake values. The Docker image excludes `.env`; the live site gets its values from Render's Environment settings. |
| Synthetic data only | All 130 jobs are invented and marked `is_synthetic`; every card shows "Sample data"; a test rejects known real company names. |
| No biometric or children's data | None collected. The app never receives or stores audio; the browser's speech service processes it (see README Limitations). |
| No personal data | No accounts, no phone numbers, IDs, photos or addresses; nothing stored server-side; optional on-device profile with Delete; a public demo note asks visitors not to enter personal details. |
| No confidential data in AI tools | Only synthetic data and project code were given to IBM Bob, Claude Code, Groq (only if a key is set; not set on the live site) and Orchestrate. UNVERIFIED beyond the owner's own statement. |

## Status of each item

| Item | Status |
|---|---|
| Licence | Done: MIT ([LICENSE](../LICENSE)). |
| NOTICE | Done: [NOTICE](../NOTICE) credits the ಕ outline from Noto Sans Kannada (SIL OFL 1.1), with [OFL.txt](../OFL.txt). |
| Repository visibility for judges | UNVERIFIED. TODO: owner to confirm public, or access granted. |
| Live URL | Deployed on Render's free web service (owner, 2026-11-09). The https address is not written in the docs yet: TODO: owner to add it to README "Live demo". |
| Live site checks | Agent panel with the tools' text seen on 2026-11-09 evening (owner). Phone speech over the live https link (English, Hindi, Kannada) and read-aloud: NOT VERIFIED. Console trace showing runs from the live site: not checked (UNVERIFIED). |
| Demo video | Not made yet (UNVERIFIED). TODO: record app + Orchestrate trace; add the link to README and BOB_STORY.md. |
| SonarCloud | TODO: owner to confirm whether the SonarCloud app is suspended or still connected. |
| Earlier failed code-quality check | Some earlier commits show a failed external code-quality check (the SonarCloud quality gate, judging by the settings files). Commit `44170dc` fixed the reported kinds of issue (two regexes with catastrophic backtracking, uncapped input, open CORS, non-https Orchestrate URLs, lint) and added `sonar-project.properties` / `.sonarcloud.properties`, which exclude only duplication checks for the generated `orchestrate/kelasa_tools/` copy and the test folders. Whether the gate passes on the latest commit: UNVERIFIED. |
| Orchestrate trial end | About 29 days from 2026-11-09, so around 2026-12-08; owner to confirm the exact date. After it ends the app answers with the rules and the banner. |
| Key hygiene | The Render key is separate from the laptop key: **delete it after the contest**, then remove the three `ORCHESTRATE_*` variables from Render. |

## Open items

- [ ] **Live URL** in README "Live demo" (owner).
- [ ] **Repo visibility**: make sure judges can open the repository.
- [ ] **Demo video**: record app + Orchestrate trace; add the link to README and BOB_STORY.md.
- [ ] **Bob panel screenshots**: add to `docs/bob/screenshots/`.
- [ ] **Bob credits reply**: no reply recorded. UNVERIFIED.
- [ ] **SonarCloud** app status (TODO: owner to confirm) and the quality gate on the latest commit (UNVERIFIED).
- [ ] **Phone mic test over https**: English, Hindi and Kannada speech and read-aloud on the live site. NOT VERIFIED. Kannada speech and read-aloud on a phone have not been tested at all.
- [ ] **Native-speaker review**: Kannada and Hindi strings in docs/TEMPLATES_TO_REVIEW.md and the 15 evaluation labels in backend/tests/eval_samples.json (still DRAFT).
- [ ] **Agent language**: whether the agent's final wording always stays in the picker language. UNVERIFIED.
- [ ] **Warm up before judging**: open the live site a few minutes early (cold start about a minute) and run `agent_warmup.py` twice.
- [ ] **Re-seed and re-import** after any further data or logic change: delete `backend/db/kelasa_mitra.db` with the backend stopped; rebuild and re-import the tool package.
- [ ] After the contest: delete the Render Orchestrate key.
- [ ] `.bob/rules` still says React 18 (installed: React 19.3.1). Left as Bob wrote it.
