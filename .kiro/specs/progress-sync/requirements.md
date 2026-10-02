# Requirements: Progress sync, signed-in state, shared leaderboard

## Context
- App: TerraOps. Next.js 15.5.27 (App Router), React 19, NextAuth v5 beta.31 (GitHub, PrismaAdapter, JWT sessions, sign-in page `/login`), Prisma 7.8 + `@prisma/adapter-pg`, Supabase Postgres. Live on Amplify at https://main.d1pm2ukx4d84ya.amplifyapp.com.
- Today all progress lives only in the zustand `persist` store in `src/lib/store.ts` (localStorage key `terraform-mastery-game`, version 1). The leaderboard is computed in the browser, so nobody sees anyone else.
- No component uses `useSession`, `SessionProvider` or `signOut`. `/dashboard`, `/leaderboard`, `/achievements` have no server protection.
- `Profile`, `MissionProgress`, `UnlockedBadge` exist in `prisma/schema.prisma` and Supabase but are unused.
- `src/lib/terraform-simulator.ts` is pure TS with no browser APIs (`createInitialState()`, `executeCommand(input, state, hcl)`, `parseHCL`). Its only nondeterminism is `Math.random` for fake resource IDs. Objectives in `src/data/missions.ts` are `check(simState, hcl, commandHistory, provider)`. `MissionExecutor.tsx` evaluates the checks after each change and latches each objective once it passes.
- Constraints (AGENTS.md): no Next 16 APIs, interception in `middleware.ts`, new server env vars go in the `amplify.yml` allowlist, schema changes via `prisma db push` (no migrations).

## Glossary
- **Server**: the Next.js server code (route handlers / server actions) running on Amplify.
- **Progress API**: every Server endpoint that reads or writes a player's progress.
- **Progress write endpoint**: every Progress API endpoint that changes Server progress, including the completion and merge endpoints.
- **Local progress**: the localStorage store contents (`profile` + `missionProgress`).
- **Server progress**: the signed-in user's `Profile`, `MissionProgress` and `UnlockedBadge` rows.
- **Mission catalog**: `src/data/missions.ts` and `src/data/badges.ts` as bundled with the Server.
- **Transcript**: for one mission attempt, the selected provider plus an ordered list of steps `{ command, hcl }`, where `hcl` is the editor HCL at the moment the command was run.
- **Replay**: running a Transcript on the Server from `createInitialState()` through `executeCommand`, evaluating every objective `check` after each step and latching each objective once it passes (same semantics as `MissionExecutor`).
- **Verified completion**: a completed `MissionProgress` with `verified = true`, accepted after a successful Replay.
- **Unverified completion**: a completed `MissionProgress` with `verified = false`, imported by the R7 merge without a Transcript.
- **Derived XP**: sum of `xpReward` for completed missions (verified and unverified) plus `xpBonus` for their unlocked badges, both taken from the Mission catalog.
- **Verified XP**: Derived XP computed over Verified completions only, plus the badges of those missions.
- **Public page**: every page. `/`, `/login`, `/missions`, `/missions/[id]`, `/dashboard`, `/achievements` and `/leaderboard` all render for signed-out users. `/dashboard` and `/achievements` show Local progress when signed out and Server progress when signed in; `/leaderboard` is always public.

## Requirements

### R1. Visible signed-in state and sign out
- WHILE a user is signed in, the TopBar SHALL show the GitHub avatar and display name.
- WHEN a signed-in user activates the Sign out control, the app SHALL end the session and land on `/`.
- WHILE no user is signed in, the TopBar SHALL show a Sign in control linking to `/login`.
- The avatar, Sign in and Sign out controls SHALL be keyboard operable and have accessible names.

### R2. Routing and sign-in entry
- Every page SHALL render for signed-out users. No page SHALL force a redirect to `/login`. `/missions` and `/missions/[id]` play anonymously from Local progress; `/dashboard` and `/achievements` show Local progress when signed out and Server progress when signed in; `/leaderboard` stays public so judges can see it without an account.
- Sign-in SHALL be user-initiated from the TopBar Sign in control (R1), not forced by route protection.
- WHEN a user starts sign-in from a Public page, the app SHALL return the user to that same-origin path after sign-in if it is a same-origin path, otherwise to `/dashboard`.
- WHEN a signed-in user requests `/login`, the app SHALL redirect to `/dashboard`.

### R3. Progress API authorization
- IF a Progress API request has no valid session, THEN the Server SHALL return 401 and change nothing. Anonymous play SHALL simply never call the Progress API; it reads and writes only Local progress.
- The Progress API SHALL resolve the user only from the session `user.id`, and SHALL ignore any user, profile or ID fields sent by the client.
- A user SHALL be able to read and write only their own Server progress.

### R4. Mission transcript
- WHILE a user plays a mission (signed in or signed out), the app SHALL record the Transcript for the current attempt, appending one step per command run, so that a later sign-in can verify an anonymously completed mission.
- The app SHALL persist the current Transcript in localStorage per user and mission, so a reload resumes the same attempt without losing steps.
- WHEN the user restarts a mission, the app SHALL start a new, empty Transcript for that mission.
- WHEN the Server accepts a completion, the app SHALL delete the local Transcript for that mission.
- WHEN all objectives pass in the browser, the app SHALL submit the completion with its Transcript.
- IF a completion request body exceeds 1 MB, a Transcript exceeds 300 steps, or any step's `hcl` exceeds 64 KB, THEN the Server SHALL reject it with 413 and change nothing.
- IF a Transcript is malformed (missing or non-string `command`/`hcl`, unknown provider), THEN the Server SHALL reject it with 400 and change nothing.
- The Server SHALL NOT store Transcripts beyond the lifetime of the request.

### R5. Server-side validation of progress
- WHEN a mission completion is submitted, the Server SHALL reject (400) any `missionId` not in the Mission catalog.
- IF a submitted mission is not yet unlocked for that user (not `mission-01` and no completed mission, verified or unverified, lists it in `unlocks`), THEN the Server SHALL reject the completion with 409.
- The Server SHALL accept a completion only if Replay of the submitted Transcript ends with every objective of that mission latched. IF any objective is not latched, THEN the Server SHALL reject with 422 and change nothing.
- The simulator and objective checks SHALL be a single shared module used by both the browser and the Server, so that a Transcript whose objectives all pass in the browser SHALL also pass Replay on the Server.
- The Replay outcome SHALL be independent of the random resource IDs generated by the simulator: for any Transcript, every Replay SHALL produce the same set of latched objectives.
- The Server SHALL set XP and level from Derived XP and `LEVEL_THRESHOLDS`. XP, level, badge IDs and `verified` flags sent by the client SHALL be ignored.
- WHEN a mission is completed, the Server SHALL unlock only that mission's catalog `badgeId`.
- Mission completion SHALL be idempotent: submitting a passing completion for an already verified mission again (including concurrent duplicates) SHALL leave XP, badges and `completedAt` unchanged and return the current progress with 200.
- WHEN a passing completion is submitted for an Unverified completion, the Server SHALL set `verified = true` and leave `completedAt`, Derived XP and badges unchanged.
- The Server SHALL bound stat increments per request (non-negative integers, capped per field) and reject malformed bodies with 400.

### R6. Progress persisted per GitHub account
- WHEN a user signs in for the first time and has no Profile, the Server SHALL create one with `mission-01` available.
- WHEN a signed-in user loads the app on any device or browser, the app SHALL show Server progress (XP, level, completed missions with verified status, badges, stats, selected provider).
- WHEN a signed-in user completes a mission, changes provider, uses a hint or runs commands, the app SHALL save the change to Server progress.
- The selected cloud provider SHALL persist per user.
- Profile `username` SHALL default to the GitHub login/name and SHALL be made unique if it collides.
- Schema changes (`prisma db push`): add `Profile.provider`, and add `MissionProgress.verified` (boolean, default `false`) and `MissionProgress.verifiedAt` (nullable timestamp, for the R9 tie-break).

### R7. First sign-in merge of local progress
- WHEN a user signs in and Local progress exists that has not been merged for that user, the app SHALL send it to the Server once.
- The Server SHALL merge as follows, with no loss on either side:
  - Completed missions: union of local and server, keeping only catalog IDs. Earliest `completedAt` wins.
  - Local completions that are not already completed on the Server SHALL be stored as Unverified completions. Existing Verified completions stay verified.
  - Badges: union, keeping only badges belonging to a completed mission.
  - XP and level: recomputed as Derived XP from the merged set. Local XP is never added directly.
  - Stats: per field, the larger value.
  - In-progress missions: kept unless the mission is already completed.
  - Provider: server value if set, otherwise local.
- Unverified completions SHALL count toward the player's own XP, level, unlocks and badges, and SHALL be excluded from Verified XP.
- The merge SHALL skip the unlock-order check and Replay from R5, so a valid local chain is never dropped.
- The merge SHALL be idempotent: merging the same Local progress twice gives the same Server progress.
- WHEN the merge succeeds, the app SHALL replace Local progress with Server progress and record that this user's local data is merged.
- IF the merge fails, THEN the app SHALL keep Local progress untouched and retry on the next load.
- WHEN a different user signs in on the same browser, the app SHALL NOT merge the previous user's synced progress into the new account.
- WHILE a mission is an Unverified completion, the app SHALL mark it as unverified on the mission list and mission page and offer a "Replay to verify" action that starts a new attempt with an empty Transcript.

### R8. Offline and failed saves
- IF a save fails (network error or 5xx), THEN the app SHALL keep the change locally, show a non-blocking "not saved, retrying" indicator, and retry with backoff.
- WHEN connectivity returns or the page reloads, the app SHALL resend pending changes. Because completions are idempotent (R5) and merges are idempotent (R7), resending SHALL NOT double-count.
- IF the Server returns 401, THEN the app SHALL keep pending changes and prompt the user to sign in again.
- IF the Server returns 400, 409, 413 or 422, THEN the app SHALL drop that change, reload Server progress, show the rejection reason, and keep the local Transcript so the user can retry the mission.
- IF the Server returns 429, THEN the app SHALL keep pending changes and retry after the `Retry-After` interval.
- Gameplay SHALL stay usable while saves are failing.

### R9. Shared leaderboard
- WHEN anyone opens `/leaderboard`, the Server SHALL return profiles ranked by Verified XP descending, ties broken by earliest time that Verified XP was reached (latest `verifiedAt` among the profile's Verified completions), limited to the top 100.
- Each entry SHALL contain only rank, display name, avatar URL, Verified XP, level/title and Verified completion count.
- The leaderboard response SHALL NOT include email, user ID, account/OAuth tokens or any other User/Account field.
- WHILE a user is signed in, the leaderboard SHALL highlight that user's row, and SHALL show their rank even if outside the top 100.

### R10. Abuse limits
- IF a user sends more than 30 requests per minute to Progress write endpoints (merge endpoint included), THEN the Server SHALL reject further requests in that minute with 429 and a `Retry-After` header, and change nothing.
- The rate limit SHALL be keyed by session `user.id`.
- The rate limit MAY be held in memory per Lambda instance. This is best-effort: limits are not shared across instances and reset on cold start.

## Out of scope
- Other OAuth providers, account linking, profile editing, deleting accounts.
- Real-time leaderboard updates (refresh on page load is enough).
- Anti-cheat beyond R4, R5 and R10.
- Hints revealing solutions is a game-design concern, not a verification gap.
