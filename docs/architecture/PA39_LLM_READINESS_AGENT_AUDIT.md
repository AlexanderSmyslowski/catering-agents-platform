# PA39 LLM-Readiness AgentAudit

Status: shared-core-Vertrag und Vertragstest, keine LLM-Runtime
Stand: 2026-06-05
Scope: providerloser AgentAudit-Anker fuer synthetische Draft-Laeufe; kein Provider, keine Modellaufrufe, keine API, keine Persistenz, keine Migration, keine echten Daten und keine Schreibwirkung

## 1. Zweck

PA39 setzt auf PA38 auf und verankert den kleinsten nachvollziehbaren `AgentAudit`-Baustein fuer spaetere modellgestuetzte Draft-Laeufe.

PA37 registriert Prompt-/Policy-/Schema-Artefakte, PA38 liefert fixture-only Antworten. PA39 verdichtet diese Informationen in einen kleinen Audit-Datensatz, der Input-Korridor, Prompt-Schema, Adapter-Modus, Human-Approval-Grenze und Fehlerstatus festhaelt, ohne bereits eine Runtime-`ConversationSession`, Provider-Calls oder Schreibwirkung einzufuehren.

Damit wird der naechste 10/10-Schritt Richtung echter Agentenfaehigkeit klarer, ohne Provider-, Daten-, Kosten-, Logging- oder Runtime-Gates vorwegzunehmen.

## 2. Codeanker

- `shared-core/src/llm-readiness-agent-audit.ts`
- `shared-core/src/llm-readiness-agent-audit.js`
- `shared-core/src/llm-readiness-provider-adapter.ts`
- `shared-core/src/llm-readiness-prompt-schema-registry.ts`

Der Audit-Anker bleibt rein synthetisch und schema-nah. Er baut nur auf dem bestehenden PA26-PA38-Vertragsstrang auf.

## 3. Harte Grenzen

PA39 bleibt innerhalb derselben No-go-Linie wie PA26-PA38:

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

PA39 ist erfuellt, wenn:

- `createLlmReadinessAgentAuditRecord(...)` aus gueltigem Request/Response einen kleinen Audit-Datensatz bauen kann,
- der Audit-Datensatz Prompt-/Policy-/Schema-Metadaten, Adapter-Modus, SourceRefs, Approval-/Write-Grenzen und Fehlerstatus traegt,
- `validateLlmReadinessAgentAuditRecord(...)` ungueltige Audit-Kandidaten ablehnt,
- erfolgreiche Fixture-Laeufe als `matched_fixture` und abgelehnte Laeufe als `rejected` sichtbar werden,
- `tests/pa39-llm-readiness-agent-audit.test.ts` gruen ist,
- `npm run build` gruen ist.
