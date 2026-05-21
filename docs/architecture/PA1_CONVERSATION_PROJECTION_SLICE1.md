# PA1 ConversationSession / ConversationProjection Slice 1

Status: umgesetzt als minimale read-only Projection-Grenze
Datum: 2026-05-21
Scope: bestehende Produktionsdaten als Session-nahe Chat-Projektion, ohne neue Persistenz

## Umgesetzt

- `shared-core/src/conversation-projection.ts` und Runtime-Sibling `.js` definieren eine kleine `ProductionConversationProjection`.
- Die Projection ordnet vorhandene Daten in klare Message-Typen:
  - `system_agent_hint`
  - `structured_agent_question`
  - `user_structured_answer`
  - `production_output_anchor`
- `/produktion` zeigt die Projection als read-only ConversationSession-Anker und nutzt sie im strukturierten Chatfluss.
- Tests belegen die Projection-Grenze und den sichtbaren UI-Anker.

## Architekturgrenzen

- Keine neue Datenbankmigration.
- Keine Conversation-Persistenz.
- Keine neue API.
- Keine freie Chat-Eingabe.
- Keine LLM-Orchestrierung oder echte LLM-Antwort.
- Keine neue PDF-/OCR-/Parserlogik.
- Keine Rezeptgenerierung und keine Allergenlogik.

## Führende Produktobjekte bleiben

- `AcceptedEventSpec`
- `ProductionPlan`
- `PurchaseList`
- vorhandene Exportanker
- vorhandene Audit-/Operator-Spuren

Die Projection ersetzt diese Objekte nicht, sondern bildet sie nur als geordneten Session-/Chat-Verlauf ab.

## Nächster enger Slice

PA2 sollte nicht direkt weitere UI-Magie bauen, sondern die Source-/Provenance-Metadaten für bestehende Uploads minimal nachziehen oder als ADR schärfen: Hash, Dateiname, MIME, Größe und Ingestion-Zeitpunkt entlang vorhandener Uploadpfade, ohne neue Parser-Engine und ohne neue Persistenzwelt.
