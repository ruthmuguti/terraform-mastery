# Tasks: First-run onboarding tour

- [ ] 1. Store/persistence: add `hasSeenTour?` to `PlayerProfile`, `markTourSeen()` action, bump persist version 2→3 (passthrough migrate).
- [ ] 2. Add `data-tour` anchors: sidebar nav block + agent block (Sidebar.tsx); NEXT OPERATION + QUICK ACTIONS cards (dashboard).
- [ ] 3. Build `src/components/onboarding/GuideTour.tsx`: spotlight overlay + caption card, Back/Next/Skip/counter, rect-based positioning, auto-skip missing targets, a11y (focus trap, Esc/arrows, reduced-motion), noir styling, in-world captions.
- [ ] 4. Trigger on dashboard inside the `mounted && profile` gate when `!profile.hasSeenTour`; call `markTourSeen()` on finish/skip.
- [ ] 5. (Stretch R4) "Replay guide" entry point via TopBar.
- [ ] 6. Build + lint; manual check: new profile → tour auto-runs, Skip works, reload → no tour; collapsed sidebar → step skips cleanly.
- [ ] 7. Commit, push, watch Amplify build, verify on live URL.
- [ ] 8. README + proof doc: mention first-run guided tour.
