# Specification: VitePress Logo, Favicon, and PWA Enablement

## Overview

Use the existing `docs/public/logo.svg` for the VitePress navbar brand and modern favicon, generate the required PNG/ICO derivatives for cross-device support, and enable PWA (manifest + service worker) so the docs site is installable and works offline.

## Requirements

- Navbar logo uses `/logo.svg`; favicons include SVG + PNG + ICO fallbacks.
- Manifest served at `/manifest.webmanifest` with app metadata, colors, and PNG icons (192/512) plus maskable variants.
- Service worker auto-updates and precaches built docs assets; runtime navigation fallback remains at `/`.
- Document the conversion and build steps for future maintenance.

## Files and entry points

- `docs/.vitepress/config.ts`: add `head` icons/manifest/meta, set `themeConfig.logo`, and register the PWA plugin.
- `docs/.vitepress/pwa.ts`: centralize PWA options (manifest + workbox).
- `docs/scripts/generate-doc-icons.ts`: TSX-friendly icon generator from `logo.svg`.
- `docs/public/*`: output icons (`favicon.ico`, `favicon-16x16.png`, `favicon-32x32.png`, `apple-touch-icon.png`, `pwa-icon-192.png`, `pwa-icon-512.png`, `pwa-icon-192-maskable.png`, `pwa-icon-512-maskable.png`).
- `docs/package.json`: include `@vite-pwa/vitepress` dev dependency.

## Implementation plan

- Install `@vite-pwa/vitepress` in the docs workspace; keep versions aligned with VitePress.
- Wire `pwa(pwaOptions)` into `vite.plugins` and expose manifest/workbox config via `docs/.vitepress/pwa.ts`.
- Add `head` links/meta for SVG/PNG/ICO favicons, apple touch icon, manifest, and `theme-color`.
- Run `npm run docs:icons` (requires `npx playwright install chromium` once) to render PNGs + ICO from `logo.svg`; commit outputs.
- Validate with `npm run docs:build` and `npm run docs:preview`, then verify in Chrome DevTools Application panel/Lighthouse: manifest found, icons present, service worker registered, installability and offline pass.

## Notes

- SVG-only favicons are insufficient for PWA/Ios; PNG + ICO fallbacks remain necessary.
- Maskable icons include padding to avoid Android clipping. Remove padding only if the artwork already has ample margin.
