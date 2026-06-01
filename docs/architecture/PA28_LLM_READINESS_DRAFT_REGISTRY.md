# PA28 LLM-Readiness Draft-Registry

Status: shared-core-Vertrag und Vertragstest, keine LLM-Runtime
Stand: 2026-06-01
Scope: schema-nahe Registry fuer erlaubte Draft-Kontrakte nach PA26/PA27; kein Provider, keine Secrets, keine Modellaufrufe, keine API, keine Persistenz, keine Migration, keine echten Daten und keine Schreibwirkung

## 1. Zweck

PA28 verbindet den PA26-Model-IO-Vertrag und die PA27-Eval-Fixtures ueber eine kleine Registry.

Die Registry beschreibt nur:

- welche Input-Kind zu welchem Draft-Output-Kind gehoert,
- welche Tool-Effekte in diesem Vertrag ohne Provider erlaubt sind,
- welche sicheren Quellobjekttypen erwartet werden,
- welche Payload-Schluessel verboten bleiben.

Sie enthaelt bewusst keine Prompttexte, keine Provider-Konfiguration, keine Modellaufrufe, keine Tool-Ausfuehrung und keine Schreibwirkung.

## 2. Codeanker

- `shared-core/src/llm-readiness-draft-registry.ts`
- `shared-core/src/llm-readiness-draft-registry.js`

Der Code exportiert:

- `llmReadinessDraftRegistryVersion`
- `llmReadinessDraftContracts`
- `findLlmReadinessDraftContractByInputKind(...)`

## 3. Enthaltene Draft-Kontrakte

### clarification-question-draft.v0

- Input: `clarification_draft_request`
- Output: `clarification_question_draft`
- Tool-Effekte: `read`, `draft`
- Quellen: `accepted_event_spec`
- Human Approval: erforderlich
- Schreibwirkung: ausgeschlossen

### operator-summary-draft.v0

- Input: `operator_summary_request`
- Output: `operator_summary_draft`
- Tool-Effekte: `read`
- Quellen: `accepted_event_spec`, `production_plan`, `purchase_list`
- Human Approval: erforderlich
- Schreibwirkung: ausgeschlossen

## 4. Harte Grenzen

PA28 bleibt innerhalb derselben No-go-Linie wie PA26/PA27:

- kein Provider,
- keine Provider-Secrets,
- keine Modellaufrufe,
- keine echten Daten,
- keine API,
- keine Persistenz oder Migration,
- keine Runtime-`ConversationSession`,
- keine Produktobjekt-Schreibwirkung,
- keine Tool-Orchestrierung mit Schreibwirkung.

Prompt-, Provider-, Secret-, Toolcall- und Rohpayload-Schluessel bleiben verboten.

## 5. Definition of Done

PA28 ist erfuellt, wenn:

- jeder PA26-Input-Kind genau einen Draft-Kontrakt hat,
- jeder PA26-Output-Kind genau einen Draft-Kontrakt hat,
- alle Kontrakte `schema_contract_only`, `providerCalls: "disabled"` und `dataMode: "synthetic_or_demo_only"` tragen,
- alle Kontrakte Human Approval verlangen und `writesProductObject: false` setzen,
- die PA27-Fixtures einem Registry-Kontrakt entsprechen,
- `tests/pa28-llm-readiness-draft-registry.test.ts` gruen ist,
- `npm run build` gruen ist.
