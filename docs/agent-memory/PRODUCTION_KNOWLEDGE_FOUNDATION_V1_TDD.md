# Production Knowledge Foundation v1 — TDD status

Stand: GREEN auf Branch `feature/production-knowledge-foundation-v1`; PR #617 offen, noch nicht gemergt.

Der Slice unterstützt ausdrücklich einen Zero-Seed-Start ohne vorhandene intern geprüfte Rezepte. Professionelle Referenzen und spätere AI-derived candidates dürfen in einen event-spezifischen Küchenreview-Korridor gelangen; eine einmalige Eventfreigabe ist keine dauerhafte interne Rezeptfreigabe.

## RED

RED-Commit: `2629727e34893ff3dbc98e071174172c0694cbe2`.

Der CI-Build schlug gezielt fehl, weil folgende neuen Verträge noch nicht existierten:

- `Recipe.knowledge`
- `RecipeEventUseReview`
- `evaluateRecipeKnowledgeMaturity(...)`
- `evaluateRecipeEventUse(...)`
- `validateRecipeEventUseReview(...)`

## GREEN

Implementiert:

- optionaler, strikt validierter `RecipeKnowledge`-Block;
- getrennte dauerhafte Knowledge-Maturity (`reference_only | review_required | production_ready`);
- getrennte event-spezifische Recipe-Use-Readiness (`blocked | kitchen_review_required | event_usable`);
- exakte Bindung der Eventfreigabe an `eventSpecId + recipeId`;
- keine automatische Hochstufung eines Eventkandidaten zum dauerhaften Hausrezept;
- `source_fact` bleibt für Rezeptnutzung gesperrt;
- AI-derived candidates können event-spezifisch freigegeben werden, aber nicht allein dadurch dauerhaft `production_ready` werden;
- Verification-Metadaten und negative Produktionsparameter werden fail-closed validiert.

Current-head CI Run `32018994469` auf Implementierungshead `3e9a09d194cd834e3067b00abe785e9edb0b1245`:

- Build: grün;
- `tests/production-knowledge-foundation.test.ts`: 12/12 grün;
- Vollsuite: 334 Testdateien bestanden, 1 übersprungen; 1.998 Tests bestanden, 14 übersprungen; 0 fehlgeschlagen;
- `build-and-test`: SUCCESS;
- `browser-rehearsal`: SUCCESS.

Nach dem CI-Lauf wurde ausschließlich der redundante leere `.keep`-Platzhalter entfernt und dieser Nachweis aktualisiert; Produktcode blieb unverändert. Der finale aktuelle Head benötigt deshalb noch einen frischen CI-Lauf.

## Produktbenchmark

`docs/product/PRODUCTION_PROMPT_REPLACEMENT_CONTRACT.md` hält den bisherigen manuellen ChatGPT-Produktionsworkflow als Definition-of-Done fest. Die App soll diesen Workflow durch strukturierte Produktzustände ersetzen, nicht den bisherigen Superprompt lediglich verstecken.

Kein LLM-/Provideraufruf, keine Migration, kein Deployment, keine echten Kundendaten.
