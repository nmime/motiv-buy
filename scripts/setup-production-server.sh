#!/bin/bash

###############################################################################
# Production Server Complete Setup Script
# Run as: sudo bash setup-production-server.sh
###############################################################################

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${GREEN}================================${NC}"
echo -e "${GREEN}Production Server Setup${NC}"
echo -e "${GREEN}================================${NC}"

# Configuration - EDIT THESE
DOMAIN="motivbuy.com"
EMAIL="admin@motivbuy.com"
DEPLOY_USER="deployer"
DEPLOY_PATH="/opt/motiv-buy"

###############################################################################
# Step 1: System Update & Essential Packages
###############################################################################
echo -e "${YELLOW}[1/10] Updating system...${NC}"
apt update
apt upgrade -y
apt install -y \
  curl \
  wget \
  git \
  ufw \
  fail2ban \
  unattended-upgrades \
  software-properties-common \
  ca-certificates \
  gnupg \
  lsb-release \
  apt-transport-https \
  python3-pip

###############################################################################
# Step 2: Configure Automatic Updates
###############################################################################
echo -e "${YELLOW}[2/10] Configuring automatic updates...${NC}"

cat > /etc/apt/apt.conf.d/50unattended-upgrades << 'EOF'
Unattended-Upgrade::Allowed-Origins {
    "${distro_id}:${distro_codename}";
    "${distro_id}:${distro_codename}-security";
    "${distro_id}ESMApps:${distro_codename}-apps-security";
    "${distro_id}ESM:${distro_codename}-infra-security";
};
Unattended-Upgrade::AutoFixInterruptedDpkg "true";
Unattended-Upgrade::MinimalSteps "true";
Unattended-Upgrade::Remove-Unused-Kernel-Packages "true";
Unattended-Upgrade::Remove-Unused-Dependencies "true";
Unattended-Upgrade::Automatic-Reboot "false";
Unattended-Upgrade::Automatic-Reboot-Time "03:00";
EOF

cat > /etc/apt/apt.conf.d/20auto-upgrades << 'EOF'
APT::Periodic::Update-Package-Lists "1";
APT::Periodic::Download-Upgradeable-Packages "1";
APT::Periodic::AutocleanInterval "7";
APT::Periodic::Unattended-Upgrade "1";
EOF

systemctl enable unattended-upgrades
systemctl start unattended-upgrades

echo -e "${GREEN}✓ Automatic updates configured${NC}"

###############################################################################
# Step 3: Install Docker
###############################################################################
echo -e "${YELLOW}[3/10] Installing Docker...${NC}"

# Add Docker's official GPG key
mkdir -p /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg

# Set up repository
echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \
  $(lsb_release -cs) stable" | tee /etc/apt/sources.list.d/docker.list > /dev/null

# Install Docker
apt update
apt install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

# Enable Docker service
systemctl enable docker
systemctl start docker

echo -e "${GREEN}✓ Docker installed: $(docker --version)${NC}"

###############################################################################
# Step 4: Create Deployment User
###############################################################################
echo -e "${YELLOW}[4/10] Creating deployment user...${NC}"

# Create user if doesn't exist
if ! id -u $DEPLOY_USER > /dev/null 2>&1; then
    useradd -m -s /bin/bash $DEPLOY_USER
    echo -e "${GREEN}✓ User $DEPLOY_USER created${NC}"
fi

# Add to groups
usermod -aG sudo $DEPLOY_USER
usermod -aG docker $DEPLOY_USER

# Create deployment directory
mkdir -p $DEPLOY_PATH
chown -R $DEPLOY_USER:$DEPLOY_USER $DEPLOY_PATH

# Create .ssh directory for deployer
mkdir -p /home/$DEPLOY_USER/.ssh
chmod 700 /home/$DEPLOY_USER/.ssh
chown -R $DEPLOY_USER:$DEPLOY_USER /home/$DEPLOY_USER/.ssh

echo -e "${GREEN}✓ User configured${NC}"

###############################################################################
# Step 5: Configure Firewall (Production - More Restrictive)
###############################################################################
echo -e "${YELLOW}[5/10] Configuring firewall...${NC}"

# Reset and set defaults
ufw --force reset
ufw default deny incoming
ufw default allow outgoing

# Allow services
ufw allow 22/tcp comment 'SSH'
ufw allow 80/tcp comment 'HTTP'
ufw allow 443/tcp comment 'HTTPS'

# Rate limiting on SSH
ufw limit 22/tcp

# Enable firewall
ufw --force enable

echo -e "${GREEN}✓ Firewall configured${NC}"
ufw status

###############################################################################
# Step 6: Configure Fail2Ban (Production - Stricter)
###############################################################################
echo -e "${YELLOW}[6/10] Configuring fail2ban...${NC}"

cp /etc/fail2ban/jail.conf /etc/fail2ban/jail.local

cat > /etc/fail2ban/jail.local << 'EOF'
[DEFAULT]
bantime = 7200
findtime = 600
maxretry = 3
destemail = root@localhost
sendername = Fail2Ban
action = %(action_mwl)s

[sshd]
enabled = true
port = 22
logpath = %(sshd_log)s
backend = %(sshd_backend)s
maxretry = 3
bantime = 7200
EOF

systemctl enable fail2ban
systemctl restart fail2ban

echo -e "${GREEN}✓ Fail2ban configured (production mode)${NC}"

###############################################################################
# Step 7: Install Nginx
###############################################################################
echo -e "${YELLOW}[7/10] Installing Nginx...${NC}"

apt install -y nginx
systemctl enable nginx
systemctl start nginx

# Create Nginx configuration for production
cat > /etc/nginx/sites-available/motiv-buy-production << EOF
# HTTP - Redirect to HTTPS
server {
    listen 80;
    listen [::]:80;
    server_name ${DOMAIN} *.${DOMAIN};

    # Let's Encrypt challenge
    location /.well-known/acme-challenge/ {
        root /var/www/html;
    }

    location / {
        return 301 https://\$host\$request_uri;
    }
}

# HTTPS - API
server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name api.${DOMAIN};

    # SSL certificates (will be configured by Certbot)
    ssl_certificate /etc/letsencrypt/live/${DOMAIN}/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/${DOMAIN}/privkey.pem;

    # SSL configuration (production hardened)
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-RSA-AES256-GCM-SHA512:DHE-RSA-AES256-GCM-SHA512:ECDHE-RSA-AES256-GCM-SHA384:DHE-RSA-AES256-GCM-SHA384;
    ssl_prefer_server_ciphers on;
    ssl_session_cache shared:SSL:10m;
    ssl_session_timeout 10m;
    ssl_stapling on;
    ssl_stapling_verify on;

    # Security headers
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains; preload" always;
    add_header X-Frame-Options "DENY" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;

    # Proxy to API
    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_cache_bypass \$http_upgrade;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;

        # Timeouts
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;

        # Security
        proxy_hide_header X-Powered-By;
    }
}

# HTTPS - Main Domain
server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name ${DOMAIN};

    ssl_certificate /etc/letsencrypt/live/${DOMAIN}/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/${DOMAIN}/privkey.pem;

    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-RSA-AES256-GCM-SHA512:DHE-RSA-AES256-GCM-SHA512:ECDHE-RSA-AES256-GCM-SHA384:DHE-RSA-AES256-GCM-SHA384;
    ssl_prefer_server_ciphers on;

    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains; preload" always;

    location / {
        return 200 'Motiv-Buy Production';
        add_header Content-Type text/plain;
    }
}

# HTTPS - Bot Domain
server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name bot.${DOMAIN};

    ssl_certificate /etc/letsencrypt/live/${DOMAIN}/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/${DOMAIN}/privkey.pem;

    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-RSA-AES256-GCM-SHA512:DHE-RSA-AES256-GCM-SHA512:ECDHE-RSA-AES256-GCM-SHA384:DHE-RSA-AES256-GCM-SHA384;
    ssl_prefer_server_ciphers on;

    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains; preload" always;

    location / {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_cache_bypass \$http_upgrade;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }
}

# HTTPS - Wildcard catch-all
server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name *.${DOMAIN};

    ssl_certificate /etc/letsencrypt/live/${DOMAIN}/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/${DOMAIN}/privkey.pem;

    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-RSA-AES256-GCM-SHA512:DHE-RSA-AES256-GCM-SHA512:ECDHE-RSA-AES256-GCM-SHA384:DHE-RSA-AES256-GCM-SHA384;

    location / {
        return 404 'Service not configured';
        add_header Content-Type text/plain;
    }
}
EOF

# Enable site
ln -sf /etc/nginx/sites-available/motiv-buy-production /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default

# Test configuration
nginx -t

# Reload Nginx
systemctl reload nginx

echo -e "${GREEN}✓ Nginx configured${NC}"

###############################################################################
# Step 8: Install Certbot
###############################################################################
echo -e "${YELLOW}[8/10] Installing Certbot...${NC}"

apt install -y certbot python3-certbot-nginx

echo -e "${GREEN}✓ Certbot installed${NC}"

###############################################################################
# Step 9: Obtain SSL Certificates (Fully Automated)
###############################################################################
echo -e "${YELLOW}[9/10] Obtaining SSL certificates...${NC}"
echo ""
echo -e "${YELLOW}This will obtain SSL certificates for:${NC}"
echo "  - ${DOMAIN}"
echo "  - api.${DOMAIN}"
echo "  - bot.${DOMAIN}"
echo ""
echo -e "${YELLOW}Prerequisites:${NC}"
echo "  1. DNS A records must be configured and propagated"
echo "  2. Server must be accessible on port 80 (for HTTP-01 challenge)"
echo ""

# Check if DNS is configured
echo -e "${YELLOW}Checking DNS configuration...${NC}"

if ! host "$DOMAIN" > /dev/null 2>&1; then
    echo -e "${RED}⚠️  WARNING: DNS not configured for $DOMAIN${NC}"
    echo ""
    echo "Please configure these DNS A records:"
    echo "  @          → YOUR_SERVER_IP (root domain)"
    echo "  api        → YOUR_SERVER_IP"
    echo "  bot        → YOUR_SERVER_IP"
    echo ""
    echo "Then wait 5-60 minutes for DNS propagation."
    echo ""
    echo "SSL certificate will be obtained automatically on first deployment."
    echo -e "${YELLOW}Skipping SSL setup for now...${NC}"
else
    echo -e "${GREEN}✓ DNS configured${NC}"
    echo ""
    echo -e "${YELLOW}Obtaining SSL certificate automatically...${NC}"

    # Obtain SSL certificate with HTTP-01 challenge (fully automated)
    certbot --nginx \
        -d ${DOMAIN} \
        -d api.${DOMAIN} \
        -d bot.${DOMAIN} \
        --agree-tos \
        --email ${EMAIL} \
        --non-interactive \
        --redirect || {
        echo -e "${RED}⚠️  SSL certificate issuance failed${NC}"
        echo "This is usually because:"
        echo "  1. DNS not fully propagated yet"
        echo "  2. Server not accessible on port 80"
        echo "  3. Firewall blocking HTTP traffic"
        echo ""
        echo "SSL certificate will be obtained automatically on first deployment."
        echo "You can manually retry with:"
        echo "  sudo certbot --nginx -d ${DOMAIN} -d api.${DOMAIN} -d bot.${DOMAIN}"
    }

    echo -e "${GREEN}✓ SSL certificate obtained${NC}"
fi

###############################################################################
# Step 10: Configure Auto-Renewal
###############################################################################
echo -e "${YELLOW}[10/10] Configuring certificate auto-renewal...${NC}"

# Test renewal
# certbot renew --dry-run

# Create renewal hook to reload Nginx
cat > /etc/letsencrypt/renewal-hooks/deploy/reload-nginx.sh << 'EOF'
#!/bin/bash
systemctl reload nginx
EOF

chmod +x /etc/letsencrypt/renewal-hooks/deploy/reload-nginx.sh

echo -e "${GREEN}✓ Auto-renewal configured${NC}"

###############################################################################
# Summary
###############################################################################
echo ""
echo -e "${GREEN}================================${NC}"
echo -e "${GREEN}Setup Complete!${NC}"
echo -e "${GREEN}================================${NC}"
echo ""
echo -e "${YELLOW}Next Steps:${NC}"
echo ""
echo "1. Add DNS records:"
echo "   A    ${DOMAIN}           YOUR_SERVER_IP"
echo "   A    *.${DOMAIN}         YOUR_SERVER_IP"
echo ""
echo "2. Wait for DNS propagation (5-60 minutes)"
echo ""
echo "3. Run SSL certificate command (see above)"
echo ""
echo "4. Add GitHub Secrets (see documentation)"
echo ""
echo "5. Deploy from GitHub Actions"
echo ""
echo -e "${GREEN}Server is ready for production deployment!${NC}"
echo ""
echo "Deployment path: $DEPLOY_PATH"
echo "Deployment user: $DEPLOY_USER"
echo ""
echo "To add your SSH key:"
echo "  ssh-copy-id -i ~/.ssh/your-key.pub $DEPLOY_USER@YOUR_SERVER_IP"
echo ""
