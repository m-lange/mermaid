import { DEFAULT_OPTIONS, DiagramRecord } from "../shared/model";

/** Namespace aller Custom XML Parts dieses Add-ins */
export const MERMAID_NS = "urn:mermaid-office-addin:diagram:v1";
const ROOT = "mermaidDiagram";

export function recordToXml(r: DiagramRecord): string {
  const doc = document.implementation.createDocument(MERMAID_NS, ROOT, null);
  const root = doc.documentElement;
  root.setAttribute("id", r.id);
  root.setAttribute("version", "1");
  const add = (name: string, value: string) => {
    const el = doc.createElementNS(MERMAID_NS, name);
    el.textContent = value;
    root.appendChild(el);
  };
  add("type", r.type);
  add("theme", r.theme);
  add("look", r.look);
  add("background", r.background);
  add("widthPx", String(Math.round(r.widthPx)));
  add("heightPx", String(Math.round(r.heightPx)));
  add("created", r.created);
  add("modified", r.modified);
  if (r.themeKey) add("docTheme", r.themeKey);
  add("code", r.code);
  return '<?xml version="1.0" encoding="UTF-8"?>' + new XMLSerializer().serializeToString(doc);
}

export function xmlToRecord(xml: string): DiagramRecord | null {
  const doc = new DOMParser().parseFromString(xml, "application/xml");
  const root = doc.documentElement;
  if (!root || root.localName !== ROOT || root.namespaceURI !== MERMAID_NS) return null;
  const id = root.getAttribute("id");
  if (!id) return null;
  const get = (name: string) => root.getElementsByTagNameNS(MERMAID_NS, name)[0]?.textContent ?? "";
  return {
    id,
    type: get("type"),
    code: get("code"),
    theme: (get("theme") || DEFAULT_OPTIONS.theme) as DiagramRecord["theme"],
    look: (get("look") || DEFAULT_OPTIONS.look) as DiagramRecord["look"],
    background: (get("background") || DEFAULT_OPTIONS.background) as DiagramRecord["background"],
    widthPx: Number(get("widthPx")) || 0,
    heightPx: Number(get("heightPx")) || 0,
    created: get("created"),
    modified: get("modified"),
    themeKey: get("docTheme") || undefined,
  };
}
