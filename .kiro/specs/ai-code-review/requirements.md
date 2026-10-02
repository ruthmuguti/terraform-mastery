# Requirements: AI code review on mission completion

## Context
When a learner completes all objectives of a mission, `MissionExecutor` shows a completion banner (`completionResult` state). Right now completion is purely "did it work." This feature adds an optional, one-click **AI code review** of the learner's final HCL, powered by the same Amazon Bedrock setup as the tutor and generator. It teaches beyond pass/fail — security, style, and best-practice feedback — reinforcing the learning mission.

## Requirements

### R1. Review on demand after completion
- WHEN a mission is complete THEN the completion UI SHALL offer a "Review my code" action.
- WHEN invoked THEN the system SHALL return feedback on the learner's final HCL: strengths, and concrete improvements (security, naming, structure, Terraform best practices).

### R2. Constructive and specific
- Feedback SHALL reference the learner's actual code (e.g. hardcoded values, missing variables, missing tags), not generic advice.
- Feedback SHALL be encouraging (they just passed) and concise.

### R3. Reuse AWS + guardrails
- SHALL use the existing Bedrock model/Region and Amplify compute role; no new IAM, no keys.
- SHALL validate/bound input, rate-limit per IP, and treat HCL as untrusted data.

### R4. Advisory only
- Review SHALL NOT change XP, badges, objective state, or progress. It is purely informational and SHALL appear only after completion is already awarded.

### R5. Streaming + graceful failure
- Feedback SHALL stream into the completion area.
- WHEN Bedrock is unavailable THEN completion SHALL be unaffected and a brief message SHALL show.

## Out of scope
- Scoring/grading the code or gating rewards on the review.
- Auto-applying suggested fixes.
