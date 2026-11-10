// Erzeugt Store-Screenshots (1280×720 PNG) in store/screenshots/<lang>-<n>.png
//   npm run build && node scripts/store-screenshots.mjs
//
// Links: neutrale Dokumentseite mit dem eingefügten Diagramm, rechts: echte Taskpane
// (Produktions-Build im Browser-Modus mit simuliertem Dokument).
import { preview } from "vite";
import { chromium } from "playwright-core";
import sharp from "sharp";
import { mkdir } from "node:fs/promises";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const outDir = resolve(root, "store/screenshots");
await mkdir(outDir, { recursive: true });

const W = 1280;
const H = 720;
const PANE_W = 380;

const SHOTS = [
  // [Dateinummer, Diagrammtyp, Ansicht in der Taskpane]
  [1, "flowchart", "editor"],
  [2, "sequence", "gallery"],
  [3, "class", "snippets"],
  [4, "pie", "theme"],
];

const server = await preview({
  configFile: resolve(root, "vite.config.ts"),
  preview: { port: 3140, strictPort: false },
  logLevel: "error",
});
const base = `${server.resolvedUrls.local[0]}taskpane/taskpane.html`;
const browser = await chromium.launch({ channel: process.env.BROWSER_CHANNEL || "msedge", headless: true });

async function documentPage(pngBase64) {
  // Dokumentseite mit Schatten, Diagramm zentriert
  const areaW = W - PANE_W;
  const page = { x: 60, y: 36, w: areaW - 120, h: H - 72 };
  const diagram = sharp(Buffer.from(pngBase64, "base64"));
  const fitted = await diagram
    .resize(page.w - 120, page.h - 120, { fit: "inside", withoutEnlargement: false })
    .png()
    .toBuffer();
  const meta = await sharp(fitted).metadata();
  const shadow = Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${areaW}" height="${H}">
      <defs><filter id="s" x="-10%" y="-10%" width="120%" height="120%"><feDropShadow dx="0" dy="2" stdDeviation="6" flood-opacity="0.18"/></filter></defs>
      <rect width="100%" height="100%" fill="#ECECEC"/>
      <rect x="${page.x}" y="${page.y}" width="${page.w}" height="${page.h}" fill="#FFFFFF" filter="url(#s)"/>
    </svg>`,
  );
  return sharp(shadow)
    .composite([
      {
        input: fitted,
        left: Math.round(page.x + (page.w - meta.width) / 2),
        top: Math.round(page.y + (page.h - meta.height) / 2),
      },
    ])
    .png()
    .toBuffer();
}

try {
  for (const lang of ["en", "de"]) {
    for (const [n, type, view] of SHOTS) {
      const page = await browser.newPage({ viewport: { width: PANE_W, height: H }, deviceScaleFactor: 1 });
      await page.goto(`${base}?lang=${lang}`);
      await page.evaluate(() => localStorage.setItem("mermaid.previewMode", "document"));
      await page.reload();
      await page.waitForSelector(`[data-type="${type}"]`, { timeout: 60000 });
      await page.click(`[data-type="${type}"]`);
      await page.waitForSelector(".cm-editor", { timeout: 30000 });
      await page.waitForTimeout(3500); // Hinweis "eingefügt" ausblenden lassen
      const png = await page.evaluate(() => {
        const a = window.mermaidBrowserDoc;
        return a.getPreviewPng(a.elements[a.elements.length - 1].id);
      });

      if (view === "gallery") {
        await page.locator("button").first().click(); // Zurück zur Übersicht
        await page.waitForSelector('[data-type="flowchart"]');
        await page.waitForTimeout(500);
      } else if (view === "snippets") {
        await page.locator(".cm-line").nth(10).click();
        await page.click('[data-snippet-group="edges"]');
        await page.waitForSelector('[role="menuitem"]');
        await page.waitForTimeout(600);
      } else if (view === "theme") {
        await page.getByTestId("toolbar-theme").click();
        await page.waitForSelector('[role="menuitemradio"]');
        await page.waitForTimeout(600);
      }
      await page.mouse.move(1, 1);
      const pane = await page.screenshot();
      await page.close();

      const left = await documentPage(png);
      const file = resolve(outDir, `${lang}-${n}.png`);
      await sharp({ create: { width: W, height: H, channels: 3, background: "#FFFFFF" } })
        .composite([
          { input: left, left: 0, top: 0 },
          { input: pane, left: W - PANE_W, top: 0 },
          {
            // Trennlinie zur Taskpane
            input: Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="1" height="${H}"><rect width="1" height="${H}" fill="#C8C8C8"/></svg>`),
            left: W - PANE_W - 1,
            top: 0,
          },
        ])
        .png()
        .toFile(file);
      console.log(`store/screenshots/${lang}-${n}.png (${type}, ${view})`);
    }
  }
} finally {
  await browser.close();
  await new Promise((r) => server.httpServer.close(r));
}
