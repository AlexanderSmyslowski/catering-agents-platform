# PA3 Provenance-Anker in ProductionConversationProjection

Status: umgesetzt als minimale read-only Projection-Erweiterung
Datum: 2026-05-21
Scope: vorhandene Source-/Provenance-Metadaten als sichere Quellenanker in der Produktions-Conversation sichtbar machen

## Umgesetzt

- `ProductionConversationProjection` kennt zusätzlich den Message-Typ `source_provenance_anchor`.
- Quellenanker werden nur aus vorhandenen `sourceMetadata` an `sourceInputs` abgeleitet.
- Sichtbar sind nur sichere Metadaten:
  - Dateiname
  - MIME-Typ
  - Dateigröße
  - SHA-256-Kurzform
  - Upload-Kontext
  - Ingestion-Zeitpunkt
- `/produktion` gibt die bereits geladene ursprüngliche Intake-Anfrage read-only an die Projection weiter und zeigt den Quellenanker im bestehenden strukturierten Chatfluss.
- Tests belegen den Quellenanker mit vorhandener `sourceMetadata`, das stabile Verhalten ohne `sourceMetadata` und den sichtbaren UI-Anker ohne fragile Zeitwert-Assertion.

## Architekturgrenzen

- Keine neue API.
- Keine neue Persistenzwelt oder Migration.
- Keine neue Conversation-Persistenz.
- Kein neuer UI-Workflow.
- Keine LLM-, Tool-Use-, PDF-Parser-, OCR-, Rezept- oder Allergen-Implementierung.
- Keine Ausgabe von Rohinhalt oder extrahiertem Dokumenttext im Quellenanker.

## Führende Objekte bleiben

- `EventRequest.rawInputs[].sourceMetadata` als vorhandener Upload-/Dokument-Metadatenanker.
- `AcceptedEventSpec`, `ProductionPlan`, `PurchaseList` und vorhandene Export-/Audit-Spuren bleiben fachlich führend.

Die Projection bildet Provenance nur read-only ab und ersetzt keine Herkunfts-, Audit- oder Freigabelogik.
