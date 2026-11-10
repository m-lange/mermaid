import type { DiagramRecord, RenderedDiagram } from "../shared/model";
import type { DiagramStore } from "./customXmlStore";
import type { DocumentTheme } from "../shared/docTheme";

export type HostKind = "Word" | "Excel" | "PowerPoint" | "Browser";

/** Kennzeichnung der Diagramm-Elemente im Dokument */
export const TAG_PREFIX = "mermaid:";
export const PPT_TAG_KEY = "MERMAID_DIAGRAM_ID";
export const SHAPE_NAME_PREFIX = "Mermaid_";

export function tagFor(id: string) {
  return `${TAG_PREFIX}${id}`;
}
export function idFromTag(tag: string | null | undefined): string | null {
  return tag && tag.startsWith(TAG_PREFIX) ? tag.substring(TAG_PREFIX.length) : null;
}
export function shapeNameFor(id: string) {
  return `${SHAPE_NAME_PREFIX}${id}`;
}
export function idFromShapeName(name: string | null | undefined): string | null {
  return name && name.startsWith(SHAPE_NAME_PREFIX) ? name.substring(SHAPE_NAME_PREFIX.length) : null;
}

/** Größe in Punkt, mit der ein Diagramm (initial) eingefügt wird. */
export function initialSizePt(img: RenderedDiagram, maxWidthPt: number, maxHeightPt: number) {
  let w = img.widthPx * 0.75;
  let h = img.heightPx * 0.75;
  const f = Math.min(1, maxWidthPt / w, maxHeightPt / h);
  w *= f;
  h *= f;
  return { width: w, height: h };
}

/**
 * Neue Größe nach einer Aktualisierung: Der vom Benutzer gewählte Zoomfaktor
 * (aktuelle Breite / ursprüngliche natürliche Breite) bleibt erhalten.
 */
export function updatedSizePt(
  currentWidthPt: number,
  previous: Pick<DiagramRecord, "widthPx"> | null,
  img: RenderedDiagram,
  maxWidthPt: number,
) {
  const prevNaturalPt = (previous?.widthPx || img.widthPx) * 0.75;
  const zoom = currentWidthPt > 0 && prevNaturalPt > 0 ? currentWidthPt / prevNaturalPt : 1;
  let w = img.widthPx * 0.75 * zoom;
  let h = img.heightPx * 0.75 * zoom;
  if (w > maxWidthPt) {
    h *= maxWidthPt / w;
    w = maxWidthPt;
  }
  return { width: w, height: h };
}

export interface DocumentDiagramElement {
  id: string;
  /** Zusatzinfo zur Position, z. B. "Folie 3" oder "Tabelle1" */
  location?: string;
}

export interface HostAdapter {
  readonly kind: HostKind;
  readonly store: DiagramStore;
  /** Kann die Auswahl eines Diagramms im Dokument erkannt werden? */
  readonly supportsSelectionDetection: boolean;

  /** UUID des aktuell ausgewählten Diagramms oder null */
  getSelectedDiagramId(): Promise<string | null>;
  /** Fügt ein neues Diagramm an der aktuellen Position ein */
  insertDiagram(record: DiagramRecord, img: RenderedDiagram, typeLabel: string): Promise<void>;
  /** Ersetzt das Bild aller Elemente mit dieser UUID */
  updateDiagram(record: DiagramRecord, previous: Pick<DiagramRecord, "widthPx"> | null, img: RenderedDiagram, typeLabel: string): Promise<number>;
  /** Alle im Dokument gefundenen Diagramm-Elemente */
  listDocumentDiagrams(): Promise<DocumentDiagramElement[]>;
  /** Wählt das Diagramm im Dokument aus / scrollt dorthin */
  selectDiagram(id: string): Promise<boolean>;
  /**
   * Liest den Mermaid-Code aus dem Alternativtext des Elements – Fallback, wenn die
   * Custom XML Part fehlt (z. B. Diagramm aus einem anderen Dokument kopiert).
   */
  recoverCode?(id: string): Promise<string | null>;
  /** Liest Designfarben und -schriftarten des Dokuments (fehlende Werte = Office-Standard) */
  getDocumentTheme?(): Promise<Partial<DocumentTheme> | null>;
  /** Registriert einen Handler für Auswahländerungen. Gibt eine Abmeldefunktion zurück. */
  onSelectionChanged(handler: () => void): Promise<() => void>;
}

/** Registriert DocumentSelectionChanged (gemeinsame API, Word/Excel/PowerPoint) */
export function addDocumentSelectionHandler(handler: () => void): Promise<() => void> {
  return new Promise((resolve) => {
    try {
      Office.context.document.addHandlerAsync(Office.EventType.DocumentSelectionChanged, handler, (r) => {
        if (r.status !== Office.AsyncResultStatus.Succeeded) {
          console.warn("DocumentSelectionChanged nicht verfügbar", r.error);
          resolve(() => undefined);
          return;
        }
        resolve(() =>
          Office.context.document.removeHandlerAsync(Office.EventType.DocumentSelectionChanged, { handler }),
        );
      });
    } catch (e) {
      console.warn(e);
      resolve(() => undefined);
    }
  });
}

export function isSetSupported(name: string, version: string) {
  try {
    return Office.context.requirements.isSetSupported(name, version);
  } catch {
    return false;
  }
}
