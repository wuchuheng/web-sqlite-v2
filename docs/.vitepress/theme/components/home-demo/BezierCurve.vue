<script setup>
import { computed } from "vue";

const props = defineProps({
  p1: { type: Object, required: true }, // { x, y }
  p2: { type: Object, required: true },
  p3: { type: Object, required: true },
});

/**
 * To make a quadratic Bezier curve B(t) pass through P2 at t=0.5:
 * B(0.5) = (1-0.5)^2 * P1 + 2(1-0.5)(0.5) * Pc + 0.5^2 * P3 = P2
 * 0.25 * P1 + 0.5 * Pc + 0.25 * P3 = P2
 * 0.5 * Pc = P2 - 0.25 * P1 - 0.25 * P3
 * Pc = 2 * P2 - 0.5 * P1 - 0.5 * P3
 */
const controlPoint = computed(() => {
  return {
    x: 2 * props.p2.x - 0.5 * props.p1.x - 0.5 * props.p3.x,
    y: 2 * props.p2.y - 0.5 * props.p1.y - 0.5 * props.p3.y,
  };
});

const pathData = computed(() => {
  return `M ${props.p1.x} ${props.p1.y} Q ${controlPoint.value.x} ${controlPoint.value.y} ${pathEnd.value.x} ${pathEnd.value.y}`;
});

/**

 * Calculate the angle of the curve at the end point (t=1)

 * The tangent at t=1 is 2 * (P3 - Pc)

 */

const arrowRotation = computed(() => {
  const dx = props.p3.x - controlPoint.value.x;

  const dy = props.p3.y - controlPoint.value.y;

  const angle = Math.atan2(dy, dx) * (180 / Math.PI);

  return angle;
});

/**

 * Calculate the arrow position with a small offset (gap) from the dot.

 */

const arrowPosition = computed(() => {
  const dx = props.p3.x - controlPoint.value.x;
  const dy = props.p3.y - controlPoint.value.y;
  const length = Math.sqrt(dx * dx + dy * dy);
  const gap = 12; // Gap size in pixels

  if (length === 0) return props.p3;

  return {
    x: props.p3.x - (dx / length) * gap,
    y: props.p3.y - (dy / length) * gap,
  };
});

/**
 * The end of the dotted line should be at the back of the arrow.
 * Arrow length is 12px.
 */
const pathEnd = computed(() => {
  const dx = props.p3.x - controlPoint.value.x;
  const dy = props.p3.y - controlPoint.value.y;
  const length = Math.sqrt(dx * dx + dy * dy);
  const totalOffset = 24; // 12 (gap) + 12 (arrow length)

  if (length === 0) return props.p3;

  return {
    x: props.p3.x - (dx / length) * totalOffset,
    y: props.p3.y - (dy / length) * totalOffset,
  };
});
</script>

<template>
  <div class="bezier-container">
    <!-- Layer 1: The Curve (behind components) -->

    <svg class="bezier-svg curve-layer" xmlns="http://www.w3.org/2000/svg">
      <path
        :d="pathData"
        fill="none"
        stroke="#2d2d2d"
        stroke-width="2"
        stroke-dasharray="6 6"
        class="curve-path"
      />
    </svg>

    <!-- Layer 2: The Dots (in front of components) -->

    <svg class="bezier-svg dots-layer" xmlns="http://www.w3.org/2000/svg">
      <!-- Start Point Dot -->

      <circle
        :cx="p1.x"
        :cy="p1.y"
        r="5"
        fill="#c6f0b3"
        stroke="#2d2d2d"
        stroke-width="2"
      />

      <!-- End Point Dot -->

      <circle
        :cx="p3.x"
        :cy="p3.y"
        r="5"
        fill="#c6f0b3"
        stroke="#2d2d2d"
        stroke-width="2"
      />

      <!-- Arrow head pointing in the direction of the curve with a gap -->

      <path
        d="M -12 -6 L 0 0 L -12 6"
        fill="none"
        stroke="#2d2d2d"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
        :transform="`translate(${arrowPosition.x}, ${arrowPosition.y}) rotate(${arrowRotation})`"
      />
    </svg>
  </div>
</template>

<style scoped>
.bezier-container {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
}

.bezier-svg {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  overflow: visible;
}

.curve-layer {
  z-index: 5; /* Behind components */
}

.dots-layer {
  z-index: 20; /* In front of components */
}
</style>
