# Dependency Audit Triage

## Objective

Inventory the current npm audit findings and choose the smallest safe response
without changing product behavior.

## Result

The production audit path was clean:

- `npm audit --omit=dev`: no vulnerabilities

The full audit reported one critical dev-tooling finding:

- package: `vitest`
- installed: `3.2.4`
- affected range: `<3.2.6`
- advisory: Vitest UI server arbitrary file read/execution
- surface: root dev dependency used for tests
- runtime exposure: not present in `--omit=dev`

## Decision

Use strategy A: safe minimal fix.

`vitest` is a direct root dev dependency, and the fixed version is a patch-level
update in the same `3.2.x` line. The dependency was updated to `^3.2.6` without
changing product, auth, runtime, persistence, Docker, BYO-LLM, recipe, or UI
behavior.

## Validation

Required validation:

- `npm audit --omit=dev`
- `npm audit`
- `npm test`
- `npm run build`

## Remaining Risk

This removes the currently reported npm audit finding. Future advisory churn can
still affect dev tooling and should be triaged with the same minimal-fix policy.
