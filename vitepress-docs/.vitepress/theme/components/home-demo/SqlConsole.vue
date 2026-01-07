<script setup>
import { ref, onMounted, onUnmounted, nextTick, watch } from "vue";
import { EditorView, basicSetup } from "codemirror";
import { sql, SQLite } from "@codemirror/lang-sql";
import {
  EditorState,
  Compartment,
  Prec,
  Transaction,
  EditorSelection,
} from "@codemirror/state";
import { snippetCompletion, completeFromList } from "@codemirror/autocomplete";
import { keymap } from "@codemirror/view";

const props = defineProps({
  modelValue: String,
  isProcessing: Boolean,
  errorMsg: String,
  schema: {
    type: Object,
    default: () => ({}),
  },
});

const emit = defineEmits([
  "update:modelValue",
  "execute",
  "user-input",
  "execution-complete",
]);

const presets = {
  insert:
    "INSERT INTO users (username, email) VALUES ('baz', 'baz@domain.com');",
  update: "UPDATE users SET email = 'new@domain.com' WHERE id = 2;",
  delete: "DELETE FROM users WHERE id = 1;",
};

const activePreset = ref("insert");
const toolbarRef = ref(null);
const tabRefs = ref({});
const tabWidths = ref({});
const maskStyle = ref({
  left: "0px",
  width: "0px",
});

const editorContainer = ref(null);
let view = null;
const sqlConfig = new Compartment();
const isAutoTyping = ref(false);
let autoTypingController = { cancelled: false };

const sqlSnippets = [
  snippetCompletion("INSERT INTO ${table} (${columns}) VALUES (${values});", {
    label: "INSERT",
    detail: "Insert template",
    type: "keyword",
  }),
  snippetCompletion(
    "UPDATE ${table} SET ${column} = ${value} WHERE ${condition};",
    {
      label: "UPDATE",
      detail: "Update template",
      type: "keyword",
    },
  ),
  snippetCompletion("DELETE FROM ${table} WHERE ${condition};", {
    label: "DELETE",
    detail: "Delete template",
    type: "keyword",
  }),
  snippetCompletion(
    "CREATE TABLE ${name} (\n  id INTEGER PRIMARY KEY AUTOINCREMENT,\n  ${column} TEXT\n);",
    {
      label: "CREATE TABLE",
      detail: "Create table template",
      type: "keyword",
    },
  ),
  snippetCompletion("SELECT * FROM ${table} WHERE ${condition};", {
    label: "SELECT",
    detail: "Select template",
    type: "keyword",
  }),
];

const myTheme = EditorView.theme(
  {
    "&": {
      height: "140px",
      backgroundColor: "#fdfbf6",
    },
    ".cm-content": {
      fontFamily: "'Kalam', cursive",
      fontSize: "18px",
      padding: "16px",
      caretColor: "#2d2d2d",
    },
    "&.cm-focused .cm-cursor": {
      borderLeftColor: "#2d2d2d",
    },
    "&.cm-focused .cm-selectionBackground, .cm-selectionBackground, .cm-content ::selection":
      {
        backgroundColor: "#c6f0b3 !important",
      },
    ".cm-gutters": {
      backgroundColor: "#fdfbf6",
      color: "#2d2d2d",
      border: "none",
      display: "none",
    },
    ".cm-activeLine": {
      backgroundColor: "transparent",
    },
    ".cm-tooltip": {
      backgroundColor: "#fdfbf6",
      border: "2px solid #2d2d2d",
      borderRadius: "8px",
      boxShadow: "4px 4px 0 rgba(0,0,0,0.1)",
      fontFamily: "'Kalam', cursive",
    },
    ".cm-tooltip-autocomplete > ul > li": {
      padding: "4px 8px",
    },
    ".cm-tooltip-autocomplete > ul > li[aria-selected]": {
      backgroundColor: "#c6f0b3",
      color: "#2d2d2d",
    },
  },
  { dark: false },
);

const updateMask = () => {
  const el = tabRefs.value[activePreset.value];
  if (el) {
    maskStyle.value = {
      left: `${el.offsetLeft}px`,
      width: `${el.offsetWidth}px`,
    };
  }
  Object.keys(tabRefs.value).forEach((key) => {
    if (tabRefs.value[key]) {
      tabWidths.value[key] = tabRefs.value[key].offsetWidth;
    }
  });
};

const getTabPath = (width) => {
  const slant = 12;
  const height = 40;
  const strokeWidth = 2;
  const topY = strokeWidth;
  const bottomY = height;
  return `M 0,${bottomY} L ${slant},${topY} L ${
    width - slant
  },${topY} L ${width},${bottomY}`;
};

const setPreset = (action, options = {}) => {
  const { applyValue = true } = options;
  if (!presets[action]) return;
  activePreset.value = action;

  if (applyValue) {
    emit("update:modelValue", presets[action]);
    if (view) {
      view.dispatch({
        changes: {
          from: 0,
          to: view.state.doc.length,
          insert: presets[action],
        },
        annotations: Transaction.userEvent.of("codex-auto"),
        selection: EditorSelection.cursor(presets[action].length),
      });
    }
  }

  nextTick(updateMask);
};

const handleExecute = () => {
  emit("execute");
};

let resizeObserver = null;
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const focusEditor = () => {
  if (view) {
    view.focus();
  }
};

const clearEditor = () => {
  if (view) {
    view.dispatch({
      changes: { from: 0, to: view.state.doc.length, insert: "" },
      annotations: Transaction.userEvent.of("codex-auto"),
      selection: EditorSelection.cursor(0),
    });
  }
};

const cancelAutoTyping = () => {
  autoTypingController.cancelled = true;
  isAutoTyping.value = false;
};

const handleComponentClick = () => {
  if (isAutoTyping.value) {
    cancelAutoTyping();
    emit("user-input");
  }
  focusEditor();
};

const typeText = async (text, delayMs = 40) => {
  if (!view) return false;

  autoTypingController = { cancelled: false };
  isAutoTyping.value = true;
  focusEditor();

  for (let i = 0; i < text.length; i++) {
    if (autoTypingController.cancelled) break;
    view.dispatch({
      changes: {
        from: view.state.doc.length,
        to: view.state.doc.length,
        insert: text[i],
      },
      annotations: Transaction.userEvent.of("codex-auto"),
      selection: EditorSelection.cursor(view.state.doc.length + 1),
    });
    await delay(delayMs);
  }

  const completed = !autoTypingController.cancelled;
  isAutoTyping.value = false;

  if (completed) {
    emit("execute");
  }

  return completed;
};

onMounted(() => {
  // Init CodeMirror
  const startState = EditorState.create({
    doc: props.modelValue,
    extensions: [
      Prec.highest(
        keymap.of([
          {
            key: "Mod-Enter",
            run: () => {
              handleExecute();
              return true;
            },
          },
        ]),
      ),
      basicSetup,
      sqlConfig.of(
        sql({
          dialect: SQLite,
          schema: props.schema,
          upperCaseKeywords: true,
        }),
      ),
      // Add snippets as a custom completion source
      SQLite.language.data.of({
        // This line was missing in the original code
        autocomplete: completeFromList(sqlSnippets),
      }),
      EditorView.lineWrapping,
      myTheme,
      EditorView.updateListener.of((update) => {
        const hasUserEvent = update.transactions.some((tr) => {
          const userEvent = tr.annotation(Transaction.userEvent);
          if (userEvent === "codex-auto") return false;
          return Boolean(userEvent);
        });

        if (update.docChanged && hasUserEvent) {
          cancelAutoTyping();
          emit("user-input");
        }

        if (update.docChanged) {
          emit("update:modelValue", update.state.doc.toString());
        }
      }),
    ],
  });

  view = new EditorView({
    state: startState,
    parent: editorContainer.value,
  });

  if (typeof window !== "undefined" && toolbarRef.value) {
    resizeObserver = new ResizeObserver(() => {
      updateMask();
    });
    resizeObserver.observe(toolbarRef.value);
  }

  nextTick(() => {
    setTimeout(updateMask, 100);
  });
});

onUnmounted(() => {
  if (resizeObserver) {
    resizeObserver.disconnect();
  }
  if (view) {
    view.destroy();
  }
});

let lastProcessing = props.isProcessing;
watch(
  () => props.isProcessing,
  (newVal) => {
    if (lastProcessing && !newVal) {
      emit("execution-complete");
    }
    lastProcessing = newVal;
  },
);

watch(
  () => props.modelValue,
  (newVal) => {
    if (view && newVal !== view.state.doc.toString()) {
      view.dispatch({
        changes: { from: 0, to: view.state.doc.length, insert: newVal || "" },
        selection: EditorSelection.cursor((newVal || "").length),
        annotations: Transaction.userEvent.of("codex-auto"),
      });
    }

    if (newVal !== presets[activePreset.value]) {
      const found = Object.keys(presets).find((key) => presets[key] === newVal);
      if (found) {
        activePreset.value = found;
        nextTick(updateMask);
      }
      nextTick(updateMask);
    }
  },
);

watch(
  () => props.schema,
  (newSchema) => {
    if (view) {
      view.dispatch({
        effects: sqlConfig.reconfigure(
          sql({
            dialect: SQLite,
            schema: newSchema,
            upperCaseKeywords: true,
          }),
        ),
      });
    }
  },
  { deep: true },
);

defineExpose({
  setPreset,
  focusEditor,
  clearEditor,
  typeText,
  cancelAutoTyping,
});
</script>

<template>
  <section class="sql-window" @click="handleComponentClick">
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
          update: 'Update',
          delete: 'Delete',
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
      <div ref="editorContainer" class="sql-editor-mount"></div>
    </div>

    <div class="window-footer">
      <div
        class="enter-hint-container"
        @click="handleExecute"
        style="cursor: pointer"
        title="Click to run or press Ctrl + Enter"
      >
        <span class="hint">Press</span>
        <div class="keys-row">
          <svg class="key-cap" width="38" height="26" viewBox="0 0 38 26">
            <rect
              x="1"
              y="1"
              width="36"
              height="22"
              rx="4"
              fill="#fff"
              stroke="#2d2d2d"
              stroke-width="2"
            />
            <path
              d="M1 21 L1 23 A 2 2 0 0 0 3 25 L35 25 A 2 2 0 0 0 37 23 L37 21"
              fill="none"
              stroke="#2d2d2d"
              stroke-width="2"
            />
            <text
              x="19"
              y="16"
              text-anchor="middle"
              font-family="sans-serif"
              font-size="11"
              font-weight="bold"
              fill="#2d2d2d"
            >
              Ctrl
            </text>
          </svg>
          <span class="hint-plus">+</span>
          <svg class="key-cap" width="46" height="26" viewBox="0 0 46 26">
            <rect
              x="1"
              y="1"
              width="44"
              height="22"
              rx="4"
              fill="#fff"
              stroke="#2d2d2d"
              stroke-width="2"
            />
            <path
              d="M1 21 L1 23 A 2 2 0 0 0 3 25 L43 25 A 2 2 0 0 0 45 23 L45 21"
              fill="none"
              stroke="#2d2d2d"
              stroke-width="2"
            />
            <text
              x="23"
              y="16"
              text-anchor="middle"
              font-family="sans-serif"
              font-size="11"
              font-weight="bold"
              fill="#2d2d2d"
            >
              Enter
            </text>
          </svg>
        </div>
        <span class="hint">to execute.</span>
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
  transition:
    left 0.3s cubic-bezier(0.4, 0, 0.2, 1),
    width 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  z-index: 2;
}
.tool-btn .icon {
  font-size: 14px;
}

.window-content {
  border-bottom: 2px solid #2d2d2d;
  background: #fdfbf6;
}

.sql-editor-mount :deep(.cm-editor) {
  outline: none;
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
  gap: 8px;
  user-select: none;
}

.keys-row {
  display: flex;
  align-items: center;
  gap: 4px;
}

.key-cap {
  display: block;
}

.hint-plus {
  font-family: "Kalam", cursive;
  font-size: 16px;
  font-weight: 700;
  color: #2d2d2d;
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
