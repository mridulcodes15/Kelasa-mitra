[`PLAN.md`](PLAN.md) is written. Here's a summary of every decision made:

---

## What's in the plan

### Architecture
A **FastAPI backend** hosts a single ADK `LlmAgent` with four deterministic tools (`extract_profile`, `rank_jobs`, `compute_skill_gap`, `translate_response`). The LLM handles natural language understanding and explanation generation; all scoring logic is pure Python so it's fast and predictable. A **React 18 + Vite + Tailwind PWA** handles the frontend, using the native Web Speech API for STT and `SpeechSynthesisUtterance` for TTS — no paid voice service needed.

### The 6 Phases (each independently demoable)
| Phase | Day(s) | Deliverable |
|-------|--------|------------|
| 1 | 1–2 | Voice/text → live profile extraction |
| 2 | 2–3 | Ranked job cards with match scores + reasons |
| 3 | 3–4 | Skill gap stepper with learning paths |
| 4 | 4 | Full Kannada/Hindi/English replies + TTS |
| 5 | 5 | 30-second employer job-post flow |
| 6 | 6–7 | PWA, polish, eval, demo video |

### Matching algorithm
`60% skill overlap + 30% proximity (capped at 20 km) + 10% language bonus` → normalised 0–100 integer score. Simple, explainable, and fast enough with no vector DB needed for 60–100 seed jobs.

### Screen designs
All four screens are ASCII-wireframed in the plan: pulsing mic button, field-by-field live profile builder, swipeable job cards with animated SVG score rings, and a skill gap vertical stepper.

### Key risks flagged
1. Web Speech API Android reliability → text fallback ready from Day 1
2. Kannada TTS voice availability → written text always shown
3. LLM missing Kannada skills → few-shot prompts tested Day 1
4. Translation quota during demo → pre-cache common responses

### Cut list (priority order)
TTS → Employer flow → PWA → Stepper animations → Swipe gestures → Live translation API. The **absolute minimum demo** is Phases 1 + 2 + partial 4: speak in your language, see your profile, get 3 ranked jobs with reasons in your language.
