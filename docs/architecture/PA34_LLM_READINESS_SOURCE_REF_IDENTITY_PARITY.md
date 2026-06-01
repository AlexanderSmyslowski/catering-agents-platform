# PA34 LLM-Readiness SourceRef-Identity-Parity

Status: shared-core-Vertrag und Vertragstest, keine LLM-Runtime
Stand: 2026-06-01
Scope: Eval-Fixture-Validation fuer SourceRef-Identitaet zwischen Input und erwartetem Output; kein Provider, keine Modellaufrufe, keine API, keine Persistenz, keine Migration, keine echten Daten und keine Schreibwirkung

## 1. Zweck

PA34 haertet die Quellenbindung der synthetischen LLM-Readiness-Eval-Fixtures ueber PA33 hinaus.

PA33 stellt sicher, dass `expectedOutput.sourceRefs` alle vom Draft-Registry-Kontrakt geforderten Quellobjekttypen enthalten. PA34 stellt zusaetzlich sicher, dass diese erwarteten Output-Quellen auch dieselben `objectId`s tragen wie die entsprechenden erforderlichen Input-Quellen.

Damit kann ein synthetischer Erwartungsoutput nicht unbemerkt von `purchase-synthetic-buffet` auf eine andere Einkaufsliste oder von `plan-synthetic-buffet` auf einen anderen Produktionsplan driften, solange der Quelltyp formal gleich bleibt.

## 2. Codeanker

- `shared-core/src/fixtures/llm-readiness-eval-fixtures.ts`
- `shared-core/src/fixtures/llm-readiness-eval-fixtures.js`

Der Code bleibt ein providerloser Eval-Fixture-Vertrag. Er erzeugt keine Runtime-Objekte und schreibt keine Produktdaten.

## 3. Harte Grenzen

PA34 bleibt innerhalb derselben No-go-Linie wie PA26-PA33:

- kein Provider,
- keine Modellaufrufe,
- keine echten Daten,
- keine API,
- keine Persistenz oder Migration,
- keine Runtime-`ConversationSession`,
- keine Produktobjekt-Schreibwirkung,
- keine Tool-Orchestrierung mit Schreibwirkung.

## 4. Definition of Done

PA34 ist erfuellt, wenn:

- bestehende synthetische Eval-Fixtures weiterhin gueltig sind,
- erforderliche Output-SourceRefs mit falscher `objectId` abgelehnt werden,
- fehlende Output-SourceRef-Typen keine doppelten Identity-Fehler erzeugen,
- `tests/pa34-llm-readiness-source-ref-identity-parity.test.ts` gruen ist,
- `npm run build` gruen ist.
