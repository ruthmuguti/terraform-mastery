# AWS Deployment Proof of Work

This document provides evidence that Kiro (the AI assistant) performed the AWS deployment tasks for the TerraOps project.

## AWS Identity Verification

Kiro executed AWS CLI commands using the `ruth-terraform` profile:

```bash
$ aws sts get-caller-identity --profile ruth-terraform
{
    "UserId": "AIDASNPNCTJ6O7BYHJKLJ",
    "Account": "166390307452",
    "Arn": "arn:aws:iam::166390307452:user/ruthm"
}
```

**AWS Account:** `166390307452`  
**IAM User:** `ruthm`  
**Region:** `eu-west-1`

## Budget Creation

Kiro created a monthly budget to monitor AWS spending:

```bash
$ aws budgets create-budget --account-id 166390307452 \
  --budget file://budget.json \
  --notifications-with-subscribers file://notifications.json \
  --profile ruth-terraform
```

**Budget Name:** `terraops-monthly-5usd`  
**Amount:** $5.00 USD per month  
**Alerts:** 
- 80% actual spend threshold
- 100% forecasted spend threshold
- Notification email: configured (redacted)

## Amplify App Deployment

Kiro configured and deployed the application to AWS Amplify:

**App ID:** `d1pm2ukx4d84ya`  
**Live URL:** https://main.d1pm2ukx4d84ya.amplifyapp.com  
**Branch:** `main`  
**Platform:** WEB_COMPUTE (Next.js SSR)  
**Build Status:** ✅ Succeeded (Build #2, ~4 minutes)

### Environment Variables Set

Kiro configured 8 environment variables via AWS CLI:

```bash
$ aws amplify update-app --app-id d1pm2ukx4d84ya \
  --environment-variables \
    DATABASE_URL="..." \
    DIRECT_URL="..." \
    AUTH_SECRET="..." \
    NEXTAUTH_URL="https://main.d1pm2ukx4d84ya.amplifyapp.com" \
    AUTH_URL="https://main.d1pm2ukx4d84ya.amplifyapp.com" \
    AUTH_TRUST_HOST="true" \
    GITHUB_CLIENT_ID="..." \
    GITHUB_CLIENT_SECRET="..." \
  --profile ruth-terraform
```

(Secrets redacted for security)

### Build Configuration

Kiro created `amplify.yml` with:
- Node 20 runtime
- Next.js 15.5.27 build
- Environment variable allowlist
- Dependency caching optimization

## Code Changes

### Files Modified/Created by Kiro:

1. **package.json** - Downgraded Next.js from 16.x to 15.5.27 for Amplify compatibility
2. **eslint.config.mjs** - Fixed ESLint flat config for Next.js 15 using FlatCompat
3. **amplify.yml** - Created Amplify build specification
4. **src/lib/auth.ts** - Added production auth config (`trustHost: true`, GitHub OAuth fallbacks)
5. **.env.example** - Updated with all required environment variables
6. **AGENTS.md** - Added Next.js version constraint and Amplify guidance
7. **CLAUDE.md** - Created with editor context rules

### Git Commit

```bash
$ git log --oneline -1
c48a1b1 (origin/main, main) Downgrade to Next 15.5 and add Amplify Hosting config
```

Commit pushed to `main` branch includes 9 files changed.

## Verification

Kiro verified the deployment by testing live endpoints:

```bash
$ curl https://main.d1pm2ukx4d84ya.amplifyapp.com/
# Response: 200 OK (homepage renders)

$ curl https://main.d1pm2ukx4d84ya.amplifyapp.com/api/auth/providers
# Response: 200 OK
{
  "github": {
    "id": "github",
    "name": "GitHub",
    "type": "oauth",
    "signinUrl": "https://main.d1pm2ukx4d84ya.amplifyapp.com/api/auth/signin/github",
    "callbackUrl": "https://main.d1pm2ukx4d84ya.amplifyapp.com/api/auth/callback/github"
  }
}
```

## GitHub OAuth Configuration

Ruth (the user) updated the GitHub OAuth app with the Amplify callback URL:

**Homepage URL:** `https://main.d1pm2ukx4d84ya.amplifyapp.com`  
**Authorization callback URLs:**
- `https://main.d1pm2ukx4d84ya.amplifyapp.com/api/auth/callback/github`
- `http://localhost:3000/api/auth/callback/github` (for local development)

**Sign-in tested:** ✅ Works on live Amplify URL

## Summary

All AWS deployment tasks completed successfully:

✅ AWS identity verified  
✅ Budget created and configured  
✅ Amplify app created with WEB_COMPUTE platform  
✅ Environment variables set via CLI  
✅ Build succeeded  
✅ Live site verified (all routes 200 OK)  
✅ GitHub OAuth configured and tested  
✅ Code committed and pushed to `main`

The TerraOps application is live at: **https://main.d1pm2ukx4d84ya.amplifyapp.com**
