# Export Source Metadata Readability Finish and Review

## Objective

Finish, harden and review the current export source metadata readability patch.

The patch should make recipe source metadata visible in human-facing production
and purchase exports while preserving existing calculation, planning,
review-gate, data-safety and LLM-boundary guarantees.

This is a finish-and-review goal, not a new feature expansion goal.

## Intended Behavior

- Purchase CSV keeps existing columns and appends source evidence columns.
- Production HTML shows per-batch recipe source evidence.
- ProductionBatch, KitchenSheet and PurchaseItem can carry optional source
  metadata.
- Legacy or missing metadata is explicit as source unknown.
- Exports remain read-only evidence.
- No recipe, allergen, pricing, margin or production approval is added.
- No LLM call, web call, UI behavior or persistence change is added.

## Hard Constraints

- Do not merge any PR.
- Do not start a new unrelated branch.
- Do not add UI behavior.
- Do not add recipe review workflow.
- Do not call external web recipe search.
- Do not call a real LLM provider.
- Do not send real customer data anywhere.
- Do not weaken recipe candidate review gate.
- Do not weaken data-safety gates.
- Do not weaken BYO LLM boundary.
- Do not weaken auth.
- Do not change pricing or margin semantics.
- Do not add allergen approval behavior.
- Do not change persistence backend.
- Do not perform broad refactors.
- Do not remove existing export fields.
- Do not reorder existing CSV columns.
- Do not make exports imply recipe, allergen, pricing or margin approval.
- Do not make source metadata required for old objects.
- Do not change numeric scaling or purchasing quantities except to carry source
  metadata.

## Required Verification

- Inspect and classify the full diff.
- Prove source metadata is appended or carried, not used for calculations.
- Prove purchase quantities remain unchanged.
- Prove production batch/task data remains unchanged except added evidence.
- Prove legacy production and purchase objects without optional metadata remain
  valid.
- Prove missing metadata renders explicit fallback text.
- Prove reviewed web and internal source metadata are human-visible.
- Prove unreviewed web candidates remain blocked.
- Run targeted boundary tests, full tests, build, audit and diff hygiene checks.
- Commit, push and open a Draft PR if all checks pass.
- Do not merge the PR.

## Output Requirements

Report:

- branch name
- commit SHA
- PR URL and draft/ready status
- changed and removed files
- diff classification by file
- export surfaces inspected
- source metadata behavior before and after
- export fields added or changed
- calculation invariants verified
- schema/backward-compatibility verification
- tests added or updated
- commands run
- test/build/audit result
- exact-SHA/raw/hidden-character result
- remaining risks
- whether the PR is ready for human review
- confirmation that the PR was not merged
