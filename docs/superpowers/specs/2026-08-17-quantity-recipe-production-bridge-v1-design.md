# Quantity → Recipe / Production Basis Bridge v1

## Purpose
Connect an event-specific, usable quantity decision to one recipe that is allowed for the same event, without mixing quantity planning with recipe scaling, yield/loss, procurement, or hidden buffers.

## Product rule
A quantity target is not yet a recipe scaling instruction. The bridge must prove both sides independently:

1. the quantity decision is valid and usable for planning;
2. the recipe is usable for the exact event;
3. the event/component/recipe bindings match;
4. the target can be converted into the `targetServings` input expected by the existing `scaleRecipe()` contract without guessing.

Only then may the bridge return `ready_for_scaling` with an explicit `targetServings` value.

## Status model
- `blocked`: a hard contradiction, invalid decision, rejected/unusable recipe, binding mismatch, or invalid conversion mapping exists.
- `review_required`: the recipe or quantity/conversion basis still needs human kitchen review.
- `ready_for_scaling`: all bindings and conversion evidence are sufficient to call the existing recipe scaler.

## Direct servings path
If the usable quantity decision has `targetUnit === "servings"`, its `targetAmount` is the explicit `targetServings`. No extra mapping is required.

This includes `servings_per_person` and a valid `fixed_total` expressed directly in servings.

## Non-servings path
For `g`, `kg`, `pieces`, `ml`, `l`, or any other non-servings target, the bridge must not infer servings.

It requires an explicit `RecipeOutputMapping`:

```ts
interface RecipeOutputMapping {
  recipeId: string;
  outputAmount: number;
  outputUnit: string;
  recipeServings: number;
  reviewedBy: string;
  reviewedAt: string;
}
```

Meaning: `recipeServings` servings of this recipe correspond to `outputAmount outputUnit` of event output.

Example: if 10 recipe servings correspond to 550 g cooked roast beef, an event target of 2,750 g maps deterministically to 50 recipe servings.

The mapping is an output-equivalence statement only. It must not add safety, shrinkage, trim, cooking loss, overproduction, or procurement factors. Those remain separate production knowledge/scaling concerns.

## Mapping validation
The mapping must:
- bind exactly to the chosen recipe;
- contain positive finite `outputAmount` and `recipeServings`;
- use exactly the same output unit as the quantity decision;
- contain a nonblank reviewer and valid review timestamp.

Missing mapping for a non-servings target produces `review_required`, not an inferred value.
Invalid or contradictory mapping produces `blocked`.

## Quantity contract integration
The bridge calls `evaluateQuantityDecision()` and does not duplicate its arithmetic rules.

- invalid decisions block;
- rejected decisions block;
- provisional or kitchen-review-required decisions remain `review_required` even when numerically valid;
- only `approved` quantity decisions may become `ready_for_scaling`.

## Recipe contract integration
The bridge calls `evaluateRecipeEventUse()` and does not weaken the zero-seed recipe rules.

- `blocked` recipe use blocks the bridge;
- `kitchen_review_required` keeps the bridge at `review_required`;
- `event_usable` permits recipe-side progression.

A professional-reference or AI-derived recipe can therefore enter the bridge after exact-event kitchen acceptance without becoming a permanent house recipe.

## Binding rules
The bridge input contains `eventSpecId`, `componentId`, quantity decision, recipe, optional event-use review and optional output mapping.

It must reject:
- quantity decision bound to another event;
- quantity decision bound to another component;
- event review bound to another event/recipe (delegated to recipe event-use evaluation);
- output mapping bound to another recipe.

## Output
A successful result returns:
- status `ready_for_scaling`;
- eventSpecId;
- componentId;
- recipeId;
- target output amount/unit exactly as approved in the quantity decision;
- deterministic `targetServings`;
- conversion method `direct_servings` or `reviewed_output_mapping`;
- issues array (empty when ready).

The bridge does not call `scaleRecipe()` itself in v1. It produces the proven scaling input so the existing scaler remains unchanged and independently testable.

## Out of scope
- LLM/provider calls;
- cookbook/web ingestion;
- recipe generation;
- persistence migrations;
- UI redesign;
- automatic yield/loss calculation;
- procurement calculation;
- safety/overproduction factors;
- deployment/release;
- real customer data.

## Acceptance examples
1. Approved 50 servings + event-usable recipe → `ready_for_scaling`, `targetServings = 50`.
2. Approved 2,750 g + event-usable recipe + reviewed mapping `550 g = 10 servings` → `ready_for_scaling`, `targetServings = 50`.
3. 2,750 g without output mapping → `review_required`.
4. Mapping unit `kg` while decision unit is `g` → `blocked`; no silent conversion in v1.
5. Quantity decision still `kitchen_review_required` → `review_required`.
6. Recipe still `kitchen_review_required` → `review_required`.
7. Quantity event/component mismatch or recipe/mapping mismatch → `blocked`.
8. No hidden loss/buffer factor is present anywhere in the bridge output.
