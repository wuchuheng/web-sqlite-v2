# Task Micro-Spec: <Task ID>

## Metadata
- **Task ID**: TASK-XXX
- **Title**: <Task Title>
- **Status**: DRAFT / APPROVED / IMPLEMENTED / ARCHIVED
- **Assignee**: <Worker Agent Name>
- **Related Files**: `src/path/to/related/file.ts`

## 1. Context Analysis
> Briefly describe the goal. Link to parent Spec or Design.
- **Goal**: Implement...
- **Inputs**:
    - Design: `docs/05-design/...`
    - Catalog: `docs/07-task-catalog.md`

## 2. Implementation Plan (The "How")
> Step-by-step technical plan. **Do NOT write code yet.**

### 2.1 File Changes
- **Modify**: `src/path/to/existing.ts`
    - Add function `funcName()`.
    - Update interface `InterfaceName`.
- **Create**: `src/path/to/new.ts`
    - Class `ClassName`.
- **Delete**: (If any)

### 2.2 Logic / Pseudo-Code
```typescript
// Describe the core logic flow
function processPayment() {
  if (balance < amount) throw Error;
  api.charge();
  db.update();
}
```

### 2.3 Dependencies
- **Internal**: `AuthService`, `DatabaseModule`
- **External**: `npm:stripe`, `npm:lodash` (Verify if installed!)

## 3. Verification Plan
> How will we prove it works?

### 3.1 Automated Tests
- **Unit Test**: `tests/unit/path/to/test.ts`
    - Case 1: Success flow.
    - Case 2: Error handling.
- **Integration Test**: `tests/integration/...`

### 3.2 Manual Verification
- Run command: `npm run start`
- Action: Call API `POST /api/v1/resource`
- Expected Output: `200 OK`

## 4. Risks & Constraints
- [ ] Database migration required?
- [ ] Breaking API change?
- [ ] Security impact?
