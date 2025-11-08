# GitHub Secrets Setup Guide

This guide explains how to configure GitHub Secrets for CI/CD deployment.

## Overview

GitHub Secrets are used to securely store sensitive information like SSH keys, API tokens, and passwords. They are encrypted and only exposed to GitHub Actions workflows.

## Access GitHub Secrets

1. Navigate to your repository on GitHub
2. Go to **Settings** → **Secrets and variables** → **Actions**
3. Click **New repository secret**

---

## Required Secrets

### Staging Environment

| Secret Name | Description | Example |
|------------|-------------|---------|
| `VPS_STAGING_HOST` | Staging VPS IP address or hostname | `192.168.1.100` |
| `VPS_STAGING_USER` | SSH user for deployment | `deployer` |
| `VPS_STAGING_SSH_KEY` | Private SSH key for authentication | Contents of `~/.ssh/id_rsa` |
| `VPS_STAGING_DEPLOY_PATH` | Deployment directory path | `/opt/motiv-buy` |
| `STAGING_DB_NAME` | PostgreSQL database name | `motiv_buy_staging` |
| `STAGING_DB_USER` | PostgreSQL username | `postgres` |
| `STAGING_DB_PASSWORD` | PostgreSQL password | Generate with `openssl rand -base64 32` |
| `STAGING_REDIS_PASSWORD` | Redis password | Generate with `openssl rand -base64 32` |
| `STAGING_JWT_SECRET` | JWT signing secret | Generate with `openssl rand -base64 64` |
| `STAGING_TELEGRAM_BOT_TOKEN` | Telegram bot token | Get from @BotFather |
| `STAGING_CRYPTO_BOT_API_KEY` | CryptoBot API key | Get from CryptoBot dashboard |

### Production Environment

| Secret Name | Description | Example |
|------------|-------------|---------|
| `VPS_PRODUCTION_HOST` | Production VPS IP or hostname | `api.yourdomain.com` |
| `VPS_PRODUCTION_USER` | SSH user for deployment | `deployer` |
| `VPS_PRODUCTION_SSH_KEY` | Private SSH key | Contents of `~/.ssh/id_rsa` |
| `VPS_PRODUCTION_DEPLOY_PATH` | Deployment directory path | `/opt/motiv-buy` |
| `PRODUCTION_DB_NAME` | PostgreSQL database name | `motiv_buy_prod` |
| `PRODUCTION_DB_USER` | PostgreSQL username | `motiv_buy_user` |
| `PRODUCTION_DB_PASSWORD` | PostgreSQL password | Generate with `openssl rand -base64 32` |
| `PRODUCTION_REDIS_PASSWORD` | Redis password | Generate with `openssl rand -base64 32` |
| `PRODUCTION_JWT_SECRET` | JWT signing secret | Generate with `openssl rand -base64 64` |
| `PRODUCTION_TELEGRAM_BOT_TOKEN` | Production Telegram bot token | Get from @BotFather |
| `PRODUCTION_CRYPTO_BOT_API_KEY` | Production CryptoBot API key | Get from CryptoBot dashboard |
| `PRODUCTION_DOMAIN` | Your production domain | `yourdomain.com` |
| `LETSENCRYPT_EMAIL` | Email for SSL cert notifications | `admin@yourdomain.com` |

---

## Step-by-Step Setup

### 1. Generate SSH Keys

On your local machine:

```bash
# Generate SSH key pair for deployment
ssh-keygen -t ed25519 -C "github-actions-motiv-buy" -f ~/.ssh/motiv-buy-deploy

# This creates:
# - Private key: ~/.ssh/motiv-buy-deploy
# - Public key: ~/.ssh/motiv-buy-deploy.pub
```

### 2. Add Public Key to VPS

```bash
# Copy public key to VPS
ssh-copy-id -i ~/.ssh/motiv-buy-deploy.pub deployer@YOUR_VPS_IP

# Or manually:
cat ~/.ssh/motiv-buy-deploy.pub | ssh deployer@YOUR_VPS_IP "mkdir -p ~/.ssh && cat >> ~/.ssh/authorized_keys"
```

### 3. Add Private Key to GitHub Secrets

```bash
# Display private key (copy the entire output)
cat ~/.ssh/motiv-buy-deploy

# Then:
# 1. Go to GitHub → Settings → Secrets → New secret
# 2. Name: VPS_PRODUCTION_SSH_KEY (or VPS_STAGING_SSH_KEY)
# 3. Value: Paste the ENTIRE private key including:
#    -----BEGIN OPENSSH PRIVATE KEY-----
#    ... key contents ...
#    -----END OPENSSH PRIVATE KEY-----
```

### 4. Generate Secure Passwords

```bash
# Database password
echo "DB_PASSWORD: $(openssl rand -base64 32)"

# Redis password
echo "REDIS_PASSWORD: $(openssl rand -base64 32)"

# JWT secret (longer for better security)
echo "JWT_SECRET: $(openssl rand -base64 64)"
```

### 5. Get API Tokens

**Telegram Bot Token:**
1. Open Telegram and search for @BotFather
2. Send `/newbot` command
3. Follow instructions
4. Copy the token (format: `1234567890:ABCdefGHIjklMNOpqrsTUVwxyz`)

**CryptoBot API Key:**
1. Go to CryptoBot dashboard
2. Create new API key
3. Copy the key

### 6. Add All Secrets to GitHub

For each secret:

1. Go to: `https://github.com/YOUR_USERNAME/motiv-buy/settings/secrets/actions`
2. Click **New repository secret**
3. Enter **Name** exactly as shown in tables above
4. Paste the **Value**
5. Click **Add secret**

---

## Verification

### Test SSH Connection

```bash
# Test SSH with the key
ssh -i ~/.ssh/motiv-buy-deploy deployer@YOUR_VPS_IP

# Should connect without password
```

### Verify Secrets in Workflow

After adding secrets, trigger a workflow:

```bash
git commit --allow-empty -m "Test workflow"
git push
```

Check workflow logs in GitHub Actions tab.

---

## Security Best Practices

1. **Never commit secrets to git**
   - Use `.env` files locally
   - Add `.env` to `.gitignore` (already done)

2. **Use strong, unique passwords**
   - Minimum 32 characters for passwords
   - Minimum 64 characters for JWT secrets
   - Generate with `openssl rand -base64`

3. **Rotate secrets regularly**
   - Update every 90 days
   - Update immediately if compromised

4. **Use separate secrets for staging/production**
   - Never use production tokens in staging
   - Use different bot tokens
   - Use different API keys

5. **Limit secret access**
   - Only repository admins should have access
   - Use GitHub environments for additional protection

6. **Monitor secret usage**
   - Review workflow logs
   - Check for unauthorized access
   - Enable audit logs

---

## Troubleshooting

### SSH Connection Fails

```bash
# Test SSH connection
ssh -vvv -i ~/.ssh/motiv-buy-deploy deployer@YOUR_VPS_IP

# Common issues:
# 1. Wrong key format - ensure you copied ENTIRE key including BEGIN/END lines
# 2. Wrong permissions - run: chmod 600 ~/.ssh/motiv-buy-deploy
# 3. Public key not on VPS - run: ssh-copy-id again
# 4. Wrong username - verify with VPS admin
```

### Workflow Can't Read Secrets

1. Verify secret names match EXACTLY (case-sensitive)
2. Check workflow file uses correct secret names
3. Ensure secrets are added to repository (not organization)
4. Check repository settings allow Actions

### Database Connection Fails

1. Verify database credentials in secrets
2. Check `.env` file on VPS matches secrets
3. Test database connection:
   ```bash
   docker compose exec postgres psql -U $DB_USER $DB_NAME
   ```

---

## Environment Variables Template

Use this template when adding secrets to GitHub:

```bash
# Staging
VPS_STAGING_HOST=<vps-ip>
VPS_STAGING_USER=deployer
VPS_STAGING_SSH_KEY=<private-key-contents>
VPS_STAGING_DEPLOY_PATH=/opt/motiv-buy
STAGING_DB_NAME=motiv_buy_staging
STAGING_DB_USER=postgres
STAGING_DB_PASSWORD=<generate>
STAGING_REDIS_PASSWORD=<generate>
STAGING_JWT_SECRET=<generate>
STAGING_TELEGRAM_BOT_TOKEN=<from-botfather>
STAGING_CRYPTO_BOT_API_KEY=<from-cryptobot>

# Production
VPS_PRODUCTION_HOST=<vps-ip-or-domain>
VPS_PRODUCTION_USER=deployer
VPS_PRODUCTION_SSH_KEY=<private-key-contents>
VPS_PRODUCTION_DEPLOY_PATH=/opt/motiv-buy
PRODUCTION_DB_NAME=motiv_buy_prod
PRODUCTION_DB_USER=motiv_buy_user
PRODUCTION_DB_PASSWORD=<generate>
PRODUCTION_REDIS_PASSWORD=<generate>
PRODUCTION_JWT_SECRET=<generate>
PRODUCTION_TELEGRAM_BOT_TOKEN=<from-botfather>
PRODUCTION_CRYPTO_BOT_API_KEY=<from-cryptobot>
PRODUCTION_DOMAIN=yourdomain.com
LETSENCRYPT_EMAIL=admin@yourdomain.com
```

---

## Quick Commands Reference

```bash
# Generate all secrets at once
echo "=== Database Password ==="
openssl rand -base64 32

echo "=== Redis Password ==="
openssl rand -base64 32

echo "=== JWT Secret ==="
openssl rand -base64 64

# Test SSH connection
ssh -i ~/.ssh/motiv-buy-deploy deployer@VPS_IP "echo 'Connection successful!'"

# View secret on VPS (for debugging)
ssh deployer@VPS_IP "cat /opt/motiv-buy/.env | grep DB_PASSWORD"
```

---

## Additional Resources

- [GitHub Encrypted Secrets Documentation](https://docs.github.com/en/actions/security-guides/encrypted-secrets)
- [SSH Key Generation Guide](https://docs.github.com/en/authentication/connecting-to-github-with-ssh/generating-a-new-ssh-key-and-adding-it-to-the-ssh-agent)
- [OpenSSL Documentation](https://www.openssl.org/docs/)

---

**Last Updated**: 2024-01-01
