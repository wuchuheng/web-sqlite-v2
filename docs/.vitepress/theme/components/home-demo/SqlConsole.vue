<script setup>
import { ref, onMounted, onUnmounted, nextTick, watch } from "vue";

const props = defineProps({
  modelValue: String,
  isProcessing: Boolean,
  errorMsg: String,
});

const emit = defineEmits(["update:modelValue", "run"]);

const presets = {
  insert:
    "INSERT INTO users (username, email) VALUES ('baz', 'baz@domain.com');",
  delete: "DELETE FROM users WHERE id = 1;",
  update: "UPDATE users SET email = 'new@domain.com' WHERE id = 2;",
};

const activePreset = ref("insert");
const toolbarRef = ref(null);
const tabRefs = ref({});
const tabWidths = ref({});
const maskStyle = ref({
  left: "0px",
  width: "0px",
});

const updateMask = () => {
  const el = tabRefs.value[activePreset.value];
  if (el) {
    maskStyle.value = {
      left: `${el.offsetLeft}px`,
      width: `${el.offsetWidth}px`,
    };
  }
  // Update all widths for SVG paths
  Object.keys(tabRefs.value).forEach((key) => {
    if (tabRefs.value[key]) {
      tabWidths.value[key] = tabRefs.value[key].offsetWidth;
    }
  });
};

const getTabPath = (width) => {
  const slant = 12;
  const height = 40; // Approximate button height
  const strokeWidth = 2;
  const topY = strokeWidth;
  const bottomY = height;
  return `M 0,${bottomY} L ${slant},${topY} L ${
    width - slant
  },${topY} L ${width},${bottomY}`;
};

const setPreset = (action) => {
  if (presets[action]) {
    activePreset.value = action;
    emit("update:modelValue", presets[action]);
    nextTick(updateMask);
  }
};

const handleKeydown = (e) => {
  if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
    e.preventDefault();
    emit("run");
  }
};

let resizeObserver = null;

onMounted(() => {
  // Use ResizeObserver for more robust layout tracking (e.g. font loading, parent flex shifts)
  if (typeof window !== "undefined" && toolbarRef.value) {
    resizeObserver = new ResizeObserver(() => {
      updateMask();
    });
    resizeObserver.observe(toolbarRef.value);
  }

  // Initial update after a short delay to ensure layout has settled
  nextTick(() => {
    setTimeout(updateMask, 100);
  });
});

onUnmounted(() => {
  if (resizeObserver) {
    resizeObserver.disconnect();
  }
});

watch(
  () => props.modelValue,
  (newVal) => {
    // If the value doesn't match the active preset, clear the active state
    if (newVal !== presets[activePreset.value]) {
      // Find if it matches another preset
      const found = Object.keys(presets).find((key) => presets[key] === newVal);
      if (found) {
        activePreset.value = found;
        nextTick(updateMask);
      } else {
        // We keep the last active preset visually if it's just a slight edit,
        // or clear it if it's completely different.
        // For this demo, let's just keep the mask for better UX unless it's empty.
        if (!newVal) {
          activePreset.value = null;
          maskStyle.value.width = "0px";
        }
      }
    }
  }
);
</script>

<template>
  <section class="sql-window">
    <div class="window-header">
      <div class="traffic-lights">
        <span class="light red"></span>
        <span class="light yellow"></span>
        <span class="light green"></span>
      </div>
      <div class="window-title">Execute SQL locally.</div>
    </div>

    <div class="window-toolbar" ref="toolbarRef">
      <button
        v-for="(label, key) in {
          insert: 'Insert',
          delete: 'Delete',
          update: 'Update',
        }"
        :key="key"
        class="tool-btn"
        :class="{ active: activePreset === key }"
        :ref="(el) => (tabRefs[key] = el)"
        @click="setPreset(key)"
      >
        <svg
          class="tab-svg"
          :viewBox="`0 0 ${tabWidths[key] || 100} 40`"
          preserveAspectRatio="none"
        >
          <path :d="getTabPath(tabWidths[key] || 100)" class="tab-path" />
        </svg>
        <span class="icon">{{
          key === "insert" ? "+" : key === "delete" ? "🗑" : "✎"
        }}</span>
        {{ label }}
      </button>
      <div class="active-tab-mask" :style="maskStyle"></div>
    </div>

    <div class="window-content">
      <textarea
        :value="modelValue"
        @input="$emit('update:modelValue', $event.target.value)"
        id="sql-input"
        spellcheck="false"
        @keydown="handleKeydown"
      ></textarea>
    </div>

    <div class="window-footer">
      <div
        class="enter-hint-container"
        @click="$emit('run')"
        style="cursor: pointer"
        title="Click to run or press Enter"
      >
        <svg
          class="enter-key-icon"
          viewBox="0 0 44 24"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <!-- Return arrow -->
          <path
            d="M28 8V16H10M10 16L14 12M10 16L14 20"
            stroke="#2d2d2d"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
          />
        </svg>
        <span class="hint">Press ↵ Enter to execute.</span>
      </div>

      <div class="status-indicator">
        <i v-if="isProcessing" class="fa-solid fa-spinner fa-spin"></i>
      </div>
    </div>
    <div v-if="errorMsg" class="error-banner">{{ errorMsg }}</div>
  </section>
</template>

<style scoped>
@import url("/font-awesome/all.min.css");

.sql-window {
  width: 100%;
  max-width: 620px;
  background: #fdfbf6;
  border: 2px solid #2d2d2d;
  border-radius: 12px;
  box-shadow: 4px 5px 0 rgba(0, 0, 0, 0.15);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  position: relative;
  z-index: 10;
}

.window-header {
  background: #fdfbf6;
  padding: 8px 16px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-bottom: 2px solid #2d2d2d;
  position: relative;
  min-height: 36px;
}

.traffic-lights {
  position: absolute;
  left: 16px;
  display: flex;
  gap: 8px;
}

.light {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  border: 1.5px solid #2d2d2d;
}
.light.red {
  background-color: #f7c3c3;
}
.light.yellow {
  background-color: #f8e3a1;
}
.light.green {
  background-color: #c6f0b3;
}

.window-title {
  font-weight: 700;
  font-size: 16px;
  color: #2d2d2d;
  font-family: "Kalam", cursive;
}

.window-toolbar {
  padding: 8px 14px 0 14px;
  border-bottom: 2px solid #2d2d2d;
  display: flex;
  background: #fdfbf6;
  position: relative;
  z-index: 1;
}

.tool-btn {
  background: transparent;
  border: none;
  cursor: pointer;
  font-size: 14px;
  color: #2d2d2d;
  padding: 4px 24px;
  display: flex;
  align-items: center;
  gap: 6px;
  font-weight: 600;
  font-family: "Kalam", cursive;
  position: relative;
  z-index: 4;
  margin-bottom: 0;
  transition: transform 0.1s ease;
}

.tab-svg {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  z-index: -1;
  overflow: visible;
}

.tab-path {
  fill: #fdfbf6;
  stroke: #2d2d2d;
  stroke-width: 2;
  stroke-linejoin: round;
  stroke-linecap: round;
  transition: fill 0.2s ease;
}

.tool-btn:hover .tab-path {
  fill: #f5f2e9;
}

.tool-btn.active .tab-path {
  fill: #fdfbf6;
}

.active-tab-mask {
  position: absolute;
  bottom: -2px;
  height: 2px;
  background: #fdfbf6;
  transition: left 0.3s cubic-bezier(0.4, 0, 0.2, 1),
    width 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  z-index: 2;
}
.tool-btn .icon {
  font-size: 14px;
}

#sql-input {
  width: 100%;
  height: 140px;
  border: none;
  padding: 16px;
  font-family: "Kalam", "Patrick Hand", "Courier New", monospace;
  font-size: 18px;
  resize: none;
  outline: none;
  color: #1f1f1f;
  background: #fdfbf6;
}

.window-content {
  border-bottom: 2px solid #2d2d2d;
  background: #fdfbf6;
}

.window-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 16px;
  background: #fdfbf6;
  color: #2d2d2d;
  font-weight: 600;
}

.enter-hint-container {
  display: flex;
  align-items: center;
  gap: 10px;
}

.enter-key-icon {
  width: 44px;
  height: 24px;
  display: block;
}

.hint {
  font-size: 14px;
  color: #2d2d2d;
  font-family: "Kalam", cursive;
}

.error-banner {
  background: #ffe8e0;
  color: #9c2600;
  padding: 6px 15px;
  font-size: 13px;
  border-top: 2px solid #2d2d2d;
}
</style>
