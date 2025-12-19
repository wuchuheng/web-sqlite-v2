<template>
  <footer class="stack-footer">
    <div class="stack-item">
      <div class="icon-container">
        <!-- WASM Logo SVG (Square with notch) -->
        <svg
          width="48"
          height="48"
          viewBox="0 0 48 48"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            d="M8 8 H18 C18 18, 30 18, 30 8 H40 V40 H8 Z"
            stroke="#2d2d2d"
            stroke-width="2"
            fill="#fdfbf6"
            stroke-linejoin="round"
          />
          <text
            x="20"
            y="34"
            font-family="monospace"
            font-size="15"
            fill="#2d2d2d"
            font-weight="bold"
          >
            WA
          </text>
        </svg>
        <!-- Checkmark -->
        <svg class="check-mark" viewBox="0 0 24 24" fill="none">
          <circle
            cx="12"
            cy="12"
            r="10"
            fill="#d9f2d0"
            stroke="#2d2d2d"
            stroke-width="2"
          />
          <path
            d="M7 12L10 15L17 8"
            stroke="#19551d"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
          />
        </svg>
      </div>
      <span>WASM</span>
    </div>

    <div class="plus">+</div>

    <div class="stack-item">
      <div class="icon-container">
        <!-- Database Cylinder SVG -->
        <svg
          width="48"
          height="48"
          viewBox="0 0 48 48"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <!-- Body -->
          <path
            d="M8 10V38C8 41.3137 15.1634 44 24 44C32.8366 44 40 41.3137 40 38V10"
            stroke="#2d2d2d"
            stroke-width="2"
            fill="#fdfbf6"
          />
          <!-- Top Section Rim Curve -->
          <!-- <path
            d="M8 14C8 17.3137 15.1634 20 24 20C32.8366 20 40 17.3137 40 14"
            stroke="#2d2d2d"
            stroke-width="2"
          /> -->
          <!-- Middle Curve -->
          <path
            d="M8 28C8 31.3137 15.1634 34 24 34C32.8366 34 40 31.3137 40 28"
            stroke="#2d2d2d"
            stroke-width="2"
          />
          <!-- Top Lid -->
          <ellipse
            cx="24"
            cy="10"
            rx="16"
            ry="6"
            stroke="#2d2d2d"
            stroke-width="2"
            fill="#fdfbf6"
          />
        </svg>
        <!-- Checkmark -->
        <svg class="check-mark" viewBox="0 0 24 24" fill="none">
          <circle
            cx="12"
            cy="12"
            r="10"
            fill="#d9f2d0"
            stroke="#2d2d2d"
            stroke-width="2"
          />
          <path
            d="M7 12L10 15L17 8"
            stroke="#19551d"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
          />
        </svg>
      </div>
      <span>Database</span>
    </div>

    <div class="plus">+</div>

    <div class="stack-item">
      <div class="icon-container">
        <!-- Folder SVG -->
        <svg
          width="48"
          height="48"
          viewBox="0 0 48 48"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            d="M4 8H18L22 12H44V40H4V8Z"
            stroke="#2d2d2d"
            stroke-width="2"
            fill="#fdfbf6"
          />
        </svg>
        <!-- Checkmark -->
        <svg class="check-mark" viewBox="0 0 24 24" fill="none">
          <circle
            cx="12"
            cy="12"
            r="10"
            fill="#d9f2d0"
            stroke="#2d2d2d"
            stroke-width="2"
          />
          <path
            d="M7 12L10 15L17 8"
            stroke="#19551d"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
          />
        </svg>
      </div>
      <span>Folder</span>
    </div>
  </footer>
</template>

<style scoped>
.stack-footer {
  display: flex;
  gap: 20px;
  align-items: center;
  margin-top: 10px;
  color: #2d2d2d;
  font-weight: 700;
  font-family: "Kalam", cursive;
}

.stack-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  position: relative;
  font-size: 14px;
}

.icon-container {
  position: relative;
  width: 60px;
  height: 50px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.check-mark {
  position: absolute;
  bottom: -4px;
  right: -4px;
  width: 18px;
  height: 18px;
  filter: drop-shadow(1px 1px 0 rgba(0, 0, 0, 0.1));
}

.plus {
  font-weight: 700;
  color: #2d2d2d;
  font-size: 18px;
  padding-bottom: 20px; /* Align visually with icons */
}
</style>
