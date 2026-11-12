import { mkdir, readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const root = new URL("../", import.meta.url);
const artwork = await readFile(new URL("src/assets/planet.svg", root), "utf8");
// Icons use the same drawing, with the decorative animation removed.
const source = artwork
  .replace(/\s*<animateMotion\b[^>]*>[\s\S]*?<\/animateMotion>/g, "")
  .replaceAll("data-rest-transform=", "transform=");
const output = new URL("public/icons/", root);
await mkdir(output, { recursive: true });

const icons = [
  { name: "planet-192.png", size: 192, scale: 0.94 },
  { name: "planet-512.png", size: 512, scale: 0.94 },
  { name: "planet-maskable-512.png", size: 512, scale: 0.76 },
  { name: "apple-touch-planet.png", size: 180, scale: 0.94 },
  { name: "favicon-32.png", size: 32, scale: 0.98 },
];

for (const { name, size, scale } of icons) {
  const markSize = Math.round(size * scale);
  const mark = await sharp(Buffer.from(source), { density: 384 })
    .resize(markSize, markSize)
    .png()
    .toBuffer();

  await sharp({
    create: { width: size, height: size, channels: 4, background: "#0c1012" },
  })
    .composite([{ input: mark, gravity: "centre" }])
    .png()
    .toFile(fileURLToPath(new URL(name, output)));
}

const favicon = source.replace(
  /(<svg\b[^>]*>)/,
  '$1<rect width="128" height="128" rx="28" fill="#0c1012" />',
);
await writeFile(new URL("public/planet.svg", root), favicon);
console.log("Updated the favicon and five app icons from src/assets/planet.svg.");
