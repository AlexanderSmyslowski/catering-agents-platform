# Production Next Step Artifact Priority

- Reproduced in fresh production probe: top next step said "Rückfragen beantworten" while the output anchor said "Einkaufspositionen klären".
- Fix only the UI next-step priority once a production plan exists.
- Visible artifact blockers win over generic remaining questions; questions still win when no artifact blocker is visible.
- Do not change question storage, planning, purchase calculation, exports, schemas, or services.
- Validate with focused route/status tests, full suite/build, and diff hygiene.
