<!--
TEMPLATE MAP (reference-only)
.claude/templates/docs/06-implementation/01-build-and-run.md

OUTPUT MAP (write to)
docs/06-implementation/01-build-and-run.md

NOTES
- Define how to set up, build, and run the app.
- CRITICAL: Define Coding Conventions and Workflow.
-->

# 01 Build & Run Guide

## 1) Prerequisites
- **Runtime**: Node.js v18+ / Go 1.21+ / Python 3.10+
- **Docker**: v24+ (for DB/Redis)
- **Tools**: Make / pnpm / poetry

## 2) Quick Start
```bash
# 1. Install dependencies
pnpm install

# 2. Start Infrastructure
docker-compose up -d postgres redis

# 3. Run Migrations
pnpm migrate:up

# 4. Start Dev Server
pnpm dev
```

## 3) Development Workflow (The Loop)
Every feature implementation MUST follow this iterative cycle:

1.  **Phase 1: Code (Implement)**
    - Implement the logic based on Stage 5 design.
    - Follow the "Three-Phase Pattern" (`// 1. Input`, `// 2. Process`, `// 3. Output`).
    - Adhere to the Functional Programming preference.

2.  **Phase 2: Test (Verify)**
    - Run unit tests immediately after coding.
    - If tests fail, go back to Phase 1.
    - **MANDATORY**: No code is considered "drafted" until tests pass.

3.  **Phase 3: Refactor (Polish)**
    - Once tests pass, analyze the code for quality.
    - **Triggers**: Function > 30 lines, Nesting > 3 levels, Parameters > 4.
    - **Action**: Extract shared logic, simplify complexity, ensure high readability.
    - **Verification**: Re-run tests after refactoring to ensure zero regression.

## 4) Coding Conventions (Universal Rules)

### 4.1 Core Principles (Readability First)
1. **Readability > Stability > Robustness**: Code is read many times, written once.
2. **Functional Programming Preference**:
   - Prefer pure functions over classes.
   - Use composition over inheritance.
   - Avoid side effects.

### 4.2 Code Quality & Standards
*   **Comments**:
    *   **WHY, not WHAT**: Explain the intent behind complex logic.
    *   **Public API**: JSDoc/GoDoc for all public functions.
*   **Naming**:
    *   **Variables**: Nouns (`userData`, `orderTotal`).
    *   **Functions**: Verbs (`getUser`, `calculateTotal`).

### 4.3 Git Commit Standards (MANDATORY)
*   **Format**: Conventional Commits (`type: subject`).
    *   `feat: add user login`
    *   `fix: resolve database connection timeout`
    *   `refactor: split user service`
    *   `docs: update readme`
    *   `test: add unit tests for auth`
*   **Prohibited**: Never add "AI generated" or "Assistant" watermarks in the commit message. The code belongs to the repo, not the tool.

### 4.4 Conflict Prevention (Vertical Slicing)
**Strategy: One File Per Use-Case**
Do NOT put all logic into a single `UserService` class. Split by feature.
`src/modules/user/use-cases/register-user.ts` (Parallel Safe).

### 4.5 Complexity Limits
- **Function Size**: Max 30 lines.
- **Nesting**: Max 3 levels.
- **Params**: Max 4 (use object if more).

## 5) Build Commands
- `pnpm build`: Compile for production.
- `pnpm lint`: Check style.
- `pnpm format`: Fix style.
