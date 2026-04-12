# MEMORY_ARCHITECTURE.md

## Zweck
Dieses Dokument definiert die modellagnostische Memory- und Harness-Grundlage des Produkts auf Architekturebene.

Ziel ist, Wissen, Kontext und wiederverwendbare Arbeitslogik in eigener Kontrolle zu halten, statt sie primaer an externe Modellanbieter, proprietaere Harnesses oder API-seitigen State zu binden.

Diese Phase-M1-Definition ist bewusst architektonisch, nicht implementierend:
- keine neue API
- keine Persistenzmigration
- keine neue UI
- keine Plattform-Ausweitung
- keine Multi-Tenancy-Erweiterung
- keine grossen Refactorings

## Leitprinzipien

### 1. Memory gehoert dem Produkt
Memory ist ein Produkt-Asset, kein Nebenprodukt eines Modellproviders.

Daraus folgt:
- Langzeitwissen darf nicht primaer in Provider-State liegen
- Kontextsteuerung darf nicht an proprietaere Harnesses ausgelagert werden
- persistente Wissensartefakte muessen offen, lesbar und portierbar bleiben
- Modellwechsel darf nicht zum Verlust der Wissensbasis fuehren

### 2. Duenner Harness, offene Skills
Der Harness soll schlank bleiben und nur die Grundaufgaben uebernehmen:
- Kontext laden
- State verwalten
- Tools orchestration
- Sicherheitsgrenzen einhalten
- Read-/Write-Regeln beachten

Wiederverwendbare Arbeitslogik gehoert nicht in implizite Prompts oder Providersysteme, sondern in offene, versionierbare Skill-Artefakte.

### 3. Deterministisch vor verdichtet
Die eigentliche Wahrheit liegt in eigenen Datenstrukturen.

Deterministische Daten sind fuehrend:
- Objekte
- Zustaende
- Referenzen
- offene Punkte
- Resolver
- Skill-Dateien
- Quellen
- Zeitstempel
- Regeln

Verdichtete oder modellisch erzeugte Ableitungen sind nur sekundaere Hilfsschichten:
- Zusammenfassungen
- Profile
- Priorisierungshinweise
- Mustererkennung
- Konfliktverdichtungen

### 4. Resolver statt Kontextueberladung
Nicht alles soll jederzeit im Kontext liegen.
Resolver definieren, welcher Kontext fuer welchen Arbeitsmodus geladen wird.

### 5. Skills als Prozesskapseln
Skills sollen wiederverwendbare Prozessbeschreibungen sein.
Sie kapseln Vorgehensweisen, nicht Modelltricks.

---

## Memory-Ebenen

## 1. Session Context

### Definition
Kurzlebiger Arbeitskontext einer laufenden Interaktion oder eines aktiven Vorgangs.

### Typische Inhalte
- aktuell geoeffnete Spezifikation
- aktiver Produktionskontext
- temporaere Fokusmarken
- Ruecksprunganker
- aktuelle UI-Hinweise
- laufende Agenten-Zwischenstaende
- temporaere Arbeitsnotizen
- noch nicht persistenzwuerdige Bearbeitungshinweise

### Eigenschaften
- fluechtig
- stark zustandsbezogen
- nicht fuehrende Wissensquelle
- darf verloren gehen, ohne die Produktwahrheit zu beschaedigen

### Rolle
Session Context haelt die aktuelle Arbeit beweglich, ist aber nicht die langfristige Wissensbasis.

---

## 2. Operational Memory

### Definition
Produktnahe, objekt- und vorgangsbezogene Wissensschicht mit direktem Arbeitsbezug.

Operational Memory ist enger an konkrete Produktobjekte und Vorgaenge gebunden als Long-Term Memory.

### Typische Inhalte
- Spezifikationen
- Produktionsplaene
- offene Punkte
- operative Rueckfragen
- letzte Korrekturen
- letzte relevante Bearbeitungsschritte
- objektbezogene Statusverlaeufe
- konkrete Arbeitsfoki innerhalb eines laufenden Vorgangs
- Entscheidungen mit unmittelbarem Objektbezug

### Eigenschaften
- persistenzwuerdig
- deterministisch referenzierbar
- eng an Produktobjekte gekoppelt
- auditierbar und reproduzierbar

### Rolle
Operational Memory ist die operative Arbeitswahrheit des Produkts.

Es beantwortet Fragen wie:
- Was ist bei diesem Vorgang offen?
- Was wurde zuletzt geaendert?
- Welche Spezifikation ist aktiv?
- Welcher Produktionsplan gehoert zu welchem Objekt?
- Welche konkrete Folgehandlung ist innerhalb dieses Vorgangs relevant?

---

## 3. Long-Term Memory

### Definition
Langlebige, wiederverwendbare Wissensschicht fuer Nutzer, Firma, Kunden, Prozesse, Praeferenzen, Standards und wiederkehrende Erkenntnisse.

Long-Term Memory ist nicht bloss Speicherung, sondern strukturierte Wissenshaltung mit Quellenbezug.

### Typische Inhalte
- Nutzerpraeferenzen
- Firmenstandards
- Kundenprofile
- Eventprofile
- wiederkehrende Entscheidungslogiken
- Learnings aus frueheren Vorgaengen
- Skill-Dateien
- Resolver-Regeln
- verdichtete Profile
- Konfliktmuster
- Priorisierungsmuster
- bekannte No-Gos / Praeferenzen / Stilregeln

### Eigenschaften
- langlebig
- wiederverwendbar
- modellagnostisch portierbar
- idealerweise versionierbar
- nach Moeglichkeit mit Quellenbezug oder Herkunftsmetadaten

### Rolle
Long-Term Memory macht das Produkt mit der Zeit besser, persoenlicher und schwerer austauschbar.

Es beantwortet Fragen wie:
- Wie arbeitet dieser Nutzer typischerweise?
- Welche Praeferenzen hat dieser Kunde?
- Welche Standards gelten in dieser Firma?
- Welche Art Entscheidungen kehren immer wieder?
- Welche Skills und Resolver sind dauerhaft relevant?

---

## Memory-Objekte
## Memory-Objekte
## Deterministische Kernobjekte
Diese Objekte sind fuehrend und muessen verlaesslich, stabil und referenzierbar sein.

### Kandidaten
- `UserProfile`
- `CompanyProfile`
- `ClientProfile`
- `EventProfile`
- `SpecRecord`
- `ProductionPlanRecord`
- `OpenIssueRecord`
- `DecisionRecord`
- `PreferenceRecord`
- `MemoryWriteRule`
- `MemoryReadRule`
- `SkillDefinition`
- `ResolverDefinition`

### Konsolidierter M1-Stand und Dokumentationsrolle
Die kanonische Architekturquelle fuer den Memory-Strang bleibt dieses Dokument: `docs/architecture/MEMORY_ARCHITECTURE.md`.

M1 ist hier als vorerst konsolidiert und stabil zu lesen.

In dieser konsolidierten M1-Fundation sind folgende interne Owned-Memory-Anker real verankert und fuehrend mitgefuehrt:
- `SpecRecord`
- `OpenIssueRecord`
- `ProductionPlanRecord`

`SpecRecord` und `OpenIssueRecord` sind hier die kanonisch beschriebenen Operational-Memory-Objekte. `ProductionPlanRecord` ist ein bereits real abgeleiteter interner Planungsanker im aktuellen Python-/Agent-Repo.

`memory.md` bleibt in diesem Zusammenhang ausschliesslich Verweis-, Status- und Handoff-Anker. Es fasst den aktuellen Stand kompakt zusammen, benennt den Strang und verweist auf die kanonische Architektur. Es ist nicht die primäre Definitionsquelle fuer die Memory-Objekte.

Eine spaetere Auslagerung einzelner Teilaspekte in eigene Architekturdokumente ist moeglich, aber fuer M1 noch nicht notwendig.

### Operationale M1-Objekte
- `SpecRecord`
- `OpenIssueRecord`
- `ProductionPlanRecord`

### Weiter fuehrende, aber spaetere Kandidaten
- `DecisionRecord`
- `PreferenceRecord`

## Verdichtete / modellisch erzeugte Objekte
Diese Objekte sind abgeleitet und duerfen die fuehrende Produktwahrheit nicht ersetzen.

### Kandidaten
- `UserSummary`
- `CompanyOperatingSummary`
- `ClientPreferenceSummary`
- `EventExecutionSummary`
- `ProductionIssueSummary`
- `SuggestedNextFocus`
- `SkillCandidateSummary`
- `PatternSummary`
- `ConflictSummary`

---

## Deterministisch vs. verdichtet

## Deterministisch speichern
Folgendes muss fuehrend und belastbar gespeichert werden:
- IDs
- Referenzen
- Beziehungen
- Zustaende
- Statuswechsel
- offene Punkte
- Produktionsplandaten
- Spezifikationen
- konkrete Entscheidungen
- Skill-Artefakte
- Resolver-Artefakte
- Regeln
- Zeitstempel
- Ownership
- Quellenverweise
- Read-/Write-Metadaten

## Verdichtet speichern
Folgendes darf als abgeleitete Hilfsschicht gespeichert werden:
- Nutzerprofile in verdichteter Form
- Kunden- und Eventcharakteristika
- Konfliktmuster
- Vorschlaege fuer naechsten Fokus
- Muster aus Korrekturverlaeufen
- diarized summaries
- says-vs-does-Profile
- verdichtete Prozess- oder Qualitaetsmuster

## Fuehrungsregel
Verdichtung darf die Produktwahrheit ergaenzen, aber nie ersetzen.

---

## Ownership und Portabilitaet

## Grundsatz
Wenn das Produkt modellagnostisch sein soll, muessen Harness, Memory und Skills in eigener Kontrolle bleiben.

## Daraus folgt
- Primaerspeicher liegt auf eigenem Rechner, Server oder eigener Datenbank
- Provider-State ist hoechstens Hilfsmittel, nie Primaerquelle
- Skill- und Resolver-Artefakte muessen exportierbar und lesbar sein
- Wissensobjekte duerfen nicht in proprietaeren, unlesbaren Formaten gefangen sein
- Modellwechsel muss moeglich bleiben, ohne Kernwissen zu verlieren

---

## Resolver-Rahmen

## Zweck
Resolver definieren, welcher Kontext fuer welchen Arbeitstyp gezielt geladen wird.

Sie verhindern:
- Kontextueberladung
- unnoetige Systemprompt-Aufblaehung
- schwer wartbare All-in-One-Instruktionen

## Beispiele
- Produktionsproblem
  -> lade `SpecRecord`, `ProductionPlanRecord`, `OpenIssueRecord`, letzte Korrektur, relevante `SkillDefinition`

- Angebotsarbeit
  -> lade `ClientProfile`, `EventProfile`, `PreferenceRecord`, `CompanyProfile`

- Nachbearbeitung
  -> lade `ProductionIssueSummary`, `DecisionRecord`, `EventExecutionSummary`

- Governance-/Freigabefrage
  -> lade `SpecRecord`, Governance-Status, ChangeSet-Historie

## Regel
Resolver laden gezielt Kontext.
Sie sind keine Fachlogik-Engine.

---

## Skill-Rahmen

## Zweck
Skills kapseln wiederverwendbare Prozesse.

Sie sollen:
- offen
- lesbar
- versionierbar
- modellagnostisch
- wiederverwendbar

sein.

## Fruehe Skill-Kandidaten
- Produktionspruefung
- Offene-Punkte-Nachbearbeitung
- Kunden-/Eventprofil-Verdichtung
- Angebotsvorbereitung
- Komponenten-/Rezeptzuordnungs-Review
- Nachbereitung / Learnings
- Priorisierungs-Review im Produktionskontext

## Regel
- Skill beschreibt den Prozess
- Resolver laedt den passenden Kontext
- deterministische Schicht liefert verlaessliche Daten
- das Modell uebernimmt urteils- und syntheseabhaengige Schritte

## Wichtiger Grundsatz
Skills sind Prozesskapseln, nicht modellinterne Spezialtricks.

---

## Versionierung von Skills und Resolvern

Auch wenn Phase M1 noch nichts implementiert, werden folgende Artefakte bereits konzeptionell als offen und versionierbar gedacht:
- `SkillDefinition`
- `ResolverDefinition`

## Zielbild
- versionierte Aenderung nachvollziehbar
- lesbare Historie
- portierbar zwischen Harnesses und Modellanbietern
- nicht an proprietaere API-Zustaende gebunden

---

## Write-/Read-Grundsaetze

## Writes
Nicht alles soll automatisch in Long-Term Memory wandern.

Zu unterscheiden ist zwischen:
- fluechtigem Session-Kontext
- operativ relevantem, objektbezogenem Wissen
- langfristig wertvollem, wiederverwendbarem Wissen

## Reads
Nicht alles soll immer geladen werden.

Kontext soll:
- gezielt
- resolvergesteuert
- arbeitsmodusabhaengig
- quellenbewusst

geladen werden.

---

## Latent vs. deterministic

## Latent / modellisch
Geeignet fuer:
- Zusammenfassung
- Verdichtung
- Mustererkennung
- Priorisierungsvorschlaege
- Konfliktinterpretation
- Skill-Ausfuehrung mit Urteilskomponente

## Deterministisch
Geeignet fuer:
- IDs
- Beziehungen
- Zustaende
- Abfragen
- Objektverknuepfungen
- Speicheroperationen
- Produktionsplandaten
- offene Punkte
- Skill-/Resolver-Versionen
- Auditierbare Referenzen

## Fuehrungsregel
Vertrauen liegt in der deterministischen Schicht.
Modellische Schichten ergaenzen, priorisieren und verdichten.

---

## Scope-Grenzen fuer Phase M1

Phase M1 ist reine Architekturdefinition.

### Nicht Teil von M1
- keine neue API
- keine Persistenzmigration
- kein neuer Screen
- keine Plattform-Ausweitung
- keine Multi-Tenancy-Erweiterung
- keine grossen Refactorings
- keine Implementierung von Memory-Harness-Features ueber Definitionsniveau hinaus
- kein Ausbau zu vollstaendigem Memory-Produkt
- keine Vektor-/RAG-Architektur als Primaerloesung

### Teil von M1
- Architekturgrenzen definieren
- Objektklassen definieren
- Ownership festlegen
- Prioritaeten festlegen
- deterministisch vs. verdichtet trennen
- Resolver-/Skill-Rahmen definieren
- Modellagnostik vorbereiten

---

## Ergebnis von Phase M1
Wenn Phase M1 erfolgreich abgeschlossen ist, ist klar:
- welche Memory-Ebenen es gibt
- welche Objektklassen fuehrend sind
- was deterministisch und was verdichtet gespeichert wird
- wem das Memory gehoert
- wie Resolver Kontext laden
- wie Skills als offene Prozesskapseln funktionieren
- welche Grenzen spaetere Implementierungen einhalten muessen
