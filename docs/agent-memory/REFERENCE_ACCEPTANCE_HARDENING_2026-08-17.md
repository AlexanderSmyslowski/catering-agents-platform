# Referenzauftrag-Acceptance: Härtungsnachweis 2026-08-17

Status: umgesetzt auf PR #616, Branch `codex/reference-order-acceptance-contract`; nicht gemergt, nicht releast, nicht deployt.

## Zweck

Dieser Snapshot dokumentiert die nach dem Acceptance-Milestone geschlossenen materiellen Bindungslücken. Er erweitert weder Provider-, Persistenz-, Deployment- noch Produktionsdaten-Scope.

## Umgesetzt

- Küchenkarte und Produktionsbatch müssen dieselbe positive Produktionsmenge und Einheit tragen; Abweichungen blockieren mit `kitchen_sheet_quantity_mismatch`.
- Einkaufsabdeckung wird für Produktionsbatches nun nicht nur auf Existenz geprüft. Die aus Batch-Zutaten aggregierte benötigte `normalizedQty` muss in derselben normalisierten Einheit vollständig abgedeckt sein und die zugehörigen Rezeptquellen enthalten; Unterdeckung blockiert mit `purchase_quantity_insufficient`.
- Für jedes tatsächlich ausgewählte, freigegebene Rezept müssen Allergene und Diet-Tags der zugehörigen Küchenkarte exakt der freigegebenen Rezept-Metadatenmenge entsprechen; Abweichungen blockieren mit `kitchen_sheet_recipe_metadata_mismatch`.
- Bereits auf dem vorherigen Head vorhanden und weiter verifiziert: persistierte Küchenabnahme bindet Operator und Zeitpunkt; rezeptgebundene Küchenkarten müssen exakt dasselbe Rezept wie der Produktionsbatch tragen; nicht verwendete Rezept-Snapshots blockieren die Abnahme nicht.

## TDD-Nachweis

RED-Commit: `0d6284b1e3cca1663d94066ac33970b1f8ebac7f`

- neue Regressionen in `tests/production-reference-material-bindings.test.ts`
- alle drei neuen Tests schlugen vor der Implementierung gezielt fehl
- bestehende Tests blieben im RED-Lauf außerhalb dieser drei Fälle grün

GREEN-Commit: `97d7c083932c4d504c8cf09b5f885095acb0f946`

- `npm run build`: grün
- `npm test`: 333 Testdateien bestanden, 1 übersprungen; 1.986 Tests bestanden, 14 übersprungen
- GitHub-CI Run `31979240494`: `build-and-test` grün, `browser-rehearsal` grün

## Grenze

Der Köpff-/Referenzfall bleibt ohne tatsächlich belegte Quellen-, Freigabe-, Preis-, Rezept-/Allergen-, Produktions- und menschliche Küchenabnahme-Evidenz weiterhin `blocked` beziehungsweise `not_assessed`. Die Härtung ist keine Produktionsfreigabe und keine Freigabe für echte Kundendaten.
