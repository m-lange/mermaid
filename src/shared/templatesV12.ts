/**
 * Beispielvorlagen für die in Mermaid 12 neu hinzugekommenen (Beta-)Diagrammtypen.
 * Jede Vorlage ist ein kompaktes, typisches Beispiel (Stand: mermaid 12.3.0);
 * weitere Syntax liefern die Code-Bausteine der Symbolleiste (snippets.ts).
 */
import type { DiagramTypeDef } from "./templates";

const d = (s: string) => s.replace(/^\n/, "").replace(/\s+$/, "") + "\n";

export const V12_DIAGRAM_TYPES: DiagramTypeDef[] = [
  {
    id: "agentflow",
    label: "Agentenfluss",
    category: "diagram",
    description: "KI-Agenten, Werkzeuge und Abläufe",
    docs: "https://mermaid.js.org/syntax/agentflow.html",
    keywords: ["agentflow-beta"],
    template: d(`
---
title: Agentenfluss – Kundensupport
---
agentflow-beta TB
  anfrage["Kundenanfrage"]@{ shape: input }

  flow triage["Triage-Agent"]
    einordnen["Anfrage einordnen"]@{ shape: task }
    suche["kunde_suchen"]@{ shape: tool }
    klar["Eindeutig?"]@{ shape: decision }
    einordnen --> klar
    einordnen -.- suche
  end

  flow antwort["Antwort-Agent"]
    entwurf["Antwort entwerfen"]@{ shape: task }
    senden["E-Mail senden"]@{ shape: action }
    entwurf --> senden
  end

  mensch["An Mitarbeiter übergeben"]@{ shape: stadium }

  anfrage --> einordnen
  klar -- ja --> entwurf
  klar -- nein --> mensch
`),
  },
  {
    id: "swimlane",
    label: "Swimlane",
    category: "diagram",
    description: "Prozess mit Zuständigkeitsbahnen",
    docs: "https://mermaid.js.org/syntax/swimlanes.html",
    keywords: ["swimlane-beta"],
    template: d(`
swimlane-beta LR
  accTitle: Urlaubsantrag

  subgraph ma [Mitarbeiter]
    antrag[Antrag stellen]
    bescheid(Bescheid erhalten)
  end

  subgraph fk [Führungskraft]
    pruefen[Antrag prüfen]
    ok{Genehmigt?}
  end

  subgraph hr [Personalabteilung]
    buchen[[Urlaub buchen]]
  end

  antrag --> pruefen --> ok
  ok -->|Ja| buchen
  ok -.->|Nein| bescheid
  buchen --> bescheid

  classDef wichtig fill:#fff2cc,stroke:#d6a500,color:#111
  class ok wichtig
`),
  },
  {
    id: "treeview",
    label: "Baumansicht",
    category: "diagram",
    description: "Ordner- und Dateistrukturen",
    docs: "https://mermaid.js.org/syntax/treeView.html",
    keywords: ["treeView-beta"],
    template: d(`
---
config:
  treeView:
    showIcons: true
---
treeView-beta
    handbuch/
        kapitel/
            01-einleitung.md ## Überblick
            02-grundlagen.md :::highlight ## wird überarbeitet
        bilder/
            logo.svg
        README.md ## Einstieg
`),
  },
  {
    id: "eventmodeling",
    label: "Event Modeling",
    category: "diagram",
    description: "Befehle, Ereignisse und Lesemodelle",
    docs: "https://mermaid.js.org/syntax/eventmodeling.html",
    keywords: ["eventmodeling"],
    template: d(`
eventmodeling

tf 01 ui Warenkorb
tf 02 cmd ArtikelHinzufuegen
tf 03 evt ArtikelHinzugefuegt
tf 04 readmodel WarenkorbInhalt
tf 05 ui Kasse
`),
  },
  {
    id: "ishikawa",
    label: "Ishikawa",
    category: "diagram",
    description: "Ursache-Wirkungs-Diagramm (Fischgräte)",
    docs: "https://mermaid.js.org/syntax/ishikawa.html",
    keywords: ["ishikawa-beta"],
    template: d(`
ishikawa-beta
    Lieferung verspätet
    Mensch
        Krankheitsausfälle
        Fehlende Schulung
    Maschine
        Förderband defekt
    Methode
        Unklare Abläufe
    Material
        Lieferengpass
`),
  },
  {
    id: "venn",
    label: "Venn",
    category: "chart",
    description: "Mengen und ihre Überschneidungen",
    docs: "https://mermaid.js.org/syntax/venn.html",
    keywords: ["venn-beta"],
    template: d(`
venn-beta
  title Kompetenzen im Team
  set Fach["Fachwissen"]:20
  set Tech["Technik"]:18
  set Sozial["Soziale Kompetenz"]:16
  union Fach,Tech["Analyse"]:5
  union Tech,Sozial["Support"]:4
  union Fach,Sozial["Beratung"]:4
  style Fach fill:#4e79a7
  style Tech fill:#f28e2b
`),
  },
  {
    id: "usecase",
    label: "Anwendungsfall",
    category: "diagram",
    description: "UML-Anwendungsfälle mit Akteuren",
    docs: "https://mermaid.js.org/syntax/usecase.html",
    keywords: ["usecase-beta"],
    template: d(`
usecase-beta
direction TB
actor Leser("Leserin")
actor Personal("Bibliothekar")
systemBoundary bib["Online-Bibliothek"]
  Ausleihen("Medium ausleihen")
  Suchen("Medien suchen")
  Verlaengern("Frist verlängern")
  Anmelden("Anmelden")
end
Leser --> Ausleihen
Leser --> Suchen
Personal --> Verlaengern
Ausleihen ..> : include Anmelden
Verlaengern ..> : extend Ausleihen
`),
  },
  {
    id: "wardley",
    label: "Wardley-Karte",
    category: "chart",
    description: "Wertschöpfungskette und Entwicklungsstand",
    docs: "https://mermaid.js.org/syntax/wardley.html",
    keywords: ["wardley-beta"],
    template: d(`
wardley-beta
title Online-Buchhandel
size [700, 480]

anchor Kunde [0.95, 0.60]
component Webshop [0.80, 0.50] (build)
component Zahlung [0.62, 0.80] (buy)
component Logistik [0.50, 0.68]
component Datenbank [0.30, 0.55]
component Rechenzentrum [0.10, 0.85]

Kunde -> Webshop
Webshop -> Zahlung
Webshop -> Logistik
Webshop -> Datenbank
Datenbank -> Rechenzentrum

evolve Datenbank 0.80
note "Kernprodukt" [0.88, 0.30]
`),
  },
  {
    id: "cynefin",
    label: "Cynefin",
    category: "diagram",
    description: "Problemlagen nach Komplexität einordnen",
    docs: "https://mermaid.js.org/syntax/cynefin.html",
    keywords: ["cynefin-beta"],
    template: d(`
cynefin-beta
  title Entscheidungen im IT-Betrieb

  complex
    "Neues Produkt erkunden"

  complicated
    "Performance analysieren"

  clear
    "Passwort zurücksetzen"

  chaotic
    "Totalausfall beheben"

  complex --> complicated : "Muster erkannt"
  chaotic --> complex : "Stabilisiert"
`),
  },
  {
    id: "railroad",
    label: "Syntaxdiagramm",
    category: "diagram",
    description: "Grammatik als Eisenbahndiagramm",
    docs: "https://mermaid.js.org/syntax/railroad.html",
    keywords: ["railroad-beta"],
    template: d(`
railroad-beta
title "Geldbetrag"

betrag = sequence(
    optional(choice(terminal("+"), terminal("-"))),
    oneOrMore(nonterminal("ziffer")),
    optional(sequence(terminal(","), nonterminal("ziffer"), nonterminal("ziffer"))),
    nonterminal("waehrung")
) ;
waehrung = choice(terminal("€"), terminal("EUR")) ;
`),
  },
  {
    id: "railroad-ebnf",
    label: "Syntax (EBNF)",
    category: "diagram",
    description: "Grammatik in EBNF-Notation",
    docs: "https://mermaid.js.org/syntax/railroad.html",
    keywords: ["railroad-ebnf-beta"],
    template: d(`
railroad-ebnf-beta
title "Zuweisung (EBNF)"

zuweisung = name , "=" , ausdruck , [ ";" ] ;
ausdruck = term , { ( "+" | "-" ) , term } ;
term ::= zahl | name | "(" ausdruck ")" ;
`),
  },
  {
    id: "railroad-abnf",
    label: "Syntax (ABNF)",
    category: "diagram",
    description: "Grammatik in ABNF-Notation (RFC 5234)",
    docs: "https://mermaid.js.org/syntax/railroad.html",
    keywords: ["railroad-abnf-beta"],
    template: d(`
railroad-abnf-beta
title "Datum nach ISO 8601 (ABNF)"

datum = jahr "-" monat "-" tag [ "T" zeit ] ;
monat = ( "0" %x31-39 ) / ( "1" %d48-50 ) ;
zeit = 2DIGIT ":" 2DIGIT *1( ":" 2DIGIT ) ;
`),
  },
  {
    id: "railroad-peg",
    label: "Syntax (PEG)",
    category: "diagram",
    description: "Grammatik als Parsing Expression Grammar",
    docs: "https://mermaid.js.org/syntax/railroad.html",
    keywords: ["railroad-peg-beta"],
    template: d(`
railroad-peg-beta
title "Funktionsaufruf (PEG)"

Aufruf <- Name "(" Argumente? ")" ;
Argumente <- Ausdruck ("," Ausdruck)* ;
Ausdruck <- Zahl / Aufruf / Name ;
Name <- !Schluesselwort Buchstabe+ ;
Schluesselwort <- "wenn" / "sonst" ;
`),
  },
];
