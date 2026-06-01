# PA33 LLM-Readiness Output SourceRef-Validation

Status: shared-core-Vertrag und Vertragstest, keine LLM-Runtime
Stand: 2026-06-01
Scope: Eval-Fixture-Validation fuer erwartete Output-SourceRefs; kein Provider, keine Modellaufrufe, keine API, keine Persistenz, keine Migration, keine echten Daten und keine Schreibwirkung

## 1. Zweck

PA33 haertet die Quellenbindung der synthetischen LLM-Readiness-Eval-Fixtures.

Vor PA33 pruefte `validateLlmReadinessEvalFixture(...)`, ob `input.sourceRefs` alle vom Draft-Registry-Kontrakt geforderten Quellobjekttypen enthaelt. Die erwarteten Outputs mussten zwar sichere SourceRefs tragen, konnten aber einen fuer den Contract erforderlichen Quellobjekttyp verlieren.

PA33 macht die Bindung symmetrisch; PA34 ergaenzt diese Grenze um SourceRef-Identitaetsparitaet:

- `input.sourceRefs` muss weiterhin alle `requiredSourceObjectTypes` des Draft-Contracts enthalten,
- `expectedOutput.sourceRefs` muss dieselben erforderlichen Quellobjekttypen enthalten,
- bei required SourceRefs muss `expectedOutput.sourceRefs` dieselben `objectId`s tragen wie der Input,
- Input- und Output-Fehler werden getrennt gemeldet.

Damit bleiben synthetische Erwartungsoutputs sauber auf die Arbeitsbelege zurueckfuehrbar, die der jeweilige Draft-Kontrakt verlangt.

## 2. Codeanker

- `shared-core/src/fixtures/llm-readiness-eval-fixtures.ts`
- `shared-core/src/fixtures/llm-readiness-eval-fixtures.js`

Der Code bleibt Teil des providerlosen Eval-Fixture-Vertrags. Er erzeugt keine Runtime-Objekte und schreibt keine Produktdaten.

## 3. Harte Grenzen

PA33 bleibt innerhalb derselben No-go-Linie wie PA26-PA32:

- kein Provider,
- keine Modellaufrufe,
- keine echten Daten,
- keine API,
- keine Persistenz oder Migration,
- keine Runtime-`ConversationSession`,
- keine Produktobjekt-Schreibwirkung,
- keine Tool-Orchestrierung mit Schreibwirkung.

## 4. Definition of Done

PA33 ist erfuellt, wenn:

- bestehende synthetische Eval-Fixtures weiterhin gueltig sind,
- fehlende Required-SourceRefs in `expectedOutput.sourceRefs` abgelehnt werden,
- Input- und Output-SourceRef-Fehler getrennt sichtbar bleiben,
- `tests/pa33-llm-readiness-output-source-ref-validation.test.ts` gruen ist,
- `npm run build` gruen ist.
