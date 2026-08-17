# Production Knowledge Foundation v1 Design

Status: approved product direction; implementation not started.
Base: `main` at `4567fb1be7669513560844e2bf4df44abad13b18`.

## Goal

Turn the existing recipe library into a provenance-aware production knowledge foundation without introducing LLM orchestration, new persistence infrastructure, deployment changes, or real customer data.

The slice must let the system distinguish source facts from transcribed recipes, operational adaptations, and later AI-derived candidates so that professional cookbooks and other expert sources can inform production without silently becoming approved kitchen truth.

## Context

The current `Recipe` contract already carries ingredients, steps, base yield, loss factor, allergens, diet tags, source tier, origin type, approval state, quality/fit scores, extraction completeness, publisher/reference and source metadata. The existing schema validates this compact shape and the production pipeline already consumes approved recipes.

The missing layer is explicit production knowledge semantics: what kind of knowledge an artifact represents, how it relates to a source, what has actually been reviewed, and whether it is operationally ready for kitchen use.

## Approaches considered

### A. Expand `Recipe` directly with many mandatory production fields

Advantages: simple consumer model; every recipe has one shape.

Disadvantages: breaks existing fixtures/imports broadly, forces unverifiable defaults into historical recipes, and conflates reference knowledge with operational truth.

### B. Add optional structured knowledge metadata to `Recipe` and derive readiness fail-closed

Advantages: backward-compatible, incremental, preserves current library and production paths, and permits stronger evidence without inventing missing data.

Disadvantages: consumers must use an explicit readiness evaluator rather than assuming field presence means approval.

### C. Create a separate knowledge database/entity hierarchy now

Advantages: cleanest theoretical separation and long-term extensibility.

Disadvantages: introduces a new persistence/migration world before the domain contract is proven and is too large for this slice.

## Decision

Choose **B**.

Extend the existing recipe contract with an optional `knowledge` object and add a deterministic fail-closed evaluator. Existing recipes remain valid, but absence of knowledge evidence prevents them from being classified as fully production-ready under the new foundation.

## Domain model

### `RecipeKnowledge`

Optional on `Recipe` so historical recipes remain schema-valid.

It contains:

- `artifactKind`: `source_fact | transcribed_recipe | operational_adaptation | ai_derived_candidate`
- `sourceCitation`:
  - `title`
  - optional `author`
  - optional `edition`
  - optional `publisher`
  - optional `location` for page/chapter/section reference
  - optional `sourceUrl`
- `derivation`:
  - optional `basedOnRecipeId`
  - `method`: `direct_transcription | human_adaptation | ai_derivation | internal_original`
  - optional `notes`
- `production`:
  - optional `yieldLossPercent`
  - optional `prepLeadMinutes`
  - optional `holdMinutes`
  - optional `regenerationInstructions`
  - optional `equipmentNotes[]`
  - optional `criticalParameters[]` where each parameter has `name`, `value`, `unit?`
- `verification`:
  - `sourceStatus`: `verified | unverified`
  - `allergenStatus`: `verified | unverified`
  - `productionStatus`: `verified | unverified`
  - optional `verifiedBy`
  - optional `verifiedAt`
- `version`:
  - positive integer `revision`
  - optional `supersedesRecipeId`

### Production knowledge readiness

Add a pure evaluator returning:

```ts
{
  status: "reference_only" | "review_required" | "production_ready";
  blockers: string[];
}
```

Rules:

- `production_ready` requires the existing recipe source approval state to be `approved_internal` or `auto_usable`.
- `knowledge` must exist.
- `artifactKind` may not be `source_fact` or `ai_derived_candidate` for production readiness.
- source, allergen and production verification statuses must all be `verified`.
- verification must carry non-empty `verifiedBy` and valid `verifiedAt` when any status is verified; for `production_ready` both are mandatory.
- base yield, ingredients and steps remain governed by the existing recipe schema.
- no missing production field is invented. Missing optional operational detail does not itself make a recipe invalid, but `productionStatus=verified` is a human assertion and therefore requires reviewer identity/time.
- rejected recipes always return `review_required` with a rejection blocker and can never become production-ready.

`reference_only` is used for source facts and otherwise valid knowledge artifacts that are deliberately not production candidates. `review_required` is used for potentially operational recipes lacking the required approval/verification evidence.

## Provenance semantics

The source citation is bibliographic metadata only. It must not contain copyrighted source text or scanned page content.

A professional cookbook can therefore contribute a citation and derived/transcribed recipe knowledge while the application records that the operational recipe is a separate artifact. The existence of a citation never implies kitchen approval.

`direct_transcription` means the recipe was transcribed from the cited source. `human_adaptation` means the operational recipe was deliberately changed by a human. `ai_derivation` is only metadata in this slice; no AI generation is implemented. `internal_original` represents an internally authored production recipe.

## Compatibility

- Existing `Recipe` JSON remains valid because `knowledge` is optional.
- Existing import, review, recipe-selection, scaling, production-plan and export paths continue to work unchanged.
- The new evaluator is additive and becomes the foundation for future Stage-B gates; this slice does not automatically replace every existing approval check.
- No schema version bump is required in this first additive slice because persisted historical objects remain valid and no required field semantics change.

## Validation

Extend the JSON schema so that when `knowledge` is present it is strict (`additionalProperties: false`) and validates enum values, positive revision, non-negative production durations/loss percentages, and required nested fields.

Add semantic validation for verification identity/time consistency where JSON Schema alone would be awkward. Do not auto-fill reviewer identity or timestamps.

## Tests

TDD coverage must prove:

1. historical recipes without `knowledge` remain schema-valid but evaluate `review_required` when considered for production knowledge readiness;
2. cited `source_fact` evaluates `reference_only`;
3. a cookbook transcription with unverified allergen or production status cannot become production-ready;
4. `ai_derived_candidate` cannot become production-ready even if other fields claim verification;
5. an approved internal/transcribed or adapted recipe with all three verification statuses, reviewer and timestamp evaluates `production_ready`;
6. rejected recipes remain non-ready;
7. malformed verification metadata fails validation rather than being normalized silently;
8. bibliography metadata does not include or require source text.

## Non-goals

- no LLM/provider calls;
- no automatic recipe generation;
- no cookbook ingestion pipeline;
- no copyrighted source-text storage;
- no new database/migration layer;
- no UI redesign;
- no automatic allergen determination;
- no HACCP/legal compliance claim;
- no deployment, release or production-data action.

## Success criterion

After this slice, the repository has a backward-compatible, test-covered contract that can represent professional-source-derived recipe knowledge while making it impossible for source provenance alone to masquerade as verified kitchen production readiness.
