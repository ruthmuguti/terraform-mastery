# TerraOps

> A free, browser-based, gamified Terraform training platform. Write real HCL, run real Terraform commands, and watch infrastructure plan and apply — no AWS account, no credit card, no cost.

<p align="center">
  <a href="https://main.d1pm2ukx4d84ya.amplifyapp.com"><strong>▶ Play the live app</strong></a>
</p>

<p align="center">
  <img alt="Next.js" src="https://img.shields.io/badge/Next.js-15.5-black?logo=next.js">
  <img alt="React" src="https://img.shields.io/badge/React-19-61dafb?logo=react&logoColor=white">
  <img alt="TypeScript" src="https://img.shields.io/badge/TypeScript-5-3178c6?logo=typescript&logoColor=white">
  <img alt="Prisma" src="https://img.shields.io/badge/Prisma-7-2d3748?logo=prisma&logoColor=white">
  <img alt="AWS Amplify" src="https://img.shields.io/badge/AWS%20Amplify-Hosting-ff9900?logo=awsamplify&logoColor=white">
  <img alt="License: MIT" src="https://img.shields.io/badge/License-MIT-green">
</p>

---

## The problem

Every cloud job posting asks for Terraform experience. But practicing Terraform usually means an AWS account, credits, and running `terraform apply` against real infrastructure that costs money. Bootcamps often skip Infrastructure as Code entirely, and tutorials assume you already have a cloud environment set up.

TerraOps removes those barriers. It's a simulated cloud terminal that responds like the real thing, so you can learn by doing — for free, in a browser tab.

## What it does

- **15 progressive missions across 5 chapters** — from `terraform init` to production patterns (modules, remote state, lifecycle rules, workspaces, validation). Chapter 5 draws on concepts from *Terraform: Up and Running, 3rd Edition*.
- **A full Terraform CLI simulator** — `init`, `plan`, `apply`, `destroy`, `workspace`, and `state`, computed from your actual HCL. No scripted output.
- **Three providers** — AWS, GCP, and Azure, each with provider-specific starter code and resources.
- **Gamification** — XP and 10 levels, 26+ badges, day streaks, progressive hints, and a server-verified global leaderboard.
- **Cheat-proof verification** — on mission completion, the server replays your command transcript against the simulator independently, so only genuinely completed work counts toward the leaderboard.

## Tech stack

| Layer | Tool |
|---|---|
| Framework | Next.js 15.5 (App Router, React 19) |
| Language | TypeScript |
| Styling | Tailwind CSS v4 |
| Editor | Monaco Editor with a custom HCL language definition |
| Auth | NextAuth v5 (GitHub OAuth) |
| Database | Supabase (PostgreSQL) + Prisma ORM 7 |
| State | Zustand + localStorage |
| Testing | Vitest + fast-check (property-based) |
| Hosting | AWS Amplify Hosting (eu-west-1) |

## Project structure

```
src/
├── app/                        # Next.js App Router
│   ├── (app)/                  # Authenticated layout (dashboard, missions, etc.)
│   ├── api/                    # Progress sync, leaderboard, auth
│   └── login/                  # GitHub OAuth entry point
├── components/                 # Mission executor, terminal, layout, UI
├── lib/
│   ├── terraform-simulator.ts  # The Terraform CLI, in TypeScript
│   ├── store.ts                # Zustand client state and progress
│   └── auth.ts                 # NextAuth v5 with Prisma adapter
└── data/
    ├── missions.ts             # 15 missions, 3 providers each, tiered hints
    └── badges.ts               # 26 badges
prisma/schema.prisma            # PostgreSQL schema
amplify.yml                     # AWS Amplify build config
```

## Running locally

```bash
git clone https://github.com/ruthmuguti/terraform-mastery.git
cd terraform-mastery
npm install
cp .env.example .env    # fill in Supabase + GitHub OAuth values
npx prisma db push
npm run dev             # http://localhost:3000
```

### Environment variables

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | Supabase connection string (pgBouncer, port 6543) |
| `DIRECT_URL` | Supabase direct connection (Prisma migrations, port 5432) |
| `AUTH_SECRET` | NextAuth secret — generate with `openssl rand -base64 32` |
| `GITHUB_CLIENT_ID` / `GITHUB_CLIENT_SECRET` | GitHub OAuth app credentials |

## Tests

```bash
npm test
```

Property-based tests (fast-check) cover the progress-merge algorithm, idempotent completion endpoints, leaderboard ranking, and transcript-replay determinism.

## Deployment

Auto-deploys to AWS Amplify on every push to `main`:

```bash
git push origin main
```

Platform: `WEB_COMPUTE` (Next.js SSR). Region: `eu-west-1`. See [`docs/kiro-aws-proof.md`](./docs/kiro-aws-proof.md) for the AWS deployment details.

## Built with Kiro

TerraOps was developed with [Kiro](https://kiro.dev), AWS's AI-powered development environment, using a spec-first workflow (requirements → design → tasks before implementation — see [`.kiro/specs/`](./.kiro/specs/)). Kiro designed and built the server-side progress-sync and verification system, handled the AWS Amplify deployment via the AWS CLI, and migrated the app from Next.js 16 to 15.5 for Amplify SSR compatibility.

## About this project

Built for the AWS Zero to Shipped Hackathon.

- **Category:** Social Good → Education (quality learning, skill-building, workforce development)
- **Lane:** Community

Terraform and IaC skills command strong salaries and are among the fastest-growing job categories, but the barrier to practice is high. TerraOps removes the three main blockers — no cloud account, no credits, no mentor required — making it most useful for career changers, students in regions where cloud credits don't reach, and bootcamp graduates whose curricula skipped IaC.

## License

[MIT](./LICENSE) — take it, fork it, build on it.
