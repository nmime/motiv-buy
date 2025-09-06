# Validation Library

## Purpose and Responsibilities

This library provides comprehensive validation utilities, custom decorators, and validation pipelines for the xRocket platform. It includes financial-specific validation rules, blockchain address validation, and standardized error handling for validation failures across all microservices.

## Key Components

### Core Validation

- **ValidationModule** - Main NestJS module for validation configuration
- **ValidationService** - Core validation service with common validation methods
- **ValidationPipe** - Enhanced NestJS validation pipe with custom error formatting

### Custom Decorators

- **Financial Validators** - Amount, currency, and financial operation validation
- **Blockchain Validators** - Address validation for different blockchain networks
- **Security Validators** - Password strength, token validation, rate limiting
- **Business Logic Validators** - Custom business rules and constraints

### Exception Handling

- **ValidationException** - Standardized validation error handling
- **ValidationApiProblemException** - API-specific validation error responses
- **FieldValidationError** - Field-level validation error details

### Validation Types

- **ValidationTypes** - Common validation type definitions
- **ValidationConstraints** - Reusable validation constraint definitions
- **ValidationMessages** - Standardized validation error messages

## Dependencies

### External Dependencies

- `class-validator` - Decorator-based validation library
- `class-transformer` - Object transformation utilities
- `joi` - Schema validation for complex objects
- `validator` - String validation utilities
- `bitcoinjs-lib` - Bitcoin address validation
- `web3-utils` - Ethereum address validation

### Internal Dependencies

- `@app/common-exception` - Exception handling framework
- `@app/common-shared` - Common types and constants
- `@app/common-logger` - Validation logging

## Integration Points

### API Validation

- **Request Validation** - Automatic validation of all API requests
- **Response Validation** - Ensure response data integrity
- **Parameter Validation** - Query and path parameter validation

### Business Logic Validation

- **Transaction Validation** - Financial transaction validation rules
- **User Data Validation** - User registration and profile validation
- **Trading Validation** - Trading order and market validation

### Security Validation

- **Authentication Validation** - Token and credential validation
- **Authorization Validation** - Permission and access validation
- **Rate Limiting Validation** - Request rate validation

## Usage Patterns

### Basic DTO Validation

```typescript
import { IsValidAmount, IsValidCurrency, IsValidNetwork, IsBlockchainAddress } from '@app/common-validation';

export class TransferDto {
  @IsValidAmount()
  @ApiProperty({ example: '100.50', description: 'Transfer amount' })
  amount!: string;

  @IsValidCurrency()
  @ApiProperty({ example: 'USDT', description: 'Currency symbol' })
  currency!: string;

  @IsValidNetwork()
  @ApiProperty({ example: 'TON', description: 'Blockchain network' })
  network!: string;

  @IsBlockchainAddress()
  @ApiProperty({ example: 'EQD...', description: 'Recipient address' })
  toAddress!: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  @ApiProperty({ required: false, description: 'Transfer memo' })
  memo?: string;
}
```

### Custom Business Validation

```typescript
import { ValidationException } from '@app/common-validation';

@Injectable()
export class TradingValidationService {
  async validateTradeOrder(order: TradeOrderDto): Promise<void> {
    // Validate minimum trade amount
    const minAmount = await this.getMinimumTradeAmount(order.symbol);
    if (Number(order.amount) < Number(minAmount)) {
      throw new ValidationException('AMOUNT_TOO_SMALL', {
        field: 'amount',
        value: order.amount,
        constraint: `Minimum trade amount is ${minAmount}`,
        code: 'MIN_TRADE_AMOUNT',
      });
    }

    // Validate trading pair availability
    const isValidPair = await this.isValidTradingPair(order.symbol);
    if (!isValidPair) {
      throw new ValidationException('INVALID_TRADING_PAIR', {
        field: 'symbol',
        value: order.symbol,
        constraint: 'Trading pair not supported',
        code: 'INVALID_PAIR',
      });
    }

    // Validate user balance
    await this.validateUserBalance(order.userId, order.symbol, order.amount);

    // Validate market hours
    await this.validateMarketHours(order.symbol);
  }

  private async validateUserBalance(userId: string, symbol: string, amount: string): Promise<void> {
    const balance = await this.getUserBalance(userId, symbol);
    if (Number(balance) < Number(amount)) {
      throw new ValidationException('INSUFFICIENT_BALANCE', {
        field: 'amount',
        value: amount,
        constraint: `Available balance: ${balance}`,
        code: 'INSUFFICIENT_FUNDS',
      });
    }
  }
}
```

### Financial Amount Validation

```typescript
import { registerDecorator, ValidationOptions } from 'class-validator';

export function IsValidAmount(validationOptions?: ValidationOptions) {
  return function (object: Object, propertyName: string) {
    registerDecorator({
      name: 'isValidAmount',
      target: object.constructor,
      propertyName: propertyName,
      options: validationOptions,
      validator: {
        validate(value: any) {
          if (typeof value !== 'string') return false;

          // Check if it's a valid decimal number
          const numericRegex = /^\d+(\.\d+)?$/;
          if (!numericRegex.test(value)) return false;

          // Check for reasonable precision (max 18 decimals)
          const parts = value.split('.');
          if (parts[1] && parts[1].length > 18) return false;

          // Check for positive amount
          const amount = Number(value);
          if (amount <= 0) return false;

          // Check for reasonable maximum (prevent overflow)
          if (amount > 1e15) return false;

          return true;
        },
        defaultMessage() {
          return 'Amount must be a positive decimal number with max 18 decimal places';
        },
      },
    });
  };
}

export function IsValidCurrency(validationOptions?: ValidationOptions) {
  return function (object: Object, propertyName: string) {
    registerDecorator({
      name: 'isValidCurrency',
      target: object.constructor,
      propertyName: propertyName,
      options: validationOptions,
      validator: {
        validate(value: any) {
          if (typeof value !== 'string') return false;

          const supportedCurrencies = ['USDT', 'TON', 'ETH', 'BTC', 'BNB', 'SOL', 'TRX', 'USD', 'EUR'];

          return supportedCurrencies.includes(value.toUpperCase());
        },
        defaultMessage() {
          return 'Currency must be a supported currency symbol';
        },
      },
    });
  };
}
```

### Blockchain Address Validation

```typescript
import { isAddress } from 'web3-utils';
import { validate as validateBitcoinAddress } from 'bitcoin-address-validation';

export function IsBlockchainAddress(validationOptions?: ValidationOptions) {
  return function (object: Object, propertyName: string) {
    registerDecorator({
      name: 'isBlockchainAddress',
      target: object.constructor,
      propertyName: propertyName,
      options: validationOptions,
      validator: {
        validate(value: any, args: ValidationArguments) {
          if (typeof value !== 'string') return false;

          const dto = args.object as any;
          const network = dto.network;

          switch (network?.toUpperCase()) {
            case 'ETH':
            case 'BSC':
              return isAddress(value);

            case 'BTC':
              return validateBitcoinAddress(value);

            case 'TON':
              return this.validateTonAddress(value);

            case 'SOL':
              return this.validateSolanaAddress(value);

            case 'TRX':
              return this.validateTronAddress(value);

            default:
              return false;
          }
        },
        defaultMessage() {
          return 'Invalid blockchain address for the specified network';
        },
      },
    });
  };
}

function validateTonAddress(address: string): boolean {
  // TON address validation logic
  const tonRegex = /^[A-Za-z0-9_-]{48}$/;
  return tonRegex.test(address);
}

function validateSolanaAddress(address: string): boolean {
  // Solana address validation logic
  const solanaRegex = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
  return solanaRegex.test(address);
}

function validateTronAddress(address: string): boolean {
  // TRON address validation logic
  const tronRegex = /^T[A-Za-z0-9]{33}$/;
  return tronRegex.test(address);
}
```

### Validation Pipeline

```typescript
import { ValidationPipe } from '@nestjs/common';
import { ValidationApiProblemException } from '@app/common-validation';

@Injectable()
export class CustomValidationPipe extends ValidationPipe {
  constructor() {
    super({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
      exceptionFactory: (errors) => {
        const formattedErrors = errors.map((error) => ({
          field: error.property,
          value: error.value,
          constraints: Object.values(error.constraints || {}),
          children: this.formatChildErrors(error.children || []),
        }));

        return new ValidationApiProblemException({
          title: 'Validation Failed',
          detail: 'One or more validation errors occurred',
          status: 400,
          errors: formattedErrors,
        });
      },
    });
  }

  private formatChildErrors(children: any[]): any[] {
    return children.map((child) => ({
      field: child.property,
      value: child.value,
      constraints: Object.values(child.constraints || {}),
      children: this.formatChildErrors(child.children || []),
    }));
  }
}

// Global validation pipe configuration
@Module({
  providers: [
    {
      provide: APP_PIPE,
      useClass: CustomValidationPipe,
    },
  ],
})
export class ValidationModule {}
```

### Complex Object Validation

```typescript
import Joi from 'joi';

@Injectable()
export class ComplexValidationService {
  private readonly tradingOrderSchema = Joi.object({
    symbol: Joi.string()
      .required()
      .pattern(/^[A-Z]+\/[A-Z]+$/),
    type: Joi.string().valid('market', 'limit', 'stop', 'stop-limit').required(),
    side: Joi.string().valid('buy', 'sell').required(),
    amount: Joi.string()
      .required()
      .pattern(/^\d+(\.\d+)?$/),
    price: Joi.when('type', {
      is: Joi.string().valid('limit', 'stop-limit'),
      then: Joi.string()
        .required()
        .pattern(/^\d+(\.\d+)?$/),
      otherwise: Joi.forbidden(),
    }),
    stopPrice: Joi.when('type', {
      is: Joi.string().valid('stop', 'stop-limit'),
      then: Joi.string()
        .required()
        .pattern(/^\d+(\.\d+)?$/),
      otherwise: Joi.forbidden(),
    }),
    timeInForce: Joi.string().valid('GTC', 'IOC', 'FOK').default('GTC'),
    clientOrderId: Joi.string().optional().max(64),
  });

  validateTradingOrder(order: any): Promise<TradingOrderDto> {
    const { error, value } = this.tradingOrderSchema.validate(order, {
      abortEarly: false,
      stripUnknown: true,
    });

    if (error) {
      const validationErrors = error.details.map((detail) => ({
        field: detail.path.join('.'),
        message: detail.message,
        value: detail.context?.value,
      }));

      throw new ValidationException('SCHEMA_VALIDATION_FAILED', {
        errors: validationErrors,
      });
    }

    return value;
  }
}
```

## Exception Handling

### Validation Exception Classes

```typescript
import { ApiProblemException } from '@app/common-exception';

export class ValidationApiProblemException extends ApiProblemException {
  constructor(problem: { title: string; detail: string; status: number; errors: ValidationError[] }) {
    super({
      ...problem,
      type: 'validation-error',
      instance: `/errors/validation/${Date.now()}`,
    });
  }

  static fromClassValidatorErrors(errors: any[]): ValidationApiProblemException {
    const validationErrors = errors.map((error) => ({
      field: error.property,
      value: error.value,
      constraints: Object.values(error.constraints || {}),
    }));

    return new ValidationApiProblemException({
      title: 'Request Validation Failed',
      detail: 'The request contains invalid data',
      status: 400,
      errors: validationErrors,
    });
  }
}

interface ValidationError {
  field: string;
  value: any;
  constraints: string[];
  children?: ValidationError[];
}
```

## Configuration

### Validation Configuration

```typescript
@Injectable()
export class ValidationConfigService {
  getValidationConfig(): ValidationConfig {
    return {
      enableValidation: process.env.ENABLE_VALIDATION !== 'false',
      strictMode: process.env.VALIDATION_STRICT_MODE === 'true',
      maxValidationErrors: parseInt(process.env.MAX_VALIDATION_ERRORS || '10'),
      validationTimeout: parseInt(process.env.VALIDATION_TIMEOUT || '5000'),

      // Financial validation settings
      maxTransactionAmount: process.env.MAX_TRANSACTION_AMOUNT || '1000000',
      minTransactionAmount: process.env.MIN_TRANSACTION_AMOUNT || '0.000001',
      maxDecimalPlaces: parseInt(process.env.MAX_DECIMAL_PLACES || '18'),

      // Security validation settings
      passwordMinLength: parseInt(process.env.PASSWORD_MIN_LENGTH || '8'),
      passwordRequireSpecialChar: process.env.PASSWORD_REQUIRE_SPECIAL === 'true',
      emailVerificationRequired: process.env.EMAIL_VERIFICATION_REQUIRED === 'true',

      // Rate limiting
      validationRateLimit: parseInt(process.env.VALIDATION_RATE_LIMIT || '100'),
      validationRateWindow: parseInt(process.env.VALIDATION_RATE_WINDOW || '60000'),
    };
  }
}

interface ValidationConfig {
  enableValidation: boolean;
  strictMode: boolean;
  maxValidationErrors: number;
  validationTimeout: number;
  maxTransactionAmount: string;
  minTransactionAmount: string;
  maxDecimalPlaces: number;
  passwordMinLength: number;
  passwordRequireSpecialChar: boolean;
  emailVerificationRequired: boolean;
  validationRateLimit: number;
  validationRateWindow: number;
}
```

## Security Considerations

### Input Sanitization

- **XSS Prevention** - Automatic HTML/script tag removal
- **SQL Injection Prevention** - Parameterized query validation
- **Path Traversal Prevention** - File path validation

### Financial Security

- **Amount Validation** - Prevent precision attacks and overflow
- **Currency Validation** - Whitelist supported currencies
- **Transaction Limits** - Enforce minimum and maximum transaction amounts

### Rate Limiting

- **Validation Rate Limiting** - Prevent validation spam attacks
- **Error Rate Monitoring** - Monitor validation failure patterns
- **Suspicious Pattern Detection** - Detect potential attack patterns

## Performance Notes

### Optimization Strategies

- **Validation Caching** - Cache validation results for repeated inputs
- **Async Validation** - Non-blocking validation for complex rules
- **Batch Validation** - Validate multiple objects efficiently

### Memory Management

- **Validation Pool** - Reuse validation instances
- **Error Object Pooling** - Reuse validation error objects
- **Garbage Collection** - Proper cleanup of validation contexts

## Development Notes

### Best Practices

- Create reusable validation decorators for common patterns
- Use TypeScript for type-safe validation rules
- Implement comprehensive error messages for user experience
- Test validation rules with edge cases and security scenarios

### Testing Strategies

- Unit test all custom validation decorators
- Integration test validation pipelines
- Security test validation with malicious inputs
- Performance test validation under load

### Extension Points

- Add domain-specific validation decorators
- Implement async validation for database lookups
- Create validation middleware for specific use cases
- Add real-time validation for dynamic rules
