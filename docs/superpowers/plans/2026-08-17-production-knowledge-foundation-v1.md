# Production Knowledge Foundation v1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a backward-compatible, fail-closed recipe-knowledge contract that supports zero pre-existing internal recipes by distinguishing durable knowledge maturity from event-specific kitchen usability.

**Architecture:** Extend the existing `Recipe` type/schema with optional structured `knowledge` metadata and add a separate event-use review evidence type. Implement two pure evaluators: one for durable knowledge maturity and one for exact-event usability. Keep all existing recipe/import/production paths valid; this slice adds contracts and tests only and does not add LLM calls, ingestion, UI, migrations, or deployment.

**Tech Stack:** TypeScript, existing `shared-core` package, JSON Schema 2020-12/Ajv, Vitest, GitHub CI.

## Global Constraints

- Zero internally verified recipes is a supported starting state.
- Professional-reference and AI-derived candidates may enter `kitchen_review_required`; they may not become durable `production_ready` without durable human verification.
- A complete kitchen review may make a candidate `event_usable` only for the exact `eventSpecId + recipeId` pair.
- Event-specific acceptance must never mutate or imply durable recipe approval.
- `source_fact` is never usable as a recipe.
- No copyrighted source text or scanned page content in knowledge metadata.
- Existing `Recipe` JSON without `knowledge` remains schema-valid.
- No LLM/provider call, cookbook ingestion, migration, new persistence layer, UI redesign, deployment, release, or real customer data.

---

### Task 1: Freeze the zero-seed behavior with failing contract tests

**Files:**
- Create: `tests/production-knowledge-foundation.test.ts`

**Interfaces:**
- Consumes existing `Recipe` objects and future exports from `@catering/shared-core`.
- Produces the behavioral contract for `evaluateRecipeKnowledgeMaturity(...)`, `evaluateRecipeEventUse(...)`, and `validateRecipeEventUseReview(...)`.

- [ ] **Step 1: Write RED tests for durable knowledge maturity**

Create fixtures in the test file for:

```ts
const baseRecipe: Recipe = {
  schemaVersion: "1.0.0",
  recipeId: "recipe-bootstrap-1",
  name: "Kartoffelgratin",
  source: {
    tier: "digitized_cookbook",
    originType: "cookbook",
    reference: "Professional reference",
    retrievedAt: "2026-08-17T10:00:00.000Z",
    approvalState: "review_required",
    qualityScore: 0.9,
    fitScore: 0.9,
    extractionCompleteness: 1
  },
  baseYield: { servings: 10, unit: "servings" },
  ingredients: [{ ingredientId: "potato", name: "Kartoffeln", quantity: { amount: 1.5, unit: "kg" }, group: "produce", normalizedUnit: "kg" }],
  steps: [{ index: 1, instruction: "Vorbereiten und garen." }],
  scalingRules: { defaultLossFactor: 1 },
  allergens: [],
  dietTags: ["vegetarian"]
};
```

Assert:

```ts
expect(evaluateRecipeKnowledgeMaturity(baseRecipe).status).toBe("review_required");
```

Add cases for `source_fact -> reference_only`, incomplete cookbook transcription -> `review_required`, AI candidate -> never durable `production_ready`, fully verified operational adaptation -> `production_ready`, and rejected recipe -> non-ready.

- [ ] **Step 2: Write RED tests for zero-seed event usability**

Add a candidate with:

```ts
knowledge: {
  artifactKind: "ai_derived_candidate",
  sourceCitation: { title: "Professional culinary reference" },
  derivation: { method: "ai_derivation" },
  production: {},
  verification: {
    sourceStatus: "verified",
    allergenStatus: "unverified",
    productionStatus: "unverified",
    verifiedBy: "Kitchen lead",
    verifiedAt: "2026-08-17T10:00:00.000Z"
  },
  version: { revision: 1 }
}
```

Assert that without event review it returns `kitchen_review_required`, not a generic missing-recipe failure.

Create review evidence:

```ts
const acceptedReview: RecipeEventUseReview = {
  eventSpecId: "spec-001",
  recipeId: "recipe-bootstrap-1",
  reviewedBy: "Kitchen lead",
  reviewedAt: "2026-08-17T10:15:00.000Z",
  decision: "accepted_for_event",
  confirmations: {
    quantitiesAndYield: true,
    methodAndEquipment: true,
    allergensAndDiet: true,
    holdingAndRegeneration: true
  }
};
```

Assert exact-event use is `event_usable`, reuse with `spec-002` fails, event rejection blocks, and an incomplete confirmation remains `kitchen_review_required`.

- [ ] **Step 3: Write RED validation tests**

Assert `validateRecipe(...)` rejects malformed knowledge metadata such as negative `revision`, negative lead/hold values, invalid enum values, and verified states with missing reviewer/timestamp. Assert bibliography metadata contains no required source-text field.

- [ ] **Step 4: Commit RED tests**

Commit only the new test file:

```bash
git add tests/production-knowledge-foundation.test.ts
git commit -m "test: define zero-seed recipe knowledge contract"
```

Expected CI/test state: new tests fail because the new types/evaluators do not exist yet; existing tests remain unaffected.

---

### Task 2: Add backward-compatible knowledge and event-review types/schema

**Files:**
- Modify: `shared-core/src/types.ts`
- Modify: `shared-core/src/schemas/recipe.ts`
- Modify: `shared-core/src/validation.ts`

**Interfaces:**
- Produces `RecipeKnowledge`, `RecipeKnowledgeArtifactKind`, `RecipeKnowledgeVerification`, `RecipeEventUseReview`, and optional `Recipe.knowledge`.
- Produces `validateRecipeEventUseReview(value: RecipeEventUseReview): RecipeEventUseReview`.

- [ ] **Step 1: Add domain types**

Add to `shared-core/src/types.ts`:

```ts
export type RecipeKnowledgeArtifactKind =
  | "source_fact"
  | "transcribed_recipe"
  | "operational_adaptation"
  | "ai_derived_candidate";

export interface RecipeKnowledge {
  artifactKind: RecipeKnowledgeArtifactKind;
  sourceCitation: {
    title: string;
    author?: string;
    edition?: string;
    publisher?: string;
    location?: string;
    sourceUrl?: string;
  };
  derivation: {
    basedOnRecipeId?: string;
    method: "direct_transcription" | "human_adaptation" | "ai_derivation" | "internal_original";
    notes?: string;
  };
  production: {
    yieldLossPercent?: number;
    prepLeadMinutes?: number;
    holdMinutes?: number;
    regenerationInstructions?: string;
    equipmentNotes?: string[];
    criticalParameters?: Array<{ name: string; value: number | string; unit?: string }>;
  };
  verification: {
    sourceStatus: "verified" | "unverified";
    allergenStatus: "verified" | "unverified";
    productionStatus: "verified" | "unverified";
    verifiedBy?: string;
    verifiedAt?: string;
  };
  version: {
    revision: number;
    supersedesRecipeId?: string;
  };
}

export interface RecipeEventUseReview {
  eventSpecId: string;
  recipeId: string;
  reviewedBy: string;
  reviewedAt: string;
  decision: "accepted_for_event" | "rejected_for_event";
  confirmations: {
    quantitiesAndYield: boolean;
    methodAndEquipment: boolean;
    allergensAndDiet: boolean;
    holdingAndRegeneration: boolean;
  };
}
```

Add `knowledge?: RecipeKnowledge` to `Recipe`.

- [ ] **Step 2: Extend recipe JSON schema strictly**

Add optional `knowledge` under `recipeSchema.properties` with `additionalProperties: false` on every nested object. Validate:

- strict artifact/method/status enums;
- `sourceCitation.title` non-empty;
- `version.revision` integer `minimum: 1`;
- `yieldLossPercent`, `prepLeadMinutes`, `holdMinutes` `minimum: 0`;
- critical parameter names non-empty;
- no source-text/content field.

Do not add `knowledge` to the recipe schema `required` list.

- [ ] **Step 3: Add semantic recipe validation**

In `validation.ts`, after schema validation, reject a recipe when any verification status is `verified` but `verifiedBy` or `verifiedAt` is missing/blank/invalid ISO date. Do not normalize or synthesize values.

- [ ] **Step 4: Add strict event-review validator**

Implement a pure validator requiring non-empty IDs/reviewer, valid ISO timestamp, allowed decision, and boolean confirmation fields. It must return the validated object unchanged or throw a deterministic validation error.

- [ ] **Step 5: Run focused tests and commit**

Expected: schema/type tests compile; evaluator tests still fail because evaluators do not yet exist.

Commit:

```bash
git add shared-core/src/types.ts shared-core/src/schemas/recipe.ts shared-core/src/validation.ts
git commit -m "feat: add recipe knowledge and event review contracts"
```

---

### Task 3: Implement pure maturity and event-use evaluators

**Files:**
- Create: `shared-core/src/recipe-knowledge-foundation.ts`
- Modify: `shared-core/src/index.ts`
- Test: `tests/production-knowledge-foundation.test.ts`

**Interfaces:**
- Produces:

```ts
export function evaluateRecipeKnowledgeMaturity(recipe: Recipe): {
  status: "reference_only" | "review_required" | "production_ready";
  blockers: string[];
};

export function evaluateRecipeEventUse(input: {
  recipe: Recipe;
  eventSpecId: string;
  review?: RecipeEventUseReview;
}): {
  status: "blocked" | "kitchen_review_required" | "event_usable";
  blockers: string[];
};
```

- [ ] **Step 1: Implement maturity evaluator fail-closed**

Rules in order:

1. rejected recipe -> `review_required`, blocker `recipe_rejected`;
2. missing knowledge -> `review_required`, blocker `knowledge_missing`;
3. `source_fact` -> `reference_only`;
4. `ai_derived_candidate` -> never durable `production_ready`; return `review_required` with `ai_candidate_not_durable`;
5. durable readiness requires source approval `approved_internal | auto_usable`;
6. durable readiness requires all three verification statuses `verified` plus valid reviewer/time;
7. otherwise `review_required` with named blockers;
8. when all conditions hold -> `production_ready`.

- [ ] **Step 2: Implement event-use evaluator**

Rules in order:

1. rejected recipe -> `blocked`;
2. `source_fact` -> `blocked`;
3. if durable maturity is `production_ready`, return `event_usable` subject to exact event input;
4. otherwise no review -> `kitchen_review_required`;
5. review recipe/event mismatch -> `blocked` with binding blocker;
6. `rejected_for_event` -> `blocked`;
7. any false confirmation -> `kitchen_review_required` with specific blocker(s);
8. complete accepted review -> `event_usable`.

Do not mutate `recipe`, `recipe.source.approvalState`, or `recipe.knowledge`.

- [ ] **Step 3: Export from package public surface**

Add:

```ts
export * from "./recipe-knowledge-foundation.js";
```

to `shared-core/src/index.ts`.

- [ ] **Step 4: Run focused tests until GREEN**

Run the new contract test and existing recipe validation/review suites. Expected: all new tests pass.

- [ ] **Step 5: Commit**

```bash
git add shared-core/src/recipe-knowledge-foundation.ts shared-core/src/index.ts tests/production-knowledge-foundation.test.ts
git commit -m "feat: evaluate zero-seed recipe readiness"
```

---

### Task 4: Regression verification and PR

**Files:**
- No product-code expansion beyond Tasks 1-3.
- Optionally update the design spec only if implementation revealed a contradiction; no scope growth.

**Interfaces:**
- Consumes all previous task outputs.
- Produces a reviewable PR with RED/GREEN evidence.

- [ ] **Step 1: Run focused regression group**

At minimum:

```bash
npm test -- tests/production-knowledge-foundation.test.ts tests/recipe-review-access.test.ts tests/production-recipe-review-state.test.ts tests/production-reference-material-bindings.test.ts
```

Expected: green.

- [ ] **Step 2: Run full build and full test suite**

```bash
npm run build
npm test
```

Expected: zero failures; existing skips may remain unchanged.

- [ ] **Step 3: Verify diff scope**

Confirm only the design/plan plus the focused knowledge-foundation files/tests changed. No provider, migration, deployment, UI, or real-data files.

- [ ] **Step 4: Open PR**

PR title:

```text
feat: add zero-seed production knowledge foundation
```

PR body must state:

- zero internal recipe library is supported;
- professional/AI candidates require event-specific kitchen review;
- event use does not imply durable internal approval;
- no LLM/provider, ingestion, migration, deployment, or real customer data;
- RED and GREEN commit SHAs;
- focused/full verification results.

- [ ] **Step 5: Review current-head CI and code findings**

Do not merge until `build-and-test` and `browser-rehearsal` are green and any material review finding is resolved.
