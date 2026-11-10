import type { Mermaid, MermaidConfig } from "mermaid";
import type { DiagramOptions, RenderedDiagram } from "./model";
import { DEFAULT_DOC_THEME, fontStack, themeVariables, type DocumentTheme } from "./docTheme";
import { tr } from "./strings";

let counter = 0;
let mermaidPromise: Promise<Mermaid> | null = null;

/**
 * Lädt Mermaid (≈1 MB) erst bei Bedarf, damit die Taskpane schneller erscheint.
 * Ein früher Aufruf (z. B. nach dem ersten Rendern der Oberfläche) lädt vorab.
 */
export function loadMermaid(): Promise<Mermaid> {
  if (!mermaidPromise) {
    mermaidPromise = Promise.all([import("mermaid"), import("@mermaid-js/layout-elk")]).then(([m, elk]) => {
      m.default.registerLayoutLoaders(elk.default);
      return m.default;
    });
    mermaidPromise.catch(() => (mermaidPromise = null));
  }
  return mermaidPromise;
}
/** Mermaid ist global konfiguriert – Renderings werden daher serialisiert. */
let queue: Promise<unknown> = Promise.resolve();

const THEME_BACKGROUNDS: Record<string, string> = {
  default: "#ffffff",
  neutral: "#ffffff",
  forest: "#ffffff",
  base: "#ffffff",
  dark: "#333333",
};

/** Aktuelles Office-Dokumentdesign (wird vom Host-Adapter eingelesen) */
let documentTheme: DocumentTheme = DEFAULT_DOC_THEME;

export function setDocumentTheme(theme: DocumentTheme) {
  documentTheme = theme;
}
export function getDocumentTheme(): DocumentTheme {
  return documentTheme;
}

function configure(mermaid: Mermaid, opts: DiagramOptions) {
  const fromDocument = opts.theme === "document";
  const config: MermaidConfig = {
    startOnLoad: false,
    securityLevel: "strict",
    // Dokumentdesign: Mermaid-Theme "base" mit Farben/Schrift aus dem Office-Design
    theme: fromDocument ? "base" : opts.theme,
    themeVariables: fromDocument ? themeVariables(documentTheme) : {},
    look: opts.look,
    fontFamily: fromDocument ? fontStack(documentTheme) : '"Segoe UI", "Trebuchet MS", Verdana, Arial, sans-serif',
    // Keine HTML-Labels (foreignObject): sonst kann das SVG nicht zuverlässig
    // in ein PNG umgewandelt werden (Canvas-Tainting in Safari / Office für Mac)
    // und Office stellt eingefügte SVGs ohne Beschriftung dar.
    htmlLabels: false,
    flowchart: { htmlLabels: false },
    class: { htmlLabels: false },
    state: { htmlLabels: false } as MermaidConfig["state"],
    markdownAutoWrap: true,
    // SVG-Text statt foreignObject (Safari/Office für Mac können foreignObject nicht in PNG umwandeln)
    journey: { textPlacement: "tspan" } as MermaidConfig["journey"],
  } as MermaidConfig;
  mermaid.initialize(config);
}

function enqueue<T>(job: () => Promise<T>): Promise<T> {
  const next = queue.then(job, job);
  queue = next.catch(() => undefined);
  return next;
}

export interface ParseResult {
  ok: boolean;
  error?: string;
  diagramType?: string;
}

export function formatError(e: unknown): string {
  if (!e) return tr("unknownError");
  if (typeof e === "string") return e;
  const err = e as { message?: string; str?: string };
  return (err.str || err.message || String(e)).trim();
}

/** Rendert Mermaid-Code zu SVG (ohne PNG). Für die Live-Vorschau. */
export function renderSvg(code: string, opts: DiagramOptions): Promise<{ svg: string; diagramType: string }> {
  return enqueue(async () => {
    const mermaid = await loadMermaid();
    configure(mermaid, opts);
    const id = `mermaid-render-${++counter}`;
    try {
      const { svg, diagramType } = await mermaid.render(id, code);
      return { svg, diagramType };
    } finally {
      // Mermaid hinterlässt bei Fehlern gelegentlich temporäre Elemente im DOM
      document.getElementById(id)?.remove();
      document.getElementById(`d${id}`)?.remove();
    }
  });
}

export async function validate(code: string): Promise<ParseResult> {
  try {
    const mermaid = await loadMermaid();
    const res = await mermaid.parse(code, { suppressErrors: false });
    return { ok: true, diagramType: res ? res.diagramType : undefined };
  } catch (e) {
    return { ok: false, error: formatError(e) };
  }
}

/** Rendert Mermaid-Code vollständig (SVG + PNG) für das Einfügen ins Dokument. */
export async function renderDiagram(code: string, opts: DiagramOptions, scale = 3): Promise<RenderedDiagram> {
  const { svg } = await renderSvg(code, opts);
  // Dunkles Design auf weißem Grund wäre unlesbar (heller Text) -> Design-Hintergrund verwenden
  const mode = opts.theme === "dark" && opts.background === "white" ? "theme" : opts.background;
  const background =
    mode === "transparent"
      ? undefined
      : mode === "white"
        ? "#ffffff"
        : opts.theme === "document"
          ? documentTheme.lt1 // Hintergrund 1 des Designs
          : (THEME_BACKGROUNDS[opts.theme] ?? "#ffffff");
  const { pngBase64, widthPx, heightPx, svg: normalizedSvg } = await svgToPng(svg, scale, background);
  return { svg: normalizedSvg, pngBase64, widthPx, heightPx };
}

/** Bringt das SVG in eine eigenständige Form mit fester Breite/Höhe. */
export function normalizeSvg(svg: string): { svg: string; width: number; height: number } {
  // Lenient per HTML-Parser lesen, dann als korrektes XML serialisieren.
  const html = new DOMParser().parseFromString(`<!doctype html><body>${svg}</body>`, "text/html");
  const el = html.querySelector("svg");
  if (!el) throw new Error(tr("noSvg"));

  let width = 0;
  let height = 0;
  const vb = el.getAttribute("viewBox")?.trim().split(/[\s,]+/).map(Number);
  if (vb && vb.length === 4 && vb.every((n) => Number.isFinite(n))) {
    width = vb[2];
    height = vb[3];
  }
  if (!width || !height) {
    const maxW = /max-width:\s*([\d.]+)px/.exec(el.getAttribute("style") || "");
    width = Number(el.getAttribute("width")) || (maxW ? Number(maxW[1]) : 0) || 800;
    height = Number(el.getAttribute("height")) || 600;
    el.setAttribute("viewBox", `0 0 ${width} ${height}`);
  }
  el.setAttribute("width", String(width));
  el.setAttribute("height", String(height));
  el.setAttribute("xmlns", "http://www.w3.org/2000/svg");
  const style = (el.getAttribute("style") || "").replace(/max-width:[^;]+;?/g, "");
  el.setAttribute("style", style);
  return { svg: new XMLSerializer().serializeToString(el), width, height };
}

function utf8ToBase64(str: string): string {
  const bytes = new TextEncoder().encode(str);
  let bin = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    bin += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(bin);
}

const MAX_CANVAS_SIDE = 8192;
const MAX_CANVAS_AREA = 32 * 1024 * 1024;

export async function svgToPng(
  svg: string,
  scale: number,
  background?: string,
): Promise<{ pngBase64: string; widthPx: number; heightPx: number; svg: string }> {
  const norm = normalizeSvg(svg);
  const { width, height } = norm;

  let s = scale;
  s = Math.min(s, MAX_CANVAS_SIDE / width, MAX_CANVAS_SIDE / height, Math.sqrt(MAX_CANVAS_AREA / (width * height)));
  s = Math.max(s, 0.1);

  let dataUrl: string;
  let finalSvg = norm.svg;
  try {
    dataUrl = await rasterize(norm.svg, width, height, s, background);
  } catch (e) {
    // Safari (Office für Mac) "verunreinigt" das Canvas bei foreignObject -> HTML-Labels durch SVG-Text ersetzen
    if (!norm.svg.includes("<foreignObject")) throw e;
    finalSvg = replaceForeignObjects(norm.svg);
    dataUrl = await rasterize(finalSvg, width, height, s, background);
  }
  return {
    pngBase64: dataUrl.substring(dataUrl.indexOf(",") + 1),
    widthPx: width,
    heightPx: height,
    svg: finalSvg,
  };
}

async function rasterize(svg: string, width: number, height: number, scale: number, background?: string): Promise<string> {
  const img = new Image();
  img.decoding = "sync";
  const loaded = new Promise<void>((resolve, reject) => {
    img.onload = () => resolve();
    img.onerror = () => reject(new Error(tr("svgToImageFailed")));
  });
  img.src = `data:image/svg+xml;base64,${utf8ToBase64(svg)}`;
  await loaded;

  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(width * scale));
  canvas.height = Math.max(1, Math.round(height * scale));
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error(tr("canvasUnsupported"));
  if (background) {
    ctx.fillStyle = background;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL("image/png"); // wirft SecurityError bei "verunreinigtem" Canvas
}

const SVG_NS = "http://www.w3.org/2000/svg";

/**
 * Ersetzt foreignObject-Elemente (HTML-Labels) durch zentrierten SVG-Text mit einfachem Zeilenumbruch.
 * Rückfall für Browser, die foreignObject nicht in ein Canvas zeichnen dürfen.
 */
export function replaceForeignObjects(svg: string): string {
  const doc = new DOMParser().parseFromString(svg, "image/svg+xml");
  const fos = Array.from(doc.getElementsByTagNameNS(SVG_NS, "foreignObject"));
  for (const fo of fos) {
    const x = parseFloat(fo.getAttribute("x") || "0");
    const y = parseFloat(fo.getAttribute("y") || "0");
    const w = parseFloat(fo.getAttribute("width") || "0");
    const h = parseFloat(fo.getAttribute("height") || "0");
    const text = (fo.textContent || "").replace(/\s+/g, " ").trim();
    const styled = fo.querySelector("[style*='color']");
    const color = /(?:^|;)\s*color\s*:\s*([^;]+)/.exec(styled?.getAttribute("style") || "")?.[1]?.trim();
    const fontSize = 14;
    const node = doc.createElementNS(SVG_NS, "text");
    node.setAttribute("text-anchor", "middle");
    node.setAttribute("font-size", String(fontSize));
    if (color) node.setAttribute("fill", color);
    // Zeilenumbruch nach geschätzter Zeichenbreite
    const maxChars = w > 0 ? Math.max(4, Math.floor(w / (fontSize * 0.55))) : 999;
    const lines: string[] = [];
    let line = "";
    for (const word of text.split(" ")) {
      if (line && (line + " " + word).length > maxChars) {
        lines.push(line);
        line = word;
      } else line = line ? line + " " + word : word;
    }
    if (line) lines.push(line);
    const lineHeight = fontSize * 1.2;
    const firstY = y + h / 2 - ((lines.length - 1) * lineHeight) / 2;
    lines.forEach((l, i) => {
      const t = doc.createElementNS(SVG_NS, "tspan");
      t.setAttribute("x", String(x + w / 2));
      t.setAttribute("y", String(firstY + i * lineHeight));
      t.setAttribute("dominant-baseline", "central");
      t.textContent = l;
      node.appendChild(t);
    });
    // Mermaid umschließt foreignObject teils mit <switch> – dann den ganzen Switch ersetzen
    const parent = fo.parentNode as Element | null;
    const target = parent && parent.localName === "switch" ? parent : fo;
    target.parentNode?.replaceChild(node, target);
  }
  return new XMLSerializer().serializeToString(doc.documentElement);
}
