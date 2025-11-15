# Server Setup Scripts

Automated unified script for complete server setup.

---

## 🚀 Quick Start

### One Command Setup

```bash
# Staging
scp scripts/setup-server.sh root@YOUR_IP:/root/ && \
ssh root@YOUR_IP "bash /root/setup-server.sh staging"

# Production
scp scripts/setup-server.sh root@YOUR_IP:/root/ && \
ssh root@YOUR_IP "bash /root/setup-server.sh production"
```

---

## 📝 Usage

The unified `setup-server.sh` script works for both staging and production:

```bash
sudo bash setup-server.sh [staging|production]
```

**What it does:**
- ✅ System updates with automatic security patches
- ✅ Docker installation
- ✅ User and permission setup
- ✅ Firewall configuration (UFW)
- ✅ Fail2ban for SSH protection
- ✅ Nginx reverse proxy
- ✅ SSL certificate setup (Let's Encrypt)
- ✅ Auto-renewal configuration

**Environment-specific:**
- Staging: Less restrictive firewall, more retries for fail2ban
- Production: Stricter security, rate-limiting on SSH, hardened SSL

---

## 📋 Prerequisites

- Ubuntu 22.04+ server
- Root access via SSH
- DNS records configured and propagated

---

## 🔧 Available Scripts

### setup-server.sh ⭐
**Unified server setup script** (staging and production)

**Usage:**
```bash
# Copy to server
scp scripts/setup-server.sh root@YOUR_IP:/root/

# Run for staging
ssh root@YOUR_IP "bash /root/setup-server.sh staging"

# Run for production
ssh root@YOUR_IP "bash /root/setup-server.sh production"
```

### deploy-local.sh
**Local development helper**

**Usage:**
```bash
./scripts/deploy-local.sh [start|stop|restart|logs|build|clean]
```

**Commands:**
- `start` - Start all services
- `stop` - Stop all services
- `restart` - Restart all services
- `logs` - View logs
- `build` - Build Docker images
- `clean` - Clean up Docker resources

---

## 📚 Database Scripts

### init-db.sql
Production database initialization

### init-db-dev.sql
Development database with additional dev settings

### seed-dev-data.sql/
Development seed data for testing

---

## 🔗 See Also

- Main deployment guide: [docs/DEPLOY.md](../docs/DEPLOY.md)
- Development guidelines: [CLAUDE.md](../CLAUDE.md)
