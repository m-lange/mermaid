import type { DiagramRecord, RenderedDiagram } from "../shared/model";
import { themeFromFlatOpc, type DocumentTheme } from "../shared/docTheme";
import { CommonApiDiagramStore, CustomXmlDiagramStore, type DiagramStore, type XmlRunner } from "./customXmlStore";
import {
  addDocumentSelectionHandler,
  idFromTag,
  initialSizePt,
  isSetSupported,
  tagFor,
  updatedSizePt,
  type DocumentDiagramElement,
  type HostAdapter,
} from "./hostAdapter";

/** Maximale Breite/Höhe (pt), ungefähr Satzspiegel einer A4-Seite */
const MAX_W = 450;
const MAX_H = 640;

/**
 * Word: Jedes Diagramm ist ein Inline-Bild in einem Inhaltssteuerelement
 * (Content Control). Das Tag des Steuerelements lautet `mermaid:<uuid>`.
 */
export class WordAdapter implements HostAdapter {
  readonly kind = "Word" as const;
  readonly supportsSelectionDetection = true;
  readonly store: DiagramStore;

  constructor() {
    if (isSetSupported("WordApi", "1.4")) {
      const run: XmlRunner = (fn) =>
        Word.run((ctx) => fn(ctx.document.customXmlParts as never, ctx));
      this.store = new CustomXmlDiagramStore(run);
    } else {
      this.store = new CommonApiDiagramStore();
    }
  }

  getSelectedDiagramId(): Promise<string | null> {
    return Word.run(async (ctx) => {
      const sel = ctx.document.getSelection();
      const parent = sel.parentContentControlOrNullObject;
      parent.load("tag");
      const inner = sel.contentControls;
      inner.load("items/tag");
      await ctx.sync();
      if (!parent.isNullObject) {
        const id = idFromTag(parent.tag);
        if (id) return id;
      }
      for (const cc of inner.items) {
        const id = idFromTag(cc.tag);
        if (id) return id;
      }
      return null;
    });
  }

  insertDiagram(record: DiagramRecord, img: RenderedDiagram, typeLabel: string): Promise<void> {
    return Word.run(async (ctx) => {
      const sel = ctx.document.getSelection();
      const parent = sel.parentContentControlOrNullObject;
      parent.load("tag");
      await ctx.sync();

      let pic: Word.InlinePicture;
      if (!parent.isNullObject && idFromTag(parent.tag)) {
        // Auswahl liegt in einem anderen Diagramm: dahinter einfügen statt verschachteln
        const para = parent.insertParagraph("", "After");
        pic = para.insertInlinePictureFromBase64(img.pngBase64, "Start");
      } else {
        pic = sel.insertInlinePictureFromBase64(img.pngBase64, "Replace");
      }
      const size = initialSizePt(img, MAX_W, MAX_H);
      pic.width = size.width;
      pic.height = size.height;
      applyAltText(pic, record, typeLabel);

      const cc = pic.insertContentControl();
      cc.tag = tagFor(record.id);
      cc.title = `Mermaid: ${typeLabel}`;
      cc.appearance = "BoundingBox";
      cc.select();
      await ctx.sync();
    });
  }

  updateDiagram(record: DiagramRecord, previous: Pick<DiagramRecord, "widthPx"> | null, img: RenderedDiagram, typeLabel: string) {
    return Word.run(async (ctx) => {
      const ccs = ctx.document.contentControls.getByTag(tagFor(record.id));
      ccs.load("items");
      await ctx.sync();
      const pics = ccs.items.map((cc) => {
        const p = cc.inlinePictures;
        p.load("items/width,items/height");
        return p;
      });
      await ctx.sync();
      ccs.items.forEach((cc, i) => {
        const current = pics[i].items[0];
        const size = updatedSizePt(current?.width ?? 0, previous, img, MAX_W);
        const pic = cc.insertInlinePictureFromBase64(img.pngBase64, "Replace");
        pic.width = size.width;
        pic.height = size.height;
        applyAltText(pic, record, typeLabel);
        cc.title = `Mermaid: ${typeLabel}`;
      });
      await ctx.sync();
      return ccs.items.length;
    });
  }

  listDocumentDiagrams(): Promise<DocumentDiagramElement[]> {
    return Word.run(async (ctx) => {
      const ccs = ctx.document.contentControls;
      ccs.load("items/tag");
      await ctx.sync();
      const out: DocumentDiagramElement[] = [];
      for (const cc of ccs.items) {
        const id = idFromTag(cc.tag);
        if (id) out.push({ id });
      }
      return out;
    });
  }

  selectDiagram(id: string): Promise<boolean> {
    return Word.run(async (ctx) => {
      const cc = ctx.document.contentControls.getByTag(tagFor(id)).getFirstOrNullObject();
      await ctx.sync();
      if (cc.isNullObject) return false;
      cc.select();
      await ctx.sync();
      return true;
    });
  }

  recoverCode(id: string): Promise<string | null> {
    return Word.run(async (ctx) => {
      const cc = ctx.document.contentControls.getByTag(tagFor(id)).getFirstOrNullObject();
      const pics = cc.inlinePictures;
      pics.load("items/altTextDescription");
      await ctx.sync();
      if (cc.isNullObject) return null;
      return pics.items[0]?.altTextDescription?.trim() || null;
    });
  }

  /** Word liefert mit getOoxml() ein Paket, das auch das Dokumentdesign (theme1.xml) enthält. */
  getDocumentTheme(): Promise<Partial<DocumentTheme> | null> {
    return Word.run(async (ctx) => {
      const ooxml = ctx.document.body.getRange("Start").getOoxml();
      await ctx.sync();
      return themeFromFlatOpc(ooxml.value);
    });
  }

  onSelectionChanged(handler: () => void) {
    return addDocumentSelectionHandler(handler);
  }
}

function applyAltText(pic: Word.InlinePicture, record: DiagramRecord, typeLabel: string) {
  pic.altTextTitle = `Mermaid-Diagramm: ${typeLabel}`;
  pic.altTextDescription = record.code.length > 4000 ? record.code.substring(0, 4000) + " …" : record.code;
}
