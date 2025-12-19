<script setup>
defineProps({
  isActive: Boolean,
});
</script>

<template>
  <section class="connector-section">
    <div class="connector-container">
      <!-- Worker Label with Lightning Icon -->
      <div class="worker-label" :class="{ active: isActive }">
        <svg
          class="lightning-icon"
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            d="M13 2L4 14H11L9 22L18 10H11L13 2Z"
            stroke="#2d2d2d"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
            :fill="isActive ? '#FFD700' : 'none'"
          />
        </svg>
        <span>Non-blocking web worker</span>
      </div>
    </div>
  </section>
</template>

<style scoped>
.connector-section {
  position: relative;
  height: 80px; /* Reduced height as per cleaner look */
  width: 100%;
  display: flex;
  justify-content: center;
  align-items: center;
}

.connector-container {
  position: relative;
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
}

.worker-label {
  position: relative;
  z-index: 10;
  display: flex;
  align-items: center;
  gap: 8px;
  background: #f7f4ec; /* Match background to hide line behind text if needed */
  padding: 4px 10px;
  font-size: 14px;
  font-weight: 700;
  color: #2d2d2d;
  font-family: "Kalam", cursive;
}

.lightning-icon {
  width: 18px;
  height: 18px;
}

.worker-label.active .lightning-icon path {
  fill: #ffd700; /* Yellow fill when active */
  filter: drop-shadow(0 0 4px rgba(255, 215, 0, 0.6));
  transition: fill 0.2s ease;
}
</style>
