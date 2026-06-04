# PA36 LLM-Readiness Eval-Harness

Status: shared-core-Vertrag und Vertragstest, keine LLM-Runtime
Stand: 2026-06-04
Scope: providerlose Eval-Harness-Validierung fuer synthetische Output-Kandidaten gegen gueltige Eval-Fixtures; kein Provider, keine Modellaufrufe, keine API, keine Persistenz, keine Migration, keine echten Daten und keine Schreibwirkung

## 1. Zweck

PA36 setzt den in der 10/10-Coding-Architektur bereits benannten Eval-Harness als kleinen shared-core-Vertrag um.

PA26 bis PA35 sichern Model-IO, Draft-Registry und synthetische Eval-Fixtures. PA36 vergleicht zusaetzlich einen synthetischen Output-Kandidaten gegen einen gueltigen Fixture-Erwartungsoutput.

Damit gibt es erstmals einen providerlosen, reproduzierbaren Pruefanker fuer spaetere synthetic-only Modellversuche, ohne schon einen Provider, Promptlauf oder Runtime-ConversationSession einzufuehren.

## 2. Codeanker

- `shared-core/src/llm-readiness-eval-harness.ts`
- `shared-core/src/llm-readiness-eval-harness.js`
- `shared-core/src/fixtures/llm-readiness-eval-fixtures.ts`

Der Harness bleibt rein validierend. Er erzeugt keine Runtime-Objekte und schreibt keine Produktdaten.

## 3. Harte Grenzen

PA36 bleibt innerhalb derselben No-go-Linie wie PA26-PA35:

- keine LLM-Runtime,
- kein Provider,
- keine Modellaufrufe,
- keine echten Daten,
- keine API,
- keine Persistenz oder Migration,
- keine Runtime-`ConversationSession`,
- keine Produktobjekt-Schreibwirkung,
- keine Tool-Orchestrierung mit Schreibwirkung.

## 4. Definition of Done

PA36 ist erfuellt, wenn:

- `validateLlmReadinessEvalOutputCandidateMatch(...)` nur gueltige Fixture-/Kandidatenpaare akzeptiert,
- `kind`, `sourceRefs`, `humanApprovalRequired`, `writesProductObject`, `structuredCandidate` und normalisierter Draft-Text gegen `expectedOutput` pruefbar sind,
- ungueltige Fixtures und ungueltige Kandidaten als Harness-Fehler sichtbar werden,
- `tests/pa36-llm-readiness-eval-harness.test.ts` gruen ist,
- `npm run build` gruen ist.
