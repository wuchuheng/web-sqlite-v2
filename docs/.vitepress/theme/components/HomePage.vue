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
const sqlInput = ref("Select * from users;");
const resultTable = ref([]);
const isProcessing = ref(false);
const db = ref(null);
const errorMsg = ref("");

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

  // Curve points
  if (deviceType.value === "lg") {
    p1.value = getRelativePos(consoleRect, "right");
    p3.value = getRelativePos(tableRect, "left");
  } else {
    p1.value = getRelativePos(consoleRect, "bottom");
    p3.value = getRelativePos(tableRect, "top");
  }
  p2.value = getRelativePos(workerRect, "center");

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
      mainFlow: { flexDirection: "row", gap: "40px", alignItems: "center" },
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
      opfs: { flex: "0 0 100%" },
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
    }
  } catch (e) {
    console.error(e);
    errorMsg.value = e.message;
  } finally {
    isProcessing.value = false;
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

      db.value = await openDB("docs_demo_vue");

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
});
</script>

<template>
  <div class="demo-container" ref="containerRef">
    <!-- The dynamic connector curves -->
    <BezierCurve v-if="p1 && p2 && p3" :p1="p1" :p2="p2" :p3="p3" />
    <StraightConnector v-if="ioLine1" :p1="ioLine1.p1" :p2="ioLine1.p2" />
    <StraightConnector v-if="ioLine2" :p1="ioLine2.p1" :p2="ioLine2.p2" />

    <div class="main-flow" :style="layoutConfig.mainFlow">
      <SqlConsole
        ref="consoleRef"
        v-model="sqlInput"
        :is-processing="isProcessing"
        :error-msg="errorMsg"
        @run="runQuery"
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
