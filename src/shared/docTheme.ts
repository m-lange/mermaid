/**
 * Office-Dokumentdesign (Designfarben + Designschriftarten) und die Abbildung
 * auf Mermaid-Theme-Variablen.
 *
 * Zuordnung (Wunsch des Benutzers):
 *   Hintergrund 2 (lt2)  -> Standard-Füllung der Elemente
 *   Text 2 (dk2)         -> Standard-Linien und Rahmen
 *   Text 1 (dk1)         -> Texte
 *   Textkörper-Schrift   -> Schriftart
 *   Akzent 1–6           -> Farbreihen (Kreis, Mindmap, Zeitstrahl, Git, XY …)
 */

export interface DocumentTheme {
  name?: string;
  /** Textkörper-Schriftart (minor font) */
  fontBody: string;
  /** Überschriften-Schriftart (major font) */
  fontHeading: string;
  dk1: string;
  lt1: string;
  dk2: string;
  lt2: string;
  accents: string[];
  /** Woher die Werte stammen */
  source: "document" | "partial" | "default";
}

/** Office-Design 2023 („Office“) als Rückfallwert */
export const DEFAULT_DOC_THEME: DocumentTheme = {
  name: "Office",
  fontBody: "Aptos",
  fontHeading: "Aptos Display",
  dk1: "#000000",
  lt1: "#FFFFFF",
  dk2: "#0E2841",
  lt2: "#E8E8E8",
  accents: ["#156082", "#E97132", "#196B24", "#0F9ED5", "#A02B93", "#4EA72E"],
  source: "default",
};

const A = "http://schemas.openxmlformats.org/drawingml/2006/main";

/** Liest ein DrawingML-Theme (`a:theme`, z. B. theme1.xml) – als Text oder bereits geparstes Element. */
export function parseThemeXml(input: string | Element): Partial<DocumentTheme> | null {
  const root =
    typeof input === "string" ? new DOMParser().parseFromString(input, "application/xml").documentElement : input;
  if (!root) return null;
  const find = (parent: Element | Document, name: string) => parent.getElementsByTagNameNS(A, name)[0] as Element | undefined;
  const scheme = find(root, "clrScheme");
  if (!scheme) return null;

  const color = (name: string): string | undefined => {
    const el = Array.from(scheme.children).find((c) => c.localName === name);
    const v = el?.firstElementChild;
    if (!v) return undefined;
    const hex = v.localName === "srgbClr" ? v.getAttribute("val") : v.localName === "sysClr" ? v.getAttribute("lastClr") : null;
    return hex && /^[0-9a-f]{6}$/i.test(hex) ? `#${hex.toUpperCase()}` : undefined;
  };

  const font = (kind: "minorFont" | "majorFont") => {
    const f = find(root, kind);
    const latin = f && Array.from(f.children).find((c) => c.localName === "latin");
    const face = latin?.getAttribute("typeface")?.trim();
    return face || undefined;
  };

  const accents = [1, 2, 3, 4, 5, 6].map((i) => color(`accent${i}`));
  const result: Partial<DocumentTheme> = {
    name: root.getAttribute("name") || undefined,
    dk1: color("dk1"),
    lt1: color("lt1"),
    dk2: color("dk2"),
    lt2: color("lt2"),
    fontBody: font("minorFont"),
    fontHeading: font("majorFont"),
  };
  if (accents.every(Boolean)) result.accents = accents as string[];
  return result;
}

/** Sucht das Design in einem Flat-OPC-Paket (z. B. Word `getOoxml()`). */
export function themeFromFlatOpc(xml: string): Partial<DocumentTheme> | null {
  const doc = new DOMParser().parseFromString(xml, "application/xml");
  const PKG = "http://schemas.microsoft.com/office/2006/xmlPackage";
  const parts = Array.from(doc.getElementsByTagNameNS(PKG, "part"));
  const part = parts.find((p) => /\/theme\/theme\d*\.xml$/i.test(p.getAttributeNS(PKG, "name") || p.getAttribute("pkg:name") || ""));
  const data = part && Array.from(part.getElementsByTagNameNS(PKG, "xmlData"))[0];
  const theme = data?.firstElementChild;
  return theme ? parseThemeXml(theme) : null;
}

/** Ergänzt fehlende Werte mit dem Office-Standarddesign. */
export function completeTheme(partial: Partial<DocumentTheme> | null | undefined): DocumentTheme {
  if (!partial) return DEFAULT_DOC_THEME;
  const keys: (keyof DocumentTheme)[] = ["dk1", "lt1", "dk2", "lt2", "fontBody", "accents"];
  const complete = keys.every((k) => partial[k] !== undefined);
  const merged = { ...DEFAULT_DOC_THEME } as DocumentTheme;
  for (const [k, v] of Object.entries(partial)) {
    if (v !== undefined && v !== null && v !== "") (merged as unknown as Record<string, unknown>)[k] = v;
  }
  merged.fontHeading = partial.fontHeading || merged.fontBody;
  merged.source = complete ? "document" : "partial";
  return merged;
}

/** Kompakter Fingerabdruck – wird pro Diagramm gespeichert, um Designänderungen zu erkennen */
export function themeFingerprint(t: DocumentTheme): string {
  return [t.fontBody, t.dk1, t.lt1, t.dk2, t.lt2, t.accents.join(",")].join("|");
}

// ------------------------------------------------------------------ Farbhilfen

function rgb(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  return [0, 2, 4].map((i) => parseInt(h.substring(i, i + 2), 16)) as [number, number, number];
}
function hex([r, g, b]: number[]): string {
  return "#" + [r, g, b].map((v) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, "0")).join("").toUpperCase();
}
/** Mischt zwei Farben (t = Anteil von b) */
export function mix(a: string, b: string, t: number): string {
  const x = rgb(a);
  const y = rgb(b);
  return hex(x.map((v, i) => v + (y[i] - v) * t));
}
function luminance(c: string): number {
  const [r, g, b] = rgb(c).map((v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
/** Gut lesbare Textfarbe (Text 1 bzw. Hintergrund 1) auf der gegebenen Fläche */
function onColor(bg: string, t: DocumentTheme): string {
  const contrast = (a: string, b: string) => {
    const [l1, l2] = [luminance(a), luminance(b)].sort((x, y) => y - x);
    return (l1 + 0.05) / (l2 + 0.05);
  };
  return contrast(bg, t.dk1) >= contrast(bg, t.lt1) ? t.dk1 : t.lt1;
}

/** CSS-Schriftfamilie mit Rückfall, falls die Designschrift nicht installiert ist */
export function fontStack(t: DocumentTheme): string {
  const quote = (f: string) => (/^[\w-]+$/.test(f) ? f : `"${f.replace(/"/g, "")}"`);
  return [quote(t.fontBody), '"Segoe UI"', "Arial", "sans-serif"].join(", ");
}

/** Mermaid-Theme-Variablen (für theme: "base") aus dem Dokumentdesign */
export function themeVariables(t: DocumentTheme): Record<string, unknown> {
  const fill = t.lt2; // Hintergrund 2
  const line = t.dk2; // Text 2
  const text = t.dk1; // Text 1
  const bg = t.lt1; // Hintergrund 1
  const light = mix(fill, bg, 0.5);
  const acc = t.accents;
  const accentScale = [...acc, ...acc.map((a) => mix(a, bg, 0.45))]; // 12 Farben
  const tints = acc.map((a) => mix(a, bg, 0.75));

  const vars: Record<string, unknown> = {
    darkMode: luminance(bg) < 0.3,
    background: bg,
    fontFamily: fontStack(t),
    // Grundfarben
    primaryColor: fill,
    primaryBorderColor: line,
    primaryTextColor: text,
    secondaryColor: light,
    secondaryBorderColor: line,
    secondaryTextColor: text,
    tertiaryColor: bg,
    tertiaryBorderColor: line,
    tertiaryTextColor: text,
    mainBkg: fill,
    nodeBorder: line,
    nodeTextColor: text,
    lineColor: line,
    textColor: text,
    titleColor: text,
    edgeLabelBackground: bg,
    clusterBkg: light,
    clusterBorder: line,
    noteBkgColor: bg,
    noteBorderColor: line,
    noteTextColor: text,
    // Sequenz
    actorBkg: fill,
    actorBorder: line,
    actorTextColor: text,
    actorLineColor: line,
    signalColor: line,
    signalTextColor: text,
    labelBoxBkgColor: fill,
    labelBoxBorderColor: line,
    labelTextColor: text,
    loopTextColor: text,
    activationBkgColor: light,
    activationBorderColor: line,
    sequenceNumberColor: bg,
    // Klassen/ER/Zustand/Anforderungen
    classText: text,
    labelColor: text,
    attributeBackgroundColorOdd: bg,
    attributeBackgroundColorEven: light,
    altBackground: light,
    requirementBackground: fill,
    requirementBorderColor: line,
    requirementTextColor: text,
    relationColor: line,
    relationLabelColor: text,
    relationLabelBackground: bg,
    // Gantt
    sectionBkgColor: light,
    altSectionBkgColor: bg,
    sectionBkgColor2: fill,
    taskBkgColor: acc[0],
    taskBorderColor: mix(acc[0], text, 0.3),
    taskTextColor: onColor(acc[0], t),
    taskTextLightColor: onColor(acc[0], t),
    taskTextOutsideColor: text,
    taskTextDarkColor: text,
    activeTaskBkgColor: mix(acc[0], bg, 0.5),
    activeTaskBorderColor: acc[0],
    doneTaskBkgColor: fill,
    doneTaskBorderColor: line,
    critBkgColor: acc[1],
    critBorderColor: mix(acc[1], text, 0.3),
    gridColor: mix(line, bg, 0.7),
    todayLineColor: acc[1],
    // Kreisdiagramm
    pieTitleTextColor: text,
    pieSectionTextColor: bg,
    pieLegendTextColor: text,
    pieStrokeColor: bg,
    pieOuterStrokeColor: line,
    pieOpacity: "1", // Akzentfarben unverfälscht wie in Office-Diagrammen
    // Quadrant
    quadrant1Fill: mix(acc[0], bg, 0.85),
    quadrant2Fill: mix(acc[1], bg, 0.85),
    quadrant3Fill: mix(acc[2], bg, 0.85),
    quadrant4Fill: mix(acc[3], bg, 0.85),
    quadrant1TextFill: text,
    quadrant2TextFill: text,
    quadrant3TextFill: text,
    quadrant4TextFill: text,
    quadrantPointFill: line,
    quadrantPointTextFill: text,
    quadrantXAxisTextFill: text,
    quadrantYAxisTextFill: text,
    quadrantTitleFill: text,
    quadrantInternalBorderStrokeFill: mix(line, bg, 0.6),
    quadrantExternalBorderStrokeFill: line,
    // XY
    xyChart: {
      backgroundColor: bg,
      titleColor: text,
      xAxisLabelColor: text,
      xAxisTitleColor: text,
      xAxisTickColor: line,
      xAxisLineColor: line,
      yAxisLabelColor: text,
      yAxisTitleColor: text,
      yAxisTickColor: line,
      yAxisLineColor: line,
      plotColorPalette: acc.join(", "),
    },
    // Git
    commitLabelColor: text,
    commitLabelBackground: fill,
    tagLabelColor: text,
    tagLabelBackground: fill,
    tagLabelBorder: line,
  };

  accentScale.forEach((c, i) => {
    vars[`cScale${i}`] = c;
    vars[`cScaleLabel${i}`] = onColor(c, t);
    vars[`cScalePeer${i}`] = mix(c, text, 0.25);
    vars[`pie${i + 1}`] = c;
  });
  for (let i = 0; i < 8; i++) {
    const c = accentScale[i % accentScale.length];
    vars[`git${i}`] = c;
    vars[`gitBranchLabel${i}`] = onColor(c, t);
    vars[`gitInv${i}`] = mix(c, bg, 0.6);
    vars[`fillType${i}`] = tints[i % tints.length];
  }
  return vars;
}
