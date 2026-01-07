<!--
TEMPLATE MAP (reference-only)
.claude/templates/docs/03-architecture/01-hld.md

OUTPUT MAP (write to)
docs/03-architecture/01-hld.md

NOTES
- Keep headings unchanged.
- Focus on STATIC STRUCTURE but include RATIONALE and STRATEGY.
-->

# 01 High-Level Design (HLD) — Structure

## 1) Architecture Style & Principles
- **Pattern**: (e.g., Modular Monolith / Microservices / Event-Driven / Hexagonal)
- **Key Principles**:
  - (e.g., API First)
  - (e.g., Stateless Compute)
  - (e.g., Async communication by default)

## 2) System Boundary (C4 Context)
- **Users**: Who interacts with the system?
- **External Systems**: What APIs/SaaS do we depend on?

```mermaid
C4Context
  title System Context Diagram
  Person(user, "User", "Uses the system")
  System(system, "Our System", "Core Domain Logic")
  System_Ext(stripe, "Payment Gateway", "Handles payments")
  Rel(user, system, "HTTPS")
  Rel(system, stripe, "HTTPS/REST")
```

## 3) Containers & Tech Stack (C4 Container)
- **Web App**: React/Next.js (Reason: ...)
- **API Gateway**: Nginx/Kong (Reason: ...)
- **Core Service**: Node/Go (Reason: ...)
- **Worker**: Python (Reason: ...)
- **Database**: Postgres (Reason: ...)

```mermaid
C4Container
  title Container Diagram
  Container(web, "Web Client", "React", "UI")
  Container(api, "API Service", "Go", "Business Logic")
  Container(worker, "Background Worker", "Go", "Async Tasks")
  ContainerDb(db, "Primary DB", "Postgres", "Relational Data")
  ContainerQueue(mq, "Message Queue", "Redis/RabbitMQ", "Events")
  
  Rel(web, api, "REST/JSON")
  Rel(api, db, "SQL")
  Rel(api, mq, "Publishes events")
  Rel(worker, mq, "Consumes events")
```

## 4) Data Architecture Strategy
- **Ownership**: (Which module owns which data?)
- **Caching**: (Strategy: Write-through / TTL? Tech: Redis?)
- **Consistency**: (Strong vs Eventual?)

## 5) Cross-cutting Concerns (Implementation View)
### 5.1 Authentication & Authorization
- **AuthN**: (e.g., JWT via Gateway)
- **AuthZ**: (e.g., RBAC in Service layer)

### 5.2 Observability
- **Logs**: (Structured JSON -> ELK/Datadog)
- **Metrics**: (Prometheus endpoint)
- **Tracing**: (OpenTelemetry context propagation)

### 5.3 Error Handling
- **Global Strategy**: (Standard error response format, retry policies)

## 6) Code Structure Strategy (High-Level File Tree)
**Repo Structure**: (Monorepo vs Polyrepo?)

```text
/ (root)
  /apps
    /api-server      # Core API
    /web-client      # Frontend
  /libs
    /shared-utils    # Common logging, auth
  /deploy            # K8s manifests / Terraform
  /docs              # Architecture docs
```

**Module Pattern**: (e.g., Hexagonal / Layered?)
```text
/src
  /domain            # Entities & Logic
  /application       # Use Cases
  /infrastructure    # DB adapters, API clients
  /interfaces        # HTTP handlers
```
