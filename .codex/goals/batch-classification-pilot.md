# Slice 2.3a: Batch Classification Pilot

Goal: classify a small pseudonymized offer batch against the 13 curated offer packages and measure model suitability.

Scope:
- Pseudonymize offer text before provider use: no names, contacts, addresses or filenames.
- Add explicit `pseudonymized_approved` data mode for this pilot path.
- Run/report a 20-offer pilot for `gpt-4.1` vs `gpt-4.1-mini` without changing product behavior.

Acceptance:
- Pseudonymizer strips contact/name/address-like lines and keeps menu, pax and price evidence.
- LLM contract accepts only pseudonymized-approved classification inputs and stores no raw prompt/response/customer text.
- Pilot report records counts, package predictions, mismatches and measured request/cost metadata; the 916-offer run stays blocked.
