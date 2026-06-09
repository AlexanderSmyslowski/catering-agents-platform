# UI Operator Copy and Dev Panel Gate

## Objective

Make the Backoffice UI feel more like a precise internal catering work tool and
less like a rehearsal, debug, or agent infrastructure interface.

## Scope

This run may change operator-facing UI copy and gate the MiniPilot check panel
behind an explicit Vite flag.

This run must not change backend behavior, auth semantics, persistence,
recipe review, LLM behavior, production calculations, purchase quantities,
pricing, margin, or allergen semantics.

## Review Context

A UI review found that the tested backend and boundary layers are stronger than
the current operator-facing surface. The key issue is that normal screens still
show reviewer, rehearsal, scenario, and local command language.

## Hard Constraints

- Do not change backend behavior.
- Do not change auth semantics.
- Do not change persistence semantics.
- Do not change recipe review semantics.
- Do not change LLM behavior.
- Do not call a real LLM provider.
- Do not call external web search.
- Do not change production calculations.
- Do not change purchase quantities.
- Do not change pricing, margin, or allergen semantics.
- Do not redesign the UI.
- Do not add broad new UI behavior.
- Do not remove required safety or evidence information.
- Do not merge the PR.

## Success Criteria

- MiniPilot/debug panel is not visible by default to operators.
- MiniPilot/debug panel remains available with `VITE_SHOW_MINI_PILOT_PANEL=1`.
- Long rehearsal/project copy is reduced in primary operator flow.
- UI copy is more concise and operator-facing.
- Critical safety/evidence information remains visible.
- UI critical path remains green.
- Source metadata inline UI remains green.
- Data, LLM, and recipe gates remain green.
- Tests pass.
- Build passes.
- Audit remains clean.
- No backend or product semantics changed.
- PR is opened and not merged.
