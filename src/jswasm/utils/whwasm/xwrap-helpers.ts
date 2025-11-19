/**
 * TypeScript-friendly re-export for the runtime .mjs implementation so tests
 * and tooling can import typed helpers without custom module declarations.
 */
/// <reference path="./xwrap-helpers.mjs.d.ts" />
export { attachXWrapAdapters } from "./xwrap-helpers.mjs";
