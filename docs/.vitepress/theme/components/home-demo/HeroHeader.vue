<script setup>
import { computed } from "vue";
const props = defineProps({
  deviceType: { type: String, default: "lg" },
});

// if the deviceType is lg, then set the padding: 80px 0px
// else set padding-bottom: 20px for the header-header
const layoutConfig = computed(() => {
  if (props.deviceType === "lg") {
    return {
      padding: "80px 0px",
    };
  } else {
    return {
      paddingBottom: "20px",
    };
  }
});
</script>

<template>
  <!-- make the style config here -->
  <div class="hero-header" :style="layoutConfig">
    <h1 class="title">web-sqlite-js</h1>
        <p class="description">
      A friendly, out-of-the-box SQLite database for the web. <br v-if="deviceType !== 'sm'" />
      Making persistent client-side storage simple for every developer.
    </p>

    <div class="cta-group" :class="deviceType">
      <a href="/getting-started.html" class="btn btn-primary">
        <svg class="btn-bg" viewBox="0 0 160 50" preserveAspectRatio="none">
          <path
            d="M3,5 Q10,2 80,3 Q150,4 157,8 Q159,25 156,42 Q150,48 80,47 Q10,46 4,42 Q1,25 3,5 Z"
            fill="#d9f2d0"
            stroke="#2d2d2d"
            stroke-width="2"
          />
        </svg>
        <span>Quickstart</span>
      </a>

      <div class="btn btn-secondary disabled">
        <svg class="btn-bg" viewBox="0 0 200 50" preserveAspectRatio="none">
          <path
            d="M5,8 Q15,4 100,5 Q185,6 195,10 Q198,25 194,40 Q185,46 100,45 Q15,44 6,40 Q2,25 5,8 Z"
            fill="none"
            stroke="#999"
            stroke-width="2"
            stroke-dasharray="4 4"
          />
        </svg>
        <span>Dev Tools (Coming soon)</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.hero-header {
  text-align: center;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
  /* padding-bottom: 20px; */
  width: 100%;
  max-width: 800px;
}

.title {
  font-family: "Kalam", cursive;
  font-size: 48px;
  font-weight: 700;
  margin: 0;
  color: #2d2d2d;
}

.description {
  font-family: "Kalam", cursive;
  font-size: 20px;
  color: #666;
  line-height: 1.4;
  margin: 0;
}

.cta-group {
  display: flex;
  gap: 20px;
  margin-top: 10px;
}

.cta-group.sm {
  flex-direction: column;
  gap: 12px;
}

.btn {
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 12px 24px;
  font-family: "Kalam", cursive;
  font-size: 18px;
  font-weight: 700;
  text-decoration: none;
  color: #2d2d2d;
  cursor: pointer;
  transition: transform 0.1s ease;
}

.btn:hover:not(.disabled) {
  transform: scale(1.05) rotate(-1deg);
}

.btn-bg {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  z-index: 0;
}

.btn span {
  position: relative;
  z-index: 1;
}

.btn-secondary {
  color: #999;
  cursor: default;
}

.btn-primary:active {
  transform: scale(0.98);
}
</style>
