import { chromium, type Browser } from "playwright";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

type IconDefinition = {
  name: string;
  size: number;
  paddingPct?: number;
};

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const svgPath = path.resolve(__dirname, "../public/logo.svg");
const outputDir = path.resolve(__dirname, "../public");

const standardIcons: IconDefinition[] = [
  { name: "favicon-16x16.png", size: 16 },
  { name: "favicon-32x32.png", size: 32 },
  { name: "apple-touch-icon.png", size: 180 },
  { name: "pwa-icon-192.png", size: 192 },
  { name: "pwa-icon-512.png", size: 512 },
];

const maskableIcons: IconDefinition[] = [
  {
    name: "pwa-icon-192-maskable.png",
    size: 192,
    paddingPct: 12,
  },
  {
    name: "pwa-icon-512-maskable.png",
    size: 512,
    paddingPct: 12,
  },
];

async function renderIcon(
  browser: Browser,
  svgContent: string,
  definition: IconDefinition,
): Promise<Buffer> {
  const paddingPct = definition.paddingPct ?? 0;
  const svgScale = Math.max(0, 100 - paddingPct * 2);
  const page = await browser.newPage({
    viewport: { width: definition.size, height: definition.size },
    deviceScaleFactor: 1,
  });

  await page.setContent(
    `
    <html>
      <head>
        <style>
          html, body {
            margin: 0;
            padding: 0;
            width: 100%;
            height: 100%;
            background: transparent;
          }
          body {
            display: flex;
            align-items: center;
            justify-content: center;
          }
          .icon-wrapper {
            width: ${svgScale}%;
            height: ${svgScale}%;
            display: flex;
            align-items: center;
            justify-content: center;
          }
          svg {
            width: 100%;
            height: 100%;
          }
        </style>
      </head>
      <body>
        <div class="icon-wrapper">
          ${svgContent}
        </div>
      </body>
    </html>
  `,
  );

  const buffer = await page.screenshot({
    omitBackground: true,
    fullPage: true,
  });
  await page.close();
  return buffer;
}

function buildIco(entries: { size: number; buffer: Buffer }[]): Buffer {
  const count = entries.length;
  const header = Buffer.alloc(6 + count * 16);

  header.writeUInt16LE(0, 0); // reserved
  header.writeUInt16LE(1, 2); // ICO type
  header.writeUInt16LE(count, 4); // image count

  let offset = 6 + count * 16;
  entries.forEach((entry, index) => {
    const directoryOffset = 6 + index * 16;
    header.writeUInt8(entry.size === 256 ? 0 : entry.size, directoryOffset); // width
    header.writeUInt8(entry.size === 256 ? 0 : entry.size, directoryOffset + 1); // height
    header.writeUInt8(0, directoryOffset + 2); // colors in palette
    header.writeUInt8(0, directoryOffset + 3); // reserved
    header.writeUInt16LE(1, directoryOffset + 4); // color planes
    header.writeUInt16LE(32, directoryOffset + 6); // bits per pixel
    header.writeUInt32LE(entry.buffer.length, directoryOffset + 8); // data size
    header.writeUInt32LE(offset, directoryOffset + 12); // data offset
    offset += entry.buffer.length;
  });

  return Buffer.concat([header, ...entries.map((entry) => entry.buffer)]);
}

async function main(): Promise<void> {
  const svgContent = await readFile(svgPath, "utf8");
  await mkdir(outputDir, { recursive: true });

  let browser: Browser | null = null;
  try {
    browser = await chromium.launch({ headless: true });
  } catch (error) {
    console.error(
      "Failed to launch Chromium. Install Playwright browsers with `npx playwright install chromium` and retry.",
    );
    throw error;
  }
  try {
    if (!browser) {
      throw new Error("Chromium browser was not initialized.");
    }
    const iconBuffers = new Map<string, Buffer>();
    for (const definition of [...standardIcons, ...maskableIcons]) {
      const buffer = await renderIcon(browser, svgContent, definition);
      iconBuffers.set(definition.name, buffer);
    }

    await Promise.all(
      Array.from(iconBuffers.entries()).map(([name, buffer]) =>
        writeFile(path.join(outputDir, name), buffer),
      ),
    );

    const icoBuffer = buildIco([
      { size: 16, buffer: iconBuffers.get("favicon-16x16.png")! },
      { size: 32, buffer: iconBuffers.get("favicon-32x32.png")! },
    ]);
    await writeFile(path.join(outputDir, "favicon.ico"), icoBuffer);

    console.log(
      "Generated icons:",
      [...iconBuffers.keys(), "favicon.ico"].join(", "),
    );
  } finally {
    await browser?.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
