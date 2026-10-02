# Tasks: AI Terraform Tutor

- [ ] 1. Enable Bedrock + IAM (AWS, mostly Kiro via CLI; model access is a console click)
  - [ ] 1.1 Enable model access for the chosen Claude model in the Bedrock console (`BEDROCK_REGION`). One-time manual step for Ruth.
  - [ ] 1.2 Add an inline policy to the Amplify compute role: `bedrock:InvokeModelWithResponseStream` + `bedrock:InvokeModel` on the model ARN.
  - [ ] 1.3 Confirm model + Region with a one-off server-side `InvokeModel` smoke test.
  - _R4, R7_

- [ ] 2. Server route `src/app/api/tutor/route.ts`
  - [ ] 2.1 Add `@aws-sdk/client-bedrock-runtime`. Set `runtime = "nodejs"`.
  - [ ] 2.2 Validate + bound inputs (HCL ≤4KB, question ≤500, ≤20 error lines); 400/413 on bad/oversized input.
  - [ ] 2.3 In-memory per-IP rate limiter; 429 on exceed.
  - [ ] 2.4 Prompt builder (system rules for teach-don't-solve + on-topic; user context from mission/hcl/command/errors). Unit-testable pure function.
  - [ ] 2.5 Call `InvokeModelWithResponseStream`, relay text deltas as a `ReadableStream` (`text/plain`). Map AccessDenied/Throttling/timeout → 503.
  - _R1, R2, R3, R4, R5_

- [ ] 3. Client tutor panel in `MissionExecutor.tsx`
  - [ ] 3.1 Add tutor state; derive recent `errorLines` from `termLines`.
  - [ ] 3.2 "Ask the tutor" button in the mission-brief sidebar; also surface it when the last command yielded error lines.
  - [ ] 3.3 Stream the response (`res.body.getReader()`) into an `aria-live` panel; disable the trigger while streaming.
  - [ ] 3.4 Optional free-text question box.
  - [ ] 3.5 On failure, show a short message and keep static hints working. Never call `completeMission`/progress from this path.
  - [ ] 3.6 Style with existing noir/gold hint classes.
  - _R2, R3, R6_

- [ ] 4. Config + build
  - [ ] 4.1 Add `BEDROCK_MODEL_ID`, `BEDROCK_REGION` to `.env.example` and the `amplify.yml` env allowlist.
  - [ ] 4.2 Set the same env vars on the Amplify app via CLI.
  - _R4, R7_

- [ ] 5. Tests
  - [ ] 5.1 Unit: validation/truncation, rate-limit bucket, prompt builder snapshot.
  - [ ] 5.2 Integration with mocked Bedrock: streamed body on success; 400/413/429/503 paths.
  - _R1, R2, R5_

- [ ] 6. Verify locally, then live
  - [ ] 6.1 `npm run build` + local run; trigger an HCL error, confirm streamed on-topic, non-spoiler reply.
  - [ ] 6.2 Confirm the mission still completes via the simulator with the tutor untouched (cheat-proof check).
  - [ ] 6.3 Deploy; repeat on the live Amplify URL; confirm fallback when Bedrock is denied/throttled.
  - _R1, R2, R3, R6_

- [ ] 7. Docs
  - [ ] 7.1 README: add the AI tutor to the feature list and stack (Amazon Bedrock).
  - [ ] 7.2 `docs/kiro-aws-proof.md`: record the Bedrock enablement, IAM policy, and env config as added AWS work.
  - _R7_

## Fallback
If streaming through Amplify SSR misbehaves or Bedrock access can't be enabled in time, ship the non-streamed single-JSON-response variant (same feature, slightly slower first paint). The static hint system is the ultimate fallback and already works.
