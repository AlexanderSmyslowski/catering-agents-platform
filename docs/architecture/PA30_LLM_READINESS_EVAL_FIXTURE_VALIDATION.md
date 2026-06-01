# PA30 LLM-Readiness Eval-Fixture-Validation

Status: shared-core-Vertrag und Vertragstest, keine LLM-Runtime
Stand: 2026-06-01
Scope: zentrale Validierung synthetischer Eval-Fixtures gegen PA26-PA29; kein Provider, keine Secrets, keine Modellaufrufe, keine API, keine Persistenz, keine Migration, keine echten Daten und keine Schreibwirkung

## 1. Zweck

PA30 macht die bisher verteilte Pruefung der LLM-Readiness-Fixtures zu einem kleinen pure-function-Vertrag.

Der Validator prueft ein Eval-Fixture gegen:

- den PA29-Input-Validator,
- den PA26-Output-Validator,
- die PA28-Draft-Registry,
- die gemeinsame Forbidden-Payload-Key-Liste,
- synthetische Fixture-IDs und sichere SourceRefs.

Er baut keinen Prompt, ruft keinen Provider auf, fuehrt kein Tool aus und schreibt keine Produktobjekte.

## 2. Codeanker

- `shared-core/src/fixtures/llm-readiness-eval-fixtures.ts`
- `shared-core/src/fixtures/llm-readiness-eval-fixtures.js`

Der Code exportiert:

- `LlmReadinessEvalFixtureValidation`
- `validateLlmReadinessEvalFixture(...)`

## 3. Gepruefte Grenzen

Ein Fixture ist nur gueltig, wenn:

- der Input providerlos und synthetisch/Demo-only bleibt,
- der Output ein Human-Approval-Draft ohne Schreibwirkung bleibt,
- Input-Kind und Output-Kind zum registrierten Draft-Kontrakt passen,
- die erforderlichen Quellobjekttypen in Input und erwartetem Output enthalten sind,
- die erlaubten Tool-Effekte exakt zum Draft-Kontrakt passen,
- keine Rohtext-, Prompt-, Provider-, Secret- oder Toolcall-Payloads auftauchen.

## 4. Harte Grenzen

PA30 bleibt innerhalb derselben No-go-Linie wie PA26-PA29:

- kein Provider,
- keine Provider-Secrets,
- keine Modellaufrufe,
- keine echten Daten,
- keine API,
- keine Persistenz oder Migration,
- keine Runtime-`ConversationSession`,
- keine Produktobjekt-Schreibwirkung,
- keine Tool-Orchestrierung mit Schreibwirkung.

## 5. Definition of Done

PA30 ist erfuellt, wenn:

- alle bestehenden PA27-Fixtures durch `validateLlmReadinessEvalFixture(...)` gueltig sind,
- unregistrierte Input-/Output-Kombinationen abgelehnt werden,
- Provider-, Echtdaten-, Write-Tool- und Rohpayload-Verletzungen abgelehnt werden,
- fehlende required SourceRefs in Input oder erwartetem Output abgelehnt werden,
- `tests/pa30-llm-readiness-eval-fixture-validation.test.ts` gruen ist,
- `npm run build` gruen ist.
