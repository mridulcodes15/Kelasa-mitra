# Submission checklist

State on 2026-11-09. "UNVERIFIED" means nobody has checked it yet; do not claim it.

## The four items the README must cover

| Item | Where | Status |
|---|---|---|
| The problem | [README.md §1](../README.md#1-the-problem) | Done |
| The prototype (what works, how to run it on Windows, tests, env variables) | [README.md §2](../README.md#2-the-prototype), [PLAN.md](../PLAN.md) | Done |
| The Bob story | [README.md §3](../README.md#3-the-bob-story), [BOB_STORY.md](../BOB_STORY.md), [docs/bob/](bob/) | Done; Bob screenshots and demo clip still to add |
| The impact | [README.md §4](../README.md#4-the-impact), [docs/eval_results.md](eval_results.md) | Done, with limits stated |

## Judging criteria and where each is shown

The official criteria wording is not in this repo, so the names below are UNVERIFIED; replace
them with the official wording.

| Criterion (UNVERIFIED name) | Shown in |
|---|---|
| Use of IBM Bob | BOB_STORY.md, docs/bob/, commit `a8117a6`, `.bob/` |
| Use of IBM watsonx Orchestrate | `orchestrate/` (tool package, build script, agent YAML), `backend/routers/agent.py`, `backend/tools/orchestrate_client.py`, PLAN.md §6, the agent panel in the app, the console trace (owner's demo) |
| Problem fit and impact for Bengaluru | README §1 and §4, docs/eval_results.md |
| Working prototype and technical quality | README §2, 573 backend + 191 frontend tests, `docs/a11y_review.md`, sonar settings |
| Design and accessibility | Phone-width layout, 48 px targets, `prefers-reduced-motion`, en/kn/hi UI, docs/a11y_review.md |
| Honesty about limits | README §6 Limitations, PLAN.md §9 Risks |

## Contest rule points (rule numbers 8.x UNVERIFIED; check against the official rules)

| Point | Status in the repo |
|---|---|
| No API keys or secrets in the repo | `.env` is git-ignored and was never committed; a pattern search of the git history (Groq `gsk_`, AWS, private keys, long `API_KEY=` values) found nothing on 2026-11-09. Test files use only fake values. |
| Synthetic data only | All 130 jobs are invented and marked `is_synthetic`; every card shows "Sample data"; a test rejects known real company names. |
| No biometric or children's data | None collected. The app never receives or stores audio; the browser's speech service processes it (see README Limitations). |
| No personal data | No accounts, no phone numbers, IDs, photos or addresses; nothing stored server-side; optional on-device profile with Delete. |
| No confidential data in AI tools | Only synthetic data and project code were given to IBM Bob, Claude Code, Groq (only if a key is set) and Orchestrate. UNVERIFIED beyond the owner's own statement. |

## Open items

- [ ] **SonarCloud**: re-run the quality gate on the latest commit (result UNVERIFIED). `sonar-project.properties` and `.sonarcloud.properties` exclude only duplication checks for the generated `orchestrate/kelasa_tools/` and the test folders.
- [ ] **Repo visibility**: make sure judges can open the repository (public, or access granted). UNVERIFIED.
- [ ] **Demo video**: record app + Orchestrate trace; add the link to README and BOB_STORY.md.
- [ ] **Bob panel screenshots**: add to `docs/bob/screenshots/`.
- [ ] **Bob credits reply**: no reply recorded. UNVERIFIED.
- [ ] **Orchestrate trial end date**: UNVERIFIED; warm the agent up before judging.
- [ ] **Phone mic test**: speech recognition and read-aloud in Kannada and Hindi on a real phone. UNVERIFIED.
- [ ] **Native-speaker review**: Kannada and Hindi strings in docs/TEMPLATES_TO_REVIEW.md and the 15 evaluation labels in backend/tests/eval_samples.json (still DRAFT).
- [ ] **Agent language**: whether the agent's final wording always stays in the picker language. UNVERIFIED.
- [ ] **Re-seed and re-import** after the last data and logic changes: delete `backend/db/kelasa_mitra.db` with the backend stopped; re-import the tool package; run `agent_warmup.py` twice.
- [ ] `.bob/rules` still says React 18 (installed: React 19.3.1). Left as Bob wrote it.
