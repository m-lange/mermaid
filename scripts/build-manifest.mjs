// Erzeugt dist/manifest.xml für eine gehostete Version (z. B. GitHub Pages) aus manifest.xml.
//
//   ADDIN_BASE_URL=https://<user>.github.io/<repo> node scripts/build-manifest.mjs
//
// - ersetzt alle https://localhost:3000-URLs durch ADDIN_BASE_URL
// - verwendet eine eigene Add-in-ID, damit Entwicklungs- und gehostete Version
//   gleichzeitig installiert sein können
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const DEV_URL = "https://localhost:3000";
const HOSTED_ID = "372ab973-24b0-48ec-8b3f-098ca7e73d29";

const base = (process.env.ADDIN_BASE_URL || "").replace(/\/+$/, "");
if (!/^https:\/\/[^/]+/.test(base)) {
  console.error("ADDIN_BASE_URL fehlt oder ist keine https-URL (z. B. https://user.github.io/repo).");
  process.exit(1);
}

const root = resolve(import.meta.dirname, "..");
let xml = await readFile(resolve(root, "manifest.xml"), "utf8");
const count = xml.split(DEV_URL).length - 1;
xml = xml.replaceAll(DEV_URL, base).replace(/<Id>[^<]+<\/Id>/, `<Id>${HOSTED_ID}</Id>`);

if (xml.includes("localhost")) {
  console.error("Manifest enthält nach dem Ersetzen noch localhost-URLs.");
  process.exit(1);
}

await writeFile(resolve(root, "dist", "manifest.xml"), xml, "utf8");
console.log(`dist/manifest.xml geschrieben (${count} URLs → ${base}).`);
