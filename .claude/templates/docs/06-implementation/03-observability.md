<!--
TEMPLATE MAP (reference-only)
.claude/templates/docs/06-implementation/03-observability.md

OUTPUT MAP (write to)
docs/06-implementation/03-observability.md

NOTES
- Define logging, metrics, and tracing.
-->

# 03 Observability

## 1) Logging
- **Format**: JSON (Production), Text (Local)
- **Levels**: DEBUG, INFO, WARN, ERROR
- **Context**: MUST include `trace_id`, `user_id`, `module`.

### Example
```json
{
  "level": "info",
  "timestamp": "2023-10-01T12:00:00Z",
  "message": "User registered",
  "context": {
    "user_id": "u_123",
    "trace_id": "abc-999"
  }
}
```

## 2) Metrics (Prometheus/StatsD)
- `http_request_duration_seconds` (Histogram)
- `http_requests_total` (Counter, labels: status, method, path)
- `db_pool_connections` (Gauge)

## 3) Tracing (OpenTelemetry)
- Propagate `traceparent` header across services.
- Trace critical flows: Checkout, Login.
