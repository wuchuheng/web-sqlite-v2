<script setup>
import { ref, onMounted } from "vue";
import SqlConsole from "./home-demo/SqlConsole.vue";
import WorkerConnector from "./home-demo/WorkerConnector.vue";
import ResultTable from "./home-demo/ResultTable.vue";
import IoArrows from "./home-demo/IoArrows.vue";
import OpfsExplorer from "./home-demo/OpfsExplorer.vue";
import TechStackFooter from "./home-demo/TechStackFooter.vue";

// State
const sqlInput = ref("Select * from users;");
const resultTable = ref([]);
const isProcessing = ref(false);
const db = ref(null);
const errorMsg = ref("");

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
</script>

<template>
  <div class="demo-container">
    <SqlConsole
      v-model="sqlInput"
      :is-processing="isProcessing"
      :error-msg="errorMsg"
      @run="runQuery"
    />

    <WorkerConnector :is-active="isProcessing" />

    <section class="persistence-layer">
      <ResultTable :data="resultTable" />
      <IoArrows />
      <OpfsExplorer />
    </section>

    <TechStackFooter />
  </div>
</template>

<style scoped>
@import url("https://fonts.googleapis.com/css2?family=Kalam:wght@400;700&family=Patrick+Hand&display=swap");
.demo-container {
  width: 100%;
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 22px;
  color: #222;
  font-family: "Kalam", "Patrick Hand", "Comic Neue", "Comic Sans MS", cursive,
    sans-serif;
}

.persistence-layer {
  display: flex;
  width: 100%;
  max-width: 1150px;
  gap: 22px;
  align-items: center;
  justify-content: center;
}

@media (max-width: 768px) {
  .persistence-layer {
    flex-direction: column;
  }
}
</style>
