import { StreamLanguage, HighlightStyle, syntaxHighlighting, LanguageSupport, type StringStream } from "@codemirror/language";
import { tags as t } from "@lezer/highlight";
import { snippetCompletion, type Completion, type CompletionContext, type CompletionResult } from "@codemirror/autocomplete";
import { detectDiagramType } from "../../shared/templates";
import { snippetsFor, toCodeMirrorSnippet } from "../../shared/snippets";

/** Schlüsselwörter, die einen Diagrammtyp einleiten */
const DIAGRAM_KEYWORDS = [
  "flowchart", "graph", "sequenceDiagram", "classDiagram", "stateDiagram", "stateDiagram-v2",
  "erDiagram", "journey", "gantt", "pie", "quadrantChart", "requirementDiagram", "gitGraph",
  "C4Context", "C4Container", "C4Component", "C4Dynamic", "C4Deployment", "mindmap", "timeline",
  "sankey-beta", "sankey", "xychart-beta", "xychart", "block-beta", "block", "packet-beta", "packet",
  "kanban", "architecture-beta", "architecture", "radar-beta", "radar", "treemap-beta", "treemap",
  "zenuml", "agentflow-beta", "swimlane-beta", "treeView-beta", "eventmodeling", "ishikawa-beta",
  "ishikawa", "venn-beta", "usecase-beta", "wardley-beta", "cynefin-beta", "railroad-beta",
  "railroad-ebnf-beta", "railroad-abnf-beta", "railroad-peg-beta",
];

/** Allgemeine Schlüsselwörter über alle Diagrammtypen hinweg */
const KEYWORDS = [
  // Flowchart & allgemein
  "subgraph", "end", "direction", "TB", "TD", "BT", "RL", "LR", "classDef", "class", "style",
  "linkStyle", "click", "href", "call", "callback", "title", "accTitle", "accDescr",
  // Sequenz
  "participant", "actor", "as", "box", "activate", "deactivate", "Note", "note", "over", "left",
  "right", "of", "loop", "alt", "else", "opt", "par", "and", "critical", "option", "break", "rect",
  "autonumber", "create", "destroy", "link", "links",
  // Klassen & Zustände
  "namespace", "state", "cssClass", "for",
  // Gantt
  "dateFormat", "axisFormat", "tickInterval", "excludes", "includes", "todayMarker", "weekday",
  "section", "after", "until", "milestone", "done", "active", "crit", "vert", "weekends",
  // Pie & Charts
  "showData", "x-axis", "y-axis", "quadrant-1", "quadrant-2", "quadrant-3", "quadrant-4",
  "bar", "line", "horizontal", "axis", "curve", "max", "min", "ticks", "graticule", "showLegend",
  // Git
  "commit", "branch", "checkout", "switch", "merge", "cherry-pick", "id", "tag", "type", "order",
  "HIGHLIGHT", "REVERSE", "NORMAL",
  // Requirement
  "requirement", "functionalRequirement", "performanceRequirement", "interfaceRequirement",
  "physicalRequirement", "designConstraint", "element", "text", "risk", "verifymethod", "docref",
  "contains", "copies", "derives", "satisfies", "verifies", "refines", "traces",
  // Architektur & Block
  "group", "service", "junction", "in", "columns", "space",
  // C4
  "Person", "Person_Ext", "System", "System_Ext", "SystemDb", "SystemQueue", "System_Boundary",
  "Enterprise_Boundary", "Container", "Container_Boundary", "ContainerDb", "Component", "Rel",
  "BiRel", "Rel_U", "Rel_D", "Rel_L", "Rel_R", "UpdateElementStyle", "UpdateRelStyle",
  "UpdateLayoutConfig", "Boundary",
  // Mermaid 12
  "flow", "global", "connector", "set", "union", "systemBoundary", "json", "include", "extend",
  "anchor", "component", "pipeline", "evolve", "evolution", "accelerator", "deaccelerator",
  "annotations", "annotation", "size", "complex", "complicated", "clear", "chaotic", "confusion",
  "tf", "rf", "timeframe", "resetframe", "cmd", "evt", "ui", "readmodel", "pcr", "data",
  "sequence", "choice", "optional", "oneOrMore", "zeroOrMore", "terminal", "nonterminal", "special",
];

const diagramSet = new Set(DIAGRAM_KEYWORDS);
const keywordSet = new Set(KEYWORDS);

// Sets statt Strings: "".includes() wäre immer true (Endlosschleife am Zeilenende)
const OPEN = new Set(["[", "(", "{"]);
const CLOSE = new Set(["]", ")", "}"]);

interface State {
  frontmatter: "none" | "open" | "done";
  /** Nächstes Token ist das erste der Zeile */
  lineStart: boolean;
  /** Verschachtelungstiefe innerhalb einer Knotenbeschriftung wie A[Text] */
  labelDepth: number;
  /** Verschachtelungstiefe innerhalb von @{ … }-Metadaten */
  metaDepth: number;
  /** In dieser Zeile wurde bereits ein Pfeil gefunden (Text nach ":" ist dann eine Nachricht) */
  sawArrow: boolean;
  /** Vorheriges Token war ein Bezeichner ohne Leerraum dazwischen */
  afterIdent: boolean;
}

// Pfeile/Kanten verschiedener Diagrammtypen
const ARROW_PREFIX = /^(?:<<-{1,2}>>|<-{2,}>|<={2,}>|<-\.+->|<\|(?:--|\.\.)|[*ox](?:--|\.\.)|\(\)--)/;
const ARROW_TIP = /^(?:-{2,}|={2,}|\.{2,}|-\.+-|~{3,}|-)(?:>>|\|>|>|x|o(?![\w])|\)|\*|\(\))[+-]?/;
const ARROW_PLAIN = /^(?:-{2,}|={2,}|\.{2,}|-\.+-|~{3,})/;
const ER_CARDINALITY = /^[|}][|o]?(?:--|\.\.)[o|]?[|{]/;
const OTHER_OPS = /^(?:::=|<-|\+'[^']*'>|\+<>|\+>|=)/;
const IDENT = /^[A-Za-z_À-ɏ][\wÀ-ɏ]*(?:-[A-Za-z0-9]+)*/;
const IDENT_BASE = /^[A-Za-z_À-ɏ][\wÀ-ɏ$]*/;

function tokenFrontmatter(stream: StringStream): string | null {
  if (stream.match(/^\s*#.*/)) return "comment";
  if (stream.sol() && stream.match(/^\s*[\w-]+(?=\s*:)/)) return "propertyName";
  if (stream.match(/^\s*:/)) return "punctuation";
  if (stream.match(/^\s*(?:true|false|null)\b/)) return "atom";
  if (stream.match(/^\s*-?\d+(\.\d+)?\b/)) return "number";
  if (stream.match(/^\s*(["']).*?\1/)) return "string";
  stream.skipToEnd();
  return "string";
}

const streamParser = {
  name: "mermaid",
  startState: (): State => ({
    frontmatter: "none",
    lineStart: true,
    labelDepth: 0,
    metaDepth: 0,
    sawArrow: false,
    afterIdent: false,
  }),
  copyState: (s: State): State => ({ ...s }),
  token(stream: StringStream, state: State): string | null {
    if (stream.sol()) {
      state.lineStart = true;
      state.labelDepth = 0;
      state.sawArrow = false;
      state.afterIdent = false;
    }

    // ---------------------------------------------------------------- YAML-Frontmatter
    if (state.frontmatter !== "done" && stream.sol() && stream.match(/^---\s*$/)) {
      state.frontmatter = state.frontmatter === "none" ? "open" : "done";
      return "meta";
    }
    if (state.frontmatter === "open") return tokenFrontmatter(stream);
    // Erstes Token ist kein "---" -> kein Frontmatter mehr möglich
    state.frontmatter = "done";

    // ---------------------------------------------------------------- Knotenbeschriftung A[Text]
    if (state.labelDepth > 0) {
      if (stream.match(/^"(?:[^"\\]|\\.)*"?/) || stream.match(/^`[^`]*`?/)) return "string";
      if (stream.match(/^[^[\](){}"`]+/)) return "labelName";
      const ch = stream.next() ?? "";
      if (OPEN.has(ch)) state.labelDepth++;
      else if (CLOSE.has(ch)) state.labelDepth--;
      return "bracket";
    }

    // ---------------------------------------------------------------- Metadaten @{ key: value }
    if (state.metaDepth > 0) {
      if (stream.eatSpace()) return null;
      if (stream.match(/^[\w-]+(?=\s*:)/)) return "propertyName";
      if (stream.match(/^(["'])(?:(?!\1).)*\1?/)) return "string";
      if (stream.match(/^-?\d+(\.\d+)?/)) return "number";
      if (stream.match("{")) {
        state.metaDepth++;
        return "bracket";
      }
      if (stream.match("}")) {
        state.metaDepth--;
        return "meta";
      }
      if (stream.match(/^[:,]/)) return "punctuation";
      if (stream.match(/^[^\s,:{}"']+/)) return "atom";
      stream.next();
      return null;
    }

    if (stream.eatSpace()) {
      state.afterIdent = false;
      return null;
    }
    const atLineStart = state.lineStart;
    state.lineStart = false;
    const wasAfterIdent = state.afterIdent;
    state.afterIdent = false;

    // ---------------------------------------------------------------- Kommentare & Direktiven
    if (stream.match("%%{")) {
      stream.skipToEnd();
      return "meta";
    }
    if (stream.match("%%")) {
      stream.skipToEnd();
      return "comment";
    }

    // ---------------------------------------------------------------- Zeichenketten
    if (stream.match(/^"(?:[^"\\]|\\.)*"?/)) return "string";
    if (stream.match(/^`[^`]*`?/)) return "string";

    // ---------------------------------------------------------------- Metadaten-Block
    if (stream.match("@{")) {
      state.metaDepth = 1;
      return "meta";
    }

    if (stream.match(/^:::[\w-]+/)) return "className";
    if (stream.match(/^<<[\w\s]+>>/)) return "typeName";
    if (stream.match(/^#[0-9a-fA-F]{3,8}\b/)) return "color";

    // ---------------------------------------------------------------- Pfeile & Kanten
    if (
      stream.match(ER_CARDINALITY) ||
      stream.match(ARROW_PREFIX) ||
      stream.match(ARROW_TIP) ||
      stream.match(ARROW_PLAIN)
    ) {
      // Rest eines Präfix-Pfeils (z. B. "<|--" gefolgt von nichts) ist bereits verbraucht
      stream.match(ARROW_TIP);
      state.sawArrow = true;
      return "operator";
    }
    // Kantenbeschriftung -->|Text|
    if (state.sawArrow && stream.match(/^\|[^|]*\|/)) return "docString";
    if (stream.match(OTHER_OPS)) {
      state.sawArrow = true;
      return "operator";
    }

    // Nachrichtentext nach einem Pfeil: A->>B: Hallo
    if (state.sawArrow && stream.match(/^:(?!:)/)) {
      stream.skipToEnd();
      return "docString";
    }

    // ---------------------------------------------------------------- Zahlen & Datumswerte
    if (stream.match(/^\d{4}-\d{2}-\d{2}/)) return "number";
    if (stream.match(/^-?\d+(\.\d+)?(px|%|ms|d|w|h|m|s)?\b/)) return "number";

    // ---------------------------------------------------------------- Beschriftung öffnen
    const peek = stream.peek() ?? "";
    if ((wasAfterIdent || atLineStart) && OPEN.has(peek)) {
      stream.next();
      state.labelDepth = 1;
      // Doppelte Klammern ((, [[, {{, [(, ([ gehören zur Form
      while (OPEN.has(stream.peek() ?? "")) {
        stream.next();
        state.labelDepth++;
      }
      return "bracket";
    }
    if (wasAfterIdent && peek === ">" && stream.match(/^>(?=[^>\]]*\])/)) {
      state.labelDepth = 1; // asymmetrische Form A>Text]
      return "bracket";
    }

    // ---------------------------------------------------------------- Bezeichner & Schlüsselwörter
    const full = stream.match(IDENT, false) as RegExpMatchArray | null;
    if (full) {
      const word = full[0];
      if (diagramSet.has(word) || keywordSet.has(word)) {
        stream.match(word);
        return atLineStart && diagramSet.has(word) ? "heading" : "keyword";
      }
      stream.match(IDENT_BASE);
      const base = stream.current();
      state.afterIdent = true;
      if (atLineStart && diagramSet.has(base)) return "heading";
      if (keywordSet.has(base)) return "keyword";
      return "variableName";
    }

    if (stream.match(/^[[\](){}]/)) return "bracket";
    if (stream.match(/^[:,;]/)) return "punctuation";
    stream.next();
    return null;
  },
  languageData: {
    commentTokens: { line: "%%" },
  },
};

export const mermaidStreamLanguage = StreamLanguage.define(streamParser);

const lightStyle = HighlightStyle.define([
  { tag: t.heading, color: "#8250df", fontWeight: "bold" },
  { tag: t.keyword, color: "#0550ae", fontWeight: "600" },
  { tag: t.comment, color: "#6e7781", fontStyle: "italic" },
  { tag: t.string, color: "#0a3069" },
  { tag: t.labelName, color: "#116329" },
  { tag: t.docString, color: "#0f766e", fontStyle: "italic" },
  { tag: t.number, color: "#953800" },
  { tag: t.operator, color: "#cf222e", fontWeight: "bold" },
  { tag: t.bracket, color: "#8c959f" },
  { tag: t.punctuation, color: "#8c959f" },
  { tag: t.meta, color: "#8250df" },
  { tag: t.propertyName, color: "#953800" },
  { tag: t.atom, color: "#0550ae" },
  { tag: t.className, color: "#bc4c00", fontWeight: "600" },
  { tag: t.typeName, color: "#8250df" },
  { tag: t.color, color: "#bc4c00" },
  { tag: t.variableName, color: "#24292f" },
]);

const darkStyle = HighlightStyle.define([
  { tag: t.heading, color: "#d2a8ff", fontWeight: "bold" },
  { tag: t.keyword, color: "#79c0ff", fontWeight: "600" },
  { tag: t.comment, color: "#8b949e", fontStyle: "italic" },
  { tag: t.string, color: "#a5d6ff" },
  { tag: t.labelName, color: "#7ee787" },
  { tag: t.docString, color: "#56d4c3", fontStyle: "italic" },
  { tag: t.number, color: "#ffa657" },
  { tag: t.operator, color: "#ff7b72", fontWeight: "bold" },
  { tag: t.bracket, color: "#8b949e" },
  { tag: t.punctuation, color: "#8b949e" },
  { tag: t.meta, color: "#d2a8ff" },
  { tag: t.propertyName, color: "#ffa657" },
  { tag: t.atom, color: "#79c0ff" },
  { tag: t.className, color: "#ffa657", fontWeight: "600" },
  { tag: t.typeName, color: "#d2a8ff" },
  { tag: t.color, color: "#ffa657" },
  { tag: t.variableName, color: "#e6edf3" },
]);

const GROUP_LABEL: Record<string, string> = {
  nodes: "Element",
  edges: "Verbindung",
  structure: "Struktur",
  style: "Stil",
  general: "Allgemein",
};

function completions(ctx: CompletionContext): CompletionResult | null {
  const word = ctx.matchBefore(/[\w-]+/);
  if (!word || (word.from === word.to && !ctx.explicit)) return null;
  const type = detectDiagramType(ctx.state.doc.toString());
  // Snippets des aktuellen Typs (ohne Frontmatter-Snippets – die gehören in die Toolbox)
  const snippetOptions: Completion[] = snippetsFor(type?.id)
    .filter((sn) => !sn.frontmatter)
    .map((sn) =>
      snippetCompletion(toCodeMirrorSnippet(sn.code), {
        label: sn.label,
        detail: GROUP_LABEL[sn.group],
        type: "text",
        boost: -1,
      }),
    );
  return {
    from: word.from,
    options: [
      ...DIAGRAM_KEYWORDS.map((label) => ({ label, type: "class", boost: 1 })),
      ...KEYWORDS.map((label) => ({ label, type: "keyword" })),
      ...snippetOptions,
    ],
    validFor: /^[\w-]*$/,
  };
}

export function mermaidLanguage(dark: boolean) {
  return [
    new LanguageSupport(mermaidStreamLanguage, [mermaidStreamLanguage.data.of({ autocomplete: completions })]),
    syntaxHighlighting(dark ? darkStyle : lightStyle),
  ];
}
