# PA35 LLM-Readiness Draft-Registry-Coverage

Status: shared-core-Vertrag und Vertragstest, keine LLM-Runtime
Stand: 2026-06-04
Scope: Coverage-Validation zwischen Draft-Registry und synthetischen Eval-Fixtures; kein Provider, keine Modellaufrufe, keine API, keine Persistenz, keine Migration, keine echten Daten und keine Schreibwirkung

## 1. Zweck

PA35 schliesst eine kleine Vertragsluecke in der providerlosen LLM-Readiness-Kette.

PA28 registriert die erlaubten Draft-Kontrakte, PA30-PA34 validieren einzelne synthetische Eval-Fixtures. PA35 stellt zusaetzlich sicher, dass jeder registrierte Draft-Kontrakt mindestens eine gueltige synthetische Eval-Fixture hat.

Damit kann ein neuer Draft-Kontrakt nicht unbemerkt in die Registry aufgenommen werden, ohne durch einen synthetischen Erwartungsfall belegbar zu sein.

## 2. Codeanker

- `shared-core/src/fixtures/llm-readiness-eval-fixtures.ts`
- `shared-core/src/fixtures/llm-readiness-eval-fixtures.js`
- `shared-core/src/llm-readiness-draft-registry.ts`

Der Code bleibt ein providerloser Eval-Fixture-Vertrag. Er erzeugt keine Runtime-Objekte und schreibt keine Produktdaten.

## 3. Harte Grenzen

PA35 bleibt innerhalb derselben No-go-Linie wie PA26-PA34:

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

PA35 ist erfuellt, wenn:

- `validateLlmReadinessEvalFixtureCoverage(...)` jede aktuelle Registry-Zeile gegen gueltige synthetische Fixtures prueft,
- fehlende Contract-Coverage abgelehnt wird,
- ungueltige Fixtures nicht als Contract-Coverage zaehlen,
- Nicht-Array-Eingaben abgelehnt werden,
- `tests/pa35-llm-readiness-draft-registry-coverage.test.ts` gruen ist,
- `npm run build` gruen ist.
