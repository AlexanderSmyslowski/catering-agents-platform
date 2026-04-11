# memory snapshot

source: memory.md
version: 5.20
date: 2026-04-11
repo: AlexanderSmyslowski/catering-agents-platform
status: pre-6c-read-step-implemented

## Snapshot-Zweck
Versionierter Zwischenstand fuer Handoff und Rueckgriff: der vorgelagerte Mini-Read-Schritt vor Stufe 6c ist umgesetzt.

## Kernaussage
- Stufe 6c selbst ist weiterhin noch nicht umgesetzt.
- Der vorgelagerte Mini-Schritt zur Read-Vervollstaendigung wurde umgesetzt.
- Damit ist die Voraussetzung geschaffen, Governance-Daten kuenftig im bestehenden Spec-Read-Pfad mitzufuehren.

## Umgesetzter Mini-Read-Schritt
### Konkrete Aenderungen
- `shared-core/src/types.ts`
  - `AcceptedEventSpec` um `governance?: Record<string, unknown>` erweitert
- `shared-core/src/schemas/accepted-event-spec.ts`
  - optionales Top-Level-Feld `governance` ergaenzt
  - Schema dafuer: `type: object`, `additionalProperties: true`

### Nicht geaendert
- `backoffice-ui/src/App.tsx`
- `backoffice-ui/src/api.ts`
- keine sichtbare UI-Anzeige
- keine neuen Mappings
- keine neue Fachlogik
- keine neue Freigabelogik
- keine neue Persistenzlogik

## Warum das noch nicht Stufe 6c ist
- Es wird nur ein optionales Read-Feld transportfaehig gemacht.
- Es gibt noch keine sichtbare UI-Einordnung, keine Texte und keine Statusdarstellung.
- Die Zustaende `open`, `finalized`, `approved`, `pending_reapproval` werden noch nicht angezeigt oder gemappt.
- Damit ist dieser Schritt nur die Voraussetzung fuer Stufe 6c, nicht Stufe 6c selbst.

## Testrahmen fuer den Mini-Read-Schritt
- einen Spec mit `governance` erzeugen oder direkt validieren
- ueber `IntakeStore.saveSpec(...)` speichern
- ueber `listSpecs()` oder `getSpec(...)` wieder auslesen
- pruefen, dass `governance` unveraendert vorhanden ist
- optional: `GET /v1/intake/specs` testen und im UI-Load-Pfad pruefen, dass das Feld im `acceptedSpecs`-Array ankommt

## Risiken
- Speichervorgang koennte bei Schema-Validation scheitern
- bestehende Specs koennten bei unguenstiger Behandlung an Validierung scheitern
- harte Nicht-Optionalitaet wuerde partielle Daten unnoetig blockieren
- spaetere Erweiterungen waeren unnoetig eingeschraenkt, falls das Subobjekt doch zu eng validiert wuerde

## Naechster sauberer Schritt
- jetzt erst die eigentliche Stufe 6c angehen
- nur read-only UI-/Transparenzschritt im bestehenden Block `Operative Uebergabe`
- nur falls die benoetigten Governance-Rohwerte im realen Response-Pfad jetzt bereits sichtbar ankommen
- keine neue Fachlogik
- keine neuen API-Endpunkte
- keine neue Persistenz
