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
