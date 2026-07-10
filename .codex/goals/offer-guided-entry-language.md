Goal: make the offer route understandable without internal platform vocabulary.

Trigger: the operator probe found unclear actions such as normalizing intake
text and creating specifications, with no clear explanation of the outcome.

Scope:
- Offer-route copy, first-use state and presentation only.
- Existing text, file and manual submission handlers stay unchanged.

Acceptance:
- The offer route starts with an empty request field and a clear next action.
- Normalization, specification and audit jargon is absent from operator copy.
- Draft IDs stay inside technical details; human-readable labels lead the UI.
- Offer happy path, tests, typecheck, build and beta gate stay green.
