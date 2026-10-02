# Tasks: Ship TerraOps on AWS Amplify

- [x] 1. Pre-flight
  - Confirm `AWS_PROFILE=ruth-terraform` identity (166390307452, eu-west-1).
  - Confirm Supabase project is active and reachable with `DATABASE_URL`.
  - Create a $5/month AWS Budget alert to Ruth's email.
  - _R3, R6_

- [x] 2. Restructure the project for Amplify
  - [x] 2.1 Pin `next` and `eslint-config-next` to latest 15.5.x. Add `dotenv` as a pinned dependency. `npm install`.
  - [x] 2.2 Fix any type/lint/build breakage from the downgrade (eslint flat config, async params types, etc.).
  - [x] 2.3 Add `amplify.yml` (Node 20, `npm ci`, env → `.env.production`, `next build`, caches).
  - [x] 2.4 NextAuth prod config: support `AUTH_SECRET`/`AUTH_URL`/`AUTH_TRUST_HOST`, update `.env.example`.
  - [x] 2.5 Update `AGENTS.md`/`CLAUDE.md` to say Next 15 + Amplify.
  - [x] 2.6 `npm run build` + `npm run start` locally; smoke test `/`, `/login`, dashboard, a mission, leaderboard.
  - _R2, R4, R5_

- [x] 3. Commit and push to `main` (Ruth's go-ahead first)
  - Stage specific files only. Confirm `.env` is not included.
  - _R4, R5_

- [x] 4. Create the Amplify app (Ruth, about 2 minutes, in the console)
  - Amplify console (eu-west-1) → Create new app → GitHub → authorize → `ruthmuguti/terraform-mastery`, branch `main`. Don't deploy yet, or let the first build fail. That's fine.
  - Screenshot this for the hackathon proof.
  - _R1, R6_

- [x] 5. Configure and deploy (Kiro, via CLI)
  - [x] 5.1 Set app env vars from `.env` (`DATABASE_URL`, `DIRECT_URL`, `AUTH_SECRET`, `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET`, `AUTH_TRUST_HOST=true`, `AUTH_URL`/`NEXTAUTH_URL` = Amplify URL).
  - [x] 5.2 Set platform `WEB_COMPUTE`, framework Next.js SSR, enable branch auto-build.
  - [x] 5.3 Start a build job, watch logs, fix failures.
  - [x] 5.4 `curl` the live URL: `/` returns 200, `/api/auth/providers` lists GitHub.
  - _R1, R2, R4, R5_

- [x] 6. GitHub OAuth (Ruth, manual)
  - In GitHub → Settings → Developer settings → OAuth Apps: set the homepage to the Amplify URL and the callback to `https://main.<appid>.amplifyapp.com/api/auth/callback/github`. Or create a separate prod OAuth app and Kiro updates the env vars.
  - Test sign-in, mission progress, leaderboard end to end.
  - _R2_

- [ ] 7. Hackathon proof and write-up
  - [x] 7.1 `docs/kiro-aws-proof.md`: Kiro's `sts get-caller-identity`, CLI commands run, resources created, screenshot placeholders.
  - [x] 7.2 README: what TerraOps is, live URL, architecture, cost, how Kiro helped, category + lane tags, redeploy/teardown.
  - [ ] 7.3 Commit and push (auto-redeploys).
  - _R6_

## Fallback
If Next 15 or Amplify blocks us for over an hour: keep Next 16, containerize with `output: "standalone"`, deploy to a Lightsail nano container service (~$7/month, HTTPS URL included).
