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
cat ~/.ssh/motiv-staging      # For VPS_STAGING_SSH_KEY
cat ~/.ssh/motiv-production   # For VPS_PRODUCTION_SSH_KEY
# Copy ENTIRE output including -----BEGIN----- and -----END----- lines
```

---

## 2. Generate Secrets

```bash
# Run these and save the outputs
openssl rand -base64 32  # STAGING_DB_PASSWORD
openssl rand -base64 32  # STAGING_REDIS_PASSWORD
openssl rand -base64 64  # STAGING_JWT_SECRET

openssl rand -base64 32  # PRODUCTION_DB_PASSWORD
openssl rand -base64 32  # PRODUCTION_REDIS_PASSWORD
openssl rand -base64 64  # PRODUCTION_JWT_SECRET
```

**Get Bot Tokens:**
1. Open Telegram → @BotFather → /newbot → get token
2. Create separate bots for staging and production

**Get CryptoBot Tokens:**
1. Go to https://pay.crypt.bot
2. Create API tokens for staging and production

---

## 3. Add GitHub Secrets

Go to: **Repository → Settings → Secrets and variables → Actions**

Click **"New repository secret"** for each:

### Staging Secrets (11 secrets)

```
VPS_STAGING_HOST              = 157.180.64.229
VPS_STAGING_USER              = deployer
VPS_STAGING_SSH_KEY           = <paste ENTIRE private key from step 1>
VPS_STAGING_DEPLOY_PATH       = /opt/motiv-buy

STAGING_DB_NAME               = motiv_buy_staging
STAGING_DB_USER               = postgres
STAGING_DB_PASSWORD           = <from step 2>
STAGING_REDIS_PASSWORD        = <from step 2>
STAGING_JWT_SECRET            = <from step 2>

STAGING_TELEGRAM_BOT_TOKEN    = <from @BotFather>
STAGING_CRYPTO_BOT_API_TOKEN  = <from CryptoBot>
```

### Production Secrets (11 secrets)

```
VPS_PRODUCTION_HOST              = 65.108.218.78
VPS_PRODUCTION_USER              = deployer
VPS_PRODUCTION_SSH_KEY           = <paste ENTIRE private key from step 1>
VPS_PRODUCTION_DEPLOY_PATH       = /opt/motiv-buy

PRODUCTION_DB_NAME               = motiv_buy_prod
PRODUCTION_DB_USER               = motiv_buy_user
PRODUCTION_DB_PASSWORD           = <from step 2>
PRODUCTION_REDIS_PASSWORD        = <from step 2>
PRODUCTION_JWT_SECRET            = <from step 2>

PRODUCTION_TELEGRAM_BOT_TOKEN    = <from @BotFather>
PRODUCTION_CRYPTO_BOT_API_TOKEN  = <from CryptoBot>
```

### Shared Secret (1 secret)

```
LETSENCRYPT_EMAIL             = admin@motivbuy.com
```

**Total: 23 secrets**

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
DB_PASSWORD=<from STAGING_DB_PASSWORD secret>
TELEGRAM_BOT_TOKEN=<from STAGING_TELEGRAM_BOT_TOKEN secret>
# ... all other vars from GitHub Secrets
```

Production `.env`:
```env
NODE_ENV=production
DB_NAME=motiv_buy_prod
DB_PASSWORD=<from PRODUCTION_DB_PASSWORD secret>
TELEGRAM_BOT_TOKEN=<from PRODUCTION_TELEGRAM_BOT_TOKEN secret>
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
