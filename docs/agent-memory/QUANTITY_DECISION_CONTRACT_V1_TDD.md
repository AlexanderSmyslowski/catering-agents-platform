# Quantity Decision Contract v1 — TDD-Nachweis

Stand: GREEN auf Branch `feature/quantity-decision-contract-v1`; PR #619 offen und Draft.

## Zweck

Der Slice ergänzt die bisher fehlende fachliche Ebene zwischen Intake/Clarification und Rezeptskalierung: eine event-spezifische Mengenentscheidung pro Gericht bzw. Komponente. Er bestimmt ausschließlich die Soll-Ausgabemenge und fügt keine Sicherheits-, Schwund-, Yield-, Überproduktions- oder Pufferfaktoren hinzu.

`shared-core/src/rules/scaling.ts` wurde in diesem Slice nicht verändert.

## RED

RED-Head: `e008fdec62b7d29d23062ccecbb3b1da0f014f79`.

CI Run: `32028669647`.

Der Build schlug erwartungsgemäß fehl, weil `evaluateQuantityDecision` im öffentlichen `@catering/shared-core`-Export noch nicht existierte. Die zusätzlichen `implicit any`-Meldungen in den Tests waren Folge des fehlenden Rückgabetyps.

## GREEN

Code-Head: `4f998ce4a27f83a2ca9a797a89b041cd23ec332e`.

CI Run: `32028788061`.

Ergebnis:

- Build: SUCCESS;
- `tests/quantity-decision-contract.test.ts`: 14/14 grün;
- Vollsuite: 336 Testdateien bestanden, 1 übersprungen;
- 2.022 Tests bestanden, 14 übersprungen;
- 0 fehlgeschlagen;
- `build-and-test`: SUCCESS;
- `browser-rehearsal`: SUCCESS.

## Implementierter Vertrag

Unterstützte Mengenbasen:

- `per_person_weight`;
- `pieces_per_person`;
- `servings_per_person`;
- `fixed_total`.

Die Entscheidung bindet `eventSpecId`, `componentId`, Gästezahl, Serviceformat, Gerichtsrolle, Mengenbasis, Zielmenge, Begründung, Evidenzart und Reviewstatus.

Validiert werden unter anderem positive/finite Mengen, positive ganzzahlige Gästezahl, konsistente Zielmenge und Einheit, unzulässige personenbezogene Felder bei `fixed_total`, Review-/Evidence-Kompatibilität und der verworfene Status.

Professionelle Referenzen, AI-Kandidaten und explizite Annahmen können nicht automatisch `approved` werden. `rejected` bleibt strukturell auswertbar, ist aber nicht für die Planung nutzbar.

## Grenze

Keine UI-Änderung, keine Persistenzmigration, keine Provider-/LLM-Aufrufe, kein Deployment, keine echten Kundendaten und keine Änderung der bestehenden Rezeptskalierung. Die Integration der Mengenentscheidung als tatsächlicher Input in spätere Produktions-/Rezeptpfade ist ein eigener Folgeslice.

Nach diesem Dokumentationscommit benötigt der aktuelle finale Head nochmals CI, da der belegte GREEN-Lauf auf dem unmittelbar vorherigen Code-Head lief.