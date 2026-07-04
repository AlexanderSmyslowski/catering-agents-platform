# Slice 2.2: Intake Shadow Mode

Goal: compare LLM extraction with the existing regex intake baseline for safe demo/anonymized inputs only.

Scope:
- Run LLM extraction in shadow next to regex normalization.
- Persist only comparison metadata, hashes, and field-level diffs.
- No product object writes, no switch-over, no raw prompt/response/text storage.
- Reject real or unapproved customer text.

Acceptance:
- Same safe input yields baseline and LLM extraction side by side without changing the accepted request/spec path.
- Differences are review/audit friendly and raw-text free.
- Non-demo/non-anonymized text is rejected before provider execution.
