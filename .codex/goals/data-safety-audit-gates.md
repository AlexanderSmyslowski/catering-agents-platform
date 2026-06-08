# Data Safety Audit Gates

## Objective

Make the MVP data-safety and audit boundary explicit and testable before real
customer data, external LLM providers, or external recipe/web research are allowed.

## Hard constraints

- Do not add UI behavior.
- Do not add BYO-LLM product behavior.
- Do not add recipe research product behavior.
- Do not call external services.
- Do not add real customer data.
- Do not create compliance or legal claims.
- Do not introduce a new persistence backend.
- Do not weaken auth.
- Do not weaken the critical path rehearsal.
- Keep patch small and focused.

## Current context

- Auth is fail-closed.
- Mutating route auth matrix is complete.
- Local runtime smoke exists.
- Docker Compose runtime smoke exists.
- Critical path rehearsal exists and uses synthetic data.
- LLM and web recipe search must remain gated.
- The platform is an internal controlled MVP, not public SaaS.

## Tasks

1. Inventory data ingress paths:
   - manual intake
   - document/upload ingestion
   - seed/demo paths
   - offer draft creation
   - production artifact creation
   - export paths
   - LLM/provider paths
   - web recipe search paths

2. Inventory audit/evidence paths:
   - intake mutations
   - offer mutations
   - production mutations
   - export/handoff paths
   - recipe discovery decisions, if currently represented
   - LLM draft/probe paths, if currently represented

3. Add or improve tests so:
   - synthetic/demo mode is explicit where used
   - real-data mode is off by default or clearly not enabled
   - external LLM/provider calls cannot receive non-synthetic data without an explicit gate
   - external web recipe search remains disabled by default
   - critical mutations produce audit or handoff evidence where current design intends it
   - exports are read-only evidence and do not silently approve product state

4. Do not implement a full compliance framework.
5. Do not invent retention or deletion policy unless current code already has hooks.
6. If a data-safety requirement requires a product decision, document it as a remaining risk.

## Validation

- npx vitest run tests/data-safety-audit-gates.test.ts
- npx vitest run tests/critical-path-rehearsal.test.ts
- npm test
- npm run build

## Success criteria

- data ingress paths are inventoried
- audit and evidence paths are inventoried
- default external provider and web paths remain gated
- synthetic vs real-data boundary is explicit
- key audit expectations are tested
- tests pass
- build passes
- no unrelated behavior changed
- remaining risks are explicit

## Stop conditions

- Stop and report if data classification is ambiguous.
- Stop and report if audit expectations conflict with current design.
- Stop and report if a real-data gate requires a product decision.
- Stop and report if fixing a gap requires broad architecture changes.
- Stop and report if LLM or web-provider safety cannot be tested without new product behavior.
