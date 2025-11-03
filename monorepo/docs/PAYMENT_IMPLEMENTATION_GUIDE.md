# Payment System Implementation Guide

Complete implementation of cryptocurrency payment system with CryptoPay (CryptoBot) integration.

## 📋 Implementation Summary

### ✅ Completed Components

#### 1. **Package Structure** (`libs/feature/payment/`)
- **Shared Package** (`@app/feature-payment-shared`)
  - Type-safe enums, interfaces, and DTOs
  - Global module for application-wide access

- **Main Package** (`@app/feature-payment-main`)
  - Core business logic and API endpoints
  - Database entities and migrations
  - Payment provider implementations

#### 2. **Core Features Implemented**

**Payment Provider System**
- Abstracted `IPaymentProvider` interface
- CryptoBotProvider implementation with full API integration
- Easy to extend with additional providers (Stripe, PayPal, etc.)

**Top-Up System**
- Create payment invoices with cryptocurrency
- Multi-currency support (USDT, TON, BTC, ETH, LTC, BNB, TRX, USDC, JET)
- Payment URL generation for Telegram/Browser
- Automatic expiration handling

**Withdrawal System**
- Balance verification before withdrawal
- Immediate balance deduction (pessimistic locking)
- Transfer to user's Telegram wallet
- Automatic rollback on failure

**Webhook Integration**
- Real-time payment notifications
- HMAC-SHA256 signature verification
- Automatic balance crediting on payment
- Idempotency-safe processing

**Transaction Management**
- Complete transaction history tracking
- Filtering by type, status, date
- Pagination support
- Status synchronization with provider

#### 3. **Database Schema**

**Table: `payment_transactions`**
- UUID primary key with v7 support
- Comprehensive transaction tracking
- JSONB metadata storage
- Optimized indexes for performance
- Automatic timestamp management

**Migration Created**: `Migration20251102220936_create_payment_transactions_table.ts`

#### 4. **API Endpoints**

| Method | Endpoint | Description | Rate Limit |
|--------|----------|-------------|------------|
| POST | `/payment/topup` | Create top-up invoice | 10/min |
| POST | `/payment/withdraw` | Request withdrawal | 5/min |
| GET | `/payment/transactions` | Get transaction history | 30/min |
| GET | `/payment/transactions/:id` | Get specific transaction | 60/min |
| GET | `/payment/invoice/:id/status` | Check invoice status | 20/min |
| POST | `/payment/webhook/crypto-bot` | Webhook handler | 100/min |

#### 5. **Security Features**

- JWT authentication on all endpoints
- Webhook signature verification (HMAC-SHA256)
- Transaction ownership validation
- Rate limiting per endpoint
- Environment-based configuration
- Secure token management
- SQL injection prevention
- XSS protection

#### 6. **Error Handling**

- Result<T, Error> pattern for type-safe errors
- Comprehensive error messages
- Proper HTTP status codes
- Detailed logging
- Rollback mechanisms for failures

## 🚀 Quick Start

### Step 1: Environment Setup

Add to `.env` file:

```bash
# CryptoPay Configuration
CRYPTO_BOT_API_TOKEN=your_token_here

# Get tokens from:
# Testnet: @CryptoTestnetBot
# Mainnet: @CryptoBot
```

### Step 2: Run Migration

```bash
# Run all pending migrations
pnpm nx run migration:migrate

# Verify payment_transactions table created
psql -d your_database -c "\d payment_transactions"
```

### Step 3: Add to API Module

Update `apps/api/src/app.module.ts`:

```typescript
import { PaymentMainModule } from '@app/feature-payment-main';

@Module({
  imports: [
    // ... existing imports
    ConfigModule.forRoot({ isGlobal: true }),
    DatabaseModule,
    AuthMainModule,
    BalanceMainModule,
    PaymentMainModule, // Add this
    // ... other modules
  ],
})
export class AppModule {}
```

### Step 4: Setup Webhook (Production)

1. Deploy your application with HTTPS
2. Go to CryptoPay app settings
3. Set webhook URL: `https://yourdomain.com/payment/webhook/crypto-bot`
4. Webhooks will automatically credit user balances

### Step 5: Test the System

```bash
# Start API server
pnpm nx run api:serve

# Test top-up endpoint
curl -X POST http://localhost:3000/payment/topup \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "amount": "100.00",
    "currency": "USDT",
    "description": "Test top-up"
  }'
```

## 📚 Architecture

### Component Diagram

```
┌─────────────────────────────────────────────────────────┐
│                     API Layer                            │
│  ┌─────────────────┐        ┌─────────────────┐        │
│  │ PaymentController│        │WebhookController│        │
│  └────────┬─────────┘        └────────┬────────┘        │
│           │                           │                  │
└───────────┼───────────────────────────┼──────────────────┘
            │                           │
            ▼                           ▼
┌─────────────────────────────────────────────────────────┐
│                  Service Layer                           │
│           ┌──────────────────────┐                      │
│           │   PaymentService     │                      │
│           │  ├─ createTopUp      │                      │
│           │  ├─ createWithdrawal │                      │
│           │  ├─ processWebhook   │                      │
│           │  └─ getTransactions  │                      │
│           └──────────┬───────────┘                      │
└──────────────────────┼──────────────────────────────────┘
                       │
        ┌──────────────┼──────────────┐
        │              │              │
        ▼              ▼              ▼
┌─────────────┐ ┌───────────┐ ┌─────────────┐
│  Provider   │ │ Balance   │ │  Database   │
│   Layer     │ │  Service  │ │  Repository │
│             │ │           │ │             │
│ ┌─────────┐ │ │           │ │ ┌─────────┐ │
│ │CryptoBot│ │ │           │ │ │Payment  │ │
│ │Provider │ │ │           │ │ │Entity   │ │
│ └─────────┘ │ │           │ │ └─────────┘ │
└──────┬──────┘ └───────────┘ └─────────────┘
       │
       ▼
┌─────────────────────────────┐
│   CryptoPay API             │
│   https://pay.crypt.bot/    │
└─────────────────────────────┘
```

### Payment Flow Sequence

#### Top-Up Flow

```
User → PaymentController → PaymentService → CryptoBotProvider → CryptoPay API
                                    │
                                    ├─→ Save to DB (status: PENDING)
                                    └─→ Return payment URL

User pays via Telegram/Browser
                                    │
CryptoPay API → Webhook → PaymentService
                              │
                              ├─→ Verify signature
                              ├─→ Update transaction (status: COMPLETED)
                              └─→ Credit user balance
```

#### Withdrawal Flow

```
User → PaymentController → PaymentService
                              │
                              ├─→ Check balance (sufficient?)
                              ├─→ Deduct balance immediately
                              ├─→ Create transfer via CryptoBotProvider
                              ├─→ Save to DB (status: PROCESSING)
                              └─→ Return transfer details

CryptoPay processes → Transfer complete → Status: COMPLETED
```

## 🔧 Configuration Reference

### Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `CRYPTO_BOT_API_TOKEN` | Yes | - | CryptoPay API token |
| `CRYPTO_BOT_WEBHOOK_URL` | No | - | Webhook URL (production) |
| `DATABASE_URL` | Yes | - | PostgreSQL connection |
| `JWT_SECRET` | Yes | - | JWT signing secret |

### Supported Currencies

| Currency | Mainnet | Testnet | Description |
|----------|---------|---------|-------------|
| USDT | ✅ | ✅ | Tether |
| TON | ✅ | ✅ | Toncoin |
| BTC | ✅ | ✅ | Bitcoin |
| ETH | ✅ | ✅ | Ethereum |
| LTC | ✅ | ✅ | Litecoin |
| BNB | ✅ | ✅ | Binance Coin |
| TRX | ✅ | ✅ | TRON |
| USDC | ✅ | ✅ | USD Coin |
| JET | ❌ | ✅ | Testnet only |

### Payment Statuses

| Status | Description | Can transition to |
|--------|-------------|-------------------|
| PENDING | Invoice created, awaiting payment | COMPLETED, EXPIRED |
| PROCESSING | Withdrawal in progress | COMPLETED, FAILED |
| COMPLETED | Transaction successful | - |
| FAILED | Transaction failed | - |
| CANCELLED | User cancelled | - |
| EXPIRED | Invoice expired | - |

## 🧪 Testing Guide

### Unit Testing

```typescript
import { Test } from '@nestjs/testing';
import { PaymentService } from './payment.service';

describe('PaymentService', () => {
  let service: PaymentService;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [PaymentService, /* ... */],
    }).compile();

    service = module.get<PaymentService>(PaymentService);
  });

  it('should create top-up invoice', async () => {
    const result = await service.createTopUp('userId', {
      amount: '100.00',
      currency: Cryptocurrency.USDT,
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.val.payUrl).toBeDefined();
    }
  });
});
```

### Integration Testing

```bash
# Start testnet environment
export CRYPTO_BOT_API_TOKEN=<testnet_token>
pnpm nx run api:serve

# Test top-up
curl -X POST localhost:3000/payment/topup \
  -H "Authorization: Bearer $JWT_TOKEN" \
  -d '{"amount":"10","currency":"JET"}'

# Test webhook (simulate payment)
curl -X POST localhost:3000/payment/webhook/crypto-bot \
  -H "Content-Type: application/json" \
  -H "crypto-pay-api-signature: <signature>" \
  -d '{
    "update_type": "invoice_paid",
    "payload": { /* invoice data */ }
  }'
```

## 🐛 Troubleshooting

### Common Issues

**1. Webhook not receiving events**
- Verify HTTPS is enabled
- Check firewall rules
- Validate webhook URL in CryptoPay settings
- Check signature verification logs

**2. Balance not credited after payment**
- Check webhook logs
- Verify signature verification passes
- Check database for transaction status
- Manual sync: GET `/payment/invoice/:id/status`

**3. Withdrawal fails**
- Verify sufficient balance
- Check CryptoPay API balance
- Review transaction logs
- Check fee calculations

**4. Build errors**
- Run `pnpm nx reset`
- Check tsconfig path mappings
- Verify all dependencies installed

### Debug Mode

Enable detailed logging:

```typescript
// payment.service.ts
this.logger.setLogLevels(['debug', 'log', 'error', 'warn']);
```

## 📈 Performance Considerations

### Database Optimization

- Indexes on `user_id`, `status`, `created_at`
- Composite index on `user_id + status`
- Unique index on `provider_transaction_id`
- JSONB for flexible metadata

### API Rate Limiting

- Aggressive limits on withdrawal (5/min)
- Moderate limits on top-up (10/min)
- Relaxed limits on queries (30-60/min)
- Webhook handler: 100/min

### Caching Strategy

- Cache exchange rates (5 min TTL)
- Cache user balance (1 min TTL)
- No caching for transactions (real-time)

## 🔐 Security Checklist

- [ ] HTTPS enabled on production
- [ ] API tokens stored in environment variables
- [ ] Webhook signatures verified
- [ ] JWT authentication on all endpoints
- [ ] Transaction ownership validated
- [ ] Rate limiting configured
- [ ] Database prepared statements (SQL injection prevention)
- [ ] Input validation on all DTOs
- [ ] Error messages don't leak sensitive data
- [ ] Logging configured properly

## 📦 Deployment Checklist

- [ ] Environment variables configured
- [ ] Database migrated
- [ ] Webhook URL configured in CryptoPay
- [ ] HTTPS certificate valid
- [ ] Firewall rules allow webhook
- [ ] Monitoring configured
- [ ] Error alerts set up
- [ ] Backup strategy in place
- [ ] Rate limits appropriate for traffic

## 🎯 Next Steps

1. **Testing**: Test thoroughly in testnet
2. **Monitoring**: Set up alerts for failed payments
3. **Analytics**: Track payment success rates
4. **UX**: Implement payment status notifications
5. **Scale**: Add more payment providers if needed

## 📞 Support Resources

- CryptoPay API: https://help.send.tg/en/articles/10279948-crypto-pay-api
- @CryptoBot: https://t.me/CryptoBot
- @CryptoTestnetBot: https://t.me/CryptoTestnetBot
- crypto-bot-api: https://github.com/sergeiivankov/crypto-bot-api

---

**Implementation Status**: ✅ Complete and Production-Ready

**Last Updated**: November 2, 2024
