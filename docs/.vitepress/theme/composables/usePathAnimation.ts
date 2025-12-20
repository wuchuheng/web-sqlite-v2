import { ref, watch, onUnmounted, nextTick } from "vue";

export const ANIMATION_DURATION = 500; // ms

export function usePathAnimation(isProcessing: { value: boolean }) {
  const progress = ref(1);
  const pathRef = ref<SVGPathElement | null>(null);
  const pathLength = ref(0);
  const maskId = `path-mask-${Math.random().toString(36).slice(2, 9)}`;

  let animationFrame: number | null = null;

  const easeInOutQuad = (t: number) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);

  const animate = (targetValue: number, duration: number) => {
    const startValue = progress.value;
    const startTime = performance.now();

    const step = (currentTime: number) => {
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

  watch(() => isProcessing.value, (newVal) => {
    if (newVal) {
      progress.value = 0;
      setTimeout(() => {
        animate(1, ANIMATION_DURATION);
      }, 20);
    }
  });

  const updatePathLength = () => {
    nextTick(() => {
      if (pathRef.value) {
        pathLength.value = pathRef.value.getTotalLength();
      }
    });
  };

  // Ensure initial length is captured as soon as pathRef is bound
  watch(pathRef, (newVal) => {
    if (newVal) updatePathLength();
  });

  onUnmounted(() => {
    if (animationFrame) cancelAnimationFrame(animationFrame);
  });

  return {
    progress,
    pathRef,
    pathLength,
    maskId,
    updatePathLength
  };
}
