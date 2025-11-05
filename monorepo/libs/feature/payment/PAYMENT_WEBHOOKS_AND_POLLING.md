# Payment Webhooks & Polling Integration

## Overview

The payment system now supports **dual update strategies** for all payment providers:
- **Webhooks** (Push-based): Real-time notifications from payment providers
- **Polling** (Pull-based): Periodic status checks for pending transactions
- **Hybrid Mode** (Recommended): Both webhooks and polling for maximum reliability

## Supported Providers

All three payment providers now have full webhook and polling support:

| Provider | Webhook Endpoint | Signature Verification | Polling Support | Status |
|----------|------------------|------------------------|-----------------|---------|
| **CryptoBot** | `/payment/webhook/crypto-bot` | ✅ HMAC-SHA256 | ✅ Yes | **FULLY OPERATIONAL** |
| **Heleke** | `/payment/webhook/heleke` | ✅ HMAC-SHA256 | ✅ Yes | **FULLY OPERATIONAL** |
| **YooKassa** | `/payment/webhook/yookassa` | ✅ IP Whitelist | ✅ Yes | **FULLY OPERATIONAL** |

---

## Configuration

### Environment Variables

#### Update Strategies (per provider)

```bash
# Update strategies: WEBHOOK, POLLING, or HYBRID (default)
CRYPTO_BOT_UPDATE_STRATEGY=HYBRID
HELEKET_UPDATE_STRATEGY=HYBRID
YOOKASSA_UPDATE_STRATEGY=HYBRID
```

#### Webhook Configuration

```bash
# CryptoBot
CRYPTO_BOT_WEBHOOK_URL=https://your-domain.com/payment/webhook/crypto-bot
CRYPTO_BOT_WEBHOOK_SECRET=your-secret-key
CRYPTO_BOT_WEBHOOK_TIMEOUT=30
CRYPTO_BOT_WEBHOOK_VERIFY=true

# Heleke
HELEKET_WEBHOOK_URL=https://your-domain.com/payment/webhook/heleke

# YooKassa
YOOKASSA_WEBHOOK_URL=https://your-domain.com/payment/webhook/yookassa
YOOKASSA_WEBHOOK_IPS=185.71.76.0/27,185.71.77.0/27,77.75.153.0/25
```

#### Polling Configuration

```bash
# Global polling settings
PAYMENT_POLLING_ENABLED=true
PAYMENT_POLLING_INTERVAL=30000  # 30 seconds
PAYMENT_POLLING_MAX_PENDING_AGE=1440  # 24 hours in minutes
PAYMENT_POLLING_BATCH_SIZE=50

# Per-provider polling enable/disable
PAYMENT_POLLING_CRYPTOBOT=true
PAYMENT_POLLING_HELEKE=true
PAYMENT_POLLING_YOOKASSA=true
```

---

## Update Strategies

### 1. **WEBHOOK** (Push-based only)
- Payment provider sends real-time notifications
- Instant updates when payment status changes
- Requires public endpoint accessible by provider
- Polling disabled for this provider

**Use case**: Production environments with reliable webhook delivery

```bash
CRYPTO_BOT_UPDATE_STRATEGY=WEBHOOK
PAYMENT_POLLING_CRYPTOBOT=false  # Optional: explicitly disable
```

### 2. **POLLING** (Pull-based only)
- Application periodically checks payment status
- Works without public webhooks
- Configurable interval (default: 30 seconds)
- Useful for local development or restrictive firewalls

**Use case**: Development environments, networks with firewall restrictions

```bash
CRYPTO_BOT_UPDATE_STRATEGY=POLLING
CRYPTO_BOT_WEBHOOK_URL=  # Leave empty or omit
```

### 3. **HYBRID** (Push + Pull) - **RECOMMENDED**
- Both webhooks AND polling enabled
- Maximum reliability and resilience
- Idempotency prevents duplicate processing
- Pessimistic locking prevents race conditions

**Use case**: Production environments (most reliable)

```bash
CRYPTO_BOT_UPDATE_STRATEGY=HYBRID
CRYPTO_BOT_WEBHOOK_URL=https://your-domain.com/payment/webhook/crypto-bot
PAYMENT_POLLING_CRYPTOBOT=true
```

---

## Webhook Endpoints

### CryptoBot Webhook

**Endpoint**: `POST /payment/webhook/crypto-bot`

**Headers**:
```
crypto-pay-api-signature: <HMAC-SHA256-signature>
Content-Type: application/json
```

**Signature Verification**:
```
secret = SHA256(CRYPTO_BOT_API_TOKEN)
signature = HMAC-SHA256(request_body, secret)
```

**Payload Example**:
```json
{
  "updateType": "invoice_paid",
  "requestDate": "2025-11-05T12:00:00.000Z",
  "payload": {
    "id": "123456",
    "status": "paid",
    "data": {
      "amount": "100.00",
      "currency": "USDT",
      "pay_url": "https://..."
    }
  }
}
```

---

### Heleke Webhook

**Endpoint**: `POST /payment/webhook/heleke`

**Headers**:
```
x-heleke-signature: <HMAC-SHA256-signature>
Content-Type: application/json
```

**Signature Verification**:
```
signature = HMAC-SHA256(request_body, HELEKET_API_TOKEN)
```

**Payload Example**:
```json
{
  "updateType": "invoice_paid",
  "requestDate": "2025-11-05T12:00:00.000Z",
  "payload": {
    "id": "ORDER-123",
    "status": "success",
    "data": {
      "amount": "9550.00",
      "currency": "RUB"
    }
  }
}
```

---

### YooKassa Webhook

**Endpoint**: `POST /payment/webhook/yookassa`

**Headers**:
```
x-forwarded-for: <client-ip>
x-real-ip: <client-ip>
Content-Type: application/json
```

**IP Whitelist Verification**:
```
Allowed IPs (from YooKassa documentation):
- 185.71.76.0/27
- 185.71.77.0/27
- 77.75.153.0/25
- 77.75.154.128/25
- 2a02:5180::/32
```

**Payload Example**:
```json
{
  "updateType": "invoice_paid",
  "requestDate": "2025-11-05T12:00:00.000Z",
  "payload": {
    "id": "2c4d6b9e-000f-5000-9000-1b49b0c4c7c5",
    "status": "succeeded",
    "data": {
      "amount": "9550.00",
      "currency": "RUB"
    }
  }
}
```

---

## Polling Service

### How It Works

The `PaymentPollingService` automatically starts on application startup and:

1. **Queries Database**: Finds pending/processing transactions within configured age limit
2. **Batches Requests**: Processes transactions in configurable batch sizes (default: 50)
3. **Calls Provider APIs**: Fetches latest status from each provider
4. **Updates Database**: Atomically updates transaction status with pessimistic locking
5. **Prevents Duplicates**: Idempotency checks prevent double-processing
6. **Logs Progress**: Comprehensive logging for monitoring and debugging

### Polling Interval

Default: **30 seconds**

```bash
PAYMENT_POLLING_INTERVAL=30000  # milliseconds
```

**Recommendations**:
- **Development**: 10-15 seconds for faster feedback
- **Production**: 30-60 seconds to reduce API calls
- **High Volume**: 60-120 seconds to prevent rate limiting

### Maximum Pending Age

Default: **1440 minutes (24 hours)**

Only polls transactions created within this time window. Older transactions are ignored.

```bash
PAYMENT_POLLING_MAX_PENDING_AGE=1440  # minutes
```

### Batch Size

Default: **50 transactions per cycle**

Limits how many transactions are polled in each interval.

```bash
PAYMENT_POLLING_BATCH_SIZE=50
```

---

## Race Condition Prevention

### Webhook + Polling Conflicts

When both webhooks and polling are enabled, **race conditions are prevented** through:

1. **Pessimistic Locking** (`LockMode.PESSIMISTIC_WRITE`)
   - Transaction row is locked before status update
   - Concurrent updates block until lock is released

2. **Idempotency Checks**
   - Double-check status after acquiring lock
   - Skip update if webhook already processed it

3. **Metadata Tracking**
   - Records update source (`webhook` or `polling_service`)
   - Timestamps for debugging and auditing

### Balance Crediting/Refunding

**Double-crediting prevented** through:
- Pessimistic locking on transaction reload
- `balanceCredited` flag in transaction metadata
- Atomic check-and-set within database transaction

---

## Security Features

### Webhook Security

1. **CryptoBot & Heleke**:
   - HMAC-SHA256 signature verification
   - Payload size limits (100KB max)
   - Rate limiting (100 req/min per IP)
   - Request sanitization

2. **YooKassa**:
   - IP whitelist verification
   - Configurable allowed IP ranges
   - Rate limiting (100 req/min per IP)

3. **All Providers**:
   - Request ID tracking for audit trails
   - Comprehensive error logging
   - Returns 200 OK even on errors (prevents retries)
   - Only returns 401 for auth failures

---

## Monitoring & Debugging

### Polling Status Endpoint

Get current polling service status:

```typescript
import { PaymentPollingService } from '@app/feature-payment-main';

const status = pollingService.getStatus();
// {
//   enabled: true,
//   running: true,
//   interval: 30000,
//   maxPendingAge: 1440,
//   batchSize: 50,
//   providers: {
//     cryptoBot: true,
//     heleke: true,
//     yooKassa: true
//   }
// }
```

### Manual Poll Trigger

Manually trigger polling cycle (useful for testing):

```typescript
await pollingService.triggerManualPoll();
```

### Logging

All operations are logged with structured context:

```
[PaymentPollingService] Polling 25 pending transactions
[PaymentPollingService] Transaction abc123 status updated via polling: pending -> completed
[PaymentPollingService] Polling completed in 2345ms: 23 updated, 0 failed, 2 skipped
```

---

## Event Types

### Invoice Events

| Event Type | Description | Webhook | Polling |
|------------|-------------|---------|---------|
| `invoice_paid` | Invoice successfully paid | ✅ | ✅ |
| `invoice_expired` | Invoice expired without payment | ✅ | ✅ |
| `invoice_cancelled` | Invoice cancelled by user/system | ✅ | ✅ |

### Transfer Events

| Event Type | Description | Webhook | Polling |
|------------|-------------|---------|---------|
| `transfer_completed` | Withdrawal completed successfully | ✅ | ✅ |
| `transfer_failed` | Withdrawal failed, balance refunded | ✅ | ✅ |

---

## Best Practices

### Production Deployment

1. **Use HYBRID mode** for maximum reliability
2. **Configure webhook URLs** pointing to your public API
3. **Set up IP whitelist** for YooKassa webhooks
4. **Enable signature verification** for CryptoBot and Heleke
5. **Monitor polling logs** for API errors
6. **Set reasonable intervals** (30-60 seconds recommended)

### Development Environment

1. **Use POLLING mode** if no public webhook endpoint available
2. **Shorter intervals** (10-15 seconds) for faster testing
3. **Enable debug logging** for troubleshooting
4. **Use testnet/sandbox** environments for all providers

### High-Volume Systems

1. **Increase polling interval** (60-120 seconds) to reduce API load
2. **Increase batch size** (100-200) for better throughput
3. **Monitor rate limits** from payment providers
4. **Consider dedicated polling workers** for horizontal scaling

---

## Troubleshooting

### Webhooks Not Received

**Check:**
1. Webhook URL is publicly accessible
2. SSL/TLS certificate is valid
3. Firewall allows incoming connections
4. Signature verification is correctly configured
5. Provider's webhook settings include your URL

**Solution**: Enable polling as fallback while debugging webhooks

### Polling Not Working

**Check:**
1. `PAYMENT_POLLING_ENABLED=true`
2. Provider-specific polling flags are `true`
3. Update strategy is `POLLING` or `HYBRID`
4. No errors in application logs
5. Transactions exist with `pending`/`processing` status

**Solution**: Check logs for specific error messages

### Duplicate Processing

**Should not occur** if using this implementation correctly. If it does:

1. Check for multiple application instances without shared database
2. Verify pessimistic locking is enabled in database
3. Check for race conditions in custom code
4. Review transaction metadata for `balanceCredited` flag

---

## Migration Guide

### From Webhook-Only to Hybrid

1. Add polling configuration to environment:
```bash
PAYMENT_POLLING_ENABLED=true
PAYMENT_POLLING_INTERVAL=30000
```

2. Update strategy for each provider:
```bash
CRYPTO_BOT_UPDATE_STRATEGY=HYBRID
HELEKET_UPDATE_STRATEGY=HYBRID
YOOKASSA_UPDATE_STRATEGY=HYBRID
```

3. Restart application - polling starts automatically

4. Monitor logs to verify both webhook and polling are working

### From Polling-Only to Hybrid

1. Configure webhook endpoints for each provider
2. Add webhook URLs to environment variables
3. Update provider settings to point to your webhook URLs
4. Change strategy to `HYBRID`
5. Restart and monitor both channels

---

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                     Payment System                           │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  ┌────────────────┐         ┌─────────────────────────┐    │
│  │  Webhook       │         │  Polling Service        │    │
│  │  Controller    │         │  (Background)           │    │
│  │                │         │                         │    │
│  │  /crypto-bot  │◄───────┐│  Every 30s:             │    │
│  │  /heleke      │         ││  - Query pending txs    │    │
│  │  /yookassa    │         ││  - Call provider APIs   │    │
│  └────────┬───────┘         ││  - Update status        │    │
│           │                 │└─────────────────────────┘    │
│           │                 │           │                    │
│           │                 │           │                    │
│           └─────────────────┴───────────┘                    │
│                             │                                │
│                     ┌───────▼─────────┐                     │
│                     │  PaymentService │                     │
│                     │                 │                     │
│                     │  processWebhook()│                    │
│                     │  - Idempotency  │                     │
│                     │  - Pessimistic  │                     │
│                     │    Locking       │                     │
│                     │  - Balance Ops  │                     │
│                     └─────────────────┘                     │
│                                                               │
└─────────────────────────────────────────────────────────────┘
           ▲                              ▲
           │                              │
           │ Webhooks                     │ API Polling
           │ (Push)                       │ (Pull)
           │                              │
┌──────────┴──────────┐      ┌───────────┴────────────┐
│  Payment Providers  │      │   Payment Providers    │
│                     │      │                        │
│  - CryptoBot        │      │   - CryptoBot          │
│  - Heleke           │      │   - Heleke             │
│  - YooKassa         │      │   - YooKassa           │
└─────────────────────┘      └────────────────────────┘
```

---

## API Reference

### PaymentPollingService

#### Methods

**`getStatus()`**
```typescript
interface PollingStatus {
  enabled: boolean;
  running: boolean;
  interval: number;
  maxPendingAge: number;
  batchSize: number;
  providers: Record<string, boolean>;
}

getStatus(): PollingStatus
```

**`triggerManualPoll()`**
```typescript
triggerManualPoll(): Promise<void>
```

Manually trigger a polling cycle (bypasses interval timer).

---

### PaymentConfigService

#### New Methods

**`getPollingConfig()`**
```typescript
getPollingConfig(): PaymentPollingConfig
```

**`getCryptoBotConfig().updateStrategy`**
```typescript
enum PaymentUpdateStrategy {
  Webhook = 'WEBHOOK',
  Polling = 'POLLING',
  Hybrid = 'HYBRID'
}
```

---

## Performance Considerations

### Polling Overhead

**Database Queries**: 1 query per polling cycle (batch select)
**Provider API Calls**: 1 call per pending transaction
**Lock Overhead**: Minimal (row-level locks, milliseconds)

**Example**: With 50 pending transactions and 30s interval:
- 50 API calls every 30 seconds = 100 calls/minute
- Well within most provider rate limits (usually 300-1000/min)

### Webhook Overhead

**No polling overhead** when using `WEBHOOK` strategy
**Instant updates** with sub-second latency
**Minimal server resources** (event-driven, not CPU-bound)

### Hybrid Overhead

**Polling + Webhooks**: Slight increase but worth it for reliability
**Idempotency prevents duplicate work**: Locks released quickly if already processed
**Recommended for production**: Trade small overhead for guaranteed delivery

---

## Support & Contact

For questions or issues:
1. Check logs for specific error messages
2. Review this documentation
3. Check provider documentation for webhook formats
4. Open GitHub issue with logs and configuration (redact secrets!)

---

**Last Updated**: November 2025
**Version**: 1.0.0
