<script setup>
import { ref, onMounted, onUnmounted, nextTick, watch, computed } from "vue";
import SqlConsole from "./home-demo/SqlConsole.vue";
import WorkerConnector from "./home-demo/WorkerConnector.vue";
import ResultTable from "./home-demo/ResultTable.vue";
import OpfsExplorer from "./home-demo/OpfsExplorer.vue";
import TechStackFooter from "./home-demo/TechStackFooter.vue";
import BezierCurve from "./home-demo/BezierCurve.vue";
import StraightConnector from "./home-demo/StraightConnector.vue";

// State
const sqlInput = ref("");
const resultTable = ref([]);
const isProcessing = ref(false);
const db = ref(null);
const errorMsg = ref("");
const schema = ref({});

// Constants
const QUERY_ANIMATION_DELAY = 500; // ms, matches BezierCurve duration
const AUTO_TAB_DELAY = 2000;
const AUTO_STEPS = [
  {
    tab: "insert",
    sql: "INSERT INTO users (id, username, email) VALUES (3, 'baz', 'baz@domain.com');",
  },
  {
    tab: "update",
    sql: "UPDATE users SET email = 'root@wuchuheng.com', username='Andy' WHERE id = 3;",
  },
  {
    tab: "delete",
    sql: "DELETE FROM users WHERE id = 3;",
  },
];
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const updateSchema = async () => {
  if (!db.value) return;
  try {
    const tables = await db.value.query(
      "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'"
    );
    const newSchema = {};
    for (const table of tables) {
      const columns = await db.value.query(`PRAGMA table_info(${table.name})`);
      newSchema[table.name] = columns.map((c) => c.name);
    }
    schema.value = newSchema;
  } catch (e) {
    console.error("Failed to update schema:", e);
  }
};

// Device detection (JS as the sole standard)
const deviceType = ref("lg"); // 'sm' | 'md' | 'lg'
const updateDeviceType = () => {
  const width = window.innerWidth;
  let newType = "lg";
  if (width < 768) {
    newType = "sm";
  } else if (width < 1024) {
    newType = "md";
  }

  if (deviceType.value !== newType) {
    deviceType.value = newType;
  }
};

// Points for the curve
const p1 = ref(null);
const p2 = ref(null);
const p3 = ref(null);

// Points for IO arrows
const ioLine1 = ref(null);
const ioLine2 = ref(null);

const containerRef = ref(null);
const consoleRef = ref(null);
const workerRef = ref(null);
const tableRef = ref(null);
const opfsRef = ref(null);
let autoDemoStarted = false;
let autoDemoHalted = false;
let autoLoopStop = false;

let rafId = null;
const throttledUpdate = () => {
  if (rafId) return;
  rafId = requestAnimationFrame(() => {
    updateDeviceType();
    // After deviceType potentially changes, we must wait for Vue to update styles
    // and for the browser to finish layout before reading component positions.
    nextTick(() => {
      requestAnimationFrame(() => {
        updatePoints();
        rafId = null;
      });
    });
  });
};

const ensureVisibleCurve = (start, mid, end, rects) => {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const base = Math.hypot(dx, dy);
  if (!base) return { start, mid, end };

  const distanceToLine =
    Math.abs((mid.x - start.x) * dy - (mid.y - start.y) * dx) / base;

  // Keep the curve noticeable when points sit on the same vertical line (mobile layout).
  const MIN_CURVE_DISTANCE = 24;
  if (distanceToLine >= MIN_CURVE_DISTANCE) {
    return { start, mid, end };
  }

  const spaceRight = rects.container.width - Math.max(start.x, mid.x, end.x);
  const spaceLeft = Math.min(start.x, mid.x, end.x);
  const direction = spaceRight >= spaceLeft ? 1 : -1;

  const bendAmount = Math.min(rects.container.width * 0.25, 120);
  const startOffset = Math.min(bendAmount * 0.35, rects.console.width * 0.25);
  const endOffset = Math.min(bendAmount * 0.35, rects.table.width * 0.25);

  return {
    start: { x: start.x + direction * startOffset, y: start.y },
    mid: { x: mid.x + direction * bendAmount, y: mid.y },
    end: { x: end.x + direction * endOffset, y: end.y },
  };
};

const updatePoints = () => {
  if (
    !containerRef.value ||
    !consoleRef.value ||
    !workerRef.value ||
    !tableRef.value ||
    !opfsRef.value
  )
    return;

  // Batch all DOM reads to avoid layout thrashing
  const containerRect = containerRef.value.getBoundingClientRect();
  const consoleEl = consoleRef.value.$el || consoleRef.value;
  const workerEl = workerRef.value.$el || workerRef.value;
  const tableEl =
    tableRef.value.tableRef || tableRef.value.$el || tableRef.value;
  const opfsEl = opfsRef.value.folderRef || opfsRef.value.$el || opfsRef.value;

  const consoleRect = consoleEl.getBoundingClientRect();
  const workerRect = workerEl.getBoundingClientRect();
  const tableRect = tableEl.getBoundingClientRect();
  const opfsRect = opfsEl.getBoundingClientRect();

  const getRelativePos = (rect, type) => {
    const centerX = rect.left + rect.width / 2 - containerRect.left;
    const centerY = rect.top + rect.height / 2 - containerRect.top;

    if (type === "bottom")
      return { x: centerX, y: rect.bottom - containerRect.top };
    if (type === "top") return { x: centerX, y: rect.top - containerRect.top };
    if (type === "left")
      return { x: rect.left - containerRect.left, y: centerY };
    if (type === "right")
      return { x: rect.right - containerRect.left, y: centerY };
    return { x: centerX, y: centerY };
  };

  const clamp = (val, min, max) => Math.min(max, Math.max(min, val));
  const workerCenter = getRelativePos(workerRect, "center");

  // Curve points
  if (deviceType.value === "lg") {
    p1.value = getRelativePos(consoleRect, "right");
    p3.value = getRelativePos(tableRect, "left");
  } else {
    p1.value = getRelativePos(consoleRect, "bottom");
    p3.value = getRelativePos(tableRect, "top");
  }
  if (deviceType.value === "lg") {
    const midLine = {
      x: (p1.value.x + p3.value.x) / 2,
      y: (p1.value.y + p3.value.y) / 2,
    };
    const baseDistance = Math.hypot(
      p3.value.x - p1.value.x,
      p3.value.y - p1.value.y
    );
    const maxVerticalOffset = Math.min(80, baseDistance * 0.2);
    const maxHorizontalOffset = Math.min(120, baseDistance * 0.1);

    p2.value = {
      x:
        midLine.x +
        clamp(
          workerCenter.x - midLine.x,
          -maxHorizontalOffset,
          maxHorizontalOffset
        ),
      y:
        midLine.y +
        clamp(
          workerCenter.y - midLine.y,
          -maxVerticalOffset,
          maxVerticalOffset
        ),
    };
  } else {
    p2.value = workerCenter;
  }

  if (deviceType.value === "sm") {
    const curvedPoints = ensureVisibleCurve(p1.value, p2.value, p3.value, {
      container: containerRect,
      console: consoleRect,
      table: tableRect,
    });

    p1.value = curvedPoints.start;
    p2.value = curvedPoints.mid;
    p3.value = curvedPoints.end;
  }

  // LG and SM use Vertical IO, MD uses Horizontal IO
  if (deviceType.value === "sm" || deviceType.value === "lg") {
    // Vertical IO
    const tX = tableRect.left + tableRect.width / 2 - containerRect.left;
    const oX = opfsRect.left + opfsRect.width / 2 - containerRect.left;

    // Adjust for the folder tab height (20 units in a 180 unit height SVG)
    const visualTopOffset = (20 / 180) * opfsRect.height;
    const opfsVisualTop = opfsRect.top + visualTopOffset - containerRect.top;

    ioLine1.value = {
      p1: { x: tX - 15, y: tableRect.bottom - containerRect.top },
      p2: { x: oX - 15, y: opfsVisualTop },
    };
    ioLine2.value = {
      p1: { x: oX + 15, y: opfsVisualTop },
      p2: { x: tX + 15, y: tableRect.bottom - containerRect.top },
    };
  } else {
    // Horizontal IO for md
    const tY = tableRect.top + tableRect.height / 2 - containerRect.top;
    const oY = opfsRect.top + opfsRect.height / 2 - containerRect.top;
    ioLine1.value = {
      p1: { x: tableRect.right - containerRect.left, y: tY - 10 },
      p2: { x: opfsRect.left - containerRect.left, y: oY - 10 },
    };
    ioLine2.value = {
      p1: { x: opfsRect.left - containerRect.left, y: oY + 10 },
      p2: { x: tableRect.right - containerRect.left, y: tY + 10 },
    };
  }
};

// Layout configurations driven by JS
const layoutConfig = computed(() => {
  const type = deviceType.value;
  if (type === "lg") {
    return {
      mainFlow: { flexDirection: "row", gap: "40px", alignItems: "flex-start" },
      console: { flex: "0 0 50%" },
      worker: { flex: "0 0 15%" },
      persistence: {
        flex: "0 0 30%",
        flexDirection: "column",
        gap: "40px",
        alignItems: "center",
      },
      table: { flex: "0 0 100%", width: "100%" },
      ioSpacer: { display: "none" },
      opfs: { flex: "0 0 auto", width: "75%" },
    };
  } else if (type === "md") {
    return {
      mainFlow: { flexDirection: "column", gap: "40px", alignItems: "center" },
      console: { flex: "0 0 100%" },
      worker: { flex: "0 0 100%" },
      persistence: {
        flex: "0 0 100%",
        flexDirection: "row",
        gap: "0",
        width: "100%",
      },
      table: { flex: "0 0 50%" },
      ioSpacer: { display: "block", flex: "0 0 20%" },
      opfs: { flex: "0 0 30%" },
    };
  } else {
    // sm
    return {
      mainFlow: { flexDirection: "column", gap: "40px", alignItems: "center" },
      console: { flex: "0 0 100%" },
      worker: { flex: "0 0 100%" },
      persistence: {
        flex: "0 0 100%",
        flexDirection: "column",
        gap: "40px",
        width: "100%",
      },
      table: { flex: "0 0 100%" },
      ioSpacer: { display: "none" },
      opfs: { flex: "0 0 65%", width: "65%", alignSelf: "center" },
    };
  }
});

watch([resultTable, deviceType], () => {
  // Wait for Vue DOM update, then browser layout, then compute points
  nextTick(() => {
    requestAnimationFrame(updatePoints);
  });
});

const runQuery = async () => {
  if (!sqlInput.value.trim() || !db.value) return;

  isProcessing.value = true;
  errorMsg.value = "";

  try {
    // Wait for the Bezier animation to finish before running the query
    await new Promise((resolve) => setTimeout(resolve, QUERY_ANIMATION_DELAY));

    const sql = sqlInput.value.trim();
    const isQuery = sql.toUpperCase().startsWith("SELECT");

    if (isQuery) {
      const rows = await db.value.query(sql);
      resultTable.value = rows;
    } else {
      await db.value.exec(sql);
      // Refresh table
      const rows = await db.value.query("SELECT * FROM users");
      resultTable.value = rows;
      await updateSchema();
    }
  } catch (e) {
    console.error(e);
    errorMsg.value = e.message;
  } finally {
    isProcessing.value = false;
  }
};

const waitForProcessingIdle = async () => {
  while (isProcessing.value && !autoLoopStop) {
    await delay(50);
  }
};

const stopAutoDemo = () => {
  autoLoopStop = true;
  autoDemoHalted = true;
  consoleRef.value?.cancelAutoTyping?.();
};

const handleUserInput = () => {
  stopAutoDemo();
};

const startAutoDemo = async () => {
  if (autoDemoStarted || autoDemoHalted) return;
  if (!consoleRef.value) return;
  autoDemoStarted = true;
  autoLoopStop = false;

  consoleRef.value?.setPreset?.("insert", { applyValue: false });
  consoleRef.value?.clearEditor?.();
  sqlInput.value = "";
  consoleRef.value?.focusEditor?.();

  while (!autoLoopStop) {
    for (const step of AUTO_STEPS) {
      if (autoLoopStop) break;

      consoleRef.value?.setPreset?.(step.tab, { applyValue: false });
      await delay(AUTO_TAB_DELAY);
      if (autoLoopStop) break;

      consoleRef.value?.clearEditor?.();
      sqlInput.value = "";
      consoleRef.value?.focusEditor?.();

      const completed = await consoleRef.value?.typeText?.(step.sql);
      if (!completed || autoLoopStop) {
        autoLoopStop = true;
        break;
      }

      await nextTick();
      await waitForProcessingIdle();
      if (autoLoopStop) break;
      await delay(AUTO_TAB_DELAY);
    }
  }
};

// Initialize on client side only
onMounted(async () => {
  if (typeof window !== "undefined") {
    updateDeviceType();
    window.addEventListener("resize", throttledUpdate);

    // Initial calculation after all components are ready and layout is stable
    nextTick(() => {
      setTimeout(updatePoints, 300);
    });

    try {
      // Import dynamically to avoid SSR issues
      const { openDB } = await import("web-sqlite-js");

      db.value = await openDB("hello");

      await db.value.exec(`
                CREATE TABLE IF NOT EXISTS users (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    username TEXT,
                    email TEXT
                )
            `);

      const countRes = await db.value.query(
        "SELECT COUNT(*) as count FROM users"
      );
      if (countRes[0].count === 0) {
        await db.value.exec(
          "INSERT INTO users (username, email) VALUES ('foo', 'foo@domain.com'), ('bar', 'bar@domain.com')"
        );
      }

      const rows = await db.value.query("SELECT * FROM users");
      resultTable.value = rows;
      await updateSchema();

      await nextTick();
      startAutoDemo();
    } catch (e) {
      console.error("Failed to init DB:", e);
      errorMsg.value = "Failed to initialize Web-SQLite: " + e.message;
    }
  }
});

onUnmounted(() => {
  if (typeof window !== "undefined") {
    window.removeEventListener("resize", throttledUpdate);
    if (rafId) cancelAnimationFrame(rafId);
  }
  stopAutoDemo();
});
</script>

<template>
  <div class="demo-container" ref="containerRef">
    <!-- The dynamic connector curves -->
    <BezierCurve
      v-if="p1 && p2 && p3"
      :p1="p1"
      :p2="p2"
      :p3="p3"
      :is-processing="isProcessing"
    />
    <StraightConnector
      v-if="tableRef && opfsRef && containerRef"
      :from="tableRef"
      :to="opfsRef"
      :container="containerRef"
      :direction="deviceType === 'md' ? 'horizontal' : 'vertical'"
      :offset="-15"
      :is-processing="isProcessing"
    />
    <StraightConnector
      v-if="tableRef && opfsRef && containerRef"
      :from="opfsRef"
      :to="tableRef"
      :container="containerRef"
      :direction="deviceType === 'md' ? 'horizontal' : 'vertical'"
      :offset="15"
      :is-processing="isProcessing"
    />

    <div class="main-flow" :style="layoutConfig.mainFlow">
      <SqlConsole
        ref="consoleRef"
        v-model="sqlInput"
        :is-processing="isProcessing"
        :error-msg="errorMsg"
        :schema="schema"
        @execute="runQuery"
        @user-input="handleUserInput"
        :style="layoutConfig.console"
      />

      <WorkerConnector
        ref="workerRef"
        :is-active="isProcessing"
        :style="layoutConfig.worker"
        :device-type="deviceType"
      />

      <div class="persistence-layer" :style="layoutConfig.persistence">
        <ResultTable
          ref="tableRef"
          :data="resultTable"
          :style="layoutConfig.table"
        />
        <div class="io-spacer" :style="layoutConfig.ioSpacer"></div>
        <OpfsExplorer
          ref="opfsRef"
          :style="layoutConfig.opfs"
          :device-type="deviceType"
        />
      </div>
    </div>

    <TechStackFooter />
  </div>
</template>

<style scoped>
@import url("/fonts/google-fonts.css");

.demo-container {
  position: relative;
  width: 100%;
  padding: 20px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 40px;
  color: #222;
  font-family: "Kalam", "Patrick Hand", "Comic Neue", "Comic Sans MS", cursive,
    sans-serif;
}

.main-flow {
  display: flex;
  width: 100%;
  position: relative;
  /* z-index: 10; */
}

.persistence-layer {
  display: flex;
  width: 100%;
  max-width: 1150px;
  align-items: center;
  justify-content: center;
}
</style>
