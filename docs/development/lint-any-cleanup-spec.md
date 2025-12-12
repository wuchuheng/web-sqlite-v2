# Lint Any-Type Cleanup Spec

## Scope

- Resolve `@typescript-eslint/no-explicit-any` violations in `src/jswasm/vfs/memfs/memfs.unit.test.ts` by using
  concrete types from `memfs/memfs.d.ts` for the FS scaffold, allocator helpers, and MEMFS instance.
- Replace loose `@ts-ignore` directives in `src/jswasm/vfs/opfs/installer/index/index.ts` with typed
  alternatives or `@ts-expect-error` statements that include context, eliminating silent suppression.

## Validation Plan

- Run `npm run lint` to confirm the `any` and ts-comment warnings are cleared.
- Run `pnpm run typecheck` to ensure stronger typings compile without regressions.
- (Optional) Run `npm run test:unit -- src/jswasm/vfs/memfs/memfs.unit.test.ts` to verify the MEMFS test suite
  still passes with the stricter types.
