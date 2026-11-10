import type { DiagramRecord, RenderedDiagram } from "../shared/model";
import type { DocumentTheme } from "../shared/docTheme";
import { CustomXmlDiagramStore, type DiagramStore, type XmlRunner } from "./customXmlStore";
import {
  addDocumentSelectionHandler,
  idFromShapeName,
  initialSizePt,
  isSetSupported,
  missingSets,
  shapeNameFor,
  updatedSizePt,
  type DocumentDiagramElement,
  type HostAdapter,
} from "./hostAdapter";
import { tr } from "../shared/strings";

const MAX_W = 720;
const MAX_H = 540;

/**
 * Excel: Jedes Diagramm ist ein Bild-Shape auf einem Arbeitsblatt.
 * Die UUID steckt im Shape-Namen `Mermaid_<uuid>`.
 */
export class ExcelAdapter implements HostAdapter {
  readonly kind = "Excel" as const;
  readonly store: DiagramStore;
  /** Excel liefert die Shape-Auswahl erst mit neueren API-Versionen */
  readonly supportsSelectionDetection: boolean;

  /** Shapes (addImage) und Custom XML Parts */
  missingRequirements() {
    return missingSets([["ExcelApi", "1.9"]]);
  }

  constructor() {
    const run: XmlRunner = (fn) => Excel.run((ctx) => fn(ctx.workbook.customXmlParts as never, ctx));
    this.store = new CustomXmlDiagramStore(run);
    this.supportsSelectionDetection = hasActiveShapeApi();
  }

  getSelectedDiagramId(): Promise<string | null> {
    if (!this.supportsSelectionDetection) return Promise.resolve(null);
    return Excel.run(async (ctx) => {
      const shape = ctx.workbook.getActiveShapeOrNullObject();
      shape.load("name");
      await ctx.sync();
      if (shape.isNullObject) return null;
      return idFromShapeName(shape.name);
    }).catch(() => null);
  }

  private async findShapes(ctx: Excel.RequestContext, id?: string) {
    const sheets = ctx.workbook.worksheets;
    sheets.load("items/name");
    await ctx.sync();
    const collections = sheets.items.map((ws) => {
      const shapes = ws.shapes;
      shapes.load("items/id,items/name,items/left,items/top,items/width,items/height");
      return { ws, shapes };
    });
    await ctx.sync();
    const out: { ws: Excel.Worksheet; shape: Excel.Shape; diagramId: string }[] = [];
    for (const { ws, shapes } of collections) {
      for (const shape of shapes.items) {
        const diagramId = idFromShapeName(shape.name);
        if (diagramId && (!id || diagramId === id)) out.push({ ws, shape, diagramId });
      }
    }
    return out;
  }

  insertDiagram(record: DiagramRecord, img: RenderedDiagram, typeLabel: string): Promise<void> {
    return Excel.run(async (ctx) => {
      const ws = ctx.workbook.worksheets.getActiveWorksheet();
      const cell = ctx.workbook.getActiveCell();
      cell.load("left,top");
      await ctx.sync();
      const size = initialSizePt(img, MAX_W, MAX_H);
      const shape = ws.shapes.addImage(img.pngBase64);
      shape.name = shapeNameFor(record.id);
      shape.lockAspectRatio = true;
      shape.left = cell.left;
      shape.top = cell.top;
      shape.width = size.width;
      shape.height = size.height;
      applyAltText(shape, record, typeLabel);
      await ctx.sync();
    });
  }

  updateDiagram(record: DiagramRecord, previous: Pick<DiagramRecord, "widthPx"> | null, img: RenderedDiagram, typeLabel: string) {
    return Excel.run(async (ctx) => {
      const found = await this.findShapes(ctx, record.id);
      for (const { ws, shape } of found) {
        const geo = { left: shape.left, top: shape.top, width: shape.width };
        const size = updatedSizePt(geo.width, previous, img, MAX_W * 2);
        shape.delete();
        const next = ws.shapes.addImage(img.pngBase64);
        next.name = shapeNameFor(record.id);
        next.lockAspectRatio = true;
        next.left = geo.left;
        next.top = geo.top;
        next.width = size.width;
        next.height = size.height;
        applyAltText(next, record, typeLabel);
      }
      await ctx.sync();
      return found.length;
    });
  }

  listDocumentDiagrams(): Promise<DocumentDiagramElement[]> {
    return Excel.run(async (ctx) => {
      const found = await this.findShapes(ctx);
      return found.map((f) => ({ id: f.diagramId, location: f.ws.name }));
    });
  }

  selectDiagram(id: string): Promise<boolean> {
    return Excel.run(async (ctx) => {
      const found = await this.findShapes(ctx, id);
      const first = found[0];
      if (!first) return false;
      // Excel bietet keine API zum Auswählen eines Shapes – Blatt aktivieren genügt
      first.ws.activate();
      await ctx.sync();
      return true;
    });
  }

  recoverCode(id: string): Promise<string | null> {
    return Excel.run(async (ctx) => {
      const found = await this.findShapes(ctx, id);
      const shape = found[0]?.shape;
      if (!shape) return null;
      shape.load("altTextDescription");
      await ctx.sync();
      return shape.altTextDescription?.trim() || null;
    });
  }

  /**
   * Excel bietet keine API für das Arbeitsmappendesign. Näherung über integrierte Formatvorlagen:
   * "Standard" (Normal) -> Textkörper-Schrift und Text 1, "Titel" (Title) -> Text 2.
   * Hintergrund 2 und Akzentfarben sind nicht auslesbar (Office-Standardwerte).
   */
  getDocumentTheme(): Promise<Partial<DocumentTheme> | null> {
    return Excel.run(async (ctx) => {
      const normal = ctx.workbook.styles.getItemOrNullObject("Normal");
      normal.load("font/name,font/color");
      const title = ctx.workbook.styles.getItemOrNullObject("Title");
      title.load("font/color");
      await ctx.sync();
      const hexOrUndef = (c?: string) => (c && /^#[0-9a-f]{6}$/i.test(c) ? c.toUpperCase() : undefined);
      return {
        fontBody: normal.isNullObject ? undefined : normal.font.name,
        dk1: normal.isNullObject ? undefined : hexOrUndef(normal.font.color),
        dk2: title.isNullObject ? undefined : hexOrUndef(title.font.color),
      };
    });
  }

  async onSelectionChanged(handler: () => void) {
    const dispose = await addDocumentSelectionHandler(handler);
    if (!this.supportsSelectionDetection) return dispose;
    // Das Anklicken eines Shapes löst in Excel kein Auswahlereignis aus -> leichtes Polling
    const timer = window.setInterval(handler, 1500);
    return () => {
      window.clearInterval(timer);
      dispose();
    };
  }
}

function hasActiveShapeApi(): boolean {
  // Workbook.getActiveShapeOrNullObject ist erst in neueren Excel-Versionen verfügbar
  return isSetSupported("ExcelApi", "1.19");
}

function applyAltText(shape: Excel.Shape, record: DiagramRecord, typeLabel: string) {
  shape.altTextTitle = tr("altTitle", { label: typeLabel });
  shape.altTextDescription = record.code.length > 4000 ? record.code.substring(0, 4000) + " …" : record.code;
}
