<script setup>
import { computed, onMounted, ref } from "vue";

const props = defineProps({
  deviceType: { type: String, default: "sm" },
  dbName: { type: String, default: "local-demo" },
});

const folderRef = ref(null);
const isDownloading = ref(false);
const sqliteHandle = ref(null);
const fileMeta = ref({
  name: "No database file",
  size: null,
});
const statusText = ref("");

const isOpfsAvailable =
  typeof navigator !== "undefined" &&
  !!navigator.storage &&
  typeof navigator.storage.getDirectory === "function";

const VERSION_RE = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/;

const dbDirName = computed(() => {
  const rawName = typeof props.dbName === "string" ? props.dbName.trim() : "";
  const baseName = rawName === "" ? "local-demo" : rawName;
  return baseName.endsWith(".sqlite3") ? baseName : `${baseName}.sqlite3`;
});

const folderLabel = computed(() => `${dbDirName.value}/`);

const formatBytes = (bytes) => {
  if (typeof bytes !== "number" || Number.isNaN(bytes)) return "n/a";
  if (bytes < 1024) return `${bytes} B`;
  const units = ["KB", "MB", "GB"];
  const exponent = Math.min(
    units.length - 1,
    Math.floor(Math.log(bytes) / Math.log(1024)) - 1,
  );
  const value = bytes / 1024 ** (exponent + 1);
  return `${value.toFixed(value >= 10 ? 0 : 1)} ${units[exponent]}`;
};

const displayFilename = computed(() => {
  const sizeLabel =
    fileMeta.value.size === null ? "" : ` (${formatBytes(fileMeta.value.size)})`;
  return `${fileMeta.value.name}${sizeLabel}`;
});

const parseVersion = (version) => version.split(".").map((part) => Number(part));

const compareVersions = (a, b) => {
  const aParts = parseVersion(a);
  const bParts = parseVersion(b);
  for (let i = 0; i < aParts.length; i += 1) {
    if (aParts[i] !== bParts[i]) {
      return aParts[i] > bParts[i] ? 1 : -1;
    }
  }
  return 0;
};

let refreshChain = Promise.resolve();

const resolveActiveDbHandle = async (dbDir) => {
  const versionDirs = [];
  // eslint-disable-next-line no-restricted-syntax
  for await (const [name, handle] of dbDir.entries()) {
    if (handle.kind === "directory" && VERSION_RE.test(name)) {
      versionDirs.push({ name, handle });
    }
  }

  if (versionDirs.length > 0) {
    versionDirs.sort((a, b) => compareVersions(a.name, b.name));
    const latest = versionDirs[versionDirs.length - 1];
    const dbHandle = await latest.handle.getFileHandle("db.sqlite3");
    return { name: `${latest.name}/db.sqlite3`, handle: dbHandle };
  }

  const dbHandle = await dbDir.getFileHandle("default.sqlite3");
  return { name: "default.sqlite3", handle: dbHandle };
};

const loadMeta = async () => {
  if (!isOpfsAvailable) {
    statusText.value = "OPFS not available in this browser.";
    return;
  }

  try {
    const root = await navigator.storage.getDirectory();
    let dbDir;
    try {
      dbDir = await root.getDirectoryHandle(dbDirName.value);
    } catch (error) {
      const name = error?.name;
      if (name === "NotFoundError") {
        sqliteHandle.value = null;
        fileMeta.value = { name: "No database file", size: null };
        statusText.value = `No ${dbDirName.value}/ folder in OPFS. Run a query to create one.`;
        return;
      }
      if (name === "TypeMismatchError") {
        sqliteHandle.value = null;
        fileMeta.value = { name: "No database file", size: null };
        statusText.value = `A file named ${dbDirName.value} already exists. Remove it to create the folder.`;
        return;
      }
      throw error;
    }

    const activeEntry = await resolveActiveDbHandle(dbDir);
    const file = await activeEntry.handle.getFile();

    sqliteHandle.value = activeEntry.handle;
    fileMeta.value = { name: activeEntry.name, size: file.size };
    statusText.value = "";
  } catch (err) {
    sqliteHandle.value = null;
    fileMeta.value = { name: "No database file", size: null };
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
    anchor.download = fileMeta.value.name.replace(/\//g, "__");
    anchor.click();
    URL.revokeObjectURL(url);
    fileMeta.value = { name: fileMeta.value.name, size: file.size };
  } catch (err) {
    statusText.value = err?.message || "Download failed.";
  } finally {
    isDownloading.value = false;
  }
};

const refresh = () => {
  refreshChain = refreshChain.catch(() => {}).then(() => loadMeta());
  return refreshChain;
};

onMounted(() => {
  refresh();
});

defineExpose({
  folderRef,
  refresh,
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
        <div class="folder-subtitle">{{ folderLabel }}</div>
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
}

.folder-svg-container {
  position: relative;
  width: 100%;
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

.folder-subtitle {
  margin-top: 4px;
  font-size: 12px;
  color: #6a665e;
  font-family: "Kalam", cursive;
}

.file-list {
  margin-top: 8px;
  background: #fff;
  border-radius: 8px;
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
