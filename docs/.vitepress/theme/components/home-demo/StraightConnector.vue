<script setup>
import { computed } from "vue";

const props = defineProps({
  p1: { type: Object, required: true }, // { x, y }
  p2: { type: Object, required: true }, // { x, y }
  showArrow: { type: Boolean, default: true },
});

const angle = computed(() => {
  const dx = props.p2.x - props.p1.x;
  const dy = props.p2.y - props.p1.y;
  return Math.atan2(dy, dx) * (180 / Math.PI);
});

const arrowPosition = computed(() => {
  const dx = props.p2.x - props.p1.x;
  const dy = props.p2.y - props.p1.y;
  const length = Math.sqrt(dx * dx + dy * dy);
  const gap = 12;

  if (length === 0) return props.p2;

  return {
    x: props.p2.x - (dx / length) * gap,
    y: props.p2.y - (dy / length) * gap,
  };
});

const lineEnd = computed(() => {
  if (!props.showArrow) return props.p2;

  const dx = props.p2.x - props.p1.x;
  const dy = props.p2.y - props.p1.y;
  const length = Math.sqrt(dx * dx + dy * dy);
  const totalOffset = 24; // 12 (gap) + 12 (arrow length)

  if (length === 0) return props.p2;

  return {
    x: props.p2.x - (dx / length) * totalOffset,
    y: props.p2.y - (dy / length) * totalOffset,
  };
});
</script>

<template>
  <div class="connector-container">
    <!-- Layer 1: The Line (behind components) -->
    <svg class="connector-svg line-layer" xmlns="http://www.w3.org/2000/svg">
      <line
        :x1="p1.x"
        :y1="p1.y"
        :x2="lineEnd.x"
        :y2="lineEnd.y"
        stroke="#2d2d2d"
        stroke-width="2"
        stroke-dasharray="6 6"
      />
    </svg>

    <!-- Layer 2: Dots and Arrow (in front) -->
    <svg class="connector-svg overlay-layer" xmlns="http://www.w3.org/2000/svg">
      <!-- Start Dot -->
      <circle
        :cx="p1.x"
        :cy="p1.y"
        r="5"
        fill="#c6f0b3"
        stroke="#2d2d2d"
        stroke-width="2"
      />

      <!-- End Dot -->
      <circle
        :cx="p2.x"
        :cy="p2.y"
        r="5"
        fill="#c6f0b3"
        stroke="#2d2d2d"
        stroke-width="2"
      />

      <!-- Arrow -->
      <path
        v-if="showArrow"
        d="M -12 -6 L 0 0 L -12 6"
        fill="none"
        stroke="#2d2d2d"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
        :transform="`translate(${arrowPosition.x}, ${arrowPosition.y}) rotate(${angle})`"
      />
    </svg>
  </div>
</template>

<style scoped>
.connector-container {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
}

.connector-svg {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  overflow: visible;
}

.line-layer {
  z-index: 5;
}

.overlay-layer {
  z-index: 20;
}
</style>
