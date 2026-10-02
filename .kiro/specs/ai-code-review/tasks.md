# Tasks: AI code review on mission completion

(Depends on `src/lib/rate-limit.ts` extracted in the HCL-generator spec, task 1.)

- [ ] 1. `src/lib/review-prompt.ts`: pure system/user prompt builder + validation (hcl non-empty ≤4KB, provider in set). Encouraging, security-focused, concise, snippets-not-rewrites.
- [ ] 2. `src/app/api/review/route.ts`: Node runtime, validate (400/413), rate-limit (429), stream Bedrock output, 503 on failure. Reuse shared rate-limit helper.
- [ ] 3. Add "Review my code" to the completion banner in `MissionExecutor.tsx`; stream into an aria-live block; never touches XP/progress.
- [ ] 4. Build + local smoke test against live Bedrock: complete a mission, request review, confirm it references the actual HCL and gives security/style feedback; confirm XP/progress untouched.
- [ ] 5. Commit, push, watch Amplify build, verify on live URL.
- [ ] 6. README + `docs/kiro-aws-proof.md`: add code review as the third Bedrock feature.
