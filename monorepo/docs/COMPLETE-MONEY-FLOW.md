# Complete Money Flow - Single Diagram

## STARS are EXTERNAL - Flow from Telegram through Our System

```mermaid
graph TB
    subgraph "EXTERNAL - NOT OUR SYSTEM"
        User[👤 Real User<br/>Telegram Account]
        TG[⭐ Telegram Stars<br/>User buys from Telegram]
        CB[💳 Crypto Bot<br/>Payment Gateway API]
    end

    subgraph "OUR SYSTEM - Internal Balance Tracking"
        subgraph "BUYER"
            BBal[💰 UserBalance<br/>balance: 1000→500→750→50]
        end

        subgraph "ORDER"
            Reserve[🔒 TrafficOrderBalance<br/>locked:500 spent:250 refund:250]
            Order[📋 TrafficOrder<br/>100 tasks × 5 STARS]
        end

        subgraph "TRAFFIC"
            Source[📱 TrafficSource<br/>Seller's Bot]
            Users[🤖 Bot Users]
            Actions[✅ 50 completed]
        end

        subgraph "SELLER"
            SBal[💰 UserBalance<br/>balance: 0→250→0]
        end

        subgraph "AUDIT"
            History[📊 All transactions logged]
        end
    end

    %% External: User buys STARS from Telegram
    User -->|Buys STARS| TG
    TG -->|STARS exist in Telegram| CB

    %% DEPOSIT: External → Our System
    CB ==>|DEPOSIT +1000| BBal

    %% Lock Flow (Internal)
    BBal -->|Lock -500| Reserve
    Reserve -.manages.-> Order

    %% Traffic Flow (Internal)
    Order -.connects.-> Source
    Source -.has.-> Users
    Users -->|Complete| Actions

    %% Spend Flow (Internal)
    Reserve -->|Pay -250| SBal

    %% Refund Flow (Internal)
    Reserve -->|Refund +250| BBal

    %% WITHDRAW: Our System → External
    BBal ==>|WITHDRAW -700| CB
    SBal ==>|WITHDRAW -250| CB

    %% External: Crypto Bot pays out to Telegram
    CB -->|Payout STARS| TG
    TG -->|STARS back to user| User

    %% Audit (Internal)
    BBal -.logs.-> History
    SBal -.logs.-> History
    Reserve -.logs.-> History

    style TG fill:#ffd700,stroke:#ff8c00,stroke-width:4px
    style CB fill:#e1f5ff,stroke:#0288d1,stroke-width:4px
    style Reserve fill:#fff9c4,stroke:#f57f17,stroke-width:4px
    style BBal fill:#c8e6c9,stroke:#388e3c,stroke-width:3px
    style SBal fill:#c8e6c9,stroke:#388e3c,stroke-width:3px
    style History fill:#f3e5f5,stroke:#7b1fa2,stroke-width:2px
```

## Critical Understanding

### STARS are EXTERNAL CURRENCY (like USD/EUR)
- **Owned by**: Telegram
- **Purchased from**: Telegram Stars API (user pays real money)
- **Managed by**: Crypto Bot payment gateway (handles deposits/withdrawals)

### Our System TRACKS Balances (like a bank)
- **UserBalance**: Internal ledger tracking how many STARS each user deposited
- **TrafficOrderBalance**: Internal ledger for locked funds per order
- **UserBalanceHistory**: Audit log of all balance changes
- **We don't create STARS** - we only track deposits/withdrawals via Crypto Bot API

## Flow Summary

| # | Layer | From | To | Amount | Description |
|---|-------|------|-----|--------|-------------|
| 0 | External | User | Telegram | Real $ | User buys STARS from Telegram |
| 1 | **Deposit** | Crypto Bot API | Our UserBalance | +1000 | Track deposit in our system |
| 2 | Internal | UserBalance | TrafficOrderBalance | -500 | Lock funds for order |
| 3 | Internal | TrafficOrderBalance | Seller UserBalance | -250 | Pay for 50 tasks |
| 4 | Internal | TrafficOrderBalance | Buyer UserBalance | +250 | Refund unused |
| 5 | **Withdraw** | Our UserBalance | Crypto Bot API | -700 | Process buyer withdrawal |
| 6 | **Withdraw** | Our UserBalance | Crypto Bot API | -250 | Process seller withdrawal |
| 7 | External | Crypto Bot | Telegram | STARS | Payout to user's Telegram |

## Balance Tracking Formula

**TrafficOrderBalance invariant**: `lockedAmount = spentAmount + availableAmount + refundedAmount`

**Example**: `500 = 250 + 0 + 250 ✅`
