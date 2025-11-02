# Production Deployment Guide - Motiv-Buy

## 📋 Pre-Deployment Checklist

Before deploying to production, ensure all environment variables are configured and the system is production-ready.

### Critical Security Requirements

**⚠️ NEVER deploy to production without completing these steps:**

1. **Remove Development Secrets from .env file**
2. **Configure Production Environment Variables**
3. **Set up SSL/TLS Certificates**
4. **Configure Database Backups**
5. **Set up Monitoring & Alerting**

---

## 🔐 Required Environment Variables

### Critical Security Variables (MUST BE SET)

| Variable           | Description            | How to Generate                               | Required |
| ------------------ | ---------------------- | --------------------------------------------- | -------- |
| `BOT_TOKEN`        | Telegram Bot Token     | Get from [@BotFather](https://t.me/BotFather) | ✅ YES   |
| `JWT_SECRET`       | JWT signing secret     | `openssl rand -base64 32`                     | ✅ YES   |
| `DB_PASSWORD`      | PostgreSQL password    | `openssl rand -base64 24`                     | ✅ YES   |
| `REDIS_PASSWORD`   | Redis password         | `openssl rand -base64 24`                     | ✅ YES   |
| `GRAFANA_PASSWORD` | Grafana admin password | Choose secure password                        | ✅ YES   |

### Production Configuration Variables

| Variable       | Default     | Production Value       | Required |
| -------------- | ----------- | ---------------------- | -------- |
| `NODE_ENV`     | development | `production`           | ✅ YES   |
| `PROJECT_NAME` | motiv-buy   | `motiv-buy`            | ✅ YES   |
| `DB_HOST`      | localhost   | Database hostname      | ✅ YES   |
| `DB_PORT`      | 5432        | `5432`                 | ✅ YES   |
| `DB_USERNAME`  | postgres    | `motiv_user`           | ✅ YES   |
| `DB_DATABASE`  | motiv_buy   | `motiv_buy_production` | ✅ YES   |
| `REDIS_HOST`   | localhost   | Redis hostname         | ✅ YES   |
| `REDIS_PORT`   | 6379        | `6379`                 | ✅ YES   |
| `PORT`         | 3000        | `3000`                 | ✅ YES   |
| `LOG_LEVEL`    | debug       | `warn` or `error`      | ✅ YES   |

### Optional Production Variables

| Variable        | Description          | Required    |
| --------------- | -------------------- | ----------- |
| `SENTRY_DSN`    | Error tracking DSN   | Recommended |
| `SSL_CERT_PATH` | SSL certificate path | For HTTPS   |
| `SSL_KEY_PATH`  | SSL private key path | For HTTPS   |

---

## 🚀 Deployment Methods

### Method 1: Docker Compose (Recommended)

**Prerequisites:**

- Docker Engine 20.10+
- Docker Compose v2.0+

**Steps:**

1. **Configure Environment Variables**

```bash
cd /Users/nmi/IT/Projects/motiv-buy/monorepo
cp .env.example .env.production
nano .env.production
```

2. **Set Production Variables in .env.production**

```bash
NODE_ENV=production
PROJECT_NAME=motiv-buy
BOT_TOKEN=your_actual_bot_token_here
JWT_SECRET=$(openssl rand -base64 32)
DB_PASSWORD=$(openssl rand -base64 24)
REDIS_PASSWORD=$(openssl rand -base64 24)
GRAFANA_PASSWORD=your_secure_password
```

3. **Build Production Images**

```bash
docker-compose -f docker-compose-prod.yml build
```

4. **Run Database Migrations**

```bash
docker-compose -f docker-compose-prod.yml run --rm migration-dev npm run migration:run
```

5. **Start Production Services**

```bash
docker-compose -f docker-compose-prod.yml up -d
```

6. **Verify Deployment**

```bash
# Check service health
docker-compose -f docker-compose-prod.yml ps

# Check API health
curl http://localhost:3001/health

# View logs
docker-compose -f docker-compose-prod.yml logs -f api-prod
```

7. **Enable Monitoring (Optional)**

```bash
docker-compose -f docker-compose-prod.yml --profile monitoring up -d
```

---

### Method 2: PM2 (Node.js Process Manager)

**Prerequisites:**

- Node.js 20+
- PM2 installed globally: `npm install -g pm2`

**Steps:**

1. **Configure Environment Variables**

```bash
# Edit .env with production values
nano .env
```

2. **Install Dependencies**

```bash
npm install --production
```

3. **Build Application**

```bash
npm run build
```

4. **Run Database Migrations**

```bash
npm run migration:prod
```

5. **Start with PM2**

```bash
# Production mode
pm2 start ecosystem.config.js --env production

# Or staging mode
pm2 start ecosystem.config.js --env staging
```

6. **Configure PM2 Startup**

```bash
# Generate startup script
pm2 startup

# Save current process list
pm2 save
```

7. **Monitor Applications**

```bash
# View status
pm2 status

# Monitor in real-time
pm2 monit

# View logs
pm2 logs
```

---

## 🔒 SSL/TLS Certificate Setup

### Using Let's Encrypt (Free)

1. **Install Certbot**

```bash
sudo apt-get update
sudo apt-get install certbot
```

2. **Obtain Certificate**

```bash
sudo certbot certonly --standalone -d your-domain.com
```

3. **Copy Certificates to Project**

```bash
mkdir -p /Users/nmi/IT/Projects/motiv-buy/monorepo/config/nginx/ssl
sudo cp /etc/letsencrypt/live/your-domain.com/fullchain.pem config/nginx/ssl/cert.pem
sudo cp /etc/letsencrypt/live/your-domain.com/privkey.pem config/nginx/ssl/key.pem
```

4. **Update Nginx Configuration**

```bash
# Edit config/nginx/nginx-prod.conf
# Update server_name to your-domain.com
nano config/nginx/nginx-prod.conf
```

5. **Set Auto-Renewal**

```bash
sudo crontab -e
# Add: 0 3 * * * certbot renew --quiet
```

---

## 🗄️ Database Management

### Production Database Setup

1. **Create Production Database**

```sql
CREATE DATABASE motiv_buy_production;
CREATE USER motiv_user WITH ENCRYPTED PASSWORD 'your_secure_password';
GRANT ALL PRIVILEGES ON DATABASE motiv_buy_production TO motiv_user;
```

2. **Run Migrations**

```bash
# Docker
docker-compose -f docker-compose-prod.yml run --rm migration-dev npm run migration:run

# PM2/Direct
npm run migration:prod
```

3. **Backup Strategy**

```bash
# Create backup script
cat > backup-db.sh << 'EOF'
#!/bin/bash
BACKUP_DIR="/var/backups/postgres"
DATE=$(date +%Y%m%d_%H%M%S)
pg_dump -U motiv_user motiv_buy_production | gzip > $BACKUP_DIR/motiv_buy_$DATE.sql.gz
# Keep only last 30 days
find $BACKUP_DIR -name "motiv_buy_*.sql.gz" -mtime +30 -delete
EOF

chmod +x backup-db.sh

# Add to crontab (daily at 2 AM)
crontab -e
# Add: 0 2 * * * /path/to/backup-db.sh
```

---

## 📊 Monitoring & Observability

### Access Monitoring Tools

| Tool       | URL                   | Default Credentials         |
| ---------- | --------------------- | --------------------------- |
| Grafana    | http://localhost:3002 | admin / `$GRAFANA_PASSWORD` |
| Prometheus | http://localhost:9090 | No auth                     |

### Key Metrics to Monitor

1. **Application Metrics**
   - Request rate (requests/second)
   - Response time (p50, p95, p99)
   - Error rate (4xx, 5xx)
   - Active connections

2. **System Metrics**
   - CPU usage
   - Memory usage
   - Disk I/O
   - Network throughput

3. **Database Metrics**
   - Connection pool usage
   - Query performance
   - Replication lag (if applicable)

4. **Redis Metrics**
   - Memory usage
   - Hit rate
   - Connected clients

---

## 🔍 Health Checks

### API Health Endpoint

```bash
curl http://localhost:3001/health
```

**Expected Response:**

```json
{
  "status": "ok",
  "info": {
    "database": { "status": "up" },
    "redis": { "status": "up" }
  },
  "error": {},
  "details": {
    "database": { "status": "up" },
    "redis": { "status": "up" }
  }
}
```

---

## 🚨 Troubleshooting

### Common Issues

#### 1. Application Won't Start

```bash
# Check logs
docker-compose -f docker-compose-prod.yml logs api-prod
# or
pm2 logs motiv-buy-api

# Common causes:
# - Missing environment variables
# - Database connection failure
# - Port already in use
```

#### 2. Database Connection Error

```bash
# Verify database is running
docker-compose -f docker-compose-prod.yml ps postgres-prod

# Test connection
psql -h localhost -U motiv_user -d motiv_buy_production

# Check credentials in .env
```

#### 3. Redis Connection Error

```bash
# Verify Redis is running
docker-compose -f docker-compose-prod.yml ps redis-prod

# Test connection
redis-cli -h localhost -p 6379 -a your_redis_password ping
```

---

## 📝 Maintenance Tasks

### Update Application

```bash
# Pull latest code
git pull origin master

# Rebuild images
docker-compose -f docker-compose-prod.yml build

# Run migrations
docker-compose -f docker-compose-prod.yml run --rm migration-dev npm run migration:run

# Restart services with zero downtime
docker-compose -f docker-compose-prod.yml up -d --no-deps --build api-prod bot-prod
```

### Scale Services

```bash
# Scale API instances
docker-compose -f docker-compose-prod.yml up -d --scale api-prod=3

# PM2 scaling
pm2 scale motiv-buy-api +2
```

---

## 🔐 Security Best Practices

1. **Never commit .env to version control**
2. **Use strong, randomly generated passwords**
3. **Enable SSL/TLS for all production traffic**
4. **Regularly update dependencies**: `npm audit fix`
5. **Enable rate limiting** (already configured)
6. **Use security headers** (configured in Nginx)
7. **Regular security audits**
8. **Keep Docker images updated**
9. **Monitor logs for suspicious activity**
10. **Use secrets management** (AWS Secrets Manager, HashiCorp Vault)

---

## 📞 Support & Resources

- **Application Logs**: `docker-compose -f docker-compose-prod.yml logs -f`
- **PM2 Logs**: `pm2 logs`
- **Health Check**: `curl http://localhost:3001/health`
- **Docker Status**: `docker-compose -f docker-compose-prod.yml ps`

---

## 🎯 Production Readiness Checklist

- [ ] All TODO items in .env replaced with actual values
- [ ] JWT_SECRET generated with `openssl rand -base64 32`
- [ ] DB_PASSWORD set to secure random password
- [ ] REDIS_PASSWORD set to secure random password
- [ ] BOT_TOKEN obtained from @BotFather
- [ ] SSL certificates configured (if using HTTPS)
- [ ] Database backups configured
- [ ] Monitoring enabled (Grafana/Prometheus)
- [ ] Log rotation configured
- [ ] Firewall rules configured
- [ ] Health checks verified
- [ ] Error tracking configured (Sentry)
- [ ] Load testing completed
- [ ] Disaster recovery plan documented
- [ ] Team trained on deployment procedures

---

**Last Updated**: 2025-10-03
**Version**: 1.0.0
