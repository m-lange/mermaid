import { Suspense, lazy, useCallback, useEffect, useRef, useState } from "react";
import {
  Button,
  Caption1,
  Divider,
  MessageBar,
  MessageBarActions,
  MessageBarBody,
  Spinner,
  Toast,
  ToastTitle,
  Toaster,
  makeStyles,
  tokens,
  useId,
  useToastController,
} from "@fluentui/react-components";
import { DismissRegular } from "@fluentui/react-icons";
import type { HostAdapter } from "../office/hostAdapter";
import { BrowserAdapter } from "../office/browserAdapter";
import { DEFAULT_OPTIONS, newId, type DiagramOptions, type DiagramRecord } from "../shared/model";
import { detectDiagramType, getDiagramType, type DiagramTypeDef } from "../shared/templates";
import { formatError, getDocumentTheme, loadMermaid, renderDiagram, setDocumentTheme } from "../shared/render";
import { completeTheme, themeFingerprint, type DocumentTheme } from "../shared/docTheme";
import { Gallery } from "./components/Gallery";
import type { EditorSession, LiveResult, PreviewMode } from "./components/DiagramEditor";
import { DocumentList, type ListEntry } from "./components/DocumentList";

const PREVIEW_KEY = "mermaid.previewMode";

/** Fingerabdruck des aktuell eingelesenen Dokumentdesigns */
function currentThemeKey() {
  return themeFingerprint(getDocumentTheme());
}

/**
 * Eindeutiger Schlüssel für einen Darstellungsstand. Beim Dokumentdesign gehört das Design dazu
 * (Standard: aktuelles Design; für bereits gerenderte Bilder: das gespeicherte).
 */
function keyOf(code: string, o: DiagramOptions, themeKey: string = currentThemeKey()) {
  return `${o.theme}#${o.theme === "document" ? themeKey : ""}|${o.look}|${o.background}|${code}`;
}

// Editor (CodeMirror) erst bei Bedarf laden
const DiagramEditor = lazy(() => import("./components/DiagramEditor").then((m) => ({ default: m.DiagramEditor })));

const useStyles = makeStyles({
  app: {
    display: "flex",
    flexDirection: "column",
    height: "100vh",
    backgroundColor: tokens.colorNeutralBackground2,
    color: tokens.colorNeutralForeground1,
  },
  content: { flexGrow: 1, minHeight: 0, overflow: "auto", padding: "12px 14px", display: "flex", flexDirection: "column", gap: "14px" },
  editorContent: { flexGrow: 1, minHeight: 0, padding: "10px 14px", display: "flex", flexDirection: "column" },
  overlay: {
    position: "fixed",
    inset: 0,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: tokens.colorBackgroundOverlay,
    zIndex: 1000,
  },
  overlayCard: {
    padding: "16px 20px",
    borderRadius: tokens.borderRadiusLarge,
    backgroundColor: tokens.colorNeutralBackground1,
    boxShadow: tokens.shadow16,
  },
  browserDoc: { display: "flex", flexDirection: "column", gap: "6px" },
  browserThumb: {
    maxWidth: "100%",
    maxHeight: "120px",
    objectFit: "contain",
    border: `1px solid ${tokens.colorNeutralStroke2}`,
    borderRadius: tokens.borderRadiusMedium,
    backgroundColor: "#fff",
    cursor: "pointer",
  },
});

interface Props {
  adapter: HostAdapter;
  dark: boolean;
}

export function App({ adapter, dark }: Props) {
  const s = useStyles();
  const toasterId = useId("toaster");
  const { dispatchToast } = useToastController(toasterId);

  const [session, setSession] = useState<EditorSession | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [entries, setEntries] = useState<ListEntry[] | null>(null);
  const [listLoading, setListLoading] = useState(false);
  const [selectionChangedWhileDirty, setSelectionChangedWhileDirty] = useState(false);
  const [, forceUpdate] = useState(0);

  const dirtyRef = useRef(false);
  const sessionRef = useRef<EditorSession | null>(null);
  sessionRef.current = session;
  const suppressSelectionRef = useRef(0);

  // ------------------------------------------------------------ Dokumentdesign
  const [docTheme, setDocTheme] = useState<DocumentTheme>(() => getDocumentTheme());
  /** Erstes Einlesen des Designs – neue Diagramme warten darauf */
  const themeReadyRef = useRef<Promise<void> | null>(null);
  const loadDocumentTheme = useCallback(async () => {
    try {
      const partial = adapter.getDocumentTheme ? await adapter.getDocumentTheme() : null;
      const theme = completeTheme(partial);
      setDocumentTheme(theme);
      setDocTheme(theme);
    } catch (e) {
      console.warn("Dokumentdesign konnte nicht gelesen werden – Office-Standard wird verwendet", e);
    }
  }, [adapter]);
  useEffect(() => {
    themeReadyRef.current = loadDocumentTheme();
  }, [loadDocumentTheme]);

  // ------------------------------------------------------------ Vorschau-Modus
  const [previewMode, setPreviewModeState] = useState<PreviewMode>(() => {
    try {
      const v = localStorage.getItem(PREVIEW_KEY);
      if (v === "document" || v === "pane") return v;
    } catch {
      /* Speicher nicht verfügbar */
    }
    return adapter.kind === "Browser" ? "pane" : "document";
  });
  const setPreviewMode = useCallback((m: PreviewMode) => {
    setPreviewModeState(m);
    try {
      localStorage.setItem(PREVIEW_KEY, m);
    } catch {
      /* Speicher nicht verfügbar */
    }
  }, []);

  /**
   * Was aktuell tatsächlich im Dokument zu sehen ist (Code + Optionen, natürliche Größe,
   * Anzahl der Elemente). Wird nur nach echten Dokument-Updates geändert, damit
   * "Abbrechen" und verspätete Live-Updates immer den richtigen Ausgangspunkt haben.
   */
  const docStateRef = useRef<{ key: string; widthPx: number; heightPx: number; count: number }>({
    key: "",
    widthPx: 0,
    heightPx: 0,
    count: 1,
  });
  const liveQueueRef = useRef<{
    busy: boolean;
    next: { code: string; options: DiagramOptions; restoreOnly: boolean; resolve: (r: LiveResult) => void } | null;
  }>({ busy: false, next: null });

  /** Editor-Sitzung starten; das Dokument zeigt zu diesem Zeitpunkt den gespeicherten Stand. */
  const startSession = useCallback((next: EditorSession) => {
    const r = next.record;
    // Das Bild im Dokument wurde mit dem gespeicherten Design gerendert (ältere Diagramme: aktuelles)
    docStateRef.current = {
      key: keyOf(r.code, r, r.themeKey ?? currentThemeKey()),
      widthPx: r.widthPx,
      heightPx: r.heightPx,
      count: 1,
    };
    setSession(next);
  }, []);

  const waitLiveIdle = useCallback(
    () =>
      new Promise<void>((resolve) => {
        const check = () => {
          const q = liveQueueRef.current;
          if (!q.busy && !q.next) resolve();
          else window.setTimeout(check, 50);
        };
        check();
      }),
    [],
  );

  const notify = useCallback(
    (title: string, intent: "success" | "info" | "warning" | "error" = "success") =>
      dispatchToast(
        <Toast>
          <ToastTitle>{title}</ToastTitle>
        </Toast>,
        { intent, timeout: 2500 },
      ),
    [dispatchToast],
  );

  // Mermaid und Editor im Hintergrund vorladen, sobald die Oberfläche steht
  useEffect(() => {
    const t = window.setTimeout(() => {
      void loadMermaid().catch((e) => console.warn("Mermaid konnte nicht vorgeladen werden", e));
      void import("./components/DiagramEditor");
    }, 200);
    return () => window.clearTimeout(t);
  }, []);

  // ------------------------------------------------------------ Dokumentliste
  const refreshList = useCallback(async () => {
    setListLoading(true);
    try {
      const [records, elements] = await Promise.all([adapter.store.list(), adapter.listDocumentDiagrams()]);
      const counts = new Map<string, { n: number; location?: string }>();
      for (const e of elements) {
        const c = counts.get(e.id) ?? { n: 0, location: e.location };
        c.n++;
        counts.set(e.id, c);
      }
      const list = records
        .map((record) => ({ record, occurrences: counts.get(record.id)?.n ?? 0, location: counts.get(record.id)?.location }))
        .sort((a, b) => (b.record.modified || "").localeCompare(a.record.modified || ""));
      setEntries(list);
    } catch (e) {
      console.error(e);
      setError(`Diagrammliste konnte nicht geladen werden: ${formatError(e)}`);
    } finally {
      setListLoading(false);
    }
  }, [adapter]);

  // ------------------------------------------------------------ Editor öffnen
  const openEditor = useCallback(
    async (id: string) => {
      if (sessionRef.current?.record.id === id) return;
      await waitLiveIdle();
      const record = await adapter.store.get(id);
      if (record) {
        startSession({ record, isNew: false });
        return;
      }
      // Element vorhanden, aber Custom XML Part fehlt (z. B. aus anderem Dokument kopiert)
      const recovered = adapter.recoverCode ? await adapter.recoverCode(id) : null;
      const type = recovered ? detectDiagramType(recovered) : undefined;
      const now = new Date().toISOString();
      startSession({
        isNew: false,
        notice: recovered
          ? "Für dieses Diagramm wurden keine gespeicherten Daten gefunden. Der Code wurde aus dem Alternativtext wiederhergestellt – bitte speichern."
          : "Für dieses Diagramm wurden keine gespeicherten Daten gefunden. Speichern ersetzt das Bild durch den Code im Editor.",
        record: {
          id,
          type: type?.id ?? "flowchart",
          code: recovered ?? getDiagramType("flowchart")!.template,
          ...DEFAULT_OPTIONS,
          widthPx: 0,
          heightPx: 0,
          created: now,
          modified: "",
        },
      });
    },
    [adapter, startSession, waitLiveIdle],
  );

  const closeEditor = useCallback(() => {
    setSession(null);
    setSelectionChangedWhileDirty(false);
    dirtyRef.current = false;
  }, []);

  // ------------------------------------------------------------ Auswahl verfolgen
  const syncWithSelection = useCallback(async () => {
    if (suppressSelectionRef.current > 0) return;
    try {
      const id = await adapter.getSelectedDiagramId();
      const current = sessionRef.current?.record.id ?? null;
      if (id === current) {
        setSelectionChangedWhileDirty(false);
        return;
      }
      if (dirtyRef.current) {
        setSelectionChangedWhileDirty(true);
        return;
      }
      if (id) await openEditor(id);
      else if (adapter.supportsSelectionDetection && current) {
        closeEditor();
        void refreshList();
      }
    } catch (e) {
      console.warn("Auswahl konnte nicht gelesen werden", e);
    }
  }, [adapter, openEditor, closeEditor, refreshList]);

  useEffect(() => {
    let timer: number | undefined;
    let dispose: (() => void) | undefined;
    const handler = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(() => void syncWithSelection(), 250);
    };
    void adapter.onSelectionChanged(handler).then((d) => (dispose = d));
    void syncWithSelection();
    void refreshList();
    return () => {
      window.clearTimeout(timer);
      dispose?.();
    };
  }, [adapter, syncWithSelection, refreshList]);

  // ------------------------------------------------------------ Aktionen
  const withSuppressedSelection = useCallback(async <T,>(fn: () => Promise<T>) => {
    suppressSelectionRef.current++;
    try {
      return await fn();
    } finally {
      // Auswahlereignisse, die durch das Einfügen/Aktualisieren selbst entstehen, ignorieren
      window.setTimeout(() => suppressSelectionRef.current--, 600);
    }
  }, []);

  // ------------------------------------------------------------ Live-Vorschau im Dokument
  /** Schreibt den Code sofort ins Dokument (nicht in die Custom XML Part). */
  const applyToDocument = useCallback(
    async (code: string, options: DiagramOptions, restoreOnly = false): Promise<LiveResult> => {
      const current = sessionRef.current;
      if (!current) return { ok: true, applied: 0 };
      const doc = docStateRef.current;
      if (restoreOnly) {
        // Zeigt das Dokument bereits den gespeicherten Stand (mit dessen Design)? Dann nichts tun.
        const r = current.record;
        if (doc.key === keyOf(r.code, r, r.themeKey ?? currentThemeKey())) return { ok: true, applied: doc.count };
      }
      const key = keyOf(code, options);
      if (key === doc.key) return { ok: true, applied: doc.count };
      let img;
      try {
        img = await renderDiagram(code, options);
      } catch (e) {
        return { ok: false, kind: "syntax", error: formatError(e) };
      }
      const type = detectDiagramType(code);
      const label = type?.label ?? getDiagramType(current.record.type)?.label ?? "Diagramm";
      const record: DiagramRecord = {
        ...current.record,
        ...options,
        code,
        type: type?.id ?? current.record.type,
        widthPx: img.widthPx,
        heightPx: img.heightPx,
      };
      try {
        const n = await withSuppressedSelection(() => adapter.updateDiagram(record, { widthPx: doc.widthPx }, img, label));
        docStateRef.current =
          n > 0 ? { key, widthPx: img.widthPx, heightPx: img.heightPx, count: n } : { ...doc, count: 0 };
        return { ok: true, applied: n };
      } catch (e) {
        console.error(e);
        return { ok: false, kind: "office", error: formatError(e) };
      }
    },
    [adapter, withSuppressedSelection],
  );

  /** Live-Update anstoßen. Es zählt immer nur der neueste Stand; Zwischenstände werden übersprungen. */
  const liveUpdate = useCallback(
    (code: string, options: DiagramOptions, restoreOnly = false) =>
      new Promise<LiveResult>((resolve) => {
        const q = liveQueueRef.current;
        q.next?.resolve({ ok: true, applied: docStateRef.current.count, superseded: true });
        q.next = { code, options, restoreOnly, resolve };
        if (q.busy) return;
        q.busy = true;
        void (async () => {
          while (q.next) {
            const job = q.next;
            q.next = null;
            job.resolve(await applyToDocument(job.code, job.options, job.restoreOnly));
          }
          q.busy = false;
        })();
      }),
    [applyToDocument],
  );

  const insertDiagram = async (type: DiagramTypeDef) => {
    setError(null);
    setBusy(`${type.label} wird eingefügt …`);
    try {
      await themeReadyRef.current;
      const now = new Date().toISOString();
      const img = await renderDiagram(type.template, DEFAULT_OPTIONS);
      const record: DiagramRecord = {
        id: newId(),
        type: type.id,
        code: type.template,
        ...DEFAULT_OPTIONS,
        widthPx: img.widthPx,
        heightPx: img.heightPx,
        created: now,
        modified: now,
        themeKey: DEFAULT_OPTIONS.theme === "document" ? currentThemeKey() : undefined,
      };
      await withSuppressedSelection(async () => {
        await adapter.insertDiagram(record, img, type.label);
        await adapter.store.save(record);
      });
      dirtyRef.current = false;
      startSession({ record, isNew: true });
      notify(`${type.label} eingefügt`);
    } catch (e) {
      console.error(e);
      setError(`Einfügen fehlgeschlagen: ${formatError(e)}`);
    } finally {
      setBusy(null);
    }
  };

  const saveDiagram = async (code: string, options: DiagramOptions) => {
    const current = sessionRef.current;
    if (!current) return;
    setError(null);
    setSaving(true);
    try {
      await waitLiveIdle();
      const type = detectDiagramType(code);
      const key = keyOf(code, options);
      const doc = docStateRef.current;
      let size = { widthPx: doc.widthPx, heightPx: doc.heightPx };
      let updated = doc.count;
      const base: DiagramRecord = {
        ...current.record,
        ...options,
        type: type?.id ?? current.record.type,
        code,
        modified: new Date().toISOString(),
      };
      const label = type?.label ?? getDiagramType(base.type)?.label ?? "Diagramm";
      if (key !== doc.key || doc.count === 0) {
        // Dokument zeigt diesen Stand noch nicht (z. B. Vorschau im Aufgabenbereich) -> jetzt aktualisieren
        const img = await renderDiagram(code, options);
        size = { widthPx: img.widthPx, heightPx: img.heightPx };
        updated = await withSuppressedSelection(() =>
          adapter.updateDiagram({ ...base, ...size }, { widthPx: doc.widthPx }, img, label),
        );
      }
      const record: DiagramRecord = {
        ...base,
        ...size,
        themeKey: options.theme === "document" ? currentThemeKey() : undefined,
      };
      await withSuppressedSelection(() => adapter.store.save(record));
      dirtyRef.current = false;
      setSelectionChangedWhileDirty(false);
      startSession({ record, isNew: false });
      docStateRef.current.count = updated;
      notify(updated > 1 ? `Gespeichert (${updated} Elemente aktualisiert)` : updated === 0 ? "Code gespeichert – kein Element im Dokument gefunden" : "Gespeichert", updated === 0 ? "warning" : "success");
      void refreshList();
    } catch (e) {
      console.error(e);
      setError(`Speichern fehlgeschlagen: ${formatError(e)}`);
    } finally {
      setSaving(false);
    }
  };

  const cancelEdit = () => {
    const current = sessionRef.current;
    if (!current) return;
    // Neues Objekt erzwingt das Zurücksetzen des Editor-Zustands (verwirft dort auch ausstehende Updates)
    setSession({ ...current, record: { ...current.record } });
    // Dokument auf den gespeicherten Stand zurücksetzen – über dieselbe Warteschlange wie die Live-Vorschau,
    // damit ein noch laufendes Update nicht nachträglich den verworfenen Stand schreibt
    void liveUpdate(current.record.code, current.record, true).then((r) => {
      if (!r.ok) setError(`Dokument konnte nicht zurückgesetzt werden: ${r.error}`);
    });
    dirtyRef.current = false;
    setSelectionChangedWhileDirty(false);
    // Falls sich die Auswahl zwischenzeitlich geändert hat, jetzt folgen
    window.setTimeout(() => void syncWithSelection(), 0);
  };

  const editFromList = async (id: string) => {
    setError(null);
    await withSuppressedSelection(() => adapter.selectDiagram(id).catch(() => false));
    await openEditor(id);
  };

  const deleteRecord = async (id: string) => {
    try {
      await adapter.store.remove(id);
      notify("Diagrammdaten gelöscht", "info");
      void refreshList();
    } catch (e) {
      setError(`Löschen fehlgeschlagen: ${formatError(e)}`);
    }
  };

  const onDirtyChange = useCallback((d: boolean) => {
    dirtyRef.current = d;
  }, []);

  // ------------------------------------------------------------ Render
  const browser = adapter instanceof BrowserAdapter ? adapter : null;

  return (
    <div className={s.app}>
      <Toaster toasterId={toasterId} position="top-end" />

      {error && (
        <MessageBar intent="error" layout="multiline" style={{ margin: "8px 14px 0" }}>
          <MessageBarBody>{error}</MessageBarBody>
          <MessageBarActions containerAction={<Button appearance="transparent" icon={<DismissRegular />} onClick={() => setError(null)} aria-label="Schließen" />} />
        </MessageBar>
      )}

      {session ? (
        <div className={s.editorContent}>
          <Suspense fallback={<Spinner label="Editor wird geladen …" />}>
          <DiagramEditor
            session={session}
            dark={dark}
            saving={saving}
            selectionChangedWhileDirty={selectionChangedWhileDirty}
            onDirtyChange={onDirtyChange}
            onSave={saveDiagram}
            onCancel={cancelEdit}
            previewMode={previewMode}
            onPreviewModeChange={setPreviewMode}
            onLiveUpdate={liveUpdate}
            docTheme={docTheme}
            onRefreshTheme={loadDocumentTheme}
            onBack={() => {
              closeEditor();
              void refreshList();
            }}
          />
          </Suspense>
        </div>
      ) : (
        <main className={s.content}>
          {/* Vorhandene Diagramme oben, damit sie bei 35 Typen nicht unter der Galerie verschwinden */}
          {entries && entries.length > 0 && (
            <>
              <DocumentList entries={entries} loading={listLoading} onRefresh={refreshList} onEdit={editFromList} onDelete={deleteRecord} />
              <Divider />
            </>
          )}
          <Gallery disabled={!!busy} onInsert={insertDiagram} />
          {browser && entries && entries.some((e) => e.occurrences > 0) && (
            <div className={s.browserDoc}>
              <Caption1>Simuliertes Dokument (Klick = Auswahl):</Caption1>
              {entries
                .filter((e) => e.occurrences > 0)
                .map((e) => (
                  <img
                    key={e.record.id}
                    className={s.browserThumb}
                    alt={e.record.type}
                    src={`data:image/png;base64,${browser.getPreviewPng(e.record.id)}`}
                    onClick={() => {
                      void browser.selectDiagram(e.record.id);
                      forceUpdate((n) => n + 1);
                    }}
                  />
                ))}
            </div>
          )}
        </main>
      )}

      {busy && (
        <div className={s.overlay}>
          <div className={s.overlayCard}>
            <Spinner label={busy} />
          </div>
        </div>
      )}
    </div>
  );
}
