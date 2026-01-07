<!--
TEMPLATE MAP (reference-only)
.claude/templates/docs/03-architecture/02-dataflow.md

OUTPUT MAP (write to)
docs/03-architecture/02-dataflow.md

NOTES
- Keep headings unchanged.
- Include UNHAPPY PATHS (errors) and CONCURRENCY controls.
-->

# 02 Data Flow & Sequences

## 1) Critical Business Flows

### Flow 1: <Name> (Happy Path + Error)
**Goal**: ...
**Concurrency**: (Optimistic Locking? Idempotency keys?)

```mermaid
sequenceDiagram
    actor User
    participant API
    participant DB
    
    User->>API: Request
    alt Valid Request
        API->>DB: Write (Tx)
        DB-->>API: Success
        API-->>User: 200 OK
    else DB Lock Error
        DB-->>API: Failure
        API-->>User: 409 Conflict (Retryable)
    end
```

### Flow 2: <Name>
```mermaid
sequenceDiagram
    %% Add sequence logic here
    User->>System: Action
    System-->>User: Result
```

## 2) Asynchronous Event Flows
**Pattern**: (e.g., Outbox pattern? At-least-once delivery?)

- **Event**: `OrderCreated`
- **Producer**: `OrderService`
- **Consumers**: `InventoryService`, `EmailService`

```mermaid
flowchart LR
    Order[Order Service] -->|1. Tx Commit| DB[(DB)]
    Order -->|2. Publish| Bus((Event Bus))
    Bus -->|3. Consume| Inv[Inventory Service]
    Inv -->|4. Update Stock| InvDB[(Inv DB)]
```

## 3) Entity State Machines
### Entity: <Name> (e.g., Order / Payment)
```mermaid
stateDiagram-v2
    [*] --> Pending
    Pending --> Success : Pay OK
    Pending --> Failed : Pay Error
    Success --> [*]
```

## 4) Consistency & Recovery
- **Distributed Transactions**: (Saga / TCC / None?)
- **Idempotency**: (How do we handle duplicate events?)
- **Compensation**: (What happens if step 3 fails?)
