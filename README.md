# Motiv-Buy

Motivational shopping bot platform with payment processing, user balance management, and traffic tracking built with NestJS monorepo architecture.

## Author

**@nmime** - [t.me/nmime](https://t.me/nmime)

## Technology Stack

- **Backend Framework:** NestJS 11.x
- **Language:** TypeScript (strict mode)
- **Database:** PostgreSQL with MikroORM
- **Cache:** Redis
- **Message Queue:** NATS
- **Bot Platform:** Telegram Bot API
- **Payment:** CryptoBot API
- **Build Tool:** Nx Monorepo
- **Package Manager:** pnpm
- **Containerization:** Docker & Docker Compose

## Project Structure

```
motiv-buy/
├── apps/
│   ├── api/          # REST API application
│   ├── bot/          # Telegram bot application
│   └── migration/    # Database migration CLI
├── libs/
│   ├── common/       # Cross-cutting concerns
│   │   ├── exception/     # Exception handling
│   │   ├── health/        # Health checks
│   │   ├── intl/          # Internationalization
│   │   ├── logger/        # Logging utilities
│   │   ├── nats/          # NATS messaging
│   │   ├── redis/         # Redis utilities
│   │   ├── response/      # Response formatting
│   │   ├── shared/        # Common utilities
│   │   └── validation/    # Validation pipes
│   ├── database/     # Database entities & repositories
│   └── feature/      # Domain-specific modules
│       ├── auth/          # Authentication & authorization
│       ├── balance/       # User balance management
│       ├── bot/           # Bot-specific features
│       ├── currency/      # Currency management
│       ├── notification/  # Notifications
│       ├── payment/       # Payment processing
│       ├── statistic/     # Statistics & analytics
│       ├── traffic/       # Traffic tracking
│       └── user/          # User management
├── config/           # Configuration files
├── docs/            # Project documentation
└── scripts/         # Utility scripts
```

## Applications

### API (`apps/api`)
REST API backend providing HTTP endpoints for web clients and external integrations.

**Features:**
- User authentication & authorization
- Payment processing
- Balance management
- Statistics & analytics
- Health checks & monitoring

### Bot (`apps/bot`)
Telegram bot interface for user interactions.

**Features:**
- Telegram Bot API integration
- Interactive commands
- Payment notifications
- User management
- Bot-specific business logic

### Migration (`apps/migration`)
Database migration CLI tool for managing schema changes.

**Features:**
- Create migrations
- Run/revert migrations
- Check migration status
- Fresh database setup

## Development

### Prerequisites

- Node.js 20+
- pnpm 9+
- PostgreSQL 15+
- Redis 7+
- Docker & Docker Compose (optional)

### Installation

```bash
# Install dependencies
pnpm install

# Build all projects
pnpm run build

# Run tests
pnpm run test
```

### Development Commands

```bash
# Start all services in development mode
pnpm run dev

# Start specific app
pnpm run dev:api       # Start API server
pnpm run dev:bot       # Start Telegram bot
pnpm run dev:migration # Start migration CLI

# Build specific app
pnpm run build:api
pnpm run build:bot
pnpm run build:migration

# Run tests
pnpm run test              # Run all tests
pnpm run test:watch        # Watch mode
pnpm run test:coverage     # With coverage
pnpm run test:affected     # Only affected tests

# Code quality
pnpm run lint              # Lint code
pnpm run lint:fix          # Fix lint issues
pnpm run format            # Format code
pnpm run format:check      # Check formatting

# Database migrations
pnpm run migration:run     # Run pending migrations
pnpm run migration:revert  # Revert last migration
pnpm run migration:status  # Check migration status
pnpm run migration:create  # Create new migration
pnpm run migration:fresh   # Fresh database (⚠️ DROPS ALL TABLES!)
```

## Deployment

**Complete Setup Guide:** See [docs/SETUP-INSTRUCTIONS.md](docs/SETUP-INSTRUCTIONS.md)

### Environments

- **Staging:** `157.180.64.229` - [st.motivbuy.com](https://st.motivbuy.com)
- **Production:** `65.108.218.78` - [motivbuy.com](https://motivbuy.com)

### GitHub Actions Workflows

- **CI:** Automated testing, linting, and Docker builds
- **Deploy Staging:** Deploy to staging server from develop branch
- **Deploy Production:** Deploy to production server from master branch
- **Update SSL:** Automatically update SSL certificates
- **CodeQL:** Security analysis

## Documentation

- **Development Guidelines:** [CLAUDE.md](CLAUDE.md)
- **Setup Instructions:** [docs/SETUP-INSTRUCTIONS.md](docs/SETUP-INSTRUCTIONS.md)
- **Detailed Docs:** See `docs/` directory

## License

**Proprietary Software** - Copyright © 2024 @nmime. All rights reserved.

This software and associated documentation are the exclusive property of the author. Use, reproduction, distribution, modification, or any other exploitation of this software without explicit written permission from the author is strictly prohibited.

For licensing inquiries, contact: [@nmime](https://t.me/nmime)
