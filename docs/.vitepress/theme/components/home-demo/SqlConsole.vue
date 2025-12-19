<script setup>
defineProps({
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

const setPreset = (action) => {
  if (presets[action]) {
    emit("update:modelValue", presets[action]);
  }
};

const handleKeydown = (e) => {
  if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
    e.preventDefault();
    emit("run");
  }
};
</script>

<template>
  <section class="sql-window">
    <div class="window-header">
      <div class="traffic-lights">
        <span class="light red"></span>
        <span class="light yellow"></span>
        <span class="light green"></span>
      </div>
      <div class="window-title">Run SQL locally.</div>
    </div>

    <div class="window-toolbar">
      <button class="tool-btn" @click="setPreset('insert')">
        <span class="icon">+</span> Insert
      </button>
      <button class="tool-btn" @click="setPreset('delete')">
        <span class="icon">🗑</span> Delete
      </button>
      <button class="tool-btn" @click="setPreset('update')">
        <span class="icon">✎</span> Update
      </button>
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
        <span class="hint">type "enter" to run the SQL</span>
      </div>

      <div class="status-indicator">
        <i v-if="isProcessing" class="fa-solid fa-spinner fa-spin"></i>
      </div>
    </div>
    <div v-if="errorMsg" class="error-banner">{{ errorMsg }}</div>
  </section>
</template>

<style scoped>
@import url("https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css");

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
.light.red { background-color: #f7c3c3; }
.light.yellow { background-color: #f8e3a1; }
.light.green { background-color: #c6f0b3; }

.window-title {
  font-weight: 700;
  font-size: 16px;
  color: #2d2d2d;
  font-family: "Kalam", cursive;
}

.window-toolbar {
  padding: 8px 14px;
  border-bottom: 2px solid #2d2d2d;
  display: flex;
  gap: 12px;
  background: #fdfbf6;
}

.tool-btn {
  background: #fdfbf6;
  border: 2px solid #2d2d2d;
  cursor: pointer;
  font-size: 14px;
  color: #2d2d2d;
  padding: 4px 12px;
  border-radius: 20px;
  display: flex;
  align-items: center;
  gap: 6px;
  box-shadow: 2px 2px 0 rgba(0, 0, 0, 0.12);
  transition: transform 0.08s ease, box-shadow 0.08s ease;
  font-weight: 600;
  font-family: "Kalam", cursive;
}

.tool-btn:hover {
  transform: translate(-1px, -1px);
  box-shadow: 3px 3px 0 rgba(0, 0, 0, 0.16);
}
.tool-btn:active {
  transform: translate(0, 0);
  box-shadow: 1px 1px 0 rgba(0, 0, 0, 0.16) inset;
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
