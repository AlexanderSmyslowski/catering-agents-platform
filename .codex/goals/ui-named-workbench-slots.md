# UI Named Workbench Slots

Branch: product/ui-named-workbench-slots

Objective:
Replace fragile positional children wiring in the production workbench UI with
explicit named slots or typed props, without changing rendered behavior.

Why:
The production workbench is an operator-facing surface. Layout meaning should
not depend on child array position or CSS child index selectors.

Scope:
- `backoffice-ui/src/production-workbench.tsx`
- `backoffice-ui/src/production-route-main-layout.tsx`
- related production workbench CSS
- focused tests for slot wiring and current route behavior

Hard constraints:
- No product behavior changes.
- No UI redesign.
- No backend, route, auth, runtime, persistence, LLM, recipe, pricing, margin,
  source metadata, or allergen semantics changes.
- No broad `App.tsx` refactor.
- Keep the patch small and focused.

Success criteria:
1. Production workbench slots are named and typed.
2. Positional `children` wiring is removed from the workbench.
3. Production CSS no longer relies on production-column child indexes.
4. Existing rendered content and layout intent remain stable.
5. UI critical path, source metadata, MiniPilot gating, tests, build, audits,
   and diff checks pass.
