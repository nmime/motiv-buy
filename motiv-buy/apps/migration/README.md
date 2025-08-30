# Migration CLI Tool

Database migration management tool for the Motiv-Buy project, built following CLAUDE.md domain-driven architecture principles.

## Overview

This CLI application provides a comprehensive interface for managing database migrations using MikroORM. It follows the Controller → Service → Repository → Mapper pattern and implements security-first practices.

## Architecture

- **Controller Layer**: `migration.controller.ts` - Handles CLI input validation and response formatting
- **Service Layer**: `migration.service.ts` - Core migration business logic
- **Support Services**: `confirmation.service.ts` - Interactive confirmation prompts
- **Utilities**: Structured logging and type definitions

## Installation

```bash
# Build the CLI
npm run build

# Install globally (optional)
npm install -g .
```

## Configuration

Copy the environment template and configure your database:

```bash
cp .env.example .env
```

Required environment variables:
- `DB_HOST` - Database host
- `DB_NAME` - Database name
- `DB_USER` - Database user
- `DB_PASSWORD` - Database password

## Usage

### Create Migration

```bash
# Create a schema migration
migration-cli create add-user-table --type schema

# Create a data migration
migration-cli create seed-initial-data --type data

# Create an index migration
migration-cli create add-user-indexes --type index
```

### Run Migrations

```bash
# Run all pending migrations
migration-cli up

# Run migrations to specific version
migration-cli up --to 1640995200000
```

### Rollback Migrations

```bash
# Rollback last migration
migration-cli down

# Rollback specific number of migrations
migration-cli down --steps 3

# Rollback to specific version
migration-cli down --to 1640995200000
```

### Check Status

```bash
# Show migration status
migration-cli status
```

### Fresh Migration

```bash
# Drop all tables and run fresh migrations (DESTRUCTIVE!)
migration-cli fresh

# Force fresh migration without confirmation (CI/CD)
migration-cli fresh --force
```

### Run Seeders

```bash
# Run all seeders (placeholder - not implemented yet)
migration-cli seed

# Run specific seeder
migration-cli seed --class UserSeeder
```

## Security Features

- Environment variable validation
- Interactive confirmation for destructive operations
- Non-interactive environment detection
- Structured logging with context
- Error handling and recovery

## Development

```bash
# Run in development mode
npm run dev create test-migration

# Build for production
npm run build
```

## Command Examples

```bash
# Complete workflow example
migration-cli create add-user-profiles --type schema
migration-cli up
migration-cli status
```

## Safety Features

- Confirms destructive operations in interactive mode
- Prevents accidental operations in CI/CD environments
- Comprehensive logging for audit trails
- Transaction support for migration safety
- Rollback capability for all operations

## Following CLAUDE.md Principles

- **Security First**: Environment validation, confirmation prompts
- **Clean Architecture**: Controller → Service pattern
- **Error Handling**: Comprehensive error management
- **Logging**: Structured, contextual logging
- **Type Safety**: Full TypeScript implementation
- **Modular Design**: Single responsibility principle