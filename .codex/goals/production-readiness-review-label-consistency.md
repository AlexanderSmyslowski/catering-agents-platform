# Production Readiness Review Label Consistency

- Reproduced in fresh production probe: the route showed open questions while spec detail surfaces still said "vollständig".
- Fix only presentation consistency for the focused production spec.
- Reuse the existing operator readiness label such as "Prüfung nötig"; do not invent a new readiness state.
- Do not change question storage, normalization, planning, purchase calculation, schemas, or services.
- Validate with focused state/render-adjacent tests, full suite/build, and diff hygiene.
