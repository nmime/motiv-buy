# Server Setup Scripts

Automated scripts for complete staging and production server setup with wildcard SSL certificates and automatic updates.

---

## 📋 Overview

These scripts automate the complete server setup process:

- ✅ System updates with automatic security patches
- ✅ Docker installation and configuration
- ✅ User and permission setup
- ✅ Firewall configuration (UFW)
- ✅ Fail2ban for SSH protection
- ✅ Nginx reverse proxy
- ✅ Wildcard SSL certificate setup
- ✅ Auto-renewal configuration

---

## 🚀 Quick Start

> **📌 Simplest Method (One Command):**
> ```bash
> # Staging
> scp scripts/setup-staging-server.sh root@YOUR_STAGING_IP:/root/setup.sh && \
> ssh root@YOUR_STAGING_IP "bash /root/setup.sh"
>
> # Production
> scp scripts/setup-production-server.sh root@YOUR_PRODUCTION_IP:/root/setup.sh && \
> ssh root@YOUR_PRODUCTION_IP "bash /root/setup.sh"
> ```

---

### Method 1: Copy via SCP (Recommended for Private Repos)

**Staging Server:**
```bash
# From your local machine
scp scripts/setup-staging-server.sh root@YOUR_STAGING_IP:/root/setup.sh
ssh root@YOUR_STAGING_IP "bash /root/setup.sh"
```

**Production Server:**
```bash
# From your local machine
scp scripts/setup-production-server.sh root@YOUR_PRODUCTION_IP:/root/setup.sh
ssh root@YOUR_PRODUCTION_IP "bash /root/setup.sh"
```

### Method 2: Direct Copy-Paste

**Staging Server:**
```bash
# 1. SSH to server
ssh root@YOUR_STAGING_IP

# 2. Create script file
nano setup.sh

# 3. Copy-paste content from scripts/setup-staging-server.sh
# 4. Save: Ctrl+O, Enter, Ctrl+X

# 5. Run script
bash setup.sh
```

**Production Server:**
```bash
# 1. SSH to server
ssh root@YOUR_PRODUCTION_IP

# 2. Create script file
nano setup.sh

# 3. Copy-paste content from scripts/setup-production-server.sh
# 4. Save: Ctrl+O, Enter, Ctrl+X

# 5. Run script
bash setup.sh
```

### Method 3: Clone Repository (Requires GitHub SSH Key)

```bash
# 1. SSH to server
ssh root@YOUR_STAGING_IP

# 2. Setup GitHub SSH key (if not already done)
ssh-keygen -t ed25519 -C "server@motivbuy.com" -f ~/.ssh/github
cat ~/.ssh/github.pub
# Add this public key to GitHub: Settings → SSH and GPG keys

# 3. Clone repository
git clone git@github.com:YOUR_ORG/motiv-buy.git
cd motiv-buy

# 4. Run script
bash scripts/setup-staging-server.sh
```

---

## 📦 What's Included

### `setup-staging-server.sh`

Complete staging server setup for `st.motivbuy.com`:

**Configuration:**
- Domain: `st.motivbuy.com`
- Subdomains: `api.st.motivbuy.com`, `bot.st.motivbuy.com`
- User: `deployer`
- Path: `/opt/motiv-buy`
- Environment: Staging (debug logging enabled)

**Steps:**
1. System update + essential packages
2. Automatic updates configuration
3. Docker installation
4. Deployment user creation
5. Firewall configuration (SSH, HTTP, HTTPS)
6. Fail2ban configuration
7. Nginx installation + configuration
8. Certbot installation
9. **Automated SSL certificate obtainment**
10. Auto-renewal configuration

**Runtime:** ~10 minutes (fully automated)

### `setup-production-server.sh`

Complete production server setup for `motivbuy.com`:

**Configuration:**
- Domain: `motivbuy.com`
- Subdomains: `api.motivbuy.com`, `bot.motivbuy.com`
- User: `deployer`
- Path: `/opt/motiv-buy`
- Environment: Production (hardened security)

**Differences from Staging:**
- Stricter firewall rules (SSH rate limiting)
- More aggressive fail2ban configuration
- Hardened SSL configuration
- Production-grade cipher suites
- Additional security headers
- Reduced ban retry attempts (3 instead of 5)

**Steps:** Same as staging (1-10)

**Runtime:** ~10 minutes (fully automated)

---

## 🔒 SSL Certificate Setup

### Fully Automated SSL Certificates ✅

SSL certificates are **automatically obtained** during server setup - no manual steps required!

**Initial Setup (Automatic):**
- Setup script automatically obtains SSL certificates via HTTP-01 challenge
- Covers: `st.motivbuy.com`, `api.st.motivbuy.com`, `bot.st.motivbuy.com`
- Auto-renewal configured (every 60 days)

**Prerequisites:**
- DNS A records must be configured and propagated before running setup script
- Server must be accessible on port 80 (firewall allows HTTP)

### Adding New Subdomains (CI/CD Automated)

Add new subdomain via git push:

```bash
# 1. Configure DNS A record
admin.st.motivbuy.com → 157.180.64.229

# 2. Update config/domains.yml
vim config/domains.yml
# Add: - admin.st.motivbuy.com

# 3. Commit and push
git add config/domains.yml
git commit -m "Add admin subdomain"
git push origin develop

# ✅ GitHub Actions automatically updates SSL certificate!
```

**Complete SSL Management Guide:** [../docs/SSL-MANAGEMENT.md](../docs/SSL-MANAGEMENT.md)

---

## 📝 Prerequisites

### Before Running Scripts

1. **VPS Server:**
   - Ubuntu 22.04 LTS or newer
   - Minimum 2GB RAM
   - 20GB+ disk space
   - Root access

2. **DNS Configuration:**

   **Staging:**
   ```
   A    st           YOUR_STAGING_IP
   A    *.st         YOUR_STAGING_IP
   ```

   **Production:**
   ```
   A    @            YOUR_PRODUCTION_IP
   A    *            YOUR_PRODUCTION_IP
   ```

3. **Required Information:**
   - Server IP address
   - Domain name configured
   - Email address for SSL certificates
   - (Optional) DNS provider API credentials

### DNS Propagation

After adding DNS records, wait 5-60 minutes before running SSL setup:

```bash
# Check DNS propagation
dig st.motivbuy.com +short
dig api.st.motivbuy.com +short
dig motivbuy.com +short
dig api.motivbuy.com +short
```

---

## 🔧 Configuration Customization

### Edit Before Running

Both scripts have configuration variables at the top:

**Staging (`setup-staging-server.sh`):**
```bash
DOMAIN="motivbuy.com"
STAGING_SUBDOMAIN="st"
EMAIL="admin@motivbuy.com"
DEPLOY_USER="deployer"
DEPLOY_PATH="/opt/motiv-buy"
```

**Production (`setup-production-server.sh`):**
```bash
DOMAIN="motivbuy.com"
EMAIL="admin@motivbuy.com"
DEPLOY_USER="deployer"
DEPLOY_PATH="/opt/motiv-buy"
```

### Custom Domains

To use different domain:

```bash
# Edit script before running
nano setup-staging-server.sh

# Change these lines:
DOMAIN="your-domain.com"
EMAIL="your-email@your-domain.com"
```

---

## ✅ Post-Setup Verification

### Check Services

```bash
# Docker
docker --version
systemctl status docker

# Nginx
nginx -t
systemctl status nginx

# Firewall
sudo ufw status

# Fail2ban
sudo fail2ban-client status sshd

# Certbot
certbot --version
certbot certificates
```

### Test Deployment

```bash
# Check deployment directory
ls -la /opt/motiv-buy

# Check user permissions
sudo -u deployer docker ps

# Check SSL certificate
sudo certbot certificates

# Test Nginx configuration
curl -I https://api.st.motivbuy.com
curl -I https://api.motivbuy.com
```

---

## 🔑 GitHub Secrets Setup

After server setup, add these secrets to GitHub:

**Repository → Settings → Secrets and variables → Actions**

### Staging Secrets

```
VPS_STAGING_HOST              = YOUR_STAGING_IP
VPS_STAGING_USER              = deployer
VPS_STAGING_SSH_KEY           = <private SSH key>
VPS_STAGING_DEPLOY_PATH       = /opt/motiv-buy
STAGING_DB_NAME               = motiv_buy_staging
STAGING_DB_USER               = postgres
STAGING_DB_PASSWORD           = <generate with: openssl rand -base64 32>
STAGING_REDIS_PASSWORD        = <generate with: openssl rand -base64 32>
STAGING_JWT_SECRET            = <generate with: openssl rand -base64 64>
STAGING_TELEGRAM_BOT_TOKEN    = <your bot token>
STAGING_CRYPTO_BOT_API_KEY    = <your API key>
LETSENCRYPT_EMAIL             = admin@motivbuy.com
```

### Production Secrets

```
VPS_PRODUCTION_HOST              = YOUR_PRODUCTION_IP
VPS_PRODUCTION_USER              = deployer
VPS_PRODUCTION_SSH_KEY           = <private SSH key>
VPS_PRODUCTION_DEPLOY_PATH       = /opt/motiv-buy
PRODUCTION_DB_NAME               = motiv_buy_production
PRODUCTION_DB_USER               = postgres
PRODUCTION_DB_PASSWORD           = <generate with: openssl rand -base64 32>
PRODUCTION_REDIS_PASSWORD        = <generate with: openssl rand -base64 32>
PRODUCTION_JWT_SECRET            = <generate with: openssl rand -base64 64>
PRODUCTION_TELEGRAM_BOT_TOKEN    = <your bot token>
PRODUCTION_CRYPTO_BOT_API_KEY    = <your API key>
LETSENCRYPT_EMAIL                = admin@motivbuy.com
```

### Generate Secrets Locally

```bash
# Database password
openssl rand -base64 32

# Redis password
openssl rand -base64 32

# JWT secret
openssl rand -base64 64

# Get SSH private key
cat ~/.ssh/motiv-buy-staging
cat ~/.ssh/motiv-buy-production
```

---

## 🚀 Deploy from GitHub Actions

After setup complete:

1. Go to: **GitHub → Actions**
2. Select workflow:
   - **Deploy - Staging** (for staging)
   - **Deploy - Production** (for production)
3. Click: **Run workflow**
4. Select branch/tag
5. Click: **Run workflow**
6. Wait ~5 minutes for deployment

### Verify Deployment

```bash
# SSH to server
ssh deployer@YOUR_SERVER_IP

# Check containers
cd /opt/motiv-buy
docker compose ps

# Check logs
docker compose logs -f api

# Test API
curl http://localhost:3000/health
```

---

## 🐛 Troubleshooting

### Script Fails During Execution

```bash
# Check logs
tail -100 /var/log/syslog

# Re-run specific step manually
# Example: Docker installation
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
```

### SSL Certificate Fails

```bash
# Check DNS
dig st.motivbuy.com +short
dig _acme-challenge.st.motivbuy.com TXT +short

# Check Certbot logs
sudo tail -100 /var/log/letsencrypt/letsencrypt.log

# Retry certificate
sudo certbot certonly --dns-cloudflare \
  --dns-cloudflare-credentials /root/.cloudflare.ini \
  -d st.motivbuy.com -d *.st.motivbuy.com \
  --agree-tos --email admin@motivbuy.com
```

### Nginx Fails to Start

```bash
# Test configuration
sudo nginx -t

# Check error logs
sudo tail -100 /var/log/nginx/error.log

# Common fix: SSL certificate paths
sudo nano /etc/nginx/sites-available/motiv-buy-staging
# Verify SSL paths match:
# ssl_certificate /etc/letsencrypt/live/st.motivbuy.com/fullchain.pem;
# ssl_certificate_key /etc/letsencrypt/live/st.motivbuy.com/privkey.pem;

# Reload Nginx
sudo systemctl reload nginx
```

### Docker Permission Denied

```bash
# Add user to docker group
sudo usermod -aG docker deployer

# Re-login or activate group
newgrp docker

# Test
docker ps
```

### Firewall Blocks SSH

```bash
# Access via VPS console (not SSH)
# Allow SSH
sudo ufw allow 22/tcp
sudo ufw reload

# Check rules
sudo ufw status numbered
```

---

## 📚 Additional Documentation

- **Setup Instructions:** [../SETUP-INSTRUCTIONS.md](../SETUP-INSTRUCTIONS.md) - Complete step-by-step setup guide
- **SSL Management:** [../docs/SSL-MANAGEMENT.md](../docs/SSL-MANAGEMENT.md) - Automated SSL certificate management
- **CI/CD Pipeline:** [../.github/workflows/](../.github/workflows/)

---

## 🔒 Security Notes

### Automatic Updates

Both scripts configure unattended-upgrades:

- Security updates: **Automatic**
- System updates: **Automatic**
- Reboot: **Manual** (disabled by default)
- Update time: **3:00 AM daily**

### Fail2ban Protection

**Staging:**
- Ban time: 1 hour
- Max retries: 5
- Find time: 10 minutes

**Production:**
- Ban time: 2 hours
- Max retries: 3 (stricter)
- Find time: 10 minutes

### Firewall Rules

**Allowed ports:**
- 22 (SSH) - Rate limited in production
- 80 (HTTP) - Redirects to HTTPS
- 443 (HTTPS)

**Everything else:** Blocked by default

### SSL Security

**Production configuration:**
- TLSv1.2, TLSv1.3 only
- Strong cipher suites (ECDHE-RSA-AES256-GCM)
- HSTS enabled (max-age: 1 year)
- OCSP stapling enabled
- Session caching enabled

---

## 💡 Tips

1. **Run scripts on fresh servers** - Avoid conflicts with existing configurations
2. **Test staging first** - Verify process before setting up production
3. **Save script output** - Copy output for debugging if needed
4. **Use Cloudflare for SSL** - Easiest automated wildcard certificates
5. **Monitor renewals** - Check `sudo certbot certificates` monthly
6. **Keep servers updated** - Scripts enable automatic security updates
7. **Backup before changes** - Always backup before manual server changes

---

## ⏱️ Total Setup Time

| Step                  | Time      |
| --------------------- | --------- |
| Run setup script      | 10 min    |
| DNS propagation       | 5-60 min  |
| SSL certificate setup | 5-15 min  |
| GitHub secrets config | 10 min    |
| First deployment      | 5 min     |
| **Total**             | **35-100 min** |

---

## 📞 Support

If you encounter issues:

1. Check troubleshooting section above
2. Review detailed guides in `/docs`
3. Check GitHub Actions logs
4. Review server logs: `/var/log/`

---

**Ready to deploy?** Start with staging server setup, test thoroughly, then proceed to production.
