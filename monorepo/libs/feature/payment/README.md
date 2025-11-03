# Payment Feature - CryptoPay Integration

Comprehensive payment system with cryptocurrency top-up and withdrawal capabilities using CryptoPay (CryptoBot) API.

## 🚀 Features

### Core Functionality
- **Top-Up**: Create payment invoices for users to add funds via cryptocurrency
- **Withdrawal**: Transfer funds from user balance to their Telegram wallet
- **Payment History**: Track all payment transactions with filtering and pagination
- **Real-time Webhooks**: Automatic balance updates when invoices are paid
- **Multi-Currency Support**: USDT, TON, BTC, ETH, LTC, BNB, TRX, USDC, JET (testnet)

### Provider Pattern
- Abstracted payment provider interface (`IPaymentProvider`)
- Easy to add new providers (Stripe, PayPal, etc.)
- Currently implemented: CryptoBotProvider

### Security Features
- JWT authentication on all endpoints
- Webhook signature verification (HMAC-SHA256)
- Transaction ownership validation
- Rate limiting per endpoint
- Secure environment variable configuration

## 📦 Package Structure

```
libs/feature/payment/
├── shared/                      # Shared types, DTOs, interfaces
│   └── src/
│       ├── dto/                # Data Transfer Objects
│       │   ├── create-invoice.dto.ts
│       │   ├── create-transfer.dto.ts
│       │   ├── webhook-update.dto.ts
│       │   └── payment-response.dto.ts
│       ├── enum/               # Enumerations
│       │   ├── payment-provider.enum.ts
│       │   ├── payment-status.enum.ts
│       │   ├── payment-type.enum.ts
│       │   └── cryptocurrency.enum.ts
│       ├── interface/          # Interfaces
│       │   └── payment-provider.interface.ts
│       └── payment-shared.module.ts
│
└── main/                        # Main implementation
    └── src/
        ├── provider/           # Payment provider implementations
        │   └── crypto-bot.provider.ts
        ├── service/            # Business logic
        │   └── payment.service.ts
        ├── controller/         # API endpoints
        │   ├── payment.controller.ts
        │   └── payment-webhook.controller.ts
        ├── entity/             # Database entities
        │   └── payment-transaction.entity.ts
        └── payment-main.module.ts
```

## 🔧 Installation & Setup

### 1. Environment Variables

Add to your `.env` file:

```bash
# CryptoPay API Configuration
CRYPTO_BOT_API_TOKEN=your_cryptobot_api_token_here
# For testnet: Get token from @CryptoTestnetBot
# For mainnet: Get token from @CryptoBot

# Optional: Webhook URL (for production)
CRYPTO_BOT_WEBHOOK_URL=https://yourdomain.com/payment/webhook/crypto-bot
```

### 2. Database Migration

Run the payment transactions table migration:

```bash
pnpm nx run migration:migrate
```

This creates the `payment_transactions` table with proper indexes and constraints.

### 3. Import Module

Add `PaymentMainModule` to your API app:

```typescript
// apps/api/src/app.module.ts
import { PaymentMainModule } from '@app/feature-payment-main';

@Module({
  imports: [
    // ... other modules
    PaymentMainModule,
  ],
})
export class AppModule {}
```

## 📡 API Endpoints

### Authentication
All endpoints require JWT authentication via `Authorization: Bearer <token>` header.

### Top-Up (Create Invoice)

```http
POST /payment/topup
Content-Type: application/json
Authorization: Bearer <jwt_token>

{
  "amount": "100.00",
  "currency": "USDT",
  "description": "Balance top-up",
  "expiresIn": 3600
}
```

**Response:**
```json
{
  "id": "uuid",
  "amount": "100.00",
  "currency": "USDT",
  "status": "PENDING",
  "payUrl": "https://t.me/CryptoBot?start=...",
  "expiresAt": "2024-01-01T12:00:00Z",
  "createdAt": "2024-01-01T11:00:00Z"
}
```

### Withdrawal (Create Transfer)

```http
POST /payment/withdraw
Content-Type: application/json
Authorization: Bearer <jwt_token>

{
  "userId": "123456789",
  "amount": "50.00",
  "currency": "USDT",
  "comment": "Withdrawal to wallet"
}
```

**Response:**
```json
{
  "id": "uuid",
  "userId": "123456789",
  "amount": "50.00",
  "currency": "USDT",
  "status": "PROCESSING",
  "createdAt": "2024-01-01T11:00:00Z"
}
```

### Get Transaction History

```http
GET /payment/transactions?type=TOP_UP&status=COMPLETED&limit=20&offset=0
Authorization: Bearer <jwt_token>
```

**Response:**
```json
{
  "data": [
    {
      "id": "uuid",
      "type": "TOP_UP",
      "amount": "100.00",
      "currency": "USDT",
      "status": "COMPLETED",
      "paidAt": "2024-01-01T11:05:00Z",
      "createdAt": "2024-01-01T11:00:00Z"
    }
  ],
  "total": 45,
  "limit": 20,
  "offset": 0
}
```

### Get Specific Transaction

```http
GET /payment/transactions/{transactionId}
Authorization: Bearer <jwt_token>
```

### Check Invoice Status

```http
GET /payment/invoice/{invoiceId}/status
Authorization: Bearer <jwt_token>
```

Syncs status with payment provider and auto-credits balance if paid.

## 🔔 Webhook Integration

### Setup Webhook URL

1. Get your CryptoPay API token from @CryptoBot
2. Set webhook URL in CryptoPay app settings
3. Ensure your server is accessible via HTTPS

### Webhook Endpoint

```http
POST /payment/webhook/crypto-bot
Content-Type: application/json
crypto-pay-api-signature: <hmac_signature>

{
  "update_type": "invoice_paid",
  "request_date": "2024-01-01T11:05:00Z",
  "payload": {
    "invoice_id": "12345",
    "status": "paid",
    "amount": "100.00",
    "currency": "USDT"
  }
}
```

**Security**: Webhook signatures are automatically verified using HMAC-SHA256.

## 💾 Database Schema

### Table: `payment_transactions`

| Column | Type | Description |
|--------|------|-------------|
| id | uuid | Primary key |
| user_id | varchar(255) | Telegram user ID |
| type | enum | TOP_UP or WITHDRAW |
| provider | enum | CRYPTO_BOT (extensible) |
| provider_transaction_id | varchar(255) | Provider's transaction ID |
| amount | decimal(20,8) | Transaction amount |
| currency | enum | Cryptocurrency type |
| status | enum | Payment status |
| pay_url | text | Payment URL (for invoices) |
| description | text | Transaction description |
| fee | decimal(20,8) | Provider fee (if applicable) |
| metadata | jsonb | Additional provider data |
| paid_at | timestamp | Payment completion time |
| expires_at | timestamp | Invoice expiration time |
| created_at | timestamp | Creation timestamp |
| updated_at | timestamp | Last update timestamp |

**Indexes:**
- `user_id` - User lookup
- `status` - Status filtering
- `provider_transaction_id` (unique) - Provider sync
- `created_at` (desc) - Recent transactions
- `user_id + status` - Combined queries

## 🔄 Payment Flow

### Top-Up Flow

1. **User requests top-up** → POST /payment/topup
2. **System creates invoice** → CryptoPay API
3. **User receives payment URL** → Opens in Telegram/Browser
4. **User pays** → CryptoPay processes payment
5. **Webhook received** → POST /payment/webhook/crypto-bot
6. **Balance credited** → Automatic via webhook
7. **Transaction updated** → Status: COMPLETED

### Withdrawal Flow

1. **User requests withdrawal** → POST /payment/withdraw
2. **System checks balance** → BalanceService
3. **Balance deducted** → Immediately (pessimistic)
4. **Transfer created** → CryptoPay API
5. **System tracks transfer** → Status: PROCESSING
6. **Provider completes** → Funds sent to user wallet
7. **Transaction updated** → Status: COMPLETED

## 🧪 Testing

### Testnet

Use testnet for development:

1. Get testnet token from @CryptoTestnetBot
2. Use JET currency for testing
3. Testnet URL: `https://testnet-pay.crypt.bot/`

### Manual Testing

```bash
# Create top-up invoice
curl -X POST http://localhost:3000/payment/topup \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "amount": "10.00",
    "currency": "JET",
    "description": "Test top-up"
  }'

# Check transaction history
curl -X GET http://localhost:3000/payment/transactions \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

## 🛡️ Security Best Practices

1. **Never expose API tokens** - Use environment variables
2. **Verify webhook signatures** - Always validate HMAC
3. **Use HTTPS** - Required for webhooks
4. **Rate limiting** - Built into controllers
5. **Transaction ownership** - Automatic validation
6. **Balance checks** - Before withdrawals
7. **Idempotency** - Prevents duplicate credits

## 📊 Rate Limits

| Endpoint | Rate Limit |
|----------|-----------|
| POST /topup | 10/minute |
| POST /withdraw | 5/minute |
| GET /transactions | 30/minute |
| GET /transactions/:id | 60/minute |
| GET /invoice/:id/status | 20/minute |
| POST /webhook | 100/minute |

## 🚨 Error Handling

The system uses Result<T, Error> pattern for type-safe error handling:

```typescript
const result = await paymentService.createTopUp(userId, dto);

if (result.err) {
  // Handle error
  console.error(result.val.message);
} else {
  // Success
  const invoice = result.val;
}
```

Common error codes:
- `400` - Invalid input (validation error)
- `401` - Unauthorized (missing/invalid JWT)
- `403` - Forbidden (not your transaction)
- `404` - Not found (transaction doesn't exist)
- `429` - Too many requests (rate limit)
- `500` - Internal error (provider error)

## 🔮 Future Enhancements

- [ ] Add more payment providers (Stripe, PayPal)
- [ ] Support fiat currency payments
- [ ] Recurring payments/subscriptions
- [ ] Payment analytics dashboard
- [ ] Automated refunds
- [ ] Multi-signature withdrawals
- [ ] Payment scheduling

## 📚 References

- [CryptoPay API Documentation](https://help.send.tg/en/articles/10279948-crypto-pay-api)
- [crypto-bot-api npm package](https://github.com/sergeiivankov/crypto-bot-api)
- [@CryptoBot Telegram](https://t.me/CryptoBot)
- [@CryptoTestnetBot Telegram](https://t.me/CryptoTestnetBot)

## 🤝 Support

For issues or questions:
1. Check this README
2. Review CryptoPay API docs
3. Check server logs
4. Test with testnet first

---

**Built with**: NestJS, TypeORM, CryptoPay API, TypeScript
