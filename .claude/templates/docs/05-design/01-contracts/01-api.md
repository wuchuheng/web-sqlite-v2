<!--
TEMPLATE MAP (reference-only)
.claude/templates/docs/05-design/01-contracts/01-api.md

OUTPUT MAP (write to)
docs/05-design/01-contracts/01-api.md

NOTES
- Keep headings unchanged.
- Group Endpoints by MODULE to allow parallel ownership.
-->

# 01 API Contract

## 1) Standards
- Protocol: REST / GraphQL / gRPC
- Auth Header: `Authorization: Bearer <token>`
- Content-Type: `application/json`

## 2) Endpoints (by Module)

### Module: User
#### GET /users/me
- **Summary**: Get current user profile
- **Response (200)**:
  ```json
  { "id": "123", "email": "alice@example.com" }
  ```

### Module: <Name>
#### <METHOD> <PATH>
- **Summary**:
- **Params**:
- **Response**:
  ```json
  {}
  ```
- **Errors**:

## 3) Error Codes
| Code | Message | Meaning |
|------|---------|---------|
| ERR_01 | Invalid Input | ... |
