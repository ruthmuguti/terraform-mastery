# Requirements: Natural-language → HCL generator

## Context
TerraOps teaches Terraform by having learners write HCL in a Monaco editor and run it through a deterministic simulator. The AI tutor (Amazon Bedrock, Claude Haiku) already ships: `src/app/api/tutor/route.ts` + `src/lib/tutor-prompt.ts` + a panel in `src/components/missions/MissionExecutor.tsx`. This feature reuses that proven Bedrock plumbing (same model, same compute IAM role, same streaming pattern).

Goal: let a learner describe infrastructure in plain English ("an S3 bucket with versioning enabled") and have Bedrock draft **starter** HCL they can load into the editor, then run through the real simulator themselves. It lowers the blank-page barrier without doing the mission for them.

## Requirements

### R1. Generate HCL from a prompt
- WHEN a learner submits a plain-English description THEN the system SHALL return syntactically plausible HCL for the learner's current provider (aws/gcp/azure).
- The output SHALL be HCL only (optionally with brief comments), not prose, so it can drop straight into the editor.

### R2. Scaffold, not solve
- The generated HCL SHALL be a reasonable **starting point** that the learner still has to understand, run, and often adjust — not a guaranteed mission-passing answer.
- WHEN a learner tries to use it to trivially complete the current objective THEN mission completion SHALL still be decided only by the simulator replaying their commands (unchanged from today).

### R3. Insert into the editor safely
- The learner SHALL review the draft before it replaces editor content, and SHALL be able to accept (replace editor) or dismiss it.
- Accepting SHALL be undoable via the existing "restore starter code" control and normal editor undo.

### R4. Reuse AWS + guardrails
- Inference SHALL use the existing Bedrock model/Region and the Amplify compute role. No new IAM, no keys.
- The route SHALL validate/bound input (prompt length), rate-limit per IP, and treat the learner prompt as untrusted data (no prompt-injection, stay on Terraform).

### R5. Streaming + graceful failure
- The draft SHALL stream into a preview area.
- WHEN Bedrock is unavailable THEN the editor SHALL keep working normally and a brief message SHALL show; nothing about progress/XP is affected.

## Out of scope
- Validating the generated HCL against the simulator before showing it (the learner runs it).
- Multi-file / module generation.
