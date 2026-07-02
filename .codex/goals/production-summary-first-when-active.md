Goal: Keep current production data visible before input when a production context exists.

Observed friction:
- Browser probe on /produktion showed the compact production summary starting below the first viewport (~1448px).
- Operators see the input area first even though plan and purchase data already exist.

Scope:
- Add a context class to the existing production workbench.
- Use CSS order to place the compact summary first only when current production context exists.
- No data, API, planning, recipe, or upload behavior changes.

Acceptance:
- With active plan/list/question data, the compact production summary renders before the composer.
- Empty/loading workbench behavior remains unchanged.
