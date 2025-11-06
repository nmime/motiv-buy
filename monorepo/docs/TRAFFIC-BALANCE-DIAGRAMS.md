# Traffic & Balance System - Visual Diagrams

> These diagrams use Mermaid format and can be visualized in GitHub, VS Code, GitLab, and most modern documentation tools.

## 1. Entity Relationship Diagram (ERD)

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

## 2. Money Flow - Sequence Diagram

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

## 3. Component Architecture

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

## 4. State Machine - TrafficOrder

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

## 5. State Machine - TrafficOrderBalance

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

## 6. Data Flow - Complete Task

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

## 7. Balance Formula Visualization

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

## 8. Actor Interaction Overview

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
