Goal: run the human-approved 916-offer package classification batch as an eval/report artifact.

Scope:
- Enable full batch only via explicit CLI opt-in after human approval.
- Use `gpt-5.5` only, max 15 EUR / 1000 requests.
- Keep reports raw-text, raw-prompt and raw-response free.
- Add review lists for null, low-confidence, no-evidence and flying-boilerplate cases.
- Allow quota-safe resume runs by explicit `offer-...` source IDs.

Acceptance:
- Without `--allow-full-run`, `--limit 21` still fails.
- With `--allow-full-run`, dry-run proves the full-run guard can be lifted explicitly.
- Real 916 run writes only pseudonymized hashes, predictions, usage and review lists.
- Quota failures can be resumed without re-running already classified source IDs.
