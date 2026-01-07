<!--
TEMPLATE MAP (reference-only)
.claude/templates/docs/07-task-catalog.md

OUTPUT MAP (write to)
docs/07-task-catalog.md

NOTES
- This is the SOURCE OF TRUTH for the "Worker Agent".
- It acts as both a Catalog and a Kanban Board.
- Tasks must be small, actionable, and testable.
-->

# 02 Task Catalog (Kanban)

## Status Legend
- `[ ]` **Pending**: Ready to be picked up.
- `[-]` **In Progress**: Currently being executed by a Worker.
- `[x]` **Completed**: Tested, Verified, and Merged.

## 1. Backlog (Pending)
> Tasks ready to be pulled. Sorted by Priority.

- [ ] **TASK-101**: [Setup] Initialize Project Skeleton
  - **Priority**: P0 (Blocker)
  - **Dependencies**: None
  - **Boundary**: Root config files (`package.json`, `tsconfig.json`)
  - **DoD**: CI pipeline passes `hello world` test.

- [ ] **TASK-102**: [Auth] Implement Register API
  - **Priority**: P1
  - **Dependencies**: TASK-101
  - **Boundary**: `src/modules/auth/register.ts`
  - **DoD**: Unit tests pass, Swagger docs generated.

## 2. In Progress (Active)
> Currently being executed. LOCKED by a Worker.

*(Empty initially)*

## 3. Review / QA (Verification)
> Implemented but waiting for final check.

*(Empty initially)*

## 4. Done (Closed)
> Merged and verified.

*(Empty initially)*
