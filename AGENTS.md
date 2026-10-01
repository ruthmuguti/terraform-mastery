<!-- BEGIN:nextjs-agent-rules -->
# Next.js 15.5 (pinned)

This project runs `next@15.5.27` (and `eslint-config-next@15.5.27`), pinned exactly. It was downgraded from 16 because AWS Amplify Hosting SSR supports Next.js 12–15 only.

- App Router only (`src/app`). React 19.
- `params`, `searchParams`, `cookies()` and `headers()` are async. Await them.
- Request interception goes in `middleware.ts`, not `proxy.ts`.
- Don't use Next 16-only APIs: `"use cache"`, stable `cacheLife`/`cacheTag`, `updateTag`, `proxy.ts`.
- Don't upgrade to Next 16 until Amplify Hosting supports it.
<!-- END:nextjs-agent-rules -->

# Deployment

- AWS Amplify Hosting (`WEB_COMPUTE`, eu-west-1), auto-builds from `main` using `amplify.yml`.
- Amplify env vars reach the SSR runtime only through `.env.production`, written at build time from an allowlist in `amplify.yml`. Add any new server env var to that allowlist and to the Amplify app env vars.
- Prisma: `prisma generate` only (runs on `postinstall`). There are no migrations; the schema is applied with `prisma db push`.
