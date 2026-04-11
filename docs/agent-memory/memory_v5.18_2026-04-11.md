# memory snapshot

source: memory.md
version: 5.18
date: 2026-04-11
repo: AlexanderSmyslowski/catering-agents-platform
status: read-gap-confirmed

## Snapshot-Zweck
Versionierter Zwischenstand fuer Handoff, Rueckgriff und den belegten Read-Pfad-Befund vor der eigentlichen UI-Umsetzung von Stufe 6c.

## Eingefrorener Stand
- Governance-Pfad bis Stufe 6b umgesetzt und fachlich gruen / abnahmefaehig
- Stufe 6c bleibt fachlich als kleiner UX-/Transparenzschritt definiert
- die eigentliche UI-Umsetzung von Stufe 6c ist im aktuellen Repo-Stand noch nicht direkt moeglich
- Grund: die benoetigten Governance-Zustaende kommen im aktuellen Read-Pfad nicht im UI an

## Bestaetigter UI-Anker fuer spaetere Stufe 6c
- `backoffice-ui/src/App.tsx`
- dort der Block `Operative Uebergabe`
- dieser Block ist der kleinste reale bestehende UI-Kontext fuer eine spaetere Governance-/Uebergabe-Anzeige
- aktuell wird dort nur `specId` und `spec.readiness.status` genutzt

## Bestaetigter Read-Pfad
- `App.tsx` befuellt den Stand ueber `loadDashboardState()`
- `backoffice-ui/src/api.ts` holt `acceptedSpecs` aus `GET /api/intake/v1/intake/specs`
- `intake-service/src/app.ts` liefert diesen Endpoint
- `intake-service/src/store.ts` liest aus der PersistentCollection `intake/specs`

## Bestaetigtes aktuelles Read-Shape
- aktuelles Shape ist ein `AcceptedEventSpec` aus `shared-core`
- relevante vorhandene Felder im UI-Pfad sind derzeit insbesondere:
  - `specId`
  - `readiness`
  - darunter im UI konkret `readiness.status`
- die Zielzustaende `open`, `finalized`, `approved`, `pending_reapproval` sind in diesem Read-Shape aktuell nicht vorhanden

## Fachlicher Befund
- Die benoetigten Governance-Zustaende fehlen nicht nur in der UI, sondern im gelieferten Read-Shape selbst.
- Damit ist Stufe 6c im aktuellen Repo-Stand nicht als reine UI-Aenderung vertretbar.
- Vor Stufe 6c ist ein vorgelagerter Mini-Schritt zur Read-Vervollstaendigung noetig.

## Kleinster vorgelagerter Mini-Schritt
- den Spec-Read-Pfad um ein optionales Governance-/Workflow-Subobjekt erweitern
- dieses nur lesend und ohne neue Fachlogik durchreichen:
  - Backend-Read-Shape
  - `api.ts`
  - `App.tsx`
- keine Berechnung neuer Status im UI
- keine neue Persistenzlogik in diesem Schritt
- keine neue Freigabelogik

## Saubere Einordnung
- Dieser Mini-Schritt ist nicht die eigentliche Stufe 6c.
- Er ist die minimale vorgelagerte Read-Vervollstaendigung, damit Stufe 6c spaeter als reiner Anzeige-Schritt sauber umgesetzt werden kann.

## Weiter out of scope
- Hard-Approve
- Snapshots / `lastHardApproved` als Fachausbau
- Point-of-no-return-Ausbau
- ChangeItem-Persistenz
- ChangeItem-Anzeige
- zusaetzliche Governance-Workflows
- neue Persistenzsysteme / Prisma
