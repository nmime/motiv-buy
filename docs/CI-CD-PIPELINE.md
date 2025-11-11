# CI/CD Pipeline Visualization

Complete visual guide to the Motiv-Buy CI/CD pipeline.

---

## Overview Diagram

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         MOTIV-BUY CI/CD PIPELINE                         │
└─────────────────────────────────────────────────────────────────────────┘

                              Developer Workflow
                                      │
                    ┌─────────────────┴─────────────────┐
                    │                                   │
             Feature Branch                       Master Branch
                    │                                   │
                    ▼                                   ▼
          ┌─────────────────┐              ┌─────────────────────┐
          │   Pull Request   │              │  Merge to Master    │
          │   Created/Push   │              │   (After Review)    │
          └─────────────────┘              └─────────────────────┘
                    │                                   │
                    ▼                                   ▼
          ┌─────────────────┐              ┌─────────────────────┐
          │   CI PIPELINE    │              │    CI PIPELINE      │
          │   (Automatic)    │              │    (Automatic)      │
          └─────────────────┘              └─────────────────────┘
                    │                                   │
                    │                                   │
    ┌───────────────┼───────────────┐                  │
    │               │               │                  │
    ▼               ▼               ▼                  ▼
┌────────┐    ┌─────────┐    ┌──────────┐       ┌──────────┐
│ ESLint │    │  Tests  │    │ Security │       │  Build   │
│  Check │    │ (58/58) │    │  Scans   │       │  Docker  │
└────────┘    └─────────┘    └──────────┘       └──────────┘
    │               │               │                  │
    └───────────────┴───────┬───────┘                  │
                            │                          │
                  ✅ All Checks Pass                   │
                            │                          │
                            ▼                          ▼
                  ┌──────────────────┐      ┌──────────────────┐
                  │  READY TO DEPLOY │      │ Docker Images in │
                  │                  │      │  GitHub Registry │
                  └──────────────────┘      └──────────────────┘
                            │                          │
            ┌───────────────┴───────────────┐          │
            │                               │          │
            ▼                               ▼          │
    ┌───────────────┐              ┌────────────────┐ │
    │   STAGING     │              │   PRODUCTION   │ │
    │  Deployment   │              │   Deployment   │ │
    │  (Manual)     │              │   (Manual)     │ │
    └───────────────┘              └────────────────┘ │
            │                               │          │
            ▼                               ▼          │
    ┌───────────────┐              ┌────────────────┐ │
    │ st.motivbuy   │              │  motivbuy.com  │ │
    │     .com      │              │                │ │
    └───────────────┘              └────────────────┘ │
                                            │          │
                                            └──────────┘
```

---

## Detailed CI Pipeline

### Automatic - Runs on Every PR/Push

```
┌──────────────────────────────────────────────────────────────────┐
│                        CI PIPELINE (Automatic)                    │
│                    Triggered: PR open/push event                  │
└──────────────────────────────────────────────────────────────────┘

Step 1: Code Quality                    [continue-on-error: true]
├─ Setup Node.js & pnpm
├─ Install dependencies
├─ Run ESLint                           ⚠️  Shows warnings, doesn't fail
└─ Check Prettier formatting            ⚠️  Shows warnings, doesn't fail
        │
        ├─────────── (runs in parallel) ──────────┐
        │                                          │
        ▼                                          ▼
Step 2: Build Apps              Step 3: Run Tests (58 total)
├─ Build API                    ├─ statistic-main (58 tests)
└─ Build Bot                    ├─ Generate coverage
   │                            └─ Upload to Codecov
   │                                     │
   │                                     │
   ├─────────────────────────────────────┘
   │
   ├─────────── (runs in parallel) ──────────┐
   │                                          │
   ▼                                          ▼
Step 4: Docker Build          Step 5: Security Scan
(Only on push to master)       ├─ pnpm audit
├─ Build API image             ├─ Trivy scan
└─ Build Bot image             ├─ CodeQL analysis
                               └─ Save SARIF reports
                                     │
                                     ▼
                         ✅ CI Complete - Ready to Deploy!
```

**Job Status**:
- ✅ Quality: Non-blocking (shows warnings only)
- ✅ Build: Non-blocking
- ✅ Tests: Non-blocking
- ✅ Security: Non-blocking
- ✅ Docker: Only on master branch

**All jobs run even if some fail - no blocking!**

---

## Staging Deployment Workflow

### Manual - Triggered from GitHub Actions UI

```
┌──────────────────────────────────────────────────────────────────┐
│                  STAGING DEPLOYMENT (Manual)                      │
│           Trigger: GitHub Actions → "Run workflow"                │
│           Branch: Any branch EXCEPT master                        │
└──────────────────────────────────────────────────────────────────┘

User Action:
├─ Go to: Actions → "Deploy to Staging"
├─ Click: "Run workflow"
├─ Select: feature/my-feature (NOT master!)
└─ Click: "Run workflow" button

        │
        ▼
┌─────────────────────────────────────┐
│ Step 0: Validate Branch             │
│ ✅ Check: branch != master          │
│ ❌ Fail if master branch            │
└─────────────────────────────────────┘
        │
        ▼
┌─────────────────────────────────────┐
│ Step 1: Build & Push Docker Images  │
│ ├─ Build API image                  │
│ ├─ Build Bot image                  │
│ ├─ Tag: staging, branch-name        │
│ └─ Push to ghcr.io                  │
└─────────────────────────────────────┘
        │
        ▼
┌─────────────────────────────────────┐
│ Step 2: Deploy to Staging VPS       │
│ ├─ SSH to staging server            │
│ ├─ Create .env with:                │
│ │  • API_DOMAIN=api.st.motivbuy.com│
│ │  • BOT_DOMAIN=bot.st.motivbuy.com│
│ │  • MAIN_DOMAIN=st.motivbuy.com   │
│ ├─ Pull latest images               │
│ ├─ Run migrations                   │
│ └─ Deploy: docker compose up -d     │
└─────────────────────────────────────┘
        │
        ▼
┌─────────────────────────────────────┐
│ Step 3: Health Check                │
│ ├─ Wait for services healthy        │
│ └─ curl http://localhost:3000/health│
└─────────────────────────────────────┘
        │
        ▼
    ✅ Staging Deployed!

    🌐 api.st.motivbuy.com
    🤖 bot.st.motivbuy.com
    🏠 st.motivbuy.com
```

**Concurrency**: Per-branch queue
- Same branch = queue (no duplicates)
- Different branches = run in parallel

---

## Production Deployment Workflow

### Manual - Triggered from GitHub Actions UI

```
┌──────────────────────────────────────────────────────────────────┐
│                PRODUCTION DEPLOYMENT (Manual)                     │
│           Trigger: GitHub Actions → "Run workflow"                │
│           Branch: master ONLY                                     │
└──────────────────────────────────────────────────────────────────┘

User Action:
├─ Go to: Actions → "Deploy to Production"
├─ Click: "Run workflow"
├─ Select: master (MUST be master!)
├─ Optional: Enter version tag (v1.0.0)
└─ Click: "Run workflow" button

        │
        ▼
┌─────────────────────────────────────┐
│ Step 0: Validate Branch             │
│ ✅ Check: branch == master          │
│ ❌ Fail if not master branch        │
└─────────────────────────────────────┘
        │
        ▼
┌─────────────────────────────────────┐
│ Step 1: Build & Push Docker Images  │
│ ├─ Build API image                  │
│ ├─ Build Bot image                  │
│ ├─ Tag: latest, version, prod-sha   │
│ └─ Push to ghcr.io                  │
└─────────────────────────────────────┘
        │
        ▼
┌─────────────────────────────────────┐
│ Step 2: Backup Database             │
│ ├─ SSH to production server         │
│ ├─ Create timestamp backup          │
│ ├─ Keep last 7 backups              │
│ └─ Save to /backup/motiv-buy/       │
└─────────────────────────────────────┘
        │
        ▼
┌─────────────────────────────────────┐
│ Step 3: Deploy to Production VPS    │
│ ├─ SSH to production server         │
│ ├─ Create .env with:                │
│ │  • API_DOMAIN=api.motivbuy.com   │
│ │  • BOT_DOMAIN=bot.motivbuy.com   │
│ │  • MAIN_DOMAIN=motivbuy.com      │
│ ├─ Pull latest images               │
│ ├─ Run migrations                   │
│ └─ Deploy: docker compose up -d     │
│    (zero-downtime rolling update)   │
└─────────────────────────────────────┘
        │
        ▼
┌─────────────────────────────────────┐
│ Step 4: Health Checks               │
│ ├─ Wait for services healthy        │
│ └─ curl http://localhost:3000/health│
└─────────────────────────────────────┘
        │
        ▼
┌─────────────────────────────────────┐
│ Step 5: Smoke Tests                 │
│ ├─ Test /health endpoint            │
│ └─ Test /api endpoint               │
└─────────────────────────────────────┘
        │
        ├──── ✅ All checks pass ────┐
        │                             │
        ▼                             │
    ✅ Production Deployed!           │
                                      │
    🌐 api.motivbuy.com               │
    🤖 bot.motivbuy.com               │
    🏠 motivbuy.com                   │
                                      │
        ├──── ❌ Checks fail ─────────┘
        │
        ▼
┌─────────────────────────────────────┐
│ Step 6: Auto-Rollback               │
│ ├─ Stop current deployment          │
│ ├─ Restore from backup              │
│ └─ Restart services                 │
└─────────────────────────────────────┘
        │
        ▼
    ↩️ Rolled back to previous version
```

**Concurrency**: Single deployment queue
- Only 1 production deployment at a time
- Queues if another is running
- Never cancels in-progress deployments

---

## Complete Flow - Feature to Production

```
Day 1: Development
┌──────────────────────────────────────────────────────────────┐
│ Developer                                                     │
├──────────────────────────────────────────────────────────────┤
│ 1. git checkout -b feature/new-stats                         │
│ 2. [Make changes to code]                                    │
│ 3. git commit -m "Add new statistics feature"                │
│ 4. git push origin feature/new-stats                         │
└──────────────────────────────────────────────────────────────┘
        │
        ▼
┌──────────────────────────────────────────────────────────────┐
│ GitHub (Automatic)                                            │
├──────────────────────────────────────────────────────────────┤
│ 1. CI Pipeline runs automatically                            │
│    ✅ ESLint: 0 errors                                       │
│    ✅ Tests: 58/58 passing                                   │
│    ✅ Build: Success                                         │
│    ✅ Security: No critical issues                           │
│                                                               │
│ 2. PR created: feature/new-stats → master                    │
│    Status: ✅ All checks passed                              │
└──────────────────────────────────────────────────────────────┘
        │
        ▼
┌──────────────────────────────────────────────────────────────┐
│ Deploy to Staging (Manual)                                    │
├──────────────────────────────────────────────────────────────┤
│ Developer:                                                    │
│ 1. Go to Actions → Deploy to Staging                         │
│ 2. Select branch: feature/new-stats                          │
│ 3. Click "Run workflow"                                      │
│                                                               │
│ GitHub Actions:                                               │
│ ✅ Build images → Push to registry                           │
│ ✅ Deploy to st.motivbuy.com                                 │
│ ✅ Health checks pass                                        │
│                                                               │
│ Result:                                                       │
│ 🌐 Feature live at api.st.motivbuy.com                      │
└──────────────────────────────────────────────────────────────┘
        │
        ▼
┌──────────────────────────────────────────────────────────────┐
│ Testing (Hours/Days)                                          │
├──────────────────────────────────────────────────────────────┤
│ • QA tests feature on staging                                │
│ • Product team reviews                                       │
│ • Bug fixes → Push to branch → Auto CI → Redeploy staging   │
│ • ✅ Approved for production                                 │
└──────────────────────────────────────────────────────────────┘
        │
        ▼
┌──────────────────────────────────────────────────────────────┐
│ Code Review & Merge                                           │
├──────────────────────────────────────────────────────────────┤
│ 1. Team reviews PR                                           │
│ 2. Approve and merge to master                               │
│ 3. CI runs again on master                                   │
│    ✅ All checks pass                                        │
└──────────────────────────────────────────────────────────────┘
        │
        ▼
┌──────────────────────────────────────────────────────────────┐
│ Deploy to Production (Manual)                                 │
├──────────────────────────────────────────────────────────────┤
│ DevOps/Lead:                                                  │
│ 1. Go to Actions → Deploy to Production                      │
│ 2. Ensure branch: master                                     │
│ 3. Enter version: v1.2.0                                     │
│ 4. Click "Run workflow"                                      │
│                                                               │
│ GitHub Actions:                                               │
│ ✅ Validate master branch                                    │
│ ✅ Build production images                                   │
│ ✅ Backup database                                           │
│ ✅ Deploy to motivbuy.com                                    │
│ ✅ Run migrations                                            │
│ ✅ Health checks pass                                        │
│ ✅ Smoke tests pass                                          │
│                                                               │
│ Result:                                                       │
│ 🎉 Feature live at api.motivbuy.com                         │
└──────────────────────────────────────────────────────────────┘
```

---

## Environment Comparison

```
┌─────────────────┬────────────────────┬────────────────────┐
│    Property     │      Staging       │    Production      │
├─────────────────┼────────────────────┼────────────────────┤
│ Trigger         │ Manual             │ Manual             │
│ Branch          │ Any (NOT master)   │ master ONLY        │
│ Domain          │ st.motivbuy.com    │ motivbuy.com       │
│ API Domain      │ api.st.motivbuy    │ api.motivbuy.com   │
│ Bot Domain      │ bot.st.motivbuy    │ bot.motivbuy.com   │
│ Database Backup │ ❌ No              │ ✅ Yes (before)    │
│ Health Checks   │ ✅ Yes             │ ✅ Yes             │
│ Smoke Tests     │ ❌ No              │ ✅ Yes             │
│ Auto Rollback   │ ❌ No              │ ✅ Yes             │
│ Concurrency     │ Per-branch queue   │ Single queue       │
│ Log Level       │ debug              │ warn               │
│ Purpose         │ Testing features   │ Live users         │
└─────────────────┴────────────────────┴────────────────────┘
```

---

## Concurrency Control

### Staging Deployment Concurrency

```
Time: 10:00 AM
┌─────────────────────────────────────────────────────────────┐
│ feature/new-stats → Deploying... (5 minutes)                │
│ feature/bug-fix   → Deploying... (5 minutes) [In parallel] │
└─────────────────────────────────────────────────────────────┘

Time: 10:02 AM (2 minutes later)
┌─────────────────────────────────────────────────────────────┐
│ feature/new-stats → Still deploying...                      │
│ feature/new-stats → ⏳ QUEUED (same branch, waits)         │
│ feature/bug-fix   → Still deploying... [Different branch]   │
└─────────────────────────────────────────────────────────────┘
        │
        ▼
Prevents duplicate deployments of same branch
Different branches can deploy in parallel
```

### Production Deployment Concurrency

```
Time: 2:00 PM
┌─────────────────────────────────────────────────────────────┐
│ Production → Deploying v1.2.0... (10 minutes)               │
└─────────────────────────────────────────────────────────────┘

Time: 2:05 PM (5 minutes later)
┌─────────────────────────────────────────────────────────────┐
│ Production → Still deploying v1.2.0...                      │
│ Production v1.2.1 → ⏳ QUEUED (waits for first to finish)  │
└─────────────────────────────────────────────────────────────┘
        │
        ▼
Only ONE production deployment at a time
Never cancels in-progress deployments (safety first!)
Queues subsequent deployments
```

---

## Security Workflow

```
┌──────────────────────────────────────────────────────────────┐
│              SECURITY SCANS (Non-blocking)                    │
│         Run: Every PR + Weekly Schedule (Monday 2AM)         │
└──────────────────────────────────────────────────────────────┘

Step 1: npm Audit
├─ pnpm audit --audit-level=moderate
├─ Check: Known vulnerabilities in dependencies
└─ Output: ⚠️  Warnings shown, doesn't fail build

Step 2: Trivy Scan
├─ Scan: File system for vulnerabilities
├─ Severity: CRITICAL, HIGH
├─ Generate: SARIF report
└─ Upload: Artifact (trivy-security-scan)

Step 3: CodeQL Analysis
├─ Analyze: 610 TypeScript, 6 YAML, 3 JavaScript files
├─ Check: Security vulnerabilities, code quality
├─ Generate: SARIF report
└─ Upload: Artifact (codeql-security-analysis)

        │
        ▼
┌─────────────────────────────────────┐
│ Results Available in:                │
│ • Actions → Artifacts (30 days)     │
│ • Download SARIF for manual review  │
│ • Does NOT block deployments        │
└─────────────────────────────────────┘
```

---

## Key Features

### ✅ Non-Blocking CI
- All quality checks are informational only
- Tests, lint, security scans show warnings
- Build always succeeds if code compiles
- Fast feedback without blocking development

### ✅ Manual Deployments
- No accidental production deploys
- Intentional, controlled releases
- Team can coordinate timing
- Review before deploy

### ✅ Branch Validation
- Staging: Rejects master branch
- Production: Requires master branch
- Prevents wrong-environment deploys
- Clear separation of concerns

### ✅ Concurrency Control
- No duplicate deployments
- Queue instead of cancel
- Safe, predictable behavior
- Per-branch (staging) or global (prod)

### ✅ Domain Separation
- Each app has its own subdomain
- Clear API vs Bot separation
- Easy to route traffic
- Independent SSL certificates

---

## Quick Reference

### Trigger Deployments

**Staging**:
```
Actions → Deploy to Staging → Select branch → Run workflow
```

**Production**:
```
Actions → Deploy to Production → Select master → Run workflow
```

### Check Status

**Staging**:
```bash
curl https://api.st.motivbuy.com/health
```

**Production**:
```bash
curl https://api.motivbuy.com/health
```

### View Logs

**GitHub Actions**:
```
Actions → Select workflow run → View logs
```

**VPS**:
```bash
ssh user@vps-ip "cd /opt/motiv-buy && docker compose logs -f"
```

---

**Last Updated**: 2025-11-11
**Pipeline Status**: ✅ Fully Operational
**Deployment Strategy**: Manual trigger only
