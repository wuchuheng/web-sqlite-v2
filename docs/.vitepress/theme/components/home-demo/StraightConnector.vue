<script setup>
import { computed, onMounted, onUnmounted, watch, ref } from "vue";

const props = defineProps({
  from: Object, // Target element or ref
  to: Object,
  container: Object,
  direction: { type: String, default: "vertical" }, // 'vertical' | 'horizontal'
  offset: { type: Number, default: 0 },
  showArrow: { type: Boolean, default: true },
});

const p1 = ref({ x: 0, y: 0 });
const p2 = ref({ x: 0, y: 0 });

let resizeObserver = null;
let debounceTimer = null;

const getTargetEl = (target) => {
  if (!target) return null;
  return (
    target.tableRef ||
    target.folderRef ||
    target.tableEl ||
    target.folderEl ||
    target.$el ||
    target
  );
};

const isOpfsEl = (el) => {
  return (
    el?.classList?.contains("opfs-view") ||
    el?.querySelector?.(".folder-header") ||
    el?.textContent?.includes("OPFS")
  );
};

const updatePoints = () => {
  const fromEl = getTargetEl(props.from);
  const toEl = getTargetEl(props.to);
  const containerEl = getTargetEl(props.container);

  if (!fromEl || !toEl || !containerEl) return;

  const fromRect = fromEl.getBoundingClientRect();
  const toRect = toEl.getBoundingClientRect();
  const containerRect = containerEl.getBoundingClientRect();

  if (fromRect.width === 0 || toRect.width === 0) return;

  if (props.direction === "vertical") {
    // Averaged X for a perfectly vertical line centered between both elements
    const fromCenterX = fromRect.left + fromRect.width / 2 - containerRect.left;
    const toCenterX = toRect.left + toRect.width / 2 - containerRect.left;
    const centerX = (fromCenterX + toCenterX) / 2;

    // Determine facing sides: we always connect the gap BETWEEN them
    const fromIsAbove = fromRect.top < toRect.top;
    let y1, y2;

    if (fromIsAbove) {
      // From is Top, To is Bottom. Connect Bottom of Top to Top of Bottom.
      y1 = fromRect.bottom - containerRect.top;
      y2 = toRect.top - containerRect.top;
      if (isOpfsEl(toEl)) y2 += (20 / 180) * toRect.height;
    } else {
      // From is Bottom, To is Top. Connect Top of Bottom to Bottom of Top.
      y1 = fromRect.top - containerRect.top;
      if (isOpfsEl(fromEl)) y1 += (20 / 180) * fromRect.height;
      y2 = toRect.bottom - containerRect.top;
    }

    p1.value = { x: centerX + props.offset, y: y1 };
    p2.value = { x: centerX + props.offset, y: y2 };
  } else {
    // Horizontal: connect Right of left element to Left of right element
    const fromCenterY = fromRect.top + fromRect.height / 2 - containerRect.top;
    const toCenterY = toRect.top + toRect.height / 2 - containerRect.top;
    const centerY = (fromCenterY + toCenterY) / 2;

    const fromIsLeft = fromRect.left < toRect.left;
    const x1 = fromIsLeft
      ? fromRect.right - containerRect.left
      : fromRect.left - containerRect.left;
    const x2 = fromIsLeft
      ? toRect.left - containerRect.left
      : toRect.right - containerRect.left;

    p1.value = { x: x1, y: centerY + props.offset };
    p2.value = { x: x2, y: centerY + props.offset };
  }
};

const debouncedUpdate = () => {
  if (debounceTimer) clearTimeout(debounceTimer);
  debounceTimer = setTimeout(updatePoints, 50);
};

onMounted(() => {
  if (typeof window !== "undefined") {
    resizeObserver = new ResizeObserver(() => {
      requestAnimationFrame(updatePoints);
      debouncedUpdate();
    });

    const fromEl = getTargetEl(props.from);
    const toEl = getTargetEl(props.to);
    if (fromEl) resizeObserver.observe(fromEl);
    if (toEl) resizeObserver.observe(toEl);

    setTimeout(updatePoints, 100);
  }
});

onUnmounted(() => {
  if (resizeObserver) resizeObserver.disconnect();
  if (debounceTimer) clearTimeout(debounceTimer);
});

watch(
  [() => props.from, () => props.to, () => props.direction, () => props.offset],
  () => {
    if (resizeObserver) {
      resizeObserver.disconnect();
      const fromEl = getTargetEl(props.from);
      const toEl = getTargetEl(props.to);
      if (fromEl) resizeObserver.observe(fromEl);
      if (toEl) resizeObserver.observe(toEl);
    }
    updatePoints();
  }
);

const angle = computed(() => {
  const dx = p2.value.x - p1.value.x;
  const dy = p2.value.y - p1.value.y;
  return Math.atan2(dy, dx) * (180 / Math.PI);
});

const arrowPosition = computed(() => {
  const dx = p2.value.x - p1.value.x;
  const dy = p2.value.y - p1.value.y;
  const length = Math.sqrt(dx * dx + dy * dy);
  if (length === 0) return p2.value;
  return {
    x: p2.value.x - (dx / length) * 7, // Reduced gap from 12 to 7
    y: p2.value.y - (dy / length) * 7,
  };
});

const lineEnd = computed(() => {
  if (!props.showArrow) return p2.value;
  const dx = p2.value.x - p1.value.x;
  const dy = p2.value.y - p1.value.y;
  const length = Math.sqrt(dx * dx + dy * dy);
  if (length === 0) return p2.value;
  return {
    x: p2.value.x - (dx / length) * 16, // 7px gap + 9px (arrow length minus 3px overlap)
    y: p2.value.y - (dy / length) * 16,
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
        stroke-dasharray="6 4"
      />
    </svg>

    <!-- Layer 2: Dots and Arrow (in front) -->
    <svg class="connector-svg overlay-layer" xmlns="http://www.w3.org/2000/svg">
      <circle
        :cx="p1.x"
        :cy="p1.y"
        r="5"
        fill="#c6f0b3"
        stroke="#2d2d2d"
        stroke-width="2"
      />
      <circle
        :cx="p2.x"
        :cy="p2.y"
        r="5"
        fill="#c6f0b3"
        stroke="#2d2d2d"
        stroke-width="2"
      />
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
