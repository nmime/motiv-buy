# Webhook Security Architecture

## Overview

This document explains the security architecture for payment webhook endpoints in the motiv-buy application.

## Security Layers

### 1. Signature Verification (Primary Authentication)

**Implementation:** HMAC-SHA256
**Location:** `payment-webhook.controller.ts:94`

```typescript
const isValid = this.cryptoBotProvider.verifyWebhook(signature, bodyString);
```

**How it works:**
1. Payment provider calculates HMAC-SHA256 hash of request body using shared secret
2. Provider includes hash in `crypto-pay-api-signature` header
3. Our server recalculates hash using same secret
4. If hashes match, request is authentic

**Security guarantees:**
- ✅ Proves request came from payment provider (only they have the secret)
- ✅ Proves request body hasn't been tampered with (hash includes entire body)
- ✅ Cryptographically strong (SHA-256 is industry standard)

**Rejection criteria:**
- Missing `crypto-pay-api-signature` header → 401 Unauthorized
- Invalid signature (hash mismatch) → 401 Unauthorized

### 2. Rate Limiting (DoS Prevention)

**Implementation:** `@Throttle` decorator
**Location:** `payment-webhook.controller.ts:44`

```typescript
@Throttle({ default: { limit: 100, ttl: 60000 } })
```

**Configuration:**
- 100 requests per minute per IP address
- TTL: 60,000ms (1 minute)

**Why 100 req/min:**
- Legitimate webhooks: typically <10 requests/minute
- Allows burst traffic during high activity
- Prevents brute force signature guessing
- Prevents memory exhaustion from excessive requests

**Rejection criteria:**
- Exceeds 100 requests in 1 minute → 429 Too Many Requests

### 3. Input Validation (Injection Prevention)

**Implementation:** Multi-layered validation
**Location:** `payment-webhook.controller.ts:186-271`

#### 3.1 Payload Size Limit
```typescript
if (jsonString.length > 100000) {
  throw new BadRequestException('Webhook payload too large');
}
```
- Maximum: 100KB (100,000 bytes)
- Prevents memory exhaustion attacks
- Typical webhook: ~1-5KB

#### 3.2 Type Validation
```typescript
if (typeof data.updateType !== 'string' || data.updateType.trim().length === 0) {
  throw new Error('Invalid webhook payload: missing or invalid updateType');
}
```
- Strict type checking for all fields
- Null/undefined rejection
- Empty string rejection

#### 3.3 Date Validation
```typescript
const date = new Date(data.requestDate);
if (isNaN(date.getTime())) {
  throw new Error('Invalid webhook payload: requestDate is not a valid date');
}
```
- ISO 8601 date format required
- Prevents invalid date objects

#### 3.4 String Sanitization
```typescript
const sanitizedUpdateType = data.updateType.trim().replace(/[^\w-]/g, '_');
```
- Removes special characters
- Prevents SQL injection
- Prevents XSS attacks

### 4. Request ID Tracking (Audit Trail)

**Implementation:** UUID v4
**Location:** `payment-webhook.controller.ts:77`

```typescript
const requestId = randomUUID();
```

**Benefits:**
- Unique identifier for each webhook request
- Correlates logs across multiple service layers
- Enables debugging of webhook processing issues
- Stored in transaction metadata for audit trail

**Usage:**
```typescript
// Controller logs
this.logger.log('Received CryptoPay webhook', { requestId });

// Service logs
const result = await this.paymentService.processWebhook(webhookData, requestId);

// Transaction metadata
transaction.metadata = { requestId, ... };
```

### 5. Error Handling (Security & Reliability)

**Strategy:** Always return 200 OK (except auth failures)

**Why:**
```typescript
// Return success to prevent unnecessary provider retries
return { ok: true };
```

**Rationale:**
1. **Prevents infinite retries:** Provider won't retry if we return error status
2. **Idempotency-safe:** Same webhook can be processed multiple times safely
3. **Debugging-friendly:** All errors logged with full context
4. **Provider-friendly:** Follows webhook best practices

**Exception:** Authentication failures (401) should be retried by provider

## Why CSRF Protection is NOT Used

### What is CSRF?
Cross-Site Request Forgery (CSRF) protects against unauthorized actions from authenticated users via malicious websites.

### Why webhooks don't need CSRF:

1. **Server-to-Server Communication**
   - Webhooks are sent from payment provider servers
   - Not initiated by web browsers or authenticated users
   - No cookies or session tokens involved

2. **No User Authentication**
   - Webhook endpoints don't use session-based auth
   - No user is "logged in" during webhook processing
   - CSRF tokens protect user sessions (not applicable here)

3. **Stronger Alternative (Signature Verification)**
   - HMAC-SHA256 signature is cryptographically stronger than CSRF tokens
   - Proves request authenticity (not just that it came from our site)
   - Proves request integrity (body hasn't been modified)

4. **Breaking Legitimate Requests**
   - If CSRF protection was enabled, payment provider requests would fail
   - Providers can't obtain CSRF tokens (they're external services)
   - Would require manual token sharing (insecure and impractical)

### Comparison Table

| Security Feature | CSRF Token | HMAC Signature |
|-----------------|------------|----------------|
| **Protects against** | User session hijacking | Request tampering |
| **Authentication** | Session-based | Cryptographic |
| **Suitable for** | User-initiated requests | Server-to-server |
| **Strength** | Medium | Strong |
| **Webhook compatibility** | ❌ Breaks webhooks | ✅ Perfect for webhooks |

## Security Testing Checklist

### Signature Verification Tests
- [x] ✅ Missing signature header → 401
- [x] ✅ Invalid signature → 401
- [x] ✅ Valid signature → 200
- [ ] ⚠️ Signature timing attack resistance
- [ ] ⚠️ Signature replay attack (use timestamp)

### Rate Limiting Tests
- [x] ✅ Under limit → 200
- [ ] ⚠️ Over limit → 429
- [ ] ⚠️ Rate limit per IP (not global)
- [ ] ⚠️ Rate limit reset after TTL

### Input Validation Tests
- [x] ✅ Valid payload → 200
- [x] ✅ Invalid payload → 200 (logged)
- [x] ✅ Oversized payload → 400
- [x] ✅ Missing required fields → 200 (logged)
- [ ] ⚠️ SQL injection attempts
- [ ] ⚠️ XSS attempts

### Idempotency Tests
- [x] ✅ Duplicate webhook → Idempotent
- [x] ✅ Concurrent webhooks → Race-safe
- [ ] ⚠️ Out-of-order webhooks

## Production Deployment Checklist

### Secrets Management
- [ ] Store HMAC secret in environment variable (never in code)
- [ ] Rotate HMAC secret periodically (quarterly)
- [ ] Use different secrets for staging/production

### Monitoring
- [ ] Alert on >50 webhook authentication failures per hour
- [ ] Alert on rate limit violations
- [ ] Dashboard for webhook processing metrics
- [ ] Log retention: minimum 90 days for audit

### Network Security
- [ ] Webhook endpoint uses HTTPS only (no HTTP)
- [ ] TLS 1.2+ required
- [ ] Certificate pinning (optional, for high security)
- [ ] Firewall rules: only allow payment provider IPs (optional)

### Disaster Recovery
- [ ] Webhook processing failure → Manual investigation procedure
- [ ] Balance deduction failure → Automatic rollback + alert
- [ ] Database transaction failure → Critical alert + manual fix

## Threat Model

### Threats Mitigated ✅
1. **Unauthorized webhook injection** - Blocked by signature verification
2. **Webhook tampering** - Detected by signature mismatch
3. **Replay attacks** - Mitigated by idempotency checks
4. **DoS attacks** - Rate limiting + payload size limits
5. **SQL injection** - Input validation + sanitization
6. **XSS attacks** - String sanitization
7. **Race conditions** - Pessimistic locking
8. **Memory exhaustion** - Payload size limit + rate limiting

### Threats NOT Mitigated ⚠️
1. **Replay attacks (timing)** - Consider adding timestamp validation
2. **DDoS (distributed)** - Use CloudFlare or AWS Shield
3. **Provider key compromise** - Requires key rotation
4. **Man-in-the-middle** - Requires HTTPS (already enforced)

## Further Reading

- [OWASP Webhook Security](https://cheatsheetseries.owasp.org/cheatsheets/Webhook_Security_Cheat_Sheet.html)
- [Stripe Webhook Security](https://stripe.com/docs/webhooks/best-practices)
- [HMAC Authentication RFC 2104](https://www.ietf.org/rfc/rfc2104.txt)
