# @app/feature-payment-shared

Shared types, DTOs, and interfaces for the payment feature.

## Overview

This package contains shared code that can be used by both the main payment implementation and other packages that need
to interact with payment functionality.

## Contents

- **DTOs**: Data Transfer Objects for payment operations
- **Interfaces**: Service interfaces and type definitions
- **Module**: Shared NestJS module configuration

## Installation

This package is part of the monorepo and is referenced via TypeScript path mappings.

```typescript
import { PaymentDto, IPaymentService } from '@app/feature-payment-shared';
```

## Usage

Import the shared module in your feature modules:

```typescript
import { PaymentSharedModule } from '@app/feature-payment-shared';

@Module({
  imports: [PaymentSharedModule],
  // ...
})
export class YourModule {}
```

## Development

### Build

```bash
nx build feature-payment-shared
```

### Test

```bash
nx test feature-payment-shared
```

### Lint

```bash
nx lint feature-payment-shared
```

## Dependencies

This package has minimal dependencies and is designed to be lightweight and reusable across the monorepo.
