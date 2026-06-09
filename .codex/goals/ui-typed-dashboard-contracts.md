# UI Typed Dashboard Contracts

Branch: product/ui-typed-dashboard-contracts

Goal:
Reduce loose dashboard data contracts in one narrow Backoffice UI slice without
changing product behavior.

Chosen slice:
- Production plan secondary details state.

Why this slice:
- It is UI-facing and currently accepts broad `Record<string, unknown>` data.
- It is already covered by focused tests.
- It renders recipe selection details, source evidence, scores, search traces,
  and kitchen sheet preview data.

Constraints:
- No UI behavior changes.
- No product behavior changes.
- No route, auth, runtime, persistence, LLM, or recipe matching changes.
- No broad dashboard refactor.
- No canonical shared-core model changes.
- Keep malformed or missing detail data on explicit fallback labels.

Success criteria:
1. The selected UI state builder exposes typed input contracts instead of broad
   public `Record<string, unknown>` contracts.
2. Unknown runtime data is normalized at the boundary through small local guards.
3. Existing labels, fallbacks, scores, traces, and source evidence remain stable.
4. A focused test covers malformed secondary detail entries.
5. Targeted tests, full tests, build, audits, and diff checks pass.
