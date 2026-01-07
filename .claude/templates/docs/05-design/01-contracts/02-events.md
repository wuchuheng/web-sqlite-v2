<!--
TEMPLATE MAP (reference-only)
.claude/templates/docs/05-design/01-contracts/02-events.md

OUTPUT MAP (write to)
docs/05-design/01-contracts/02-events.md

NOTES
- Keep headings unchanged.
- Use CloudEvents format or custom JSON structure.
-->

# 02 Events Contract

## 1) Message Format
- **Protocol**: Kafka / RabbitMQ / SNS / Webhook
- **Standard**: CloudEvents 1.0 / Custom JSON

### Envelope Structure
```json
{
  "id": "evt_123",
  "type": "domain.entity.action",
  "source": "service-name",
  "timestamp": "2023-10-01T12:00:00Z",
  "data": { ... }
}
```

## 2) Topics / Channels

### Topic: `user.events`
- **Description**: All user lifecycle events.
- **Partitions**: Keyed by `user_id`.

## 3) Event Definitions

### Event: `user.created`
- **Trigger**: New user registration.
- **Payload (`data`)**:
  ```json
  {
    "user_id": "u_123",
    "email": "alice@example.com"
  }
  ```

### Event: `order.placed`
- **Trigger**: Checkout completion.
- **Payload (`data`)**:
  ```json
  {
    "order_id": "o_999",
    "total": 100.50
  }
  ```
