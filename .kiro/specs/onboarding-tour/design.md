# Design: First-run onboarding tour

## Build vs. library decision
A tour library (react-joyride / driver.js / shepherd) is powerful but, given no element has stable anchors today, it would mean adding `data-tour` ids across Sidebar/dashboard/MissionExecutor AND handling Monaco's async mount — more surface area and a new dependency the night before the deadline.

**Decision: a small custom tour, dashboard-scoped, anchored to a handful of elements I add `data-tour` ids to.** No new dependency, full control over the noir styling, and it degrades gracefully. Steps are limited to the **dashboard + sidebar** (always-present, synchronous DOM) and *describe* the mission screen rather than driving into it — avoiding the async-Monaco risk entirely for v1.

## Persistence
- Add `hasSeenTour?: boolean` to `PlayerProfile` (`src/lib/types.ts`).
- Add `markTourSeen()` action to the store; it sets `profile.hasSeenTour = true`. Persists for free via existing middleware.
- Bump persist `version` 2 → 3 with a passthrough migrate so existing saved profiles get `hasSeenTour` falsy → tour shows once for them too.
- Because the flag lives on the profile, `resetProgress` (new profile) re-arms the tour (R1).

## Component: `src/components/onboarding/GuideTour.tsx` (client)
- A self-contained overlay: a dimmed backdrop with a "spotlight" cutout over the current target, plus a caption card (title, body, Back / Next / step counter, and a persistent **Skip tour** link).
- **Steps** = an array of `{ selector, title, body, placement }`. Targets by `data-tour="..."` attributes I add:
  - `data-tour="nav"` — sidebar nav block ("Your case files: missions, achievements, leaderboard.")
  - `data-tour="agent"` — agent/XP block ("Your rank and XP. Close cases to level up.")
  - `data-tour="next-op"` — dashboard NEXT OPERATION card ("Start here — your next operation.")
  - `data-tour="quick-actions"` or QUICK ACTIONS ("Jump back in any time.")
  - A final informational step (no anchor, centered) describing the mission screen: editor + terminal + the AI handler trio (Field Intel, Draft Blueprint, Field Debrief).
- **Positioning:** on each step, `getBoundingClientRect()` the target, position the spotlight + card; recompute on resize/scroll. If a target is missing (e.g. sidebar collapsed, element not mounted), **skip that step** automatically (R5).
- **A11y:** render in a focus-trapped `role="dialog"` with `aria-label`; Esc = skip; Enter/→ = next; ← = back; respect `prefers-reduced-motion` (no spotlight transition). Buttons are real `<button>`s.
- Styling: noir theme — dark backdrop, terminal/purple accents, mono captions — consistent with the rest of the app.

## Trigger
- Mount `<GuideTour />` on the dashboard (`src/app/(app)/dashboard/page.tsx`), inside the existing `mounted && profile` gate.
- Start when `mounted && profile && !profile.hasSeenTour`.
- On finish or skip → `markTourSeen()`.

## Replay (R4)
- Wire the currently-inert TopBar **Settings** (or add a small "Replay guide" item) to a store setter that clears the "seen" session flag and restarts the tour. If time is tight, ship auto-first-run only and leave replay as a stretch — R4 is "should," not "shall".

## Risks
- Spotlight math on resize/scroll — keep it simple (fixed overlay, recompute rect on step change + resize). Acceptable for a guided, mostly-static dashboard.
- Sidebar collapsed on first run — step auto-skips if `data-tour="nav"` is hidden/zero-size.
- Keep step count small (4–5) so it's a help, not a chore.
