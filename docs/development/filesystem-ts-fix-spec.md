# Filesystem TypeScript Migration Fix Specification (Update)

## Analysis of Type Issues

The linting process revealed three distinct type issues:

1.  **MountOperationsFS Mismatch**:
    - `MountOperationsFS` requires `lookupPath` to return a non-null `FSNode`, but `PathOperations` (and the implementation) allows it to return `FSNode | null`.
    - **Fix**: Relax `MountOperationsFS.lookupPath` to allow returning `null`.

2.  **MutableFS (Initialization) Mismatch**:
    - `MutableFS` in `initialization.ts` defines `getStreamChecked` as returning `{ path: string }`, which conflicts with `BaseMutableFS` returning `FSStream` (where `path` is optional).
    - **Fix**: Update `MutableFS` in `initialization.ts` to match `BaseMutableFS` (likely removing the re-definition or matching the signature).

3.  **ExtendedMutableFS (Legacy) Mismatch**:
    - `ExtendedMutableFS` defines `createDevice` as an object `{ major?: number }`.
    - However, `LegacyHelpers` (and the implementation) defines `createDevice` as a function. The implementation also attaches a `.major` property to this function.
    - **Fix**: Update `ExtendedMutableFS` to define `createDevice` as a function type that also has the `major` property (using an intersection type).

## Implementation Plan

### Step 1: Fix `src/jswasm/vfs/filesystem/mount-operations/mount-operations.ts` (and `.d.ts`)

Update `MountOperationsFS`:

```typescript
export interface MountOperationsFS extends MutableFS {
    // ...
    lookupPath(
        path: string,
        options?: { follow_mount?: boolean; parent?: boolean },
    ): {
        node: FSNode | null; // Allow null
        path: string;
    };
    // ...
}
```

### Step 2: Fix `src/jswasm/vfs/filesystem/initialization/initialization.ts` (and `.d.ts`)

Update `MutableFS`:

```typescript
export interface MutableFS extends BaseMutableFS {
    // ...
    // Remove conflicting getStreamChecked or match BaseMutableFS
    // getStreamChecked(fd: number): { path: string }; // REMOVE or FIX
    // ...
}
```

If `getStreamChecked` is not used in `initialization.ts` implementation (which I verified), removing it is the cleanest fix.

### Step 3: Fix `src/jswasm/vfs/filesystem/legacy-helpers/legacy-helpers.ts` (and `.d.ts`)

Update `ExtendedMutableFS`:

```typescript
export interface ExtendedMutableFS extends MutableFS {
    // ...
    // Fix createDevice type to be function + property
    createDevice: ((
        parent: string | FSNode,
        name: string,
        input?: (() => number | null | undefined) | null,
        output?: ((value: number) => void) | null,
    ) => FSNode) & { major?: number };
    // ...
}
```

### Step 4: Fix `src/jswasm/vfs/filesystem/filesystem.ts`

Remove `as any` casts and ensure `FS` (cast to `AssembledFilesystem` or specific interfaces) is used.
Since `FS` is being built incrementally, casting to the expected interface (even if it's a "future" capability) is the standard pattern here.

```typescript
    createInitializationHelpers(FS as MutableFS, { // Cast to specific interface
      Module: runtimeModule as unknown as RuntimeModule,
    }),
    createLegacyHelpers(FS as ExtendedMutableFS, { FS_getMode }), // Cast to specific interface
```

(We might need to import these interfaces in `filesystem.ts` or use `AssembledFilesystem` if it satisfies them).

## Verification

Run `npm run lint` and `npm run typecheck` to verify all errors are resolved.
