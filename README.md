# Mermaid Office Add-in

Office Add-in (Taskpane) für **Word, Excel und PowerPoint**, mit dem sich
[Mermaid](https://mermaid.js.org)-Diagramme und -Charts einfügen und bearbeiten lassen.

- **35 Diagrammtypen** (Mermaid 12.3), jeweils mit eigenem Button und einem kompakten Beispiel
  (die übrige Syntax liefern die Code-Bausteine der Symbolleiste):
  - Diagramme: Flussdiagramm, Sequenz, Klassen, Zustände, ER, Anforderungen, C4, Architektur, Block, Paket,
    Git-Graph, Mindmap, Zeitstrahl, Kanban, User Journey, Gantt
  - Neu in Mermaid 12: Agentenfluss, Swimlane, Baumansicht, Event Modeling, Ishikawa, Anwendungsfall,
    Cynefin, Syntaxdiagramm (Railroad) inkl. EBNF, ABNF und PEG
  - Charts: Kreis, XY, Quadranten, Sankey, Radar, Treemap, Venn, Wardley-Map
- Code-Editor (CodeMirror 6) mit Mermaid-Syntaxhervorhebung (Pfeile, Beschriftungen, Nachrichten,
  Metadaten `@{…}`, Frontmatter), Autovervollständigung (Strg+Leertaste) und Live-Vorschau
- **Symbolleiste** über dem Editor (nur Symbole, Details im Tooltip): Design (inkl. „Design aus Dokument
  neu einlesen“), Darstellung, Hintergrund sowie Code-Bausteine passend zum Diagrammtyp (Elemente, Kanten,
  Struktur, Stil, „…“ = Mehr) mit Platzhaltern, die per Tab durchlaufen werden; Konfigurations-Bausteine
  werden automatisch im Frontmatter ergänzt (`src/shared/snippets.ts`, `EditorToolbar.tsx`)
- **Design „Dokument“ (Standard):** Farben und Schrift kommen aus dem Office-Dokumentdesign –
  Hintergrund 2 = Füllung, Text 2 = Linien/Rahmen, Text 1 = Texte, Textkörper-Schriftart, Akzent 1–6 für
  Farbreihen (Kreis, Mindmap, Zeitstrahl, Git, XY, Gantt …). Jedes Diagramm merkt sich das verwendete Design;
  ändert sich das Dokumentdesign, bietet der Editor „Aktualisieren“ an (es wird nie still etwas geändert).
  Quelle je Anwendung: Word → Design-XML aus `getOoxml()`, PowerPoint → Folienexport (PowerPointApi 1.8,
  Rückfall 1.10: nur Farben), Excel → Näherung über Formatvorlagen „Standard“/„Titel“ (Hintergrund 2 und
  Akzente = Office-Standard). Die Schrift muss in Windows installiert sein, sonst wird Segoe UI verwendet.
- Weitere Designs (Standard, Neutral, Wald, Dunkel, Basis), Stil (klassisch/handgezeichnet) und Hintergrund pro Diagramm
- ELK-Layout ist eingebunden (`config: layout: elk` im Frontmatter)
- Der Mermaid-Code wird in **Custom XML Parts** gespeichert und per **UUID** mit dem Element im Dokument verknüpft
- Ist ein Diagramm ausgewählt, öffnet sich der Editor; **Speichern** schreibt den Code in die Custom XML Part, **Abbrechen** verwirft die Änderungen
- **Live-Vorschau im Dokument:** Während der Eingabe wird das Bild im Dokument laufend aktualisiert
  (verzögert, nur bei gültigem Code; schnelles Tippen wird zusammengefasst). „Abbrechen“ stellt den
  gespeicherten Stand im Dokument wieder her. Über das Augen-Symbol lässt sich stattdessen eine Vorschau
  im Aufgabenbereich einblenden – dann ändert sich das Dokument erst beim Speichern (Einstellung wird gemerkt).
  Hinweis: Jede Live-Aktualisierung ist in Office ein eigener Rückgängig-Schritt.
- Liste aller Diagramme im Dokument, inkl. Erkennung verwaister Daten (Element gelöscht)
- **Zweisprachig (Deutsch/Englisch):** Oberfläche, Beispiele und Code-Bausteine folgen der Office-Anzeigesprache
  (Deutsch bei deutscher Office-Sprache, sonst Englisch; im Browser-Modus per `?lang=de|en` umschaltbar)
- Ältere Office-Versionen ohne die nötigen API-Sets erhalten eine klare Meldung statt Fehlfunktionen

## Schnellstart

```powershell
npm install
npm run icons        # PNG-Icons aus assets/icon.svg erzeugen (einmalig)
npm run certs        # HTTPS-Entwicklerzertifikat für localhost installieren (einmalig)

npm run start:word         # Dev-Server starten und Add-in in Word sideloaden
npm run start:excel
npm run start:powerpoint
npm run stop               # Sideload beenden
```

Ohne Office kann die Oberfläche im Browser unter `https://localhost:3000/taskpane/taskpane.html`
(`npm run dev`) getestet werden – dort simuliert ein In-Memory-Dokument die Office-Funktionen.

Weitere Befehle:

| Befehl | Zweck |
| --- | --- |
| `npm run build` | Typprüfung + Produktions-Build nach `dist/` inkl. `third-party-notices.txt` |
| `npm run notices` | Nur die Drittanbieter-Lizenzhinweise erzeugen (`dist/third-party-notices.txt`) |
| `npm run icons` | Icons (`public/assets/`) und Store-Logo (`store/logo-300.png`) aus `assets/icon.svg` |
| `npm run screenshots` | Store-Screenshots 1280×720 (de/en) nach `store/screenshots/` (vorher `npm run build`) |
| `npm run validate` | Manifest prüfen |
| `npm run test:templates` | Alle Beispielvorlagen und Snippets in Edge (headless) rendern, Syntax-Highlighter prüfen; optional `-- <ordner>` schreibt die PNGs |
| `THEMES=dark,forest ONLY=pie,flowchart LANGS=en npm run test:templates` | Nur bestimmte Designs/Vorlagen/Sprachen testen (Standard: `LANGS=de,en`) |
| `npm run test:ui` | End-to-End-Test der Taskpane (Browser-Modus, Produktions-Build; vorher `npm run build`) |
| `npm test` | Build + alle Tests |
| `CODE_FILES=a.mmd,b.mmd node scripts/test-templates.mjs` | Beliebigen Mermaid-Code testen |

### Bekannte Einschränkungen

- Mermaid 12.3: Eine Kante **zu einer Raute** im Blockdiagramm führt zu `calcIntersect is not a function` (Fehler in Mermaid).
- Nicht enthalten: ZenUML (externes Plugin, rendert vollständig über `foreignObject`) und Icon-Packs (z. B. `logos:`).
- Design „Dunkel“ wird immer mit dunklem Hintergrund gerendert (heller Text wäre auf Weiß unlesbar).

## Funktionsweise

### Speicherung

Jedes Diagramm erhält eine eigene Custom XML Part im Namespace
`urn:mermaid-office-addin:diagram:v1`:

```xml
<mermaidDiagram xmlns="urn:mermaid-office-addin:diagram:v1" id="8c4f…-uuid" version="1">
  <type>flowchart</type>
  <theme>default</theme>
  <look>classic</look>
  <background>white</background>
  <widthPx>612</widthPx>
  <heightPx>480</heightPx>
  <created>2026-11-10T11:00:00.000Z</created>
  <modified>2026-11-10T11:05:00.000Z</modified>
  <code>flowchart TD …</code>
</mermaidDiagram>
```

### Verknüpfung mit dem Dokument

| Anwendung | Element | Verknüpfung über |
| --- | --- | --- |
| Word | Inline-Bild in einem Inhaltssteuerelement | Tag des Steuerelements: `mermaid:<uuid>` |
| PowerPoint | Bild-Shape | Shape-Tag `MERMAID_DIAGRAM_ID` = uuid, zusätzlich Name `Mermaid_<uuid>` |
| Excel | Bild-Shape | Shape-Name `Mermaid_<uuid>` |

Zusätzlich steht der Mermaid-Code im **Alternativtext** des Bildes (Barrierefreiheit). Wird ein
Diagramm in ein anderes Dokument kopiert (die Custom XML Part wandert dabei nicht mit), stellt
das Add-in den Code daraus wieder her.

Beim Aktualisieren bleibt der vom Benutzer gewählte Zoomfaktor erhalten (aktuelle Breite im
Verhältnis zur ursprünglichen natürlichen Breite); Position bleibt ebenfalls erhalten.

### Bildformat

Diagramme werden als hochauflösendes PNG (3-fach) eingefügt. Mermaid wird dafür mit
`htmlLabels: false` (und `journey.textPlacement: "tspan"`) betrieben, damit möglichst keine
`foreignObject`-Elemente entstehen – diese würden weder von Office als SVG noch von Safari
(Office für Mac) beim Umwandeln in PNG korrekt dargestellt. Erzeugt ein Diagrammtyp trotzdem
`foreignObject` (z. B. Event Modeling) und verweigert der Browser die Umwandlung, werden diese
Elemente automatisch durch SVG-Text ersetzt.

### Voraussetzungen / Requirement Sets

| Anwendung | Erforderlich | Hinweise |
| --- | --- | --- |
| Word | WordApi 1.3 (Fallback für Custom XML über gemeinsame API) | WordApi 1.4 empfohlen |
| Excel | ExcelApi 1.9 (Shapes, Custom XML) | Auswahl-Erkennung eines Diagramms ab ExcelApi 1.19; sonst über die Liste bearbeiten |
| PowerPoint | PowerPointApi 1.7 (Auswahl, Tags, Custom XML) | ab 1.8 In-place-Aktualisierung (Bildfüllung), sonst über die gemeinsame API (ImageCoercion 1.1) |

Fehlt eine zwingende Voraussetzung, zeigt die Taskpane eine Meldung statt der Oberfläche
(`missingRequirements()` der Host-Adapter).

## Projektstruktur

```
manifest.xml                 Add-in-Manifest (Word, Excel, PowerPoint)
src/taskpane/                React-Oberfläche (Fluent UI v9)
  App.tsx                    Ablaufsteuerung: Auswahl verfolgen, Einfügen, Speichern
  components/                Galerie, Editor, Dokumentliste
  editor/                    CodeMirror + Mermaid-Syntaxhervorhebung
src/office/                  Host-Adapter (Word/Excel/PowerPoint/Browser) + Custom-XML-Speicher
src/shared/templates.ts      Diagrammtypen und Beispielvorlagen (de), templates.en.ts (en)
src/shared/snippets.ts       Code-Bausteine (de), snippets.en.ts (en)
src/shared/strings.ts        Oberflächentexte (de/en), i18n.ts Sprachwahl
src/shared/render.ts         Mermaid-Rendering, SVG → PNG
public/                      support.html, privacy.html, terms.html, Icons
store/                       Store-Texte (listing.md), Logo, Screenshots
scripts/                     Icons, Manifest für Hosting, Lizenzhinweise, Screenshots, Tests
```

## Deployment

### GitHub Pages (automatisch)

Der Workflow [.github/workflows/deploy-pages.yml](.github/workflows/deploy-pages.yml) baut das Add-in bei
jedem Push auf `main` (oder manuell über „Run workflow“) und veröffentlicht `dist/` auf GitHub Pages:

- Add-in: `https://<user>.github.io/<repo>/taskpane/taskpane.html`
- Manifest zum Installieren: `https://<user>.github.io/<repo>/manifest.xml`

Einmalig im Repository einstellen: **Settings → Pages → Build and deployment → Source: GitHub Actions**.

Das Manifest wird von `scripts/build-manifest.mjs` aus `manifest.xml` erzeugt (localhost-URLs → Pages-URL,
eigene Add-in-ID, damit Entwicklungs- und Pages-Version parallel installiert sein können).
Installation in Office: Manifest herunterladen und per **Einfügen → Add-ins → Meine Add-ins → Mein Add-in
hochladen** (Word/PowerPoint/Excel im Web bzw. Microsoft 365) einbinden oder zentral über das
Microsoft 365 Admin Center verteilen.

### Anderer Webserver

`npm run build` erzeugt statische Dateien in `dist/`. Diese auf einem HTTPS-Webserver ablegen und das
Manifest mit `ADDIN_BASE_URL=https://server/pfad node scripts/build-manifest.mjs` erzeugen
(schreibt `dist/manifest.xml`).

## Veröffentlichung im Microsoft Marketplace

Vorbereitet sind:

- Manifest: Herausgeber „Martin Lange“, Name „Mermaid Editor for Word, Excel & PowerPoint“, Support-URL,
  englischer Standard mit deutschen Overrides
- Seiten auf GitHub Pages: [support.html](public/support.html), [privacy.html](public/privacy.html),
  [terms.html](public/terms.html), `third-party-notices.txt`
- Store-Texte (de/en), Hinweise für die Zertifizierung und Checkliste: [store/listing.md](store/listing.md)
- Logo `store/logo-300.png`, Screenshots `store/screenshots/` (aus dem Browser-Modus erzeugt –
  Aufnahmen aus echtem Office sind für den Store-Eintrag noch besser)

Noch offen: Test in Word, Excel und PowerPoint unter Windows, Mac und im Web; rechtliche Prüfung der
Datenschutz- und Nutzungsbedingungen (ggf. Impressum/Anschrift); Partner-Center-Konto und Einreichung.

## Lizenz

Dieses Projekt steht unter der **GNU General Public License v3.0** – siehe [LICENSE](LICENSE).

Verwendete Bibliotheken behalten ihre eigenen Lizenzen; alle sind mit der GPL-3.0 vereinbar, u. a.
[Mermaid](https://github.com/mermaid-js/mermaid) (MIT), Fluent UI, React, CodeMirror, fflate (MIT),
DOMPurify (MPL-2.0 oder Apache-2.0) und elkjs (EPL-2.0 oder GPL-3.0-or-later).
„Mermaid“ ist der Name des gleichnamigen Open-Source-Projekts; dieses Add-in ist kein offizielles Produkt davon.
