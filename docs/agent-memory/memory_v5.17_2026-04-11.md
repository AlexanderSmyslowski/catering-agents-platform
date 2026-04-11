# memory snapshot

source: memory.md
version: 5.17
date: 2026-04-11
repo: AlexanderSmyslowski/catering-agents-platform
status: planning-ready

## Snapshot-Zweck
Versionierter Zwischenstand fuer Handoff, Rueckgriff und die konkrete Umsetzung von Stufe 6c.

## Eingefrorener Stand
- Governance-Pfad bis Stufe 6b umgesetzt und fachlich gruen / abnahmefaehig
- Konsolidierungsphase ohne neue Fachlogik
- `ApprovalRequestRecord` bleibt fuehrende Freigabewahrheit
- `SpecGovernanceStateRecord` bleibt Statusspur
- `SpecChangeSetRecord` bleibt Aenderungseinheit
- Finalize ist nicht gleich Freigabe
- naechster explizit beauftragter Schritt: Stufe 6c als kleiner UX-/Transparenzschritt

## Stufe 6c - konkreter Umsetzungsschritt
### Einordnung
- erster tatsaechlicher Umsetzungsschritt nach dem konsolidierten Stand 3a bis 6b
- bewusst klein und read-only
- keine neue Fachlogik, keine neue Persistenz, keine neuen API-Endpunkte
- `finalized` bleibt klar von `approved` getrennt

### Sichtbare UI-Textbausteine
- `open` -> `Offene Aenderung`
- `finalized` -> `Finalisierte Aenderung`
- `approved` -> `Freigegeben`
- `pending_reapproval` -> `Erneute Freigabe erforderlich`

Hinweistext:
- `Finalisiert ist nicht gleich freigegeben.`
- `Finalisiert` bedeutet: Der aktuelle Aenderungsschritt wurde abgeschlossen.
- `Freigegeben` bedeutet: Der Stand ist als freigegeben bestaetigt.
- `Erneute Freigabe erforderlich` bedeutet: Aenderungen liegen vor, die eine neue Freigabe erfordern.

### Minimal betroffene Bereiche
- bestehendes Governance-Callout in der UI
- bestehende Statusdarstellung oder Label-Zuordnung
- bestehende UI-Hilfsfunktion oder Mapping-Stelle fuer sichtbares Wording
- kleiner UI-Testbereich fuer Status-Einordnung

### Nicht betroffen
- Persistenzmodelle
- Backend-Fachlogik
- API-Endpunkte
- ChangeSet-/Approval-Datenstrukturen

### Kompakter Umsetzungsplan
UI:
- Governance-Callout lokalisieren
- sichtbare Statusbezeichnungen ergaenzen
- kurzen Hinweistext zur Trennung von `finalized` und `approved` einbauen
- keine neuen Interaktionen, Buttons oder Zustaende

Tests:
- `open` erscheint als offener Aenderungszustand
- `finalized` erscheint als finalisierte Aenderung
- `approved` erscheint als Freigabe
- `pending_reapproval` erscheint als erneute Freigabe
- Klarstellungshinweis ist vorhanden

### Scope-Kontrollliste
- kein neuer Endpunkt
- keine neue Persistenz
- keine neue Freigabelogik
- keine neuen Workflows
- nur klarere Lesbarkeit vorhandener Zustaende

## Weiter out of scope
- Snapshots / `lastHardApproved` als Fachausbau
- Hard-Approve
- Point-of-no-return-Ausbau
- ChangeItem-Persistenz
- ChangeItem-Anzeige
- weitere Governance-Workflows
- neue Persistenzsysteme / Prisma
