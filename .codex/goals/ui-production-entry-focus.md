# UI Production Entry Focus

Branch: product/ui-production-entry-focus

Goal:
Replace unclear production entry copy with concrete operator-facing production work language.

Observed issue:
The production route used internal phrasing such as production objects, quiet filtering and result zones in primary UI areas. During the internal synthetic operator probe, these words did not explain the next work step clearly.

Scope:
- Backoffice production UI copy only.
- Small state-helper copy updates.
- Matching UI tests.

Do not change:
- Backend behavior.
- Auth semantics.
- Persistence semantics.
- Recipe semantics.
- LLM or web behavior.
- Production calculations.
- Purchase quantities.
- Pricing or allergen decisions.

Success criteria:
- Primary UI copy tells the operator to review the production plan, purchase list, exports, source evidence and approval limits.
- Old internal phrasing is not visible in production UI source.
- Production plan, purchase list and export entry points remain visible.
- Tests, build and audit pass.
