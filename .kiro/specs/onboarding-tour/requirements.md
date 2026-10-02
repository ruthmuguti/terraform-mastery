# Requirements: First-run onboarding tour

## Context
TerraOps has no auth — a "user" is a local Zustand profile (`terraform-mastery-game` in localStorage, persist middleware, version 2). First run is the landing page (`src/app/page.tsx`): the player enters an **AGENT CODENAME** and picks a **CLOUD PROVIDER**, then `initProfile(...)` runs and they land on `/dashboard`. There is no walkthrough today, and the three Bedrock AI features (Field Intel, Draft Blueprint, Field Debrief) are easy to miss.

"First time they log in" = first time a profile exists and reaches the dashboard. The dashboard already has a `mounted && profile` hydration guard — the correct, flicker-free place to trigger a tour.

## Requirements

### R1. Show once, automatically, on first entry
- WHEN a profile exists, the dashboard has mounted, and the tour has not been seen THEN the guide SHALL start automatically.
- It SHALL NOT appear on later visits.
- WHEN a player starts a new profile (`resetProgress`) THEN the tour SHALL be eligible to show again.

### R2. Explain what is where, then walk through the app
- The guide SHALL point at the real UI landmarks in sequence: the sidebar nav (Dashboard / Missions / Achievements / Leaderboard), the agent/XP area, and the "next operation" entry point — and SHALL call out that missions contain the editor, terminal, and the AI helpers (Field Intel, Draft Blueprint, Field Debrief).
- Each step SHALL have a short, in-world (detective/handler voice) caption.

### R3. Skippable and dismissable
- The guide SHALL have a visible **Skip** control on every step, plus Back/Next and a step counter.
- Skipping or finishing SHALL mark the tour seen (so it won't auto-show again), and SHALL be reachable by keyboard (Esc skips).

### R4. Replayable (nice to have)
- There SHOULD be a way to replay the tour on demand (e.g. a "Replay guide" action), so it's not lost forever after the first dismiss.

### R5. Robust and non-breaking
- The guide SHALL NOT break if a target element isn't on screen (e.g. collapsed sidebar) — it skips/repositions rather than erroring.
- It SHALL be accessible: focus-trapped dialog/tooltip, `aria` labels, keyboard operable, respects `prefers-reduced-motion`.
- It SHALL add no runtime cost when already seen.

## Out of scope
- Tour steps inside the mission editor that depend on async Monaco mount (kept optional; see design).
- Server-side persistence (there is no server/account).
