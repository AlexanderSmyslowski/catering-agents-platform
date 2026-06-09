# Internal Beta Gate

## Objective

Create a clear, testable Go/No-Go gate for controlled internal beta usage of
the Catering Agents Platform.

The gate must answer what is allowed, what is forbidden, which checks must be
green before use, and which evidence proves the MVP core still works.

## Scope

This run may add concise operational documentation and a small executable gate
script that reuses existing tests and checks.

This run must not change product behavior.

## Hard Constraints

- Do not enable real customer data usage.
- Do not enable public deployment.
- Do not enable external customer access.
- Do not add SaaS or multi-tenant behavior.
- Do not add UI product features.
- Do not add recipe product behavior.
- Do not call external web recipe search.
- Do not call a real LLM provider.
- Do not weaken auth.
- Do not weaken data-safety gates.
- Do not weaken BYO LLM boundary.
- Do not weaken recipe candidate review gate.
- Do not change persistence backend.
- Do not add compliance or legal claims.
- Do not claim production readiness.
- Do not change pricing, margin, or allergen semantics.
- Do not perform broad refactors.
- Do not merge the PR.

## Readiness Evidence To Inventory

- Runtime service smoke.
- Docker Compose runtime smoke.
- Auth route matrix.
- Service critical path rehearsal.
- UI critical path rehearsal.
- Data-safety gates.
- BYO LLM boundary.
- Recipe candidate review gate.
- Export source metadata readability.
- Dependency audit.
- Upload and document ingestion safety.
- Local stack scripts.
- Product goal and beta-readiness docs.

## Success Criteria

- Internal beta allowed scope is explicit.
- Forbidden scope is explicit.
- Real data remains blocked by default.
- External provider calls remain disabled by default.
- LLM product writes remain forbidden.
- Unreviewed web recipe production use remains blocked.
- Critical service and UI paths are included in the gate.
- Audit, data-safety, BYO, recipe, and export checks are included.
- Executable gate exists or a precise reason is documented.
- Tests pass.
- Build passes.
- Audit remains clean.
- No product behavior changed.
- PR is opened.
- PR is not merged.
- Remaining risks are explicit.
