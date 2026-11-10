/** "document" = Farben und Schrift aus dem Office-Dokumentdesign */
export type MermaidTheme = "document" | "default" | "neutral" | "dark" | "forest" | "base";
export type MermaidLook = "classic" | "handDrawn";
export type BackgroundMode = "transparent" | "white" | "theme";

export interface DiagramOptions {
  theme: MermaidTheme;
  look: MermaidLook;
  background: BackgroundMode;
}

/** Ein Diagramm, wie es in der Custom XML Part gespeichert wird. */
export interface DiagramRecord extends DiagramOptions {
  /** UUID – verknüpft Custom XML Part und Element im Dokument */
  id: string;
  /** Diagrammtyp (siehe templates.ts) */
  type: string;
  /** Mermaid-Quellcode */
  code: string;
  /** Natürliche Größe des zuletzt gerenderten Bildes in CSS-Pixeln */
  widthPx: number;
  heightPx: number;
  created: string;
  modified: string;
  /** Fingerabdruck des Dokumentdesigns, mit dem das Bild zuletzt gerendert wurde (nur bei theme = "document") */
  themeKey?: string;
}

export const DEFAULT_OPTIONS: DiagramOptions = {
  theme: "document",
  look: "classic",
  background: "white",
};

export interface RenderedDiagram {
  svg: string;
  /** PNG als Base64 (ohne data:-Präfix) */
  pngBase64: string;
  /** Natürliche Größe in CSS-Pixeln */
  widthPx: number;
  heightPx: number;
}

export function newId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  // Fallback (ältere WebViews)
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === "x" ? r : (r & 0x3) | 0x8).toString(16);
  });
}
