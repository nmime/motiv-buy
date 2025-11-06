# Traffic & Balance System - Visual Diagrams

> These diagrams use Mermaid format and can be visualized in GitHub, VS Code, GitLab, and most modern documentation tools.

## 1. Complete Money Lifecycle Flow

### Full System Flow: Deposit → Lock → Spend → Settle → Withdraw

This comprehensive diagram shows the complete money flow through the entire system from initial deposit to final withdrawal.

```mermaid
sequenceDiagram
    participant External as 💳 External Payment<br/>(Crypto Bot)
    participant BuyerBal as 💰 Buyer UserBalance
    participant Reserve as 🔒 TrafficOrderBalance
    participant SellerBal as 💰 Seller UserBalance
    participant BuyerExt as 💸 Buyer Withdrawal
    participant SellerExt as 💸 Seller Withdrawal
    participant History as 📊 UserBalanceHistory

    rect rgb(220, 255, 220)
        note right of External: STAGE 0: DEPOSIT
        External->>BuyerBal: Deposit 1000 STARS
        BuyerBal->>BuyerBal: balance: 0 → 1000
        BuyerBal->>History: Log: +1000 (Deposit)
        note over BuyerBal: Buyer Balance: 1000 STARS
    end

    rect rgb(255, 250, 205)
        note right of BuyerBal: STAGE 1: LOCK FUNDS (Order Creation)
        BuyerBal->>BuyerBal: Check balance >= 500
        BuyerBal->>Reserve: Lock 500 STARS
        BuyerBal->>BuyerBal: balance: 1000 → 500
        Reserve->>Reserve: lockedAmount: 500<br/>availableAmount: 500<br/>spentAmount: 0
        BuyerBal->>History: Log: -500 (Order Lock)
        note over BuyerBal,Reserve: Buyer: 500 free<br/>Order: 500 locked
    end

    rect rgb(230, 240, 255)
        note right of Reserve: STAGE 2: SPEND (Task Completions)

        note over Reserve,SellerBal: Task #1
        Reserve->>Reserve: 🔒 Pessimistic Lock
        Reserve->>Reserve: Deduct 5 STARS
        Reserve->>Reserve: availableAmount: 500 → 495<br/>spentAmount: 0 → 5
        Reserve->>SellerBal: Credit 5 STARS
        SellerBal->>SellerBal: balance: 0 → 5
        SellerBal->>History: Log: +5 (Task Reward)

        note over Reserve,SellerBal: Tasks #2-#50 (245 STARS)
        Reserve->>Reserve: Deduct 245 STARS
        Reserve->>Reserve: availableAmount: 495 → 250<br/>spentAmount: 5 → 250
        Reserve->>SellerBal: Credit 245 STARS
        SellerBal->>SellerBal: balance: 5 → 250
        SellerBal->>History: Log: +245 (Task Rewards)

        note over Reserve,SellerBal: Locked: 250 available, 250 spent<br/>Seller: 250 STARS earned
    end

    rect rgb(255, 230, 230)
        note right of Reserve: STAGE 3: SETTLE (Order Cancelled)
        Reserve->>Reserve: Order Cancelled at 50/100<br/>Calculate refund: 250 STARS
        Reserve->>BuyerBal: Refund 250 STARS
        BuyerBal->>BuyerBal: balance: 500 → 750
        Reserve->>Reserve: availableAmount: 250 → 0<br/>refundedAmount: 0 → 250<br/>isSettled: true
        BuyerBal->>History: Log: +250 (Refund)
        note over Reserve: Formula: 500 = 250 (spent) + 0 (avail) + 250 (refund) ✅
    end

    rect rgb(245, 220, 255)
        note right of BuyerBal: STAGE 4: WITHDRAW (Cash Out)

        note over BuyerBal,BuyerExt: Buyer Withdraws
        BuyerBal->>BuyerBal: Check balance >= 700
        BuyerBal->>BuyerExt: Withdraw 700 STARS
        BuyerBal->>BuyerBal: balance: 750 → 50
        BuyerBal->>History: Log: -700 (Withdrawal)
        BuyerExt-->>External: Process to Crypto Bot

        note over SellerBal,SellerExt: Seller Withdraws
        SellerBal->>SellerBal: Check balance >= 250
        SellerBal->>SellerExt: Withdraw 250 STARS
        SellerBal->>SellerBal: balance: 250 → 0
        SellerBal->>History: Log: -250 (Withdrawal)
        SellerExt-->>External: Process to Crypto Bot
    end

    rect rgb(240, 240, 240)
        note over BuyerBal,SellerBal: FINAL STATE
        note over BuyerBal: Buyer: 50 STARS remaining
        note over SellerBal: Seller: 0 STARS (withdrawn)
        note over History: All transactions logged<br/>Full audit trail maintained
    end
```

### Money Flow Summary

| Stage | From | To | Amount | Balance Changes |
|-------|------|-----|--------|----------------|
| **0. Deposit** | External | Buyer UserBalance | +1000 STARS | Buyer: 0 → 1000 |
| **1. Lock** | Buyer UserBalance | TrafficOrderBalance | 500 STARS | Buyer: 1000 → 500<br/>Reserve: 0 → 500 (locked) |
| **2. Spend** | TrafficOrderBalance | Seller UserBalance | 250 STARS | Reserve: 500 → 250 (available)<br/>Seller: 0 → 250 |
| **3. Refund** | TrafficOrderBalance | Buyer UserBalance | 250 STARS | Reserve: 250 → 0 (settled)<br/>Buyer: 500 → 750 |
| **4. Withdraw** | Buyer UserBalance | External | 700 STARS | Buyer: 750 → 50 |
| **4. Withdraw** | Seller UserBalance | External | 250 STARS | Seller: 250 → 0 |

### Key Guarantees

1. **Atomic Transactions**: All balance updates wrapped in database transactions
2. **Pessimistic Locking**: TrafficOrderBalance locked during spend operations
3. **Balance Invariant**: `lockedAmount = spentAmount + availableAmount + refundedAmount`
4. **Audit Trail**: Every transaction logged in UserBalanceHistory
5. **No Negative Balances**: All deductions validate sufficient funds first

## 2. Complete Flow with All Entities

This diagram shows all entities and their interactions in the money flow.

```mermaid
graph TB
    subgraph "External World"
        CB[💳 Crypto Bot<br/>External Payment Gateway]
    end

    subgraph "User Balances"
        BuyerBal[💰 Buyer UserBalance<br/>Available Funds]
        SellerBal[💰 Seller UserBalance<br/>Earnings]
    end

    subgraph "Order System"
        Order[📋 TrafficOrder<br/>Order Details]
        Reserve[🔒 TrafficOrderBalance<br/>Locked Funds]
    end

    subgraph "Traffic System"
        Source[📱 TrafficSource<br/>Seller's Bot]
        Target[🎯 TrafficTarget<br/>Buyer's Channel]
        Actions[✅ TrafficActions<br/>Completed Tasks]
        Users[🤖 Bot Users<br/>Task Performers]
    end

    subgraph "Audit System"
        History[📊 UserBalanceHistory<br/>Transaction Log]
    end

    subgraph "Currency System"
        Currency[💱 CurrencyEntity<br/>STARS / TON / USDT]
    end

    %% Deposit Flow
    CB -->|"① Deposit<br/>+1000 STARS"| BuyerBal

    %% Lock Flow
    BuyerBal -->|"② Lock Funds<br/>-500 STARS"| Reserve
    Order -.manages.-> Reserve
    Reserve -.stored in.-> Currency

    %% Order Configuration
    Order -.connects.-> Source
    Order -.promotes.-> Target
    Source -.has.-> Users

    %% Spend Flow
    Users -->|"③ Complete Tasks"| Actions
    Actions -.records.-> Order
    Reserve -->|"④ Pay per Task<br/>5 STARS × 50"| SellerBal

    %% Refund Flow
    Reserve -->|"⑤ Refund Unused<br/>+250 STARS"| BuyerBal

    %% Withdraw Flow
    BuyerBal -->|"⑥ Withdraw<br/>-700 STARS"| CB
    SellerBal -->|"⑥ Withdraw<br/>-250 STARS"| CB

    %% Audit Trail
    BuyerBal -.logs all changes.-> History
    SellerBal -.logs all changes.-> History
    Reserve -.logs all changes.-> History

    style CB fill:#e1f5ff,stroke:#0288d1,stroke-width:3px
    style Reserve fill:#fff9c4,stroke:#f57f17,stroke-width:4px
    style BuyerBal fill:#c8e6c9,stroke:#388e3c,stroke-width:2px
    style SellerBal fill:#c8e6c9,stroke:#388e3c,stroke-width:2px
    style History fill:#f3e5f5,stroke:#7b1fa2,stroke-width:2px
    style Order fill:#bbdefb,stroke:#1976d2,stroke-width:2px
```

### Flow Stages Explained

#### Stage 0: Deposit (External → UserBalance)
```
User deposits STARS via Crypto Bot payment gateway
→ UserBalance.balance increases
→ UserBalanceHistory records deposit
```

#### Stage 1: Lock (UserBalance → TrafficOrderBalance)
```
Buyer creates order with 500 STARS budget
→ UserBalance.balance decreases by 500
→ TrafficOrderBalance.lockedAmount = 500
→ TrafficOrderBalance.availableAmount = 500
→ UserBalanceHistory records lock transaction
```

#### Stage 2: Spend (TrafficOrderBalance → Seller UserBalance)
```
For each completed task (50 tasks × 5 STARS):
→ TrafficOrderBalance.availableAmount decreases by 5
→ TrafficOrderBalance.spentAmount increases by 5
→ Seller UserBalance.balance increases by 5
→ UserBalanceHistory records reward
→ TrafficActions records completion
```

#### Stage 3: Settle (TrafficOrderBalance → Buyer UserBalance)
```
Order cancelled after 50/100 tasks:
→ Remaining 250 STARS refunded to buyer
→ TrafficOrderBalance.availableAmount → 0
→ TrafficOrderBalance.refundedAmount = 250
→ TrafficOrderBalance.isSettled = true
→ Buyer UserBalance.balance increases by 250
→ UserBalanceHistory records refund
```

#### Stage 4: Withdraw (UserBalance → External)
```
Users withdraw their balances:
→ UserBalance.balance decreases
→ Crypto Bot processes payout
→ UserBalanceHistory records withdrawal
```

## 3. Entity Relationship Diagram (ERD)

```mermaid
erDiagram
    UserEntity ||--o{ UserBalance : has
    UserEntity ||--o{ UserBalanceHistory : has
    UserEntity ||--o{ TrafficSource : manages
    UserEntity ||--o{ TrafficOrder : creates

    CurrencyEntity ||--o{ UserBalance : "currency type"
    CurrencyEntity ||--o{ TrafficOrderBalance : "currency type"

    TrafficSource ||--o{ TrafficOrder : "provides traffic"
    TrafficSource ||--o{ TrafficUser : "has subscribers"

    TrafficTarget ||--o{ TrafficOrder : "receives traffic"

    TrafficOrder ||--|| TrafficOrderBalance : "has locked funds"
    TrafficOrder ||--o{ TrafficActions : "has completions"

    TrafficUser ||--o{ TrafficActions : "completes tasks"

    UserEntity {
        uuid id PK
        bigint telegramId UK
        string username
        string firstName
        string lastName
    }

    UserBalance {
        uuid id PK
        uuid userId FK
        uuid currencyId FK
        decimal balance
        decimal lockedBalance
    }

    UserBalanceHistory {
        uuid id PK
        uuid userId FK
        string currency
        string type
        decimal amount
        decimal balanceBefore
        decimal balanceAfter
        string referenceId
        timestamp createdAt
    }

    TrafficSource {
        uuid id PK
        uuid managedBy FK
        string botToken
        string botUsername
        boolean isActive
    }

    TrafficTarget {
        uuid id PK
        string targetUrl
        string name
        string username
    }

    TrafficOrder {
        uuid id PK
        string orderId UK
        uuid creatorId FK
        uuid trafficSourceId FK
        uuid trafficTargetId FK
        string type
        string status
        int targetCount
        int currentCount
        decimal pricePerAction
        decimal totalBudget
        decimal spentAmount
    }

    TrafficOrderBalance {
        uuid id PK
        uuid trafficOrderId FK
        uuid currencyId FK
        decimal lockedAmount
        decimal spentAmount
        decimal availableAmount
        decimal refundedAmount
        boolean isSettled
        timestamp settledAt
    }

    TrafficActions {
        uuid id PK
        string actionId UK
        uuid trafficOrderId FK
        uuid trafficSourceId FK
        string type
        string status
        decimal reward
        timestamp completedAt
    }

    TrafficUser {
        uuid id PK
        bigint telegramId
        string username
        uuid trafficSourceId FK
        decimal totalEarnings
        int totalOrdersParticipated
    }

    CurrencyEntity {
        uuid id PK
        string code UK
        string name
        string symbol
    }
```

## 4. Money Flow - Individual Stage Diagrams

### Stage 1: Order Creation (Lock Funds)

```mermaid
sequenceDiagram
    participant Buyer as 👤 Buyer<br/>(Channel Owner)
    participant API as 🔌 API
    participant UserBal as 💰 UserBalance
    participant Order as 📋 TrafficOrder
    participant Reserve as 🔒 TrafficOrderBalance
    participant History as 📊 UserBalanceHistory

    Buyer->>API: POST /orders/create<br/>{targetCount: 100, price: 5}

    API->>UserBal: Check balance >= 500 STARS
    UserBal-->>API: ✅ Balance: 1000 STARS

    API->>API: Start Transaction

    API->>UserBal: Deduct 500 STARS
    UserBal-->>UserBal: balance: 1000 → 500

    API->>Order: Create TrafficOrder
    Order-->>Order: status: Pending<br/>totalBudget: 500

    API->>Reserve: Lock Funds
    Reserve-->>Reserve: lockedAmount: 500<br/>availableAmount: 500

    API->>History: Log Transaction
    History-->>History: type: Withdrawal<br/>amount: -500<br/>balanceBefore: 1000<br/>balanceAfter: 500

    API->>API: Commit Transaction

    API-->>Buyer: ✅ Order Created<br/>orderId: ORDER-123

    Note over UserBal,Reserve: Buyer: 500 STARS (free)<br/>Order: 500 STARS (locked)
```

### Stage 2: Task Completion (Pay Seller)

```mermaid
sequenceDiagram
    participant BotUser as 🤖 Bot User
    participant SellerBot as 📱 Seller's Bot
    participant API as 🔌 Public API
    participant Reserve as 🔒 TrafficOrderBalance
    participant SellerBal as 💰 Seller Balance
    participant Action as ✅ TrafficActions
    participant Order as 📋 TrafficOrder
    participant History as 📊 Balance History

    BotUser->>SellerBot: Subscribe to channel
    SellerBot->>BotUser: Task completed!

    SellerBot->>API: POST /source/tasks/complete<br/>{apiKey, taskId, userId}

    API->>API: Validate API Key
    API->>API: Parse taskId → orderId

    API->>Order: Find Order
    Order-->>API: ✅ Status: Active

    API->>Action: Check Duplicate
    Action-->>API: ✅ Not Completed

    API->>API: Start Transaction

    API->>Reserve: 🔒 Lock (pessimistic)
    Reserve-->>API: ✅ Locked

    API->>Reserve: Validate Funds >= 5
    Reserve-->>API: ✅ Available: 500 STARS

    API->>Reserve: Deduct 5 STARS
    Reserve-->>Reserve: availableAmount: 500 → 495<br/>spentAmount: 0 → 5

    API->>SellerBal: Credit 5 STARS
    SellerBal-->>SellerBal: balance: 0 → 5

    API->>History: Log Seller Credit
    History-->>History: type: Reward<br/>amount: +5

    API->>Order: Update Progress
    Order-->>Order: currentCount: 0 → 1<br/>spentAmount: 0 → 5

    API->>Action: Create Action
    Action-->>Action: status: Completed<br/>reward: 5

    API->>API: Commit Transaction

    API-->>SellerBot: ✅ Success<br/>reward: 5 STARS
    SellerBot-->>BotUser: You earned 5 STARS!

    Note over Reserve,SellerBal: Locked: 495 STARS<br/>Seller: 5 STARS
```

### Stage 3: Order Settlement (Refund)

```mermaid
sequenceDiagram
    participant Admin as 👨‍💼 Admin/System
    participant Order as 📋 TrafficOrder
    participant Reserve as 🔒 TrafficOrderBalance
    participant BuyerBal as 💰 Buyer Balance
    participant History as 📊 Balance History

    Admin->>Order: Cancel Order
    Order-->>Order: status: Active → Cancelled<br/>currentCount: 50/100

    Admin->>Reserve: Check Remaining
    Reserve-->>Admin: availableAmount: 250 STARS<br/>spentAmount: 250 STARS

    Admin->>Admin: Start Transaction

    Admin->>Reserve: Calculate Refund
    Reserve-->>Admin: refundAmount: 250 STARS

    Admin->>Reserve: Update Settlement
    Reserve-->>Reserve: availableAmount: 250 → 0<br/>refundedAmount: 0 → 250<br/>isSettled: true

    Admin->>BuyerBal: Credit Refund
    BuyerBal-->>BuyerBal: balance: 500 → 750

    Admin->>History: Log Refund
    History-->>History: type: Deposit<br/>amount: +250<br/>description: Order refund

    Admin->>Admin: Commit Transaction

    Admin-->>Admin: ✅ Settlement Complete

    Note over Reserve,BuyerBal: Formula Check:<br/>500 = 250 (spent) + 0 (avail) + 250 (refund) ✅
```

## 5. Component Architecture

```mermaid
graph TB
    subgraph "Client Layer"
        BuyerUI[👤 Buyer Dashboard]
        SellerBot[📱 Seller's Telegram Bot]
    end

    subgraph "API Layer"
        PrivateAPI[🔐 Private API<br/>JWT Auth]
        PublicAPI[🌐 Public API<br/>API Key Auth]
    end

    subgraph "Service Layer"
        TrafficSvc[TrafficService]
        SourceSvc[SourcePublicApiService]
        ManageSvc[SourceManagementService]
        BalanceSvc[BalanceService]
    end

    subgraph "Repository Layer"
        OrderRepo[TrafficOrderRepository]
        ReserveRepo[TrafficOrderBalanceRepository]
        BalanceRepo[UserBalanceRepository]
        HistoryRepo[UserBalanceHistoryRepository]
        SourceRepo[TrafficSourceRepository]
    end

    subgraph "Database Layer"
        DB[(PostgreSQL)]
    end

    subgraph "External Services"
        Telegram[Telegram Bot API]
        BotFactory[BotFactoryService]
    end

    BuyerUI --> PrivateAPI
    SellerBot --> PublicAPI

    PrivateAPI --> TrafficSvc
    PrivateAPI --> ManageSvc
    PublicAPI --> SourceSvc

    TrafficSvc --> OrderRepo
    TrafficSvc --> ReserveRepo
    SourceSvc --> SourceRepo
    SourceSvc --> ReserveRepo
    SourceSvc --> BalanceRepo
    SourceSvc --> HistoryRepo
    ManageSvc --> SourceRepo

    SourceSvc --> BotFactory
    BotFactory --> Telegram

    OrderRepo --> DB
    ReserveRepo --> DB
    BalanceRepo --> DB
    HistoryRepo --> DB
    SourceRepo --> DB

    style ReserveRepo fill:#ff9,stroke:#f66,stroke-width:3px
    style SourceSvc fill:#9f9,stroke:#6f6,stroke-width:3px
```

## 6. State Machine - TrafficOrder

```mermaid
stateDiagram-v2
    [*] --> Pending: Create Order<br/>Lock Funds

    Pending --> Active: Approve Order

    Active --> InProgress: First Task<br/>Completed

    InProgress --> InProgress: More Tasks<br/>Completed

    InProgress --> Completed: All Tasks Done<br/>Settle Balance

    InProgress --> Cancelled: Cancel Order<br/>Refund Remaining

    Active --> Cancelled: Cancel Order<br/>Refund All

    Pending --> Cancelled: Reject Order<br/>Refund All

    InProgress --> Failed: Payment Error<br/>Investigation

    Completed --> [*]
    Cancelled --> [*]
    Failed --> [*]

    note right of Pending
        TrafficOrderBalance:
        - lockedAmount: SET
        - availableAmount: SET
        - spentAmount: 0
    end note

    note right of InProgress
        TrafficOrderBalance:
        - spentAmount: INCREASING
        - availableAmount: DECREASING
    end note

    note right of Completed
        TrafficOrderBalance:
        - availableAmount: 0
        - isSettled: true
    end note

    note right of Cancelled
        TrafficOrderBalance:
        - refundedAmount: SET
        - isSettled: true
    end note
```

## 7. State Machine - TrafficOrderBalance

```mermaid
stateDiagram-v2
    [*] --> Created: Lock Funds<br/>from UserBalance

    Created --> Active: Order Approved

    Active --> Spending: Task Completed<br/>Deduct + Credit Seller

    Spending --> Spending: More Tasks<br/>Completed

    Spending --> FullySpent: All Funds Used<br/>availableAmount = 0

    Spending --> PartiallySpent: Order Cancelled<br/>availableAmount > 0

    FullySpent --> Settled: Mark Settled<br/>No Refund

    PartiallySpent --> Settled: Refund to Buyer<br/>Mark Settled

    Settled --> [*]

    note right of Created
        lockedAmount: 500
        availableAmount: 500
        spentAmount: 0
        refundedAmount: 0
        isSettled: false
    end note

    note right of Spending
        Example (50 tasks):
        availableAmount: 250
        spentAmount: 250
    end note

    note right of FullySpent
        lockedAmount: 500
        spentAmount: 500
        availableAmount: 0
        refundedAmount: 0
    end note

    note right of PartiallySpent
        lockedAmount: 500
        spentAmount: 250
        availableAmount: 0
        refundedAmount: 250
    end note
```

## 8. Data Flow - Complete Task

```mermaid
flowchart TD
    Start([🤖 Bot User Completes Task]) --> ValidateKey{Validate<br/>API Key}

    ValidateKey -->|Invalid| Error1[❌ Return Error:<br/>Invalid API Key]
    ValidateKey -->|Valid ✅| ParseTask[Parse taskId<br/>Extract orderId + userId]

    ParseTask --> FindOrder{Find<br/>TrafficOrder}
    FindOrder -->|Not Found| Error2[❌ Return Error:<br/>Task Not Found]
    FindOrder -->|Found ✅| CheckStatus{Order<br/>Active?}

    CheckStatus -->|No| Error3[❌ Return Error:<br/>Order Not Active]
    CheckStatus -->|Yes ✅| CheckDupe{Already<br/>Completed?}

    CheckDupe -->|Yes| Error4[❌ Return Error:<br/>Already Completed]
    CheckDupe -->|No ✅| StartTx[🔄 Start Transaction]

    StartTx --> LockReserve[🔒 Lock Reserve<br/>Pessimistic Write]

    LockReserve --> ValidateFunds{Sufficient<br/>Locked Funds?}
    ValidateFunds -->|No| Error5[❌ Rollback:<br/>Insufficient Balance]
    ValidateFunds -->|Yes ✅| DeductLocked[Deduct from<br/>TrafficOrderBalance]

    DeductLocked --> CreditSeller[Credit Seller<br/>UserBalance]

    CreditSeller --> LogHistory[Log Transaction<br/>UserBalanceHistory]

    LogHistory --> UpdateOrder[Update Order<br/>currentCount++]

    UpdateOrder --> CreateAction[Create<br/>TrafficActions]

    CreateAction --> UpdateUser[Update TrafficUser<br/>totalEarnings]

    UpdateUser --> Commit[✅ Commit Transaction]

    Commit --> Success([✅ Return Success<br/>reward: 5 STARS])

    Error1 --> End([End])
    Error2 --> End
    Error3 --> End
    Error4 --> End
    Error5 --> End
    Success --> End

    style StartTx fill:#9f9,stroke:#6f6,stroke-width:2px
    style LockReserve fill:#ff9,stroke:#f66,stroke-width:3px
    style Commit fill:#9f9,stroke:#6f6,stroke-width:2px
    style Success fill:#9f9,stroke:#6f6,stroke-width:2px
```

## 9. Balance Formula Visualization

```mermaid
graph LR
    subgraph "TrafficOrderBalance Formula"
        Locked[lockedAmount<br/>500 STARS]

        Locked -.equals.-> Sum{=}

        Spent[spentAmount<br/>250 STARS] --> Sum
        Available[availableAmount<br/>0 STARS] --> Sum
        Refunded[refundedAmount<br/>250 STARS] --> Sum

        Sum --> Valid{Valid?}
        Valid -->|500 = 250+0+250 ✅| Success[✅ Balanced]
        Valid -->|❌ Mismatch| Error[❌ Data Corruption!]
    end

    style Locked fill:#ff9,stroke:#f90,stroke-width:3px
    style Success fill:#9f9,stroke:#6f6,stroke-width:2px
    style Error fill:#f99,stroke:#f66,stroke-width:3px
```

## 10. Actor Interaction Overview

```mermaid
graph TB
    subgraph "Buyer Side"
        Buyer[👤 Buyer<br/>Channel Owner]
        BuyerBal[💰 UserBalance<br/>Available Funds]
        Target[🎯 TrafficTarget<br/>Channel to Promote]
    end

    subgraph "Order Management"
        Order[📋 TrafficOrder<br/>100 tasks × 5 STARS]
        Reserve[🔒 TrafficOrderBalance<br/>500 STARS Locked]
    end

    subgraph "Seller Side"
        Seller[👨‍💼 Seller<br/>Bot Owner]
        Source[📱 TrafficSource<br/>Bot with Users]
        BotUsers[🤖🤖🤖 Bot Users<br/>Task Performers]
        SellerBal[💰 UserBalance<br/>Earnings]
    end

    Buyer -->|creates| Order
    Buyer -->|owns| Target
    Buyer -->|has| BuyerBal

    BuyerBal -.500 STARS.->|locks| Reserve

    Order -->|locks funds in| Reserve
    Order -->|connects to| Source
    Order -->|promotes| Target

    Seller -->|manages| Source
    Seller -->|has| SellerBal

    Source -->|has| BotUsers

    BotUsers -.complete tasks.-> Order

    Reserve -.pays.-> SellerBal
    Reserve -.refunds.-> BuyerBal

    style Reserve fill:#ff9,stroke:#f90,stroke-width:4px
    style Order fill:#9cf,stroke:#69f,stroke-width:2px
```

## How to View These Diagrams

### In GitHub
Just view this file on GitHub - Mermaid diagrams render automatically!

### In VS Code
1. Install extension: "Markdown Preview Mermaid Support"
2. Open this file
3. Press `Ctrl+Shift+V` (Windows/Linux) or `Cmd+Shift+V` (Mac)

### Online Viewers
- **Mermaid Live Editor**: https://mermaid.live/
- Copy any diagram code and paste to visualize

### In Documentation Sites
These diagrams work in:
- GitBook
- Docusaurus
- VuePress
- MkDocs (with plugin)
- Notion
- Confluence

## Export Options

You can export these diagrams as:
- **PNG/SVG**: Use Mermaid Live Editor
- **PDF**: Print from browser preview
- **Presentations**: Many tools support Mermaid (Slidev, Marp, reveal.js)
