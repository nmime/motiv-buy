# @app/feature-payment-main

Main implementation of the payment feature including services, controllers, and business logic.

## Overview

This package contains the core payment functionality for the application, including payment processing, transaction
management, and payment-related business logic.

## Contents

- **Controllers**: REST API endpoints for payment operations
- **Services**: Business logic and payment processing
- **DTOs**: Data Transfer Objects specific to the main implementation
- **Interfaces**: Service interfaces and type definitions
- **Module**: NestJS module configuration

## Installation

This package is part of the monorepo and is referenced via TypeScript path mappings.

```typescript
import { PaymentController, PaymentService } from '@app/feature-payment-main';
```

## Usage

Import the main module in your application:

```typescript
import { PaymentMainModule } from '@app/feature-payment-main';

@Module({
  imports: [PaymentMainModule],
  // ...
})
export class AppModule {}
```

## Features

- Payment processing and transaction management
- Support for multiple payment methods
- Transaction history and status tracking
- Payment validation and error handling
- Integration with payment gateways

## Development

### Build

```bash
nx build feature-payment-main
```

### Test

```bash
nx test feature-payment-main
```

### Lint

```bash
nx lint feature-payment-main
```

### Watch Mode

```bash
nx build feature-payment-main --watch
```

## Dependencies

This package depends on:

- `@app/feature-payment-shared`: Shared types and interfaces
- Other feature packages as needed for integration

## API Documentation

The payment API provides the following endpoints:

- `POST /payment/create`: Create a new payment transaction
- `GET /payment/:id`: Get payment details
- `GET /payment/history`: Get payment history
- `POST /payment/verify`: Verify payment status
- `POST /payment/refund`: Process a refund

See the controller files for detailed API documentation.
