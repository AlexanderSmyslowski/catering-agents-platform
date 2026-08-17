# Production Intake & Clarification v1 — TDD

Stand: GREEN.

Branch: `feature/production-intake-clarification-v1`.

## RED

Der neue Readiness-Vertrag wurde zuerst ausschließlich als Test definiert. Produktcode für `evaluateProductionIntakeReadiness` war absichtlich noch nicht vorhanden.

RED-Head: `08e4571665fec805e259d2f9d60f3893469c573e`.
CI Run: `32023888017`.

`build-and-test` scheiterte erwartungsgemäß am fehlenden `evaluateProductionIntakeReadiness`-Export; die nachgelagerten implicit-any-Meldungen entstanden aus dem fehlenden Rückgabetyp.

## GREEN

Implementiert wurde ein additiver, deterministischer Shared-Core-Evaluator. Er unterscheidet:

- `required_for_quantity_planning`;
- `required_for_production`;
- `commercial_context`;
- `explicit_assumption_allowed`.

Er blockiert Mengenplanung bei fehlender positiver Personenzahl, fehlendem Anlass-/Eventkontext, leerem Menü oder nicht verifizierbarer Fallback-/Failed-Quelle. Produktionsplanung wird zusätzlich bei fehlendem Produktionsmodus und unvollständig deklarierter Hybrid-Produktion blockiert. Preis-/Budgetkontext ist ausdrücklich kein Produktionsblocker.

Ein erster GREEN-Versuch deckte eine unbeabsichtigte Export-Regressionsstelle in `shared-core/src/index.ts` auf; der bestehende Export `rules/offer-package-classification-pilot` wurde wiederhergestellt, ohne den neuen Vertrag zu erweitern.

Finaler geprüfter Code-Head vor diesem Dokumentationscommit: `a9e3a9979c035037934352412d51e215bdedb4ff`.
CI Run: `32024125801`.

- `build-and-test`: SUCCESS;
- `browser-rehearsal`: SUCCESS;
- Build: grün;
- fokussierter Intake-Vertrag: 10/10 Tests grün;
- Vollsuite: 335 Testdateien bestanden, 1 übersprungen; 2.008 Tests bestanden, 14 übersprungen; 0 fehlgeschlagen.

Kein LLM-/Provideraufruf, keine Migration, kein Deployment, kein Release und keine echten Kundendaten.