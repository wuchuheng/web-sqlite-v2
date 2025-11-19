/**
 * TypeScript-friendly re-export for the runtime .mjs implementation so tests
 * and tooling can import typed helpers without custom module declarations.
 */
 
// @ts-expect-error The implementation lives in .mjs; this shim exposes it to TS.
export { attachXWrapAdapters } from "./xwrap-helpers.mjs";
