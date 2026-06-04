# PA38 LLM-Readiness Fixture-ProviderAdapter

Status: shared-core-Vertrag und Vertragstest, keine LLM-Runtime
Stand: 2026-06-05
Scope: fixture-only ProviderAdapter fuer synthetische Draft-Ein-/Ausgaben; kein Provider, keine Modellaufrufe, keine API, keine Persistenz, keine Migration, keine echten Daten und keine Schreibwirkung

## 1. Zweck

PA38 setzt den in der 10/10-Coding-Architektur benannten `ProviderAdapter` zuerst als rein synthetischen Fixture-Adapter um.

PA37 registriert Prompt-/Policy-/Schema-Artefakte, PA36 prueft Output-Kandidaten gegen Fixture-Erwartungen. PA38 verbindet beides ueber einen schmalen Adapter, der einen gueltigen synthetischen Input auf den passenden Fixture-Erwartungsoutput abbildet, ohne Prompt-Ausfuehrung oder echte Modellprovider.

Damit wird ein spaeterer synthetic-only Level-9-Pfad vorbereitbarer, ohne die Gates fuer Provider, Datenrahmen, Logging, Kosten oder Runtime-Schreibwirkung vorwegzunehmen.

## 2. Codeanker

- `shared-core/src/llm-readiness-provider-adapter.ts`
- `shared-core/src/llm-readiness-provider-adapter.js`
- `shared-core/src/llm-readiness-prompt-schema-registry.ts`
- `shared-core/src/llm-readiness-eval-harness.ts`

Der Adapter bleibt fixture-only. Er fuehrt keinen Prompt aus und spricht keinen externen Provider an.

## 3. Harte Grenzen

PA38 bleibt innerhalb derselben No-go-Linie wie PA26-PA37:

- keine LLM-Runtime,
- kein Provider,
- keine Secrets,
- keine Modellaufrufe,
- keine echten Daten,
- keine API,
- keine Persistenz oder Migration,
- keine Runtime-`ConversationSession`,
- keine Produktobjekt-Schreibwirkung,
- keine Tool-Orchestrierung mit Schreibwirkung.

## 4. Definition of Done

PA38 ist erfuellt, wenn:

- `FixtureOnlyLlmReadinessProviderAdapter` nur synthetische, validierte Inputs annimmt,
- der Adapter die registrierte `promptSchemaId` fuer den Input aufloest,
- nur passende synthetische Fixtures als Output-Kandidaten zurueckgegeben werden,
- ungueltige Inputs, falsche `promptSchemaId`s und nicht gematchte Inputs als Fehler sichtbar werden,
- `tests/pa38-llm-readiness-fixture-provider-adapter.test.ts` gruen ist,
- `npm run build` gruen ist.
