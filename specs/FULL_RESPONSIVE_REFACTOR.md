# Specification: Full Responsive Refactor with JS Detection

## Overview

Refactor the homepage demo's responsive layout to use JavaScript-based breakpoint detection. This will allow for more granular control over component arrangement and connector point calculations across three distinct device categories: `sm`, `md`, and `lg`.

## Breakpoint Definitions

Based on project requirements:

- **`sm` (Small):** Width < 768px (48rem)
- **`md` (Medium):** 768px <= Width < 1024px (64rem)
- **`lg` (Large):** Width >= 1024px (64rem)

_Note: While `sm` starts at 640px in standard rules, for our layout logic, we treat everything below 768px as the "vertical stacked" `sm` mode to ensure readability._

## Layout Modes

### 1. Large Device (`lg`)

- **Structure:** Single horizontal row.
- **Allocation:**
    - `SqlConsole`: 35%
    - `WorkerConnector`: 20%
    - `ResultTable`: 25%
    - `IO Spacer`: 10%
    - `OpfsExplorer`: 10%
- **Data Flow:** Horizontal (Left-to-Right).

### 2. Medium Device (`md`)

- **Structure:** Three main rows.
    - **Row 1:** `SqlConsole` (Full width)
    - **Row 2:** `WorkerConnector` (Full width)
    - **Row 3:** Horizontal flow for persistence:
        - `ResultTable`: 50%
        - `IO Spacer`: 20%
        - `OpfsExplorer`: 30%
- **Data Flow:** Mixed (Vertical from Console to Table, Horizontal from Table to OPFS).

### 3. Small Device (`sm`)

- **Structure:** Full vertical stack (5 rows).
    - **Row 1:** `SqlConsole`
    - **Row 2:** `WorkerConnector`
    - **Row 3:** `ResultTable`
    - **Row 4:** `IO Connector` (Vertical arrow)
    - **Row 5:** `OpfsExplorer`
- **Data Flow:** Fully Vertical (Top-to-Bottom).

## Technical Implementation

### JavaScript as Sole Source of Truth

- A reactive variable `deviceType` (`'sm' | 'md' | 'lg'`) will be the central configuration for all layout and connector logic.
- **Dynamic Styling:** Component widths and flex arrangements will be applied via JS-driven `:style` or `:class` bindings, rather than hardcoded `@media` queries in CSS.
- **Responsive Calculation:** `updatePoints` will use the exact state of `deviceType` to determine anchor points and paths.

## Layout Configuration (JS Standard)

| Component         | LG (Flex) | MD (Flex) | SM (Flex) |
| :---------------- | :-------- | :-------- | :-------- |
| `SqlConsole`      | 35%       | 100%      | 100%      |
| `WorkerConnector` | 20%       | 100%      | 100%      |
| `ResultTable`     | 25%       | 50%       | 100%      |
| `IO Connector`    | 10%       | 20%       | 100%      |
| `OpfsExplorer`    | 10%       | 30%       | 100%      |

## Implementation Plan

... 2. **Step 2: Refactor HomePage.vue for Dynamic Layout** - Replace static CSS layouts with dynamic bindings driven by `deviceType`. - Ensure all sub-components receive the necessary state to adjust their internal presentation if needed.

3. **Step 3: Update Connector Logic**
    - Refactor `updatePoints` to use `deviceType` for determining connection sides.
    - Ensure IO arrows handle the transition from horizontal (`md`, `lg`) to vertical (`sm`) correctly.

4. **Step 4: Verification**
    - Test across specific widths: 500px (`sm`), 850px (`md`), 1200px (`lg`).
    - Verify that the green dots and arrows remain perfectly aligned and correctly oriented in all 3 modes.
