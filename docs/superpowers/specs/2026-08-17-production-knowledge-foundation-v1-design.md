# Production Knowledge Foundation v1 Design

Status: approved product direction; implementation not started.
Base: `main` at `4567fb1be7669513560844e2bf4df44abad13b18`.

## Goal

Turn the existing recipe library into a provenance-aware production knowledge foundation without introducing LLM orchestration, new persistence infrastructure, deployment changes, or real customer data.

The system must be useful from **day one even when the business provides zero pre-existing verified internal recipes**. Professional references and, in later slices, AI-derived candidates may bootstrap recipe work. Human kitchen review for the concrete event is the safety gate; a one-off event approval must not silently convert a candidate into permanent internal recipe truth.

The slice must therefore distinguish source facts from transcribed recipes, operational adaptations, later AI-derived candidates, event-specific kitchen usability, and durable internal production readiness.

## Context

The current `Recipe` contract already carries ingredients, steps, base yield, loss factor, allergens, diet tags, source tier, origin type, approval state, quality/fit scores, extraction completeness, publisher/reference and source metadata. The existing schema validates this compact shape and the production pipeline already consumes approved recipes.

THE ONE does not start from a large library of formally documented and verified recipes. Much operational know-how currently lives in the heads and routines of experienced cooks. Requiring a mature internal recipe catalog before the application can produce usable kitchen documents would therefore make the product unusable at the moment it is most needed.

The missing layer is explicit production knowledge semantics: what kind of knowledge an artifact represents, how it relates to a source, what has actually been reviewed, whether it is usable for one concrete production run, and whether it has matured into reusable internal knowledge.

## Approaches considered

### A. Require internally verified recipes before any operational use

Advantages: strongest static library gate.

Disadvantages: incompatible with the real starting position; the product would depend on a recipe library the business does not yet have.

### B. Zero-seed bootstrap corridor plus durable knowledge promotion

Advantages: works with no pre-existing internal recipes; keeps source/candidate truth separate from event-specific kitchen approval; allows the recipe library to emerge from actual operations; professional references can provide a high-quality starting point without pretending to be THE ONE's proven house recipe.

Disadvantages: introduces two distinct concepts of readiness that consumers must not confuse.

### C. Treat AI or cookbook recipes as automatically production-ready

Advantages: fastest apparent automation.

Disadvantages: unsafe and epistemically wrong. A plausible recipe or respected source does not prove THE ONE-specific quantities, equipment behavior, holding quality, allergen completeness, or operational fit.

## Decision

Choose **B**.

Extend the existing recipe contract with an optional `knowledge` object and introduce two deterministic fail-closed evaluators:

1. **knowledge maturity** — how trustworthy/reusable the recipe is as organizational knowledge;
2. **event-use readiness** — whether a recipe candidate may be used for one explicitly reviewed production run.

Existing recipes remain valid. A missing internal recipe never forces the system to stop at "we have no recipe" if a professional-source or AI-derived candidate can be created and then reviewed by a human kitchen operator.

## Zero-seed bootstrap principle

The application must support this future end-to-end path:

```text
Dish required by offer/event
→ no suitable internal recipe exists
→ retrieve/use professional reference knowledge
→ generate or transcribe structured candidate
→ mark uncertainties and unverified fields
→ kitchen operator reviews candidate for this event
→ candidate becomes event_usable for this event only
→ production sheet is generated
→ post-production observations are captured
→ later human approval may promote a revised artifact to durable internal knowledge
```

This slice implements the data contract and evaluators needed for that path. It does **not** implement the LLM, cookbook ingestion, or UI workflow yet.

## Source hierarchy for bootstrap

The data model must be able to distinguish at least these practical source classes without asserting that higher-ranked sources are automatically production truth:

1. existing internally verified recipe;
2. internally approved recipe/adaptation;
3. professional cookbook or culinary reference;
4. manufacturer/supplier technical recipe or product instruction;
5. other approved import;
6. later AI-derived candidate based on identifiable sources;
7. generic web fallback.

Source quality influences review priority and confidence, not automatic approval.

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

### Knowledge maturity

Add a pure evaluator returning:

```ts
{
  status: "reference_only" | "review_required" | "production_ready";
  blockers: string[];
}
```

Rules:

- `production_ready` means reusable organizational production knowledge, not merely usable once.
- It requires the existing recipe source approval state to be `approved_internal` or `auto_usable`.
- `knowledge` must exist.
- `artifactKind` may not be `source_fact` or `ai_derived_candidate` for durable `production_ready` classification.
- source, allergen and production verification statuses must all be `verified`.
- verification must carry non-empty `verifiedBy` and valid `verifiedAt` when any status is verified; for `production_ready` both are mandatory.
- base yield, ingredients and steps remain governed by the existing recipe schema.
- no missing production field is invented.
- rejected recipes always return `review_required` with a rejection blocker and can never become production-ready.

`reference_only` is used for source facts and knowledge artifacts deliberately not intended as operational recipes. `review_required` is used for potentially reusable recipes lacking durable approval/verification evidence.

### Event-specific recipe use

A second pure evaluator supports the zero-seed startup situation. It evaluates a recipe together with explicit event/kitchen review evidence and returns:

```ts
{
  status: "blocked" | "kitchen_review_required" | "event_usable";
  blockers: string[];
}
```

The review evidence is intentionally separate from the recipe's durable knowledge status and contains:

- `eventSpecId`
- `recipeId`
- `reviewedBy`
- `reviewedAt`
- `decision`: `accepted_for_event | rejected_for_event`
- explicit booleans confirming the operator reviewed:
  - ingredient quantities / yield;
  - method and equipment fit;
  - allergen/diet information;
  - holding/regeneration constraints when relevant.

Rules:

- `production_ready` recipes may be `event_usable` without repeating a full recipe-content review, subject to the existing event/production approval chain.
- a `transcribed_recipe`, `operational_adaptation`, or `ai_derived_candidate` may become `event_usable` even when not durably production-ready **only** when complete event-specific kitchen review evidence accepts it;
- `source_fact` can never become event-usable as a recipe;
- rejected recipes or an event-specific rejection are blocked;
- incomplete review evidence returns `kitchen_review_required`;
- event-use acceptance must never mutate the durable recipe approval state automatically;
- event-use acceptance is scoped to the exact `eventSpecId + recipeId` pair and cannot be reused for another event;
- source provenance remains visible in the resulting production artifacts.

This is the key bootstrap rule: **lack of pre-existing internally verified recipes is not itself a production blocker; lack of a reviewed recipe candidate for the concrete event is.**

## Learning and promotion path

The future operational loop is deliberately asymmetric:

- first use: candidate + event-specific kitchen review;
- after production: capture observations/corrections;
- repeated successful use: create an `operational_adaptation` revision;
- explicit human verification: promote that revision to durable `production_ready` knowledge.

No automatic promotion based solely on number of uses is allowed. Actual production experience is evidence for a reviewer, not a substitute for one.

## Provenance semantics

The source citation is bibliographic metadata only. It must not contain copyrighted source text or scanned page content.

A professional cookbook can contribute a citation and derived/transcribed recipe knowledge while the application records that the operational recipe is a separate artifact. The existence of a citation never implies kitchen approval.

`direct_transcription` means the recipe was transcribed from the cited source. `human_adaptation` means the operational recipe was deliberately changed by a human. `ai_derivation` identifies a model-created candidate derived from stated source knowledge; no AI generation is implemented in this slice. `internal_original` represents an internally authored production recipe.

## Compatibility

- Existing `Recipe` JSON remains valid because `knowledge` is optional.
- Existing import, review, recipe-selection, scaling, production-plan and export paths continue to work unchanged.
- The new maturity evaluator is additive and becomes the foundation for future Stage-B durable-knowledge gates.
- The event-use evaluator is also additive and gives later production flows a safe path when no mature internal recipe exists.
- This slice does not automatically replace every existing approval check.
- No schema version bump is required in this first additive slice because persisted historical objects remain valid and no required field semantics change.

## Validation

Extend the JSON schema so that when `knowledge` is present it is strict (`additionalProperties: false`) and validates enum values, positive revision, non-negative production durations/loss percentages, and required nested fields.

Add semantic validation for verification identity/time consistency where JSON Schema alone would be awkward. Do not auto-fill reviewer identity or timestamps.

Event-use review evidence is validated strictly: exact recipe/event binding, non-empty reviewer, valid timestamp, explicit decision, and explicit review confirmations. Missing confirmations remain missing; they are never inferred from source quality or model confidence.

## Tests

TDD coverage must prove:

1. historical recipes without `knowledge` remain schema-valid but evaluate `review_required` for durable knowledge maturity;
2. cited `source_fact` evaluates `reference_only` and is blocked for event recipe use;
3. a cookbook transcription with unverified allergen or production status cannot become durably production-ready;
4. `ai_derived_candidate` cannot become durably production-ready even if other fields claim verification;
5. an approved internal/transcribed or adapted recipe with all three verification statuses, reviewer and timestamp evaluates durable `production_ready`;
6. rejected recipes remain non-ready;
7. malformed verification metadata fails validation rather than being normalized silently;
8. bibliography metadata does not include or require source text;
9. with **zero internal approved recipes**, a complete professional-source or AI-derived candidate returns `kitchen_review_required` rather than a generic "no recipe" hard failure;
10. that candidate becomes `event_usable` after complete explicit kitchen acceptance for the exact event;
11. the same event acceptance cannot authorize the candidate for a different event;
12. accepting a candidate for one event does not change its durable knowledge maturity or recipe approval state;
13. incomplete allergen, yield/method, or holding review evidence remains `kitchen_review_required`/blocked rather than being inferred;
14. a durably production-ready recipe remains event-usable under the existing production approval corridor without requiring bootstrap review evidence.

## Non-goals

- no LLM/provider calls;
- no automatic recipe generation in this slice;
- no cookbook ingestion pipeline;
- no copyrighted source-text storage;
- no new database/migration layer;
- no UI redesign;
- no automatic allergen determination;
- no automatic promotion of event candidates to permanent internal recipes;
- no HACCP/legal compliance claim;
- no deployment, release or production-data action.

## Success criterion

After this slice, the repository has a backward-compatible, test-covered contract that can start with **zero internally verified recipes**, represent professional-source/AI-derived recipe candidates honestly, permit an explicitly reviewed candidate to be used for one concrete event, and still prevent source provenance or a single event approval from masquerading as durable kitchen knowledge.
