# Balance Feature

Complete balance management system with cryptocurrency support, multi-source exchange rates, and payment integration.

## Features

### Balance Management
- User balance tracking in RUB (Russian Rubles)
- Available and pending balance calculation
- Total earned tracking
- Transaction history with filtering

### Currency System
- **Currency Entity**: Stores all supported currencies (fiat + crypto)
- **Multi-Source Rates**: CoinGecko, Binance, Central Bank APIs
- **Weighted Averaging**: Reliability scores for accurate rates
- **USD-Based**: All rates convert to/from USD as base currency
- **Historical Tracking**: Currency rates history for auditing

### Top-Up (Deposits)
1. User selects cryptocurrency and amount
2. System creates payment invoice via CryptoBot
3. User pays via Telegram bot
4. Payment webhook updates balance in RUB
5. Currency conversion uses real-time rates

### Withdrawals
1. User requests withdrawal in RUB
2. System converts to selected cryptocurrency
3. Transfer initiated via CryptoBot
4. Balance deducted immediately
5. Transfer status tracked

## Architecture

```
┌─────────────────────────────────────────────────┐
│           BalanceController                      │
│  (/balance/topup, /balance/withdraw)            │
└─────────────────┬───────────────────────────────┘
                  │
        ┌─────────┴──────────┐
        │                     │
┌───────▼────────┐  ┌────────▼──────────┐
│ BalanceService │  │ CurrencyRateService│
│                │  │                     │
│ - getBalance   │  │ - convertAmount     │
│ - getHistory   │  │ - updateAllRates    │
└───────┬────────┘  └────────┬────────────┘
        │                     │
        │           ┌─────────┴─────────┐
        │           │                   │
┌───────▼───────────▼────┐  ┌──────────▼──────────┐
│   PaymentService       │  │  Currency Repos     │
│   (payment-main)       │  │                     │
│                        │  │  - Currency         │
│ - createTopUp          │  │  - RatesHistory     │
│ - createWithdrawal     │  │                     │
└────────────────────────┘  └─────────────────────┘
```

## Database Schema

### currencies
- `id`: UUID (PK)
- `code`: VARCHAR(10) - USD, RUB, BTC, ETH, etc.
- `type`: ENUM (FIAT, CRYPTO)
- `rate_to_usd`: DECIMAL(20,8) - Current rate to USD
- `name`, `symbol`, `decimal_places`
- `is_active`, timestamps

### currency_rates_history
- `id`: UUID (PK)
- `currency_id`: UUID (FK -> currencies)
- `provider`: ENUM (COINGECKO, BINANCE, CENTRAL_BANK)
- `rate_to_usd`: DECIMAL(20,8)
- `reliability_score`: INTEGER (0-100)
- `created_at`: TIMESTAMPTZ

### user_balances
- `id`: UUID (PK)
- `user_id`: UUID (FK -> users)
- `currency_id`: UUID (FK -> currencies)
- `balance`: DECIMAL(20,8)
- `locked_balance`: DECIMAL(20,8)
- timestamps

## API Endpoints

### GET /balance
Get current user balance with details.

**Response:**
```json
{
  "userId": "uuid",
  "amount": 1000.50,
  "currency": "RUB",
  "availableAmount": 950.50,
  "pendingAmount": 50,
  "totalEarned": 5000,
  "lastTransactionAt": "2025-11-03T..."
}
```

### GET /balance/transactions
Get transaction history with optional filtering.

**Query params:**
- `type`: "deposit" | "withdrawal" | "traffic_sale_income"

### POST /balance/topup
Create cryptocurrency invoice for balance top-up.

**Request:**
```json
{
  "amount": "100",
  "currency": "USDT",
  "description": "Balance top-up"
}
```

**Response:**
```json
{
  "paymentUrl": "https://t.me/CryptoBot?start=invoice_...",
  "invoiceId": "uuid",
  "rubAmount": "9550.00"
}
```

### POST /balance/withdraw
Request withdrawal to cryptocurrency wallet.

**Request:**
```json
{
  "amount": 1000,
  "currency": "USDT",
  "telegramUserId": 123456789,
  "comment": "Withdrawal"
}
```

**Response:**
```json
{
  "transferId": "uuid",
  "cryptoAmount": "10.50000000"
}
```

## Currency Rate Updates

Rates are fetched automatically every 10 minutes from:

1. **CoinGecko** (95% reliability)
   - BTC, ETH, USDT, USDC, BNB, TON, TRX, LTC

2. **Binance** (90% reliability)
   - BTC, ETH, BNB, LTC

3. **Exchange Rate API** (100% reliability)
   - RUB, EUR fiat rates

**Weighted Average:**
- Each provider has a reliability score
- Final rate = Σ(rate × score) / Σ(scores)
- Only uses rates from last hour

## Usage Examples

### Initialize Currency Service
```typescript
import { CurrencyRateService } from '@app/feature-balance-main';

// Service auto-initializes on module startup
// - Creates default currencies
// - Fetches initial rates
// - Starts cron jobs
```

### Convert Currencies
```typescript
const result = await currencyRateService.convertAmount(
  '100',      // amount
  CurrencyCode.USDT,  // from
  CurrencyCode.RUB,   // to
);

if (result.ok) {
  console.log(`Converted: ${result.val} RUB`);
}
```

### Get Current Rate
```typescript
const rateResult = await currencyRateService.getCurrentRate(
  CurrencyCode.BTC
);

if (rateResult.ok) {
  console.log(`1 BTC = ${rateResult.val} USD`);
}
```

## Configuration

### Environment Variables
Required in payment-main module:
- `CRYPTO_BOT_API_TOKEN`: CryptoBot API token

### Cron Jobs
- **Rate Updates**: Every 10 minutes
- **History Cleanup**: Daily at 3 AM (keeps 7 days)

## Testing

```bash
# Unit tests
npm test libs/feature/balance/main

# Integration tests
npm run test:e2e balance

# Rate fetching (manual)
curl http://localhost:3000/admin/rates/update
```

## Migration

Run migrations in order:
1. `Migration20251103000001_create_currencies_table`
2. `Migration20251103000002_create_currency_rates_history_table`
3. `Migration20251103000003_update_user_balances_currency_link`

```bash
npm run migration:up
```

## Dependencies

- `@app/database` - Entities and repositories
- `@app/feature-payment-main` - Payment processing
- `@nestjs/schedule` - Cron jobs for rate updates
- External APIs: CoinGecko, Binance, ExchangeRate-API

## Notes

- All balance amounts stored as DECIMAL(20,8)
- RUB is the primary internal currency
- USD is the base currency for all exchange rates
- Payment transactions link to balance history automatically
- Circular dependency resolved with `forwardRef()`
