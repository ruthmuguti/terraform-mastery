# Requirements: Ship TerraOps (terraform-mastery) live on AWS

## Context
- App: Next.js 16.2.6 (App Router), React 19, Prisma 7 + `@prisma/adapter-pg`, NextAuth v5 (GitHub OAuth, JWT sessions), Postgres on Supabase (eu-west-1, free tier).
- Previously targeted Vercel. Never deployed to AWS.
- Target AWS account: `166390307452` (profile `ruth-terraform`, IAM user `ruthm`, admin), region `eu-west-1`.
- GitHub repo `ruthmuguti/terraform-mastery` (private).
- Deadline: October 2, 2026. Shipping live is pass/fail.
- Ruth is fine with restructuring the project. Lowest possible cost is the top priority.

## Requirements

### R1. Public URL on AWS
- WHEN a judge opens the submitted URL THEN the landing page SHALL load over HTTPS from AWS.
- The URL SHALL stay up through judging (to at least October 23, 2026).

### R2. Full app works in production
- GitHub sign-in SHALL complete and land on the dashboard.
- Missions, terminal simulator, achievements, and leaderboard SHALL read/write the database without errors.

### R3. Lowest cost
- Hosting SHALL be pay-per-use with no always-on compute or load balancer (target: under $1/month at hackathon traffic).
- No new paid database. Keep Supabase free tier.

### R4. Secrets handled safely
- `.env` SHALL never be committed or uploaded.
- Secrets SHALL live only in the AWS-side app configuration, not in the repo or build logs.

### R5. Simple redeploy
- A `git push` to `main` SHALL redeploy automatically.

### R6. Hackathon proof
- Documented proof that Kiro is connected to the AWS account (CLI identity, commands run, resources created, console screenshots).
- README write-up: what it is, how Kiro helped, category, lane, live URL.

## Out of scope
- RDS, custom domain, containers, autoscaling.
