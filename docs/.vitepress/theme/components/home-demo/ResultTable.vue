<script setup>
import { ref } from "vue";
const tableRef = ref(null);

defineProps({
  data: Array,
});

defineExpose({
  tableRef,
});

// JS Hooks for Row Transitions
const onBeforeEnter = (el) => {
  el.style.height = "0";
  el.style.opacity = "0";
  el.style.filter = "blur(8px)";
  el.style.transform = "translateY(-120px)";
  el.style.overflow = "hidden";
  el.style.border = "none";
};

const onEnter = (el, done) => {
  // Phase 1: Open Gap
  el.offsetHeight; // force reflow
  el.style.transition = "height 0.4s ease";
  el.style.height = "40px";

  // Phase 2: Slide and Focus after gap is partially open
  setTimeout(() => {
    el.style.transition = "all 0.5s cubic-bezier(0.4, 0, 0.2, 1)";
    el.style.opacity = "1";
    el.style.transform = "translateY(0)";
    el.style.filter = "blur(0)";
    // Restore borders after landing
    setTimeout(() => {
      el.style.border = "";
      el.style.overflow = "";
      done();
    }, 500);
  }, 200);
};

const onLeave = (el, done) => {
  // Phase 1: Tear-off and Blur
  el.style.transition = "all 0.5s cubic-bezier(0.4, 0, 0.2, 1)";
  el.style.opacity = "0";
  el.style.filter = "blur(8px)";
  el.style.transform = "translate(60px, 60px) rotate(8deg)";
  el.style.zIndex = "10";

  // Phase 2: Collapse Gap
  setTimeout(() => {
    el.style.transition = "height 0.4s ease";
    el.style.height = "0";
    el.style.padding = "0";
    el.style.margin = "0";
    el.style.border = "none";
    setTimeout(done, 400);
  }, 300);
};
</script>

<template>
  <div class="table-container">
    <div class="table-header">
      <i class="fa-solid fa-table"></i>
      <span>Live Data View</span>
    </div>
    <table class="data-view" ref="tableRef">
      <thead>
        <tr>
          <th class="col-id">ID</th>
          <th>username</th>
          <th>email</th>
        </tr>
      </thead>
      <TransitionGroup
        tag="tbody"
        :css="false"
        @before-enter="onBeforeEnter"
        @enter="onEnter"
        @leave="onLeave"
      >
        <tr v-if="data.length === 0" key="empty">
          <td colspan="3" style="text-align: center; color: #999">
            No results
          </td>
        </tr>
        <tr v-for="row in data" :key="row.id">
          <td class="col-id">
            <Transition name="cell-tactile" mode="out-in">
              <span :key="row.id">{{ row.id }}</span>
            </Transition>
          </td>
          <td>
            <Transition name="cell-tactile" mode="out-in">
              <span :key="row.username">{{ row.username }}</span>
            </Transition>
          </td>
          <td>
            <Transition name="cell-tactile" mode="out-in">
              <span :key="row.email">{{ row.email }}</span>
            </Transition>
          </td>
        </tr>
      </TransitionGroup>
    </table>
  </div>
</template>

<style scoped>
@import url("/font-awesome/all.min.css");

.table-container {
  flex: 2;
  width: 100%;
  position: relative;
  background: #f7f4ec;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.table-header {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
  font-weight: 700;
  color: #2d2d2d;
  font-family: "Kalam", cursive;
  padding-left: 4px;
}

.data-view {
  width: 100%;
  border-collapse: collapse;
  background: #fdfbf6;
  border: 2px solid #2d2d2d;
  border-radius: 8px;
  overflow: hidden;
  box-shadow: 2px 2px 0 rgba(0, 0, 0, 0.1);
  font-family: "Kalam", cursive;
  display: block; /* Changed from table to block for better predictability */
}

.data-view :deep(thead),
.data-view :deep(tbody) {
  display: block;
  width: 100%;
}

.data-view :deep(tr) {
  display: flex;
  width: 100%;
  background: #fdfbf6;
  border-bottom: 2px solid #2d2d2d;
  box-sizing: border-box;
}

.data-view :deep(tr:last-child) {
  border-bottom: none;
}

.data-view :deep(th),
.data-view :deep(td) {
  padding: 8px 12px;
  text-align: left;
  border-right: 2px solid #2d2d2d;
  color: #1f1f1f;
  font-size: 14px;
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center; /* Center content for better visual balance */
}

.data-view :deep(th:last-child),
.data-view :deep(td:last-child) {
  border-right: none;
}

.data-view :deep(th) {
  background: #f0ede6;
  font-weight: 700;
}

.col-id {
  flex: 0 0 60px !important;
  justify-content: center;
}

/* Cell Tactile Transitions */
.cell-tactile-enter-active,
.cell-tactile-leave-active {
  transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
}

.cell-tactile-enter-from {
  opacity: 0;
  transform: translateY(-20px);
  filter: blur(4px);
}

.cell-tactile-leave-to {
  opacity: 0;
  transform: translate(20px, 20px) rotate(5deg);
  filter: blur(4px);
}

.data-view td span {
  display: block;
  width: 100%;
}
</style>
