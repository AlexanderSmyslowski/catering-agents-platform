# Slice 2.3d: Package Classification Guardrails

Goal: fix the prompt-level taxonomy leak found in the 2.3c adjudication and make risky classifications visible before any 916-offer run.

Scope:
- Add negative package boundary rules for institution-framework and wedding packages.
- Treat `null` as an acceptable non-match in the prompt.
- Add report review lists for confidence below 0.7 and `null` classifications.

Acceptance:
- Prompt context contains the boundary rules before provider use.
- Pilot report exposes low-confidence and null classification sighting lists without raw offer text.
- Full 916-offer batch remains blocked until a reviewed re-pilot proves the guardrails.
