# Complete Money Flow - Single Diagram

## Full System Flow: STARS Origin → Deposit → Lock → Spend → Settle → Withdraw

```mermaid
graph TB
    subgraph "EXTERNAL WORLD"
        TG[⭐ Telegram Stars<br/>Payment API]
        CB[💳 Crypto Bot API<br/>Payment Gateway]
    end

    subgraph "BUYER FLOW"
        BD[💰 Buyer Deposits<br/>+1000 STARS]
        BBal[💰 Buyer UserBalance<br/>1000 → 500 → 750 → 50]
        BW[💸 Buyer Withdraws<br/>-700 STARS]
    end

    subgraph "ORDER SYSTEM"
        Lock[🔒 Lock Funds<br/>-500 STARS]
        Reserve[📦 TrafficOrderBalance<br/>locked: 500<br/>spent: 250<br/>refund: 250]
        Refund[🔄 Refund Unused<br/>+250 STARS]
    end

    subgraph "TRAFFIC SYSTEM"
        Order[📋 TrafficOrder<br/>100 tasks × 5 STARS<br/>Status: Cancelled at 50]
        Source[📱 Traffic Source<br/>Seller's Bot]
        Users[🤖 Bot Users<br/>Complete Tasks]
        Actions[✅ Traffic Actions<br/>50 tasks completed]
    end

    subgraph "SELLER FLOW"
        Pay[💵 Pay per Task<br/>5 STARS × 50 = 250]
        SBal[💰 Seller UserBalance<br/>0 → 250 → 0]
        SW[💸 Seller Withdraws<br/>-250 STARS]
    end

    subgraph "AUDIT"
        History[📊 UserBalanceHistory<br/>All Transactions Logged]
    end

    %% STARS Origin
    TG -->|Payment| CB
    CB -->|Deposit| BD

    %% Buyer Deposit
    BD -->|+1000| BBal

    %% Lock Flow
    BBal -->|Create Order| Lock
    Lock -->|500 STARS| Reserve
    Reserve -.manages.-> Order

    %% Traffic Flow
    Order -.connects.-> Source
    Source -.has.-> Users
    Users -->|Complete| Actions
    Actions -.records.-> Order

    %% Spend Flow
    Reserve -->|Per Task| Pay
    Pay -->|+250| SBal

    %% Refund Flow
    Reserve -->|Cancel Order| Refund
    Refund -->|+250| BBal

    %% Withdraw Flow
    BBal -->|Withdraw| BW
    BW -->|Payout| CB
    SBal -->|Withdraw| SW
    SW -->|Payout| CB

    %% Audit
    BBal -.logs.-> History
    SBal -.logs.-> History
    Reserve -.logs.-> History

    %% Back to external
    CB -->|Cashout| TG

    style TG fill:#ffd700,stroke:#ff8c00,stroke-width:4px
    style CB fill:#e1f5ff,stroke:#0288d1,stroke-width:3px
    style Reserve fill:#fff9c4,stroke:#f57f17,stroke-width:4px
    style BBal fill:#c8e6c9,stroke:#388e3c,stroke-width:2px
    style SBal fill:#c8e6c9,stroke:#388e3c,stroke-width:2px
    style History fill:#f3e5f5,stroke:#7b1fa2,stroke-width:2px
```

## Flow Summary

| # | From | To | Amount | Description |
|---|------|-----|--------|-------------|
| 0 | Telegram Stars API | Crypto Bot | - | Payment gateway |
| 1 | Crypto Bot | Buyer UserBalance | +1000 | Deposit |
| 2 | Buyer UserBalance | TrafficOrderBalance | -500 | Lock funds for order |
| 3 | TrafficOrderBalance | Seller UserBalance | -250 | Pay for 50 completed tasks |
| 4 | TrafficOrderBalance | Buyer UserBalance | +250 | Refund unused (order cancelled) |
| 5 | Buyer UserBalance | Crypto Bot | -700 | Buyer withdraws |
| 6 | Seller UserBalance | Crypto Bot | -250 | Seller withdraws |
| 7 | Crypto Bot | Telegram Stars API | - | Process payouts |

## Balance Tracking

**Formula**: `lockedAmount = spentAmount + availableAmount + refundedAmount`

**Example**: `500 = 250 + 0 + 250 ✅`
