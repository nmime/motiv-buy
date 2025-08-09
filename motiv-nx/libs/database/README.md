# @motiv-nx/database

PostgreSQL-only database library for the Motiv traffic system using MikroORM.

## ✅ Migration Completed

This library has been successfully updated to use **PostgreSQL exclusively** with comprehensive migration capabilities.

## Key Changes Made

- ✅ **Removed SQLite dependency** completely from package.json
- ✅ **Refactored database configuration** to PostgreSQL-only with environment variable support
- ✅ **Updated MikroORM configuration** to use PostgreSqlDriver exclusively
- ✅ **Added comprehensive CLI tools** for migration management (`motiv-db` command)
- ✅ **Created migration application** for standalone migration execution
- ✅ **Enhanced database service** with automatic startup migrations
- ✅ **Added migration utilities** (status checking, rollback support)

## Features

- **PostgreSQL Only**: Optimized for PostgreSQL with no SQLite dependencies
- **Migration System**: Built-in migration creation, execution, and management
- **CLI Tools**: Command-line interface for database operations (`motiv-db`)
- **Migration App**: Standalone application for migration management (`motiv-migrate`)
- **Startup Migrations**: Automatic migration execution on application startup
- **Health Checks**: Database connection monitoring and status reporting
- **Transaction Support**: Built-in transaction management

## Installation

```bash
npm install @motiv-nx/database
```

## Quick Start

### 1. Environment Variables

```bash
# Required PostgreSQL connection settings
DB_HOST=localhost
DB_PORT=5432
DB_NAME=motiv_dev
DB_USER=postgres
DB_PASSWORD=your_password
NODE_ENV=development
```

### 2. Basic Usage

```typescript
import { DatabaseService, getDatabaseConfig } from '@motiv-nx/database';

// Initialize with configuration from environment variables
const config = getDatabaseConfig();
const dbService = DatabaseService.getInstance(config);

// Initialize connection (automatically runs migrations)
await dbService.initialize();

// Use the database
const em = dbService.getEntityManager();
const users = await em.find(UserEntity, {});

// Close when done
await dbService.close();
```

## Migration Management

### CLI Commands

```bash
# Create a new migration
npx motiv-db migrate:create --name "add-user-preferences"

# Run pending migrations
npx motiv-db migrate:up

# Check migration status
npx motiv-db migrate:status

# Rollback last migration
npx motiv-db migrate:down

# Schema operations
npx motiv-db schema:create
npx motiv-db schema:update
npx motiv-db schema:drop --force
```

### Migration Application

```bash
# Using the standalone migration app
cd apps/migration-app

# Initialize database with schema
npm run start init

# Run pending migrations
npm run start migrate

# Create new migration
npm run start create "migration-name"

# Check status
npm run start status
```

### Programmatic Usage

```typescript
// Run migrations programmatically
await dbService.runMigrations();

// Create new migration
await dbService.createMigration('add-new-feature');

// Check migration status
const status = await dbService.getMigrationStatus();
console.log(`Executed: ${status.executed.length}, Pending: ${status.pending.length}`);

// Rollback last migration
await dbService.rollbackMigration();
```

## Automatic Startup Migrations

The database service now automatically runs migrations on initialization:

```typescript
// This will connect to PostgreSQL AND run any pending migrations
await dbService.initialize();
console.log('✅ Database connected and migrations applied');
```

## Database Configuration

### Environment-Based Configuration

```typescript
// Development configuration (uses environment variables)
const config = getDatabaseConfig();
// {
//   type: 'postgresql',
//   host: process.env.DB_HOST || 'localhost',
//   port: parseInt(process.env.DB_PORT || '5432'),
//   dbName: process.env.DB_NAME || 'motiv_dev',
//   user: process.env.DB_USER || 'postgres',
//   password: process.env.DB_PASSWORD || '',
//   debug: true,
//   migrations: { ... }
// }
```

### Custom Configuration

```typescript
const customConfig = {
  type: 'postgresql' as const,
  host: 'localhost',
  port: 5432,
  dbName: 'my_database',
  user: 'postgres',
  password: 'password',
  debug: false,
  migrations: {
    path: './migrations',
    tableName: 'mikro_orm_migrations',
    transactional: true,
    allOrNothing: true,
    safe: true,
    emit: 'ts' as const
  }
};
```

## Entity Usage Examples

### User Management

```typescript
import { UserEntity } from '@motiv-nx/database';

// Create user
const user = new UserEntity({
  telegramId: '123456789',
  username: 'johndoe',
  firstName: 'John',
  lastName: 'Doe',
  isActive: true,
  isPremium: false
});

em.persist(user);
await em.flush();
```

### Balance Management

```typescript
import { UserBalanceEntity, CurrencyType } from '@motiv-nx/database';

// Create balance
const balance = new UserBalanceEntity(user, CurrencyType.USDT, '1000.50');
balance.lockedBalance = '100.00';

em.persist(balance);
await em.flush();
```

### Transaction History

```typescript
import { 
  UserBalanceHistoryEntity, 
  TransactionType, 
  TransactionStatus 
} from '@motiv-nx/database';

// Record transaction
const history = new UserBalanceHistoryEntity(
  user,
  CurrencyType.USDT,
  TransactionType.DEPOSIT,
  '500.00',      // amount
  '1000.50',     // balance before
  '1500.50'      // balance after
);

history.description = 'Deposit from wallet';
history.status = TransactionStatus.COMPLETED;

em.persist(history);
await em.flush();
```

## Migration Development Workflow

1. **Modify entities** as needed
2. **Create migration**: `npx motiv-db migrate:create --name "describe-changes"`
3. **Review generated migration** file in `./migrations/`
4. **Test migration**: `npx motiv-db migrate:up`
5. **If needed, rollback**: `npx motiv-db migrate:down`
6. **Deploy**: Migrations run automatically on app startup

## Database Schema

The system includes these main entities with full PostgreSQL optimization:

- **Users**: Platform users with Telegram integration
- **Traffic Sources**: Bot traffic sources  
- **Traffic Buyers**: Channel/group buyers
- **Traffic Users**: Bot users in campaigns
- **Traffic Orders**: Campaign orders
- **Traffic Actions**: Individual order actions
- **User Balance**: Multi-currency balances
- **User Balance History**: Transaction history
- **User Settings**: Key-value preferences

All relationships use proper foreign keys, indexes, and constraints optimized for PostgreSQL.

## Best Practices

1. **Environment Variables**: Always use environment variables for database configuration
2. **Migrations First**: Create migrations for all schema changes
3. **Test Locally**: Test migrations in development before production
4. **Backup Production**: Always backup before running production migrations
5. **Monitor Health**: Use health checks to monitor database connectivity
6. **Use Transactions**: Wrap multi-entity operations in transactions

## Files Created/Modified

### Modified Files
- `package.json` - Removed SQLite dependency, added CLI binary
- `src/config/database.config.ts` - PostgreSQL-only configuration with environment variables
- `src/config/mikro-orm.config.ts` - PostgreSQL driver only
- `src/services/database.service.ts` - Enhanced with migration utilities and automatic startup migrations
- `src/index.ts` - Added CLI exports

### New Files
- `src/cli/migration.cli.ts` - Complete CLI tool for migration management
- `apps/migration-app/src/main.ts` - Standalone migration application
- `apps/migration-app/package.json` - Migration app package configuration
- `apps/migration-app/tsconfig.json` - Migration app TypeScript configuration
- `README.md` - This comprehensive documentation

## Migration Complete! 🎉

The database library has been successfully updated to use PostgreSQL exclusively with comprehensive migration capabilities. The system now provides:

- **Automatic migration execution** on startup
- **Complete CLI tools** for migration management  
- **Standalone migration application** for dedicated migration tasks
- **Environment-based configuration** for different deployment environments
- **Enhanced error handling** and logging
- **Comprehensive documentation** and examples

You can now use `npx motiv-db migrate:create` to create migrations and `npx motiv-db migrate:up` to execute them, or simply initialize the database service and migrations will run automatically.