# Service Slimming

## Objective

Reduce service file size and improve route/domain separation without changing
product behavior.

This is a conservative refactor goal. The patch must keep route paths, HTTP
methods, status codes, auth requirements, request shapes, response shapes,
persistence behavior, recipe review behavior, exports, pricing, allergen logic,
LLM behavior, and web-search behavior unchanged.

## Starting Inventory

Line counts before this extraction:

| File | Lines before | Route groups observed |
| --- | ---: | --- |
| `intake-service/src/app.ts` | 732 | health, normalize, document ingest/upload, manual spec, seed demo |
| `intake-service/src/routes/work-item-routes.ts` | 264 | request/spec list/detail/update/archive/finalize |
| `offer-service/src/app.ts` | 363 | health, seed demo, recipe list/detail/import/upload/review |
| `offer-service/src/routes/draft-routes.ts` | 163 | draft create/from-text/list/detail/promote |
| `production-service/src/app.ts` | 410 | health, artifacts, seed demo, audit, recipe list/detail/import/upload/review |
| `production-service/src/routes/artifact-routes.ts` | 130 | production plans and purchase lists |
| `print-export/src/index.ts` | 381 | health, offer HTML, production HTML, purchase CSV |

Candidate notes:

- `intake-service/src/app.ts` is largest, but the remaining upload and
  normalization routes still share deeper app-local helper logic. It is a good
  future target, not the safest first slimming cut.
- `offer-service/src/app.ts` still has recipe routes, but the production recipe
  route group has stronger route/auth/upload/audit coverage in existing tests.
- `production-service/src/app.ts` already has one route module
  (`artifact-routes.ts`). Extracting the remaining recipe route group follows an
  existing local pattern.
- `print-export/src/index.ts` is cohesive export rendering and is less attractive
  for this first no-behavior refactor.

## Chosen Extraction

Extract exactly one route group:

- from: `production-service/src/app.ts`
- to: `production-service/src/routes/recipe-routes.ts`

Moved routes:

- `GET /v1/production/recipes`
- `GET /v1/production/recipes/:recipeId`
- `POST /v1/production/recipes/import-text`
- `POST /v1/production/recipes/upload`
- `PATCH /v1/production/recipes/:recipeId/review`

Moved helpers:

- recipe text import body type
- recipe review body type
- multipart field reader
- multipart recipe import helper

## Behavior Invariants

Must remain unchanged:

- Production recipe routes still require the production operator role.
- Production upload validation, limits, text extraction, and error mapping stay
  identical.
- Recipe import and review audit actions stay identical.
- Route paths, HTTP methods, status codes, and response payloads stay identical.
- Recipe repository and audit log usage stay identical.
- No recipe discovery, review, pricing, allergen, LLM, web-search, export,
  persistence, or UI behavior changes.

## After Inventory

Line counts after this extraction:

| File | Lines after |
| --- | ---: |
| `production-service/src/app.ts` | 232 |
| `production-service/src/routes/recipe-routes.ts` | 233 |
| `production-service/src/routes/artifact-routes.ts` | 130 |

`production-service/src/app.ts` is reduced by 178 lines and now focuses on
service assembly, health, artifact routes, seed demo, audit, and route module
registration.

## Validation Plan

Targeted tests:

- `tests/recipe-review-access.test.ts`
- `tests/upload-security.test.ts`
- `tests/p4-audit-traceability.test.ts`
- `tests/production-web-recipe-search-gate.test.ts`
- `tests/mutating-route-auth-matrix.test.ts`
- `tests/p1-role-guards.test.ts`

Cross-cutting tests:

- `tests/critical-path-rehearsal.test.ts`
- `tests/ui-critical-path-rehearsal.test.ts`
- `tests/recipe-candidate-review-gate.test.ts`
- `tests/export-source-metadata-readability.test.ts`
- `tests/data-safety-audit-gates.test.ts`
- `tests/byo-llm-boundary.test.ts`

Full checks:

- `npm test`
- `npm run build`
- `npm audit --omit=dev`
- `npm audit`
- `git diff --check`

## Result

Validated in this branch.

Observed results:

- Targeted production recipe route/auth/upload/audit tests passed.
- Critical-path and safety gate tests passed.
- `npm test` passed with 320 test files and 1324 tests.
- `npm run build` passed.
- `npm audit --omit=dev` passed with 0 vulnerabilities.
- `npm audit` passed with 0 vulnerabilities.
- `git diff --check` passed.
- Hidden/bidi/control checks passed for changed files.

No route path, method, status code, response shape, auth requirement,
persistence behavior, recipe trust behavior, export behavior, LLM behavior,
web-search behavior, pricing behavior, margin behavior, allergen behavior, or
UI behavior was intentionally changed.
