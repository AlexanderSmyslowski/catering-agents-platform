# UI Critical Path Rehearsal

## Objective

Create a deterministic UI-level rehearsal for the internal MVP critical path.

The service/domain critical path already exists. This goal verifies that an
internal operator can see and follow the core workflow through the Backoffice UI,
using synthetic data only.

Critical path:

- Intake / Event request
- Offer draft or offer evidence
- Promote / accepted spec / handoff
- Production plan
- Purchase list
- Export / audit evidence

## Current Context

Recent merged work already established fail-closed auth, route auth matrix,
runtime smokes, Docker Compose runtime smoke, deterministic service-level
critical path rehearsal, data safety and audit gates, dependency audit cleanup,
BYO LLM boundary, recipe research/calculation boundary, recipe candidate review
gate enforcement, and export source metadata readability.

The system is an internal controlled MVP, not public SaaS and not production use
with real customer data.

## Hard Constraints

- Do not merge any PR.
- Do not use real customer data.
- Do not call a real LLM provider.
- Do not call external web recipe search.
- Do not add broad UI behavior.
- Do not redesign UI.
- Do not change auth semantics.
- Do not weaken data-safety gates.
- Do not weaken BYO LLM boundary.
- Do not weaken recipe candidate review gate.
- Do not change pricing or margin semantics.
- Do not add allergen approval behavior.
- Do not change persistence backend.
- Do not introduce broad service refactors.
- Do not make brittle snapshot-only tests.
- Do not rely on network calls outside the local app.
- Do not hide missing UI links by faking success.

## Preferred Approach

- Use existing browser or UI rehearsal infrastructure.
- Use synthetic fixtures.
- Assert user-visible facts.
- Prefer stable selectors and business-visible text.
- Add small test-only helpers only if needed.
- Document missing UI links explicitly.
- Avoid product behavior changes unless a tiny exposure of existing state is
  strictly necessary.

## Required Verification

- Inspect Backoffice UI, browser/rehearsal tests, local stack scripts, critical
  path service test, export routes, audit/evidence display and UI fixtures.
- Choose the smallest stable UI-level rehearsal.
- Add one focused rehearsal test or document a precise blocker.
- Preserve service critical path, data-safety gates, BYO LLM boundary, recipe
  candidate review gate and export source metadata readability.
- Run targeted UI/rehearsal tests, full tests, build, audit and diff hygiene.
- Commit, push and open a PR if the patch is commit-worthy.
- Do not merge the PR.

## Success Criteria

- One deterministic UI-level critical path rehearsal exists, or a precise
  blocker is documented.
- Synthetic data only is used.
- No real LLM provider is called.
- No external web recipe search is called.
- User-visible critical path facts are asserted.
- Missing UI links are explicit.
- Existing service-level critical path remains green.
- Export source metadata readability remains green.
- Recipe candidate review gate remains green.
- Data safety and BYO LLM boundaries remain green.
- Tests pass.
- Build passes.
- Audit remains clean.
- No unrelated product behavior changed.
- PR is opened if a patch is commit-worthy.
- PR is not merged.
- Remaining risks are explicit.
