// Erzeugt die PNG-Icons für das Manifest aus assets/icon.svg
import sharp from "sharp";
import { mkdir, readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const svg = await readFile(resolve(root, "assets/icon.svg"));
const out = resolve(root, "public/assets");
await mkdir(out, { recursive: true });

for (const size of [16, 32, 64, 80, 128]) {
  await sharp(svg, { density: 384 }).resize(size, size).png().toFile(resolve(out, `icon-${size}.png`));
  console.log(`icon-${size}.png`);
}
