import type { DiagramRecord, RenderedDiagram } from "../shared/model";
import type { DocumentTheme } from "../shared/docTheme";
import { MemoryDiagramStore } from "./customXmlStore";
import type { DocumentDiagramElement, HostAdapter } from "./hostAdapter";

/**
 * Simuliert ein Dokument im Browser (ohne Office), damit die Oberfläche
 * während der Entwicklung unter https://localhost:3000 getestet werden kann.
 */
export class BrowserAdapter implements HostAdapter {
  readonly kind = "Browser" as const;
  readonly supportsSelectionDetection = true;
  readonly store = new MemoryDiagramStore();
  private elements: { id: string; png: string }[] = [];
  private selected: string | null = null;
  private handlers = new Set<() => void>();
  /** Anzahl der Bild-Aktualisierungen (für Tests der Live-Vorschau) */
  updateCount = 0;
  /** Simuliertes Dokumentdesign (für Tests änderbar); null = Office-Standard */
  documentTheme: Partial<DocumentTheme> | null = null;

  async getDocumentTheme() {
    return this.documentTheme;
  }

  async getSelectedDiagramId() {
    return this.selected;
  }

  async insertDiagram(record: DiagramRecord, img: RenderedDiagram) {
    this.elements.push({ id: record.id, png: img.pngBase64 });
    this.selected = record.id;
    this.emit();
  }

  async updateDiagram(record: DiagramRecord, _prev: Pick<DiagramRecord, "widthPx"> | null, img: RenderedDiagram) {
    const matches = this.elements.filter((e) => e.id === record.id);
    matches.forEach((e) => (e.png = img.pngBase64));
    this.updateCount++;
    this.emit();
    return matches.length;
  }

  async listDocumentDiagrams(): Promise<DocumentDiagramElement[]> {
    return this.elements.map((e, i) => ({ id: e.id, location: `Element ${i + 1}` }));
  }

  async selectDiagram(id: string) {
    this.selected = this.elements.some((e) => e.id === id) ? id : null;
    this.emit();
    return this.selected !== null;
  }

  /** Nur im Browser-Modus: Auswahl aufheben */
  async clearSelection() {
    this.selected = null;
    this.emit();
  }

  getPreviewPng(id: string) {
    return this.elements.find((e) => e.id === id)?.png;
  }

  async onSelectionChanged(handler: () => void) {
    this.handlers.add(handler);
    return () => this.handlers.delete(handler);
  }

  private emit() {
    setTimeout(() => this.handlers.forEach((h) => h()), 0);
  }
}
