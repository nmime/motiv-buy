#!/bin/bash

# ==============================================
# Local Deployment Script
# ==============================================
# This script helps deploy the application locally using Docker Compose
# Usage: ./scripts/deploy-local.sh [start|stop|restart|logs|build]

set -e

COMPOSE_FILE="docker-compose-dev.yml"
PROJECT_NAME="motiv-buy"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Functions
print_success() {
    echo -e "${GREEN}✓ $1${NC}"
}

print_error() {
    echo -e "${RED}✗ $1${NC}"
}

print_info() {
    echo -e "${YELLOW}ℹ $1${NC}"
}

check_env_file() {
    if [ ! -f .env ]; then
        print_error ".env file not found!"
        print_info "Creating .env from .env.example..."
        cp .env.example .env
        print_success ".env file created. Please update it with your actual values."
        exit 1
    fi
}

start() {
    print_info "Starting $PROJECT_NAME services..."
    check_env_file

    docker compose -f $COMPOSE_FILE -p $PROJECT_NAME up -d

    print_success "Services started successfully!"
    print_info "API: http://localhost:3000"
    print_info "Use 'docker compose logs -f' to view logs"
}

stop() {
    print_info "Stopping $PROJECT_NAME services..."
    docker compose -f $COMPOSE_FILE -p $PROJECT_NAME down
    print_success "Services stopped successfully!"
}

restart() {
    print_info "Restarting $PROJECT_NAME services..."
    stop
    start
}

build() {
    print_info "Building Docker images..."
    check_env_file

    docker compose -f $COMPOSE_FILE -p $PROJECT_NAME build --no-cache

    print_success "Build completed successfully!"
}

logs() {
    docker compose -f $COMPOSE_FILE -p $PROJECT_NAME logs -f
}

status() {
    print_info "Service status:"
    docker compose -f $COMPOSE_FILE -p $PROJECT_NAME ps
}

clean() {
    print_info "Cleaning up Docker resources..."
    docker compose -f $COMPOSE_FILE -p $PROJECT_NAME down -v --remove-orphans
    docker system prune -f
    print_success "Cleanup completed!"
}

# Main script logic
case "${1:-start}" in
    start)
        start
        ;;
    stop)
        stop
        ;;
    restart)
        restart
        ;;
    build)
        build
        ;;
    logs)
        logs
        ;;
    status)
        status
        ;;
    clean)
        clean
        ;;
    *)
        echo "Usage: $0 {start|stop|restart|build|logs|status|clean}"
        exit 1
        ;;
esac
