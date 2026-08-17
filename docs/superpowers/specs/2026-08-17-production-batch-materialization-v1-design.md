# Production Batch Materialization v1

## Goal
Make a `ready_for_scaling` Quantity→Recipe bridge result the only authoritative input for recipe-backed ProductionBatch materialization.

The current planning path can still derive `servings` directly from `component.servings ?? eventSpec.attendees.expected` and pass that number to `toProductionBatch()`. That bypasses the Quantity Decision and Quantity→Recipe approval chain. This slice closes that bypass.

## Chosen approach
Introduce a hard materialization gate in shared-core and route recipe-backed planning through it.

Alternative approaches rejected:
- adding a new helper while preserving the old raw-servings production path would leave two authorities;
- wiring full persisted quantity decisions and UI in this slice would be broader than needed.

## Contract
Add a focused function, conceptually:

`materializeProductionBatchFromBridge({ eventSpecId, componentId, recipe, bridgeResult })`

It MUST:
1. accept only `bridgeResult.status === "ready_for_scaling"`;
2. require a finite positive `bridgeResult.targetServings`;
3. require exact event/component/recipe identity binding;
4. call the existing `scaleRecipe(recipe, targetServings)` exactly once as the scaling authority;
5. materialize the recipe-backed batch fields from that scaled result;
6. carry `recipe.scalingRules.defaultLossFactor` only as metadata, never as a multiplier;
7. preserve recipe source metadata;
8. add no safety factor, shrinkage, yield correction, overproduction or procurement multiplier.

It MUST fail closed for `blocked`, `review_required`, missing/invalid target servings, or any binding mismatch.

## Authority model
For recipe-backed production:

`Quantity Decision -> Quantity→Recipe Bridge -> Production Batch Materializer -> scaleRecipe()`

No productive recipe-backed planning code may derive the batch target directly from `component.servings` or `eventSpec.attendees.expected` after this slice.

`scaleRecipe()` remains unchanged. It continues to scale recipe ingredient quantities linearly by recipe servings and to expose configured loss as metadata only.

## Production-service integration
Update the resolved-recipe artifact path so that it receives a `ready_for_scaling` bridge result rather than a raw `servings` number.

`buildResolvedRecipePlanningArtifacts()` remains responsible for operational presentation concerns after materialization:
- `batchId`;
- station;
- prep window;
- GN plan;
- kitchen sheet;
- timeline item;
- hybrid procurement notes.

It MUST NOT calculate a new recipe target.

Where the planner cannot produce a `ready_for_scaling` result, no recipe-backed ProductionBatch is created. The component remains unresolved / blocking through the existing planning issue mechanism.

## Compatibility
- No persistence migration.
- No UI change.
- No provider/LLM call.
- Existing recipe, ProductionBatch and `scaleRecipe()` schemas remain compatible.
- Existing non-recipe procurement branches are outside scope.

## Error semantics
The materializer returns or throws deterministic fail-closed reasons for at least:
- `bridge_not_ready_for_scaling`;
- `bridge_event_binding_mismatch`;
- `bridge_component_binding_mismatch`;
- `bridge_recipe_binding_mismatch`;
- `bridge_target_servings_invalid`.

No partial batch is emitted on failure.

## Tests / acceptance
RED tests are written before implementation and must prove:
1. ready bridge + exact bindings creates the expected scaled batch;
2. ingredient quantities equal existing `scaleRecipe()` output exactly;
3. loss factor is metadata only and does not inflate ingredients;
4. `blocked` bridge produces no batch;
5. `review_required` bridge produces no batch;
6. event mismatch fails closed;
7. component mismatch fails closed;
8. recipe mismatch fails closed;
9. missing/non-positive/non-finite `targetServings` fails closed;
10. the production-service resolved-recipe path no longer accepts an unproven raw servings target as its recipe scaling authority.

Full build/test and browser rehearsal must pass on the final head.

## Out of scope
- quantity-decision persistence;
- UI for quantity review or output mappings;
- automatic yield/loss modelling;
- procurement multipliers;
- kitchen approval UX;
- deployment or release.
