/**
 * Beispielvorlagen für jeden Mermaid-Diagrammtyp.
 * Jede Vorlage ist ein kompaktes, typisches Beispiel (wenige Elemente, gut lesbar im Dokument).
 * Weitere Syntax liefern die Code-Bausteine der Symbolleiste (snippets.ts).
 */

import { V12_DIAGRAM_TYPES } from "./templatesV12";

export type DiagramCategory = "diagram" | "chart";

export interface DiagramTypeDef {
  /** Stabile ID, wird in der Custom XML Part gespeichert */
  id: string;
  /** Anzeigename (Button) */
  label: string;
  category: DiagramCategory;
  description: string;
  /** Link zur offiziellen Syntax-Dokumentation */
  docs: string;
  /** Erkennungsmuster für das Schlüsselwort im Code */
  keywords: string[];
  template: string;
}

const d = (s: string) => s.replace(/^\n/, "").replace(/\s+$/, "") + "\n";

const BASE_DIAGRAM_TYPES: DiagramTypeDef[] = [
  {
    id: "flowchart",
    label: "Flussdiagramm",
    category: "diagram",
    description: "Abläufe, Prozesse und Entscheidungen",
    docs: "https://mermaid.js.org/syntax/flowchart.html",
    keywords: ["flowchart", "graph"],
    template: d(`
---
title: Bestellprozess
---
flowchart TB
    start([Bestellung eingegangen]) --> pruefen[Bestand prüfen]
    pruefen --> lager{Auf Lager?}
    lager -->|Ja| versand[Ware versenden]
    lager -->|Nein| nachbestellen[Nachbestellen]
    nachbestellen -.-> pruefen
    versand --> rechnung[(Rechnung buchen)]
    rechnung --> ende([Fertig])

    classDef wichtig fill:#ffcc80,stroke:#e65100,color:#000
    class lager wichtig
`),
  },
  {
    id: "sequence",
    label: "Sequenzdiagramm",
    category: "diagram",
    description: "Interaktionen zwischen Teilnehmern",
    docs: "https://mermaid.js.org/syntax/sequenceDiagram.html",
    keywords: ["sequenceDiagram"],
    template: d(`
sequenceDiagram
    title Anmeldung
    autonumber
    actor U as Benutzer
    participant W as Web-App
    participant A as API
    participant D as Datenbank

    U->>W: Anmelden
    W->>A: POST /login
    A->>D: Benutzer suchen
    D-->>A: Datensatz
    alt Passwort korrekt
        A-->>W: 200 Token
        W-->>U: Startseite
    else Passwort falsch
        A-->>W: 401 Fehler
        W-->>U: Fehlermeldung
    end
    Note over U,W: Sitzung aktiv
`),
  },
  {
    id: "class",
    label: "Klassendiagramm",
    category: "diagram",
    description: "Klassen, Attribute und Beziehungen (UML)",
    docs: "https://mermaid.js.org/syntax/classDiagram.html",
    keywords: ["classDiagram"],
    template: d(`
---
title: Tierheim
---
classDiagram
    class Tierheim {
        +String ort
        +aufnehmen(Tier tier)
    }
    class Tier {
        <<abstract>>
        +String name
        -int alter
        +laut()* String
    }
    class Hund {
        +apportieren()
    }
    class Katze {
        +kratzen()
    }

    Tierheim "1" *-- "0..*" Tier : beherbergt
    Tier <|-- Hund
    Tier <|-- Katze
`),
  },
  {
    id: "state",
    label: "Zustandsdiagramm",
    category: "diagram",
    description: "Zustände und Übergänge",
    docs: "https://mermaid.js.org/syntax/stateDiagram.html",
    keywords: ["stateDiagram-v2", "stateDiagram"],
    template: d(`
---
title: Auftragsbearbeitung
---
stateDiagram-v2
    state Pruefung <<choice>>

    [*] --> Bereit
    Bereit --> Aktiv : start()

    state Aktiv {
        [*] --> Laden
        Laden --> Verarbeiten
        Verarbeiten --> [*]
    }

    Aktiv --> Pruefung
    Pruefung --> Fertig : ok
    Pruefung --> Fehler : fehlgeschlagen
    Fehler --> Bereit : erneut versuchen
    Fertig --> [*]

    classDef warnung fill:#ffcdd2,stroke:#c62828,color:#000
    class Fehler warnung
`),
  },
  {
    id: "er",
    label: "ER-Diagramm",
    category: "diagram",
    description: "Entitäten und Relationen (Datenmodell)",
    docs: "https://mermaid.js.org/syntax/entityRelationshipDiagram.html",
    keywords: ["erDiagram"],
    template: d(`
---
title: Bestellsystem
---
erDiagram
    KUNDE ||--o{ BESTELLUNG : "gibt auf"
    BESTELLUNG ||--|{ POSITION : enthaelt
    PRODUKT ||--o{ POSITION : "steht in"

    KUNDE {
        int id PK
        string name
        string email UK
    }
    BESTELLUNG {
        int id PK
        int kunde_id FK
        date datum
    }
    POSITION {
        int menge
    }
    PRODUKT {
        int id PK
        string bezeichnung
        decimal preis
    }
`),
  },
  {
    id: "requirement",
    label: "Anforderungen",
    category: "diagram",
    description: "Anforderungen und deren Beziehungen (SysML)",
    docs: "https://mermaid.js.org/syntax/requirementDiagram.html",
    keywords: ["requirementDiagram"],
    template: d(`
requirementDiagram

    requirement Hauptanforderung {
        id: 1
        text: "Bestellungen verarbeiten"
        risk: high
        verifymethod: test
    }
    performanceRequirement Antwortzeit {
        id: 1.1
        text: "Antwortzeit unter 200 ms"
        risk: medium
        verifymethod: analysis
    }
    interfaceRequirement REST_API {
        id: 1.2
        text: "Schnittstelle als REST-API"
        risk: low
        verifymethod: inspection
    }
    element Bestellservice {
        type: "Microservice"
    }
    element Lasttest {
        type: "Testfall"
    }

    Hauptanforderung - contains -> Antwortzeit
    Hauptanforderung - derives -> REST_API
    Bestellservice - satisfies -> REST_API
    Lasttest - verifies -> Antwortzeit
`),
  },
  {
    id: "c4",
    label: "C4-Modell",
    category: "diagram",
    description: "Softwarearchitektur nach dem C4-Modell",
    docs: "https://mermaid.js.org/syntax/c4.html",
    keywords: ["C4Context", "C4Container", "C4Component", "C4Dynamic", "C4Deployment"],
    template: d(`
---
config:
  c4:
    c4ShapeMargin: 30
    diagramMarginY: 0
---
C4Context
    title Systemkontext – Online-Banking

    Person(kunde, "Privatkunde", "Kunde mit Girokonto")
    System_Ext(mail, "E-Mail-System", "Benachrichtigungen")

    System_Boundary(bank, "Musterbank") {
        System(banking, "Online-Banking", "Konten und Überweisungen")
        SystemDb(db, "Kernbank-DB", "Konten und Buchungen")
        SystemQueue(queue, "Zahlungs-Queue", "Asynchrone Verarbeitung")
    }

    Rel(kunde, banking, "Nutzt", "HTTPS")
    Rel(banking, db, "Liest/Schreibt")
    Rel(banking, queue, "Sendet Aufträge")
    Rel(banking, mail, "Sendet E-Mails")

    UpdateLayoutConfig($c4ShapeInRow="2", $c4BoundaryInRow="1")
`),
  },
  {
    id: "architecture",
    label: "Architektur",
    category: "diagram",
    description: "Cloud- und Infrastruktur-Architektur",
    docs: "https://mermaid.js.org/syntax/architecture.html",
    keywords: ["architecture-beta", "architecture"],
    template: d(`
architecture-beta
    group backend(cloud)[Backend]

    service internet(internet)[Internet]
    service gateway(server)[API Gateway] in backend
    service app(server)[Anwendung] in backend
    service db(database)[Datenbank] in backend
    service storage(disk)[Dateispeicher] in backend

    internet:R --> L:gateway
    gateway:R --> L:app
    app:R -- L:db
    app:B -- T:storage
`),
  },
  {
    id: "block",
    label: "Blockdiagramm",
    category: "diagram",
    description: "Blöcke mit frei wählbarem Layout",
    docs: "https://mermaid.js.org/syntax/block.html",
    keywords: ["block-beta", "block"],
    template: d(`
block-beta
    columns 3
    eingang["Eingang"] space verarbeitung("Verarbeitung")
    space:3
    block:speicher:3
        db[("Datenbank")] cache(("Cache")) archiv[["Archiv"]]
    end

    eingang --> verarbeitung
    verarbeitung -- "speichert" --> db

    classDef blau fill:#bbdefb,stroke:#1565c0,color:#000
    class eingang,verarbeitung blau
`),
  },
  {
    id: "packet",
    label: "Paketdiagramm",
    category: "diagram",
    description: "Aufbau von Netzwerkpaketen (Bitfelder)",
    docs: "https://mermaid.js.org/syntax/packet.html",
    keywords: ["packet-beta", "packet"],
    template: d(`
---
title: UDP-Header
config:
  packet:
    bitWidth: 22
---
packet-beta
    0-15: "Quellport"
    16-31: "Zielport"
    32-47: "Länge"
    +16: "Prüfsumme"
    64-95: "Daten (variabel)"
`),
  },
  {
    id: "gitgraph",
    label: "Git-Graph",
    category: "diagram",
    description: "Branches, Commits und Merges",
    docs: "https://mermaid.js.org/syntax/gitgraph.html",
    keywords: ["gitGraph"],
    template: d(`
---
title: Release-Ablauf
---
gitGraph
    commit id: "Initial"
    branch develop
    checkout develop
    commit id: "Dev-1"
    branch feature
    checkout feature
    commit id: "Feature" type: HIGHLIGHT
    checkout develop
    merge feature
    checkout main
    commit id: "Hotfix"
    merge develop id: "Release" tag: "v1.0"
`),
  },
  {
    id: "mindmap",
    label: "Mindmap",
    category: "diagram",
    description: "Hierarchische Ideensammlung",
    docs: "https://mermaid.js.org/syntax/mindmap.html",
    keywords: ["mindmap"],
    template: d(`
mindmap
  root((Projekt))
    Ziele
      Umsatz steigern
      Kunden binden
    Team
      Entwicklung
      Design
    Risiken
      Budget
`),
  },
  {
    id: "timeline",
    label: "Zeitstrahl",
    category: "diagram",
    description: "Ereignisse in chronologischer Reihenfolge",
    docs: "https://mermaid.js.org/syntax/timeline.html",
    keywords: ["timeline"],
    template: d(`
timeline
    title Projektverlauf
    section Planung
        Q1 2026 : Kick-off : Konzept
        Q2 2026 : Prototyp
    section Umsetzung
        Q3 2026 : Rollout
`),
  },
  {
    id: "kanban",
    label: "Kanban",
    category: "diagram",
    description: "Aufgaben-Board mit Spalten",
    docs: "https://mermaid.js.org/syntax/kanban.html",
    keywords: ["kanban"],
    template: d(`
---
config:
  kanban:
    ticketBaseUrl: 'https://example.com/browse/#TICKET#'
---
kanban
  todo[Zu erledigen]
    t1[Anforderungen sammeln]@{ ticket: PRJ-101, assigned: 'Anna', priority: 'High' }
    t2[Design entwerfen]@{ priority: 'Low' }
  doing[In Arbeit]
    t3[Implementierung]@{ ticket: PRJ-102, assigned: 'Ben', priority: 'Very High' }
    t4[Code-Review]@{ assigned: 'Clara', priority: 'Very Low' }
  done[Erledigt]
    t5[Projekt-Setup]@{ ticket: PRJ-100 }
`),
  },
  {
    id: "journey",
    label: "User Journey",
    category: "diagram",
    description: "Benutzererlebnis in Schritten mit Bewertung",
    docs: "https://mermaid.js.org/syntax/userJourney.html",
    keywords: ["journey"],
    template: d(`
journey
    title Online-Einkauf
    section Suchen
        Produkt finden: 4: Kunde
        Preise vergleichen: 3: Kunde
    section Kaufen
        Bezahlen: 2: Kunde, Shop
        Lieferung: 5: Kunde, Kurier
`),
  },
  {
    id: "gantt",
    label: "Gantt",
    category: "diagram",
    description: "Projektplanung mit Zeitachse",
    docs: "https://mermaid.js.org/syntax/gantt.html",
    keywords: ["gantt"],
    template: d(`
---
config:
  gantt:
    useWidth: 760
---
gantt
    title Projektplan
    dateFormat YYYY-MM-DD
    axisFormat %d.%m.
    tickInterval 1week
    weekday monday
    excludes weekends
    todayMarker off

    section Planung
        Anforderungen  :done, a1, 2026-01-05, 5d
        Konzept        :active, a2, after a1, 5d
    section Umsetzung
        Entwicklung    :crit, b1, after a2, 10d
        Tests          :b2, after b1, 5d
        Go-Live        :milestone, after b2, 0d
`),
  },
  // ---------------------------------------------------------------- Charts
  {
    id: "pie",
    label: "Kreisdiagramm",
    category: "chart",
    description: "Anteile eines Ganzen",
    docs: "https://mermaid.js.org/syntax/pie.html",
    keywords: ["pie"],
    template: d(`
---
config:
  pie:
    textPosition: 0.7
---
pie showData
    title Marktanteile 2026
    "Produkt A" : 42.5
    "Produkt B" : 27
    "Produkt C" : 18.3
    "Sonstige" : 12.2
`),
  },
  {
    id: "xychart",
    label: "XY-Diagramm",
    category: "chart",
    description: "Balken- und Liniendiagramme",
    docs: "https://mermaid.js.org/syntax/xyChart.html",
    keywords: ["xychart-beta", "xychart"],
    template: d(`
xychart-beta
    title "Umsatz und Ziel 1. Halbjahr"
    x-axis "Monat" [Jan, Feb, "Mär", Apr, Mai, Jun]
    y-axis "Umsatz (Tsd. €)" 0 --> 100
    bar [52, 60, 75, 82, 70, 91]
    line [55, 60, 65, 70, 75, 80]
`),
  },
  {
    id: "quadrant",
    label: "Quadrantendiagramm",
    category: "chart",
    description: "Bewertung in vier Quadranten",
    docs: "https://mermaid.js.org/syntax/quadrantChart.html",
    keywords: ["quadrantChart"],
    template: d(`
quadrantChart
    title Reichweite und Engagement
    x-axis Geringe Reichweite --> Hohe Reichweite
    y-axis Geringes Engagement --> Hohes Engagement
    quadrant-1 Ausbauen
    quadrant-2 Bewerben
    quadrant-3 Neu bewerten
    quadrant-4 Verbessern
    Kampagne A: [0.3, 0.6]
    Kampagne B: [0.45, 0.23]
    Kampagne C: [0.78, 0.34]
    Kampagne D:::fokus: [0.75, 0.8]
    classDef fokus color: #109060, radius: 10
`),
  },
  {
    id: "sankey",
    label: "Sankey",
    category: "chart",
    description: "Mengenflüsse zwischen Knoten",
    docs: "https://mermaid.js.org/syntax/sankey.html",
    keywords: ["sankey-beta", "sankey"],
    template: d(`
---
config:
  sankey:
    showValues: true
    linkColor: gradient
---
sankey-beta
Solar,Stromnetz,32.5
Wind,Stromnetz,45.2
Kohle,Stromnetz,20.1
Stromnetz,Haushalte,45.3
Stromnetz,Industrie,40.0
Stromnetz,Verkehr,12.5
`),
  },
  {
    id: "radar",
    label: "Radar",
    category: "chart",
    description: "Mehrdimensionale Vergleiche (Spinnennetz)",
    docs: "https://mermaid.js.org/syntax/radar.html",
    keywords: ["radar-beta", "radar"],
    template: d(`
---
title: Kompetenzprofil
config:
  radar:
    width: 460
    height: 460
    marginLeft: 100
    marginRight: 100
    marginTop: 50
    marginBottom: 40
---
radar-beta
    axis tech["Technik"], komm["Kommunikation"], team["Teamarbeit"]
    axis plan["Planung"], krea["Kreativität"]
    curve anna["Anna"]{4, 3, 5, 2, 4}
    curve ben["Ben"]{3, 5, 4, 4, 2}
    max 5
`),
  },
  {
    id: "treemap",
    label: "Treemap",
    category: "chart",
    description: "Hierarchische Werte als verschachtelte Flächen",
    docs: "https://mermaid.js.org/syntax/treemap.html",
    keywords: ["treemap-beta", "treemap"],
    template: d(`
treemap-beta
"Umsatz nach Bereich"
    "Hardware"
        "Laptops": 50
        "Monitore": 30
    "Software"
        "Lizenzen": 40:::wichtig
        "Abonnements": 35
    "Services"
        "Beratung": 25

classDef wichtig fill:#ffcc80,stroke:#e65100,stroke-width:2px
`),
  },
];

/** Alle Diagrammtypen: klassische + neu in Mermaid 12 */
export const DIAGRAM_TYPES: DiagramTypeDef[] = [...BASE_DIAGRAM_TYPES, ...V12_DIAGRAM_TYPES];

export function getDiagramType(id: string | undefined): DiagramTypeDef | undefined {
  return DIAGRAM_TYPES.find((t) => t.id === id);
}

/** Ermittelt den Diagrammtyp aus dem Code (Frontmatter & Kommentare werden übersprungen). */
export function detectDiagramType(code: string): DiagramTypeDef | undefined {
  const body = code
    .replace(/^\s*---[\s\S]*?\n---\s*\n/, "")
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith("%%"));
  const first = body[0]?.split(/\s+/)[0];
  if (!first) return undefined;
  return DIAGRAM_TYPES.find((t) => t.keywords.includes(first));
}
