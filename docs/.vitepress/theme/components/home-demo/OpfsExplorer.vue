<script setup>
import { ref } from "vue";
const folderRef = ref(null);

defineProps({
  deviceType: { type: String, default: "sm" },
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
          <span>Persistent Database locally (OPFS)</span>
        </div>
        <div class="file-list">
          <div class="file-item">
            <i class="fa-solid fa-file-code"></i>
            <span class="filename">user.sqlite3</span>
            <button class="download-btn" title="Download DB">
              <i class="fa-solid fa-download"></i>
            </button>
          </div>
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
  padding: 8px;
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
.download-btn:hover {
  transform: scale(1.05);
}
</style>
