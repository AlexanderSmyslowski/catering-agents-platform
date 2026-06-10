# UI Production Context Summary

Branch: product/ui-production-context-summary

Objective:
Replace technical production context copy in the operator-facing production
summary with a concise human-readable production summary.

Observed operator-probe finding:
The active production context panel showed raw system labels such as:
- Plan-Kontext geladen: plan-spec-demo-production-coffee
- Spezifikation: spec-demo-production-coffee
- Klarheit: -
- Planstatus: unzureichend
- Ergebnisobjekte: 1 Plan(e) · unzureichend

Scope:
- No backend behavior changes.
- No auth, persistence, recipe review, LLM or web-search changes.
- No production calculation, purchase quantity, pricing, margin or allergen changes.
- Keep auditability by preserving technical IDs as secondary details where useful.
- Keep patch small and operator-facing.

Success criteria:
- Primary production summary is human-readable.
- Raw fixture IDs are not the primary headline.
- Status explains what the operator should know or check.
- Safety and approval boundaries remain visible.
- Technical IDs, if present, are secondary.
- Tests, build and audits pass.
- PR opened but not merged.
