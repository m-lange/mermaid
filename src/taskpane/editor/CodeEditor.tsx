import { useEffect, useImperativeHandle, useRef, type Ref } from "react";
import { EditorView, keymap, lineNumbers, highlightActiveLine, highlightActiveLineGutter, drawSelection } from "@codemirror/view";
import { EditorState, Compartment } from "@codemirror/state";
import { defaultKeymap, history, historyKeymap, indentWithTab } from "@codemirror/commands";
import { indentOnInput, bracketMatching, foldGutter } from "@codemirror/language";
import { autocompletion, closeBrackets, closeBracketsKeymap, completionKeymap, snippet } from "@codemirror/autocomplete";
import { searchKeymap, highlightSelectionMatches } from "@codemirror/search";
import { mermaidLanguage } from "./mermaidLanguage";
import { expandSnippet, frontmatterEdit, toCodeMirrorSnippet, type Snippet } from "../../shared/snippets";

export interface CodeEditorHandle {
  /** Fügt ein Snippet an der Cursorposition (bzw. im Frontmatter) ein */
  insertSnippet(snippet: Snippet): void;
  focus(): void;
}

const INDENT = "    ";
/** Zeilen, nach denen eingerückt wird (Blockanfänge und Diagrammkopf) */
const BLOCK_OPENER =
  /^\s*(subgraph|loop|alt|else|opt|par|and|critical|option|break|rect|box|namespace|flow|global|systemBoundary|section|pipeline)\b|\{\s*$|^\s*block(:|-beta)?|^\s*(flowchart|graph|sequenceDiagram|classDiagram|stateDiagram(-v2)?|erDiagram|gantt|journey|timeline|requirementDiagram|C4\w+|architecture(-beta)?|kanban|mindmap|quadrantChart|xychart(-beta)?|gitGraph|pie|radar-beta|venn-beta|cynefin-beta|agentflow-beta|swimlane-beta)\b/;

function insertSnippetInto(v: EditorView, sn: Snippet) {
  const state = v.state;
  if (sn.frontmatter) {
    // Frontmatter: direkt einfügen und den ersten Platzhalter markieren
    const e = frontmatterEdit(state.doc.toString(), sn);
    const text = expandSnippet(e.text);
    const m = /#\{([^}]*)\}/.exec(e.text);
    const selFrom = m ? e.from + expandSnippet(e.text.slice(0, m.index)).length : e.from + text.length;
    v.dispatch({
      changes: { from: e.from, to: e.to, insert: text },
      selection: { anchor: selFrom, head: selFrom + (m ? m[1].length : 0) },
      scrollIntoView: true,
    });
    v.focus();
    return;
  }

  // Tabs selbst in Leerzeichen umwandeln; Einrückung relativ zur aktuellen Zeile
  const lines = sn.code.split("\n").map((l) => l.replace(/^\t+/, (tabs) => INDENT.repeat(tabs.length)));
  const line = state.doc.lineAt(state.selection.main.head);
  let from: number;
  let to: number;
  let template: string;

  if (line.text.trim() === "") {
    // Leere Zeile ersetzen
    from = line.from;
    to = line.to;
    if (line.text) {
      // Zeile enthält nur Leerraum: CodeMirror rückt Folgezeilen bereits passend ein
      template = line.text + lines.join("\n");
    } else {
      // Einrückung der vorherigen Zeile übernehmen (bei Blockanfang eine Ebene tiefer)
      let base = "";
      for (let n = line.number - 1; n >= 1; n--) {
        const prev = state.doc.line(n).text;
        if (prev.trim()) {
          base = /^\s*/.exec(prev)![0] + (BLOCK_OPENER.test(prev) ? INDENT : "");
          break;
        }
      }
      template = lines.map((l) => base + l).join("\n");
    }
  } else {
    // Nach der aktuellen Zeile einfügen; CodeMirror ergänzt deren Einrückung für Folgezeilen
    from = to = line.to;
    const extra = BLOCK_OPENER.test(line.text) ? INDENT : "";
    template = lines.map((l) => "\n" + extra + l).join("");
  }
  snippet(toCodeMirrorSnippet(template))(v, null, from, to);
  v.focus();
}

interface Props {
  value: string;
  onChange: (value: string) => void;
  dark: boolean;
  /** Fehlerzeile (1-basiert), wird hervorgehoben */
  errorLine?: number;
  ref?: Ref<CodeEditorHandle>;
}

export function CodeEditor({ value, onChange, dark, ref }: Props) {
  const host = useRef<HTMLDivElement>(null);
  const view = useRef<EditorView | null>(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const themeCompartment = useRef(new Compartment());

  useImperativeHandle(
    ref,
    () => ({
      insertSnippet: (sn) => view.current && insertSnippetInto(view.current, sn),
      focus: () => view.current?.focus(),
    }),
    [],
  );

  useEffect(() => {
    if (!host.current) return;
    const v = new EditorView({
      parent: host.current,
      state: EditorState.create({
        doc: value,
        extensions: [
          lineNumbers(),
          highlightActiveLineGutter(),
          foldGutter(),
          history(),
          drawSelection(),
          indentOnInput(),
          bracketMatching(),
          closeBrackets(),
          autocompletion(),
          highlightActiveLine(),
          highlightSelectionMatches(),
          EditorState.tabSize.of(4),
          keymap.of([
            ...closeBracketsKeymap,
            ...defaultKeymap,
            ...searchKeymap,
            ...historyKeymap,
            ...completionKeymap,
            indentWithTab,
          ]),
          themeCompartment.current.of(themeExtensions(dark)),
          EditorView.lineWrapping,
          EditorView.updateListener.of((u) => {
            if (u.docChanged) onChangeRef.current(u.state.doc.toString());
          }),
        ],
      }),
    });
    view.current = v;
    return () => {
      v.destroy();
      view.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Externe Wertänderungen (z. B. anderes Diagramm ausgewählt) übernehmen
  useEffect(() => {
    const v = view.current;
    if (v && v.state.doc.toString() !== value) {
      v.dispatch({ changes: { from: 0, to: v.state.doc.length, insert: value } });
    }
  }, [value]);

  useEffect(() => {
    view.current?.dispatch({ effects: themeCompartment.current.reconfigure(themeExtensions(dark)) });
  }, [dark]);

  return <div ref={host} className="code-editor" />;
}

function themeExtensions(dark: boolean) {
  return [
    mermaidLanguage(dark),
    EditorView.theme(
      {
        "&": {
          height: "100%",
          fontSize: "12.5px",
          backgroundColor: "var(--colorNeutralBackground1)",
          color: "var(--colorNeutralForeground1)",
        },
        ".cm-scroller": {
          fontFamily: '"Cascadia Mono", Consolas, "Courier New", monospace',
          lineHeight: "1.5",
          // Keine Ligaturen: "->>" muss als Zeichenfolge sichtbar bleiben
          fontVariantLigatures: "none",
          fontFeatureSettings: '"liga" 0, "calt" 0',
        },
        ".cm-gutters": {
          backgroundColor: "var(--colorNeutralBackground2)",
          color: "var(--colorNeutralForeground3)",
          borderRight: "1px solid var(--colorNeutralStroke2)",
        },
        ".cm-activeLine": { backgroundColor: dark ? "#ffffff0d" : "#0000000a" },
        ".cm-activeLineGutter": { backgroundColor: dark ? "#ffffff14" : "#0000000f" },
        "&.cm-focused": { outline: "none" },
        ".cm-cursor": { borderLeftColor: "var(--colorNeutralForeground1)" },
        "&.cm-focused .cm-selectionBackground, .cm-selectionBackground, ::selection": {
          backgroundColor: dark ? "#264f78" : "#add6ff",
        },
      },
      { dark },
    ),
  ];
}
