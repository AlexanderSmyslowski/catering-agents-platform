# PA29 LLM-Readiness Input-Validation

Status: shared-core-Vertrag und Vertragstest, keine LLM-Runtime
Stand: 2026-06-01
Scope: Validierung von Model-Input-Kandidaten fuer PA26/PA27/PA28; kein Provider, keine Secrets, keine Modellaufrufe, keine API, keine Persistenz, keine Migration, keine echten Daten und keine Schreibwirkung

## 1. Zweck

PA29 macht die Input-Seite des LLM-Readiness-Vertrags pruefbar.

Der Validator akzeptiert nur schema-nahe Kandidaten, die:

- den PA26-Vertrag nutzen,
- eine bekannte Draft-Input-Art haben,
- sichere Quellen referenzieren,
- Provider-Aufrufe deaktiviert lassen,
- nur synthetische oder Demo-Daten deklarieren,
- keine Write-Tool-Effekte erlauben,
- keine Roh-, Prompt-, Provider-, Secret- oder Toolcall-Payloads tragen.

Er fuehrt keinen Provider aus, baut keinen Prompt, ruft kein Modell auf, oeffnet keine API und schreibt keine Produktobjekte.

## 2. Codeanker

- `shared-core/src/llm-readiness.ts`
- `shared-core/src/llm-readiness.js`

Der Code exportiert:

- `LlmReadinessModelInputValidation`
- `validateLlmReadinessModelInputCandidate(...)`

## 3. Erlaubte Input-Policy

Erlaubt sind nur:

- `providerCalls: "disabled"`
- `dataMode: "synthetic_or_demo_only"`
- `allowedToolEffects: ["read"]`
- `allowedToolEffects: ["read", "draft"]`

`write` bleibt fuer Input-Kandidaten in dieser Phase unzulaessig.

## 4. Harte Grenzen

PA29 bleibt innerhalb derselben No-go-Linie wie PA26-PA28:

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

PA29 ist erfuellt, wenn:

- alle PA27-Fixture-Inputs valide sind,
- unbekannte Input-Arten abgelehnt werden,
- echte Daten- oder Provider-Policies abgelehnt werden,
- `write` als erlaubter Tool-Effekt abgelehnt wird,
- Roh-, Prompt-, Provider-, Secret- und Toolcall-Payloads abgelehnt werden,
- `tests/pa29-llm-readiness-input-validation.test.ts` gruen ist,
- `npm run build` gruen ist.
