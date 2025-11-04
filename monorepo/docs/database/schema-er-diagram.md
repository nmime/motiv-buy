# Database Schema - Entity Relationship Diagram

## Core Entities Overview

The Motiv-Buy platform consists of several interconnected entities that manage traffic source coordination, order
processing, user management, and financial tracking.

## Entity Relationships

### User Management Domain

```
┌─────────────────┐
│     User        │
│ ═══════════════ │
│ id (PK)         │
│ telegramId      │
│ username        │
│ firstName       │
│ lastName        │
│ status          │
│ role            │
│ languageCode    │
│ referredBy      │
│ referralCount   │
│ refLinkLevel*   │
│ createdAt       │
│ updatedAt       │
│ lastActiveAt    │
└─────────────────┘
           │
           ├── UserBalance (1:N)
           ├── UserBalanceHistory (1:N)
           ├── UserSettings (1:N)
           ├── TrafficTarget.managedBy (1:N)
           ├── TrafficSource.managedBy (1:N)
           └── TrafficOrder.creator (1:N)
```

### Traffic Management Domain

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│  TrafficSource  │    │  TrafficOrder   │    │  TrafficTarget  │
│ ═══════════════ │    │ ═══════════════ │    │ ═══════════════ │
│ id (PK)         │    │ id (PK)         │    │ id (PK)         │
│ name            │    │ orderId         │    │ name            │
│ description     │    │ type            │    │ description     │
│ type            │    │ status          │    │ type            │
│ botToken        │    │ targetCount     │    │ telegramId      │
│ botUsername     │    │ currentCount    │    │ username        │
│ telegramId      │    │ pricePerAction  │    │ inviteLink      │
│ isActive        │    │ totalBudget     │    │ isActive        │
│ config          │    │ spentAmount     │    │ requiresApproval│
│ createdAt       │    │ description     │    │ pricePerMember  │
│ updatedAt       │    │ targetUrl       │    │ minMembers      │
│ managedBy (FK)  │    │ requirements    │    │ maxMembers      │
└─────────────────┘    │ startDate       │    │ config          │
           │           │ endDate         │    │ createdAt       │
           │           │ completedAt     │    │ updatedAt       │
           │           │ createdAt       │    │ managedBy (FK)  │
           │           │ updatedAt       │    └─────────────────┘
           │           │ creator (FK)    │               │
           │           │ trafficSource   │               │
           │           │ trafficTarget   │               │
           │           │ assignedUser    │               │
           │           │ createdBy (FK)  │               │
           │           └─────────────────┘               │
           │                      │                     │
           └──────────────────────┼─────────────────────┘
                                  │
                        ┌─────────────────┐
                        │ TrafficActions  │
                        │ ═══════════════ │
                        │ id (PK)         │
                        │ actionId        │
                        │ type            │
                        │ status          │
                        │ description     │
                        │ targetUrl       │
                        │ actionData      │
                        │ reward          │
                        │ scheduledAt     │
                        │ startedAt       │
                        │ completedAt     │
                        │ failedAt        │
                        │ failureReason   │
                        │ createdAt       │
                        │ updatedAt       │
                        │ trafficOrder    │
                        │ trafficSource   │
                        └─────────────────┘
```

### Financial Domain

```
┌─────────────────┐    ┌─────────────────────┐
│   UserBalance   │    │ UserBalanceHistory  │
│ ═══════════════ │    │ ═══════════════════ │
│ id (PK)         │    │ id (PK)             │
│ amount          │    │ amount              │
│ currency        │    │ currency            │
│ createdAt       │    │ transactionType     │
│ updatedAt       │    │ description         │
│ user (FK)       │    │ referenceId         │
└─────────────────┘    │ createdAt           │
           │            │ user (FK)           │
           │            └─────────────────────┘
           │                       │
           └───────────────────────┘
```

### Additional Supporting Entities

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│  UserSettings   │    │ TrafficUser     │    │  UserRefLink    │
│ ═══════════════ │    │ ═══════════════ │    │ ═══════════════ │
│ id (PK)         │    │ id (PK)         │    │ id (PK)         │
│ settingKey      │    │ telegramId      │    │ linkKey         │
│ settingValue    │    │ username        │    │ refLevel        │
│ createdAt       │    │ firstName       │    │ visitCount      │
│ updatedAt       │    │ lastName        │    │ createdAt       │
│ user (FK)       │    │ isActive        │    │ updatedAt       │
└─────────────────┘    │ joinedAt        │    │ user (FK)       │
                       │ leftAt          │    └─────────────────┘
                       │ createdAt       │
                       │ updatedAt       │
                       │ trafficSource   │
                       └─────────────────┘
```

## Key Relationships

### Primary Foreign Key Relationships

1. **User → UserBalance** (1:N): Users can have multiple currency balances
2. **User → UserBalanceHistory** (1:N): All financial transactions are tracked
3. **User → TrafficSource** (1:N): Users can manage multiple traffic sources
4. **User → TrafficTarget** (1:N): Users can manage multiple traffic targets
5. **TrafficSource → TrafficOrder** (1:N): Each source can have multiple orders
6. **TrafficTarget → TrafficOrder** (1:N): Each target can have multiple orders
7. **TrafficOrder → TrafficActions** (1:N): Orders generate multiple actions
8. **TrafficSource → TrafficActions** (1:N): Sources track all their actions

### Composite Relationships

- **TrafficOrder**: Links User (creator), TrafficSource, TrafficTarget, and TrafficUser
- **TrafficActions**: Links TrafficOrder and TrafficSource for action tracking
- **UserBalanceHistory**: Tracks all financial movements with reference IDs

## Database Features

### Indexes

- **Performance**: All foreign keys are indexed
- **Search**: Common query fields (telegram_id, username, status, type) are indexed
- **Time-based**: Created_at fields are indexed for temporal queries

### Data Types

- **UUIDs**: All primary keys use PostgreSQL UUID v7 for performance
- **Timestamps**: All entities have timestamptz for created_at/updated_at
- **Decimals**: Financial amounts use precise decimal types
- **JSON**: Configuration data stored as JSON for flexibility
- **Enums**: Status and type fields use typed enums for consistency

### Audit Trail

- **Creation Tracking**: All entities track creation timestamp
- **Modification Tracking**: All entities track last update timestamp
- **User Attribution**: Orders and financial transactions track creating user
- **Status History**: Status changes are implicitly tracked through updates

## Statistics Query Optimization

### Resource Filtering Strategy

Each statistics query must filter by the appropriate resource ID:

1. **User Statistics** → Filter by `user.id`
2. **Traffic Source Statistics** → Filter by `traffic_source.id`
3. **Traffic Target Statistics** → Filter by `traffic_target.id`
4. **Traffic Order Statistics** → Filter by `traffic_order.id`
5. **Traffic Action Statistics** → Filter by `traffic_action.traffic_source_id` or `traffic_order_id`

### Index Optimization

- Date range queries use `created_at` indexes
- Resource filtering uses foreign key indexes
- Status filtering uses enum indexes
- Composite queries benefit from multi-column indexes

### Aggregation Opportunities

- Count operations can use database-level counting
- Sum operations can use database-level aggregation
- Time grouping can use PostgreSQL date functions
- Performance metrics can use window functions

This schema supports efficient statistics generation with proper resource isolation and optimal query performance.
