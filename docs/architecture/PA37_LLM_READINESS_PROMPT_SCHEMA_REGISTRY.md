# PA37 LLM-Readiness Prompt-/Schema-Registry

Status: shared-core-Vertrag und Vertragstest, keine LLM-Runtime
Stand: 2026-06-04
Scope: schema-only Prompt-/Policy-/Schema-Registry fuer synthetische Draft-Kontrakte; kein Provider, keine Modellaufrufe, keine API, keine Persistenz, keine Migration, keine echten Daten und keine Schreibwirkung

## 1. Zweck

PA37 setzt den in der 10/10-Coding-Architektur noch offenen Prompt-/Schema-Registry-Anker als kleinen shared-core-Vertrag um.

PA28 registriert Draft-Kontrakte, PA27/PA35/PA36 registrieren und pruefen synthetische Fixtures. PA37 legt zusaetzlich versionierte Prompt-, Policy- und Output-Schema-Artefakte pro Draft-Kontrakt fest, ohne schon Prompttext oder Provider-Ausfuehrung einzufuehren.

Damit wird die spaetere synthetic-only Provider-Anbindung vorbereitbarer, ohne die harte No-go-Linie fuer Provider, echte Daten oder Runtime-Schreibwirkung zu verletzen.

## 2. Codeanker

- `shared-core/src/llm-readiness-prompt-schema-registry.ts`
- `shared-core/src/llm-readiness-prompt-schema-registry.js`
- `shared-core/src/llm-readiness-draft-registry.ts`

Die Registry bleibt schema-only. Sie enthaelt keine Prompttexte, keine Nachrichtenverlaeufe und keine Provider-Konfiguration.

## 3. Harte Grenzen

PA37 bleibt innerhalb derselben No-go-Linie wie PA26-PA36:

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

PA37 ist erfuellt, wenn:

- jeder registrierte Draft-Kontrakt genau einen schema-only Prompt-/Policy-/Schema-Eintrag hat,
- `promptArtifactId`, `promptVersion`, `policyArtifactId`, `policyVersion` und `outputSchemaId` als testbare Artefakt-IDs vorliegen,
- Fixture-Referenzen und Tool-/SourceRef-Grenzen mit den bestehenden Draft-Kontrakten konsistent bleiben,
- keine Prompttexte, Provider-, Secret- oder Toolcall-Payloads in der Registry auftauchen,
- `tests/pa37-llm-readiness-prompt-schema-registry.test.ts` gruen ist,
- `npm run build` gruen ist.
