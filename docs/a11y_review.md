# Accessibility and UI review

Reviewed 2026-11-09 by Claude Code in the Claude desktop app's built-in browser (Chromium),
emulating a 375 × 812 phone screen, in English, Kannada and Hindi, on the landing screen
(including the follow-up question) and the jobs screen (job cards and skill-gap section).

**Scope and limits.** Checks were scripted in the page (element sizes, accessible names,
contrast computed from rendered colours, horizontal overflow, `lang`, keyboard Tab order)
plus visual checks of screenshots. **Not tested:** a real screen reader (TalkBack, NVDA,
VoiceOver), a real phone, real microphone input (blocked in the browser pane), and
`prefers-reduced-motion` in a real browser (covered only by unit tests). The backend ran
with the Orchestrate and Groq settings blanked, so the agent was offline and the rules
answered; the offline banner was part of the review.

## What passed

| Check | Result (en / kn / hi) |
|---|---|
| Horizontal overflow at 375 px | none on either screen; long Kannada and Hindi text wraps |
| Interactive elements with no accessible name | none |
| Touch targets on interactive controls | all ≥ 48 px, except the hidden back card (fixed below) |
| Text contrast (WCAG AA) | all text passes except the score label (fixed below) |
| Page title | "Kelasa Mitra" |
| Headings | one `h1` per screen; skill-gap section uses `h2`, cards use `h3` |
| Follow-up question | shown in the worker's language and announced (`role="status"`); focus moves to the mic |
| Offline banner | shown in all three languages, announced (`role="status"`) |
| Browser console errors | none |

## Small defects fixed

| # | Defect | Evidence | Fix | Test |
|---|---|---|---|---|
| 1 | `<html lang>` stayed `en` in Kannada and Hindi, so a screen reader would read Kannada and Hindi text with an English voice | `document.documentElement.lang` was `en` after picking ಕ or हि | `App.tsx` sets it from the language picker | `a11y.test.tsx`; browser: `hi` after picking हि |
| 2 | Score text failed contrast: green 3.30:1 and amber 3.19:1 for 14 px bold (needs 4.5:1) | computed from rendered colours | `MatchRing.tsx`: score text uses the 700 shades (5.02:1 and above); the ring stroke keeps its colour (graphics need 3:1) | `a11y.test.tsx`; browser: 5.02:1 and 6.47:1 |
| 3 | The card peeking behind the top card had Skip and Save buttons that keyboard and screen-reader users could reach; they acted on the top card and measured 46 px | Tab landed on them before the top card's buttons | `JobCard.tsx`: `inert` and `aria-hidden` on the card behind | `a11y.test.tsx`; browser: 0 of its buttons focusable |
| 4 | Keyboard focus showed only the browser's thin default ring (0.8 px), hard to see on teal buttons | computed outline `auto 0.8px` | `index.css`: 3 px marigold `:focus-visible` outline | browser: visible ring on Skip |

## Bigger issues, not fixed (owner to decide)

1. **Job data stays in English in kn/hi:** job titles, employer names, area names ("Rajajinagar के
   पास") and learning-path steps (the card says the steps are English-only). Needs translated data.
2. **`ProfileCard` is partly English:** skill names come from IDs ("Hotel Helper") and "year/years"
   is hard-coded.
3. **Language picker keyboard behaviour:** it uses `role="radiogroup"` with button radios, but arrow
   keys do not move between options as the radio pattern expects; each option is a separate Tab stop.
4. **Emoji inside labels** (💼, 📍, 💰, 🎓, 🤔, 🤖) are read aloud by some screen readers. They should
   be wrapped with `aria-hidden` or given text alternatives.
5. **Global arrow-key handler on the jobs screen** saves or skips a card on ← / → wherever focus is,
   and still counts saves after the last card. Needs a scoped handler.
6. **The skill-gap section sits below the card stack**, so on a phone it is off-screen until the
   worker scrolls, and nothing points to it.
7. **Kannada and Hindi wording** has not been reviewed by a native speaker (see
   `docs/TEMPLATES_TO_REVIEW.md`).
8. **Untested with assistive technology:** a screen reader on a real phone, voice input with a real
   microphone, and reduced motion in a real browser should be checked before the demo.

## How to repeat

Start the backend without the agent (the `backend-offline` entry in `.claude/launch.json` blanks
the Orchestrate and Groq settings) and the frontend, open the app at phone width, then check each
language on both screens. `frontend/src/test/a11y.test.tsx` covers fixes 1–3.
