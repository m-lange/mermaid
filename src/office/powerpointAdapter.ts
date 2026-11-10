import type { DiagramRecord, RenderedDiagram } from "../shared/model";
import { unzipSync, strFromU8 } from "fflate";
import { parseThemeXml, type DocumentTheme } from "../shared/docTheme";
import { CustomXmlDiagramStore, type DiagramStore, type XmlRunner } from "./customXmlStore";
import { setSelectedImage } from "./commonImage";
import {
  PPT_TAG_KEY,
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

/** Maximalgröße beim Einfügen (16:9-Folie = 960 × 540 pt) */
const MAX_W = 860;
const MAX_H = 460;
const SLIDE_W = 960;
const SLIDE_H = 540;

interface FoundShape {
  slideId: string;
  slideIndex: number;
  shape: PowerPoint.Shape;
  diagramId: string;
}

/**
 * PowerPoint: Die UUID steht im Shape-Tag `MERMAID_DIAGRAM_ID`
 * (zusätzlich im Shape-Namen `Mermaid_<uuid>`).
 *
 * Ab PowerPointApi 1.8 wird das Diagramm als Rechteck mit Bildfüllung eingefügt.
 * Dadurch kann das Bild später *in-place* ersetzt werden – Position, Z-Reihenfolge,
 * Animationen und Tags bleiben erhalten. Ältere Versionen fügen ein normales Bild
 * über die gemeinsame API ein; beim Aktualisieren wird es dann ersetzt.
 */
export class PowerPointAdapter implements HostAdapter {
  readonly kind = "PowerPoint" as const;
  readonly supportsSelectionDetection = isSetSupported("PowerPointApi", "1.5");

  /** Custom XML Parts (1.7) und Bild einfügen (1.8 oder gemeinsame API) */
  missingRequirements() {
    const missing = missingSets([["PowerPointApi", "1.7"]]);
    if (!isSetSupported("PowerPointApi", "1.8") && !isSetSupported("ImageCoercion", "1.1")) missing.push("ImageCoercion 1.1");
    return missing;
  }
  readonly store: DiagramStore;
  private readonly fillMode = isSetSupported("PowerPointApi", "1.8");

  constructor() {
    const run: XmlRunner = (fn) => {
      if (!isSetSupported("PowerPointApi", "1.7")) {
        return Promise.reject(
          new Error(tr("pptNoCustomXml")),
        );
      }
      return PowerPoint.run((ctx) => fn(ctx.presentation.customXmlParts as never, ctx));
    };
    this.store = new CustomXmlDiagramStore(run);
  }

  getSelectedDiagramId(): Promise<string | null> {
    if (!this.supportsSelectionDetection) return Promise.resolve(null);
    return PowerPoint.run(async (ctx) => {
      const shapes = ctx.presentation.getSelectedShapes();
      shapes.load("items/id,items/name");
      await ctx.sync();
      const tags = shapes.items.map((s) => {
        const t = s.tags.getItemOrNullObject(PPT_TAG_KEY);
        t.load("value");
        return t;
      });
      await ctx.sync();
      for (let i = 0; i < shapes.items.length; i++) {
        if (!tags[i].isNullObject && tags[i].value) return tags[i].value;
        const byName = idFromShapeName(shapes.items[i].name);
        if (byName) return byName;
      }
      return null;
    });
  }

  /** Alle Diagramm-Shapes aller Folien (optional gefiltert nach UUID). */
  private async findShapes(ctx: PowerPoint.RequestContext, id?: string): Promise<FoundShape[]> {
    const slides = ctx.presentation.slides;
    slides.load("items/id");
    await ctx.sync();
    const collections = slides.items.map((slide) => {
      const shapes = slide.shapes;
      shapes.load("items/id,items/name,items/left,items/top,items/width,items/height");
      return shapes;
    });
    await ctx.sync();
    const candidates: { slideIndex: number; shape: PowerPoint.Shape; tag: PowerPoint.Tag }[] = [];
    collections.forEach((shapes, slideIndex) => {
      for (const shape of shapes.items) {
        const tag = shape.tags.getItemOrNullObject(PPT_TAG_KEY);
        tag.load("value");
        candidates.push({ slideIndex, shape, tag });
      }
    });
    await ctx.sync();
    const out: FoundShape[] = [];
    for (const c of candidates) {
      const diagramId = (!c.tag.isNullObject && c.tag.value) || idFromShapeName(c.shape.name);
      if (diagramId && (!id || diagramId === id)) {
        out.push({ slideId: slides.items[c.slideIndex].id, slideIndex: c.slideIndex, shape: c.shape, diagramId });
      }
    }
    return out;
  }

  private markShape(shape: PowerPoint.Shape, record: DiagramRecord, typeLabel: string) {
    shape.tags.add(PPT_TAG_KEY, record.id);
    shape.name = shapeNameFor(record.id);
    if (isSetSupported("PowerPointApi", "1.10")) {
      shape.altTextTitle = tr("altTitle", { label: typeLabel });
      shape.altTextDescription = truncate(record.code);
    }
  }

  // ---------------------------------------------------------------- Einfügen

  async insertDiagram(record: DiagramRecord, img: RenderedDiagram, typeLabel: string) {
    const size = initialSizePt(img, MAX_W, MAX_H);
    if (this.fillMode) {
      await PowerPoint.run(async (ctx) => {
        const slides = ctx.presentation.getSelectedSlides();
        slides.load("items/id");
        await ctx.sync();
        const slide = slides.items[0];
        if (!slide) throw new Error(tr("selectSlideFirst"));
        const shape = slide.shapes.addGeometricShape(PowerPoint.GeometricShapeType.rectangle, {
          left: (SLIDE_W - size.width) / 2,
          top: (SLIDE_H - size.height) / 2,
          width: size.width,
          height: size.height,
        });
        shape.fill.setImage(img.pngBase64);
        shape.lineFormat.visible = false;
        this.markShape(shape, record, typeLabel);
        shape.load("id");
        await ctx.sync();
        slide.setSelectedShapes([shape.id]);
        await ctx.sync();
      });
      return;
    }
    // Fallback: ausgewähltes Shape abwählen, damit es nicht ersetzt wird
    await PowerPoint.run(async (ctx) => {
      const slides = ctx.presentation.getSelectedSlides();
      slides.load("items/id");
      await ctx.sync();
      slides.items[0]?.setSelectedShapes([]);
      await ctx.sync();
    }).catch(() => undefined);
    await this.insertViaCommonApi(record, img, typeLabel, size);
  }

  /** Fügt ein Bild über die gemeinsame API ein und markiert das neue Shape. */
  private async insertViaCommonApi(
    record: DiagramRecord,
    img: RenderedDiagram,
    typeLabel: string,
    geometry: { left?: number; top?: number; width: number; height: number },
    slideId?: string,
  ) {
    const before = await PowerPoint.run(async (ctx) => {
      if (slideId) ctx.presentation.setSelectedSlides([slideId]);
      const slides = ctx.presentation.getSelectedSlides();
      slides.load("items/id");
      await ctx.sync();
      const slide = slides.items[0];
      if (!slide) throw new Error(tr("selectSlideFirst"));
      const shapes = slide.shapes;
      shapes.load("items/id");
      await ctx.sync();
      return { slideId: slide.id, ids: new Set(shapes.items.map((s) => s.id)) };
    });

    await setSelectedImage(img.pngBase64, geometry);

    await PowerPoint.run(async (ctx) => {
      const slide = ctx.presentation.slides.getItem(before.slideId);
      const shapes = slide.shapes;
      shapes.load("items/id");
      await ctx.sync();
      const added = shapes.items.filter((s) => !before.ids.has(s.id));
      const shape = added[added.length - 1];
      if (!shape) throw new Error(tr("insertedImageNotFound"));
      this.markShape(shape, record, typeLabel);
      slide.setSelectedShapes([shape.id]);
      await ctx.sync();
    });
  }

  // ---------------------------------------------------------------- Aktualisieren

  async updateDiagram(record: DiagramRecord, previous: Pick<DiagramRecord, "widthPx"> | null, img: RenderedDiagram, typeLabel: string) {
    const targets = await PowerPoint.run(async (ctx) => {
      const found = await this.findShapes(ctx, record.id);
      const types = found.map((f) => {
        f.shape.load("type");
        return f;
      });
      await ctx.sync();
      return types.map((f) => ({
        slideId: f.slideId,
        shapeId: f.shape.id,
        type: f.shape.type as string,
        left: f.shape.left,
        top: f.shape.top,
        width: f.shape.width,
        height: f.shape.height,
      }));
    });

    for (const t of targets) {
      const size = updatedSizePt(t.width, previous, img, SLIDE_W * 2);
      if (this.fillMode && t.type === "GeometricShape") {
        // In-place: Bildfüllung tauschen, Mittelpunkt beibehalten
        await PowerPoint.run(async (ctx) => {
          const shape = ctx.presentation.slides.getItem(t.slideId).shapes.getItem(t.shapeId);
          shape.fill.setImage(img.pngBase64);
          shape.left = t.left + (t.width - size.width) / 2;
          shape.top = t.top;
          shape.width = size.width;
          shape.height = size.height;
          this.markShape(shape, record, typeLabel);
          await ctx.sync();
        });
      } else {
        // Bild ersetzen: altes löschen, neues an gleicher Position einfügen
        await PowerPoint.run(async (ctx) => {
          ctx.presentation.setSelectedSlides([t.slideId]);
          ctx.presentation.slides.getItem(t.slideId).shapes.getItem(t.shapeId).delete();
          await ctx.sync();
        });
        await this.insertViaCommonApi(record, img, typeLabel, { left: t.left, top: t.top, ...size }, t.slideId);
      }
    }
    return targets.length;
  }

  listDocumentDiagrams(): Promise<DocumentDiagramElement[]> {
    return PowerPoint.run(async (ctx) => {
      const found = await this.findShapes(ctx);
      return found.map((f) => ({ id: f.diagramId, location: tr("slideN", { n: f.slideIndex + 1 }) }));
    });
  }

  selectDiagram(id: string): Promise<boolean> {
    return PowerPoint.run(async (ctx) => {
      const found = await this.findShapes(ctx, id);
      const first = found[0];
      if (!first) return false;
      ctx.presentation.setSelectedSlides([first.slideId]);
      ctx.presentation.slides.getItem(first.slideId).setSelectedShapes([first.shape.id]);
      await ctx.sync();
      return true;
    });
  }

  recoverCode(id: string): Promise<string | null> {
    if (!isSetSupported("PowerPointApi", "1.10")) return Promise.resolve(null);
    return PowerPoint.run(async (ctx) => {
      const shape = (await this.findShapes(ctx, id))[0]?.shape;
      if (!shape) return null;
      shape.load("altTextDescription");
      await ctx.sync();
      return shape.altTextDescription?.trim() || null;
    });
  }

  /**
   * Design der aktuellen Folie: Die Folie wird als Mini-Präsentation exportiert (PowerPointApi 1.8),
   * daraus wird das Design-XML des Folienmasters gelesen (Farben + Schriftarten).
   * Rückfall ab PowerPointApi 1.10: nur Designfarben über themeColorScheme.
   */
  async getDocumentTheme(): Promise<Partial<DocumentTheme> | null> {
    if (isSetSupported("PowerPointApi", "1.8")) {
      try {
        const base64 = await PowerPoint.run(async (ctx) => {
          const selected = ctx.presentation.getSelectedSlides();
          selected.load("items/id");
          await ctx.sync();
          const slide = selected.items[0] ?? ctx.presentation.slides.getItemAt(0);
          const exported = slide.exportAsBase64();
          await ctx.sync();
          return exported.value;
        });
        const theme = themeFromPptx(base64);
        if (theme) return theme;
      } catch (e) {
        console.warn("Design konnte nicht aus dem Folienexport gelesen werden", e);
      }
    }
    if (isSetSupported("PowerPointApi", "1.10")) {
      return PowerPoint.run(async (ctx) => {
        const selected = ctx.presentation.getSelectedSlides();
        selected.load("items/id");
        await ctx.sync();
        const slide = selected.items[0] ?? ctx.presentation.slides.getItemAt(0);
        const scheme = slide.themeColorScheme;
        const names = ["Dark1", "Light1", "Dark2", "Light2", "Accent1", "Accent2", "Accent3", "Accent4", "Accent5", "Accent6"] as const;
        const values = names.map((n) => scheme.getThemeColor(n));
        await ctx.sync();
        const v = values.map((r) => r.value);
        return { dk1: v[0], lt1: v[1], dk2: v[2], lt2: v[3], accents: v.slice(4) };
      });
    }
    return null;
  }

  onSelectionChanged(handler: () => void) {
    return addDocumentSelectionHandler(handler);
  }
}

/** Liest das Design des (ersten) Folienmasters aus einer als Base64 exportierten .pptx-Datei. */
function themeFromPptx(base64: string): Partial<DocumentTheme> | null {
  const bin = atob(base64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  const files = unzipSync(bytes, {
    filter: (f) => /^ppt\/theme\/theme\d+\.xml$/.test(f.name) || /^ppt\/slideMasters\/_rels\/slideMaster\d+\.xml\.rels$/.test(f.name),
  });
  const text = (name: string) => (files[name] ? strFromU8(files[name]) : null);

  // Design des Folienmasters über dessen Beziehungen ermitteln
  let themePath: string | null = null;
  const rels = Object.keys(files).filter((n) => n.includes("slideMasters/_rels")).sort()[0];
  const relXml = rels && text(rels);
  if (relXml) {
    const m = /Target="\.\.\/theme\/(theme\d+\.xml)"/.exec(relXml);
    if (m) themePath = `ppt/theme/${m[1]}`;
  }
  themePath ??= Object.keys(files).filter((n) => n.startsWith("ppt/theme/")).sort()[0] ?? null;
  const xml = themePath && text(themePath);
  return xml ? parseThemeXml(xml) : null;
}

function truncate(code: string) {
  return code.length > 4000 ? code.substring(0, 4000) + " …" : code;
}
