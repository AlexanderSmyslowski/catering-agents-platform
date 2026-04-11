# memory snapshot

source: memory.md
version: 5.24
date: 2026-04-11
repo: AlexanderSmyslowski/catering-agents-platform
status: stage-6d-implemented

## Snapshot-Zweck
Versionierter Zwischenstand fuer Handoff und Rueckgriff: Stufe 6d ist als kleiner Read-Qualitaets- und Typisierungsschritt umgesetzt.

## Kernaussage
- Stufe 6d ist umgesetzt.
- Die sichtbare UX aus Stufe 6c bleibt unveraendert.
- `spec.governance` wurde von einem freien `Record<string, unknown>` auf ein kleines explizites Read-Modell gehaertet.
- Es wurden keine neue Fachlogik, keine neue Freigabelogik, keine neue Persistenzlogik und keine neue UI-Flaeche eingefuehrt.

## Tatsaechlich umgesetzte Aenderungen
- `shared-core/src/types.ts`
  - neues `GovernanceReadModel` eingefuehrt
  - `AcceptedEventSpec.governance` auf dieses Modell umgestellt
- `shared-core/src/schemas/accepted-event-spec.ts`
  - `governance` im bestehenden Spec-Schema als optionales Objekt mit genau den vier bekannten Keys typisiert
- `backoffice-ui/src/api.ts`
  - `acceptedSpecs` im `DashboardState` auf `AcceptedEventSpec[]` umgestellt
  - Read-Pfad fuer `/intake/specs` darauf typisiert
- `backoffice-ui/src/App.tsx`
  - Governance-Helper auf `GovernanceReadModel` umgestellt
  - sichtbare 6c-Ausgabe unveraendert belassen

## Betroffene Dateien
- `shared-core/src/types.ts`
- `shared-core/src/schemas/accepted-event-spec.ts`
- `backoffice-ui/src/api.ts`
- `backoffice-ui/src/App.tsx`

## Warum der Schritt klar in 6d bleibt
- nur Read-Rahmen gehaertet
- keine neuen Zustaende
- keine neue UI-Flaeche
- keine Ableitung oder Berechnung von Governance-Zustaenden
- 6c bleibt inhaltlich identisch; nur der Datenvertrag ist jetzt sauberer und expliziter

## Sinnvoller kleiner Check
- ein kurzer Kompatibilitaets- und Validierungscheck mit:
  - mindestens einem Spec ohne `governance`
  - mindestens einem Spec mit allen vier Governance-Feldern
- Ziel: bestaetigen, dass der optionale Read-Pfad rueckwaertskompatibel bleibt und die 6c-Anzeige weiter nur lesend arbeitet

## Naechster sinnvoller Schritt
- kleiner Kompatibilitaets-/Validierungscheck fuer 6d
- keine automatische Ausweitung auf neue Governance-Stufen
