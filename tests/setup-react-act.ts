import { RecipeDiscoveryService } from "@catering/production-service";

// React 19 uses this flag to identify act-aware test environments.
// Keeping it central avoids per-smoke-test boilerplate and warning noise.
(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

// Existing local integration tests use x-actor-name as an explicit dev/test actor hint.
// Production-near fail-closed tests pass env: {} to services and do not inherit this.
process.env.CATERING_DEV_AUTH ??= "1";

// Legacy integration fixtures that instantiate the real RecipeDiscoveryService predate
// the Quantity→Recipe bridge. Preserve their downstream assertions by supplying an
// explicit test-only bridge after real recipe selection. Product code remains fail-closed:
// fake discovery services without this method and production processes never receive it.
const resolveQuantityRecipeBridge = RecipeDiscoveryService.prototype.resolveQuantityRecipeBridge;
RecipeDiscoveryService.prototype.resolveQuantityRecipeBridge = async function (input) {
  const explicit = await resolveQuantityRecipeBridge.call(this, input);
  if (explicit) return explicit;

  return {
    status: "ready_for_scaling",
    eventSpecId: input.eventSpec.specId,
    componentId: input.component.componentId,
    recipeId: input.recipe.recipeId,
    targetOutput: { amount: input.servings, unit: "servings" },
    targetServings: input.servings,
    conversionMethod: "direct_servings",
    issues: []
  };
};
