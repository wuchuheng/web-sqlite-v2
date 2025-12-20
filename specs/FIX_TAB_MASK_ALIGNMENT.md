# Specification: Robust Tab Mask Alignment

## Overview

Fix a bug in `SqlConsole.vue` where the active tab's bottom border mask (the "Chrome-style" merge effect) fails to align correctly during the initial page load.

## Problem Analysis

- **Timing:** `onMounted` fires before the custom font (`Kalam`) or the flex-layout has fully settled.
- **Dependency:** The mask's `left` and `width` properties depend on the DOM's `offsetLeft` and `offsetWidth`, which are volatile during initial rendering.

## Requirements

### 1. Implement ResizeObserver

- Instead of relying solely on `onMounted` and `window.resize`, implement a `ResizeObserver` that watches the `window-toolbar` container.
- This ensures that any change in button dimensions (due to font loading or layout shifts) immediately triggers a recalculation of the mask position.

### 2. Initialization Polish

- Add a small `setTimeout` or `requestAnimationFrame` in the observer's initial call to ensure the browser has finished at least one full layout pass.
- Ensure that `tabWidths` (used for SVG path generation) are also updated within this observer.

### 3. State Syncing

- Ensure the observer correctly handles the transition when `activePreset` changes.

## Implementation Plan

1. **Step 1:** Modify `SqlConsole.vue` to initialize a `ResizeObserver` in `onMounted`.
2. **Step 2:** Point the observer at the `.window-toolbar` element.
3. **Step 3:** Inside the observer callback, call `updateMask()`.
4. **Step 4:** Cleanup the observer in `onUnmounted` to prevent memory leaks.
