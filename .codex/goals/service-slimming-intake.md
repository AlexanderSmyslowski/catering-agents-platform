# Service Slimming Intake

## Objective

Slim one cohesive route/helper group out of `intake-service/src/app.ts`
without changing product behavior.

This is a conservative refactor goal. The patch must keep route paths, HTTP
methods, status codes, auth checks, request shapes, response shapes, persistence
behavior, document ingestion behavior, upload security behavior, normalization
behavior, LLM behavior, recipe behavior, export behavior, pricing behavior, and
UI behavior unchanged.

## Starting Inventory

Line counts before this extraction:

| File | Lines before | Route groups observed |
| --- | ---: | --- |
| `intake-service/src/app.ts` | 732 | health, normalize, document JSON upload, document multipart upload, manual spec, seed demo, work-item module registration |
| `intake-service/src/routes/work-item-routes.ts` | 264 | request/spec list/detail/update/archive/finalize |
| `production-service/src/app.ts` | 232 | health, artifacts module, seed demo, audit, recipe module |
| `offer-service/src/app.ts` | 363 | health, seed demo, recipe list/detail/import/upload/review |
| `print-export/src/index.ts` | 381 | health, offer HTML, production HTML, purchase CSV |

Candidate notes:

- Work-item routes are already extracted and should not be revisited here.
- Manual spec and seed demo routes are smaller and less meaningful as a
  slimming target.
- Normalize route is central and tightly tied to text extraction semantics.
- Document JSON and multipart upload routes share a cohesive helper cluster:
  source metadata creation, document validation, multipart parsing, ingestion,
  EventRequest construction, AcceptedEventSpec normalization, and audit logging.
  This group has strong existing coverage.

## Chosen Extraction

Extract exactly one route/helper group:

- from: `intake-service/src/app.ts`
- to: `intake-service/src/routes/document-routes.ts`

Moved routes:

- `POST /v1/intake/documents`
- `POST /v1/intake/documents/upload`

Moved helpers:

- document body type
- multipart document upload type
- safe document ingestion summary formatter
- raw input kind mapping for document MIME types
- multipart document extraction helper
- uploaded document normalization helper

## Behavior Invariants

Must remain unchanged:

- Both document routes still require the intake operator role.
- JSON/base64 document upload behavior stays identical.
- Multipart document upload behavior stays identical.
- Upload validation, upload limits, metadata validation, document ingestion,
  and upload error mapping stay identical.
- EventRequest and AcceptedEventSpec construction stays identical.
- Audit action, entity type, summary text, and details stay identical.
- Store writes stay identical.
- Route paths, HTTP methods, status codes, and response payloads stay
  identical.
- No normalization, document-ingestion, auth, persistence, UI, LLM, recipe,
  export, pricing, margin, or allergen behavior changes.

## After Inventory

Line counts after this extraction:

| File | Lines after |
| --- | ---: |
| `intake-service/src/app.ts` | 460 |
| `intake-service/src/routes/document-routes.ts` | 311 |
| `intake-service/src/routes/work-item-routes.ts` | 264 |

`intake-service/src/app.ts` is reduced by 272 lines and now focuses on service
assembly, health, text normalization, manual spec creation, seed demo, and route
module registration.

## Validation Plan

Targeted intake tests:

- `tests/upload-security.test.ts`
- `tests/pa11-intake-document-ingestion-bridge.test.ts`
- `tests/intake-soft-archive.test.ts`
- `tests/platform.test.ts`
- `tests/p1-role-guards.test.ts`
- `tests/mutating-route-auth-matrix.test.ts`

Cross-cutting tests:

- `tests/critical-path-rehearsal.test.ts`
- `tests/ui-critical-path-rehearsal.test.ts`
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

- Targeted intake document/auth/upload tests passed.
- Critical-path and data/LLM gate tests passed.
- `npm test` passed with 320 test files and 1324 tests.
- `npm run build` passed.
- `npm audit --omit=dev` passed with 0 vulnerabilities.
- `npm audit` passed with 0 vulnerabilities.
- `git diff --check` passed.
- Hidden/bidi/control checks passed for changed files.

No route path, method, status code, response shape, auth requirement,
persistence behavior, document ingestion behavior, upload security behavior,
normalization behavior, export behavior, LLM behavior, recipe behavior, pricing
behavior, margin behavior, allergen behavior, or UI behavior was intentionally
changed.
