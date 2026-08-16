# Reference-Order Production Acceptance Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a deterministic, fail-closed acceptance contract for the existing synthetic/reference-order artifacts and document exactly why the current repository cannot yet claim a complete kitchen-ready production basis.

**Architecture:** Keep the existing offer, handoff, production-plan, purchase-list and recipe models as the source of truth. Add one shared-core evaluator that reads those artifacts plus an opaque, resolver-issued evidence token and returns `ready`, `blocked`, or `not_assessed` with named blockers; caller strings and caller-shaped objects are never evidence. The token carries persisted ApprovalRequest/Handoff/Audit IDs and is only issued after the integration boundary cross-checks those records. Do not generate missing source, prices, recipes, allergens, or operator approval. A repository-local checklist records the existing Koepff fixture, its available seeds, and the missing evidence without storing raw documents or customer data.

**Tech Stack:** TypeScript, Vitest, existing `@catering/shared-core` models, Markdown documentation. No new dependency, provider call, persistence layer, migration, or deployment change.

## Global Constraints

- Use only existing repository fixtures/seeds and clearly synthetic data; never invent customer or production data.
- Preserve fail-closed behavior: missing source bytes, unresolved components, review-required recipes, incomplete purchase coverage, or absent kitchen sign-off cannot become `ready`.
- Do not call OpenAI/Codex or any external provider; tests use in-memory artifacts only.
- The focused evaluator tests use synthetic artifacts, while the persisted
  integration test obtains ApprovalRequest, ApprovedOffer, Handoff and Audit
  records through the existing OfferService routes before issuing evidence.
- Do not change Git metadata, create commits, push, merge, deploy, or alter the canonical dirty checkout.
- Keep raw prompts, provider responses, source text, secrets, and private data out of reports and documentation.

---

### Task 1: Freeze the existing reference evidence and write the failing acceptance tests

**Files:**
- Create: `tests/production-reference-acceptance.test.ts`

**Interfaces:**
- Consumes existing `OfferDraft`, `AcceptedEventSpec`, `ProductionPlan`, `PurchaseList`, and `Recipe` values.
- Produces failing examples for an incomplete Koepff reference and a complete synthetic artifact set.

- [x] **Step 1: Write the failing tests**

  Load `tests/fixtures/production-reference-cases/koepff-flying-buffet-45p.expected.json` and the existing `data-seeds/recipes-koepff/*.json` files. Assert that the evaluator contract (before it exists) reports named blockers for the absent source bytes, `review_required` recipe approvals, incomplete offer review, and missing operator sign-off. Add a separate in-memory artifact case whose every required component, batch ingredient, purchase item, recipe status, provenance hash, and checklist item is present and assert that it can become `ready` only with explicit `rescueChatUsed: false` operator evidence.

- [x] **Step 2: Run the focused test to verify RED**

  Run `npx vitest run tests/production-reference-acceptance.test.ts` from the isolated worktree. The expected failure is a missing evaluator module/export, not a fixture or test syntax error.

### Task 2: Implement the fail-closed reference acceptance evaluator

**Files:**
- Create: `shared-core/src/production-reference-acceptance.ts`
- Modify: `shared-core/src/index.ts`
- Test: `tests/production-reference-acceptance.test.ts`

**Interfaces:**
- Consumes `ProductionReferenceAcceptanceInput` containing source provenance, offer evidence, production artifacts, recipes, optional operator evidence, and an opaque validated-evidence token.
- Produces `ProductionReferenceAcceptanceResult` with `status`, deterministic checklist entries, and `blockers`.

- [x] **Step 1: Define the contract**

  Define the statuses `ready | blocked | not_assessed`. Require an expected source hash and observed source hash, an offer pricing summary plus explicit review status, a production plan and purchase list, recipe snapshots, and an operator checklist. Keep the evaluator pure and deterministic.

- [x] **Step 2: Implement the minimal checks**

  Return named blockers when persisted evidence is absent/mismatched, source provenance is malformed/absent/mismatched, offer pricing or review status is incomplete, `full_cost_model` lacks a supported complete breakdown, the plan is not complete or has unresolved/blocking items, readiness IDs are not a bijection over batches and kitchen sheets, ingredient/purchase quantities are not positive finite values with units, a batch ingredient has no matching purchase item/source recipe, a selected recipe is not `approved_internal` or `auto_usable`, allergens/diet tags are missing, or operator acceptance/sign-off is absent or does not explicitly record `rescueChatUsed: false`. Do not infer a missing value or silently downgrade a blocker.

- [x] **Step 3: Run focused tests to verify GREEN**

  Run `npx vitest run tests/production-reference-acceptance.test.ts tests/production-reference-persisted-acceptance.integration.test.ts tests/koepff-production-reference-corridor.test.ts tests/production-gold-run.test.ts`. Confirm the existing incomplete fixture remains blocked, the complete synthetic artifact set requires a resolver-issued token, and the persisted approval/handoff/audit path is exercised.

### Task 3: Document the current reference-order acceptance boundary

**Files:**
- Create: `docs/product/REFERENCE_CASE_ACCEPTANCE_CHECKLIST.md`

**Interfaces:**
- Consumes the existing expectation fixture, recipe seeds, pricing model, production-plan fields, and evaluator result.
- Produces a non-sensitive checklist for a later human/operator run.

- [x] **Step 1: Record available evidence**

  Identify the anonymous Koepff expectation fixture, its source hash, the eleven review-required recipe seeds, existing pricing as module-catalog estimates, and the existing production/export contracts. Do not copy source text or customer data.

- [x] **Step 2: Record precise blockers and required inputs**

  Mark the reference case `blocked`/`not_assessed` until a matching approved local source artifact, accepted event/offer evidence, verified pricing basis, approved recipe/allergen decisions, complete purchase coverage, and human kitchen sign-off are supplied. State that no external provider call or GPT rescue conversation is a substitute for these inputs.

- [x] **Step 3: Add the operator checklist**

  Include checkboxes for source hash/provenance, offer pricing/review, component readiness, scaled quantities, purchase coverage, recipe approval/allergens, kitchen-sheet usability, and explicit `rescueChatUsed: false` sign-off. Keep the document a status/checklist artifact, not a release approval.

### Task 4: Verify the bounded candidate

**Files:**
- All files above, including `tests/production-reference-persisted-acceptance.integration.test.ts`; no further scope.

- [x] **Step 1: Run focused contracts and type checks**

  Run `npx vitest run tests/production-reference-acceptance.test.ts tests/koepff-production-reference-corridor.test.ts tests/koepff-recipe-seeds.test.ts tests/production-folder-export.test.ts`, then `npx tsc --noEmit`.

- [x] **Step 2: Run build and patch hygiene**

  Run `npm run build` and `git diff --check`. Confirm no background process remains and `git status --short --untracked-files=all` contains only the planned files.

- [x] **Step 3: Report honestly**

  Report the exact diff and verification evidence. The result is `ready` only if complete synthetic artifacts, a resolver-issued persisted-evidence token and explicit operator evidence are present; the repository's real Koepff reference remains blocked until the checklist inputs exist. Do not claim pilot or production readiness.
