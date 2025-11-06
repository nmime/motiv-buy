# Complete Money Flow - Single Diagram

## External Currency Flow Through Our System

```mermaid
graph TB
    subgraph "EXTERNAL - Payment Gateways"
        User[👤 User<br/>External Wallet]
        Gateway[💳 Payment Gateway<br/>Crypto Bot / Heleket / etc]
        Blockchain[⛓️ Blockchain<br/>TON / TRC20 / ETH]
    end

    subgraph "OUR SYSTEM - Balance Tracking Only"
        subgraph "BUYER"
            BBal[💰 UserBalance<br/>1000→500→750→50]
        end

        subgraph "ORDER"
            Reserve[🔒 TrafficOrderBalance<br/>locked:500 spent:250 refund:250]
            Order[📋 TrafficOrder<br/>100 tasks × 5 per task]
        end

        subgraph "TRAFFIC"
            Source[📱 TrafficSource]
            Users[🤖 Bot Users]
            Actions[✅ 50 completed]
        end

        subgraph "SELLER"
            SBal[💰 UserBalance<br/>0→250→0]
        end

        subgraph "AUDIT"
            History[📊 UserBalanceHistory]
        end
    end

    %% External deposits
    User -->|Send crypto| Blockchain
    Blockchain -->|Via gateway| Gateway

    %% DEPOSIT: External → Our System (we only track)
    Gateway ==>|DEPOSIT +1000 USDT| BBal

    %% Internal flows (our ledger)
    BBal -->|Lock -500| Reserve
    Reserve -.manages.-> Order
    Order -.connects.-> Source
    Source -.has.-> Users
    Users -->|Complete| Actions
    Reserve -->|Pay -250| SBal
    Reserve -->|Refund +250| BBal

    %% WITHDRAW: Our System → External
    BBal ==>|WITHDRAW -700| Gateway
    SBal ==>|WITHDRAW -250| Gateway

    %% External withdrawals
    Gateway -->|Via blockchain| Blockchain
    Blockchain -->|Receive crypto| User

    %% Audit trail
    BBal -.logs.-> History
    SBal -.logs.-> History
    Reserve -.logs.-> History

    style Blockchain fill:#ffd700,stroke:#ff8c00,stroke-width:4px
    style Gateway fill:#e1f5ff,stroke:#0288d1,stroke-width:4px
    style Reserve fill:#fff9c4,stroke:#f57f17,stroke-width:4px
    style BBal fill:#c8e6c9,stroke:#388e3c,stroke-width:3px
    style SBal fill:#c8e6c9,stroke:#388e3c,stroke-width:3px
    style History fill:#f3e5f5,stroke:#7b1fa2,stroke-width:2px
```

## Critical Understanding

### Supported Currencies (EXTERNAL)
**Fiat**: USD, EUR, RUB
**Crypto**: USDT, TON, BTC, ETH, BNB, TRX, USDC, LTC, DOGE, DAI, DASH, BCH, SOL

### Our System = Ledger Only (like a bank)
- **UserBalance**: Tracks how much each user deposited
- **TrafficOrderBalance**: Tracks locked funds per order
- **UserBalanceHistory**: Audit log of all balance changes
- **We don't create/own crypto** - only track deposits/withdrawals via payment gateways

## Flow Summary

| # | Layer | From | To | Amount | Description |
|---|-------|------|-----|--------|-------------|
| 0 | External | User Wallet | Blockchain | 1000 USDT | User sends crypto |
| 1 | **Deposit** | Payment Gateway | Our UserBalance | +1000 | We track deposit |
| 2 | Internal | UserBalance | TrafficOrderBalance | -500 | Lock for order |
| 3 | Internal | TrafficOrderBalance | Seller UserBalance | -250 | Pay 50 tasks |
| 4 | Internal | TrafficOrderBalance | Buyer UserBalance | +250 | Refund unused |
| 5 | **Withdraw** | Our UserBalance | Payment Gateway | -700 | Buyer withdraws |
| 6 | **Withdraw** | Our UserBalance | Payment Gateway | -250 | Seller withdraws |
| 7 | External | Payment Gateway | Blockchain | 950 USDT | Process payouts |

## Formula

`lockedAmount = spentAmount + availableAmount + refundedAmount`

Example: `500 = 250 + 0 + 250 ✅`
