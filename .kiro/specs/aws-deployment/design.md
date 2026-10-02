# Design: TerraOps on AWS (lowest cost)

## Hosting choice

| Option | Monthly cost | Verdict |
|---|---|---|
| **Amplify Hosting (SSR compute)** | **~$0–1** (pay per request/GB; free tier if eligible) | **Chosen.** Managed Next.js SSR, HTTPS URL, auto-deploy from GitHub. Supports Next.js 12–15 only, so we downgrade from 16 to 15. |
| ECS Fargate + ALB + CloudFront | ~$35 | Dropped. ALB alone is ~$18/month. |
| Lightsail container (nano) | ~$7 | Fallback if Amplify blocks us. |
| App Runner | n/a | Closed to new customers. |
| Lambda via OpenNext | ~$0 | Same cost as Amplify, more moving parts. Not worth it before the deadline. |

Amplify list prices: build $0.01/min, data out $0.15/GB, SSR requests $0.30 per 1M, compute $0.20 per GB-hour. Hackathon traffic stays well under $1.

## Architecture

```
Judge browser ──HTTPS──> Amplify Hosting (https://main.<appid>.amplifyapp.com)
                           ├─ static assets on Amplify CDN
                           └─ SSR + /api/auth on Amplify compute
                                      │
                                      ▼
                    Supabase Postgres (eu-west-1, pooler :6543, unchanged)
GitHub push to main ──> Amplify build ──> deploy
```

## Project changes

1. **Downgrade Next.js 16.2.6 → latest 15.5.x**, pinned exactly: `next` and `eslint-config-next`. React 19.2.4 stays (Next 15 supports React 19).
   - The code uses no Next 16-only APIs (`"use cache"`, `updateTag`, `cacheLife`, `proxy.ts`). Checked with grep.
   - Check the `eslint.config.mjs` flat config still works with `eslint-config-next@15`, or adjust it.
   - Remove `AGENTS.md`/`CLAUDE.md` Next 16 notes once downgraded (they'd mislead future agents).
2. **Add `dotenv` as an explicit dependency.** `prisma.config.ts` imports `dotenv/config` but it isn't in `package.json`, and a clean CI install could fail.
3. **Add `amplify.yml`:**
   - Node 20 (`nvm use 20`).
   - `npm ci` (postinstall runs `prisma generate`).
   - Write the needed env vars into `.env.production` before `next build`. Amplify SSR only sees runtime env vars this way.
   - Artifacts: `.next`, cache `node_modules` + `.next/cache`.
4. **NextAuth on Amplify:** set `AUTH_TRUST_HOST=true` and `AUTH_URL`/`NEXTAUTH_URL` to the Amplify URL. Rename the secret to `AUTH_SECRET` (keep `NEXTAUTH_SECRET` too for v5 compatibility).
5. **README:** replace the Vercel boilerplate with the project write-up.

## Secrets
Amplify app environment variables (set by Kiro via `aws amplify update-app`, values read from local `.env`, never echoed). They're encrypted at rest and visible only to account admins. We skip Secrets Manager ($0.40/secret/month, and Amplify SSR can't read it natively without extra code).

## Connecting GitHub
Amplify needs access to the private repo. Two ways:
- **A (default): Amplify console, "Deploy an app → GitHub"**. Ruth authorizes the Amplify GitHub App in the browser (about 2 minutes). This doubles as the console proof for the hackathon.
- B: Kiro creates the app via CLI with a GitHub fine-grained PAT that Ruth generates.

Everything else (env vars, branch settings, triggering builds, checking logs) Kiro does via the AWS CLI.

## Database
Keep Supabase free tier. It already runs in AWS eu-west-1, the same region as the Amplify app. Use the transaction pooler URL (`:6543?pgbouncer=true`) at runtime, which suits serverless compute. Confirm the project isn't paused.

## Risks
- Next 15 downgrade surfaces lint/type errors → fix during task 2. Fallback: Lightsail nano container on Next 16.
- Prisma 7 generated client is pure JS with the pg adapter (no native engine), so it should bundle fine on Amplify compute. Verify on the first deploy.
- Amplify SSR log visibility is limited (CloudWatch is under the Amplify service role). Enable it on app creation.
- GitHub OAuth callback is a manual step for Ruth.

## Cost controls
- AWS Budget alert at $5/month on the account (free for the first two budgets).
- Teardown: `aws amplify delete-app --app-id <id>`.

## Hackathon positioning (suggestion)
- Category `#social-good` (Education: cloud skills/workforce development) + lane `#community`. Use `#startups` for a product pitch.
- Story: a Terraform learning platform, moved from Vercel to AWS by a coding agent in a day, running for pennies a month.
