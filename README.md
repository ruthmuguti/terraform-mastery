# TerraOps: Master Terraform Through Missions

**Live Demo:** [https://main.d1pm2ukx4d84ya.amplifyapp.com](https://main.d1pm2ukx4d84ya.amplifyapp.com)

TerraOps is an interactive, gamified Terraform learning platform that teaches infrastructure-as-code through hands-on missions. Learn by doing—write real HCL, execute commands in a simulated terminal, and watch your infrastructure come to life with instant feedback.

## 🎯 What Makes TerraOps Different

- **Real Terraform Syntax**: Write actual HCL code with Monaco editor autocomplete
- **Instant Validation**: See your infrastructure changes in real-time without cloud costs
- **Progressive Learning**: 15 missions from basic resources to advanced multi-cloud deployments
- **Gamification**: Earn XP, unlock badges, and compete on the global leaderboard
- **Multi-Cloud Support**: Practice with AWS, Azure, and Google Cloud providers
- **Verified Progress**: Server-side mission replay ensures authentic skill verification

## 🚀 Key Features

### Interactive Learning Experience
- **Mission-Based Curriculum**: 15 progressive missions covering Terraform fundamentals through advanced concepts
- **Simulated Terminal**: Full command-line experience with `terraform init`, `plan`, `apply`, and `destroy`
- **HCL Code Editor**: Monaco-powered editor with syntax highlighting and IntelliSense
- **Real-Time Feedback**: Objectives update instantly as you execute commands
- **Hints System**: Get unstuck with progressive hints (costs XP but keeps you learning)

### Gamification & Progress Tracking
- **XP & Leveling**: Earn experience points and advance from "Trainee" to "Cloud Architect"
- **Achievement Badges**: Unlock 15+ badges for completing missions and milestones
- **Global Leaderboard**: Compete with verified completions—no cheating possible
- **Persistent Progress**: Sign in with GitHub to sync progress across devices
- **Anonymous Play**: Try missions without an account, then merge progress when you sign in

### Technical Excellence
- **Server-Side Verification**: Mission completion validated via transcript replay
- **Offline Support**: Keep playing with automatic sync when connection returns
- **Multi-Cloud Simulation**: Practice AWS, Azure, and GCP without real cloud accounts
- **Smart Unlocks**: Missions unlock progressively based on verified completions

## 🏗️ Architecture

### Tech Stack
- **Frontend**: Next.js 15.5 (App Router), React 19, TypeScript, Tailwind CSS 4
- **Authentication**: NextAuth v5 (GitHub OAuth)
- **Database**: Supabase (PostgreSQL) with Prisma ORM 7.8
- **State Management**: Zustand with localStorage persistence
- **Deployment**: AWS Amplify Hosting (WEB_COMPUTE, eu-west-1)
- **Testing**: Vitest + fast-check for property-based testing

### Key Technical Features
- **Shared Simulator Logic**: Same Terraform simulator runs client-side and server-side for validation
- **Transcript Recording**: Every command and HCL change captured for server-side replay
- **Idempotent Operations**: Mission completions and progress merges safe to retry
- **Rate Limiting**: 30 requests/minute per user with best-effort in-memory tracking
- **Smart Merge Algorithm**: First sign-in merges anonymous progress without data loss

## 🤖 Built with Kiro AI

TerraOps was developed in collaboration with Kiro, an AI-powered development environment. Here's what Kiro contributed:

### AWS Deployment Automation
- Created AWS Amplify app configuration and build specification
- Set up budget alerts and IAM policies
- Configured 8 environment variables via AWS CLI
- Downgraded Next.js from 16 to 15.5 for Amplify SSR compatibility
- Verified deployment with endpoint testing
- **[Full deployment proof documentation →](./docs/kiro-aws-proof.md)**

### Progress Sync Feature (9,600+ Lines of Code)
Kiro designed and implemented the entire progress synchronization system:
- **Requirements Analysis**: 10 comprehensive requirements with authorization, validation, and edge cases
- **Feature Design**: 22 acceptance criteria with correctness properties and test strategies
- **Implementation**: Complete feature spanning 15+ files
  - Server-side transcript replay and validation
  - Idempotent mission completion endpoints
  - First-sign-in progress merge algorithm
  - Verified vs. unverified completion tracking
  - Global leaderboard with verified XP ranking
  - Offline queue with automatic retry
  - Rate limiting and abuse prevention
- **Testing**: Property-based tests validating merge correctness, idempotency, and rank ordering

### Development Philosophy
Kiro helped establish:
- Comprehensive specifications before implementation
- Property-based testing for critical business logic
- Security-first approach (authorization, input validation, rate limits)
- Offline-first architecture with sync resilience

## 📚 Getting Started

### Prerequisites
- Node.js 20+
- PostgreSQL database (or Supabase account)
- GitHub OAuth app credentials

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/yourusername/terraform-mastery.git
   cd terraform-mastery
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   
   Copy `.env.example` to `.env` and fill in your values:
   ```bash
   cp .env.example .env
   ```

   Required variables:
   - `DATABASE_URL`: Supabase connection string with pgBouncer
   - `DIRECT_URL`: Supabase direct connection for Prisma migrations
   - `AUTH_SECRET`: Random string for NextAuth (generate with `openssl rand -base64 32`)
   - `GITHUB_CLIENT_ID` & `GITHUB_CLIENT_SECRET`: GitHub OAuth app credentials
   - `NEXTAUTH_URL` / `AUTH_URL`: Your app URL (localhost:3000 for dev)

4. **Set up the database**
   ```bash
   npx prisma db push
   ```

5. **Run the development server**
   ```bash
   npm run dev
   ```

6. **Open [http://localhost:3000](http://localhost:3000)**

### GitHub OAuth Setup

1. Create a GitHub OAuth app at https://github.com/settings/developers
2. Set **Homepage URL** to `http://localhost:3000` (or your production URL)
3. Set **Authorization callback URL** to `http://localhost:3000/api/auth/callback/github`
4. Copy Client ID and Client Secret to your `.env` file

## 🎮 How to Play

1. **Start Learning**: Open any unlocked mission from the dashboard
2. **Read the Brief**: Understand mission objectives and requirements
3. **Write HCL**: Use the code editor to define your infrastructure
4. **Execute Commands**: Run `terraform init`, `plan`, `apply` in the terminal
5. **Complete Objectives**: Watch them check off as you meet requirements
6. **Earn Rewards**: Get XP, unlock badges, and climb the leaderboard

### Mission Examples
- **Mission 1**: Create your first EC2 instance
- **Mission 5**: Implement input variables and outputs
- **Mission 10**: Build a complete VPC with multiple resources
- **Mission 15**: Multi-cloud deployment across AWS, Azure, and GCP

## 📊 Project Structure

```
terraform-mastery/
├── src/
│   ├── app/                    # Next.js App Router pages
│   │   ├── (app)/             # Authenticated layout
│   │   ├── api/               # API routes (auth, progress, leaderboard)
│   │   └── login/             # Sign-in page
│   ├── components/            # React components
│   │   ├── missions/          # Mission executor, cards
│   │   ├── achievements/      # Badge displays
│   │   └── layout/            # TopBar, Sidebar
│   ├── lib/                   # Core logic
│   │   ├── store.ts           # Zustand state management
│   │   ├── auth.ts            # NextAuth configuration
│   │   ├── terraform-simulator.ts  # Terraform engine
│   │   └── prisma.ts          # Database client
│   └── data/                  # Mission & badge definitions
├── prisma/
│   └── schema.prisma          # Database schema
├── docs/
│   └── kiro-aws-proof.md      # AI deployment evidence
└── amplify.yml                # AWS Amplify build config
```

## 🧪 Testing

Run the test suite:
```bash
npm test
```

The project uses property-based testing with fast-check to validate:
- Progress merge algorithm correctness
- Idempotent operation guarantees
- Leaderboard ranking consistency
- Transcript replay determinism

## 🚢 Deployment

### AWS Amplify (Production)

The app auto-deploys from the `main` branch to AWS Amplify Hosting:
- Platform: WEB_COMPUTE (Next.js SSR with dynamic routes)
- Region: eu-west-1
- Build time: ~4 minutes
- Environment variables managed via `amplify.yml` allowlist

To deploy updates:
```bash
git push origin main
```

Amplify will automatically build and deploy.

## 📋 Category Tags

- **Learning Platform**: Interactive education with progressive curriculum
- **Developer Tools**: Real-world infrastructure-as-code practice
- **Gamification**: XP, levels, badges, and competitive leaderboards
- **Real-time Validation**: Instant feedback on code and commands
- **Full-Stack TypeScript**: Type-safe end-to-end development
- **Cloud-Native**: Multi-cloud simulation and AWS deployment

## 🤝 Contributing

Contributions are welcome! This project was built for the Kiro AI Hackathon to demonstrate AI-assisted development workflows.

## 📄 License

MIT License - See LICENSE file for details

## 🙏 Acknowledgments

- **Kiro AI**: For intelligent code generation, AWS deployment automation, and collaborative development
- **HashiCorp**: For Terraform and the infrastructure-as-code paradigm
- **Vercel**: For Next.js and the amazing developer experience
- **Supabase**: For managed PostgreSQL with excellent DX

---

**Built with ❤️ and AI assistance for the Kiro Hackathon**
