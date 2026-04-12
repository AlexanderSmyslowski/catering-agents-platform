# memory snapshot

source: memory.md
version: 5.44
date: 2026-04-11
repo: AlexanderSmyslowski/catering-agents-platform
status: m1-19-to-m1-23-openissuerecord-defined

## Snapshot-Zweck
Versionierter Zwischenstand fuer Handoff und Rueckgriff: `OpenIssueRecord` ist als zweiter minimaler Owned-Memory-Anker fachlich definiert, inklusive Minimalform, Herkunftsregeln, Prototyp-Schnitt und erstem Mapping-Entwurf.

## Kernaussage
- `OpenIssueRecord` ist der richtige zweite kleine Owned-Memory-Anker nach `SpecRecord`.
- Er bleibt klein, referenzierbar und eng an `SpecRecord` oder alternativ den Intake-Kontext gebunden.
- Kein Issue-System, keine Aussenwirkung, keine neue API, keine Persistenz, keine UI.

## M1.19 - Begruendung als zweiter Anker
- `SpecRecord` deckt die spezifikationsnahe Kernwahrheit bereits ab.
- Der naechste echte Produktwert liegt in offenen Punkten, Blockern und Nacharbeiten.
- `OpenIssueRecord` ergaenzt diese operative Luecke, ohne `SpecRecord` weiter aufzublaehen.

## M1.20 - Minimalform
### Minimalobjekt
- `id`
- `status`
- `title`
- `sourceRef`
- `specRef` oder `intakeRef`

### Pflichtfelder
- `id`
- `status`
- `title`
- `sourceRef`
- genau eine fachliche Referenz: `specRef` oder `intakeRef`

### Kleinste Statusmenge
- `open`
- `blocked`
- `resolved`

## M1.21 - Herkunfts- und Source-of-Truth-Regeln
### Legitime Entstehungsmomente
- im Intake festgestellter offener Punkt
- klar benannter Blocker in der Spec-Bearbeitung
- konkrete Nacharbeitsnotiz zu einer Spezifikation
- produktiver Rueckfragepunkt, der die Spec nicht sofort abschliesst

### Bezugsregel
- bevorzugt `specRef`
- alternativ frueh im Prozess `intakeRef`
- nie beide als gleichrangige Primaerquelle
- nie ohne klare Referenz

### Direkt aus realen Quellen
- `id`
- `sourceRef`
- `specRef` oder `intakeRef`
- `title`
- `status`

## M1.22 - Erster Prototyp-Schnitt
- erster realistisch speisender Produktpfad: bestehender Intake-/Normalisierungs-/Validierungspfad
- kleinster Adapterpfad: direkt neben dem bestehenden `SpecRecord`-Anker in `intake-service/src/app.ts`
- erster Prototyp bleibt primär lesend und diagnostisch

## M1.23 - Erster Mapping-Entwurf
### Konkreter offener Produktmoment
- ein klar benannter Blocker
- eine konkrete Nacharbeitsnotiz
- eine offene Rueckfrage, die bei der Spec-Bearbeitung sichtbar bleibt

### Minimales Mapping
- `id`: aus stabiler, produktnaher Herkunftskennung des offenen Punkts
- `status`: konservativ `open` als Standard, `blocked` nur bei explizitem Blocker, `resolved` nur bei eindeutigem Abschluss
- `title`: direkt aus der kurzen Benennung des offenen Punkts oder Blockers
- `sourceRef`: aus der echten Herkunft im Intake-/Spec-Kontext
- `specRef` oder alternativ `intakeRef`: genau eine primaere Bindung

## Scope-Grenzen
- kein Ausbau zu einem vollstaendigen Issue-System
- keine neue API
- keine Persistenzmigration
- keine neue UI
- kein neuer Screen
- keine grossen Refactorings
- keine Provider-Primärquelle
