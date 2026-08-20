# Produktionsgrundlage: event-spezifische Rezeptabnahme

Stand: 2026-08-20

## Belegter Engpass

`RecipeEventUseReview` und die Mengen-Rezept-Brücke waren auf `origin/main`
bereits vorhanden. Der Produktionsplaner stoppte einen nicht dauerhaft
freigegebenen Rezeptkandidaten jedoch vorher über die ältere
`classifyRecipeProductionTrust`-Grenze. Eine vollständige, exakt gebundene
Küchenabnahme konnte deshalb keinen ausführbaren Batch erzeugen.

## Umgesetzter enger Baustein

`buildProductionArtifacts` kann für jede Komponente eine optionale, typisierte
`RecipeEventUseReview` an den bestehenden Planungszweig weiterreichen. Der
Planer ruft für nicht dauerhaft vertrauenswürdige Kandidaten den vorhandenen
`evaluateRecipeEventUse` auf. Nur `event_usable` für dieselbe
`eventSpecId`-/`recipeId`-Kombination erreicht die bestehende
Batch-/KitchenSheet-Erzeugung. Fehlende, unvollständige, abgelehnte oder fremde
Reviews bleiben blockiert.

Dauerhaft vertrauenswürdige interne Rezepte behalten ihren bisherigen Pfad.
Der Baustein führt keine Persistenz-, UI-, Export-, Provider- oder
Deploymentänderung ein. Eine echte Bedien-/Persistenzoberfläche für
Event-Reviews bleibt ein separater, noch nicht behaupteter Schritt.

## Nachweis

`tests/production-event-recipe-review-planning.test.ts` prüft die vollständige
Produktionsplan-Erzeugung für einen professionell referenzierten Kandidaten mit
gültiger Mengenbrücke sowie eine Cross-Event-Gegenprobe. Die fokussierte
Produktions-/Knowledge-/Quantity-Gruppe und `npx tsc --noEmit` sind grün.
