# memory snapshot

source: memory.md
version: 5.19
date: 2026-04-11
repo: AlexanderSmyslowski/catering-agents-platform
status: pre-6c-read-step-defined

## Snapshot-Zweck
Versionierter Zwischenstand fuer Handoff und Rueckgriff: der vorgelagerte Mini-Schritt vor Stufe 6c ist jetzt fachlich sauber definiert.

## Kernaussage
- Stufe 6c bleibt ein kleiner UX-/Transparenzschritt im bestehenden UI.
- Sie ist im aktuellen Repo-Stand noch nicht direkt umsetzbar, weil die benoetigten Governance-Zustaende im Read-Pfad fehlen.
- Vorher braucht es einen minimalen Read-Schritt.

## Fachliche Einordnung des Mini-Schritts
- keine neue Governance-Fachlogik
- nur Read-Voraussetzung fuer Stufe 6c
- Governance-Zustaende sollen als reine Lesedaten bis ins Backoffice-UI durchgereicht werden
- UI interpretiert oder mappt in diesem Schritt noch nichts
- Stufe 6c selbst beginnt erst danach mit der sichtbaren Einordnung im Block `Operative Uebergabe`

## Kleinste moegliche Read-Ergaenzung
- optionales Governance-Subobjekt pro Spezifikation im bestehenden `acceptedSpecs`-Read-Shape
- Transport der relevanten Governance-Zustaende als Rohwerte
- unveraendert durchreichen
- nicht berechnen
- nicht ableiten
- nicht mit anderen Statussystemen vermischen

## Minimal betroffene Dateien oder Modulbereiche
- `backoffice-ui/src/api.ts`
- `backoffice-ui/src/App.tsx`
- `intake-service/src/app.ts`
- `intake-service/src/store.ts`
- nur falls noetig fuer Typisierung: `shared-core/src/types.ts`

## Kompakter Umsetzungsrahmen
Backend:
- bestehendes `/v1/intake/specs`-Shape um ein optionales Governance-Read-Feld erweitern oder dieses Feld durchreichen
- keine neue Berechnungslogik

UI-API:
- in `api.ts` den Load-Pfad und ggf. Typen so ergaenzen, dass das neue Feld mitkommt
- noch keine Darstellung

UI:
- in `App.tsx` hoechstens Datenstruktur vorbereiten
- keine Anzeige
- keine Texte
- keine Mappings fuer Stufe 6c

Tests:
- nur pruefen, dass das neue Feld im Load-Pfad ankommt und nicht verloren geht
- noch keine UI-Aussage zu `finalized` vs `approved`

## Kontrollliste
- keine neue Statuszeile im Block `Operative Uebergabe`
- keine sichtbare Einordnung von `open`, `finalized`, `approved`, `pending_reapproval`
- `finalized` ist noch nicht sprachlich von `approved` getrennt dargestellt
- nichts wird aus dem Read-Feld interpretiert oder gemappt
- Aenderung endet bei Datentransport und Typisierung
- es entsteht kein neuer Governance-Callout

## Weiter out of scope
- Hard-Approve
- Snapshots / `lastHardApproved` als Fachausbau
- Point-of-no-return-Ausbau
- ChangeItem-Persistenz
- ChangeItem-Anzeige
- zusaetzliche Governance-Workflows
- neue Persistenzsysteme / Prisma
