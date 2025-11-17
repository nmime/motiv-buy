# Deploy from Scratch

Single guide to deploy Motiv-Buy to staging and production.

---

## Prerequisites

- VPS servers with Ubuntu 22.04+
- Domain configured (motivbuy.com)
- GitHub repository access

---

## 1. Setup Servers (One-Time)

### DNS Records

**Staging (157.180.64.229):**
```
A    st            → 157.180.64.229
A    api.st        → 157.180.64.229
A    bot.st        → 157.180.64.229
```

**Production (65.108.218.78):**
```
A    @             → 65.108.218.78
A    api           → 65.108.218.78
A    bot           → 65.108.218.78
```

Verify: `dig st.motivbuy.com +short` (wait 5-10 min for propagation)

### Run Setup Script

```bash
# Staging (using default domain: motivbuy.com)
scp scripts/setup-server.sh root@157.180.64.229:/root/
ssh root@157.180.64.229 "bash /root/setup-server.sh staging"

# Production (using default domain: motivbuy.com)
scp scripts/setup-server.sh root@65.108.218.78:/root/
ssh root@65.108.218.78 "bash /root/setup-server.sh production"

# Or with custom domain
ssh root@157.180.64.229 "bash /root/setup-server.sh staging example.com admin@example.com"
```

**Script Usage:**
```bash
sudo bash setup-server.sh [staging|production] [domain] [email]

# Examples:
bash setup-server.sh staging                              # Uses motivbuy.com
bash setup-server.sh production example.com               # Custom domain, auto email
bash setup-server.sh staging mydomain.com me@mydomain.com # Full custom
```

### Setup SSH Keys

**Note:** The setup script automatically copies your root SSH keys to the `deployer` user. You can test access immediately, then add dedicated deployment keys for GitHub Actions.

```bash
# 1. Test deployer access (should work with your existing root key)
ssh deployer@157.180.64.229
ssh deployer@65.108.218.78

# 2. Generate dedicated deployment keys for GitHub Actions (one per environment)
ssh-keygen -t ed25519 -C "deploy-staging" -f ~/.ssh/motiv-staging
ssh-keygen -t ed25519 -C "deploy-production" -f ~/.ssh/motiv-production

# 3. Add deployment keys to respective servers
cat ~/.ssh/motiv-staging.pub | ssh deployer@157.180.64.229 'tee -a ~/.ssh/authorized_keys'
cat ~/.ssh/motiv-production.pub | ssh deployer@65.108.218.78 'tee -a ~/.ssh/authorized_keys'

# 4. Test with new keys
ssh -i ~/.ssh/motiv-staging deployer@157.180.64.229
ssh -i ~/.ssh/motiv-production deployer@65.108.218.78

# 5. Save private keys for GitHub Secrets
cat ~/.ssh/motiv-staging      # For staging environment VPS_SSH_KEY
cat ~/.ssh/motiv-production   # For production environment VPS_SSH_KEY
# Copy ENTIRE output including -----BEGIN----- and -----END----- lines
```

---

## 2. Generate Secrets

```bash
# Run these and save the outputs
openssl rand -base64 32  # DB_PASSWORD
openssl rand -base64 32  # REDIS_PASSWORD
openssl rand -base64 64  # JWT_SECRET
```

**Get Bot Tokens:**
1. Open Telegram → @BotFather → /newbot → get token
2. Create separate bots for staging and production

**Get CryptoBot Tokens:**
1. Go to https://pay.crypt.bot
2. Create API tokens for staging and production

---

## 3. Configure GitHub Environments

Go to: **Repository → Settings → Environments**

### Create Staging Environment

1. Click **"New environment"**
2. Name: `staging`
3. Click **"Configure environment"**
4. Add environment secrets (12 secrets):

```
VPS_HOST              = 157.180.64.229
VPS_USER              = deployer
VPS_SSH_KEY           = <paste private key ~/.ssh/motiv-staging>
VPS_DEPLOY_PATH       = /opt/motiv-buy

DB_NAME               = motiv_buy_staging
DB_USER               = postgres
DB_PASSWORD           = <from step 2>
REDIS_PASSWORD        = <from step 2>
JWT_SECRET            = <from step 2>

TELEGRAM_BOT_TOKEN    = <staging bot token from @BotFather>
CRYPTO_BOT_API_TOKEN  = <staging token from CryptoBot>

LETSENCRYPT_EMAIL     = admin@motivbuy.com
```

### Create Production Environment

1. Click **"New environment"**
2. Name: `production`
3. Click **"Configure environment"**
4. **(Optional)** Add protection rules:
   - ☑ Required reviewers
   - ☑ Wait timer (e.g., 5 minutes)
5. Add environment secrets (12 secrets):

```
VPS_HOST              = 65.108.218.78
VPS_USER              = deployer
VPS_SSH_KEY           = <paste private key ~/.ssh/motiv-production>
VPS_DEPLOY_PATH       = /opt/motiv-buy

DB_NAME               = motiv_buy_prod
DB_USER               = motiv_buy_user
DB_PASSWORD           = <from step 2>
REDIS_PASSWORD        = <from step 2>
JWT_SECRET            = <from step 2>

TELEGRAM_BOT_TOKEN    = <production bot token from @BotFather>
CRYPTO_BOT_API_TOKEN  = <production token from CryptoBot>

LETSENCRYPT_EMAIL     = admin@motivbuy.com
```

**Total: 12 secrets per environment = 24 secrets**

---

## 4. Deploy to Staging

**⚠️ IMPORTANT: Run migrations BEFORE deploying!**

### Step 1: Run Migrations

```bash
# 1. Go to GitHub → Actions → "Run Database Migrations" workflow
# 2. Click "Run workflow"
# 3. Select:
#    - Environment: staging
#    - Action: up
# 4. Click "Run workflow"
# 5. Wait ~2-3 minutes
# 6. Verify migration succeeded (green checkmark)
```

**Why migrations first?**
- New application code expects the updated database schema
- Running migrations after deploy can cause errors
- Safer to update DB structure before app code

### Step 2: Deploy Application

```bash
# 1. Create and push branch
git checkout -b test/first-deploy
git push origin test/first-deploy

# 2. Go to GitHub → Actions → "Deploy" workflow
# 3. Click "Run workflow"
# 4. Select:
#    - Branch: test/first-deploy
#    - Environment: staging
# 5. Click "Run workflow"

# 6. Wait ~5-10 minutes

# 7. Verify
curl https://api.st.motivbuy.com/health
# Expected: {"status":"ok",...}
```

---

## 5. Deploy to Production

**⚠️ CRITICAL: Always run migrations BEFORE deploying to production!**

### Step 1: Run Migrations (with automatic backup)

```bash
# 1. Go to GitHub → Actions → "Run Database Migrations" workflow
# 2. Click "Run workflow"
# 3. Select:
#    - Environment: production
#    - Action: up
# 4. Click "Run workflow"
# 5. Wait ~3-5 minutes (includes automatic DB backup)
# 6. Verify migration succeeded (green checkmark)
```

**Production migrations automatically:**
- ✅ Create database backup before migration
- ✅ Run migrations with 10-minute timeout
- ✅ Verify migration status
- 📦 Backup saved in: `/opt/motiv-buy/backups/`

### Step 2: Deploy Application

```bash
# 1. Merge to master
git checkout master
git merge test/first-deploy
git push origin master

# 2. Go to GitHub → Actions → "Deploy" workflow
# 3. Click "Run workflow"
# 4. Select:
#    - Branch: master
#    - Environment: production
# 5. Click "Run workflow"

# 6. Wait ~5-10 minutes

# 7. Verify
curl https://api.motivbuy.com/health
# Expected: {"status":"ok",...}
```

---

## Quick Reference

### Secrets Checklist

- [ ] All 23 GitHub secrets added
- [ ] SSH key includes BEGIN/END lines
- [ ] Separate bot tokens for staging/production
- [ ] Separate CryptoBot tokens for staging/production

### Deployment URLs

**Staging:**
- Main: https://st.motivbuy.com
- API: https://api.st.motivbuy.com
- Health: https://api.st.motivbuy.com/health

**Production:**
- Main: https://motivbuy.com
- API: https://api.motivbuy.com
- Health: https://api.motivbuy.com/health

### SSH Access

```bash
# Staging
ssh deployer@157.180.64.229
cd /opt/motiv-buy
docker compose ps

# Production
ssh deployer@65.108.218.78
cd /opt/motiv-buy
docker compose ps
```

---

## CI/CD Pipeline Explained

### Overview

The CI/CD pipeline consists of **2 main workflows** that run automatically:

1. **CI Workflow** (`.github/workflows/ci.yml`) - Quality checks & builds
2. **Deploy Workflow** (`.github/workflows/deploy.yml`) - Actual deployment

---

### 1. CI Workflow (Automatic on Push/PR)

**Triggers:**
- Push to `master` branch
- Pull request to any branch

**Execution Order (Parallel):**

```
┌─────────────────────────────────────────────────┐
│  Trigger: Push to master or PR opened           │
└─────────────────────────────────────────────────┘
                    │
        ┌───────────┴───────────┐
        ▼                       ▼
┏━━━━━━━━━━━━━━━┓       ┏━━━━━━━━━━━━━━━┓
┃ Job 1: Quality┃       ┃ Job 2: Docker ┃
┃    & Tests    ┃       ┃     Build     ┃
┗━━━━━━━━━━━━━━━┛       ┗━━━━━━━━━━━━━━━┛
        │                       │
        │  ⚠️ Non-blocking      │  ✅ Blocking
        │  (can fail)           │  (must pass)
        │                       │
        └───────────┬───────────┘
                    ▼
        ┏━━━━━━━━━━━━━━━━━━━┓
        ┃ Job 3: Security   ┃
        ┃      Scan         ┃
        ┗━━━━━━━━━━━━━━━━━━━┛
                    │
           ⚠️ Non-blocking
           (informational)
                    │
                    ▼
        ┏━━━━━━━━━━━━━━━━━━━┓
        ┃ Job 4: Summary    ┃
        ┃  Report Status    ┃
        ┗━━━━━━━━━━━━━━━━━━━┛
```

#### Job 1: Quality & Tests (4-5 minutes)
**Non-blocking** - Failures show as warnings ⚠️

```yaml
Steps (sequential):
1. Checkout code
2. Install pnpm
3. Install dependencies
4. Run ESLint (continue-on-error: true)
5. Check formatting (continue-on-error: true)
6. Run tests (continue-on-error: true)  ← Main test execution
7. Generate coverage
8. Upload coverage to Codecov
```

**What happens if tests fail:**
- ✅ CI still passes (shows GREEN)
- ⚠️ Warning annotation appears in UI
- 📊 Summary shows: "Build Successful (with warnings)"
- 🚫 Does NOT block deployment

#### Job 2: Docker Build (3-4 minutes)
**Blocking** - Must succeed for CI to pass ✅

```yaml
Steps (parallel):
1. Build api Docker image
2. Build bot Docker image
3. Build migration Docker image

All builds run in parallel for speed
Push to: ghcr.io/nmime/motiv-buy-{app}:ci-{sha}
```

**What happens if build fails:**
- ❌ CI fails (shows RED)
- 🚫 Blocks deployment
- 📊 Summary shows: "Critical Failure - Docker build failed"

#### Job 3: Security Scan (2-3 minutes)
**Non-blocking** - Informational only ⚠️

```yaml
Steps:
1. Run pnpm audit
2. Run Trivy scanner
3. Upload results as artifact
```

#### Job 4: Summary
**Always runs** - Reports final status

```yaml
Shows table:
┌─────────────────┬──────────┬──────────┐
│ Job             │ Status   │ Blocking │
├─────────────────┼──────────┼──────────┤
│ Quality & Tests │ success  │ ❌ No    │
│ Docker Build    │ success  │ ✅ Yes   │
│ Security Scan   │ success  │ ❌ No    │
└─────────────────┴──────────┴──────────┘

Result:
- If Docker build succeeds → ✅ CI PASS
- If Docker build fails → ❌ CI FAIL
- Test/security failures → ⚠️ Warnings only
```

---

### 2. Deploy Workflow (Manual Trigger)

**Triggers:**
- Manual via GitHub Actions UI
- Workflow dispatch with environment selection

**Execution Order (Sequential):**

```
┌─────────────────────────────────────────────────┐
│  Trigger: Manual "Run workflow" button          │
│  Select: staging/production/both                │
└─────────────────────────────────────────────────┘
                    │
                    ▼
        ┏━━━━━━━━━━━━━━━━━━━┓
        ┃ Job 1: Validate   ┃
        ┃ - Check branch    ┃
        ┃ - Set targets     ┃
        ┗━━━━━━━━━━━━━━━━━━━┛
                    │
                    ▼
        ┏━━━━━━━━━━━━━━━━━━━┓
        ┃ Job 2: Build      ┃
        ┃ - Build api       ┃  (parallel)
        ┃ - Build bot       ┃  (parallel)
        ┗━━━━━━━━━━━━━━━━━━━┛
                    │
        ┌───────────┴───────────┐
        ▼                       ▼
┏━━━━━━━━━━━━━━┓      ┏━━━━━━━━━━━━━━━┓
┃ Job 3:       ┃      ┃ Job 4:        ┃
┃ Deploy       ┃      ┃ Deploy        ┃
┃ Staging      ┃      ┃ Production    ┃
┃              ┃      ┃               ┃
┃ 1. Setup SSH ┃      ┃ 1. Setup SSH  ┃
┃ 2. Deploy    ┃      ┃ 2. Backup DB  ┃
┃ 3. Health ✓  ┃      ┃ 3. Deploy     ┃
┗━━━━━━━━━━━━━━┛      ┃ 4. Health ✓   ┃
                      ┃ 5. Smoke ✓    ┃
                      ┗━━━━━━━━━━━━━━━┛
        │                       │
        └───────────┬───────────┘
                    ▼
        ┏━━━━━━━━━━━━━━━━━━━┓
        ┃ Job 5: Summary    ┃
        ┃ - Report results  ┃
        ┃ - Show URLs       ┃
        ┗━━━━━━━━━━━━━━━━━━━┛
```

**Deploy Steps (per environment):**

```bash
1. Setup SSH (~5s)
   - Create SSH directory
   - Add private key
   - Scan host keys

2. Deploy (~60s)
   - Copy docker-compose.yml to VPS
   - Generate .env file from GitHub Secrets
   - Login to ghcr.io
   - Pull latest images
   - Run docker compose up -d
   - Prune old images

3. Health Check (~10s)
   - Wait for containers to be healthy
   - Test /health endpoint
   - Fail if not responsive

4. Smoke Tests (production only, ~5s)
   - Test /health endpoint
   - Test /api endpoint
   - Verify responses

5. Cleanup (always)
   - Remove SSH private key
```

---

### Warning System Explained

**GitHub Actions doesn't have a "yellow" warning state.** We implement warnings using:

#### 1. Continue-on-error Pattern
```yaml
- name: Run tests
  run: pnpm run test
  continue-on-error: true  # Allows step to fail without failing job
```

#### 2. Warning Annotations
```yaml
echo "::warning::Tests failed. Please review the Quality & Tests job."
```

Creates a ⚠️ warning icon in the GitHub UI.

#### 3. Job Status Table
```yaml
echo "| Quality & Tests | ${{ needs.quality.result }} | ❌ No |"
```

Shows which jobs are **blocking** vs **non-blocking**.

**Visual Result:**
```
✅ CI Workflow - Green checkmark (passed)
  ├─ ✅ Quality & Tests (with warnings)
  ├─ ✅ Docker Build
  └─ ✅ Summary
     └─ ⚠️ Warning: Tests failed. Please review.
```

**The workflow shows GREEN but warnings are visible in:**
- Job summary
- Annotations panel
- Log output

---

### Quick Decision Tree

**When does CI block deployment?**

```
Docker build failed?
├─ YES → ❌ CI FAILS (RED) → Cannot deploy
└─ NO  → ✅ CI PASSES (GREEN)
          │
          Tests failed?
          ├─ YES → ⚠️ Warning shown → Can deploy (not recommended)
          └─ NO  → ✅ All clear → Safe to deploy
```

**When can I deploy?**

```
✅ Can deploy:
- Docker build passed
- Tests may have warnings (fix them later)

❌ Cannot deploy:
- Docker build failed
- Must fix and re-run CI
```

---

### Best Practices

1. **Always check warnings** before deploying
   - Review test failures in "Quality & Tests" job
   - Fix issues even if CI passes

2. **Staging first** - Always deploy to staging before production
   ```bash
   staging → test → production
   ```

3. **Monitor health checks** - Deployment isn't complete until health checks pass
   ```bash
   curl https://api.st.motivbuy.com/health
   ```

4. **Production deploys** - Only from `master` branch
   ```bash
   git checkout master
   git merge feature-branch
   git push
   ```

---

### Execution Times

| Workflow | Total Time | Notes |
|----------|-----------|-------|
| CI (full) | 4-6 min | Parallel execution |
| Deploy (staging) | 2-3 min | Single environment |
| Deploy (production) | 3-5 min | Includes backup + smoke tests |
| Deploy (both) | 3-5 min | Runs in parallel |

---

## Troubleshooting

### Deployment fails: "Permission denied"
- Check SSH key in GitHub Secrets includes `-----BEGIN-----` and `-----END-----` lines
- Verify: `ssh -i ~/.ssh/motiv-deploy deployer@VPS_IP`

### Containers not healthy
```bash
ssh deployer@VPS_IP
cd /opt/motiv-buy
docker compose logs api
docker compose logs bot
```

### Need to rollback
```bash
# Go to GitHub Actions
# Find last successful deployment
# Click "Re-run all jobs"
```

---

## Environment Variables (Auto-Created)

The deploy workflow **automatically creates** `.env` files on VPS using your GitHub Secrets.

You **don't need to manually create** `.env` files!

**What gets created:**

Staging `.env`:
```env
NODE_ENV=staging
DB_NAME=motiv_buy_staging
DB_PASSWORD=<from staging environment DB_PASSWORD secret>
TELEGRAM_BOT_TOKEN=<from staging environment TELEGRAM_BOT_TOKEN secret>
# ... all other vars from GitHub Secrets
```

Production `.env`:
```env
NODE_ENV=production
DB_NAME=motiv_buy_prod
DB_PASSWORD=<from production environment DB_PASSWORD secret>
TELEGRAM_BOT_TOKEN=<from production environment TELEGRAM_BOT_TOKEN secret>
# ... all other vars from GitHub Secrets
```

**Manual override** (if needed):
```bash
ssh deployer@VPS_IP
cd /opt/motiv-buy
nano .env  # Edit if needed
docker compose restart  # Apply changes
```

---

**That's it!** 🎉

For detailed documentation, see:
- Full CI/CD guide: `docs/reference/CI-CD-GUIDE.md`
- Server setup details: `docs/reference/SETUP-INSTRUCTIONS.md`
- All secrets explained: `docs/reference/GITHUB-SECRETS.md`
