#!/bin/bash

###############################################################################
# Production-Ready Server Setup Script
# Usage: sudo bash setup-server.sh [staging|production]
# Author: Motiv-Buy Team
# Version: 2.0
###############################################################################

# Set TERM if not set (for SSH non-interactive sessions)
export TERM="${TERM:-xterm}"

set -euo pipefail  # Exit on error, undefined vars, pipe failures

# Script configuration
SCRIPT_VERSION="2.0"
LOG_FILE="/var/log/motiv-buy-setup-$(date +%Y%m%d-%H%M%S).log"
BACKUP_DIR="/root/motiv-buy-setup-backup-$(date +%Y%m%d-%H%M%S)"

###############################################################################
# Logging Functions
###############################################################################

log() {
    echo "[$(date +'%Y-%m-%d %H:%M:%S')] $*" | tee -a "$LOG_FILE"
}

log_success() {
    echo "[OK] $*" | tee -a "$LOG_FILE"
}

log_error() {
    echo "[ERROR] $*" | tee -a "$LOG_FILE" >&2
}

log_warning() {
    echo "[WARN] $*" | tee -a "$LOG_FILE"
}

log_info() {
    echo "[INFO] $*" | tee -a "$LOG_FILE"
}

log_step() {
    echo "" | tee -a "$LOG_FILE"
    echo "========================================" | tee -a "$LOG_FILE"
    echo " $*" | tee -a "$LOG_FILE"
    echo "========================================" | tee -a "$LOG_FILE"
    echo "" | tee -a "$LOG_FILE"
}

###############################################################################
# Error Handling
###############################################################################

cleanup() {
    local exit_code=$?
    if [ $exit_code -ne 0 ]; then
        log_error "Script failed with exit code $exit_code"
        log_info "Log file saved to: $LOG_FILE"
        log_info "Backup directory: $BACKUP_DIR"
    fi
}

trap cleanup EXIT

error_exit() {
    log_error "$1"
    exit 1
}

###############################################################################
# Validation Functions
###############################################################################

check_root() {
    if [ "$EUID" -ne 0 ]; then
        error_exit "This script must be run as root. Use: sudo bash $0"
    fi
}

check_internet() {
    log_info "Checking internet connectivity..."
    if ! ping -c 1 -W 5 8.8.8.8 >/dev/null 2>&1; then
        error_exit "No internet connection detected"
    fi
    log_success "Internet connection verified"
}

check_os() {
    log_info "Checking operating system..."
    if [ ! -f /etc/os-release ]; then
        error_exit "Cannot detect OS. /etc/os-release not found"
    fi

    . /etc/os-release

    if [ "$ID" != "ubuntu" ]; then
        error_exit "This script is designed for Ubuntu. Detected: $ID"
    fi

    local version_id="${VERSION_ID%%.*}"
    if [ "$version_id" -lt 20 ]; then
        error_exit "Ubuntu 20.04+ required. Detected: $VERSION_ID"
    fi

    log_success "OS verified: Ubuntu $VERSION_ID"
}

check_disk_space() {
    log_info "Checking disk space..."
    local available=$(df / | tail -1 | awk '{print $4}')
    local required=5242880  # 5GB in KB

    if [ "$available" -lt "$required" ]; then
        log_warning "Low disk space: $(($available / 1024))MB available (5GB recommended)"
    else
        log_success "Disk space sufficient: $(($available / 1024))MB available"
    fi
}

check_memory() {
    log_info "Checking memory..."
    local total_mem=$(free -m | awk '/^Mem:/{print $2}')

    if [ "$total_mem" -lt 1024 ]; then
        log_warning "Low memory: ${total_mem}MB (2GB recommended)"
    else
        log_success "Memory sufficient: ${total_mem}MB"
    fi
}

###############################################################################
# Argument Parsing
###############################################################################

if [ "$#" -lt 1 ] || [ "$#" -gt 3 ]; then
    echo "Usage: sudo bash $0 [staging|production] [domain] [email]"
    echo ""
    echo "Arguments:"
    echo "  environment  - staging or production (required)"
    echo "  domain       - Domain name (default: motivbuy.com)"
    echo "  email        - Admin email for SSL (default: admin@DOMAIN)"
    echo ""
    echo "Examples:"
    echo "  sudo bash $0 staging"
    echo "  sudo bash $0 production example.com"
    echo "  sudo bash $0 staging mydomain.com admin@mydomain.com"
    exit 1
fi

ENV_TYPE=$1
DOMAIN="${2:-motivbuy.com}"
EMAIL="${3:-admin@$DOMAIN}"

if [ "$ENV_TYPE" != "staging" ] && [ "$ENV_TYPE" != "production" ]; then
    error_exit "Environment must be 'staging' or 'production'"
fi

###############################################################################
# Banner
###############################################################################

clear 2>/dev/null || true
cat << "EOF"
╔═══════════════════════════════════════════════════════════════╗
║                                                               ║
║              Motiv-Buy Server Setup Script                   ║
║                      Version 2.0                              ║
║                                                               ║
╚═══════════════════════════════════════════════════════════════╝
EOF
echo ""

log_info "Environment: ${ENV_TYPE^^}"
log_info "Domain: ${DOMAIN}"
log_info "Email: ${EMAIL}"
log_info "Script version: $SCRIPT_VERSION"
log_info "Log file: $LOG_FILE"
log_info "Backup directory: $BACKUP_DIR"
echo ""

###############################################################################
# Prerequisites
###############################################################################

log_step "Running Pre-Flight Checks"

check_root
check_os
check_internet
check_disk_space
check_memory

# Create backup directory
mkdir -p "$BACKUP_DIR"
log_success "Backup directory created: $BACKUP_DIR"

###############################################################################
# Configuration
###############################################################################

# Domain and email are set from command line arguments above
# DOMAIN="${2:-motivbuy.com}"
# EMAIL="${3:-admin@$DOMAIN}"

DEPLOY_USER="deployer"
DEPLOY_PATH="/opt/motiv-buy"

# Environment-specific settings
if [ "$ENV_TYPE" = "staging" ]; then
    SUBDOMAIN_PREFIX="st"
    FAIL2BAN_MAXRETRY=5
    FAIL2BAN_BANTIME=3600
    SSH_RATE_LIMIT=false
    SSL_HSTS_PRELOAD=false
    LOG_LEVEL="debug"
else
    SUBDOMAIN_PREFIX=""
    FAIL2BAN_MAXRETRY=3
    FAIL2BAN_BANTIME=7200
    SSH_RATE_LIMIT=true
    SSL_HSTS_PRELOAD=true
    LOG_LEVEL="warn"
fi

# Set domain variables
if [ "$ENV_TYPE" = "staging" ]; then
    MAIN_DOMAIN="${SUBDOMAIN_PREFIX}.${DOMAIN}"
    API_DOMAIN="api.${SUBDOMAIN_PREFIX}.${DOMAIN}"
    BOT_DOMAIN="bot.${SUBDOMAIN_PREFIX}.${DOMAIN}"
    SSL_CERT_PATH="/etc/letsencrypt/live/${SUBDOMAIN_PREFIX}.${DOMAIN}"
else
    MAIN_DOMAIN="${DOMAIN}"
    API_DOMAIN="api.${DOMAIN}"
    BOT_DOMAIN="bot.${DOMAIN}"
    SSL_CERT_PATH="/etc/letsencrypt/live/${DOMAIN}"
fi

log_info "Main domain: $MAIN_DOMAIN"
log_info "API domain: $API_DOMAIN"
log_info "Bot domain: $BOT_DOMAIN"

###############################################################################
# Step 1: System Update
###############################################################################

log_step "Step 1/10: System Update"

# Fix locale issues first
log_info "Configuring locale..."
export DEBIAN_FRONTEND=noninteractive
export LC_ALL=C
export LANG=C

# Update package lists
log_info "Updating package lists..."
if apt update 2>&1 | tee -a "$LOG_FILE"; then
    log_success "Package lists updated"
else
    log_warning "Package list update had warnings (continuing)"
fi

# Upgrade system
log_info "Upgrading system packages..."
apt upgrade -y 2>&1 | tee -a "$LOG_FILE" || log_warning "Some packages were not upgraded"
log_success "System packages upgraded"

# Install essential packages
log_info "Installing essential packages..."
ESSENTIAL_PACKAGES=(
    curl
    wget
    git
    ufw
    fail2ban
    unattended-upgrades
    software-properties-common
    ca-certificates
    gnupg
    lsb-release
    apt-transport-https
    python3-pip
    htop
    vim
    net-tools
    dnsutils
)

if apt install -y "${ESSENTIAL_PACKAGES[@]}" 2>&1 | tee -a "$LOG_FILE"; then
    log_success "Essential packages installed"
else
    log_warning "Some packages may not have installed correctly"
fi

###############################################################################
# Step 2: Automatic Updates
###############################################################################

log_step "Step 2/10: Automatic Updates Configuration"

# Backup existing configs
if [ -f /etc/apt/apt.conf.d/50unattended-upgrades ]; then
    cp /etc/apt/apt.conf.d/50unattended-upgrades "$BACKUP_DIR/"
    log_info "Backed up existing unattended-upgrades config"
fi

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

systemctl enable unattended-upgrades 2>/dev/null || log_warning "Could not enable unattended-upgrades via systemctl"
systemctl start unattended-upgrades 2>/dev/null || log_warning "Could not start unattended-upgrades via systemctl"

log_success "Automatic updates configured"

###############################################################################
# Step 3: Docker Installation
###############################################################################

log_step "Step 3/10: Docker Installation"

# Check if Docker is already installed
if command -v docker >/dev/null 2>&1; then
    DOCKER_VERSION=$(docker --version)
    log_success "Docker already installed: $DOCKER_VERSION"
    log_info "Keeping existing Docker installation"
    INSTALL_DOCKER=false
else
    INSTALL_DOCKER=true
fi

if [ "${INSTALL_DOCKER:-false}" = true ]; then
    log_info "Adding Docker GPG key..."
    mkdir -p /etc/apt/keyrings
    curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg

    log_info "Adding Docker repository..."
    echo \
      "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \
      $(lsb_release -cs) stable" | tee /etc/apt/sources.list.d/docker.list > /dev/null

    log_info "Installing Docker..."
    apt update 2>&1 | tee -a "$LOG_FILE"
    apt install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin 2>&1 | tee -a "$LOG_FILE"

    # Try to start Docker
    systemctl enable docker 2>/dev/null || log_warning "Could not enable docker via systemctl"
    systemctl start docker 2>/dev/null || log_warning "Could not start docker via systemctl"

    # Verify Docker is running
    sleep 3
    if docker ps >/dev/null 2>&1; then
        log_success "Docker installed and running: $(docker --version)"
    else
        log_warning "Docker installed but not running"
        log_info "Attempting manual Docker start..."

        # Try manual start
        dockerd >/dev/null 2>&1 &
        sleep 5

        if docker ps >/dev/null 2>&1; then
            log_success "Docker started manually: $(docker --version)"
        else
            log_error "Docker installed but could not be started"
            log_info "You may need to start Docker manually after setup completes"
        fi
    fi
fi

###############################################################################
# Step 4: User Configuration
###############################################################################

log_step "Step 4/10: User Configuration"

# Create deployment user
if id -u "$DEPLOY_USER" >/dev/null 2>&1; then
    log_info "User $DEPLOY_USER already exists"
else
    log_info "Creating user: $DEPLOY_USER..."
    useradd -m -s /bin/bash "$DEPLOY_USER"
    log_success "User created: $DEPLOY_USER"
fi

# Add to groups
log_info "Adding $DEPLOY_USER to groups..."
usermod -aG sudo "$DEPLOY_USER"
usermod -aG docker "$DEPLOY_USER" 2>/dev/null || log_warning "Could not add user to docker group"

# Configure passwordless sudo for deployer
log_info "Configuring passwordless sudo for $DEPLOY_USER..."
echo "$DEPLOY_USER ALL=(ALL) NOPASSWD:ALL" > /etc/sudoers.d/$DEPLOY_USER
chmod 440 /etc/sudoers.d/$DEPLOY_USER
log_success "Passwordless sudo configured"

# Create deployment directory
log_info "Creating deployment directory: $DEPLOY_PATH..."
mkdir -p "$DEPLOY_PATH"
chown -R "$DEPLOY_USER:$DEPLOY_USER" "$DEPLOY_PATH"
log_success "Deployment directory created"

# Setup SSH directory and authorized_keys
log_info "Configuring SSH access for $DEPLOY_USER..."
mkdir -p "/home/$DEPLOY_USER/.ssh"
chmod 700 "/home/$DEPLOY_USER/.ssh"

# Copy SSH keys from root user if available
if [ -f /root/.ssh/authorized_keys ]; then
    log_info "Copying SSH keys from root to $DEPLOY_USER..."
    cp /root/.ssh/authorized_keys "/home/$DEPLOY_USER/.ssh/authorized_keys"
    log_success "SSH keys copied from root"
elif [ ! -f "/home/$DEPLOY_USER/.ssh/authorized_keys" ]; then
    # Create empty authorized_keys if none exist
    touch "/home/$DEPLOY_USER/.ssh/authorized_keys"
    log_warning "No SSH keys found. You'll need to add SSH keys manually:"
    log_info "  cat ~/.ssh/your-key.pub | ssh root@SERVER_IP 'tee -a /home/$DEPLOY_USER/.ssh/authorized_keys'"
fi

# Also check if user has AUTHORIZED_KEYS environment variable or SSH_AUTH_SOCK
if [ -n "${SSH_CONNECTION:-}" ] && [ ! -s "/home/$DEPLOY_USER/.ssh/authorized_keys" ]; then
    log_warning "Connected via SSH but no keys copied. To add your current key:"
    log_info "  Run this from your local machine:"
    log_info "  ssh-copy-id -i ~/.ssh/your-key.pub $DEPLOY_USER@\$(hostname -I | awk '{print \$1}')"
fi

# Set proper permissions
chmod 600 "/home/$DEPLOY_USER/.ssh/authorized_keys"
chown -R "$DEPLOY_USER:$DEPLOY_USER" "/home/$DEPLOY_USER/.ssh"

# Verify setup
if [ -s "/home/$DEPLOY_USER/.ssh/authorized_keys" ]; then
    KEY_COUNT=$(grep -c "^ssh-" "/home/$DEPLOY_USER/.ssh/authorized_keys" 2>/dev/null || echo "0")
    log_success "SSH configured for $DEPLOY_USER ($KEY_COUNT key(s) installed)"
else
    log_warning "SSH directory created but no keys installed yet"
fi

###############################################################################
# Step 5: Firewall Configuration
###############################################################################

log_step "Step 5/10: Firewall Configuration"

# Backup existing UFW rules
if [ -d /etc/ufw ]; then
    cp -r /etc/ufw "$BACKUP_DIR/" 2>/dev/null || true
fi

log_info "Configuring UFW firewall..."
ufw --force reset
ufw default deny incoming
ufw default allow outgoing

# Allow essential services
ufw allow 22/tcp comment 'SSH'
ufw allow 80/tcp comment 'HTTP'
ufw allow 443/tcp comment 'HTTPS'

# Rate limiting for SSH (production only)
if [ "$SSH_RATE_LIMIT" = true ]; then
    log_info "Enabling SSH rate limiting..."
    ufw limit 22/tcp
fi

# Enable firewall
ufw --force enable

log_success "Firewall configured"
ufw status numbered | tee -a "$LOG_FILE"

###############################################################################
# Step 6: Fail2Ban Configuration
###############################################################################

log_step "Step 6/10: Fail2Ban Configuration"

# Backup existing config
if [ -f /etc/fail2ban/jail.local ]; then
    cp /etc/fail2ban/jail.local "$BACKUP_DIR/"
fi

log_info "Configuring Fail2Ban ($ENV_TYPE profile)..."

cp /etc/fail2ban/jail.conf /etc/fail2ban/jail.local

cat > /etc/fail2ban/jail.local << EOF
[DEFAULT]
bantime = $FAIL2BAN_BANTIME
findtime = 600
maxretry = $FAIL2BAN_MAXRETRY
destemail = root@localhost
sendername = Fail2Ban
action = %(action_mwl)s

[sshd]
enabled = true
port = 22
logpath = %(sshd_log)s
backend = %(sshd_backend)s
maxretry = $FAIL2BAN_MAXRETRY
bantime = $FAIL2BAN_BANTIME
EOF

systemctl enable fail2ban 2>/dev/null || log_warning "Could not enable fail2ban via systemctl"
systemctl restart fail2ban 2>/dev/null || log_warning "Could not restart fail2ban via systemctl"

log_success "Fail2Ban configured (max retries: $FAIL2BAN_MAXRETRY, ban time: ${FAIL2BAN_BANTIME}s)"

###############################################################################
# Step 7: Nginx Installation
###############################################################################

log_step "Step 7/10: Nginx Installation"

log_info "Installing Nginx..."
apt install -y nginx 2>&1 | tee -a "$LOG_FILE"

systemctl enable nginx 2>/dev/null || log_warning "Could not enable nginx via systemctl"
systemctl start nginx 2>/dev/null || log_warning "Could not start nginx via systemctl"

# SSL configuration based on environment
if [ "$ENV_TYPE" = "production" ]; then
    SSL_PROTOCOLS="TLSv1.2 TLSv1.3"
    SSL_CIPHERS="ECDHE-RSA-AES256-GCM-SHA512:DHE-RSA-AES256-GCM-SHA512:ECDHE-RSA-AES256-GCM-SHA384:DHE-RSA-AES256-GCM-SHA384"
    HSTS_HEADER="max-age=31536000; includeSubDomains; preload"
else
    SSL_PROTOCOLS="TLSv1.2 TLSv1.3"
    SSL_CIPHERS="HIGH:!aNULL:!MD5"
    HSTS_HEADER="max-age=31536000; includeSubDomains"
fi

log_info "Creating Nginx configuration for $ENV_TYPE..."

# Backup existing config
if [ -f /etc/nginx/sites-available/default ]; then
    cp /etc/nginx/sites-available/default "$BACKUP_DIR/"
fi

# Create HTTP-only configuration (certbot will upgrade to HTTPS later)
cat > /etc/nginx/sites-available/motiv-buy << EOF
# Motiv-Buy $ENV_TYPE Configuration
# Generated: $(date)
# Note: HTTP-only until SSL certificates are obtained

# API Server
server {
    listen 80;
    listen [::]:80;
    server_name ${API_DOMAIN};

    # Allow certbot validation
    location /.well-known/acme-challenge/ {
        root /var/www/html;
    }

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

        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;

        proxy_hide_header X-Powered-By;
    }
}

# Main Domain
server {
    listen 80;
    listen [::]:80;
    server_name ${MAIN_DOMAIN};

    # Allow certbot validation
    location /.well-known/acme-challenge/ {
        root /var/www/html;
    }

    location / {
        return 200 'Motiv-Buy ${ENV_TYPE^} Server - $(date)';
        add_header Content-Type text/plain;
    }
}

# Bot Domain
server {
    listen 80;
    listen [::]:80;
    server_name ${BOT_DOMAIN};

    # Allow certbot validation
    location /.well-known/acme-challenge/ {
        root /var/www/html;
    }

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
EOF

# Enable site
ln -sf /etc/nginx/sites-available/motiv-buy /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default

# Test configuration
if nginx -t 2>&1 | tee -a "$LOG_FILE"; then
    log_success "Nginx configuration valid"
    systemctl reload nginx 2>/dev/null || log_warning "Could not reload nginx"
else
    log_error "Nginx configuration test failed"
fi

log_success "Nginx installed and configured"

###############################################################################
# Step 8: Certbot Installation
###############################################################################

log_step "Step 8/10: Certbot Installation"

log_info "Installing Certbot..."
apt install -y certbot python3-certbot-nginx 2>&1 | tee -a "$LOG_FILE"
log_success "Certbot installed"

###############################################################################
# Step 9: SSL Certificate
###############################################################################

log_step "Step 9/10: SSL Certificate Setup"

log_info "Certificate domains:"
log_info "  - $MAIN_DOMAIN"
log_info "  - $API_DOMAIN"
log_info "  - $BOT_DOMAIN"
echo ""

log_info "Checking DNS configuration..."

DNS_CONFIGURED=true
for domain in "$MAIN_DOMAIN" "$API_DOMAIN" "$BOT_DOMAIN"; do
    if ! host "$domain" >/dev/null 2>&1; then
        log_warning "DNS not configured for: $domain"
        DNS_CONFIGURED=false
    else
        RESOLVED_IP=$(host "$domain" | grep "has address" | head -1 | awk '{print $4}' || echo "unknown")
        if [ "$RESOLVED_IP" != "unknown" ] && [ -n "$RESOLVED_IP" ]; then
            log_success "DNS OK: $domain → $RESOLVED_IP"
        else
            log_warning "DNS record exists but IP not detected for: $domain"
            DNS_CONFIGURED=false
        fi
    fi
done

if [ "$DNS_CONFIGURED" = false ]; then
    log_warning "DNS not fully configured"
    log_info "Nginx is running with HTTP-only configuration"
    log_info "After configuring DNS records, obtain SSL certificates with:"
    echo ""
    echo "  sudo certbot --nginx -d ${MAIN_DOMAIN} -d ${API_DOMAIN} -d ${BOT_DOMAIN}"
    echo ""
    log_info "Certbot will automatically upgrade Nginx to HTTPS"
else
    log_success "DNS fully configured"
    log_info "Attempting SSL certificate issuance and HTTPS upgrade..."

    if certbot --nginx \
        -d "${MAIN_DOMAIN}" \
        -d "${API_DOMAIN}" \
        -d "${BOT_DOMAIN}" \
        --agree-tos \
        --email "${EMAIL}" \
        --non-interactive \
        --redirect 2>&1 | tee -a "$LOG_FILE"; then
        log_success "SSL certificate obtained and Nginx upgraded to HTTPS"
    else
        log_warning "SSL certificate issuance failed"
        log_info "Nginx is running with HTTP-only configuration"
        log_info "Retry manually with:"
        echo "  sudo certbot --nginx -d ${MAIN_DOMAIN} -d ${API_DOMAIN} -d ${BOT_DOMAIN}"
    fi
fi

###############################################################################
# Step 10: Auto-Renewal Setup
###############################################################################

log_step "Step 10/10: SSL Auto-Renewal"

mkdir -p /etc/letsencrypt/renewal-hooks/deploy

cat > /etc/letsencrypt/renewal-hooks/deploy/reload-nginx.sh << 'EOF'
#!/bin/bash
systemctl reload nginx
EOF

chmod +x /etc/letsencrypt/renewal-hooks/deploy/reload-nginx.sh

log_success "SSL auto-renewal configured"

###############################################################################
# Final Summary
###############################################################################

log_step "Setup Complete!"

cat << "EOF"
╔═══════════════════════════════════════════════════════════════╗
║                                                               ║
║                    SETUP COMPLETED!                           ║
║                                                               ║
╚═══════════════════════════════════════════════════════════════╝
EOF
echo ""

log_info "Server Configuration Summary:"
echo ""
echo "  Environment: $ENV_TYPE"
echo "  Deployment Path: $DEPLOY_PATH"
echo "  Deployment User: $DEPLOY_USER"
echo ""

# Show protocol based on whether SSL certificates exist
if [ -d "$SSL_CERT_PATH" ] && [ -f "$SSL_CERT_PATH/fullchain.pem" ]; then
    PROTOCOL="https"
    SSL_STATUS="[OK] Enabled"
else
    PROTOCOL="http"
    SSL_STATUS="[WARN] Not configured (HTTP only)"
fi

echo "  Domains:"
echo "    Main: $PROTOCOL://$MAIN_DOMAIN"
echo "    API:  $PROTOCOL://$API_DOMAIN"
echo "    Bot:  $PROTOCOL://$BOT_DOMAIN"
echo ""
echo "  SSL: $SSL_STATUS"
echo ""
echo "  Security:"
echo "    Firewall: $(ufw status | grep -i "Status:" | awk '{print $2}')"
echo "    Fail2Ban: Max retries $FAIL2BAN_MAXRETRY, Ban time ${FAIL2BAN_BANTIME}s"
echo "    Auto-updates: Enabled"
echo ""
echo "  Services:"
docker --version 2>/dev/null && echo "    Docker: [OK] Installed" || echo "    Docker: [ERROR] Not running"
nginx -v 2>&1 | grep -q "nginx" && echo "    Nginx: [OK] Installed" || echo "    Nginx: [ERROR] Not installed"
certbot --version 2>/dev/null && echo "    Certbot: [OK] Installed" || echo "    Certbot: [ERROR] Not installed"
echo ""

log_info "Next Steps:"
echo ""

# Show DNS/SSL step if not configured
if [ "$PROTOCOL" = "http" ]; then
    echo "  1. Configure DNS records to point to this server:"
    echo "     A    ${SUBDOMAIN_PREFIX:+$SUBDOMAIN_PREFIX}${SUBDOMAIN_PREFIX:+.}${DOMAIN#*.}    → $(hostname -I | awk '{print $1}')"
    echo "     A    api.${SUBDOMAIN_PREFIX:+$SUBDOMAIN_PREFIX.}${DOMAIN}    → $(hostname -I | awk '{print $1}')"
    echo "     A    bot.${SUBDOMAIN_PREFIX:+$SUBDOMAIN_PREFIX.}${DOMAIN}    → $(hostname -I | awk '{print $1}')"
    echo ""
    echo "  2. Obtain SSL certificates (after DNS propagation):"
    echo "     sudo certbot --nginx -d ${MAIN_DOMAIN} -d ${API_DOMAIN} -d ${BOT_DOMAIN}"
    echo ""
    echo "  3. Add your SSH public key:"
    echo "     ssh-copy-id -i ~/.ssh/your-key.pub $DEPLOY_USER@YOUR_SERVER_IP"
    echo ""
    echo "  4. Configure GitHub Secrets (see docs/DEPLOY.md)"
    echo ""
    echo "  5. Deploy from GitHub Actions"
else
    echo "  1. Add your SSH public key:"
    echo "     ssh-copy-id -i ~/.ssh/your-key.pub $DEPLOY_USER@YOUR_SERVER_IP"
    echo ""
    echo "  2. Configure GitHub Secrets (see docs/DEPLOY.md)"
    echo ""
    echo "  3. Deploy from GitHub Actions"
fi
echo ""

log_info "Files Created:"
echo ""
echo "  Log file: $LOG_FILE"
echo "  Backup directory: $BACKUP_DIR"
echo ""

log_success "Server setup completed successfully!"
echo ""
