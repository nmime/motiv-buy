# Docker Configuration Patterns

This document outlines the common Docker configuration patterns used across the Motiv-Buy project.

## Common Environment Variables

The project uses consistent environment variable patterns across all Docker Compose files:

### Core Project Variables

```env
PROJECT_NAME=motiv-buy        # REQUIRED: Used for all container and resource naming
ENV=dev|prod                  # Environment suffix for all resources
NODE_ENV=development|production # Node.js environment mode
```

### Service Naming Pattern

All services follow the pattern: `{SERVICE_TYPE}-${ENV}`

- Development: `postgres-dev`, `redis-dev`, `api-dev`, `bot-dev`
- Production: `postgres-prod`, `redis-prod`, `api-prod`, `bot-prod`

### Container Naming Pattern

All containers follow the pattern: `${PROJECT_NAME}-{SERVICE_TYPE}-${ENV}`

- Development: `motiv-buy-postgres-dev`, `motiv-buy-redis-dev`
- Production: `motiv-buy-postgres-prod`, `motiv-buy-redis-prod`

### Network Naming Pattern

Networks follow the pattern: `${PROJECT_NAME}-network-${ENV}`

- Development: `${PROJECT_NAME}-network-dev` (bridge name: `${PROJECT_NAME}-development`)
- Production: `${PROJECT_NAME}-network-prod` (bridge name: `${PROJECT_NAME}-production`)

### Volume Naming Pattern

Volumes follow the pattern: `${PROJECT_NAME}_{SERVICE}_{ENV}_data`

- Development: `${PROJECT_NAME}_postgres_dev_data`, `${PROJECT_NAME}_redis_dev_data`
- Production: `${PROJECT_NAME}_postgres_prod_data`, `${PROJECT_NAME}_redis_prod_data`

## YAML Anchors and Reusability

### Common Defaults

```yaml
x-common-defaults: &common-defaults
  restart: unless-stopped
  networks:
    - ${PROJECT_NAME:-motiv-buy}-network-${ENV:-dev}
```

### Health Check Patterns

```yaml
x-healthcheck-fast: &healthcheck-fast
  interval: 5s|10s # 5s for dev, 10s for prod
  timeout: 3s
  retries: 5

x-healthcheck-standard: &healthcheck-standard
  interval: 10s|30s # 10s for dev, 30s for prod
  timeout: 5s|10s # 5s for dev, 10s for prod
  retries: 3
```

### Environment Variable Groups

```yaml
x-common-env: &common-env
  NODE_ENV: ${NODE_ENV:-development}
  PROJECT_NAME: ${PROJECT_NAME:-motiv-buy}
  ENV: ${ENV:-dev}

x-db-env: &db-env
  DB_HOST: ${PROJECT_NAME:-motiv-buy}-postgres-${ENV:-dev}
  DB_PORT: 5432
  DB_NAME: ${PROJECT_NAME:-motiv-buy}_${NODE_ENV:-development}
  DB_USER: ${PROJECT_NAME:-motiv}_${ENV:-dev} # dev specific
  DB_PASSWORD: ${ENV:-dev}_password_123 # dev specific

x-redis-env: &redis-env
  REDIS_HOST: ${PROJECT_NAME:-motiv-buy}-redis-${ENV:-dev}
  REDIS_PORT: 6379
```

### Resource Limits (Production Only)

```yaml
x-api-resources: &api-resources
  resources:
    limits:
      cpus: '1.0'
      memory: 512M
    reservations:
      cpus: '0.5'
      memory: 256M

x-bot-resources: &bot-resources
  resources:
    limits:
      cpus: '0.5'
      memory: 256M
    reservations:
      cpus: '0.25'
      memory: 128M
```

## Port Configuration

### Development Ports

- PostgreSQL: `5432:5432`
- Redis: `6379:6379`
- API: `3000:3000`
- pgAdmin: `8080:80`
- Redis Commander: `8081:8081`
- Mailcatcher: `1080:1080` (web), `1025:1025` (SMTP)

### Production Ports

- PostgreSQL: `5433:5432` (external port different to avoid conflicts)
- Redis: `6380:6379` (external port different to avoid conflicts)
- API: `3001:3000` (external port different to avoid conflicts)
- Nginx: `80:80`, `443:443`
- Prometheus: `9090:9090`
- Grafana: `3002:3000`

## Environment-Specific Differences

### Development Environment

- **Security**: `POSTGRES_HOST_AUTH_METHOD: trust`
- **Passwords**: Simple, predictable passwords
- **Volumes**: Source code mounted for hot reload
- **Debugging**: Debug ports exposed (9229 for Node.js)
- **Logs**: Debug level logging
- **Profiles**: `admin-tools`, `dev-tools`, `migration` profiles available

### Production Environment

- **Security**: `POSTGRES_HOST_AUTH_METHOD: md5`
- **Passwords**: Secure, environment-variable based
- **Volumes**: No source code mounts
- **Resource Limits**: CPU and memory limits enforced
- **Logs**: Warn level logging
- **Profiles**: `monitoring` profile for Prometheus/Grafana

## Usage Examples

### Starting Development Environment

```bash
# Use default development settings
docker-compose -f docker-compose-dev.yml up

# With custom project name
PROJECT_NAME=my-project docker-compose -f docker-compose-dev.yml up

# With admin tools
docker-compose -f docker-compose-dev.yml --profile admin-tools up
```

### Starting Production Environment

```bash
# Basic production setup
ENV=prod NODE_ENV=production docker-compose -f docker-compose-prod.yml up

# With monitoring
ENV=prod NODE_ENV=production docker-compose -f docker-compose-prod.yml --profile monitoring up

# With custom database user
ENV=prod NODE_ENV=production DB_USER=custom_user docker-compose -f docker-compose-prod.yml up
```

### Environment Variable Override Examples

```bash
# Custom ports for development
DB_PORT_EXTERNAL=5434 API_PORT_EXTERNAL=3001 docker-compose -f docker-compose-dev.yml up

# Custom project name and environment
PROJECT_NAME=motiv-staging ENV=staging docker-compose -f docker-compose-dev.yml up
```

## Benefits of This Approach

1. **Consistency**: All services follow the same naming and configuration patterns
2. **Flexibility**: Easy to customize via environment variables
3. **Maintainability**: YAML anchors reduce duplication and make updates easier
4. **Environment Separation**: Clear distinction between dev and prod configurations
5. **Scalability**: Easy to add new services following the same patterns
6. **Debugging**: Predictable naming makes troubleshooting easier
