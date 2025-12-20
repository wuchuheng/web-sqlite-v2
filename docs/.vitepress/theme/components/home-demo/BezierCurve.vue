<script setup>
import { computed, ref, watch, onMounted, onUnmounted, nextTick } from "vue";

const props = defineProps({
  p1: { type: Object, required: true }, // { x, y }
  p2: { type: Object, required: true },
  p3: { type: Object, required: true },
  isProcessing: { type: Boolean, default: false },
});

// Configuration
const ANIMATION_DURATION = 500; // ms

// Animation state
const progress = ref(1); // 0 to 1
const pathRef = ref(null);
const pathLength = ref(0);
const maskId = `path-mask-${Math.random().toString(36).slice(2, 9)}`;

let animationFrame = null;

/**
 * Easing function: easeInOutQuad
 */
const easeInOutQuad = (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);

const animate = (targetValue, duration) => {
  const startValue = progress.value;
  const startTime = performance.now();

  const step = (currentTime) => {
    const elapsed = currentTime - startTime;
    const t = Math.min(elapsed / duration, 1);
    
    progress.value = startValue + (targetValue - startValue) * easeInOutQuad(t);

    if (t < 1) {
      animationFrame = requestAnimationFrame(step);
    } else {
      animationFrame = null;
    }
  };

  if (animationFrame) cancelAnimationFrame(animationFrame);
  animationFrame = requestAnimationFrame(step);
};

watch(() => props.isProcessing, (newVal) => {
  if (newVal) {
    // Reset and Start drawing
    progress.value = 0;
    // Small delay to ensure the reset is rendered before animation starts
    setTimeout(() => {
      animate(1, ANIMATION_DURATION);
    }, 20);
  }
});

onMounted(() => {
  if (pathRef.value) {
    pathLength.value = pathRef.value.getTotalLength();
  }
});

onUnmounted(() => {
  if (animationFrame) cancelAnimationFrame(animationFrame);
});

// Update path length if points change
watch([() => props.p1, () => props.p2, () => props.p3], () => {
  nextTick(() => {
    if (pathRef.value) {
      pathLength.value = pathRef.value.getTotalLength();
    }
  });
}, { deep: true });

/**
 * Quadratic Bezier point at t
 */
const getPointAtT = (t) => {
  const x = Math.pow(1 - t, 2) * props.p1.x + 2 * (1 - t) * t * controlPoint.value.x + Math.pow(t, 2) * props.p3.x;
  const y = Math.pow(1 - t, 2) * props.p1.y + 2 * (1 - t) * t * controlPoint.value.y + Math.pow(t, 2) * props.p3.y;
  return { x, y };
};

/**
 * Tangent angle at t
 */
const getAngleAtT = (t) => {
  const dx = 2 * (1 - t) * (controlPoint.value.x - props.p1.x) + 2 * t * (props.p3.x - controlPoint.value.x);
  const dy = 2 * (1 - t) * (controlPoint.value.y - props.p1.y) + 2 * t * (props.p3.y - controlPoint.value.y);
  return Math.atan2(dy, dx) * (180 / Math.PI);
};

const controlPoint = computed(() => {
  return {
    x: 2 * props.p2.x - 0.5 * props.p1.x - 0.5 * props.p3.x,
    y: 2 * props.p2.y - 0.5 * props.p1.y - 0.5 * props.p3.y,
  };
});

const fullPathData = computed(() => {
  return `M ${props.p1.x} ${props.p1.y} Q ${controlPoint.value.x} ${controlPoint.value.y} ${props.p3.x} ${props.p3.y}`;
});

// Arrow state follows progress
const currentArrowPos = computed(() => getPointAtT(progress.value));
const currentArrowRotation = computed(() => getAngleAtT(progress.value));

// Mask offset to reveal the path
const maskOffset = computed(() => pathLength.value * (1 - progress.value));
</script>

<template>
  <div class="bezier-container">
    <svg class="bezier-svg curve-layer" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <mask :id="maskId">
          <!-- A solid path that reveals the dashed path -->
          <path
            :d="fullPathData"
            fill="none"
            stroke="white"
            stroke-width="10"
            :stroke-dasharray="pathLength"
            :stroke-dashoffset="maskOffset"
            ref="pathRef"
          />
        </mask>
      </defs>

      <path
        :d="fullPathData"
        fill="none"
        stroke="#2d2d2d"
        stroke-width="2"
        stroke-dasharray="6 6"
        class="curve-path"
        :mask="`url(#${maskId})`"
      />
    </svg>

    <svg class="bezier-svg dots-layer" xmlns="http://www.w3.org/2000/svg">
      <circle
        :cx="p1.x"
        :cy="p1.y"
        r="5"
        fill="#c6f0b3"
        stroke="#2d2d2d"
        stroke-width="2"
      />

      <circle
        :cx="p3.x"
        :cy="p3.y"
        r="5"
        fill="#c6f0b3"
        stroke="#2d2d2d"
        stroke-width="2"
        v-if="progress === 1"
      />

      <!-- Animated Arrow head -->
      <path
        d="M -12 -6 L 0 0 L -12 6"
        fill="none"
        stroke="#2d2d2d"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
        :transform="`translate(${currentArrowPos.x}, ${currentArrowPos.y}) rotate(${currentArrowRotation})`"
        v-if="progress > 0"
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
