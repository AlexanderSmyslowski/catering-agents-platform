# Quantity → Recipe / Production Basis Bridge v1 — TDD Evidence

Date: 2026-08-17

## Scope

This slice proves the conversion boundary between an event-specific quantity decision and the `targetServings` input expected by the existing recipe scaler. It does not modify `scaleRecipe()` and does not introduce yield, loss, safety, overproduction or procurement factors.

## RED

- Head: `203b8e99938b84161f06ea2baee888bf33748f6e`
- CI run: `32033462529`
- Expected build failure:
  - `@catering/shared-core` had no exported member `evaluateQuantityRecipeProductionBridge`;
  - `@catering/shared-core` had no exported member `RecipeOutputMapping`;
  - one dependent `implicit any` diagnostic followed from the missing public type.

No product implementation existed at this point.

## GREEN code head

- Head: `f67891dee90a4a8717ac3b66219f9e5911d4a50c`
- CI run: `32033614936`
- `build-and-test`: SUCCESS
- `browser-rehearsal`: SUCCESS
- focused bridge contract: 16/16 tests passed
- full suite: 337 test files passed, 1 skipped; 2,038 tests passed, 14 skipped; 0 failed

## Proven contract

- approved serving targets pass through directly as `targetServings`;
- non-serving targets cannot be guessed into servings;
- non-serving conversion requires an exact-unit, recipe-bound, human-reviewed output mapping;
- mapping arithmetic is limited to `targetAmount / outputAmount * recipeServings`;
- quantity event/component binding is enforced;
- quantity approval state is enforced;
- recipe event-use readiness is enforced;
- zero-seed recipe candidates can progress after exact-event kitchen acceptance without durable promotion;
- blocked/rejected inputs fail closed;
- no buffer/loss/yield multiplier is exposed or applied by the bridge;
- existing recipe scaling implementation remains unchanged.

## Final-head rule

This evidence document is itself a commit. The resulting final PR head must receive a fresh `build-and-test` and `browser-rehearsal` verification before the slice is considered complete.
