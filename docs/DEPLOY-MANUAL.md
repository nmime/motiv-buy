# Manual Server Deployment Guide

Manual deployment via git pull (no CI/CD).

---

## 1. Install Node.js via NVM

```bash
# Install nvm
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash

# Reload shell
source ~/.bashrc

# Install Node.js 20
nvm install 20
nvm use 20
nvm alias default 20

# Verify
node -v  # v20.x.x

# Install pnpm
npm install -g pnpm@10
```

---

## 2. Install Docker

```bash
# Remove old versions
sudo apt remove docker docker-engine docker.io containerd runc

# Install dependencies
sudo apt update
sudo apt install -y ca-certificates curl gnupg

# Add Docker GPG key
sudo install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
sudo chmod a+r /etc/apt/keyrings/docker.gpg

# Add repository
echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \
  $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | \
  sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

# Install Docker
sudo apt update
sudo apt install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

# Add user to docker group
sudo usermod -aG docker $USER
newgrp docker

# Verify
docker --version
docker compose version
```

---

## 3. Install Certbot & Get SSL Certificates

```bash
# Install certbot
sudo apt install -y certbot

# Stop nginx if running
sudo systemctl stop nginx 2>/dev/null || true

# Get certificates
sudo certbot certonly --standalone -d motivbuy.com -d www.motivbuy.com
sudo certbot certonly --standalone -d api.motivbuy.com
sudo certbot certonly --standalone -d bot.motivbuy.com

# Verify
sudo ls -la /etc/letsencrypt/live/

# Enable auto-renewal
sudo systemctl enable certbot.timer
sudo systemctl start certbot.timer
```

---

## 4. Install & Configure Nginx

```bash
# Install nginx
sudo apt install -y nginx

# Remove default config
sudo rm /etc/nginx/sites-enabled/default

# Create config
sudo nano /etc/nginx/sites-available/motivbuy
```

**Paste:**

```nginx
# HTTP → HTTPS redirect
server {
    listen 80;
    server_name motivbuy.com www.motivbuy.com api.motivbuy.com bot.motivbuy.com;
    return 301 https://$server_name$request_uri;
}

# Main site
server {
    listen 443 ssl http2;
    server_name motivbuy.com www.motivbuy.com;

    ssl_certificate /etc/letsencrypt/live/motivbuy.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/motivbuy.com/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;

    location / {
        return 200 'MotivBuy';
        add_header Content-Type text/plain;
    }

    location /health {
        return 200 'OK';
        add_header Content-Type text/plain;
    }
}

# API
server {
    listen 443 ssl http2;
    server_name api.motivbuy.com;

    ssl_certificate /etc/letsencrypt/live/api.motivbuy.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/api.motivbuy.com/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;

    client_max_body_size 50M;

    location / {
        proxy_pass http://127.0.0.1:5501;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        proxy_read_timeout 90;
    }
}

# Bot webhook
server {
    listen 443 ssl http2;
    server_name bot.motivbuy.com;

    ssl_certificate /etc/letsencrypt/live/bot.motivbuy.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/bot.motivbuy.com/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;

    location / {
        proxy_pass http://127.0.0.1:5502;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

```bash
# Enable & start
sudo ln -s /etc/nginx/sites-available/motivbuy /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
sudo systemctl enable nginx
```

---

## 5. Clone & Setup

```bash
# Clone
git clone git@github.com:user/motiv-buy.git /opt/motiv-buy
cd /opt/motiv-buy

# Setup env
cp .env.example .env
nano .env

# Create directories
mkdir -p /opt/motiv-buy/data/{postgres,redis,nats,api/{logs,uploads,temp},bot/{logs,temp,sessions},nginx/logs,prometheus,grafana,backups}

# Set ownership
sudo chown -R $USER:$USER /opt/motiv-buy
```

---

## 6. First Deploy

```bash
cd /opt/motiv-buy

# Build & start (exclude nginx - host nginx handles SSL)
docker compose -f docker-compose.local.yml up -d --build api bot postgres redis nats

# Wait for healthy containers
docker compose -f docker-compose.local.yml ps

# Run migrations
docker compose -f docker-compose.local.yml exec -u root api node dist/apps/migration/src/main.js up

# Check logs
docker compose -f docker-compose.local.yml logs -f api bot
```

---

## 7. Shell Scripts

Scripts are included in `scripts/` folder. Make them executable:

```bash
chmod +x /opt/motiv-buy/scripts/server-*.sh
```

Available scripts:
- `server-deploy.sh` - Pull, build, migrate
- `server-logs.sh` - View logs
- `server-restart.sh` - Restart services
- `server-status.sh` - Check status
- `server-backup-db.sh` - Backup database

---

## Quick Reference

| Command | Description |
|---------|-------------|
| `./scripts/server-deploy.sh` | Pull, build, migrate |
| `./scripts/server-logs.sh` | View logs |
| `./scripts/server-logs.sh api` | View api logs only |
| `./scripts/server-restart.sh` | Restart api + bot |
| `./scripts/server-status.sh` | Check status |
| `./scripts/server-backup-db.sh` | Backup database |

### Manual Commands

```bash
# Quick update (one-liner)
cd /opt/motiv-buy && git pull && docker compose -f docker-compose.local.yml up -d --build

# Shell access
docker compose -f docker-compose.local.yml exec api sh

# DB access
source .env && docker compose -f docker-compose.local.yml exec postgres psql -U $DB_USER $DB_NAME

# Cert renewal
sudo certbot renew
sudo systemctl reload nginx
```

---

## Troubleshooting

```bash
# Container issues
docker compose -f docker-compose.local.yml logs <service>
docker compose -f docker-compose.local.yml restart <service>

# Rebuild single service
docker compose -f docker-compose.local.yml up -d --build api

# Full restart
docker compose -f docker-compose.local.yml down
docker compose -f docker-compose.local.yml up -d

# Check certificates
sudo certbot certificates
sudo certbot renew --dry-run
```
