# PA27 LLM-Readiness Eval-Fixtures

Status: shared-core-Fixtures und Vertragstest, keine LLM-Runtime
Stand: 2026-06-01
Scope: synthetische Erwartungsanker fuer PA26; kein Provider, keine Secrets, keine Modellaufrufe, keine API, keine Persistenz, keine Migration, keine echten Daten und keine Schreibwirkung

## 1. Zweck

PA27 legt erste synthetische Eval-Fixtures fuer den PA26-Vertrag an.

Sie dienen spaeter als sichere Erwartungsfaelle, bevor ein Prompt, Provider oder Tool-Runner ueberhaupt entschieden wird.

## 2. Codeanker

- `shared-core/src/fixtures/llm-readiness-eval-fixtures.ts`
- `shared-core/src/fixtures/llm-readiness-eval-fixtures.js`

Die Fixtures exportieren:

- `llmReadinessEvalFixtures`
- `LlmReadinessEvalFixture`

## 3. Enthaltene synthetische Faelle

### Kaffeepause mit fehlender Personenzahl

Ziel:

- ein `clarification_draft_request` aus synthetischem Kontext,
- erwarteter `clarification_question_draft`,
- Human Approval erforderlich,
- keine Schreibwirkung auf `AcceptedEventSpec`.

### Buffet Operator Summary

Ziel:

- ein `operator_summary_request` aus vorhandenen synthetischen Produktobjekt-Referenzen,
- erwarteter `operator_summary_draft`,
- nur `read` als Tool-Effekt,
- keine Produktobjekt-Schreibwirkung.

## 4. Harte Grenzen

Die Fixtures duerfen keine echten Daten enthalten und keine dieser Payloads transportieren:

- `rawText`
- `extractedText`
- `prompt`
- `messages`
- `providerResponse`
- `toolCalls`
- `secret`
- `apiKey`

Jeder erwartete Output muss durch `validateLlmReadinessModelOutputCandidate(...)` gueltig sein.

## 5. Definition of Done

PA27 ist erfuellt, wenn:

- die Fixtures nur synthetische IDs und Labels nutzen,
- jeder Input `providerCalls: "disabled"` und `dataMode: "synthetic_or_demo_only"` traegt,
- alle erwarteten Outputs Human Approval verlangen,
- alle erwarteten Outputs `writesProductObject: false` tragen,
- keine verbotenen Roh-/Prompt-/Provider-/Secret-/Toolcall-Payloads vorkommen,
- `tests/pa27-llm-readiness-eval-fixtures.test.ts` gruen ist,
- `npm run build` gruen ist.
