<!--
TEMPLATE MAP (reference-only)
.claude/templates/docs/05-design/01-contracts/03-errors.md

OUTPUT MAP (write to)
docs/05-design/01-contracts/03-errors.md

NOTES
- Keep headings unchanged.
- Define global error codes and handling strategy.
-->

# 03 Error Standards

## 1) Error Format
- **Structure**: RFC 7807 Problem Details / Custom
- **Example**:
  ```json
  {
    "code": "INVALID_INPUT",
    "message": "The email format is incorrect.",
    "details": [
      { "field": "email", "issue": "Must be valid format" }
    ]
  }
  ```

## 2) HTTP Mapping
- 400 Bad Request: Validation errors.
- 401 Unauthorized: Missing/Invalid token.
- 403 Forbidden: Valid token, insufficient permissions.
- 404 Not Found: Resource missing.
- 500 Internal Error: Server bug.

## 3) Global Error Codes

| Code | Status | Description | Action |
|------|--------|-------------|--------|
| `SYS_INTERNAL` | 500 | Unexpected server error | Retry later |
| `AUTH_INVALID` | 401 | Invalid or expired token | Re-login |
| `PERM_DENIED` | 403 | Insufficient scope | Request access |
| `RES_NOT_FOUND` | 404 | Resource does not exist | Check ID |
| `VAL_FAILED` | 400 | Validation failed | Fix input |

## 4) Domain Errors

### User Module
- `USER_EXISTS`: Email already registered.
- `USER_LOCKED`: Account temporarily locked.

### Order Module
- `ORDER_EXPIRED`: Payment time window passed.
