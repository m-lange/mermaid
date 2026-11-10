// Rendert alle Beispielvorlagen in einem echten Browser (Microsoft Edge, headless)
// und prüft, ob Mermaid sie fehlerfrei parst und ob die PNG-Umwandlung klappt.
//
//   npm run test:templates            -> nur prüfen
//   npm run test:templates -- out/    -> zusätzlich PNGs in den Ordner schreiben
import { createServer } from "vite";
import { chromium } from "playwright-core";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const outDir = process.argv[2];
// Zeitlimit, damit ein hängender Tokenizer/Renderer als Fehler gemeldet wird statt zu blockieren
const withTimeout = (p, ms, what) =>
  Promise.race([p, new Promise((_, rej) => setTimeout(() => rej(new Error(`Zeitüberschreitung: ${what}`)), ms))]);
const themes = (process.env.THEMES || "default").split(",");

const server = await createServer({
  configFile: resolve(import.meta.dirname, "../vite.config.ts"),
  // hmr: false – sonst lädt Vite die Testseite bei langen Läufen neu (WebSocket-Abbruch)
  server: { https: undefined, port: 3123, strictPort: false, hmr: false, ws: false, watch: null },
  logLevel: "warn",
});
await server.listen();
const url = `${server.resolvedUrls.local[0]}dev/render-test.html`;

const browser = await chromium.launch({ channel: process.env.BROWSER_CHANNEL || "msedge", headless: true });
let failed = 0;
try {
  const page = await browser.newPage();
  page.on("pageerror", (e) => console.error("pageerror:", e.message));
  await page.goto(url);
  await page.waitForFunction(() => window.ready === true, null, { timeout: 60000 });
  const only = process.env.ONLY ? process.env.ONLY.split(",") : null;
  const results = process.env.CODE_FILES
    ? await Promise.all(process.env.CODE_FILES.split(",").map(async (f) => ({ ...(await page.evaluate((c) => window.renderOne(c), (await import("node:fs")).readFileSync(f, "utf8"))), id: f.split(/[\/]/).pop() })))
    : await page.evaluate(([th, o]) => window.runAll(th, o), [themes, only]);
  if (outDir) await mkdir(outDir, { recursive: true });
  for (const r of results) {
    if (r.ok) {
      console.log(`✔ ${r.theme.padEnd(8)} ${r.id.padEnd(13)} ${String(r.w).padStart(5)}×${String(r.h).padEnd(5)} ${r.ms} ms${r.foreignObject ? "  (foreignObject!)" : ""}`);
      if (outDir) await writeFile(resolve(outDir, `${r.id}-${r.theme}.png`), Buffer.from(r.png, "base64"));
    } else {
      failed++;
      console.log(`✘ ${r.theme.padEnd(8)} ${r.id.padEnd(13)} ${r.error.split("\n").join("\n    ")}`);
    }
  }

  // Snippets der Toolbox prüfen (SNIPPETS=0 zum Überspringen)
  if (!process.env.CODE_FILES && process.env.SNIPPETS !== "0") {
    const snippetResults = await withTimeout(page.evaluate((o) => window.runSnippets(o), only), 300000, "Snippets");
    const bad = snippetResults.filter((r) => !r.ok);
    for (const r of bad) {
      failed++;
      console.log(`✘ Snippet ${r.id} / ${r.label}: ${r.error.split("\n").slice(0, 4).join("\n    ")}`);
      if (process.env.VERBOSE) console.log(r.code);
    }
    console.log(`\nSnippets: ${snippetResults.length - bad.length}/${snippetResults.length} OK`);

    const hl = await withTimeout(page.evaluate(() => window.runHighlight()), 60000, "Highlighting");
    const hlBad = hl.filter((r) => !r.ok);
    for (const r of hlBad) {
      failed++;
      console.log(`✘ Highlighting ${r.id}: ${r.error ?? "unvollständig"}`);
    }
    console.log(`Highlighting: ${hl.length - hlBad.length}/${hl.length} OK`);

    // Dokumentdesign: Parser + Rendern aller Vorlagen mit gelesenem Design (Calibri, Office 2013)
    const theme = await withTimeout(page.evaluate((o) => window.runThemeTest(o), only), 300000, "Dokumentdesign");
    for (const c of theme.checks.filter((c) => !c.ok)) {
      failed++;
      console.log(`✘ Design-Parser ${c.name}: ${JSON.stringify(c.actual)} statt ${JSON.stringify(c.expected)}`);
    }
    for (const r of theme.renders) {
      if (!r.ok) {
        failed++;
        console.log(`✘ Dokumentdesign ${r.id}: ${r.error.split("\n")[0]}`);
      } else if (outDir) {
        await writeFile(resolve(outDir, `${r.id}-document.png`), Buffer.from(r.png, "base64"));
      }
    }
    const okR = theme.renders.filter((r) => r.ok);
    console.log(
      `Dokumentdesign: Parser ${theme.checks.filter((c) => c.ok).length}/${theme.checks.length} OK, ` +
        `Rendern ${okR.length}/${theme.renders.length} OK ` +
        `(Schrift ${okR.filter((r) => r.usesFont).length}, Füllung ${okR.filter((r) => r.usesFill).length}, Linie ${okR.filter((r) => r.usesLine).length})`,
    );
    if (process.env.VERBOSE) {
      for (const r of okR.filter((r) => !r.usesFont || !r.usesFill || !r.usesLine))
        console.log(`  ${r.id}: Schrift=${r.usesFont} Füllung=${r.usesFill} Linie=${r.usesLine}`);
    }
  }
} finally {
  await browser.close();
  await server.close();
}
console.log(failed ? `\n${failed} Fehler.` : "\nAlle Vorlagen und Snippets OK.");
process.exit(failed ? 1 : 0);
