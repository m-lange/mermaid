// End-to-End-Test der Taskpane im Browser-Modus (simuliertes Dokument) gegen den Produktions-Build.
// Prüft Live-Vorschau im Dokument, Abbrechen/Speichern, Vorschau-Umschalter und Dokumentdesign.
//   npm run build && npm run test:ui [-- <screenshot-ordner>]
import { preview } from "vite";
import { chromium } from "playwright-core";
import { mkdir } from "node:fs/promises";
import { resolve } from "node:path";

const out = process.argv[2] || resolve(import.meta.dirname, "../test-results");
await mkdir(out, { recursive: true });

const server = await preview({
  configFile: resolve(import.meta.dirname, "../vite.config.ts"),
  preview: { port: 3127, strictPort: false },
  logLevel: "error",
});

const url = `${server.resolvedUrls.local[0]}taskpane/taskpane.html?lang=de`;
const browser = await chromium.launch({ channel: "msedge", headless: true });
const errors = [];
const results = {};
try {
  const page = await browser.newPage({ viewport: { width: 380, height: 900 } });
  page.on("pageerror", (e) => errors.push("pageerror: " + e.message));
  page.on("console", (m) => m.type() === "error" && errors.push("console: " + m.text()));
  await page.goto(url);
  // Live-Modus "Dokument" erzwingen (Standard im Browser ist "Aufgabenbereich")
  await page.evaluate(() => localStorage.setItem("mermaid.previewMode", "document"));
  await page.reload();
  await page.waitForSelector('[data-type="pie"]', { timeout: 60000 });
  await page.click('[data-type="pie"]');
  await page.waitForSelector(".cm-editor", { timeout: 30000 });
  await page.waitForTimeout(1500);

  const doc = () =>
    page.evaluate(() => {
      const a = window.mermaidBrowserDoc;
      const id = a.elements[0].id;
      return { count: a.updateCount, png: a.getPreviewPng(id) };
    });
  const initial = await doc();
  results.previewPaneHidden = (await page.locator('[aria-label="Vorschau"]').count()) === 0;
  // Öffnen/Warten ohne Eingabe darf das Dokument nicht ändern
  await page.waitForTimeout(2000);
  results.noUpdateOnOpen = (await doc()).count === initial.count;

  // Tippen und per Strg+Z vollständig zurücknehmen -> Dokument wird wiederhergestellt
  await page.locator(".cm-line").last().click();
  await page.keyboard.press("End");
  await page.keyboard.type('\n    "Temp" : 9');
  await page.waitForTimeout(2000);
  const afterTemp = await doc();
  await page.keyboard.press("Control+z");
  await page.waitForTimeout(2000);
  results.manualUndoRestoresDoc = afterTemp.png !== initial.png && (await doc()).png === initial.png;

  // Schnell tippen: 20 Zeichen ohne Pause -> soll nur wenige Dokument-Updates auslösen
  const beforeTyping = await doc();
  await page.locator(".cm-line").last().click();
  await page.keyboard.press("End");
  await page.keyboard.type('\n    "Neu" : 30', { delay: 25 });
  await page.waitForTimeout(2500);
  const afterTyping = await doc();
  results.docChangedWhileTyping = afterTyping.png !== initial.png;
  results.updatesForTyping = afterTyping.count - beforeTyping.count;
  results.statusDirty = await page.getByText("Live im Dokument – nicht gespeichert").isVisible();
  await page.screenshot({ path: `${out}/live-1-dirty.png` });

  // Syntaxfehler: Dokument darf sich NICHT ändern
  await page.keyboard.type("\n    ???");
  await page.waitForTimeout(1800);
  const afterError = await doc();
  results.errorShown = await page.getByText("Syntaxfehler").isVisible();
  results.docUnchangedOnError = afterError.png === afterTyping.png;
  await page.keyboard.press("Control+z");
  await page.waitForTimeout(1500);

  // Abbrechen -> Dokument wieder wie vorher
  await page.getByRole("button", { name: "Abbrechen", exact: true }).click();
  await page.waitForTimeout(2000);
  const afterCancel = await doc();
  results.cancelRestoredDoc = afterCancel.png === initial.png;

  // Erneut ändern und speichern -> Speichern löst kein zusätzliches Update aus (Dokument ist schon aktuell)
  await page.locator(".cm-line").last().click();
  await page.keyboard.press("End");
  await page.keyboard.type('\n    "Gespeichert" : 5');
  await page.waitForTimeout(2000);
  const beforeSave = await doc();
  await page.getByRole("button", { name: "Speichern", exact: true }).click();
  await page.waitForTimeout(1500);
  const afterSave = await doc();
  results.saveNoExtraUpdate = afterSave.count === beforeSave.count;
  results.savedStatus = await page.getByText("Gespeichert", { exact: true }).first().isVisible();
  const stored = await page.evaluate(async () => (await window.mermaidBrowserDoc.store.list())[0].code);
  results.xmlHasSavedCode = stored.includes('"Gespeichert" : 5');

  // Umschalten auf Aufgabenbereich -> Vorschau erscheint, Dokument wird beim Tippen nicht mehr geändert
  await page.getByTestId("preview-toggle").click();
  await page.waitForTimeout(800);
  results.panePreviewVisible = (await page.locator('[aria-label="Vorschau"]').count()) === 1;
  const beforePane = await doc();
  await page.locator(".cm-line").last().click();
  await page.keyboard.press("End");
  await page.keyboard.type('\n    "Nur Vorschau" : 3');
  await page.waitForTimeout(1500);
  results.paneModeDocUntouched = (await doc()).count === beforePane.count;
  await page.screenshot({ path: `${out}/live-2-pane.png` });
  // Speichern im Pane-Modus -> jetzt genau ein Update
  await page.getByRole("button", { name: "Speichern", exact: true }).click();
  await page.waitForTimeout(1500);
  results.paneSaveUpdatesDoc = (await doc()).count === beforePane.count + 1;

  // Designwechsel im Dokument simulieren -> neu einlesen -> Hinweis -> Aktualisieren
  results.bannerBeforeChange = await page.getByText("Das Dokumentdesign hat sich geändert").isVisible();
  await page.evaluate(() => {
    window.mermaidBrowserDoc.documentTheme = { dk2: "#AA0000", lt2: "#FFEEDD", fontBody: "Georgia" };
  });
  const beforeTheme = await doc();
  await page.getByTestId("toolbar-theme").click();
  await page.getByRole("menuitem", { name: "Design aus Dokument neu einlesen" }).click();
  await page.waitForTimeout(1200);
  results.bannerAfterChange = await page.getByText("Das Dokumentdesign hat sich geändert").isVisible();
  results.themeRefreshDidNotTouchDoc = (await doc()).count === beforeTheme.count;
  await page.screenshot({ path: `${out}/live-3-theme-banner.png` });
  await page.getByRole("button", { name: "Aktualisieren", exact: true }).click();
  await page.waitForTimeout(2000);
  results.themeUpdateWritesDoc = (await doc()).count === beforeTheme.count + 1;
  results.bannerGone = !(await page.getByText("Das Dokumentdesign hat sich geändert").isVisible());
  const themeKey = await page.evaluate(async () => (await window.mermaidBrowserDoc.store.list())[0].themeKey);
  results.themeKeyStored = !!themeKey && themeKey.includes("Georgia") && themeKey.includes("#AA0000");
  await page.screenshot({ path: `${out}/live-4-theme-updated.png` });

  const expectedFalse = new Set(["bannerBeforeChange"]);
  const failedChecks = Object.entries(results).filter(([k, v]) => typeof v === "boolean" && v === expectedFalse.has(k));
  console.log(JSON.stringify({ ...results, errors }, null, 2));
  console.log(
    failedChecks.length || errors.length
      ? `\n${failedChecks.length} Prüfung(en) fehlgeschlagen: ${failedChecks.map(([k]) => k).join(", ")}`
      : "\nAlle UI-Prüfungen OK.",
  );
  process.exitCode = failedChecks.length || errors.length ? 1 : 0;
} finally {
  await browser.close();
  await new Promise((r) => server.httpServer.close(r));
}
