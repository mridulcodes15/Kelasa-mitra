# IBM Bob evidence

Material produced by IBM Bob, kept unedited as evidence of Bob's part in this project. Only this
README was written afterwards (by Claude Code, for the owner, 2026-11-09).

- `bob_audit_2026-11-07.md`: IBM Bob's project audit, produced by Bob on 2026-11-07; the text of
  Bob's report `.bob/artifacts/kelasa-mitra-project-audit-report.html` as the owner pasted it,
  kept unedited as evidence (typos and table layout included).
- `bob_PLAN_baseline.md`: Bob's PLAN.md exactly as in commit a8117a6 ("Bob baseline before
  Claude Code", 2026-11-08 00:57 +0530), written by Bob before anyone else changed it; saved with
  `git show a8117a6:PLAN.md`, kept unedited as evidence.
- `bob_README_baseline.md`: Bob's README.md exactly as in the same commit a8117a6
  (2026-11-08), written by Bob; saved with `git show a8117a6:README.md`, kept unedited as
  evidence.
- `screenshots/`: empty for now; no Bob screenshots are included yet. The owner will add them here.

## Known correction to the audit

The audit says "tsc --noEmit exits with 0 errors". On 2026-11-08 this was found to check
nothing: the root `frontend/tsconfig.json` has `files: []`, so plain `tsc --noEmit` type-checks no
files. The real check is `npx tsc --noEmit -p tsconfig.app.json` (or `npm run build`, which runs
`tsc -b`). The audit file itself is left unedited; the correction is recorded only here.

## Bob panel outputs added 2026-11-09

Each file below is IBM Bob's output, copied by the owner from the Bob panel into the Claude Code
chat and from there into the file on 2026-11-09, and kept unedited as evidence. Times are
approximate, all on 2026-11-07 (IST).

- `bob_plan_summary_2026-11-07.md`: IBM Bob's summary of its first PLAN.md, produced about 19:39.
- `bob_phase1_summary_2026-11-07.md`: IBM Bob's Phase 1 "what works, what doesn't" summary, produced about 20:14.
- `bob_phase1_fixes_2026-11-07.md`: IBM Bob's raw pytest output and summary of its three Phase 1 fixes, produced about 20:29.
- `bob_phase2_summary_2026-11-07.md`: IBM Bob's Phase 2 pre-code checks, raw pytest output and summary, produced about 20:46.
- `bob_docs_rewrite_summary_2026-11-07.md`: IBM Bob's summary of its PLAN.md and README.md rewrite, produced about 21:34.
- `bob_orchestrate_install_and_trial_end_2026-11-07.md`: IBM Bob's Orchestrate ADK install log, ending with the panel's trial-ended message, produced about 21:42 (the first word is cut off in the copy, as pasted).

The statements inside these files are Bob's own claims and are not independently verified,
except where this README says otherwise. Bob panel screenshots will be added to
`screenshots/` by the owner.

## Bob's own claims that were later corrected

1. Bob's first plan and Phase 1 summary used Google ADK and Gemini. The owner asked Bob to
   replace them; Bob switched to watsonx.ai, and later to Groq as an optional provider.
2. Bob's Phase 1 summary called the pytest exit code 1 only a deprecation warning. Bob's next
   output shows exit code 0 after `pytest.ini` was added.
3. The audit's "tsc --noEmit exits with 0 errors" was later found to check nothing (see
   "Known correction to the audit" above).
4. Bob's docs-rewrite summary put Orchestrate first on the cut list. The contest rules make it
   required, so the owner and Claude Code later moved it out of the cut list.
