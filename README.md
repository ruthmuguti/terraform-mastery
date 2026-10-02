# 🔍 TerraOps — The Case of the Missing Cloud Engineer

> *"Go Go Gadget `terraform apply`!"*

**[ 🕹️ PLAY THE GAME → main.d1pm2ukx4d84ya.amplifyapp.com](https://main.d1pm2ukx4d84ya.amplifyapp.com)**

---

## 📋 Case File #001 — The Problem

*Filed by: Agent Ruth. Classification: URGENT. Clearance: Social Good.*

Every cloud job posting reads the same way:

> *"Must have 3+ years Terraform experience."*

But here's the mystery nobody talks about: **how do you get that experience when every learning resource assumes you already have a cloud account, credits, and a senior engineer looking over your shoulder?**

The clues don't add up. Bootcamps skip IaC entirely. YouTube tutorials break on the first `terraform init`. Official docs read like instruction manuals for appliances you don't own. And the real thing — running `terraform apply` against actual AWS infrastructure — costs money that aspiring engineers often don't have.

*Case status: Unsolved. Until now.*

---

## 🕵️ Enter TerraOps — Your Gadget Belt for Infrastructure

**TerraOps is a free, browser-based, gamified Terraform training platform.**

No AWS account. No credit card. No senior engineer on standby. Just you, a mission briefing, and a simulated cloud terminal that responds exactly like the real thing.

Write actual HCL. Run actual Terraform commands. Watch your infrastructure plan, apply, and come to life — all inside a browser tab.

**[ → Crack your first case now](https://main.d1pm2ukx4d84ya.amplifyapp.com)**

---

## 🗂️ The Evidence — What We Built

*Exhibit A through Z, your honour.*

### 15 Progressive Missions Across 5 Chapters

Each mission is a case file. Each case file has a briefing, objectives, and classified intel (hints) you can unlock if you get stuck.

| Chapter | Code Name | Missions |
|---|---|---|
| CH.1 | Foundation | OP-INIT, OP-RESOURCE |
| CH.2 | Field Operations | OP-VARIABLES, OP-STATE, OP-DATA |
| CH.3 | Advanced Tactics | OP-MODULES, OP-REMOTE |
| CH.4 | Expression Mastery | OP-LOCALS, OP-FOREACH, OP-FUNCTIONS |
| CH.5 | Production Hardening | OP-SECRETS, OP-LIFECYCLE, OP-CONDITIONALS, OP-WORKSPACE, OP-VALIDATE |

Chapter 5 is drawn directly from *Terraform: Up and Running, 3rd Edition* — the concepts working engineers use every day in production.

### Your Gadget Belt (The Terminal)

The in-browser terminal simulates the full Terraform CLI:

```bash
$ terraform init       # downloads provider plugins
$ terraform plan       # previews changes
$ terraform apply      # deploys infrastructure
$ terraform workspace  # manage environments
$ terraform state      # inspect state files
```

No cloud. No costs. Full fidelity.

### Three Cloud Providers, One Curriculum

Every mission adapts to your chosen provider — **AWS, GCP, or Azure** — with provider-specific starter code, resource types, and check functions. Pick your cloud, learn the same concepts.

### The Gamification Layer

Because learning without dopamine is just reading.

- **XP & 10 Levels** — Terraform Rookie → IaC Architect
- **26+ Badges** — including the legendary *Production Ready* 🚀 badge
- **Global Leaderboard** — server-verified completions only. No cheating the case.
- **Day Streaks** — because consistency is the real skill
- **Progressive Hints** — stuck? Spend a hint. The mission waits. No judgement.

---

## 🔬 The Investigation — Technical Architecture

*How the case was cracked, forensically.*

```
terraform-mastery/
├── src/
│   ├── app/                    # Next.js 15.5 App Router
│   │   ├── (app)/             # Authenticated layout
│   │   ├── api/               # Progress sync, leaderboard, auth
│   │   └── login/             # GitHub OAuth entry point
│   ├── components/
│   │   ├── missions/          # MissionExecutor — the beating heart
│   │   └── layout/            # Collapsible sidebar, TopBar
│   ├── lib/
│   │   ├── terraform-simulator.ts  # The entire Terraform CLI, in TypeScript
│   │   ├── store.ts           # Zustand — client state & progress
│   │   └── auth.ts            # NextAuth v5 with Prisma adapter
│   └── data/
│       ├── missions.ts        # 15 missions, 3 providers each, tiered hints
│       └── badges.ts          # 26 badges with rarity tiers
├── prisma/schema.prisma        # PostgreSQL schema
└── amplify.yml                 # AWS Amplify build config
```

### The Terraform Simulator

The real investigation is here. `terraform-simulator.ts` is a complete TypeScript implementation of the Terraform CLI — parsing HCL, tracking state, simulating plan/apply/destroy/workspace cycles, and returning realistic output line by line. It runs identically client-side (for instant feedback) and server-side (for cheat-proof mission verification).

```
terraform init    → parses required_providers, simulates plugin download
terraform plan    → diffs HCL against state, generates plan resources
terraform apply   → creates resources, assigns mock IDs, captures outputs
terraform workspace → creates isolated state per workspace
```

No mock data. No scripted responses. Every command is computed from your actual HCL.

### Server-Side Mission Verification

When a mission completes, the server replays the entire command transcript against the simulator independently. This makes the leaderboard trustworthy — the server saw the same `terraform apply` you did.

### The Tech Stack

| Layer | Tool |
|---|---|
| Framework | Next.js 15.5 (App Router, React 19) |
| Language | TypeScript end-to-end |
| Styling | Tailwind CSS v4 |
| Editor | Monaco Editor with custom HCL language |
| Auth | NextAuth v5 (GitHub OAuth) |
| Database | Supabase (PostgreSQL) + Prisma ORM 7 |
| State | Zustand + localStorage |
| Testing | Vitest + fast-check (property-based) |
| Deployment | **AWS Amplify Hosting (eu-west-1)** |
| AI Agent | **Kiro** |

---

## 🤖 Built with Kiro — The AI Partner on the Case

*Every great detective has a sidekick. Ours writes code.*

TerraOps was developed using **[Kiro](https://kiro.dev)** — AWS's AI-powered development environment. Kiro didn't just autocomplete — it designed, implemented, and deployed entire features.

### What Kiro Did

**AWS Deployment Automation**
Kiro handled the full AWS setup:
- Created the Amplify app, build specification, and environment configuration
- Configured 8 production environment variables via AWS CLI
- Diagnosed and fixed Next.js 16→15.5 compatibility for Amplify SSR
- Verified the live deployment with endpoint testing
- [Full deployment proof → `docs/kiro-aws-proof.md`](./docs/kiro-aws-proof.md)

**Progress Sync System (9,600+ lines)**
Kiro designed and built the entire server-side verification system from scratch:
- Wrote 10 requirements + 22 acceptance criteria before touching a file
- Implemented transcript replay, idempotent completion endpoints, and the first-sign-in progress merge algorithm
- Built the verified leaderboard (server-validated XP only)
- Added offline queue with automatic retry
- Property-based tests covering merge correctness, idempotency, and rank ordering

**Development Philosophy Kiro Established**
- Spec first, code second
- Property-based testing for critical logic
- Security by default (rate limiting, input validation, authorization)
- Offline-first with sync resilience

---

## 🎯 Why This Is Social Good

*The case for the judges.*

**The skill gap is real and measurable.** Terraform/IaC skills command $90k–$150k salaries. DevOps and cloud engineering are among the fastest-growing job categories globally. But the barrier to practice is high: you need cloud credits, real infrastructure, and usually someone to show you the ropes.

**TerraOps removes all three barriers:**

1. ✅ No cloud account needed — the simulator is the cloud
2. ✅ No credits needed — runs in a browser tab
3. ✅ No mentor needed — progressive hints and mission briefings guide you

**Who this helps most:**
- Career changers who can't afford cloud practice costs
- Students in regions where AWS credits don't reach
- Bootcamp graduates skipped by IaC curricula
- Anyone told "you need experience to get experience"

This is workforce development. This is the education focus of the Social Good category. And it's live right now.

**[ → Try a mission](https://main.d1pm2ukx4d84ya.amplifyapp.com)**

---

## 🚀 Run It Yourself

```bash
git clone https://github.com/ruthmuguti/terraform-mastery.git
cd terraform-mastery
npm install
cp .env.example .env   # fill in Supabase + GitHub OAuth values
npx prisma db push
npm run dev
# open http://localhost:3000
```

**Required env vars:**
- `DATABASE_URL` — Supabase connection string (pgBouncer)
- `DIRECT_URL` — Supabase direct connection (Prisma migrations)
- `AUTH_SECRET` — `openssl rand -base64 32`
- `GITHUB_CLIENT_ID` + `GITHUB_CLIENT_SECRET` — GitHub OAuth app

---

## 🧪 Tests

```bash
npm test
```

Property-based tests (fast-check) validate:
- Progress merge algorithm correctness across arbitrary completion sequences
- Idempotent operation guarantees
- Leaderboard ranking consistency
- Transcript replay determinism

---

## 📦 Deployment

Auto-deploys to AWS Amplify on every push to `main`:

```bash
git push origin main   # Amplify picks it up automatically
```

Build time: ~4 minutes. Platform: `WEB_COMPUTE`. Region: `eu-west-1`.

---

## 🏷️ Hackathon Tags

`#social-good` `#community`

**Category:** Social Good → Education (quality learning, skill-building, workforce development)
**Lane:** Community — built for engineers who are learning, not yet earning

---

## 📄 License

MIT — take it, fork it, build on it.

---

*Case closed. Infrastructure deployed. Go Go Gadget `terraform apply`.*

**[ → Play TerraOps](https://main.d1pm2ukx4d84ya.amplifyapp.com)**

---

*Built with Kiro AI for the AWS Zero to Shipped Hackathon.*
