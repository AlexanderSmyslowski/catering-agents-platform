Goal: Remove visible singular/plural grammar slips from core operator summaries.

Scope:
- Fix offer draft summary labels for one variant and one open point.
- Fix production result strip label for one purchase list.
- Replace visible read-only wording in the production workbench with German operator text.
- Keep all data contracts and behavior unchanged.

Acceptance:
- Operator UI no longer renders "1 Varianten", "1 offene Punkte", or "1 Liste(n)".
- The production workbench no longer exposes "Read-only" or "read-only" copy.
- Existing smoke coverage remains green with updated wording.
