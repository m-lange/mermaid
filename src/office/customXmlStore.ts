import type { DiagramRecord } from "../shared/model";
import { MERMAID_NS, recordToXml, xmlToRecord } from "./xml";

/** Gemeinsame Teilmenge der CustomXmlPart-APIs von Word, Excel und PowerPoint. */
interface XmlPart {
  id: string;
  getXml(): OfficeExtension.ClientResult<string>;
  setXml(xml: string): void;
  delete(): void;
}
interface XmlPartCollection {
  add(xml: string): XmlPart;
  getByNamespace(ns: string): { items: XmlPart[]; load(props: string): unknown };
  getItemOrNullObject(id: string): XmlPart & { isNullObject: boolean };
}
interface Ctx {
  sync(): Promise<void>;
}

export type XmlRunner = <T>(fn: (parts: XmlPartCollection, ctx: Ctx) => Promise<T>) => Promise<T>;

export interface DiagramStore {
  list(): Promise<DiagramRecord[]>;
  get(id: string): Promise<DiagramRecord | null>;
  save(record: DiagramRecord): Promise<void>;
  remove(id: string): Promise<void>;
}

/**
 * Speichert jedes Diagramm in einer eigenen Custom XML Part
 * (Namespace {@link MERMAID_NS}). Die UUID im Root-Attribut `id`
 * verknüpft die Part mit dem Element im Dokument.
 */
export class CustomXmlDiagramStore implements DiagramStore {
  /** Cache UUID -> Part-ID, um nicht jedes Mal alle Parts lesen zu müssen */
  private partIds = new Map<string, string>();

  constructor(private readonly run: XmlRunner) {}

  private async readAll(parts: XmlPartCollection, ctx: Ctx) {
    const scoped = parts.getByNamespace(MERMAID_NS);
    scoped.load("items/id");
    await ctx.sync();
    const xmls = scoped.items.map((p) => ({ part: p, xml: p.getXml() }));
    await ctx.sync();
    const result: { part: XmlPart; record: DiagramRecord }[] = [];
    this.partIds.clear();
    for (const { part, xml } of xmls) {
      const record = xmlToRecord(xml.value);
      if (record) {
        result.push({ part, record });
        this.partIds.set(record.id, part.id);
      }
    }
    return result;
  }

  private async findPart(parts: XmlPartCollection, ctx: Ctx, id: string) {
    const cached = this.partIds.get(id);
    if (cached) {
      const part = parts.getItemOrNullObject(cached);
      const xml = part.getXml();
      await ctx.sync().catch(() => undefined);
      if (!part.isNullObject) {
        try {
          const record = xmlToRecord(xml.value);
          if (record?.id === id) return { part, record };
        } catch {
          /* Cache veraltet */
        }
      }
    }
    const all = await this.readAll(parts, ctx);
    return all.find((e) => e.record.id === id) ?? null;
  }

  list(): Promise<DiagramRecord[]> {
    return this.run(async (parts, ctx) => (await this.readAll(parts, ctx)).map((e) => e.record));
  }

  get(id: string): Promise<DiagramRecord | null> {
    return this.run(async (parts, ctx) => (await this.findPart(parts, ctx, id))?.record ?? null);
  }

  save(record: DiagramRecord): Promise<void> {
    return this.run(async (parts, ctx) => {
      const xml = recordToXml(record);
      const existing = await this.findPart(parts, ctx, record.id);
      if (existing) {
        existing.part.setXml(xml);
        await ctx.sync();
      } else {
        const part = parts.add(xml);
        (part as unknown as { load(p: string): void }).load("id");
        await ctx.sync();
        this.partIds.set(record.id, part.id);
      }
    });
  }

  remove(id: string): Promise<void> {
    return this.run(async (parts, ctx) => {
      const existing = await this.findPart(parts, ctx, id);
      if (existing) {
        existing.part.delete();
        await ctx.sync();
        this.partIds.delete(id);
      }
    });
  }
}

/**
 * Fallback für ältere Word-Versionen ohne WordApi 1.4:
 * nutzt die gemeinsame API `Office.context.document.customXmlParts`.
 */
export class CommonApiDiagramStore implements DiagramStore {
  private parts() {
    return Office.context.document.customXmlParts;
  }

  private async readAll(): Promise<{ part: Office.CustomXmlPart; record: DiagramRecord }[]> {
    const parts = await new Promise<Office.CustomXmlPart[]>((resolve, reject) =>
      this.parts().getByNamespaceAsync(MERMAID_NS, (r) =>
        r.status === Office.AsyncResultStatus.Succeeded ? resolve(r.value) : reject(r.error),
      ),
    );
    const out: { part: Office.CustomXmlPart; record: DiagramRecord }[] = [];
    for (const part of parts) {
      const xml = await new Promise<string>((resolve, reject) =>
        part.getXmlAsync((r) => (r.status === Office.AsyncResultStatus.Succeeded ? resolve(r.value) : reject(r.error))),
      );
      const record = xmlToRecord(xml);
      if (record) out.push({ part, record });
    }
    return out;
  }

  async list() {
    return (await this.readAll()).map((e) => e.record);
  }

  async get(id: string) {
    return (await this.readAll()).find((e) => e.record.id === id)?.record ?? null;
  }

  async save(record: DiagramRecord) {
    const existing = (await this.readAll()).find((e) => e.record.id === record.id);
    if (existing) await this.deletePart(existing.part);
    await new Promise<void>((resolve, reject) =>
      this.parts().addAsync(recordToXml(record), (r) =>
        r.status === Office.AsyncResultStatus.Succeeded ? resolve() : reject(r.error),
      ),
    );
  }

  async remove(id: string) {
    const existing = (await this.readAll()).find((e) => e.record.id === id);
    if (existing) await this.deletePart(existing.part);
  }

  private deletePart(part: Office.CustomXmlPart) {
    return new Promise<void>((resolve, reject) =>
      part.deleteAsync((r) => (r.status === Office.AsyncResultStatus.Succeeded ? resolve() : reject(r.error))),
    );
  }
}

/** In-Memory-Speicher für den Browser-Vorschaumodus (ohne Office). */
export class MemoryDiagramStore implements DiagramStore {
  private items = new Map<string, DiagramRecord>();
  async list() {
    return [...this.items.values()];
  }
  async get(id: string) {
    return this.items.get(id) ?? null;
  }
  async save(record: DiagramRecord) {
    this.items.set(record.id, { ...record });
  }
  async remove(id: string) {
    this.items.delete(id);
  }
}
