import { useEffect, useMemo, useRef, useState } from "react";
import {
  Button,
  Caption1,
  MessageBar,
  MessageBarBody,
  MessageBarTitle,
  MessageBarActions,
  Spinner,
  Subtitle2,
  Tooltip,
  ToggleButton,
  makeStyles,
  mergeClasses,
  tokens,
} from "@fluentui/react-components";
import {
  ArrowLeftRegular,
  ArrowResetRegular,
  BookOpenRegular,
  ZoomFitRegular,
  EyeRegular,
  EyeOffRegular,
  SaveRegular,
  DismissRegular,
} from "@fluentui/react-icons";
import type { DiagramOptions, DiagramRecord } from "../../shared/model";
import { detectDiagramType, getDiagramType } from "../../shared/templates";
import { formatError, renderSvg } from "../../shared/render";
import { CodeEditor, type CodeEditorHandle } from "../editor/CodeEditor";
import { themeFingerprint, type DocumentTheme } from "../../shared/docTheme";
import { EditorToolbar } from "./EditorToolbar";
import { iconFor } from "../icons";
import { tr } from "../../shared/strings";

const useStyles = makeStyles({
  root: { display: "flex", flexDirection: "column", height: "100%", minHeight: 0, gap: "8px" },
  header: { display: "flex", alignItems: "center", gap: "6px", minHeight: "32px" },
  headerTitle: { display: "flex", alignItems: "center", gap: "6px", flexGrow: 1, minWidth: 0 },
  headerIcon: { fontSize: "20px", color: tokens.colorBrandForeground1, flexShrink: 0 },
  editorBox: {
    flex: "1 1 40%",
    minHeight: "140px",
    border: `1px solid ${tokens.colorNeutralStroke1}`,
    borderRadius: tokens.borderRadiusMedium,
    overflow: "hidden",
    display: "flex",
    flexDirection: "column",
    ":focus-within": { border: `1px solid ${tokens.colorBrandStroke1}` },
  },
  previewBox: {
    flex: "1 1 45%",
    minHeight: "140px",
    position: "relative",
    border: `1px solid ${tokens.colorNeutralStroke2}`,
    borderRadius: tokens.borderRadiusMedium,
    overflow: "auto",
    display: "flex",
    alignItems: "flex-start",
    justifyContent: "center",
    padding: "8px",
    boxSizing: "border-box",
  },
  previewWhite: { backgroundColor: "#ffffff" },
  previewDark: { backgroundColor: "#333333" },
  previewChecker: {
    backgroundColor: "#ffffff",
    backgroundImage:
      "linear-gradient(45deg,#eee 25%,transparent 25%),linear-gradient(-45deg,#eee 25%,transparent 25%),linear-gradient(45deg,transparent 75%,#eee 75%),linear-gradient(-45deg,transparent 75%,#eee 75%)",
    backgroundSize: "16px 16px",
    backgroundPosition: "0 0,0 8px,8px -8px,-8px 0",
  },
  stale: { opacity: 0.45 },
  previewToolbar: {
    position: "sticky",
    top: 0,
    marginLeft: "auto",
    display: "flex",
    gap: "2px",
    zIndex: 1,
    float: "right",
  },
  spinner: { position: "absolute", top: "8px", left: "8px" },
  footer: { display: "flex", gap: "8px", alignItems: "center" },
  // Hinweisleisten nie zusammendrücken (sonst ragen ihre Buttons in die nächste Zeile)
  bar: { flexShrink: 0 },
  grow: { flexGrow: 1 },
  status: { color: tokens.colorNeutralForeground3 },
  error: { maxHeight: "110px", overflow: "auto", whiteSpace: "pre-wrap", fontFamily: "Consolas, monospace", fontSize: "11px" },
});

/** Wo die Vorschau angezeigt wird: live im Dokument oder im Aufgabenbereich */
export type PreviewMode = "document" | "pane";

export type LiveResult =
  | { ok: true; applied: number; superseded?: boolean }
  | { ok: false; kind: "syntax" | "office"; error: string };

export interface EditorSession {
  record: DiagramRecord;
  isNew: boolean;
  /** Hinweis, z. B. wenn der Code aus dem Alternativtext wiederhergestellt wurde */
  notice?: string;
}

interface Props {
  session: EditorSession;
  dark: boolean;
  saving: boolean;
  /** Auswahl im Dokument hat sich geändert, während ungespeicherte Änderungen existieren */
  selectionChangedWhileDirty: boolean;
  onDirtyChange: (dirty: boolean) => void;
  onSave: (code: string, options: DiagramOptions) => void;
  onCancel: () => void;
  onBack: () => void;
  previewMode: PreviewMode;
  onPreviewModeChange: (mode: PreviewMode) => void;
  /** Schreibt den Stand live ins Dokument (nur im Modus "document") */
  onLiveUpdate: (code: string, options: DiagramOptions, restoreOnly?: boolean) => Promise<LiveResult>;
  /** Aus dem Office-Dokument gelesenes Design */
  docTheme: DocumentTheme;
  onRefreshTheme: () => Promise<void>;
}

export function DiagramEditor({
  session,
  dark,
  saving,
  selectionChangedWhileDirty,
  onDirtyChange,
  onSave,
  onCancel,
  onBack,
  previewMode,
  onPreviewModeChange,
  onLiveUpdate,
  docTheme,
  onRefreshTheme,
}: Props) {
  const s = useStyles();
  const { record } = session;
  const [code, setCode] = useState(record.code);
  const [options, setOptions] = useState<DiagramOptions>({ theme: record.theme, look: record.look, background: record.background });
  const [svg, setSvg] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [rendering, setRendering] = useState(false);
  const [fit, setFit] = useState(true);
  /** Live-Update: Element im Dokument nicht gefunden -> Vorschau hier anzeigen */
  const [docMissing, setDocMissing] = useState(false);
  const [officeError, setOfficeError] = useState<string | null>(null);
  const renderSeq = useRef(0);
  const editorRef = useRef<CodeEditorHandle>(null);

  // Neue Sitzung (anderes Diagramm) -> Zustand zurücksetzen
  useEffect(() => {
    setCode(record.code);
    setOptions({ theme: record.theme, look: record.look, background: record.background });
  }, [record]);

  const dirty =
    code !== record.code ||
    options.theme !== record.theme ||
    options.look !== record.look ||
    options.background !== record.background;

  useEffect(() => onDirtyChange(dirty), [dirty, onDirtyChange]);
  const dirtyRef = useRef(dirty);
  dirtyRef.current = dirty;

  // Diagramm wurde mit einem anderen Dokumentdesign gerendert als dem aktuellen
  const themeOutdated =
    !dirty &&
    options.theme === "document" &&
    !!record.themeKey &&
    record.themeKey !== themeFingerprint(docTheme);

  const showPane = previewMode === "pane" || docMissing;

  // Live-Vorschau (entprellt): im Dokument oder im Aufgabenbereich
  useEffect(() => {
    const seq = ++renderSeq.current;
    setRendering(true);
    const renderPane = async () => {
      const res = await renderSvg(code, options);
      if (seq === renderSeq.current) setSvg(res.svg);
    };
    const handle = window.setTimeout(
      async () => {
        try {
          if (previewMode === "pane") {
            await renderPane();
            if (seq === renderSeq.current) setError(null);
            return;
          }
          // Unverändert -> nur wiederherstellen, falls das Dokument noch einen ungespeicherten Stand zeigt
          // (Öffnen/Auswählen ändert das Dokument dadurch nie)
          const r = await onLiveUpdate(code, options, !dirtyRef.current);
          if (seq !== renderSeq.current || (r.ok && r.superseded)) return;
          if (!r.ok) {
            if (r.kind === "syntax") setError(r.error);
            else setOfficeError(r.error);
            return;
          }
          setError(null);
          setOfficeError(null);
          setDocMissing(r.applied === 0);
          if (r.applied === 0) await renderPane();
        } catch (e) {
          if (seq === renderSeq.current) setError(formatError(e));
        } finally {
          if (seq === renderSeq.current) setRendering(false);
        }
      },
      // Dokument-Updates sind teurer -> etwas länger warten
      previewMode === "document" ? 700 : 350,
    );
    return () => window.clearTimeout(handle);
    // docTheme: nach erneutem Einlesen des Designs neu rendern
  }, [code, options, previewMode, onLiveUpdate, docTheme]);

  const type = useMemo(() => detectDiagramType(code) ?? getDiagramType(record.type), [code, record.type]);
  const Icon = iconFor(type?.id);

  const previewBg =
    options.background === "transparent"
      ? s.previewChecker
      : options.theme === "dark"
        ? s.previewDark
        : s.previewWhite;

  const resetToTemplate = () => {
    const t = getDiagramType(record.type) ?? type;
    if (t) setCode(t.template);
  };

  return (
    <div className={s.root}>
      <div className={s.header}>
        <Tooltip content={dirty ? tr("backDirty") : tr("back")} relationship="label">
          <Button appearance="subtle" icon={<ArrowLeftRegular />} onClick={onBack} disabled={dirty || saving} />
        </Tooltip>
        <div className={s.headerTitle}>
          <Icon className={s.headerIcon} />
          <Subtitle2 truncate wrap={false}>
            {type?.label ?? tr("diagramFallback")}
          </Subtitle2>
        </div>
        {type && (
          <Tooltip content={tr("openDocs")} relationship="label">
            <Button as="a" href={type.docs} target="_blank" rel="noreferrer" appearance="subtle" icon={<BookOpenRegular />} />
          </Tooltip>
        )}
        <Tooltip
          content={previewMode === "document" ? tr("showPanePreview") : tr("showDocPreview")}
          relationship="label"
        >
          <ToggleButton
            appearance="subtle"
            checked={previewMode === "pane"}
            icon={previewMode === "pane" ? <EyeRegular /> : <EyeOffRegular />}
            onClick={() => onPreviewModeChange(previewMode === "pane" ? "document" : "pane")}
            data-testid="preview-toggle"
          />
        </Tooltip>
        <Tooltip content={tr("resetExample")} relationship="label">
          <Button appearance="subtle" icon={<ArrowResetRegular />} onClick={resetToTemplate} disabled={saving} />
        </Tooltip>
      </div>

      {session.notice && (
        <MessageBar className={s.bar} intent="warning">
          <MessageBarBody>{session.notice}</MessageBarBody>
        </MessageBar>
      )}
      {themeOutdated && (
        <MessageBar className={s.bar} intent="info" layout="multiline">
          <MessageBarBody>{tr("themeChanged")}</MessageBarBody>
          <MessageBarActions>
            <Button size="small" onClick={() => onSave(code, options)} disabled={saving}>
              {tr("update")}
            </Button>
          </MessageBarActions>
        </MessageBar>
      )}
      {selectionChangedWhileDirty && (
        <MessageBar className={s.bar} intent="info">
          <MessageBarBody>
            {tr("selectionChanged")}
          </MessageBarBody>
        </MessageBar>
      )}

      <EditorToolbar
        typeId={type?.id}
        options={options}
        onOptionsChange={setOptions}
        onInsert={(sn) => editorRef.current?.insertSnippet(sn)}
        onRefreshTheme={() => void onRefreshTheme()}
        disabled={saving}
      />

      <div className={s.editorBox}>
        <CodeEditor ref={editorRef} value={code} onChange={setCode} dark={dark} />
      </div>

      {officeError && (
        <MessageBar className={s.bar} intent="warning" layout="multiline">
          <MessageBarBody>
            <MessageBarTitle>{tr("docUpdateFailed")}</MessageBarTitle>
            {officeError}
          </MessageBarBody>
        </MessageBar>
      )}
      {docMissing && previewMode === "document" && (
        <MessageBar className={s.bar} intent="info">
          <MessageBarBody>{tr("docMissing")}</MessageBarBody>
        </MessageBar>
      )}

      {error && (
        <MessageBar className={s.bar} intent="error" layout="multiline">
          <MessageBarBody>
            <MessageBarTitle>{tr("syntaxError")}</MessageBarTitle>
            <div className={s.error}>{error}</div>
          </MessageBarBody>
        </MessageBar>
      )}

      {showPane && (
      <div
        className={mergeClasses(s.previewBox, previewBg)}
        style={options.theme === "document" && options.background === "theme" ? { backgroundColor: docTheme.lt1, backgroundImage: "none" } : undefined}
        aria-label={tr("preview")}
      >
        {rendering && <Spinner className={s.spinner} size="tiny" />}
        <div
          className={mergeClasses("preview-svg", fit ? "preview-fit" : "preview-full", error ? s.stale : undefined)}
          dangerouslySetInnerHTML={{ __html: svg }}
        />
        <div className={s.previewToolbar}>
          <Tooltip content={fit ? tr("originalSize") : tr("fitWidth")} relationship="label">
            <ToggleButton size="small" appearance="subtle" checked={!fit} icon={<ZoomFitRegular />} onClick={() => setFit(!fit)} />
          </Tooltip>
        </div>
      </div>
      )}

      <div className={s.footer}>
        <Caption1 className={s.status}>
          {rendering && previewMode === "document" && !showPane ? (
            <>
              <Spinner size="extra-tiny" style={{ display: "inline-flex", verticalAlign: "middle", marginRight: 4 }} />
              {tr("updatingDocument")}
            </>
          ) : session.isNew && !dirty ? (
            tr("statusInserted")
          ) : dirty ? (
            previewMode === "document" && !showPane ? tr("statusLiveUnsaved") : tr("statusUnsaved")
          ) : (
            tr("statusSaved")
          )}
        </Caption1>
        <div className={s.grow} />
        <Button
          icon={<DismissRegular />}
          onClick={onCancel}
          disabled={!dirty || saving}
          title={previewMode === "document" ? tr("cancelDocTitle") : tr("cancelTitle")}
        >
          {tr("cancel")}
        </Button>
        <Button
          appearance="primary"
          icon={saving ? <Spinner size="tiny" /> : <SaveRegular />}
          onClick={() => onSave(code, options)}
          disabled={!dirty || !!error || saving || rendering}
        >
          {tr("save")}
        </Button>
      </div>
    </div>
  );
}
