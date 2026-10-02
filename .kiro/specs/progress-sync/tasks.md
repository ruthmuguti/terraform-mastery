# Implementation Plan: Progress sync, signed-in state, shared leaderboard

## Overview

Build the shared pure modules and their property tests first (they hold all decision logic), then apply the additive Prisma schema change, then server infrastructure and the API route handlers, then auth wiring and the username helper, then client sync (SessionProvider, store v2, transcript recorder, queue, SyncManager), then the UI. Each step builds on the previous one and ends wired into the app. Testing is done as sub-tasks under the parent tasks. Property tests use `fast-check` with `numRuns >= 100`, one test per property, each tagged `// Feature: progress-sync, Property N: <title>`.

## Tasks

- [x] 1. Add the test toolchain and shared types
  - [x] 1.1 Add `vitest` and `fast-check` as pinned exact devDependencies
    - Check npm for current versions first; design proposes `vitest@5.0.3` and `fast-check@4.10.2` — verify and adjust to the actual current pinned versions.
    - Add `vitest.config.ts` with `resolve.alias { "@": "./src" }`, `environment: "node"`.
    - Add `"test": "vitest --run"` to `package.json` scripts. Do NOT touch `amplify.yml` (tests stay out of the deploy build).
    - No new server env vars are expected; if any are introduced later, add them to the `amplify.yml` allowlist and `.env.example` (AGENTS.md).
    - _Requirements: R5, R7_
  - [x] 1.2 Create shared progress types
    - Create `src/lib/progress/types.ts`: `TranscriptStep`, `Transcript`, `ProgressDTO`, `LocalProgressDTO`, `StatsDelta` (per the design's type definitions).
    - _Requirements: R4, R5, R6, R7_

- [x] 2. Implement the seeded RNG and determinism change
  - [x] 2.1 Add the seeded RNG
    - Create `src/lib/progress/rng.ts` exporting `mulberry32(seed)`.
    - _Requirements: R5.5_
  - [x] 2.2 Thread an optional `random` into the simulator
    - Modify `src/lib/terraform-simulator.ts`: `executeCommand(input, state, hcl, opts?: { random?: () => number })`, passing `random` to `generateId()`, defaulting to `Math.random` so existing callers and browser behaviour are unchanged.
    - _Requirements: R5.4, R5.5_
  - [x]* 2.3 Property test: replay ignores random IDs
    - Create `src/lib/progress/__tests__/replay.test.ts` (shared with task 5.2).
    - **Property 2: Replay ignores random IDs** — `// Feature: progress-sync, Property 2: Replay ignores random IDs`
    - **Validates: Requirements 5.5**

- [x] 3. Implement request/body validation
  - [x] 3.1 Write the hand-written validators
    - Create `src/lib/progress/validate.ts`: Transcript limit checks first (>300 steps or any step `hcl` > 64 KB → 413), then shape checks (non-array `steps`, non-string `command`/`hcl`, unknown `kind`, provider outside `aws|gcp|azure` → 400), then unknown `missionId` → 400; `StatsDelta` field caps (`totalCommands<=500`, `terraformApplies<=100`, `hintsUsed<=100`, `missionsAttempted<=20`, each integer >= 0); `missionActivity` caps (`hints<=100`, `commands<=500`). Copy known fields only; ignore `userId`/`profileId`/`xp`/`level`/`badges`/`verified`.
    - _Requirements: R4.6, R4.7, R5.1, R5.6, R5.10_
  - [x]* 3.2 Property test: transcript validation
    - Create `src/lib/progress/__tests__/validate.test.ts`.
    - **Property 3: Transcript validation** — `// Feature: progress-sync, Property 3: Transcript validation`
    - **Validates: Requirements 4.6, 4.7, 5.1**
  - [x]* 3.3 Property test: stats deltas are bounded
    - Add to `src/lib/progress/__tests__/validate.test.ts`.
    - **Property 10: Stats deltas are bounded** — `// Feature: progress-sync, Property 10: Stats deltas are bounded`
    - **Validates: Requirements 5.10**

- [x] 4. Implement the progress rules
  - [x] 4.1 Write the rules module
    - Create `src/lib/progress/rules.ts`: `missionXp`, `derivedXp`, `verifiedXp`, `level`, `isUnlocked`, `applyCompletion`, `applyStats`, and the `Completion`/`Snapshot` types (per the design). Badge XP comes from the mission's own `badgeId` only.
    - _Requirements: R5.2, R5.6, R5.7, R5.8, R5.9, R5.10, R7.2, R7.3_
  - [x]* 4.2 Property test: unlock rule
    - Create `src/lib/progress/__tests__/rules.test.ts`.
    - **Property 4: Unlock rule** — `// Feature: progress-sync, Property 4: Unlock rule`
    - **Validates: Requirements 5.2**
  - [x]* 4.3 Property test: XP, level and badges are derived
    - Add to `src/lib/progress/__tests__/rules.test.ts`.
    - **Property 5: XP, level and badges are derived** — `// Feature: progress-sync, Property 5: XP, level and badges are derived`
    - **Validates: Requirements 5.6, 5.7, 7.2**
  - [x]* 4.4 Property test: completion idempotent and verify-only on unverified
    - Add to `src/lib/progress/__tests__/rules.test.ts`.
    - **Property 6: Completion is idempotent and verify-only on unverified** — `// Feature: progress-sync, Property 6: Completion is idempotent and verify-only on unverified`
    - **Validates: Requirements 5.8, 5.9**
  - [x]* 4.5 Property test: verified XP excludes unverified
    - Add to `src/lib/progress/__tests__/rules.test.ts`.
    - **Property 9: Verified XP excludes unverified** — `// Feature: progress-sync, Property 9: Verified XP excludes unverified`
    - **Validates: Requirements 7.3**

- [x] 5. Implement Replay
  - [x] 5.1 Write the replay function
    - Create `src/lib/progress/replay.ts`: `replay(mission, transcript, random = mulberry32(0))` matching the executor order (reset → run updates state+history → latch objectives after each step), each `check` wrapped in try/catch where a throw is "not passed". Accept iff all objectives latch.
    - _Requirements: R4.1, R4.2, R5.3, R5.4, R5.5_
  - [x]* 5.2 Property test: browser/server parity
    - Add to `src/lib/progress/__tests__/replay.test.ts` with a harness that reproduces the executor loop (command → state/history → checks; edit → checks; reset).
    - **Property 1: Browser/Server parity** — `// Feature: progress-sync, Property 1: Browser/Server parity`
    - **Validates: Requirements 4.1, 4.2, 5.3, 5.4**
  - [ ]* 5.3 Golden transcript example tests
    - Add to `src/lib/progress/__tests__/replay.test.ts`: for each of the 15 catalog missions, a hand-written passing Transcript (latches all objectives for each provider) and a truncated version that fails (not all latched). Guards against catalog edits breaking verification.
    - _Requirements: R5.3_

- [x] 6. Implement the merge
  - [x] 6.1 Write the merge module
    - Create `src/lib/progress/merge.ts`: `mergeProgress(server, local, now)` (pure) — completions union (earliest `completedAt`, local-only unverified, server verified preserved), badges filtered to completed missions' `badgeId`, stats per-field max clamped, in-progress carry-over, provider `server ?? local`, XP recomputed via `derivedXp`. No unlock check, no Replay.
    - _Requirements: R7.1, R7.2, R7.3, R7.4, R7.5, R7.6_
  - [ ]* 6.2 Property test: merge is idempotent
    - Create `src/lib/progress/__tests__/merge.test.ts`.
    - **Property 7: Merge is idempotent** — `// Feature: progress-sync, Property 7: Merge is idempotent`
    - **Validates: Requirements 7.5, 8.2**
  - [ ]* 6.3 Property test: merge loses nothing
    - Add to `src/lib/progress/__tests__/merge.test.ts`.
    - **Property 8: Merge loses nothing** — `// Feature: progress-sync, Property 8: Merge loses nothing`
    - **Validates: Requirements 7.2, 7.4**
  - [ ]* 6.4 Property test: merged snapshots stay derived
    - Add to `src/lib/progress/__tests__/merge.test.ts` (reuse Property 5 over merged snapshots).
    - **Property 5: XP, level and badges are derived** — `// Feature: progress-sync, Property 5: XP, level and badges are derived`
    - **Validates: Requirements 5.6, 7.2**

- [x] 7. Apply the Prisma schema change
  - [x] 7.1 Edit the schema and push
    - Modify `prisma/schema.prisma`: add `Profile.provider String?`, `MissionProgress.verified Boolean @default(false)`, `MissionProgress.verifiedAt DateTime?`. All additive (one nullable column + two columns with defaults) — no `--accept-data-loss` needed.
    - STOP and get Ruth's explicit approval before running against live Supabase. First run a row count on `Profile` and `MissionProgress`. Then `npx prisma db push`, then `prisma generate`. Rollback is dropping the three columns.
    - _Requirements: R6.6_

- [x] 8. Implement server infrastructure
  - [x] 8.1 HTTP helpers
    - Create `src/lib/server/http.ts`: `readJsonLimited(req, 1MB)` (reject on `Content-Length` and on streamed bytes → 413; `JSON.parse` failure → 400), `jsonError(code, message)`, `requireUser()` (401 from session `user.id` only).
    - _Requirements: R3.1, R3.2, R4.6_
  - [x] 8.2 Rate limiter
    - Create `src/lib/server/rate-limit.ts`: fixed-window `rateLimit(userId, now)` (`WINDOW_MS=60_000`, `LIMIT=30`), `Retry-After` seconds, sweep past 10k entries. Per-instance best-effort.
    - _Requirements: R10.1, R10.2, R10.3_
  - [ ]* 8.3 Property test: rate limit
    - Create `src/lib/server/__tests__/rate-limit.test.ts` with an injected clock.
    - **Property 13: Rate limit** — `// Feature: progress-sync, Property 13: Rate limit`
    - **Validates: Requirements 10.1, 10.2**
  - [x] 8.4 Progress repository
    - Create `src/lib/server/progress-repo.ts`: load Snapshot, `applyCompletion` write in an interactive `$transaction` (upsert row, conditional `updateMany` for complete and for verify-unverified, `createMany skipDuplicates` for badge, recompute XP/level), and the merge write (diff upserts, badges, stats GREATEST, Profile update). Replay runs before the transaction. P2034 one retry.
    - _Requirements: R5.6, R5.7, R5.8, R5.9, R6.1, R6.2, R6.3, R6.4, R7.1_
  - [x] 8.5 Leaderboard query and pure ranker
    - Create `src/lib/server/leaderboard.ts`: `getLeaderboard(viewerUserId?)` with an explicit Prisma `select` (no email/tokens/User/Account fields), and a split-out pure `rankProfiles()` (verifiedXp desc, lastVerifiedAt asc, username asc; top 100; `me` with rank even outside top 100; whitelist mapper).
    - _Requirements: R9.1, R9.2, R9.3, R9.4_
  - [ ]* 8.6 Property test: leaderboard ranking
    - Create `src/lib/server/__tests__/leaderboard.test.ts` against `rankProfiles()`.
    - **Property 12: Leaderboard ranking** — `// Feature: progress-sync, Property 12: Leaderboard ranking`
    - **Validates: Requirements 9.1, 9.2, 9.3, 9.4**

- [x] 9. Checkpoint
  - Ensure all tests pass, ask the user if questions arise.

- [x] 10. Implement the API route handlers
  - [x] 10.1 GET and PATCH `/api/progress`
    - Create `src/app/api/progress/route.ts` (`runtime="nodejs"`, `dynamic="force-dynamic"`): `GET` loads or creates the Profile (R6.1), `PATCH` applies `provider`/`stats`/`missionActivity` through validate → rules → repo. Pipeline: `requireUser` → `rateLimit` → `readJsonLimited` → validate → domain → transaction.
    - _Requirements: R3.1, R3.2, R3.3, R5.10, R6.1, R6.3, R6.4, R10.1_
  - [x] 10.2 POST `/api/progress/complete`
    - Create `src/app/api/progress/complete/route.ts`: validate (400/413), unknown mission (400), locked (409), Replay (422 if not all latched), then repo write; idempotent repeats return 200.
    - _Requirements: R3.1, R4.6, R4.7, R5.1, R5.2, R5.3, R5.8, R5.9, R10.1_
  - [x] 10.3 POST `/api/progress/merge`
    - Create `src/app/api/progress/merge/route.ts`: validate (400/413), `mergeProgress`, repo merge write, return `ProgressDTO`. Skips unlock check and Replay.
    - _Requirements: R3.1, R7.1, R7.4, R7.5, R10.1_
  - [x] 10.4 GET `/api/leaderboard`
    - Create `src/app/api/leaderboard/route.ts`: public, session optional, returns `LeaderboardDTO`, 503 on DB failure.
    - _Requirements: R9.1, R9.2, R9.3, R9.4_
  - [ ]* 10.5 Handler tests with mocked auth/prisma
    - Create `src/app/api/progress/__tests__/handlers.test.ts`: 401 without session for every endpoint, 429 on the 31st write, 413 by `Content-Length` and by streamed size, 409 locked mission, injected `userId`/`xp` fields ignored, 200 idempotent repeat.
    - _Requirements: R3.1, R3.2, R5.1, R5.6, R5.8, R10.1_

- [x] 11. Auth split, routing, and username helper
  - [x] 11.1 Split the NextAuth config
    - Create `src/lib/auth.config.ts` (adapter-free: `providers: [GitHub]`, `pages`, JWT session, `secret`, `trustHost`, `jwt`/`session`/`redirect` callbacks with `token.id`/`token.login`). Modify `src/lib/auth.ts` to spread it and add `PrismaAdapter(prisma)`. No `middleware.ts`.
    - _Requirements: R2.1, R2.2, R2.3, R3.2, R6.5_
  - [x] 11.2 `safeCallback` and `/login` redirect
    - Add `safeCallback(raw)` (same-origin `/` only, reject `//`, `/\`, control chars; else `/dashboard`) used by the `redirect` callback. Make `src/app/login/page.tsx` a server component that redirects signed-in users to `/dashboard` and renders a login client otherwise.
    - _Requirements: R2.2, R2.4_
  - [ ]* 11.3 Property test: callback URLs stay same-origin
    - Create `src/lib/__tests__/callback.test.ts`.
    - **Property 11: Callback URLs stay same-origin** — `// Feature: progress-sync, Property 11: Callback URLs stay same-origin`
    - **Validates: Requirements 2.2**
  - [x] 11.4 Username helper
    - Add `toUsername(base)`/`pickUsername(base, taken)` (used by `progress-repo.ts` Profile creation): keep `[A-Za-z0-9_-]`, trim to 32, empty → `agent`, collision → `base-2..20` then `base-<6 hex>`.
    - _Requirements: R6.5_
  - [ ]* 11.5 Property test: username uniqueness
    - Create `src/lib/server/__tests__/username.test.ts`.
    - **Property 14: Username uniqueness** — `// Feature: progress-sync, Property 14: Username uniqueness`
    - **Validates: Requirements 6.5**
  - [ ]* 11.6 Login server-component test
    - Add to `src/app/login/__tests__/login.test.ts`: signed-in → redirect `/dashboard`; signed-out → renders login client.
    - _Requirements: R2.4_

- [x] 12. Checkpoint
  - Ensure all tests pass, ask the user if questions arise.

- [x] 13. Client session wiring and store v2
  - [x] 13.1 AppProviders
    - Create `src/components/providers/AppProviders.tsx` (`SessionProvider` + `SyncManager`). Modify the root `src/app/layout.tsx` to `await auth()` and render `<AppProviders session={session}>`.
    - _Requirements: R1.1, R1.3, R6.2_
  - [x] 13.2 Store v2 changes
    - Modify `src/lib/store.ts`: `version: 2` with migrate (ownerUserId undefined), add `ownerUserId?`, `MissionProgress.verified?`, `hydrate(dto, userId)`. Keep existing actions optimistic; each enqueues when signed in (`completeMission`→complete, `incrementStats`→coalesced stats, `setProvider`→last-write provider).
    - _Requirements: R6.2, R6.3, R6.4, R8.6, R7.9_

- [x] 14. Transcript recorder and sync queue
  - [x] 14.1 Transcript store
    - Create `src/lib/sync/transcript-store.ts`: persist `terraops:transcript:<userId>:<missionId>` → `{ provider, steps, startedAt }`; new/empty on restart; delete on 200; client-side 300-step / 64 KB mirror; catch `setItem` quota failures.
    - _Requirements: R4.1, R4.2, R4.3, R4.4, R4.5_
  - [x] 14.2 Wire recording into MissionExecutor
    - Modify `src/components/missions/MissionExecutor.tsx`: append `run`/`check`/`reset` steps per the design; on mount rebuild state/history/latches via local `replay`; submit completion with its Transcript when all objectives pass in-browser.
    - _Requirements: R4.1, R4.2, R4.3, R4.5_
  - [x] 14.3 Sync queue
    - Create `src/lib/sync/queue.ts`: persisted at `terraops:pending:<userId>`, one request at a time (merge → completes → PATCH), backoff `min(60s, 1s·2^n) ± 20%`, fire on `online`/`visibilitychange`/load; status table (200 drop+hydrate+delete transcript; 5xx/network keep+backoff; 401 pause+prompt; 429 Retry-After; 400/409/413/422 drop+GET hydrate+toast, keep transcript).
    - _Requirements: R8.1, R8.2, R8.3, R8.4, R8.5, R8.6_
  - [x] 14.4 SyncManager
    - Create `src/lib/sync/SyncManager.tsx`: owner/marker/userId merge decision (R7.1/R7.6/R7.8), enqueue merge on first sign-in, `GET /api/progress` → hydrate, set `ownerUserId`, write `terraops:merged:<userId>`.
    - _Requirements: R6.2, R7.1, R7.6, R7.7, R7.8, R8.2_
  - [ ]* 14.5 Queue and merge-decision unit tests
    - Create `src/lib/sync/__tests__/sync.test.ts`: status table (200/5xx/401/429/4xx) with a fake `fetch`, stats coalescing preserves totals, merge decision (owner/marker/userId).
    - _Requirements: R7.8, R8.1, R8.2, R8.3, R8.4, R8.5_

- [x] 15. UI
  - [x] 15.1 TopBar sign-in/sign-out and sync indicator
    - Modify `src/components/layout/TopBar.tsx`: `useSession()`; signed-in avatar + display name in an `aria-label`ed account button with a Sign out `button` → `signOut({ redirectTo: "/" })`; signed-out `Sign in` link to `/login`; keyboard operable, Escape-closes, visible focus ring; `role="status" aria-live="polite"` sync indicator.
    - _Requirements: R1.1, R1.2, R1.3, R1.4, R8.1, R8.3_
  - [x] 15.2 Unverified pill and Replay to verify
    - Modify `src/components/missions/MissionCard.tsx` and the mission page header (`src/app/(app)/missions/[id]/MissionPageClient.tsx`): "Unverified" pill (`aria-label="Completed offline, not verified"`) and a "Replay to verify" button that starts a new empty-Transcript attempt and clears latches.
    - _Requirements: R7.9_
  - [x] 15.3 Anonymous rendering of app pages
    - Modify `src/app/(app)/dashboard/page.tsx`, `src/app/(app)/achievements/page.tsx`, `src/app/(app)/missions/[id]/MissionPageClient.tsx` (and `src/app/(app)/missions/page.tsx` as needed): drop `router.replace("/")`; render from local store when signed out, hydrate from Server when signed in; "Start" links straight to the mission.
    - _Requirements: R2.1, R6.2_
  - [x] 15.4 Server-component leaderboard page
    - Modify `src/app/(app)/leaderboard/page.tsx` to a server component calling `getLeaderboard((await auth())?.user?.id)`, highlight `me` (`aria-current="true"`), show an outside-top-100 row, remove demo data, "Leaderboard unavailable" on 503.
    - _Requirements: R9.1, R9.4_

- [x] 16. Final verification
  - Run `npx tsc --noEmit`, `npm run lint`, `npm run build`, and `vitest --run`. Fix any failures. Confirm no new server env vars were introduced (otherwise update `amplify.yml` allowlist and `.env.example` per AGENTS.md).
  - _Requirements: R1, R2, R3, R4, R5, R6, R7, R8, R9, R10_

## Notes

- Tasks marked with `*` are optional (test sub-tasks) and can be skipped for a faster MVP.
- Each task references specific requirements (R1–R10) and, where applicable, the design properties (P1–P14) it implements or tests.
- Property tests use `fast-check` with `numRuns >= 100`, one test per property, each tagged `// Feature: progress-sync, Property N: <title>`.
- Checkpoints (tasks 9, 12) ensure incremental validation.
- The schema push (7.1) requires Ruth's explicit approval before running against live Supabase.

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1", "1.2", "2.1"] },
    { "id": 1, "tasks": ["2.2", "3.1", "4.1"] },
    { "id": 2, "tasks": ["2.3", "3.2", "3.3", "4.2", "4.3", "4.4", "4.5", "5.1"] },
    { "id": 3, "tasks": ["5.2", "5.3", "6.1"] },
    { "id": 4, "tasks": ["6.2", "6.3", "6.4", "7.1"] },
    { "id": 5, "tasks": ["8.1", "8.2", "8.4", "8.5", "11.1", "11.4"] },
    { "id": 6, "tasks": ["8.3", "8.6", "11.2", "11.5"] },
    { "id": 7, "tasks": ["10.1", "10.2", "10.3", "10.4", "11.3", "11.6"] },
    { "id": 8, "tasks": ["10.5", "13.1", "13.2"] },
    { "id": 9, "tasks": ["14.1", "14.3", "14.4"] },
    { "id": 10, "tasks": ["14.2", "14.5", "15.1"] },
    { "id": 11, "tasks": ["15.2", "15.3", "15.4"] }
  ]
}
```
