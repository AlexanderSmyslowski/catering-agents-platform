# Slice 2.3c: Batch Model Rebaseline

Goal: rebaseline the 20-offer package classification pilot on current OpenAI model IDs before any 916-offer run decision.

Scope:
- Default batch-pilot model pair becomes `gpt-5.5` vs `gpt-5.4`.
- Re-run only the 20-offer pseudonymized pilot; no product writes.
- Keep the full 916-offer run blocked until Alexander reviews the rebaseline result.

Acceptance:
- Dry-run/default tests prove the script no longer defaults to `gpt-4.1`.
- Provider pilot reports counts, usage, disagreements and pre-provider skips without raw offer text.
- `npm test`, `tsc`, build, audit and internal beta gate stay green.
