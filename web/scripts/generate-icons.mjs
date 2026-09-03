/**
 * Renders the Tailor Assistant brand mark into the PNG icons the PWA manifest
 * needs. Chrome will not offer "Install app" unless a real 192px and 512px
 * icon resolve, so these must never be placeholders.
 *
 * Run with: npm run icons
 */
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const publicDir = join(dirname(fileURLToPath(import.meta.url)), "..", "public");

const JADE_BRIGHT = "#17A78D";
const JADE_DEEP = "#085347";
const GOLD = "#C0913F";

/** Needle + thread glyph drawn on a 48x48 grid. */
const glyph = `
  <path d="M33.5 13.5 20.8 26.2" stroke="${GOLD}" stroke-width="2.3" stroke-linecap="round"/>
  <path d="m19.2 24.6 4.2 4.2-6 1.8Z" stroke="${GOLD}" stroke-width="2" stroke-linejoin="round" fill="${GOLD}" fill-opacity="0.28"/>
  <path d="M30.6 16.4c-3.3-2-6.9-1-7.9 1.9-.8 2.4 2 3.9 3.7 2.4 1.3-1.2.6-3.4-1.5-3.6-3.4-.4-6.3 2.4-5.9 5.7"
        stroke="#ffffff" stroke-opacity="0.94" stroke-width="2.1" stroke-linecap="round" fill="none"/>
`;

const defs = `
  <defs>
    <linearGradient id="tile" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="${JADE_BRIGHT}"/>
      <stop offset="100%" stop-color="${JADE_DEEP}"/>
    </linearGradient>
    <linearGradient id="sheen" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#ffffff" stop-opacity="0.34"/>
      <stop offset="60%" stop-color="#ffffff" stop-opacity="0"/>
    </linearGradient>
  </defs>
`;

/** Rounded tile for regular icons and the favicon. */
function standardSvg() {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" width="48" height="48">
    ${defs}
    <rect width="48" height="48" rx="11" fill="url(#tile)"/>
    <rect width="48" height="48" rx="11" fill="url(#sheen)"/>
    ${glyph}
  </svg>`;
}

/**
 * Maskable icons get cropped to whatever shape the launcher uses, so the
 * background is full-bleed and the glyph is shrunk into the safe zone.
 */
function maskableSvg() {
  const scale = 0.58;
  const offset = (48 - 48 * scale) / 2;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" width="48" height="48">
    ${defs}
    <rect width="48" height="48" fill="url(#tile)"/>
    <rect width="48" height="48" fill="url(#sheen)"/>
    <g transform="translate(${offset} ${offset}) scale(${scale})">${glyph}</g>
  </svg>`;
}

async function render(svg, size, file, { opaque = false } = {}) {
  let pipeline = sharp(Buffer.from(svg), { density: 384 }).resize(size, size);

  if (opaque) {
    pipeline = pipeline.flatten({ background: JADE_DEEP });
  }

  const out = join(publicDir, file);
  await pipeline.png({ compressionLevel: 9 }).toFile(out);
  console.log(`  ${file}  ${size}x${size}`);
}

async function main() {
  await mkdir(publicDir, { recursive: true });

  const standard = standardSvg();

  console.log("Generating PWA icons:");
  await render(standard, 192, "pwa-192.png");
  await render(standard, 512, "pwa-512.png");
  await render(maskableSvg(), 512, "pwa-maskable-512.png");
  // iOS ignores transparency and composites on black, so flatten it.
  await render(standard, 180, "apple-touch-icon.png", { opaque: true });
  await render(standard, 32, "favicon-32.png");

  await writeFile(join(publicDir, "favicon.svg"), `${standard}\n`, "utf8");
  console.log("  favicon.svg");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
