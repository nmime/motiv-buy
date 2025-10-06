#!/bin/bash

# Production Readiness Check Script for Motiv-Buy
# This script validates that all required environment variables are set
# and the system is ready for production deployment

set -e

echo "======================================"
echo "Motiv-Buy Production Readiness Check"
echo "======================================"
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Load .env file
if [ -f .env ]; then
    source .env
else
    echo -e "${RED}❌ ERROR: .env file not found${NC}"
    exit 1
fi

# Counter for issues
ERRORS=0
WARNINGS=0

# Function to check if variable is set and not a TODO
check_var() {
    local var_name=$1
    local var_value=${!var_name}
    local is_required=$2

    if [ -z "$var_value" ]; then
        echo -e "${RED}❌ FAIL: $var_name is not set${NC}"
        ((ERRORS++))
        return 1
    elif [[ "$var_value" == *"TODO"* ]]; then
        echo -e "${RED}❌ FAIL: $var_name contains TODO placeholder${NC}"
        ((ERRORS++))
        return 1
    elif [[ "$var_value" == "password" ]] || [[ "$var_value" == "secret" ]] || [[ "$var_value" == "admin" ]]; then
        echo -e "${YELLOW}⚠️  WARN: $var_name appears to be a default/weak value${NC}"
        ((WARNINGS++))
        return 0
    else
        echo -e "${GREEN}✅ PASS: $var_name is set${NC}"
        return 0
    fi
}

# Function to check string length
check_length() {
    local var_name=$1
    local var_value=${!var_name}
    local min_length=$2

    if [ ${#var_value} -lt $min_length ]; then
        echo -e "${YELLOW}⚠️  WARN: $var_name is shorter than recommended ($min_length chars)${NC}"
        ((WARNINGS++))
        return 0
    fi
}

echo "1. Checking Critical Security Variables..."
echo "-------------------------------------------"

# Telegram Bot Token
check_var "BOT_TOKEN" "required"
if [[ "$BOT_TOKEN" != *"TODO"* ]] && [ ! -z "$BOT_TOKEN" ]; then
    if [[ ! "$BOT_TOKEN" =~ ^[0-9]+:.+ ]]; then
        echo -e "${YELLOW}⚠️  WARN: BOT_TOKEN format looks invalid${NC}"
        ((WARNINGS++))
    fi
fi

# JWT Secret
check_var "JWT_SECRET" "required"
check_length "JWT_SECRET" 32

# Database Password
check_var "DB_PASSWORD" "required"
check_length "DB_PASSWORD" 16

# Redis Password
check_var "REDIS_PASSWORD" "required"
check_length "REDIS_PASSWORD" 16

# Grafana Password
check_var "GRAFANA_PASSWORD" "required"

echo ""
echo "2. Checking Application Configuration..."
echo "-------------------------------------------"

# Node Environment
if [ "$NODE_ENV" != "production" ]; then
    echo -e "${YELLOW}⚠️  WARN: NODE_ENV is not set to 'production' (current: $NODE_ENV)${NC}"
    ((WARNINGS++))
else
    echo -e "${GREEN}✅ PASS: NODE_ENV is set to production${NC}"
fi

# Debug Mode
if [ "$DEBUG_MODE" == "true" ]; then
    echo -e "${YELLOW}⚠️  WARN: DEBUG_MODE is enabled (should be false in production)${NC}"
    ((WARNINGS++))
else
    echo -e "${GREEN}✅ PASS: DEBUG_MODE is disabled${NC}"
fi

# Hot Reload
if [ "$HOT_RELOAD" == "true" ]; then
    echo -e "${YELLOW}⚠️  WARN: HOT_RELOAD is enabled (should be false in production)${NC}"
    ((WARNINGS++))
else
    echo -e "${GREEN}✅ PASS: HOT_RELOAD is disabled${NC}"
fi

# Log Level
if [ "$LOG_LEVEL" == "debug" ]; then
    echo -e "${YELLOW}⚠️  WARN: LOG_LEVEL is 'debug' (should be 'warn' or 'error' in production)${NC}"
    ((WARNINGS++))
else
    echo -e "${GREEN}✅ PASS: LOG_LEVEL is appropriate for production${NC}"
fi

echo ""
echo "3. Checking Database Configuration..."
echo "-------------------------------------------"

check_var "DB_HOST" "required"
check_var "DB_PORT" "required"
check_var "DB_USERNAME" "required"
check_var "DB_DATABASE" "required"

# DB SSL
if [ "$DB_SSL" != "true" ]; then
    echo -e "${YELLOW}⚠️  WARN: DB_SSL is not enabled (recommended for production)${NC}"
    ((WARNINGS++))
else
    echo -e "${GREEN}✅ PASS: DB_SSL is enabled${NC}"
fi

# DB Synchronize
if [ "$DB_SYNCHRONIZE" == "true" ]; then
    echo -e "${RED}❌ FAIL: DB_SYNCHRONIZE is enabled (MUST be false in production)${NC}"
    ((ERRORS++))
else
    echo -e "${GREEN}✅ PASS: DB_SYNCHRONIZE is disabled${NC}"
fi

echo ""
echo "4. Checking Redis Configuration..."
echo "-------------------------------------------"

check_var "REDIS_HOST" "required"
check_var "REDIS_PORT" "required"

echo ""
echo "5. Checking Build Configuration..."
echo "-------------------------------------------"

# Check if dist directory exists
if [ -d "dist" ]; then
    echo -e "${GREEN}✅ PASS: Build directory (dist) exists${NC}"
else
    echo -e "${YELLOW}⚠️  WARN: Build directory (dist) not found - run 'npm run build'${NC}"
    ((WARNINGS++))
fi

# Check if Docker files exist
if [ -f "docker-compose-prod.yml" ]; then
    echo -e "${GREEN}✅ PASS: docker-compose-prod.yml exists${NC}"
else
    echo -e "${RED}❌ FAIL: docker-compose-prod.yml not found${NC}"
    ((ERRORS++))
fi

# Check if PM2 config exists
if [ -f "ecosystem.config.js" ]; then
    echo -e "${GREEN}✅ PASS: ecosystem.config.js exists${NC}"
else
    echo -e "${YELLOW}⚠️  WARN: ecosystem.config.js not found (optional if using Docker)${NC}"
    ((WARNINGS++))
fi

echo ""
echo "6. Checking Security Configuration..."
echo "-------------------------------------------"

# Check for hardcoded secrets in code
if grep -r "8227847200:AAHYqkzq8bye1pp8NUGG5aD_N8vuh8ANDIA" --include="*.ts" --include="*.js" . 2>/dev/null | grep -v node_modules | grep -v dist; then
    echo -e "${RED}❌ FAIL: Hardcoded bot token found in source code${NC}"
    ((ERRORS++))
else
    echo -e "${GREEN}✅ PASS: No hardcoded bot tokens found${NC}"
fi

if grep -r "development_jwt_secret_not_for_production" --include="*.ts" --include="*.js" . 2>/dev/null | grep -v node_modules | grep -v dist; then
    echo -e "${RED}❌ FAIL: Development JWT secret found in source code${NC}"
    ((ERRORS++))
else
    echo -e "${GREEN}✅ PASS: No hardcoded JWT secrets found${NC}"
fi

echo ""
echo "7. Checking Required Files..."
echo "-------------------------------------------"

# Check for production documentation
if [ -f "docs/PRODUCTION_DEPLOYMENT.md" ]; then
    echo -e "${GREEN}✅ PASS: Production deployment documentation exists${NC}"
else
    echo -e "${YELLOW}⚠️  WARN: Production deployment documentation not found${NC}"
    ((WARNINGS++))
fi

# Check for .gitignore
if [ -f ".gitignore" ]; then
    echo -e "${GREEN}✅ PASS: .gitignore exists${NC}"

    # Check if .env is in gitignore
    if grep -q "^\.env$" .gitignore; then
        echo -e "${GREEN}✅ PASS: .env is in .gitignore${NC}"
    else
        echo -e "${RED}❌ FAIL: .env is not in .gitignore${NC}"
        ((ERRORS++))
    fi
else
    echo -e "${RED}❌ FAIL: .gitignore not found${NC}"
    ((ERRORS++))
fi

echo ""
echo "======================================"
echo "Summary"
echo "======================================"
echo ""

if [ $ERRORS -eq 0 ] && [ $WARNINGS -eq 0 ]; then
    echo -e "${GREEN}✅ SUCCESS: Production readiness check passed!${NC}"
    echo ""
    echo "Your application is ready for production deployment."
    exit 0
elif [ $ERRORS -eq 0 ]; then
    echo -e "${YELLOW}⚠️  WARNINGS: $WARNINGS warnings found${NC}"
    echo ""
    echo "Your application has minor issues. Review warnings above."
    echo "These are recommendations and won't prevent deployment."
    exit 0
else
    echo -e "${RED}❌ FAILED: $ERRORS critical errors, $WARNINGS warnings${NC}"
    echo ""
    echo "Your application is NOT ready for production deployment."
    echo "Please fix all critical errors before deploying."
    echo ""
    echo "Common fixes:"
    echo "  1. Replace all TODO placeholders in .env"
    echo "  2. Generate secure secrets: openssl rand -base64 32"
    echo "  3. Get Telegram bot token from @BotFather"
    echo "  4. Set NODE_ENV=production"
    echo "  5. Set DB_SYNCHRONIZE=false"
    echo ""
    exit 1
fi
