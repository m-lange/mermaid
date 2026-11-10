/**
 * Code-Bausteine (Snippets) für die Toolbox im Editor.
 *
 * Platzhalter: `#{Text}` = Feld mit Vorgabewert, `#{}` = Endposition des Cursors.
 * Felder werden im Editor mit Tab / Umschalt+Tab durchlaufen.
 * Ein Tabulator `\t` am Zeilenanfang steht für eine Einrückungsebene.
 *
 * Jedes Snippet (außer `test: false`) wird von `npm run test:templates` an die
 * Beispielvorlage seines Typs angehängt und gerendert – so bleibt die Syntax gültig.
 */

import { getLanguage } from "./i18n";
import { EN_SNIPPETS } from "./snippets.en";

export type SnippetGroup = "nodes" | "edges" | "structure" | "style" | "general";

export interface Snippet {
  label: string;
  group: SnippetGroup;
  /** Mermaid-Code mit Platzhaltern */
  code: string;
  /**
   * Frontmatter-Snippet: wird nicht an der Cursorposition, sondern im YAML-Kopf eingefügt.
   * `section: "config"` fügt unterhalb von `config:` ein (wird bei Bedarf angelegt).
   */
  frontmatter?: { section?: "config" };
  /** Nicht automatisch testen (nur im Kontext gültig, z. B. innerhalb eines Blocks) */
  test?: false;
}

const s = (group: SnippetGroup, label: string, code: string, extra: Partial<Snippet> = {}): Snippet => ({
  group,
  label,
  code,
  ...extra,
});

/** Für alle Diagrammtypen */
export const COMMON_SNIPPETS: Snippet[] = [
  s("general", "Kommentar", "%% #{Kommentar}"),
  s("general", "Titel", "title: #{Titel}", { frontmatter: {} }),
  s("general", "Design im Code festlegen", "theme: #{forest}", { frontmatter: { section: "config" } }),
  s("general", "Handgezeichnet (im Code)", "look: handDrawn", { frontmatter: { section: "config" } }),
  s("general", "Design-Variablen", "themeVariables:\n  primaryColor: '#{#bbdefb}'\n  lineColor: '#{#1565c0}'", {
    frontmatter: { section: "config" },
  }),
];

/** Zusätzlich für Typen auf Basis des Flowchart-Renderers */
const ELK_SNIPPET = s("general", "Layout: ELK", "layout: elk", { frontmatter: { section: "config" } });

const FLOWCHART: Snippet[] = [
  s("nodes", "Rechteck", "#{knoten1}[#{Text}]"),
  s("nodes", "Abgerundet", "#{knoten1}(#{Text})"),
  s("nodes", "Stadion", "#{knoten1}([#{Text}])"),
  s("nodes", "Unterprogramm", "#{knoten1}[[#{Text}]]"),
  s("nodes", "Datenbank", "#{knoten1}[(#{Text})]"),
  s("nodes", "Kreis", "#{knoten1}((#{Text}))"),
  s("nodes", "Doppelkreis", "#{knoten1}(((#{Text})))"),
  s("nodes", "Raute (Entscheidung)", "#{knoten1}{#{Frage?}}"),
  s("nodes", "Sechseck", "#{knoten1}{{#{Text}}}"),
  s("nodes", "Fahne", "#{knoten1}>#{Text}]"),
  s("nodes", "Parallelogramm", "#{knoten1}[/#{Text}/]"),
  s("nodes", "Trapez", "#{knoten1}[/#{Text}\\]"),
  s("nodes", "Form (Shape-Syntax)", '#{knoten1}@{ shape: #{doc}, label: "#{Text}" }'),
  s("nodes", "Markdown-Text", '#{knoten1}["`**#{Fett}** und *#{kursiv}*`"]'),
  s("edges", "Pfeil", "#{A} --> #{B}"),
  s("edges", "Pfeil mit Text", "#{A} -->|#{Text}| #{B}"),
  s("edges", "Linie", "#{A} --- #{B}"),
  s("edges", "Gestrichelt", "#{A} -.-> #{B}"),
  s("edges", "Dick", "#{A} ==> #{B}"),
  s("edges", "Kreis-Ende", "#{A} --o #{B}"),
  s("edges", "Kreuz-Ende", "#{A} --x #{B}"),
  s("edges", "Beidseitig", "#{A} <--> #{B}"),
  s("edges", "Unsichtbar (Layout)", "#{A} ~~~ #{B}"),
  s("edges", "Mehrfachverbindung", "#{A} & #{B} --> #{C}"),
  s("structure", "Subgraph", "subgraph #{gruppe1} [#{Titel}]\n\tdirection #{LR}\n\t#{x1} --> #{x2}\nend"),
  s("structure", "Richtung (im Subgraph)", "direction #{LR}", { test: false }),
  s("style", "Klasse definieren", "classDef #{wichtig} fill:#{#ffcc80},stroke:#{#e65100},stroke-width:2px"),
  s("style", "Klasse zuweisen", "class #{A},#{B} #{wichtig}"),
  s("style", "Knotenstil", "style #{A} fill:#{#bbdefb},stroke:#{#1565c0},stroke-width:2px"),
  s("style", "Kantenstil", "linkStyle #{0} stroke:#{#e53935},stroke-width:2px"),
  s("style", "Link", 'click #{A} "#{https://mermaid.js.org}" "#{Tooltip}"'),
  ELK_SNIPPET,
];

const SEQUENCE: Snippet[] = [
  s("nodes", "Teilnehmer", "participant #{P1} as #{Name}"),
  s("nodes", "Akteur", "actor #{U1} as #{Benutzer}"),
  s("nodes", "Gruppe (Box)", "box #{rgb(232, 245, 233)} #{Gruppe}\n\tparticipant #{P2}\nend", { test: false }),
  s("edges", "Nachricht (synchron)", "#{A}->>#{B}: #{Nachricht}"),
  s("edges", "Antwort", "#{B}-->>#{A}: #{Antwort}"),
  s("edges", "Asynchron", "#{A}-)#{B}: #{Ereignis}"),
  s("edges", "Abbruch", "#{A}-x#{B}: #{Abbruch}"),
  s("edges", "Ohne Pfeilspitze", "#{A}->#{B}: #{Text}"),
  s("edges", "Beidseitig", "#{A}<<->>#{B}: #{Synchronisieren}"),
  s("edges", "Mit Aktivierung", "#{A}->>+#{B}: #{Anfrage}\n#{B}-->>-#{A}: #{Antwort}"),
  s("structure", "Schleife", "loop #{Alle 5 Minuten}\n\t#{A}->>#{B}: #{Nachricht}\nend"),
  s("structure", "Alternative", "alt #{Erfolg}\n\t#{A}->>#{B}: #{OK}\nelse #{Fehler}\n\t#{A}->>#{B}: #{Fehler}\nend"),
  s("structure", "Optional", "opt #{Bedingung}\n\t#{A}->>#{B}: #{Nachricht}\nend"),
  s("structure", "Parallel", "par #{Aufgabe 1}\n\t#{A}->>#{B}: #{Eins}\nand #{Aufgabe 2}\n\t#{A}->>#{C}: #{Zwei}\nend"),
  s("structure", "Kritischer Bereich", "critical #{Transaktion}\n\t#{A}->>#{B}: #{Buchen}\noption #{Timeout}\n\t#{A}-x#{B}: #{Abbruch}\nend"),
  s("structure", "Abbruch (break)", "break #{Fehlerfall}\n\t#{A}-->>#{B}: #{Fehler}\nend"),
  s("structure", "Hervorhebung", "rect #{rgb(255, 243, 224)}\n\t#{A}->>#{B}: #{Nachricht}\nend"),
  s("structure", "Notiz rechts", "Note right of #{A}: #{Text}"),
  s("structure", "Notiz über", "Note over #{A},#{B}: #{Text}"),
  s("general", "Nummerierung", "autonumber"),
  s("general", "Aktivieren/Deaktivieren", "activate #{B}\n#{A}->>#{B}: #{Nachricht}\ndeactivate #{B}"),
];

const CLASS: Snippet[] = [
  s("nodes", "Klasse", "class #{Kunde} {\n\t+#{String} #{name}\n\t-#{int} #{alter}\n\t+#{bestellen}() #{bool}\n}"),
  s("nodes", "Interface", "class #{Speicherbar} {\n\t<<interface>>\n\t+#{speichern}()\n}"),
  s("nodes", "Abstrakte Klasse", "class #{Form} {\n\t<<abstract>>\n\t+#{flaeche}()* double\n}"),
  s("nodes", "Aufzählung", "class #{Status} {\n\t<<enumeration>>\n\t#{AKTIV}\n\t#{INAKTIV}\n}"),
  s("nodes", "Generische Klasse", "class #{Liste}~#{T}~"),
  s("nodes", "Statisch / abstrakt", "class #{Util} {\n\t+#{zaehler}$ int\n\t+#{berechne}()*\n}"),
  s("edges", "Vererbung", "#{Basis} <|-- #{Abgeleitet}"),
  s("edges", "Realisierung", "#{Schnittstelle} <|.. #{Klasse}"),
  s("edges", "Komposition", "#{Ganzes} *-- #{Teil}"),
  s("edges", "Aggregation", "#{Ganzes} o-- #{Teil}"),
  s("edges", "Assoziation", "#{A} --> #{B}"),
  s("edges", "Abhängigkeit", "#{A} ..> #{B}"),
  s("edges", "Mit Kardinalität", '#{A} "#{1}" --> "#{*}" #{B} : #{hat}'),
  s("edges", "Lollipop-Schnittstelle", "#{Klasse} --() #{Schnittstelle}"),
  s("structure", "Namespace", "namespace #{Bereich} {\n\tclass #{Klasse1}\n\tclass #{Klasse2}\n}"),
  s("structure", "Notiz zu Klasse", 'note for #{Hund} "#{Text}"'),
  s("structure", "Notiz", 'note "#{Text}"'),
  s("structure", "Richtung", "direction #{LR}"),
  s("style", "Klasse definieren", "classDef #{wichtig} fill:#{#fff59d},stroke:#{#f9a825}"),
  s("style", "Stil zuweisen", "class #{Hund}:::#{wichtig}", { test: false }),
  s("style", "Klassenstil", "style #{Katze} fill:#{#f8bbd0},stroke:#{#ad1457}"),
];

const STATE: Snippet[] = [
  s("nodes", "Zustand mit Beschreibung", 'state "#{Beschreibung}" as #{Z1}'),
  s("nodes", "Auswahl (Choice)", "state #{wahl1} <<choice>>"),
  s("nodes", "Gabelung (Fork)", "state #{gabel1} <<fork>>"),
  s("nodes", "Vereinigung (Join)", "state #{join1} <<join>>"),
  s("edges", "Start", "[*] --> #{Zustand}"),
  s("edges", "Ende", "#{Zustand} --> [*]"),
  s("edges", "Übergang", "#{A} --> #{B} : #{Ereignis}"),
  s("structure", "Zusammengesetzt", "state #{Gruppe} {\n\t[*] --> #{Innen}\n\t#{Innen} --> [*]\n}"),
  s("structure", "Nebenläufig", "state #{Parallel} {\n\t[*] --> #{P1}\n\t--\n\t[*] --> #{P2}\n}"),
  s("structure", "Notiz (einzeilig)", "note right of #{Bereit} : #{Text}"),
  s("structure", "Notiz (mehrzeilig)", "note left of #{Bereit}\n\t#{Text}\nend note"),
  s("structure", "Richtung", "direction #{LR}"),
  s("style", "Klasse definieren", "classDef #{markiert} fill:#{#ffcdd2},stroke:#{#c62828}"),
  s("style", "Klasse zuweisen", "class #{Bereit} #{markiert}", { test: false }),
];

const ER: Snippet[] = [
  s("nodes", "Entität", "#{ENTITAET} {\n\t#{int} #{id} PK\n\t#{string} #{name}\n\t#{int} #{ref_id} FK\n}"),
  s("nodes", "Attribut", '#{string} #{feld} #{UK} "#{Kommentar}"', { test: false }),
  s("edges", "Eins zu viele", '#{A} ||--o{ #{B} : "#{hat}"'),
  s("edges", "Eins zu eins", '#{A} ||--|| #{B} : "#{gehört zu}"'),
  s("edges", "Viele zu viele", '#{A} }o--o{ #{B} : "#{verknüpft}"'),
  s("edges", "Eins zu mindestens eins", '#{A} ||--|{ #{B} : "#{enthält}"'),
  s("edges", "Nicht identifizierend", '#{A} ||..o{ #{B} : "#{nutzt}"'),
];

const GANTT: Snippet[] = [
  s("structure", "Abschnitt", "section #{Abschnitt}"),
  s("nodes", "Aufgabe", "#{Aufgabe} :#{t1}, #{2026-03-02}, #{5d}"),
  s("nodes", "Aufgabe nach …", "#{Aufgabe} :#{t2}, after #{a1}, #{3d}"),
  s("nodes", "Kritische Aufgabe", "#{Aufgabe} :crit, #{2026-03-09}, #{2d}"),
  s("nodes", "Erledigt", "#{Aufgabe} :done, #{2026-02-23}, #{4d}"),
  s("nodes", "In Arbeit", "#{Aufgabe} :active, #{2026-02-25}, #{4d}"),
  s("nodes", "Meilenstein", "#{Meilenstein} :milestone, #{2026-03-13}, 0d"),
  s("general", "Wochenenden ausblenden", "excludes weekends"),
  s("general", "Achsenformat", "axisFormat #{%d.%m.}"),
  s("general", "Link", 'click #{a1} href "#{https://example.com}"'),
];

const PIE: Snippet[] = [s("nodes", "Segment", '"#{Kategorie}" : #{25}')];

const MINDMAP: Snippet[] = [
  s("nodes", "Knoten", "#{Idee}"),
  s("nodes", "Rechteck", "[#{Rechteck}]"),
  s("nodes", "Abgerundet", "(#{Abgerundet})"),
  s("nodes", "Kreis", "((#{Kreis}))"),
  s("nodes", "Knall", "))#{Knall}(("),
  s("nodes", "Wolke", ")#{Wolke}("),
  s("nodes", "Sechseck", "{{#{Sechseck}}}"),
  s("nodes", "Markdown", '["`**#{Fett}** und *#{kursiv}*`"]'),
  s("structure", "Unterpunkte", "#{Thema}\n\t#{Unterpunkt 1}\n\t#{Unterpunkt 2}"),
  s("style", "CSS-Klasse", ":::#{urgent}"),
];

const GITGRAPH: Snippet[] = [
  s("nodes", "Commit", 'commit id: "#{Beschreibung}"'),
  s("nodes", "Commit mit Tag", 'commit tag: "#{v2.0}"'),
  s("nodes", "Hervorgehoben", "commit type: HIGHLIGHT"),
  s("nodes", "Revert", "commit type: REVERSE"),
  s("structure", "Branch", "branch #{feature2}\ncheckout #{feature2}\ncommit"),
  s("structure", "Wechseln", "checkout #{develop}"),
  s("structure", "Merge", "merge #{develop}", { test: false }),
  s("structure", "Cherry-Pick", 'cherry-pick id: "#{Commit-ID}"', { test: false }),
];

const TIMELINE: Snippet[] = [
  s("structure", "Abschnitt", "section #{Abschnitt}"),
  s("nodes", "Zeitpunkt", "#{2028} : #{Ereignis}"),
  s("nodes", "Mehrere Ereignisse", "#{2029} : #{Ereignis 1} : #{Ereignis 2}"),
];

const JOURNEY: Snippet[] = [
  s("structure", "Abschnitt", "section #{Abschnitt}"),
  s("nodes", "Schritt", "#{Aufgabe}: #{4}: #{Ich}, #{Team}"),
];

const QUADRANT: Snippet[] = [
  s("nodes", "Punkt", "#{Punkt}: [#{0.5}, #{0.5}]"),
  s("nodes", "Punkt mit Stil", "#{Punkt}: [#{0.2}, #{0.8}] radius: #{10}, color: #{#ff3300}"),
  s("style", "Klasse definieren", "classDef #{markiert} color: #{#109060}, radius: #{12}"),
];

const XYCHART: Snippet[] = [
  s("nodes", "Balken-Reihe", "bar [#{10, 20, 30, 40, 50, 60}]"),
  s("nodes", "Linien-Reihe", "line [#{15, 25, 35, 45, 55, 65}]"),
];

const SANKEY: Snippet[] = [s("edges", "Fluss", "#{Quelle},#{Ziel},#{10}")];

const RADAR: Snippet[] = [
  s("nodes", "Kurve", 'curve #{c3}["#{Name}"]{#{3, 4, 2, 5, 3}}'),
  s("nodes", "Achse", 'axis #{x}["#{Achse}"]', { test: false }),
];

const TREEMAP: Snippet[] = [
  s("nodes", "Eintrag", '"#{Eintrag}": #{10}', { test: false }),
  s("structure", "Bereich", '"#{Bereich}"\n\t"#{Eintrag 1}": #{10}\n\t"#{Eintrag 2}": #{20}', { test: false }),
];

const REQUIREMENT: Snippet[] = [
  s("nodes", "Anforderung", 'requirement #{Neue_Anforderung} {\n\tid: #{2}\n\ttext: "#{Beschreibung}"\n\trisk: #{medium}\n\tverifymethod: #{test}\n}'),
  s("nodes", "Funktionale Anforderung", 'functionalRequirement #{Funktion} {\n\tid: #{2.1}\n\ttext: "#{Beschreibung}"\n\trisk: #{low}\n\tverifymethod: #{demonstration}\n}'),
  s("nodes", "Element", 'element #{Komponente} {\n\ttype: "#{Software}"\n\tdocref: "#{repo/pfad}"\n}'),
  s("edges", "erfüllt", "#{Bestellservice} - satisfies -> #{Hauptanforderung}"),
  s("edges", "verifiziert", "#{Lasttest} - verifies -> #{Hauptanforderung}"),
  s("edges", "enthält", "#{Hauptanforderung} - contains -> #{Antwortzeit}"),
  s("edges", "leitet ab", "#{Hauptanforderung} - derives -> #{REST_API}"),
  s("edges", "verfeinert", "#{Antwortzeit} - refines -> #{Hauptanforderung}"),
  s("edges", "verfolgt", "#{REST_API} - traces -> #{Hauptanforderung}"),
];

const C4: Snippet[] = [
  s("nodes", "Person", 'Person(#{person1}, "#{Name}", "#{Beschreibung}")'),
  s("nodes", "Externe Person", 'Person_Ext(#{extern1}, "#{Name}", "#{Beschreibung}")'),
  s("nodes", "System", 'System(#{system1}, "#{Name}", "#{Beschreibung}")'),
  s("nodes", "Externes System", 'System_Ext(#{extsys1}, "#{Name}", "#{Beschreibung}")'),
  s("nodes", "Datenbank", 'SystemDb(#{db1}, "#{Name}", "#{Beschreibung}")'),
  s("nodes", "Queue", 'SystemQueue(#{queue1}, "#{Name}", "#{Beschreibung}")'),
  s("structure", "Systemgrenze", 'System_Boundary(#{grenze1}, "#{Grenze}") {\n\tSystem(#{system2}, "#{Name}", "#{Beschreibung}")\n}'),
  s("structure", "Unternehmensgrenze", 'Enterprise_Boundary(#{firma1}, "#{Unternehmen}") {\n\tPerson(#{person2}, "#{Name}")\n}'),
  s("edges", "Beziehung", 'Rel(#{kunde}, #{mail}, "#{Beschriftung}", "#{Technik}")'),
  s("edges", "Beidseitig", 'BiRel(#{banking}, #{mail}, "#{Beschriftung}")'),
  s("edges", "Beziehung nach unten", 'Rel_D(#{banking}, #{db}, "#{Beschriftung}")'),
  s("style", "Elementstil", 'UpdateElementStyle(#{banking}, $bgColor="#{#2e7d32}", $borderColor="#{#1b5e20}")'),
  s("style", "Beziehungsstil", 'UpdateRelStyle(#{banking}, #{queue}, $lineColor="#{#e53935}", $textColor="#{#e53935}")'),
  s("style", "Layout", 'UpdateLayoutConfig($c4ShapeInRow="#{3}", $c4BoundaryInRow="#{1}")'),
];

const ARCHITECTURE: Snippet[] = [
  s("nodes", "Dienst", "service #{dienst1}(#{server})[#{Name}]"),
  s("nodes", "Dienst in Gruppe", "service #{dienst2}(#{database})[#{Name}] in #{backend}"),
  s("nodes", "Kreuzungspunkt", "junction #{knoten1}"),
  s("structure", "Gruppe", "group #{gruppe1}(#{cloud})[#{Name}]"),
  s("edges", "Verbindung", "#{app}:#{B} -- #{T}:#{storage}", { test: false }),
  s("edges", "Pfeil", "#{gateway}:#{R} --> #{L}:#{app}", { test: false }),
];

const BLOCK: Snippet[] = [
  s("nodes", "Block", '#{block1}["#{Text}"]'),
  s("nodes", "Rund", '#{block1}("#{Text}")'),
  s("nodes", "Datenbank", '#{block1}[("#{Text}")]'),
  s("nodes", "Kreis", '#{block1}(("#{Text}"))'),
  s("nodes", "Raute", '#{block1}{"#{Text}"}'),
  s("nodes", "Pfeil-Block", '#{pfeil1}<["#{Text}"]>(#{right})'),
  s("nodes", "Breiter Block", '#{block1}["#{Text}"]:#{3}'),
  s("structure", "Spalten", "columns #{3}"),
  s("structure", "Leerraum", "space:#{3}"),
  s("structure", "Verschachtelter Block", "block:#{gruppe1}:#{3}\n\tcolumns #{3}\n\t#{a1} #{b1} #{c1}\nend"),
  s("edges", "Pfeil", "#{eingang} --> #{verarbeitung}"),
  s("edges", "Pfeil mit Text", '#{eingang} -- "#{Text}" --> #{verarbeitung}'),
  s("style", "Klasse definieren", "classDef #{gruen} fill:#{#c8e6c9},stroke:#{#2e7d32}"),
  s("style", "Stil", "style #{eingang} fill:#{#ffe0b2},stroke:#{#e65100}"),
];

const PACKET: Snippet[] = [
  s("nodes", "Feld (Bereich)", '#{96}-#{103}: "#{Feld}"'),
  s("nodes", "Feld (Länge)", '+#{8}: "#{Feld}"'),
];

const KANBAN: Snippet[] = [
  s("structure", "Spalte", "#{spalte1}[#{Spalte}]"),
  s("nodes", "Aufgabe", "#{aufgabe1}[#{Aufgabe}]"),
  s("nodes", "Aufgabe mit Details", "#{aufgabe1}[#{Aufgabe}]@{ ticket: #{PRJ-200}, assigned: '#{Name}', priority: '#{High}' }"),
];

const ISHIKAWA: Snippet[] = [
  s("structure", "Kategorie mit Ursachen", "#{Kategorie}\n\t#{Ursache 1}\n\t#{Ursache 2}", { test: false }),
  s("nodes", "Ursache", "#{Ursache}", { test: false }),
];

const VENN: Snippet[] = [
  s("nodes", "Menge", 'set #{Neu}["#{Bezeichnung}"]:#{10}'),
  s("nodes", "Text in Menge", '\ttext #{t1}["#{Text}"]', { test: false }),
  s("edges", "Schnittmenge", 'union #{Fach},#{Tech}["#{Bezeichnung}"]:#{3}'),
  s("style", "Stil", "style #{Fach} fill:#{#4e79a7}, fill-opacity:#{0.5}"),
];

const WARDLEY: Snippet[] = [
  s("nodes", "Komponente", "component #{Neu} [#{0.50}, #{0.50}]"),
  s("nodes", "Eigenentwicklung", "component #{Neu} [#{0.50}, #{0.30}] (build)"),
  s("nodes", "Zukauf", "component #{Neu} [#{0.50}, #{0.70}] (buy)"),
  s("nodes", "Anker", "anchor #{Nutzer} [#{0.95}, #{0.50}]"),
  s("edges", "Abhängigkeit", "#{Webshop} -> #{Datenbank}"),
  s("edges", "Entwicklung", "evolve #{Datenbank} #{0.80}"),
  s("structure", "Notiz", 'note "#{Text}" [#{0.50}, #{0.10}]'),
  s("structure", "Beschleuniger", 'accelerator "#{Treiber}" [#{0.30}, #{0.70}]'),
];

const CYNEFIN: Snippet[] = [
  s("nodes", "Eintrag (in Domäne)", '\t"#{Aufgabe}"', { test: false }),
  s("edges", "Übergang", 'complex --> #{clear} : "#{Beschriftung}"'),
];

const RAILROAD: Snippet[] = [
  s("nodes", "Regel", 'regel = sequence(terminal("#{a}"), nonterminal("#{b}")) ;'),
  s("nodes", "Auswahl", 'auswahl = choice(terminal("#{x}"), terminal("#{y}")) ;'),
  s("nodes", "Optional / Wiederholung", 'liste = sequence(optional(terminal("#{-}")), oneOrMore(nonterminal("#{ziffer}"))) ;'),
];

const RAILROAD_EBNF: Snippet[] = [
  s("nodes", "Regel", 'regel = #{a} , "#{b}" ;'),
  s("nodes", "Auswahl", 'auswahl = "#{x}" | "#{y}" ;'),
  s("nodes", "Optional / Wiederholung", 'liste = [ "#{-}" ] , { #{ziffer} } ;'),
];

const RAILROAD_ABNF: Snippet[] = [
  s("nodes", "Regel", 'regel = #{a} "#{b}" ;'),
  s("nodes", "Auswahl", 'auswahl = "#{x}" / "#{y}" ;'),
  s("nodes", "Wiederholung", "liste = #{1}*#{3}DIGIT ;"),
];

const RAILROAD_PEG: Snippet[] = [
  s("nodes", "Regel", 'Regel <- #{A} "#{b}" ;'),
  s("nodes", "Geordnete Auswahl", 'Auswahl <- "#{x}" / "#{y}" ;'),
  s("nodes", "Wiederholung", "Liste <- #{Element}+ ;"),
];

const TREEVIEW: Snippet[] = [
  s("nodes", "Ordner", "#{ordner}/", { test: false }),
  s("nodes", "Datei mit Beschreibung", "#{datei.txt} ## #{Beschreibung}", { test: false }),
];

const SWIMLANE: Snippet[] = [
  s("structure", "Bahn", "subgraph #{bahn1} [#{Rolle}]\n\t#{schritt1}[#{Schritt}]\nend"),
  s("edges", "Pfeil", "#{antrag} --> #{pruefen}"),
  s("edges", "Pfeil mit Text", "#{ok} -->|#{Text}| #{buchen}"),
];

const USECASE: Snippet[] = [
  s("nodes", "Akteur", 'actor #{Gast}("#{Gast}")'),
  s("nodes", "Anwendungsfall", '#{Bewerten}("#{Medium bewerten}")', { test: false }),
  s("structure", "Systemgrenze", 'systemBoundary #{shop}["#{System}"]\n\t#{Kaufen}("#{Kaufen}")\nend'),
  s("edges", "Verbindung", "#{Leser} --> #{Suchen}"),
  s("edges", "include", "#{Ausleihen} ..> : include #{Anmelden}"),
  s("edges", "extend", "#{Verlaengern} ..> : extend #{Ausleihen}"),
  s("structure", "Notiz", 'note for #{Suchen} "#{Text}"'),
];

const AGENTFLOW: Snippet[] = [
  s("nodes", "Aufgabe", '#{schritt1}["#{Aufgabe}"]@{ shape: task }'),
  s("nodes", "Werkzeug", '#{tool1}["#{werkzeug}"]@{ shape: tool }'),
  s("nodes", "Entscheidung", '#{frage1}["#{Frage?}"]@{ shape: decision }'),
  s("nodes", "Aktion", '#{aktion1}["#{Aktion}"]@{ shape: action }'),
  s("nodes", "Eingabe", '#{eingabe1}["#{Eingabe}"]@{ shape: input }'),
  s("structure", "Agent (flow)", 'flow #{agent1}["#{Agent}"]\n\t#{a1}["#{Schritt}"]@{ shape: task }\nend'),
  s("edges", "Pfeil", "#{entwurf} --> #{senden}"),
  s("edges", "Mit Text", "#{klar} -- #{ja} --> #{entwurf}"),
];

const EVENTMODELING: Snippet[] = [
  s("nodes", "Befehl", "tf #{11} cmd #{NeuerBefehl}"),
  s("nodes", "Ereignis", "tf #{12} evt #{NeuesEreignis}"),
  s("nodes", "Lesemodell", "tf #{13} readmodel #{Ansicht}"),
  s("nodes", "Oberfläche", "tf #{14} ui #{Maske}"),
];

const SNIPPETS: Record<string, Snippet[]> = {
  flowchart: FLOWCHART,
  sequence: SEQUENCE,
  class: CLASS,
  state: STATE,
  er: ER,
  gantt: GANTT,
  pie: PIE,
  mindmap: MINDMAP,
  gitgraph: GITGRAPH,
  timeline: TIMELINE,
  journey: JOURNEY,
  quadrant: QUADRANT,
  xychart: XYCHART,
  sankey: SANKEY,
  radar: RADAR,
  treemap: TREEMAP,
  requirement: REQUIREMENT,
  c4: C4,
  architecture: ARCHITECTURE,
  block: BLOCK,
  packet: PACKET,
  kanban: KANBAN,
  ishikawa: ISHIKAWA,
  venn: VENN,
  wardley: WARDLEY,
  cynefin: CYNEFIN,
  railroad: RAILROAD,
  "railroad-ebnf": RAILROAD_EBNF,
  "railroad-abnf": RAILROAD_ABNF,
  "railroad-peg": RAILROAD_PEG,
  treeview: TREEVIEW,
  swimlane: SWIMLANE,
  usecase: USECASE,
  agentflow: AGENTFLOW,
  eventmodeling: EVENTMODELING,
};

export function snippetsFor(typeId: string | undefined): Snippet[] {
  const list = [...((typeId && SNIPPETS[typeId]) || []), ...COMMON_SNIPPETS];
  return getLanguage() === "de" ? list : list.map((sn) => localizeSnippet(sn, typeId));
}

/** Englische Fassung eines Snippets (Label + Platzhalter), siehe snippets.en.ts */
function localizeSnippet(sn: Snippet, typeId: string | undefined): Snippet {
  const full = typeId ? EN_SNIPPETS.byType[typeId]?.[sn.label] : undefined;
  const code =
    full ??
    sn.code.replace(/#\{([^}]*)\}/g, (m, value: string) =>
      value in EN_SNIPPETS.placeholders ? `#{${EN_SNIPPETS.placeholders[value]}}` : m,
    );
  return { ...sn, label: EN_SNIPPETS.labels[sn.label] ?? sn.label, code };
}

/**
 * Berechnet, wo ein Frontmatter-Snippet eingefügt wird.
 * - ergänzt einen vorhandenen YAML-Kopf bzw. `config:`-Block oder legt ihn an,
 * - ersetzt die Zeile, wenn der Schlüssel bereits existiert (z. B. zweites `theme:`).
 * Rückgabe: Textbereich [from, to) und einzufügender Text (mit Platzhaltern).
 */
export function frontmatterEdit(doc: string, snippet: Snippet): { from: number; to: number; text: string } {
  const lines = doc.split("\n");
  const offsets: number[] = [];
  let pos = 0;
  for (const l of lines) {
    offsets.push(pos);
    pos += l.length + 1;
  }
  const lineEnd = (i: number) => offsets[i] + lines[i].length;
  const inConfig = snippet.frontmatter?.section === "config";
  const yamlLines = snippet.code.split("\n");
  const indent = (ls: string[], n: number) => ls.map((l) => " ".repeat(n) + l).join("\n");
  const firstKey = /^([\w-]+)\s*:/.exec(yamlLines[0])?.[1];

  // Vorhandenen Frontmatter-Block suchen
  let close = -1;
  if (lines[0]?.trim() === "---") {
    for (let i = 1; i < lines.length; i++) {
      if (lines[i].trim() === "---") {
        close = i;
        break;
      }
    }
  }

  if (close < 0) {
    const body = inConfig ? `config:\n${indent(yamlLines, 2)}` : yamlLines.join("\n");
    return { from: 0, to: 0, text: `---\n${body}\n---\n` };
  }

  if (!inConfig) {
    for (let i = 1; i < close; i++) {
      if (firstKey && new RegExp(`^${firstKey}\\s*:`).test(lines[i])) {
        return { from: offsets[i], to: lineEnd(i), text: yamlLines.join("\n") };
      }
    }
    return { from: offsets[1], to: offsets[1], text: yamlLines.join("\n") + "\n" };
  }

  const configLine = lines.findIndex((l, i) => i > 0 && i < close && /^config\s*:\s*$/.test(l));
  if (configLine < 0) {
    return { from: offsets[close], to: offsets[close], text: `config:\n${indent(yamlLines, 2)}\n` };
  }
  // Vorhandenen Schlüssel innerhalb von config: ersetzen
  for (let i = configLine + 1; i < close && /^\s+/.test(lines[i]); i++) {
    const m = /^(\s+)([\w-]+)\s*:/.exec(lines[i]);
    if (m && m[2] === firstKey && m[1].length === 2) {
      return { from: offsets[i], to: lineEnd(i), text: indent(yamlLines, 2) };
    }
  }
  return { from: offsets[configLine + 1], to: offsets[configLine + 1], text: indent(yamlLines, 2) + "\n" };
}

/** Wandelt `#{…}`-Platzhalter in die CodeMirror-Snippet-Syntax `${…}` um. */
export function toCodeMirrorSnippet(code: string): string {
  return code.replace(/#\{/g, "${");
}

/** Ersetzt Platzhalter durch ihre Vorgabewerte (für Tests und Vorschau). */
export function expandSnippet(code: string): string {
  return code.replace(/#\{([^}]*)\}/g, "$1");
}
