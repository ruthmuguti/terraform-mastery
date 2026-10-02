# Tasks: Natural-language → HCL generator

- [ ] 1. Extract shared rate-limit + client-IP helper into `src/lib/rate-limit.ts`; refactor `api/tutor/route.ts` to use it (no behavior change).
- [ ] 2. `src/lib/generate-prompt.ts`: pure system/user prompt builder + input validation (prompt 1–500, provider in set). HCL-only, scaffold-not-solve, untrusted-input guardrails.
- [ ] 3. `src/app/api/generate/route.ts`: Node runtime, validate (400/413), rate-limit (429), stream Bedrock output, strip stray ``` fences, 503 on failure.
- [ ] 4. Generator panel in `MissionExecutor.tsx`: prompt box, streamed preview, "Use this" (`setHcl`) + "Dismiss". aria-live, disabled-while-streaming, graceful error.
- [ ] 5. Build + local smoke test against live Bedrock: generate for aws/gcp, confirm HCL-only output and editor insert; confirm mission completion still simulator-only.
- [ ] 6. Commit, push, watch Amplify build, verify on live URL.
- [ ] 7. README + `docs/kiro-aws-proof.md`: add the generator as a second Bedrock feature.
