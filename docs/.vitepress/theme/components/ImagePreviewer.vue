<script setup lang="ts">
import { nextTick, onBeforeUnmount, onMounted, ref, watch } from "vue";
import { inBrowser, useRoute } from "vitepress";

const activeSrc = ref<string | null>(null);
const activeAlt = ref("");
const route = useRoute();

let teardown = () => {};

const close = () => {
  activeSrc.value = null;
  activeAlt.value = "";
  if (inBrowser) {
    document.body.classList.remove("image-preview-lock");
  }
};

const attachImagePreview = () => {
  teardown();
  if (!inBrowser) return;

  const cleanupFns: Array<() => void> = [];
  const images = document.querySelectorAll<HTMLImageElement>(".vp-doc img");

  const wrapImageWithBadge = (img: HTMLImageElement) => {
    if (img.closest(".image-preview-wrapper")) return;

    const wrapper = document.createElement("span");
    wrapper.className = "image-preview-wrapper";

    const badge = document.createElement("span");
    badge.className = "image-preview-badge";
    badge.setAttribute("aria-hidden", "true");
    badge.innerHTML = `
      <svg
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <circle cx="11" cy="11" r="6.5" stroke="currentColor" stroke-width="2" />
        <line x1="15.8" y1="15.8" x2="20" y2="20" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
        <line x1="11" y1="8" x2="11" y2="14" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
        <line x1="8" y1="11" x2="14" y2="11" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
      </svg>
    `;

    const parent = img.parentNode;
    if (!parent) return;

    parent.insertBefore(wrapper, img);
    wrapper.appendChild(img);
    wrapper.appendChild(badge);
  };

  images.forEach((img) => {
    wrapImageWithBadge(img);
    img.style.cursor = "zoom-in";

    const onClick = (event: MouseEvent) => {
      // Respect modified clicks so users can still open images in a new tab.
      if (
        event.button !== 0 ||
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey
      ) {
        return;
      }

      const src = img.currentSrc || img.src;
      if (!src) return;

      event.preventDefault();
      event.stopPropagation();

      activeSrc.value = src;
      activeAlt.value = img.alt || "Image preview";
      document.body.classList.add("image-preview-lock");
    };

    img.addEventListener("click", onClick);
    cleanupFns.push(() => img.removeEventListener("click", onClick));
  });

  teardown = () => {
    cleanupFns.forEach((fn) => fn());
  };
};

const onKeydown = (event: KeyboardEvent) => {
  if (event.key === "Escape") {
    close();
  }
};

onMounted(() => {
  if (!inBrowser) return;
  attachImagePreview();
  window.addEventListener("keydown", onKeydown);
});

watch(
  () => route.path,
  async () => {
    if (!inBrowser) return;
    close();
    await nextTick();
    attachImagePreview();
  },
);

onBeforeUnmount(() => {
  teardown();
  if (inBrowser) {
    window.removeEventListener("keydown", onKeydown);
    document.body.classList.remove("image-preview-lock");
  }
});
</script>

<template>
  <teleport to="body">
    <transition name="image-preview-fade">
      <div
        v-if="activeSrc"
        class="image-preview-backdrop"
        role="dialog"
        aria-modal="true"
        @click="close"
      >
        <img
          class="image-preview-img"
          :src="activeSrc"
          :alt="activeAlt"
          @click.stop
        />
        <button
          class="image-preview-close"
          type="button"
          aria-label="Close image preview"
          @click.stop="close"
        >
          X
        </button>
      </div>
    </transition>
  </teleport>
</template>
