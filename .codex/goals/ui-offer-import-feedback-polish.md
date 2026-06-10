# UI Offer Import Feedback Polish

Branch: product/ui-offer-import-feedback-polish

Objective:
Polish the operator-facing request/import card and remove contradictory upload
feedback after rejected files.

Scope:
- No backend behavior changes.
- No auth, persistence, LLM or web-call changes.
- No unlimited uploads and no new upload backend.
- Keep the existing upload workflow.
- Keep patch small.

Success criteria:
- Primary UI says request/anfrage, not internal intake architecture.
- `Intake-Pfad` is not visible in operator UI.
- Rejected oversized files do not leave analysing/success notice visible.
- Error copy uses correct German.
- Intake document uploads use an explicit daily-use internal-MVP limit.
- UI and backend upload limits do not drift.
- Tests, build and audits pass.
- PR opened but not merged.
