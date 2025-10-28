# JSDoc Standards for JS/WASM Modules

This guide defines the JSDoc style required for all exported functions, classes, types, and variables in the `src/jswasm` migration to TypeScript. It complements the Three‑Phase numeric comments (inside function bodies) by documenting API intent and usage at declaration sites.

Goals:
- Make APIs self‑describing and IDE‑friendly (hover tooltips, parameter help).
- Preserve behavioral clarity during the JS→TS migration.
- Keep documentation consistent and concise.

## Rules (Required)

- Document every exported symbol (functions, classes, interfaces/types, constants/objects).
- Use short, action‑oriented descriptions (what it does, not how it’s implemented).
- Include `@param` for every parameter (name, type intent if not obvious from TS).
- Include `@returns` for return value intent (omit only for `void`).
- Include `@throws` when a function may raise errors and why.
- Include `@typeParam` for generic parameters.
- Prefer examples for non‑trivial APIs.
- Use `@deprecated` with a brief migration path when deprecating.
- Use `@internal` for symbols not intended for public consumption (still documented locally).

Numeric comments remain inside function bodies only; do not mix numeric comments into JSDoc.

## Function JSDoc Templates

Minimal function:
```ts
/**
 * Short action description in imperative mood.
 * Optional detail sentence as needed.
 *
 * @param foo - What this value represents
 * @returns What the function returns
 */
export function doThing(foo: string): number { /* ... */ }
```

With throws and example:
```ts
/**
 * Parses a JSON string into a value.
 *
 * @param input - JSON string to parse
 * @returns The parsed value
 * @throws {SyntaxError} When the input is not valid JSON
 *
 * @example
 * const value = safeParse('{"a":1}')
 * // value => { a: 1 }
 */
export function safeParse<T = unknown>(input: string): T { /* ... */ }
```

Generic:
```ts
/**
 * Maps values using a provided transform.
 *
 * @typeParam T - Input item type
 * @typeParam R - Output item type
 * @param items - Collection of input items
 * @param fn - Mapping function from T to R
 * @returns Mapped items of type R
 */
export function map<T, R>(items: readonly T[], fn: (t: T) => R): R[] { /* ... */ }
```

Constant/enum/object:
```ts
/** UTF‑8 encoding constants and bit masks. */
export const UTF8_CONSTANTS = { /* ... */ } as const
```

## UTF‑8 Utilities — Example JSDoc

Match these shapes when migrating `src/jswasm/utils/utf8.mjs` to TS.

```ts
/**
 * Converts a UTF‑8 byte array to a JavaScript string.
 *
 * @param bytes - The byte array containing UTF‑8 data
 * @param idx - Starting index (defaults to 0)
 * @param maxBytesToRead - Maximum bytes to read; stops at NUL or limit
 * @returns Decoded string
 */
export function UTF8ArrayToString(bytes: Uint8Array, idx = 0, maxBytesToRead = Number.NaN): string { /* ... */ }

/**
 * Calculates the number of bytes required to encode a string as UTF‑8.
 *
 * @param str - The input string
 * @returns Byte length in UTF‑8 encoding
 */
export function lengthBytesUTF8(str: string): number { /* ... */ }

/**
 * Encodes a string into a destination byte array using UTF‑8.
 * Writes a trailing NUL byte when space allows.
 *
 * @param str - The string to encode
 * @param heap - Destination array
 * @param outIdx - Start index in destination
 * @param maxBytesToWrite - Maximum bytes to write (including NUL)
 * @returns Number of bytes written (excluding NUL)
 */
export function stringToUTF8Array(
  str: string,
  heap: Uint8Array | number[],
  outIdx: number,
  maxBytesToWrite: number,
): number { /* ... */ }

/**
 * Converts a string to a UTF‑8 encoded number[] array.
 *
 * @param input - The string to convert
 * @param dontAddNull - When true, omit trailing NUL
 * @param length - Explicit byte length override (else computed)
 * @returns Encoded byte array
 */
export function intArrayFromString(
  input: string,
  dontAddNull?: boolean,
  length?: number,
): number[] { /* ... */ }
```

## Style Guidance

- Write the first sentence as a clear summary (used in tooltips).
- Prefer domain vocabulary over low‑level detail (implementation belongs in code and numeric comments).
- Omit redundant type info when TS already expresses it clearly; keep meaningful intent.
- Keep examples short, focused, and copy‑pastable.

## Linting and Consistency

- Run `pnpm lint` to catch style drift; keep JSDoc blocks formatted consistently (no trailing spaces, wrap at ~100–120 chars).
- Prefer consistent tag ordering: description → params/typeParams → returns → throws → examples → notes.

## Where to Start

- Add JSDoc while creating each `.ts` file in the migration.
- If an original `.mjs` file lacks docs, treat the migration as the opportunity to document it.
- Update or add docblocks as behavior evolves.

---

This guide aligns with the repository’s base rules: readability first, numeric comments inside function bodies, and consistent documentation for public APIs.

