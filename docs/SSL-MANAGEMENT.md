# SSL Certificate Management

Fully automated SSL certificate management system using GitHub Actions and Let's Encrypt.

---

## Overview

This system provides **fully automated** SSL certificate management:

- ✅ **Automated Setup**: Initial SSL certificates obtained during server setup
- ✅ **Auto-Renewal**: Certbot renews certificates automatically every 60 days
- ✅ **CI/CD Integration**: Add new subdomains via git push
- ✅ **No DNS API Required**: Works with any DNS provider (uses HTTP-01 challenge)
- ✅ **Zero Manual Intervention**: Everything automated via GitHub Actions

---

## How It Works

### 1. Initial Setup (Automated)

Server setup scripts automatically obtain SSL certificates:

```bash
# Staging setup
scp scripts/setup-staging-server.sh root@157.180.64.229:/root/setup.sh
ssh root@157.180.64.229 "bash /root/setup.sh"

# ✅ SSL certificates automatically obtained for:
#    - st.motivbuy.com
#    - api.st.motivbuy.com
#    - bot.st.motivbuy.com
```

**No manual steps required!**

### 2. Auto-Renewal (Automated)

Certbot's systemd timer automatically renews certificates:

- **Frequency**: Every 12 hours
- **Renewal Threshold**: 30 days before expiry
- **Post-Renewal**: Nginx automatically reloaded

**Check renewal status:**
```bash
ssh deployer@157.180.64.229
sudo systemctl status certbot.timer
sudo certbot certificates
```

### 3. Adding New Domains (CI/CD Automated)

Add new subdomain in 3 simple steps:

**Step 1: Configure DNS** (one-time, manual)
```
Type: A
Name: admin.st
Value: 157.180.64.229
TTL: 300
```

**Step 2: Update domains.yml** (local)
```yaml
# config/domains.yml
staging:
  domains:
    - st.motivbuy.com
    - api.st.motivbuy.com
    - bot.st.motivbuy.com
    - admin.st.motivbuy.com  # ← Add new domain
```

**Step 3: Commit and Push**
```bash
git add config/domains.yml
git commit -m "Add admin subdomain to staging"
git push
```

**GitHub Actions automatically:**
1. Parses `config/domains.yml`
2. SSH to staging server
3. Expands SSL certificate with new domain
4. Reloads Nginx
5. Verifies HTTPS works

**Done!** `https://admin.st.motivbuy.com` now has valid SSL certificate.

---

## Configuration

### Domains Configuration File

**File:** `config/domains.yml`

```yaml
staging:
  base_domain: st.motivbuy.com
  email: admin@motivbuy.com
  domains:
    - st.motivbuy.com
    - api.st.motivbuy.com
    - bot.st.motivbuy.com

production:
  base_domain: motivbuy.com
  email: admin@motivbuy.com
  domains:
    - motivbuy.com
    - api.motivbuy.com
    - bot.motivbuy.com
```

### GitHub Workflow

**File:** `.github/workflows/update-ssl-certificates.yml`

**Triggers:**
- **Automatic**: Push to `config/domains.yml`
  - `develop` branch → Updates staging
  - `master` branch → Updates production
- **Manual**: Run workflow with environment selection

---

## Adding New Subdomains

### Staging Environment

```bash
# 1. Add DNS A record (in your DNS provider)
admin.st.motivbuy.com → 157.180.64.229

# 2. Wait for DNS propagation (2-10 minutes)
dig admin.st.motivbuy.com +short

# 3. Update config/domains.yml
# Add: - admin.st.motivbuy.com

# 4. Commit and push to develop branch
git checkout develop
git add config/domains.yml
git commit -m "Add admin subdomain to staging"
git push origin develop

# 5. GitHub Actions automatically updates SSL certificate
# Check: https://github.com/YOUR_ORG/motiv-buy/actions
```

### Production Environment

```bash
# 1. Add DNS A record
admin.motivbuy.com → 65.108.218.78

# 2. Wait for DNS propagation
dig admin.motivbuy.com +short

# 3. Update config/domains.yml
# Add: - admin.motivbuy.com under production.domains

# 4. Commit and push to master branch
git checkout master
git add config/domains.yml
git commit -m "Add admin subdomain to production"
git push origin master

# 5. GitHub Actions automatically updates SSL certificate
```

---

## Manual SSL Update (If Needed)

### Staging

```bash
ssh deployer@157.180.64.229

# Expand certificate with new domain
sudo certbot --nginx \
  -d st.motivbuy.com \
  -d api.st.motivbuy.com \
  -d bot.st.motivbuy.com \
  -d admin.st.motivbuy.com \
  --expand \
  --non-interactive

# Reload Nginx
sudo systemctl reload nginx

# Verify
sudo certbot certificates
```

### Production

```bash
ssh deployer@65.108.218.78

# Expand certificate with new domain
sudo certbot --nginx \
  -d motivbuy.com \
  -d api.motivbuy.com \
  -d bot.motivbuy.com \
  -d admin.motivbuy.com \
  --expand \
  --non-interactive

# Reload Nginx
sudo systemctl reload nginx

# Verify
sudo certbot certificates
```

---

## Troubleshooting

### Certificate Not Obtained During Setup

**Cause:** DNS not propagated or server not accessible

**Solution:**
```bash
ssh deployer@157.180.64.229

# Manually obtain certificate
sudo certbot --nginx \
  -d st.motivbuy.com \
  -d api.st.motivbuy.com \
  -d bot.st.motivbuy.com \
  --agree-tos \
  --email admin@motivbuy.com \
  --non-interactive
```

### GitHub Actions Workflow Fails

**Check logs:**
1. Go to: GitHub → Actions → Update SSL Certificates
2. Click on failed workflow run
3. Check error message

**Common issues:**
- **DNS not configured**: Add A record and wait for propagation
- **SSH connection failed**: Verify GitHub secrets are correct
- **Permission denied**: Check deployer user has sudo permissions

**Fix and retry:**
```bash
# Re-run failed workflow from GitHub Actions UI
# Or manually trigger:
# Actions → Update SSL Certificates → Run workflow
```

### Certificate Renewal Failed

**Check renewal logs:**
```bash
ssh deployer@157.180.64.229
sudo tail -100 /var/log/letsencrypt/letsencrypt.log
```

**Test renewal:**
```bash
sudo certbot renew --dry-run
```

**Force renewal (if needed):**
```bash
sudo certbot renew --force-renewal
sudo systemctl reload nginx
```

### Nginx Configuration Error

**Test configuration:**
```bash
sudo nginx -t
```

**Common fix - Update SSL paths:**
```bash
sudo nano /etc/nginx/sites-available/motiv-buy-staging

# Ensure SSL paths match certificate name
ssl_certificate /etc/letsencrypt/live/st.motivbuy.com/fullchain.pem;
ssl_certificate_key /etc/letsencrypt/live/st.motivbuy.com/privkey.pem;

sudo nginx -t
sudo systemctl reload nginx
```

---

## Certificate Information

### View Certificates

```bash
ssh deployer@157.180.64.229

# List all certificates
sudo certbot certificates

# Output example:
# Certificate Name: st.motivbuy.com
#   Domains: st.motivbuy.com api.st.motivbuy.com bot.st.motivbuy.com
#   Expiry Date: 2025-03-15 (89 days)
#   Certificate Path: /etc/letsencrypt/live/st.motivbuy.com/fullchain.pem
```

### Certificate Locations

**Staging:**
```
/etc/letsencrypt/live/st.motivbuy.com/fullchain.pem
/etc/letsencrypt/live/st.motivbuy.com/privkey.pem
```

**Production:**
```
/etc/letsencrypt/live/motivbuy.com/fullchain.pem
/etc/letsencrypt/live/motivbuy.com/privkey.pem
```

### Renewal Schedule

```bash
# Check timer status
sudo systemctl status certbot.timer

# View next renewal time
sudo systemctl list-timers certbot.timer
```

---

## Security

### Certificate Validation

All certificates use:
- **Challenge Type**: HTTP-01 (port 80)
- **Validation**: Domain ownership via temporary file
- **Encryption**: 2048-bit RSA key
- **Validity**: 90 days (auto-renewed at 60 days)

### SSL Configuration

**Staging:**
- TLS 1.2, TLS 1.3
- Standard cipher suites
- HSTS: 1 year

**Production:**
- TLS 1.2, TLS 1.3 only
- Strong cipher suites (ECDHE-RSA-AES256-GCM)
- HSTS: 1 year with preload
- OCSP stapling enabled
- Session caching enabled

### Nginx Security Headers

All environments include:
```nginx
add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
add_header X-Frame-Options "SAMEORIGIN" always;
add_header X-Content-Type-Options "nosniff" always;
add_header X-XSS-Protection "1; mode=block" always;
```

---

## Best Practices

### 1. Test in Staging First

Always add new domains to staging before production:

```bash
# 1. Add to staging (develop branch)
git checkout develop
# Edit config/domains.yml (staging section)
git commit -m "Add admin subdomain to staging"
git push origin develop

# 2. Test in staging
curl -I https://admin.st.motivbuy.com

# 3. If successful, add to production (master branch)
git checkout master
# Edit config/domains.yml (production section)
git commit -m "Add admin subdomain to production"
git push origin master
```

### 2. Configure DNS Before Code Changes

Always add DNS records **before** updating `config/domains.yml`:

```bash
# ❌ WRONG ORDER:
# 1. Update config/domains.yml
# 2. Push to GitHub
# 3. Add DNS record ← Too late! SSL will fail

# ✅ CORRECT ORDER:
# 1. Add DNS record
# 2. Wait for propagation (5-10 min)
# 3. Update config/domains.yml
# 4. Push to GitHub ← SSL succeeds!
```

### 3. Monitor Certificate Expiry

Set up monitoring alerts:

```bash
# Check expiry dates monthly
sudo certbot certificates | grep Expiry

# Output should show >30 days remaining
# If <30 days, investigate renewal issues
```

### 4. Keep Domains List Synchronized

Ensure `config/domains.yml` matches actual Nginx configuration:

```bash
# Check current certificate domains
ssh deployer@157.180.64.229
sudo certbot certificates

# Compare with config/domains.yml
cat config/domains.yml

# If mismatch, update config/domains.yml and push
```

---

## Comparison: Before vs After

### Before (Wildcard Certificate)

❌ **Manual Steps:**
- Obtain wildcard certificate manually
- Add TXT records to DNS
- Wait for DNS propagation
- Manually renew every 90 days
- Or: Setup DNS provider API credentials

✅ **Benefit:**
- New subdomains automatically covered

### After (CI/CD Managed)

✅ **Automated:**
- Initial certificates: Fully automated
- Renewals: Fully automated
- New domains: Git push → Done!
- Works with any DNS provider

✅ **Benefits:**
- No manual intervention
- Version controlled (git)
- Auditable (GitHub Actions logs)
- No DNS provider API needed

⚠️ **Trade-off:**
- Must explicitly add each subdomain to config/domains.yml
- But this is automated via simple git push!

---

## Quick Reference

### Add New Staging Subdomain

```bash
# 1. DNS
admin.st.motivbuy.com → 157.180.64.229

# 2. Code
vim config/domains.yml  # Add domain
git commit -am "Add admin subdomain"
git push origin develop

# Done! GitHub Actions handles the rest.
```

### Add New Production Subdomain

```bash
# 1. DNS
admin.motivbuy.com → 65.108.218.78

# 2. Code
vim config/domains.yml  # Add domain
git commit -am "Add admin subdomain"
git push origin master

# Done!
```

### Check SSL Status

```bash
# Staging
curl -I https://st.motivbuy.com
sudo certbot certificates

# Production
curl -I https://motivbuy.com
sudo certbot certificates
```

### Manual SSL Update

```bash
# Staging
ssh deployer@157.180.64.229
sudo certbot --nginx -d st.motivbuy.com -d NEW.st.motivbuy.com --expand

# Production
ssh deployer@65.108.218.78
sudo certbot --nginx -d motivbuy.com -d NEW.motivbuy.com --expand
```

---

## Related Documentation

- **Server Setup**: [scripts/README.md](../scripts/README.md)
- **Wildcard SSL Guide** (alternative): [WILDCARD-SSL-SETUP.md](./WILDCARD-SSL-SETUP.md)
- **CI/CD Pipeline**: [../.github/workflows/](../.github/workflows/)

---

**Total Setup Time:** 2 minutes per new subdomain
**Manual Intervention:** None (after initial setup)
**Renewal:** Fully automated

**Your SSL certificates are now managed via git!** 🎉
