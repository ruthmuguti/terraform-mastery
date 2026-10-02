# Requirements: AI Terraform Tutor

## Context
TerraOps teaches Terraform through a deterministic in-browser simulator (`src/lib/terraform-simulator.ts`). Each mission has objectives with pre-written tiered hints (`src/lib/types.ts` → `MissionObjective.hints`). The product itself contains no runtime AI — the "no mentor required" pitch is currently served by static hints.

This feature adds an AI tutor powered by **Amazon Bedrock** that explains, in context, why a learner's HCL or Terraform command failed and nudges them toward the fix — without handing over the answer. It keeps the app on AWS, strengthens the social-good thesis (an on-demand mentor), and gives the hackathon a runtime "technical innovation" / AI component.

Primary integration point: `src/components/missions/MissionExecutor.tsx`, which already holds the live `hcl`, `simState`, `commandHistory`, the current objective, and the terminal lines (including `type: "error"` lines from the simulator).

## Requirements

### R1. Context-aware tutoring
- WHEN a learner opens the tutor on a mission THEN the response SHALL be grounded in their current `hcl`, the active objective's `description`, the last Terraform command, and any recent simulator error lines.
- The tutor SHALL answer only Terraform / IaC / mission-relevant questions and decline off-topic requests.

### R2. Teach, don't solve
- The tutor SHALL explain the cause of an error and give a conceptual nudge or a minimal corrected snippet, not a full ready-to-paste solution for the whole objective.
- WHEN a learner explicitly asks for the full answer THEN the tutor SHALL still prefer the smallest hint that unblocks them.

### R3. Streaming UX
- The response SHALL stream token-by-token into the mission UI so feedback starts within ~1s.
- WHILE a response is streaming THEN the trigger control SHALL show a loading state and be non-re-entrant.

### R4. Runs on AWS, cost-bounded
- Inference SHALL use Amazon Bedrock in a Region where the chosen model is enabled (eu-west-1 if available, else us-east-1 via a configurable Region).
- Each request SHALL cap output tokens (e.g. 400) and trim/limit the HCL and transcript sent, to bound cost and latency.
- The Amplify compute role SHALL be granted only `bedrock:InvokeModelWithResponseStream` (+ `bedrock:InvokeModel`) on the specific model ARN.

### R5. Abuse protection
- The API route SHALL rate-limit per user/IP (e.g. N requests/min) and reject oversized payloads.
- The route SHALL validate and bound all inputs (max HCL length, max message length, max transcript entries).

### R6. Graceful failure
- WHEN Bedrock is unavailable, throttled, or access is denied THEN the UI SHALL fall back to the existing static hints and show a brief, non-blocking message. The mission SHALL remain fully playable.
- Tutor usage SHALL never affect objective checks, XP, or the server-verified leaderboard.

### R7. Secrets and config
- No API keys in the client bundle or repo. Bedrock access SHALL use the Amplify compute IAM role (no long-lived keys).
- Model ID and Region SHALL be configurable via environment variables (`BEDROCK_MODEL_ID`, `BEDROCK_REGION`).

## Out of scope
- Natural-language → HCL generation, AI code review, and AI-generated missions (candidate follow-ups).
- Persisting tutor conversations to the database.
- Multi-turn memory beyond the current request (v1 is single-shot Q&A with provided context).
