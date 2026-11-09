Both files are written. Here is a clear summary of every decision made and what was left explicitly unverified.

---

## What was done

**`PLAN.md`** — fully rewritten. Changes from the old version:

| Section | What changed |
|---------|-------------|
| §2 Architecture | Stack diagram updated to React 19 / Vite 8 / Tailwind 4 / actual route names. Replaced watsonx.ai + ADK with Groq + rule-based + Orchestrate (pending access). Added IBM products table. |
| §3 Folder structure | Replaced the fictional tree with the actual codebase as of today — correct router names (`matches.py`, `skill_gap.py`), explicit `NOT YET BUILT` / `not yet wired` labels, explained why absent files are absent. |
| §4 Data schema | Updated JSON examples to match actual Pydantic models (field names, `is_synthetic`, etc.). |
| §5 Phases | Added ✅ / 🔶 / ❌ status markers. Phases 1–2 are done. Phase 3 is in-progress with a specific TODO list. Phases 4–6 are pending. |
| §8 *(new)* | Full IBM watsonx Orchestrate integration section: what it does, how FastAPI endpoints become tools via OpenAPI import, access checklist, offline fallback, demo narrative, **and what could not be verified** (§8.6). |
| §9 Risks | Added Orchestrate-specific risks (access not confirmed, plan may not support OpenAPI import, Kannada support unknown). Removed the Google Translate API risk. Added stale DB risk. |
| §10 Cut list | Orchestrate integration is now item 1 on the cut list. |
| §11 Dependencies | Replaced `ibm-watsonx-ai` with `groq`. Updated version numbers to match `package.json` / `requirements.txt`. |
| §12 Timeline | Added status column (Done / In progress / Pending). |

**`README.md`** — fully rewritten. Added: problem statement, "What it does" narrative, IBM Bob section, IBM Orchestrate section with ⚠ pending-access warning, feature status table, updated Quick Start (Groq env vars, stale DB deletion instructions, OpenAPI spec URL), updated API reference (all three endpoints), Limitations table, Privacy section, "Built with IBM Bob" section.

---

## What I could not verify from docs (flagged in PLAN.md §8.6)

The IBM docs index in Bob does not include a dedicated watsonx Orchestrate developer reference. The Orchestrate-specific developer documentation lives at `developer.watson-orchestrate.ibm.com`, which is outside the indexed libraries. As a result, **six things are stated as plans, not as verified facts:**

1. **OpenAPI import menu path** — the exact UI steps to import an OpenAPI 3.0 spec into Orchestrate as a tool (may be labelled "Import skill", "HTTP skill", "Add tool", etc.).
2. **HTTP tool authentication model** — whether registered HTTP tools use a bearer token, API key header, or are unauthenticated by default.
3. **Chat REST API URL format** — the exact endpoint to send a message to an Orchestrate agent programmatically from the React frontend.
4. **Python ADK method names** — the specific `ibm-watsonx-orchestrate` SDK calls for registering a Python function as a tool.
5. **Kannada script support** — whether Orchestrate's LLM can reason in Kannada in system prompts and tool-call steps.
6. **Free-tier tool limits** — whether the hackathon-provided Orchestrate instance allows custom HTTP tool import at all, or is restricted to built-in skills.

All six will need to be checked against the actual Orchestrate console once you have access credentials.
