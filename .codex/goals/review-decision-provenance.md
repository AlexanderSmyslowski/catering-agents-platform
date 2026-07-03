# Review Decision Provenance

- Phase 1.2: prove every non-pending ProductionDraft review-card decision carries server-side provenance.
- Scope: schema contract plus review-card route spoof test.
- Acceptance: fits/change_requested/unclear/blocked require decidedBy/decidedAt; route ignores client-spoofed decidedBy and uses actor context.
- No product behavior, API, schema or UI changes unless a failing test proves a gap.
