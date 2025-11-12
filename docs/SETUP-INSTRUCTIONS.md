# Server Setup Instructions

Complete step-by-step guide to setup staging and production servers with automated SSL certificates.

---

## Prerequisites

- VPS servers running Ubuntu 22.04+
- Domain: `motivbuy.com`
- Staging IP: `157.180.64.229`
- Production IP: `65.108.218.78`
- SSH access with key: `~/.ssh/id_rsa`

---

## Step 1: Configure DNS Records

### Staging Server
```
Type: A    Name: st         Value: 157.180.64.229    TTL: 300
Type: A    Name: api.st     Value: 157.180.64.229    TTL: 300
Type: A    Name: bot.st     Value: 157.180.64.229    TTL: 300
```

### Production Server
```
Type: A    Name: @          Value: 65.108.218.78     TTL: 300
Type: A    Name: api        Value: 65.108.218.78     TTL: 300
Type: A    Name: bot        Value: 65.108.218.78     TTL: 300
```

**Wait 5-10 minutes for DNS propagation.**

---

## Step 2: Verify DNS Propagation

```bash
# Staging
dig st.motivbuy.com +short        # Should return: 157.180.64.229
dig api.st.motivbuy.com +short    # Should return: 157.180.64.229
dig bot.st.motivbuy.com +short    # Should return: 157.180.64.229

# Production
dig motivbuy.com +short           # Should return: 65.108.218.78
dig api.motivbuy.com +short       # Should return: 65.108.218.78
dig bot.motivbuy.com +short       # Should return: 65.108.218.78
```

---

## Step 3: Setup SSH Access

```bash
# Test SSH connection to staging
ssh -i ~/.ssh/id_rsa root@157.180.64.229

# Test SSH connection to production
ssh -i ~/.ssh/id_rsa root@65.108.218.78

# If connection works, you're ready to proceed
```

---

## Step 4: Setup Staging Server

```bash
# From your local machine, in project directory
scp scripts/setup-staging-server.sh root@157.180.64.229:/root/setup.sh && \
ssh root@157.180.64.229 "bash /root/setup.sh"
```

**This will automatically:**
- ✅ Install Docker, Nginx, Certbot, Fail2ban
- ✅ Configure firewall (ports 22, 80, 443)
- ✅ Obtain SSL certificates for st.motivbuy.com, api.st.motivbuy.com, bot.st.motivbuy.com
- ✅ Configure automatic security updates
- ✅ Setup auto-renewal for SSL certificates

**Runtime:** ~10 minutes

---

## Step 5: Setup Production Server

```bash
# From your local machine, in project directory
scp scripts/setup-production-server.sh root@65.108.218.78:/root/setup.sh && \
ssh root@65.108.218.78 "bash /root/setup.sh"
```

**Same automated setup for production.**

**Runtime:** ~10 minutes

---

## Step 6: Verify Server Setup

### Staging
```bash
ssh root@157.180.64.229

# Check Docker
docker --version

# Check SSL certificates
sudo certbot certificates

# Should show:
# Certificate Name: st.motivbuy.com
#   Domains: st.motivbuy.com api.st.motivbuy.com bot.st.motivbuy.com
#   Expiry Date: ... (89 days)

exit
```

### Production
```bash
ssh root@65.108.218.78

# Check Docker
docker --version

# Check SSL certificates
sudo certbot certificates

exit
```

---

## Step 7: Generate Secrets

```bash
# Generate database passwords
openssl rand -base64 32  # Copy this for STAGING_DB_PASSWORD
openssl rand -base64 32  # Copy this for STAGING_REDIS_PASSWORD
openssl rand -base64 64  # Copy this for STAGING_JWT_SECRET

# Repeat for production
openssl rand -base64 32  # Copy this for PRODUCTION_DB_PASSWORD
openssl rand -base64 32  # Copy this for PRODUCTION_REDIS_PASSWORD
openssl rand -base64 64  # Copy this for PRODUCTION_JWT_SECRET

# Get SSH private key
cat ~/.ssh/id_rsa
# Copy entire output (including -----BEGIN/END----- lines)
```

---

## Step 8: Add GitHub Secrets

Go to: **GitHub → Repository → Settings → Secrets and variables → Actions → New repository secret**

### Add These Secrets:

**Staging:**
```
VPS_STAGING_HOST              = 157.180.64.229
VPS_STAGING_USER              = deployer
VPS_STAGING_SSH_KEY           = [paste ~/.ssh/id_rsa content]
VPS_STAGING_DEPLOY_PATH       = /opt/motiv-buy
STAGING_DB_NAME               = motiv_buy_staging
STAGING_DB_USER               = postgres
STAGING_DB_PASSWORD           = [from Step 7]
STAGING_REDIS_PASSWORD        = [from Step 7]
STAGING_JWT_SECRET            = [from Step 7]
STAGING_TELEGRAM_BOT_TOKEN    = [your bot token]
STAGING_CRYPTO_BOT_API_KEY    = [your API key]
LETSENCRYPT_EMAIL             = admin@motivbuy.com
```

**Production:**
```
VPS_PRODUCTION_HOST              = 65.108.218.78
VPS_PRODUCTION_USER              = deployer
VPS_PRODUCTION_SSH_KEY           = [paste ~/.ssh/id_rsa content]
VPS_PRODUCTION_DEPLOY_PATH       = /opt/motiv-buy
PRODUCTION_DB_NAME               = motiv_buy_production
PRODUCTION_DB_USER               = postgres
PRODUCTION_DB_PASSWORD           = [from Step 7]
PRODUCTION_REDIS_PASSWORD        = [from Step 7]
PRODUCTION_JWT_SECRET            = [from Step 7]
PRODUCTION_TELEGRAM_BOT_TOKEN    = [your bot token]
PRODUCTION_CRYPTO_BOT_API_KEY    = [your API key]
LETSENCRYPT_EMAIL                = admin@motivbuy.com
```

---

## Step 9: Commit and Push Configuration

```bash
# Add new files
git add config/domains.yml
git add .github/workflows/update-ssl-certificates.yml
git add docs/SSL-MANAGEMENT.md
git add SETUP-INSTRUCTIONS.md

# Commit
git commit -m "feat: add automated SSL certificate management"

# Push to develop
git push origin develop

# Merge to master
git checkout master
git merge develop
git push origin master
```

---

## Step 10: Deploy to Staging

1. Go to: **GitHub → Actions**
2. Select: **Deploy - Staging**
3. Click: **Run workflow**
4. Select branch: **develop**
5. Click: **Run workflow**
6. Wait ~5 minutes

### Verify Staging Deployment

```bash
# Test SSL
curl -I https://st.motivbuy.com
curl -I https://api.st.motivbuy.com

# Test API
curl https://api.st.motivbuy.com/health
# Should return: {"status":"ok"}

# SSH and check containers
ssh deployer@157.180.64.229
cd /opt/motiv-buy
docker compose ps
# All containers should show "healthy"
```

---

## Step 11: Deploy to Production

1. Go to: **GitHub → Actions**
2. Select: **Deploy - Production**
3. Click: **Run workflow**
4. Select branch: **master**
5. Click: **Run workflow**
6. Wait ~5 minutes

### Verify Production Deployment

```bash
# Test SSL
curl -I https://motivbuy.com
curl -I https://api.motivbuy.com

# Test API
curl https://api.motivbuy.com/health
# Should return: {"status":"ok"}

# SSH and check containers
ssh deployer@65.108.218.78
cd /opt/motiv-buy
docker compose ps
```

---

## ✅ Setup Complete!

Your servers are now fully configured with:
- ✅ Automated SSL certificates
- ✅ Automatic security updates
- ✅ Docker containers running
- ✅ Firewall configured
- ✅ Auto-renewal enabled

---

## Adding New Subdomains (Future)

When you need to add a new subdomain (e.g., `admin.st.motivbuy.com`):

```bash
# 1. Add DNS A record
#    admin.st.motivbuy.com → 157.180.64.229

# 2. Edit config/domains.yml
vim config/domains.yml
# Add: - admin.st.motivbuy.com

# 3. Commit and push
git add config/domains.yml
git commit -m "Add admin subdomain"
git push origin develop

# 4. GitHub Actions automatically updates SSL certificate
# 5. Verify: curl -I https://admin.st.motivbuy.com
```

**See:** [docs/SSL-MANAGEMENT.md](docs/SSL-MANAGEMENT.md) for complete SSL management guide.

---

## Troubleshooting

### DNS Not Propagating
```bash
# Check with Google DNS
dig @8.8.8.8 st.motivbuy.com +short

# Check with Cloudflare DNS
dig @1.1.1.1 st.motivbuy.com +short

# Wait 10 more minutes and retry
```

### SSL Certificate Not Obtained
```bash
# SSH to server
ssh root@157.180.64.229

# Check logs
sudo tail -100 /var/log/letsencrypt/letsencrypt.log

# Retry manually
sudo certbot --nginx \
  -d st.motivbuy.com \
  -d api.st.motivbuy.com \
  -d bot.st.motivbuy.com \
  --non-interactive
```

### Deployment Failed
```bash
# Check GitHub Actions logs
# Go to: GitHub → Actions → Failed workflow → View logs

# SSH to server and check
ssh deployer@157.180.64.229
cd /opt/motiv-buy
docker compose logs -f
```

### Can't Connect to Server
```bash
# Check if server is accessible
ping 157.180.64.229

# Check if SSH port is open
nc -zv 157.180.64.229 22

# Try connecting with verbose output
ssh -v root@157.180.64.229
```

---

## Quick Reference

### Server IPs
- **Staging:** 157.180.64.229
- **Production:** 65.108.218.78

### Domains
- **Staging:** st.motivbuy.com, api.st.motivbuy.com, bot.st.motivbuy.com
- **Production:** motivbuy.com, api.motivbuy.com, bot.motivbuy.com

### SSH Commands
```bash
# Staging
ssh deployer@157.180.64.229

# Production
ssh deployer@65.108.218.78
```

### Check Services
```bash
# Docker containers
docker compose ps

# SSL certificates
sudo certbot certificates

# Nginx status
systemctl status nginx

# View logs
docker compose logs -f api
```

---

## Documentation

- **This Guide:** [SETUP-INSTRUCTIONS.md](SETUP-INSTRUCTIONS.md)
- **Scripts Reference:** [scripts/README.md](scripts/README.md)
- **SSL Management:** [docs/SSL-MANAGEMENT.md](docs/SSL-MANAGEMENT.md)
- **CI/CD Workflows:** [.github/workflows/](.github/workflows/)

---

**Total Setup Time:** ~50 minutes
**Manual Steps:** Minimal (DNS + GitHub Secrets only)
**Everything Else:** Fully Automated ✅
