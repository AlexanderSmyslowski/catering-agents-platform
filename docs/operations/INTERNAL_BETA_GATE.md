# Internal Beta Gate

This gate defines the only currently allowed beta posture for the Catering
Agents Platform: controlled internal MVP rehearsal with non-real data and
human review. It is not a production readiness claim and not a compliance
claim.

## Decision rule

- **Go** for controlled internal beta rehearsal only when
  `scripts/check-internal-beta-gate.sh` exits 0 **and** the operator confirms
  the run stays inside the allowed scope below.
- **No-Go** for anything public, external, customer-facing, real-data,
  SaaS, or autopilot — regardless of gate status.

## Allowed scope

- Internal controlled MVP rehearsal.
- Synthetic data and demo data.
- Anonymized test data only if explicitly approved beforehand.
- Local or controlled internal environment.
- Human-reviewed outputs.
- Read-only export evidence (HTML/CSV artifacts inspected by an operator).
- Provider calls disabled by default (BYO-LLM boundary stays closed).

## Forbidden scope

- Public internet exposure.
- External customer use.
- Real customer data by default.
- Any production promise.
- SaaS or multi-tenant use.
- LLM writes to product objects.
- Unreviewed web recipes as production truth.
- Automatic allergen approval.
- Automatic price or margin approval.
- Unmanaged provider calls (LLM or web search).

## Required evidence

Run:

```bash
bash scripts/check-internal-beta-gate.sh
```

The gate runs, in order:

1. `npm audit --omit=dev` — production dependency audit.
2. `npm audit` — full dependency audit.
3. `tests/mutating-route-auth-matrix.test.ts` — fail-closed auth on all mutating routes.
4. `tests/critical-path-rehearsal.test.ts` — service critical path
   (Intake → Offer → Production → Purchase List → Exports/Audit).
5. `tests/ui-critical-path-rehearsal.test.ts` — the same path through the rendered UI.
6. `tests/data-safety-audit-gates.test.ts` — data safety and audit gates.
7. `tests/byo-llm-boundary.test.ts` — no unmanaged provider calls.
8. `tests/recipe-candidate-review-gate.test.ts` — web recipe candidates require review.
9. `tests/export-source-metadata-readability.test.ts` — export provenance readable.
10. `tests/shared-mini-pilot-workbench-flow.test.tsx` — gated dev-panel workbench flow
    (also proves `.test.tsx` inclusion is intact).
11. `npm test` — full suite.
12. `npm run build` — UI build.

Docker Compose reachability is covered separately by
`platform-infra/scripts/smoke-compose-runtime.sh`; it needs a Docker daemon and
is a container-release companion check, not part of the default gate.

## Go conditions

- Gate script exits 0.
- Run uses only synthetic, demo, or explicitly approved anonymized test data.
- No real LLM provider call and no external web search was required.
- Every generated offer, production, purchase, export, or recipe artifact is
  reviewed by a human operator before any operational use.

## No-Go conditions

- Any gate command fails.
- The intended run uses real customer data without a separate explicit decision.
- The intended run exposes the app publicly or includes external customers.
- The intended run requires unmanaged LLM or web-provider calls.
- The intended run treats unreviewed recipe candidates as production truth.
- The intended run relies on automatic allergen, price, or margin approval.

## Remaining blockers (outside this gate)

- Real-customer-data policy is a separate product and governance decision.
- Public deployment and external customer usage remain blocked by default.
- Provider usage remains constrained to explicit synthetic/demo boundaries.
- Allergen, price, and margin decisions require deterministic code plus human
  review; this gate verifies the boundaries exist, not that they are
  legally sufficient.
