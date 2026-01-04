# Motiv-Buy Project Structure

This document provides the complete technology stack and file tree structure for the Motiv-Buy project. **AI agents MUST read this file to understand the project organization before making any changes.**

## Technology Stack

### Backend Technologies

- **TypeScript 5.8+** with **pnpm** - Dependency management and packaging with workspace support
- **NestJS 11+** - Web framework with decorators, dependency injection, and async support
- **Fastify 5.4+** - High-performance web server with plugins and middleware
- **MikroORM 6.4+** - TypeScript ORM with entity management and migrations

### Database & Storage

- **PostgreSQL** - Primary database with MikroORM integration
- **SQLite** - Development and testing database support
- **MikroORM Migrations** - Database schema version control and evolution

### Bot Framework

- **Grammy 1.37+** - Modern TypeScript Telegram bot framework with type safety
- **Telegram Bot API** - Direct integration with Telegram platform

### Build System & Development Tools

- **Nx 21.3+** - Monorepo build system with task orchestration and dependency management
- **Webpack 5** - Module bundling and optimization
- **Vite 6.0+** - Fast build tool and dev server
- **Jest 29.7+** - Testing framework with coverage and mocking
- **Vitest 3.0+** - Fast unit testing with Vite integration

### Code Quality & Validation

- **ESLint 9.32+** - Code linting with TypeScript support
- **Prettier 2.6+** - Code formatting and style enforcement
- **TypeScript ESLint** - TypeScript-specific linting rules
- **Class Validator 0.14+** - Runtime validation with decorators
- **Class Transformer 0.5+** - Object transformation and serialization

### Security & Performance

- **Fastify Helmet** - Security headers and protection middleware
- **Fastify CORS** - Cross-origin resource sharing configuration
- **Fastify Rate Limit** - Request throttling and abuse prevention
- **Fastify Swagger** - API documentation generation

### Development & Quality Tools

- **SWC** - Super-fast TypeScript/JavaScript compiler
- **ts-jest** - Jest transformer for TypeScript
- **reflect-metadata** - Metadata reflection for decorators
- **RxJS 7.8+** - Reactive programming and event handling

## Complete Project Structure

```
app/                              # Monorepo root directory
├── README.md                           # Project overview and setup instructions
├── CLAUDE.md                           # Master AI context file with coding standards
├── package.json                        # Root package configuration and workspace scripts
├── pnpm-workspace.yaml                 # pnpm workspace configuration
├── pnpm-lock.yaml                      # Dependency lock file
├── .gitignore                          # Git ignore patterns
├── .npmrc                              # npm/pnpm configuration
├── .prettierrc                         # Prettier formatting configuration
├── .prettierignore                     # Prettier ignore patterns
├── .eslintrc.json                      # ESLint configuration
├── nx.json                             # Nx workspace configuration
├── tsconfig.base.json                  # Base TypeScript configuration
├── tsconfig.json                       # Root TypeScript configuration
├── jest.config.js                      # Jest testing configuration
├── vitest.workspace.ts                 # Vitest workspace configuration
├── .env.example                        # Environment variables template
├── .nx/                                # Nx cache and metadata
│   ├── cache/                          # Build and test cache
│   └── workspace-data/                 # Workspace metadata
├── node_modules/                       # Dependencies (managed by pnpm)
├── dist/                               # Build output directory
│   ├── apps/                           # Compiled applications
│   └── libs/                           # Compiled libraries
├── apps/                               # Application deployment artifacts
│   ├── api/                            # HTTP API Service
│   │   ├── src/
│   │   │   ├── main.ts                 # API application entry point
│   │   │   ├── app/                    # Application module and configuration
│   │   │   │   ├── api.module.ts       # Main NestJS application module
│   │   │   │   ├── health/             # Health check endpoints
│   │   │   │   │   ├── health.controller.ts  # Health status API
│   │   │   │   │   └── health.service.ts     # Health check service
│   │   │   │   └── user/               # User management endpoints
│   │   │   │       ├── user.controller.ts    # User API endpoints
│   │   │   │       ├── user.service.ts       # User business logic
│   │   │   │       └── dto/            # User data transfer objects
│   │   │   │           ├── create-user.dto.ts
│   │   │   │           └── update-user.dto.ts
│   │   │   └── assets/                 # Static assets
│   │   ├── project.json                # Nx project configuration
│   │   ├── tsconfig.app.json           # TypeScript config for app
│   │   ├── tsconfig.json               # App TypeScript configuration
│   │   ├── webpack.config.js           # Webpack build configuration
│   │   └── jest.config.ts              # Jest configuration for app
│   ├── bot/                            # Telegram Bot Service
│   │   ├── src/
│   │   │   ├── main.ts                 # Bot application entry point
│   │   │   ├── app/                    # Bot module and configuration
│   │   │   │   ├── bot.module.ts       # Main bot NestJS module
│   │   │   │   ├── handlers/           # Bot message handlers
│   │   │   │   │   ├── start.handler.ts      # /start command handler
│   │   │   │   │   ├── help.handler.ts       # /help command handler
│   │   │   │   │   └── message.handler.ts    # General message handler
│   │   │   │   ├── middleware/         # Bot middleware
│   │   │   │   │   ├── auth.middleware.ts    # Authentication middleware
│   │   │   │   │   └── logging.middleware.ts # Logging middleware
│   │   │   │   └── services/           # Bot business services
│   │   │   │       ├── bot.service.ts        # Core bot functionality
│   │   │   │       └── telegram.service.ts   # Telegram API integration
│   │   │   └── assets/                 # Bot static assets
│   │   ├── project.json                # Nx project configuration
│   │   ├── tsconfig.app.json           # TypeScript config for bot
│   │   ├── tsconfig.json               # Bot TypeScript configuration
│   │   └── jest.config.ts              # Jest configuration for bot
│   └── migration/                      # Database Migration Service
│       ├── src/
│       │   ├── main.ts                 # Migration application entry point
│       │   ├── cli/                    # Command-line interface
│       │   │   ├── migration.cli.ts    # Migration CLI commands
│       │   │   └── commands/           # CLI command implementations
│       │   ├── migrations/             # Database migration files
│       │   │   ├── Migration20240801000000.ts
│       │   │   └── Migration20240802000000.ts
│       │   ├── scripts/                # Migration utility scripts
│       │   │   ├── seed.ts             # Database seeding scripts
│       │   │   └── rollback.ts         # Migration rollback utilities
│       │   ├── service/                # Migration business logic
│       │   │   ├── migration.service.ts      # Core migration service
│       │   │   └── __tests__/          # Service unit tests
│       │   ├── types/                  # Migration type definitions
│       │   │   └── migration.types.ts
│       │   └── utils/                  # Migration utility functions
│       │       ├── database.utils.ts
│       │       └── validation.utils.ts
│       ├── project.json                # Nx project configuration
│       ├── tsconfig.app.json           # TypeScript config for migration
│       ├── tsconfig.json               # Migration TypeScript configuration
│       └── jest.config.ts              # Jest configuration for migration
├── libs/                               # Shared libraries
│   ├── database/                       # Database Layer Library
│   │   ├── src/
│   │   │   ├── index.ts                # Library public API exports
│   │   │   ├── database.module.ts      # NestJS database module
│   │   │   ├── config/                 # Database configuration
│   │   │   │   ├── index.ts            # Configuration exports
│   │   │   │   ├── database.config.ts  # Database connection settings
│   │   │   │   └── mikro-orm.config.ts # MikroORM configuration
│   │   │   ├── entities/               # Database entities
│   │   │   │   ├── index.ts            # Entity exports
│   │   │   │   ├── User.entity.ts      # User entity definition
│   │   │   │   ├── TrafficBuyer.entity.ts     # Traffic buyer entity
│   │   │   │   ├── TrafficOrder.entity.ts     # Traffic order entity
│   │   │   │   ├── TrafficSource.entity.ts    # Traffic source entity
│   │   │   │   ├── TrafficUser.entity.ts      # Traffic user entity
│   │   │   │   ├── TrafficActions.entity.ts   # Traffic actions entity
│   │   │   │   ├── UserBalance.entity.ts      # User balance entity
│   │   │   │   ├── UserBalanceHistory.entity.ts # Balance history entity
│   │   │   │   ├── UserSettings.entity.ts     # User settings entity
│   │   │   │   └── junction/           # Junction/relationship entities
│   │   │   │       ├── index.ts        # Junction entity exports
│   │   │   │       ├── TrafficActionsUsers.entity.ts
│   │   │   │       ├── TrafficBuyerSource.entity.ts
│   │   │   │       ├── TrafficBuyerUsers.entity.ts
│   │   │   │       ├── UserTrafficBuyer.entity.ts
│   │   │   │       ├── UserTrafficOrder.entity.ts
│   │   │   │       └── UserTrafficSource.entity.ts
│   │   │   ├── repositories/           # Data access repositories
│   │   │   │   ├── index.ts            # Repository exports
│   │   │   │   ├── User.repository.ts  # User data operations
│   │   │   │   ├── TrafficActions.repository.ts
│   │   │   │   ├── TrafficBuyer.repository.ts
│   │   │   │   ├── TrafficOrder.repository.ts
│   │   │   │   ├── TrafficSource.repository.ts
│   │   │   │   ├── TrafficUser.repository.ts
│   │   │   │   ├── UserBalance.repository.ts
│   │   │   │   ├── UserBalanceHistory.repository.ts
│   │   │   │   └── UserSettings.repository.ts
│   │   │   ├── services/               # Database business services
│   │   │   │   ├── index.ts            # Service exports
│   │   │   │   ├── database.service.ts # Core database operations
│   │   │   │   └── migration.service.ts # Migration utilities
│   │   │   └── types/                  # Database type definitions
│   │   │       ├── index.ts            # Type exports
│   │   │       └── entity-constructor.type.ts
│   │   ├── package.json                # Library package configuration
│   │   ├── project.json                # Nx project configuration
│   │   ├── tsconfig.json               # TypeScript configuration
│   │   ├── tsconfig.lib.json           # Library TypeScript config
│   │   └── jest.config.ts              # Jest configuration
│   └── dto/                            # Data Transfer Objects Library
│       ├── src/
│       │   ├── index.ts                # DTO public API exports
│       │   └── lib/                    # DTO implementations
│       │       ├── user.dto.ts         # User data transfer objects
│       │       ├── traffic.dto.ts      # Traffic-related DTOs
│       │       ├── balance.dto.ts      # Balance operation DTOs
│       │       └── common.dto.ts       # Common/shared DTOs
│       ├── package.json                # Library package configuration
│       ├── project.json                # Nx project configuration
│       ├── tsconfig.json               # TypeScript configuration
│       ├── tsconfig.lib.json           # Library TypeScript config
│       └── jest.config.ts              # Jest configuration
├── packages/                           # Package artifacts (placeholder)
│   └── .gitkeep                        # Git directory placeholder
├── docs/                               # Documentation
│   ├── ai-context/                     # AI-specific documentation
│   │   ├── project-structure.md        # This file - technology stack and structure
│   │   └── docs-overview.md            # Documentation architecture overview
│   └── specs/                          # Technical specifications
│       ├── example-app-specification.md    # Application specification template
│       └── example-lib-specification.md    # Library specification template
└── tmp/                                # Temporary files and build artifacts
    └── nx-cache/                       # Nx cache directory
```

## Application Types and Deployment

### API Application (`apps/api/`)

- **Type**: HTTP API service
- **Framework**: NestJS with Fastify adapter
- **Purpose**: Business logic orchestration, HTTP endpoints, data validation
- **Deployment**: Containerized service with horizontal scaling
- **Port**: 3000 (default)

### Bot Application (`apps/bot/`)

- **Type**: Telegram bot service
- **Framework**: Grammy with NestJS integration
- **Purpose**: Telegram bot handlers, user interaction, command processing
- **Deployment**: Single instance service with webhook/polling
- **Integration**: Direct Telegram Bot API communication

### Migration Application (`apps/migration/`)

- **Type**: Database migration utility
- **Framework**: MikroORM CLI with custom scripts
- **Purpose**: Database schema evolution, data transformation, seeding
- **Deployment**: CLI tool for database operations
- **Usage**: Development and production database management

## Library Organization

### Database Library (`libs/database/`)

- **Purpose**: Database layer abstraction with MikroORM
- **Exports**: Entities, repositories, services, configuration
- **Dependencies**: MikroORM, PostgreSQL/SQLite drivers
- **Usage**: Imported by applications for data access

### DTO Library (`libs/dto/`)

- **Purpose**: Shared data transfer objects and validation
- **Exports**: DTOs for API requests/responses, inter-service communication
- **Dependencies**: Class Validator, Class Transformer
- **Usage**: Shared across applications for type safety

## Development Workflow

### Build Commands

- `pnpm build` - Build all applications and libraries
- `pnpm build:api` - Build API application only
- `pnpm build:bot` - Build bot application only
- `pnpm build:libs` - Build all libraries only

### Development Commands

- `pnpm dev` - Start all applications in development mode
- `pnpm dev:api` - Start API application with hot reload
- `pnpm dev:bot` - Start bot application with hot reload

### Testing Commands

- `pnpm test` - Run all tests
- `pnpm test:unit` - Run unit tests only
- `pnpm test:integration` - Run integration tests only
- `pnpm test:e2e` - Run end-to-end tests
- `pnpm test:coverage` - Generate test coverage reports

### Code Quality Commands

- `pnpm lint` - Lint all code
- `pnpm lint:fix` - Fix linting issues
- `pnpm typecheck` - Type check all TypeScript
- `pnpm format` - Format code with Prettier

### Database Commands

- `pnpm migration:create` - Create new migration
- `pnpm migration:up` - Run pending migrations
- `pnpm migration:down` - Rollback migrations

## Environment Configuration

### Required Environment Variables

```bash
# Database Configuration
DATABASE_URL=postgresql://user:password@localhost:5432/motiv_buy
DATABASE_TYPE=postgresql

# API Configuration
API_PORT=3000
API_HOST=0.0.0.0

# Bot Configuration
TELEGRAM_BOT_TOKEN=your_bot_token_here
TELEGRAM_WEBHOOK_URL=https://your-domain.com/webhook

# Development Settings
NODE_ENV=development
LOG_LEVEL=debug
```

### Development Environment Setup

1. Copy `.env.example` to `.env`
2. Configure database connection
3. Set `TELEGRAM_BOT_TOKEN` (for bot app)
4. Run `pnpm install` to install dependencies
5. Run `pnpm migration:up` to set up database
6. Run `pnpm dev` to start development servers

---

_This project structure follows domain-driven design principles with a monorepo approach, enabling shared code reuse while maintaining clear separation of concerns between applications and business logic._
