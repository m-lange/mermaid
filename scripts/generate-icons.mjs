// Erzeugt die PNG-Icons für Manifest/Taskpane und das Store-Logo aus assets/icon.svg
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
  console.log(`public/assets/icon-${size}.png`);
}

// Store-Logo (Microsoft Marketplace: PNG, 216–350 px quadratisch)
const store = resolve(root, "store");
await mkdir(store, { recursive: true });
await sharp(svg, { density: 1200 }).resize(300, 300).png().toFile(resolve(store, "logo-300.png"));
console.log("store/logo-300.png");
