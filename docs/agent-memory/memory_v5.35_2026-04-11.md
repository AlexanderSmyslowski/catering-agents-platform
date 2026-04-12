# memory snapshot

source: memory.md
version: 5.35
date: 2026-04-11
repo: AlexanderSmyslowski/catering-agents-platform
status: m1-6-canonical-placement-implemented

## Snapshot-Zweck
Versionierter Zwischenstand fuer Handoff und Rueckgriff: in Phase M1.6 sind kanonische Ablage- und Dokumentationsrollen fuer `SpecRecord` und `OpenIssueRecord` repo-seitig festgezogen.

## Tatsaechlich umgesetzte Aenderungen
- In `docs/architecture/MEMORY_ARCHITECTURE.md` wurde ein klarer Abschnitt zur kanonischen Ablage- und Dokumentationsrolle ergaenzt.
- Dort ist jetzt explizit festgehalten:
  - `docs/architecture/MEMORY_ARCHITECTURE.md` bleibt die fuehrende Architekturquelle
  - `SpecRecord` und `OpenIssueRecord` sind in M1 dort kanonisch verankert
  - `memory.md` bleibt nur Verweis-, Status- und Handoff-Anker
  - spaetere Auslagerung in eigene Architekturdokumente ist moeglich, aber noch nicht noetig
- In `memory.md` wurde nur ein kleiner konsistenter Hinweis auf diese kanonische Architektur- und Objektdefinition ergaenzt.

## Betroffene Dateien
- `docs/architecture/MEMORY_ARCHITECTURE.md`
- `memory.md`

## Warum der Schritt in M1.6 bleibt
- nur Dokumentationsstruktur und kanonische Ablagerolle festgezogen
- keine Implementierung
- keine neue API
- keine Persistenzmigration
- keine neue UI
- kein neuer Screen
- keine grossen Refactorings
- keine neuen Architekturdateien angelegt

## Einordnung
- M1 ist jetzt nicht nur fachlich, sondern auch dokumentarisch sauber verankert.
- Der naechste sinnvolle Schritt ist M1.7 als erster kleiner Umsetzungskandidat unterhalb der Architekturdefinition.
