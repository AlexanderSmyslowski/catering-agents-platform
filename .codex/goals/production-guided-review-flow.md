Goal: turn the observed post-upload production chaos into one guided review flow.

Trigger: Operator probe 2026-07-05 showed that, after uploading an offer PDF,
the production route jumped into internal component forms and scattered the
real next action behind technical fields.

Scope:
- Backoffice production UI presentation and action order only.
- No API, schema, LLM, recipe matching, planning, purchase or export changes.

Acceptance:
- Upload completion keeps the operator at a calm summary, not in the component
  editor.
- The next required action is visible and actionable before technical details.
- Source retry, text correction, manual entry and maintenance actions are
  clearly optional and no longer look like the normal next step.
- Tests, typecheck, build, audit and internal beta gate stay green.
