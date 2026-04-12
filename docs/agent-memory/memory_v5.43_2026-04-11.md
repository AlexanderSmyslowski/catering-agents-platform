# memory snapshot

source: memory.md
version: 5.43
date: 2026-04-11
repo: AlexanderSmyslowski/catering-agents-platform
status: m1-21-openissuerecord-source-rules-defined

## Snapshot-Zweck
Versionierter Zwischenstand fuer Handoff und Rueckgriff: in Phase M1.21 sind Herkunfts-, Mapping- und Source-of-Truth-Regeln fuer den kleinsten `OpenIssueRecord` fachlich definiert.

## Kernaussage
- `OpenIssueRecord` darf nur aus realen Produktmomenten entstehen.
- Bevorzugter Bezug ist `specRef`, alternativ frueh im Prozess `intakeRef`.
- Kein `OpenIssueRecord` darf aus Modellvermutung, impliziter Deutung oder generischen To-dos entstehen.
- Die erste Statuslogik bleibt konservativ: `open`, `blocked`, `resolved`.

## Legitime Entstehungsmomente
- im Intake festgestellter offener Punkt
- klar benannter Blocker in der Spec-Bearbeitung
- konkrete Nacharbeitsnotiz zu einer Spezifikation
- produktiver Rueckfragepunkt, der die Spec nicht sofort abschliesst

## Bezugsregel
- `specRef`, wenn der Punkt eindeutig an eine bestaetigte oder abgeleitete Spezifikation gebunden ist
- `intakeRef`, wenn der Punkt noch im Intake-Kontext vor sauberer Spec-Bindung entsteht
- nie beide als gleichrangige Primaerquelle
- nie ohne klare Referenz

## Direkt aus realen Quellen
- `id`
- `sourceRef`
- `specRef` oder `intakeRef`
- `title`
- `status`

## Noch nicht modellisch oder automatisch ableiten
- Prioritaet
- Owner / Assignee
- Loesungsweg
- Diagnoseverdichtung
- automatische Klassifikation
- semantische Zusammenfassungen
- implizite Verknuepfungen zu weiteren Objekten

## Konservative Statuszuordnung
- `open` = Punkt erkannt und noch offen
- `blocked` = Punkt offen und blockiert Bearbeitung
- `resolved` = Punkt fachlich erledigt oder geschlossen
- Standardfall ohne expliziten Blocker oder Abschluss: `open`

## Scope-Grenzen
- nur Herkunft, Mapping und Source-of-Truth
- nur reale Produktmomente als Quelle
- bevorzugt `specRef`, alternativ `intakeRef`
- keine neue API
- keine Persistenzmigration
- keine neue UI
- kein neuer Screen
- keine grossen Refactorings
- keine Provider-Primärquelle
- kein Ausbau zum Issue-System
