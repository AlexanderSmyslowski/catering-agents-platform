# PA31 LLM-Readiness SourceRef-Validation

Status: shared-core-Vertrag und Vertragstest, keine LLM-Runtime
Stand: 2026-06-01
Scope: Runtime-Allowlist fuer LLM-Readiness-SourceRefs; kein Provider, keine Secrets, keine Modellaufrufe, keine API, keine Persistenz, keine Migration, keine echten Daten und keine Schreibwirkung

## 1. Zweck

PA31 haertet die Quellanker-Grenze der LLM-Readiness-Vertraege.

Vor PA31 musste ein `sourceRef` nur ein nicht-leeres `objectId` und irgendeinen String als `objectType` tragen. PA31 macht daraus eine explizite Allowlist:

- `accepted_event_spec`
- `production_plan`
- `purchase_list`
- `conversation_projection`
- `safe_source_anchor`

Damit bleiben Model-Input-, Model-Output- und Eval-Fixture-Kandidaten auf bekannte, sichere Arbeitsbelegtypen begrenzt.

## 2. Codeanker

- `shared-core/src/llm-readiness.ts`
- `shared-core/src/llm-readiness.js`

Der Code exportiert:

- `llmReadinessSourceObjectTypes`
- `LlmReadinessSourceObjectType`

Die bestehenden Validatoren `validateLlmReadinessModelInputCandidate(...)`, `validateLlmReadinessModelOutputCandidate(...)` und `validateLlmReadinessEvalFixture(...)` nutzen diese Allowlist indirekt.

## 3. Harte Grenzen

PA31 bleibt innerhalb derselben No-go-Linie wie PA26-PA30:

- kein Provider,
- keine Provider-Secrets,
- keine Modellaufrufe,
- keine echten Daten,
- keine API,
- keine Persistenz oder Migration,
- keine Runtime-`ConversationSession`,
- keine Produktobjekt-Schreibwirkung,
- keine Tool-Orchestrierung mit Schreibwirkung.

## 4. Definition of Done

PA31 ist erfuellt, wenn:

- die erlaubten SourceRef-Objekttypen als Runtime-Konstante exportiert sind,
- Input- und Output-Kandidaten mit unbekannten SourceRef-Typen abgelehnt werden,
- die bestehenden PA27/PA30-Fixtures weiterhin gueltig sind,
- `tests/pa31-llm-readiness-source-ref-validation.test.ts` gruen ist,
- `npm run build` gruen ist.
