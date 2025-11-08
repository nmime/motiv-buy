#!/bin/bash

# ==============================================
# VPS Initial Setup Script
# ==============================================
# This script sets up a fresh VPS for deployment
# Run this script on your VPS as root or with sudo
# Usage: sudo bash setup-vps.sh

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

print_success() {
    echo -e "${GREEN}✓ $1${NC}"
}

print_error() {
    echo -e "${RED}✗ $1${NC}"
}

print_info() {
    echo -e "${YELLOW}ℹ $1${NC}"
}

# Check if running as root
if [[ $EUID -ne 0 ]]; then
   print_error "This script must be run as root (use sudo)"
   exit 1
fi

print_info "Starting VPS setup for Motiv-Buy deployment..."

# ==============================================
# 1. Update System
# ==============================================
print_info "Updating system packages..."
apt-get update && apt-get upgrade -y
print_success "System updated"

# ==============================================
# 2. Install Docker
# ==============================================
if ! command -v docker &> /dev/null; then
    print_info "Installing Docker..."

    # Install prerequisites
    apt-get install -y \
        ca-certificates \
        curl \
        gnupg \
        lsb-release

    # Add Docker's official GPG key
    mkdir -p /etc/apt/keyrings
    curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg

    # Set up Docker repository
    echo \
      "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \
      $(lsb_release -cs) stable" | tee /etc/apt/sources.list.d/docker.list > /dev/null

    # Install Docker
    apt-get update
    apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

    # Enable and start Docker
    systemctl enable docker
    systemctl start docker

    print_success "Docker installed successfully"
else
    print_success "Docker already installed"
fi

# ==============================================
# 3. Create deployment user
# ==============================================
DEPLOY_USER="deployer"

if ! id "$DEPLOY_USER" &>/dev/null; then
    print_info "Creating deployment user: $DEPLOY_USER"

    useradd -m -s /bin/bash $DEPLOY_USER
    usermod -aG docker $DEPLOY_USER

    print_success "User $DEPLOY_USER created and added to docker group"
else
    print_success "User $DEPLOY_USER already exists"
fi

# ==============================================
# 4. Setup deployment directory
# ==============================================
DEPLOY_PATH="/opt/motiv-buy"

print_info "Creating deployment directory..."
mkdir -p $DEPLOY_PATH
chown -R $DEPLOY_USER:$DEPLOY_USER $DEPLOY_PATH
print_success "Deployment directory created at $DEPLOY_PATH"

# ==============================================
# 5. Install UFW Firewall
# ==============================================
print_info "Configuring firewall..."

apt-get install -y ufw

# Allow SSH
ufw allow ssh
ufw allow 22/tcp

# Allow HTTP and HTTPS
ufw allow 80/tcp
ufw allow 443/tcp

# Enable firewall
ufw --force enable

print_success "Firewall configured"

# ==============================================
# 6. Install fail2ban
# ==============================================
print_info "Installing fail2ban for SSH protection..."
apt-get install -y fail2ban

systemctl enable fail2ban
systemctl start fail2ban

print_success "fail2ban installed and started"

# ==============================================
# 7. Setup automatic security updates
# ==============================================
print_info "Setting up automatic security updates..."
apt-get install -y unattended-upgrades
dpkg-reconfigure -plow unattended-upgrades
print_success "Automatic security updates enabled"

# ==============================================
# 8. Install Nginx (optional - can be dockerized)
# ==============================================
read -p "Install Nginx on host (y/n)? " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    print_info "Installing Nginx..."
    apt-get install -y nginx certbot python3-certbot-nginx
    systemctl enable nginx
    systemctl start nginx
    print_success "Nginx installed"
fi

# ==============================================
# 9. Create backup directory
# ==============================================
print_info "Creating backup directory..."
mkdir -p /backup/motiv-buy
chown -R $DEPLOY_USER:$DEPLOY_USER /backup/motiv-buy
print_success "Backup directory created"

# ==============================================
# 10. Setup SSH for deployment user
# ==============================================
print_info "Setting up SSH for deployment..."

mkdir -p /home/$DEPLOY_USER/.ssh
touch /home/$DEPLOY_USER/.ssh/authorized_keys
chmod 700 /home/$DEPLOY_USER/.ssh
chmod 600 /home/$DEPLOY_USER/.ssh/authorized_keys
chown -R $DEPLOY_USER:$DEPLOY_USER /home/$DEPLOY_USER/.ssh

print_info "Add your GitHub Actions public SSH key to: /home/$DEPLOY_USER/.ssh/authorized_keys"

# ==============================================
# Summary
# ==============================================
echo ""
print_success "=== VPS Setup Complete ==="
echo ""
echo "Next steps:"
echo "1. Add your GitHub Actions SSH public key to: /home/$DEPLOY_USER/.ssh/authorized_keys"
echo "2. Create .env file at: $DEPLOY_PATH/.env"
echo "3. Configure GitHub Secrets with:"
echo "   - VPS_PRODUCTION_HOST: <your-vps-ip>"
echo "   - VPS_PRODUCTION_USER: $DEPLOY_USER"
echo "   - VPS_PRODUCTION_SSH_KEY: <your-private-ssh-key>"
echo "   - VPS_PRODUCTION_DEPLOY_PATH: $DEPLOY_PATH"
echo "4. Push to main branch to trigger deployment"
echo ""
print_info "Deployment directory: $DEPLOY_PATH"
print_info "Deployment user: $DEPLOY_USER"
print_info "Backup directory: /backup/motiv-buy"
echo ""
