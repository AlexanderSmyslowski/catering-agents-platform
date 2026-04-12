# memory snapshot

source: memory.md
version: 5.45
date: 2026-04-11
repo: AlexanderSmyslowski/catering-agents-platform
status: m1-25-openissuerecord-adapter-implemented

## Snapshot-Zweck
Versionierter Zwischenstand fuer Handoff und Rueckgriff: in Phase M1.25 ist der kleinste interne `OpenIssueRecord`-Adapter umgesetzt.

## Tatsaechlich umgesetzte Aenderungen
- In `intake-service/src/app.ts` wurde ein kleiner interner `OpenIssueRecord`-Adapter ergaenzt: `deriveOpenIssueRecordFromIntakeContext(...)`
- Die Funktion leitet aus einem echten offenen Hinweis im Intake-/Spec-Kontext einen Minimal-`OpenIssueRecord` ab.
- Sie fuellt nur:
  - `id`
  - `status`
  - `title`
  - `sourceRef`
  - `specRef`
- Sie gibt `null` zurueck, wenn kein echtes Issuesignal vorliegt.
- Im bestehenden manuellen Intake-Pfad wird der Adapter intern genutzt.
- Bei einem Treffer wird nur ein interner Audit-Hinweis geschrieben.
- In `tests/platform.test.ts` wurde eine kleine Absicherung fuer den positiven Fall ergaenzt.

## Betroffene Dateien
- `intake-service/src/app.ts`
- `tests/platform.test.ts`

## Warum der Schritt im Scope bleibt
- nur interner Adapter im bestehenden Intake-Handler
- keine API-Aenderung
- keine Persistenzmigration
- keine neue UI
- kein neuer Screen
- keine grossen Refactorings
- keine Provider-Abhaengigkeit als Primaerquelle
- kein Ausbau zu einem vollstaendigen Issue-System

## Einordnung
- `OpenIssueRecord` hat jetzt seinen ersten realen internen Adapter.
- Der naechste sinnvolle Schritt ist eher eine zweite kleine interne Nutzung an einem weiteren realen Intake-Moment als mehr Testtiefe.
