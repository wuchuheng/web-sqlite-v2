<script setup>
import { ref, onMounted, onUnmounted, nextTick, watch } from "vue";
import SqlConsole from "./home-demo/SqlConsole.vue";
import WorkerConnector from "./home-demo/WorkerConnector.vue";
import ResultTable from "./home-demo/ResultTable.vue";
import IoArrows from "./home-demo/IoArrows.vue";
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

// Points for the curve
const p1 = ref({ x: 0, y: 0 });
const p2 = ref({ x: 0, y: 0 });
const p3 = ref({ x: 0, y: 0 });

// Points for IO arrows
const ioLine1 = ref({ p1: { x: 0, y: 0 }, p2: { x: 0, y: 0 } });
const ioLine2 = ref({ p1: { x: 0, y: 0 }, p2: { x: 0, y: 0 } });

const containerRef = ref(null);
const consoleRef = ref(null);
const workerRef = ref(null);
const tableRef = ref(null);
const opfsRef = ref(null);

const updatePoints = () => {
  if (
    !containerRef.value ||
    !consoleRef.value ||
    !workerRef.value ||
    !tableRef.value ||
    !opfsRef.value
  )
    return;

  const containerRect = containerRef.value.getBoundingClientRect();

  const getPos = (el, type) => {
    const domEl = el.tableRef || el.folderRef || el.$el || el;

    const rect = domEl.getBoundingClientRect();

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

  p1.value = getPos(consoleRef.value, "bottom");

  p2.value = getPos(workerRef.value, "center");

  p3.value = getPos(tableRef.value, "top");

  // IO Arrows points

  const tableEl =
    tableRef.value.tableRef || tableRef.value.$el || tableRef.value;

  const opfsEl = opfsRef.value.folderRef || opfsRef.value.$el || opfsRef.value;

  const tableRect = tableEl.getBoundingClientRect();

  const opfsRect = opfsEl.getBoundingClientRect();

  const isVertical = opfsRect.top > tableRect.bottom - 10;

  if (isVertical) {
    // Mobile layout: top-to-bottom
    const tX = tableRect.left + tableRect.width / 2 - containerRect.left;
    const oX = opfsRect.left + opfsRect.width / 2 - containerRect.left;

    ioLine1.value = {
      p1: { x: tX - 15, y: tableRect.bottom - containerRect.top },
      p2: { x: oX - 15, y: opfsRect.top - containerRect.top },
    };
    ioLine2.value = {
      p1: { x: oX + 15, y: opfsRect.top - containerRect.top },
      p2: { x: tX + 15, y: tableRect.bottom - containerRect.top },
    };
  } else {
    // Desktop layout: left-to-right
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

watch(resultTable, () => {
  nextTick(() => {
    setTimeout(updatePoints, 50);
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
    // Update points initially and on resize
    window.addEventListener("resize", updatePoints);
    nextTick(() => {
      // Small delay to ensure layout is stable
      setTimeout(updatePoints, 100);
    });

    try {
      // Import dynamically to avoid SSR issues
      const { openDB } = await import("web-sqlite-js"); // Ensure 'web-sqlite-js' is aliased or installed

      db.value = await openDB("docs_demo_vue");

      await db.value.exec(`
                CREATE TABLE IF NOT EXISTS users (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    username TEXT,
                    email TEXT
                )
            `);

      const countRes = await db.value.query(
        "SELECT COUNT(*) as count FROM users",
      );
      if (countRes[0].count === 0) {
        await db.value.exec(
          "INSERT INTO users (username, email) VALUES ('foo', 'foo@domain.com'), ('bar', 'bar@domain.com')",
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
    window.removeEventListener("resize", updatePoints);
  }
});
</script>

<template>
  <div class="demo-container" ref="containerRef">
    <!-- The dynamic connector curves -->
    <BezierCurve :p1="p1" :p2="p2" :p3="p3" />
    <StraightConnector :p1="ioLine1.p1" :p2="ioLine1.p2" />
    <StraightConnector :p1="ioLine2.p1" :p2="ioLine2.p2" />

    <SqlConsole
      ref="consoleRef"
      v-model="sqlInput"
      :is-processing="isProcessing"
      :error-msg="errorMsg"
      @run="runQuery"
    />

    <WorkerConnector ref="workerRef" :is-active="isProcessing" />

    <section class="persistence-layer">
      <ResultTable ref="tableRef" :data="resultTable" />
      <OpfsExplorer ref="opfsRef" />
    </section>

    <TechStackFooter />
  </div>
</template>

<style scoped>
@import url("https://fonts.googleapis.com/css2?family=Kalam:wght@400;700&family=Patrick+Hand&display=swap");
.demo-container {
  position: relative;
  width: 100%;
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 40px;
  color: #222;
  font-family:
    "Kalam", "Patrick Hand", "Comic Neue", "Comic Sans MS", cursive, sans-serif;
}

.persistence-layer {
  display: flex;
  width: 100%;
  max-width: 1150px;
  gap: 80px;
  align-items: center;
  justify-content: center;
}

@media (max-width: 768px) {
  .persistence-layer {
    flex-direction: column;
  }
}
</style>
