# Internal Beta Gate

This gate defines the only currently allowed beta posture for the Catering
Agents Platform: controlled internal MVP rehearsal with non-real data and human
review. It is not a production readiness claim.

## Decision

The platform is a Go for controlled internal beta rehearsal only when the gate
script passes and the operator confirms the scope below.

The platform is a No-Go for public, external, customer-facing, real-data, SaaS,
or autopilot use.

## Allowed Scope

- Internal controlled MVP rehearsal.
- Synthetic data.
- Demo data.
- Anonymized test data only after explicit approval.
- Local or controlled internal environment.
- Human-reviewed outputs.
- Read-only export evidence.
- Provider calls disabled by default.

## Forbidden Scope

- Public internet exposure.
- External customer use.
- Real customer data by default.
- Production promise.
- SaaS or multi-tenant use.
- LLM writes to product objects.
- Unreviewed web recipes as production truth.
- Automatic allergen approval.
- Automatic price or margin approval.
- Unmanaged provider calls.

## Required Evidence

Run:

```bash
bash scripts/check-internal-beta-gate.sh
```

The gate currently checks:

- Production dependency audit: `npm audit --omit=dev`.
- Full dependency audit: `npm audit`.
- Runtime TS source and local service smoke tests.
- Mutating route auth matrix.
- Service critical path rehearsal.
- UI critical path rehearsal.
- Data-safety audit gates.
- BYO LLM boundary.
- Recipe research/calculation boundary.
- Recipe candidate review gate.
- Export source metadata readability.
- Upload and document ingestion safety.
- Full test suite: `npm test`.
- Build: `npm run build`.

Docker Compose reachability is covered by `platform-infra/scripts/smoke-compose-runtime.sh`
and should be run for container-specific release checks. It is not part of the
default internal beta gate because it requires Docker daemon availability.

## Go Conditions

- The gate script exits with status 0.
- The run used only synthetic, demo, or explicitly approved anonymized test data.
- No real provider call was required.
- No external web recipe search was required.
- Any generated offer, production, purchase, export, or recipe evidence was
  reviewed by a human operator before use.

## No-Go Conditions

- Any gate command fails.
- The intended run uses real customer data without a separate explicit decision.
- The intended run exposes the app publicly.
- The intended run includes external customers.
- The intended run requires unmanaged LLM or web-provider calls.
- The intended run treats unreviewed recipe candidates as production truth.
- The intended run relies on automatic allergen, price, or margin approval.

## Remaining Blockers

- Real customer data policy remains a separate product and governance decision.
- Public deployment remains blocked by default.
- External customer usage remains blocked.
- Provider usage remains constrained to explicit synthetic/demo boundaries.
- Recipe, allergen, price, and margin decisions still require deterministic code
  and human review.
