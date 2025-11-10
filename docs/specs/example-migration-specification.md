# Migration Specification: Database Schema Changes

## Overview

This document outlines the implementation patterns for database migrations in the xRocket platform using TypeORM with proper xRocket conventions.

## Migration Naming Convention

Migration files follow the pattern: `{timestamp}-{TICKET}-{description}.ts`

- **timestamp**: Unix timestamp (13 digits)
- **TICKET**: JIRA ticket number (e.g., DEV-1234)
- **description**: kebab-case description
- **Class name**: PascalCase with ticket and timestamp

Examples:

- `1750681712901-DEV-1304-create-qoden-accounts.ts`
- `1751654151823-DEV-1563-xjourney-add-is-used-profile-endpoint.ts`
- `1752499694857-DEV-1597-xjourney-activation-push.ts`

## Migration Creation Command

```bash
npm run migration:create DEV-1234-description-of-changes
```

## Migration Types

### 1. Index Creation Migration

```typescript
import { MigrationInterface, QueryRunner } from 'typeorm';

export class DEV1234AddUserBalanceIndexes1640995200000 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      alter table user_balances
        add index ix__user_balances__user_currency_active (user_id, currency, is_active, created_at desc),
        algorithm = inplace,
        lock = none;
    `);

    await queryRunner.query(`
      alter table user_balances
        add index ix__user_balances__amount_status (amount, status),
        algorithm = inplace,
        lock = none;
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      alter table user_balances
        drop index ix__user_balances__user_currency_active,
        algorithm = inplace,
        lock = none;
    `);

    await queryRunner.query(`
      alter table user_balances
        drop index ix__user_balances__amount_status,
        algorithm = inplace,
        lock = none;
    `);
  }
}
```

### 2. Table Creation Migration

```typescript
import { MigrationInterface, QueryRunner } from 'typeorm';

export class DEV1304CreateQodenAccounts1750681712901 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      create table exchange_accounts
      (
        id                  bigint unsigned auto_increment primary key,

        external_user_id    varchar(50) not null,
        external_account_id varchar(50) null,

        account_type        varchar(32) not null,
        user_id             bigint unsigned null,
        app_id              bigint unsigned null,

        created_at          datetime default current_timestamp not null,
        updated_at          datetime default current_timestamp not null on update current_timestamp,

        unique index uq__exchange_accounts__external_user_id (external_user_id),
        unique index uq__exchange_accounts__external_account_id (external_account_id),

        unique index uq__exchange_accounts__user_id__account_type (user_id, account_type),
        unique index uq__exchange_accounts__app_id__account_type (app_id, account_type),

        constraint fk__exchange_accounts__user_id foreign key (user_id) references users (id),
        constraint fk__exchange_accounts__app_id foreign key (app_id) references apps (id)
      );
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`drop table exchange_accounts`);
  }
}
```

### 3. Field Addition Migration

```typescript
import { MigrationInterface, QueryRunner } from 'typeorm';

export class DEV1563XJourneyAddIsUsedProfileEndpoint1751654151823 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      alter table xjourney_participants
      add column last_profile_activity datetime null,
        algorithm = instant,
        lock = default;
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      alter table xjourney_participants
      drop column last_profile_activity,
        algorithm = instant,
        lock = default;
    `);
  }
}
```

### 4. Push Notification Template Migration

```typescript
import { Language, NotificationMessageButton, NotificationTemplateCode } from '@app/mysql';
import { MigrationInterface, QueryRunner } from 'typeorm';

const code = NotificationTemplateCode.XJOURNEY_ACTIVATION_PUSH;

export class DEV1597XJourneyActivationPush1752499694857 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    const image: { [key in Language]?: string } = {
      [Language.Ru]: 'https://static.xrocket.tg/assets/xjourney/push/activation_push/activation_push_ru.png',
      [Language.En]: 'https://static.xrocket.tg/assets/xjourney/push/activation_push/activation_push_en.png',
    };

    const emoji = `<tg-emoji emoji-id="5357203826032012358">🎁</tg-emoji>`;
    const emojiRocket = `<tg-emoji emoji-id="5258332798409783582">🚀</tg-emoji>`;

    const url = `https://t.me/xrocket/app?startapp=xjourney-uc_activation_push`;

    const body: { [key in Language]?: string } = {
      [Language.Ru]: [
        `${emoji} <b>Космонавт, пора в путь!</b> ${emoji}`,
        '',
        'Мы запустили <b>xJourney</b> — заходи в xRocket каждый день, зарабатывай xPoints, торгуй, создавай чеки и получай призы в конце сезона.',
        '',
        'Не забудь взять с собой друзей — двухуровневая рефка хорошо покормит в пути!',
        '',
        `${emojiRocket} <a href="https://t.me/xrocketnewsru/461"><b>Звёздная карта маршрута</b></a>`,
      ].join('\n'),
      [Language.En]: [
        `${emoji} <b>Cosmonaut, the time has come!</b> ${emoji}`,
        '',
        "We've launched <b>xJourney</b> — open xRocket every day, collect xPoints, trade, create cheques and receive awesome prizes at the end of the season.",
        '',
        "Don't forget to take your friends with you — a two-level referral system will reward you well during the space mission.",
        '',
        `${emojiRocket} <a href="https://t.me/xrocketnews/332"><b>The star map of the journey</b></a>`,
      ].join('\n'),
    };

    const buttons: { [key in Language]?: NotificationMessageButton[][] } = {
      [Language.Ru]: [
        [
          {
            text: 'Ракета пошла!',
            url,
          },
        ],
        [
          {
            text: 'Главное меню',
            callback: 'BackToMain',
          },
        ],
      ],
      [Language.En]: [
        [
          {
            text: 'Liftoff!',
            url,
          },
        ],
        [
          {
            text: 'Main menu',
            callback: 'BackToMain',
          },
        ],
      ],
    };

    await queryRunner.query(
      `insert into notification_templates (code, image, body, buttons)
        values (?, ?, ?, ?)`,
      [code, JSON.stringify(image), JSON.stringify(body), JSON.stringify(buttons)],
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `delete
        from notification_templates
        where code = ?`,
      [code],
    );
  }
}
```

## VARCHAR vs ENUM Pattern

**IMPORTANT**: In xRocket, we use VARCHAR in MySQL database but TypeScript enums in entities for better performance and flexibility.

### Database Schema (VARCHAR)

```sql
-- Migration: Use VARCHAR for enum-like fields
create table orders (
  id bigint unsigned auto_increment primary key,
  user_id bigint unsigned not null,
  status varchar(32) not null default 'pending',
  order_type varchar(32) not null,
  priority_level varchar(16) not null default 'normal',
  created_at datetime default current_timestamp not null,

  index ix__orders__status_type (status, order_type),
  index ix__orders__user_status (user_id, status)
);
```

### TypeScript Entity (Enum Types)

```typescript
import { Entity, Column, Index } from 'typeorm';

export enum OrderStatus {
  Pending = 'pending',
  Processing = 'processing',
  Completed = 'completed',
  Cancelled = 'cancelled',
  Failed = 'failed',
}

export enum OrderType {
  Buy = 'buy',
  Sell = 'sell',
  Swap = 'swap',
  Transfer = 'transfer',
}

export enum PriorityLevel {
  Low = 'low',
  Normal = 'normal',
  High = 'high',
  Urgent = 'urgent',
}

@Entity('orders')
@Index('ix__orders__status_type', ['status', 'orderType'])
@Index('ix__orders__user_status', ['userId', 'status'])
export class Order {
  @Column({ name: 'id', type: 'bigint', primary: true, generated: true })
  id!: string;

  @Column({ name: 'user_id', type: 'bigint' })
  userId!: string;

  // VARCHAR in DB but TypeScript enum for type safety
  @Column({
    name: 'status',
    type: 'varchar',
    length: 32,
    default: OrderStatus.Pending,
  })
  status!: OrderStatus;

  @Column({
    name: 'order_type',
    type: 'varchar',
    length: 32,
  })
  orderType!: OrderType;

  @Column({
    name: 'priority_level',
    type: 'varchar',
    length: 16,
    default: PriorityLevel.Normal,
  })
  priorityLevel!: PriorityLevel;

  @Column({ name: 'created_at', type: 'datetime', default: () => 'CURRENT_TIMESTAMP' })
  createdAt!: Date;
}
```

### Migration Example with VARCHAR

```typescript
import { MigrationInterface, QueryRunner } from 'typeorm';

export class DEV1234AddOrderStatusTable1640995200000 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      create table orders (
        id bigint unsigned auto_increment primary key,
        user_id bigint unsigned not null,
        status varchar(32) not null default 'pending',
        order_type varchar(32) not null,
        priority_level varchar(16) not null default 'normal',
        amount decimal(20,8) not null,
        currency varchar(10) not null,
        created_at datetime default current_timestamp not null,
        updated_at datetime default current_timestamp not null on update current_timestamp,
        
        index ix__orders__status_type (status, order_type),
        index ix__orders__user_status (user_id, status),
        index ix__orders__created_at (created_at desc),
        
        constraint fk__orders__user_id foreign key (user_id) references users (id)
      );
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`drop table orders`);
  }
}
```

## Entity Index Decorators

When creating indexes in migrations, you must also add them to the corresponding TypeORM entity:

```typescript
import { Entity, Column, Index } from 'typeorm';

@Entity('users')
@Index('ix__users__kyc_status_level', ['kycStatus', 'kycLevel', 'kycApprovedAt'])
@Index('ix__users__telegram_id_active', ['telegramId', 'isActive', 'isBlocked'])
export class User {
  // Use VARCHAR in decorator but TypeScript enum for type safety
  @Column({
    name: 'kyc_status',
    type: 'varchar',
    length: 32,
    default: KycStatus.NONE,
  })
  kycStatus!: KycStatus;

  @Column({ name: 'kyc_level', type: 'int', default: 0 })
  kycLevel!: number;

  @Column({ name: 'kyc_approved_at', type: 'datetime', nullable: true })
  kycApprovedAt?: Date;
}
```

## Best Practices

### Database Schema

- Use lowercase SQL keywords: `create table`, `alter table`, `drop index`
- Use snake_case for database columns: `created_at`, `user_id`, `kyc_status`
- **Use VARCHAR instead of ENUM**: Always use `varchar(32)` or appropriate length for enum-like fields
- Use lowercase enum values in database: `'active'`, `'pending'`, `'approved'`
- Use MySQL online DDL algorithms:
  - For column changes: `algorithm = instant, lock = default`
  - For index operations: `algorithm = inplace, lock = none`

### TypeScript Entities

- **Use TypeScript enums for type safety**: Define enums with string values matching database
- **Column decorator must specify VARCHAR**: Use `type: 'varchar', length: 32` in @Column decorator
- **TypeScript property uses enum type**: Property type should be the TypeScript enum, not string
- Enum values should match database values exactly: `PENDING = 'pending'`

### Migration Rules

- Always implement proper `down()` migration for rollback capability
- Use parameterized queries for data insertion to prevent SQL injection
- Use `alter table` syntax for adding/dropping indexes, not standalone `create index`
- Specify appropriate VARCHAR length based on enum values (usually 16-32 characters)

### Example Pattern

```typescript
// ✅ Correct: VARCHAR in database, enum in TypeScript
create table orders (
  status varchar(32) not null default 'pending'  -- Database: VARCHAR
);

@Column({ type: 'varchar', length: 32, default: OrderStatus.PENDING })  // Entity: VARCHAR
status!: OrderStatus;  // TypeScript: Enum type

// ❌ Incorrect: MySQL ENUM
create table orders (
  status enum('pending', 'completed') not null  -- Don't use MySQL ENUM
);
```

---

_This migration specification provides xRocket-specific patterns for database schema changes using TypeORM migrations._
