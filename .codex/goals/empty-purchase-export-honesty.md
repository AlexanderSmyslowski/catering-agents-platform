Goal: Hide purchase-list export links for current or archived lists with zero resolved positions.
Evidence: Fresh /produktion showed "1 Liste ohne Positionen" and still offered "Einkaufsliste exportieren".
Scope: backoffice UI presentation only; no export route, schema, persistence, or purchasing logic changes.
Acceptance:
- Empty purchase lists show a clear unavailable-export message.
- Purchase lists with positions still show the existing CSV export link.
- Focused tests, full suite, build, diff-check, and internal beta gate pass.
