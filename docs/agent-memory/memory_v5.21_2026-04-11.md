# memory snapshot

source: memory.md
version: 5.21
date: 2026-04-11
repo: AlexanderSmyslowski/catering-agents-platform
status: ready-for-stage-6c-ui

## Snapshot-Zweck
Versionierter Zwischenstand fuer Handoff und Rueckgriff: der Read-Pfad fuer das optionale Governance-Feld ist jetzt bis ins Backoffice-UI bestaetigt.

## Bestaetigter Befund
- `/v1/intake/specs` kann das optionale Feld `governance` jetzt enthalten
- `intake-service/src/app.ts` reicht `store.listSpecs()` als `items` durch
- `IntakeStore` speichert und liest `AcceptedEventSpec` unveraendert
- `backoffice-ui/src/api.ts` reicht `acceptedSpecs.items` unveraendert in den `DashboardState` durch
- in `backoffice-ui/src/App.tsx` ist das Feld im geladenen `spec` im Bereich `filteredSpecs.map((spec) => ...)` fuer den Block `Operative Uebergabe` lesbar verfuegbar

## Konsequenz
- Es fehlt im Read-Pfad nichts Wesentliches mehr
- Stufe 6c kann jetzt als reiner UI-Schritt freigegeben werden
- dieser UI-Schritt bleibt read-only und fuehrt keine neue Fachlogik ein

## Naechster Schritt
- sichtbare read-only Einordnung der vorhandenen Governance-Zustaende im bestehenden Block `Operative Uebergabe`
- klare Trennung von `finalized` und `approved`
- keine neuen API-Endpunkte
- keine neue Persistenz
- keine neue Freigabelogik
- keine Refactorings
