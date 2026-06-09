# Internal Beta Gate

## Objective

Create a clear, testable Go/No-Go gate for controlled internal beta usage:
a concise operations doc plus an executable gate script. No product or UI
behavior changes; no real data, public deployment, external access, or
provider calls are enabled. No production/compliance readiness claim.

## Readiness evidence inventory (as of this goal, on main)

- Auth matrix: `tests/mutating-route-auth-matrix.test.ts`
  (supported by `tests/access-control.test.ts`, `tests/trusted-identity-access.test.ts`,
  `tests/intake-finalize-access.test.ts`, `tests/recipe-review-access.test.ts`).
- Local runtime smoke: `tests/runtime-service-smoke.test.ts`,
  `tests/runtime-single-source.test.ts`; operational scripts
  `scripts/start-local-stack.sh`, `scripts/check-local-ops.sh`.
- Docker Compose runtime smoke: `platform-infra/scripts/smoke-compose-runtime.sh`
  (requires a Docker daemon; release-check companion, not part of the default gate).
- Service critical path: `tests/critical-path-rehearsal.test.ts`.
- UI critical path: `tests/ui-critical-path-rehearsal.test.ts`.
- Data safety / audit gates: `tests/data-safety-audit-gates.test.ts`.
- BYO-LLM boundary: `tests/byo-llm-boundary.test.ts` (no real provider calls;
  providers disabled by default).
- Recipe candidate review gate: `tests/recipe-candidate-review-gate.test.ts`
  (plus `tests/recipe-research-calculation-boundary.test.ts`,
  `tests/production-web-recipe-search-gate.test.ts`).
- Export source metadata readability: `tests/export-source-metadata-readability.test.ts`.
- Inline source metadata in production UI: `tests/production-purchase-list-preview.test.ts`,
  `tests/production-plan-secondary-details-state.test.ts`.
- Dependency audit: `npm audit` and `npm audit --omit=dev` report 0 vulnerabilities.
- `.test.tsx` inclusion: `vitest.config.ts` includes `tests/**/*.test.tsx` (PR #477),
  so `tests/shared-mini-pilot-workbench-flow.test.tsx` runs in `npm test`.

## Deliverables

1. `docs/operations/INTERNAL_BETA_GATE.md` — allowed/forbidden scope,
   Go/No-Go conditions, required evidence, remaining blockers.
2. `scripts/check-internal-beta-gate.sh` — executable gate running the audits,
   the named boundary/rehearsal suites, the full test suite, and the build.

## Constraints

No real customer data, no public deployment, no external customer access,
no product/UI behavior, no real LLM providers, no external web search,
no weakening of auth/data-safety/BYO-LLM/recipe-review/export gates,
no production or compliance readiness claim, no PR merge.

## Validation

- `scripts/check-internal-beta-gate.sh` exits 0.
- `npm test`, `npm run build`, `npm audit --omit=dev`, `npm audit`,
  `git diff --check` all clean.
- Hidden/bidi/control checks on changed files; exact-SHA raw checks after push.
- Draft PR; Ready for Review only when CI is green. Do not merge.

## Note

A previous unmerged draft of this gate exists on the stale branch
`hardening/internal-beta-gate` (37bc656). This goal recreates it from the
current main so the evidence list and script match the merged state
(post PR #473–#477), with the `.test.tsx` suite included.
