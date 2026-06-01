# PA32 LLM-Readiness StructuredCandidate-Validation

Status: shared-core-Vertrag und Vertragstest, keine LLM-Runtime
Stand: 2026-06-01
Scope: Runtime-Validation fuer strukturierte Draft-Kandidaten; kein Provider, keine Modellaufrufe, keine API, keine Persistenz, keine Migration, keine echten Daten und keine Schreibwirkung

## 1. Zweck

PA32 haertet die strukturierte Output-Grenze der LLM-Readiness-Vertraege.

Vor PA32 war `structuredCandidate` typseitig als flache Scalar-Map modelliert, wurde zur Laufzeit aber nicht eigenstaendig geprueft. PA32 macht diese Grenze explizit:

- erlaubt sind nur flache Objekte,
- Werte duerfen nur String, endliche Number, Boolean oder `null` sein,
- verschachtelte Objekte, Arrays und nicht-endliche Zahlen werden abgelehnt,
- verbotene Payload-Schluessel wie `prompt`, `messages`, `providerResponse`, `toolCalls`, `secret` oder `apiKey` duerfen auch innerhalb von `structuredCandidate` nicht auftauchen.

Damit bleiben erwartete Draft-Daten klein, reviewbar und ungeeignet fuer Rohpayload-, Prompt- oder Provider-Material.

## 2. Codeanker

- `shared-core/src/llm-readiness.ts`
- `shared-core/src/llm-readiness.js`

Der Code exportiert weiterhin `LlmReadinessModelOutputCandidate`; die Output-Validation prueft `structuredCandidate` nun als flache Scalar-Map, wenn das Feld vorhanden ist.

## 3. Harte Grenzen

PA32 bleibt innerhalb derselben No-go-Linie wie PA26-PA31:

- kein Provider,
- keine Modellaufrufe,
- keine echten Daten,
- keine API,
- keine Persistenz oder Migration,
- keine Runtime-`ConversationSession`,
- keine Produktobjekt-Schreibwirkung,
- keine Tool-Orchestrierung mit Schreibwirkung.

## 4. Definition of Done

PA32 ist erfuellt, wenn:

- valide flache `structuredCandidate`-Maps akzeptiert werden,
- verschachtelte Objekte, Arrays und nicht-endliche Zahlen abgelehnt werden,
- verbotene Payload-Schluessel in `structuredCandidate` abgelehnt werden,
- bestehende synthetische Eval-Fixtures weiterhin gueltig sind,
- `tests/pa32-llm-readiness-structured-candidate-validation.test.ts` gruen ist,
- `npm run build` gruen ist.
