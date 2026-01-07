<!--
TEMPLATE MAP (reference-only)
.claude/templates/docs/06-implementation/02-test-plan.md

OUTPUT MAP (write to)
docs/06-implementation/02-test-plan.md

NOTES
- Define testing pyramid and tools.
-->

# 02 Test Plan

## 1) Strategy (The Pyramid)
- **Unit Tests (70%)**: Test individual Use Cases / Functions. Mock all DB/API calls.
- **Integration Tests (20%)**: Test Repository <-> DB, or API Handler <-> Service.
- **E2E Tests (10%)**: Test full flows (Register -> Login -> Buy) using a real/test DB.

## 2) Tools
- **Runner**: Jest / Vitest / Go Test / Pytest
- **Mocking**: Jest Mocks / Gomock
- **E2E**: Playwright / Cypress / K6 (Load)

## 3) Naming & Location
- Unit: `src/modules/user/use-cases/register-user.spec.ts` (Next to source)
- Integration: `tests/integration/user-repo.test.ts`
- E2E: `tests/e2e/auth-flow.spec.ts`

## 4) Requirements
- **Coverage Goal**: 80% Line Coverage.
- **CI Gate**: Tests MUST pass before merge.
