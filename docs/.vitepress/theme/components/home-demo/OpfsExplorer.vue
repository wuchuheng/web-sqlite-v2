<script setup>
import { computed, onMounted, ref } from "vue";

const folderRef = ref(null);
const isDownloading = ref(false);
const sqliteHandle = ref(null);
const fileMeta = ref({
  name: "No .sqlite3 file",
  size: null,
});
const statusText = ref("");

defineProps({
  deviceType: { type: String, default: "sm" },
});

const isOpfsAvailable =
  typeof navigator !== "undefined" &&
  !!navigator.storage &&
  typeof navigator.storage.getDirectory === "function";

const formatBytes = (bytes) => {
  if (typeof bytes !== "number" || Number.isNaN(bytes)) return "—";
  if (bytes < 1024) return `${bytes} B`;
  const units = ["KB", "MB", "GB"];
  const exponent = Math.min(
    units.length - 1,
    Math.floor(Math.log(bytes) / Math.log(1024)) - 1
  );
  const value = bytes / 1024 ** (exponent + 1);
  return `${value.toFixed(value >= 10 ? 0 : 1)} ${units[exponent]}`;
};

const formattedSize = computed(() => formatBytes(fileMeta.value.size));
const displayFilename = computed(() => {
  const sizeLabel = formattedSize.value === "—" ? "" : ` (${formattedSize.value})`;
  return `${fileMeta.value.name}${sizeLabel}`;
});

const pickFirstSqliteFile = async () => {
  const root = await navigator.storage.getDirectory();
  let entry = null;
  // Choose the first .sqlite3 file we see (alphabetical order depends on the iterator)
  // If multiple exist, the first one becomes the active target.
  // eslint-disable-next-line no-restricted-syntax
  for await (const [name, handle] of root.entries()) {
    if (handle.kind === "file" && name.endsWith(".sqlite3")) {
      entry = { name, handle };
      break;
    }
  }
  return entry;
};

const loadMeta = async () => {
  if (!isOpfsAvailable) {
    statusText.value = "OPFS not available in this browser.";
    return;
  }

  try {
    const entry = await pickFirstSqliteFile();
    if (!entry) {
      sqliteHandle.value = null;
      fileMeta.value = { name: "No .sqlite3 file", size: null };
      statusText.value = "No .sqlite3 file in OPFS. Run a query to create one.";
      return;
    }

    const file = await entry.handle.getFile();
    sqliteHandle.value = entry.handle;
    fileMeta.value = { name: entry.name, size: file.size };
    statusText.value = "";
  } catch (err) {
    sqliteHandle.value = null;
    statusText.value = "Unable to read OPFS. Try running a query first.";
  }
};

const downloadDb = async () => {
  if (!isOpfsAvailable || isDownloading.value) return;
  isDownloading.value = true;
  statusText.value = "";
  try {
    if (!sqliteHandle.value) {
      await loadMeta();
      if (!sqliteHandle.value) {
        statusText.value = "No SQLite file to download yet.";
        return;
      }
    }

    const file = await sqliteHandle.value.getFile();
    const blob = new Blob([await file.arrayBuffer()], {
      type: "application/x-sqlite3",
    });

    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = file.name;
    anchor.click();
    URL.revokeObjectURL(url);
    fileMeta.value = { name: file.name, size: file.size };
  } catch (err) {
    statusText.value = err?.message || "Download failed.";
  } finally {
    isDownloading.value = false;
  }
};

onMounted(() => {
  loadMeta();
});

defineExpose({
  folderRef,
});
</script>

<template>
  <div class="opfs-view" :style="{ width: deviceType === 'sm' ? '100%' : '' }">
    <div class="folder-svg-container" ref="folderRef">
      <!-- Hand-drawn Folder Shape SVG -->
      <svg viewBox="0 0 300 180" preserveAspectRatio="none" class="folder-bg">
        <path
          d="M2,20 L2,178 L298,178 L298,20 L130,20 L110,2 L20,2 L2,20 Z"
          fill="#fdfbf6"
          stroke="#2d2d2d"
          stroke-width="2"
          stroke-linejoin="round"
        />
        <!-- Optional: Line to separate tab visual -->
        <path d="M2,20 L298,20" stroke="#2d2d2d" stroke-width="2" />
      </svg>

      <div class="folder-content">
        <div class="folder-header">
          <i class="fa-regular fa-folder-open"></i>
          <span>Persistent Local File System (OPFS)</span>
        </div>
        <div class="file-list">
          <div class="file-item">
            <i class="fa-solid fa-file-code"></i>
            <span class="filename">{{ displayFilename }}</span>
            <button
              class="download-btn"
              title="Download DB"
              :disabled="!isOpfsAvailable || !sqliteHandle || isDownloading"
              @click="downloadDb"
            >
              <i class="fa-solid fa-download"></i>
              <span v-if="isDownloading" class="download-text">...</span>
            </button>
          </div>
          <p v-if="statusText" class="status-hint">{{ statusText }}</p>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
@import url("/font-awesome/all.min.css");

.opfs-view {
  flex: 1.5;
  position: relative;
  z-index: 10;
  background: #f7f4ec; /* Match page background to mask the curve behind */
  /* Use padding to create space but let SVG handle the shape */
  /* padding: 10px; */
}

.folder-svg-container {
  position: relative;
  width: 100%;
  /* min-height: 140px; */
  /* round border */
}

.folder-bg {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  z-index: 0;
  filter: drop-shadow(3px 3px 0 rgba(0, 0, 0, 0.1));
}

.folder-content {
  position: relative;
  z-index: 1;
  padding: 20px 15px 15px; /* Top padding to clear the tab area */
  display: flex;
  flex-direction: column;
  /* gap: 12px; */
  /* round border */
  /* border-radius: 8px; */
}

.folder-header {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
  font-weight: 700;
  color: #2d2d2d;
  font-family: "Kalam", cursive;
}

.file-list {
  background: #fff;
  border-radius: 8px;
  /* padding: 8px; */
}

.file-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 10px;
  background: #f3f0e7;
  border-radius: 6px;
  font-size: 13px;
  color: #1f1f1f;
  border: 1px solid #2d2d2d; /* Thinner border for item */
}

.filename {
  flex-grow: 1;
  font-family: monospace;
}

.download-btn {
  background: #d9f2d0;
  border: 2px solid #2d2d2d;
  color: #19551d;
  cursor: pointer;
  padding: 4px 6px;
  border-radius: 6px;
  transition: transform 0.08s ease;
}
.download-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}
.download-btn:hover {
  transform: scale(1.05);
}

.status-hint {
  margin-top: 6px;
  font-size: 12px;
  color: #555;
}
</style>
