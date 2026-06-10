# UI Fix Offer Entry Actions

Branch: product/ui-fix-offer-entry-actions

Objective:
Fix operator-probe findings where visible offer/production entry actions looked
like primary work but had no clear visible effect.

Observed findings:
1. `+ Angebot hinzufuegen` was clicked first and felt inert.
2. `+ Angebot auswaehlen` in the drag-and-drop area felt like a dead upload
   promise.
3. `Arbeitsbereich lokal leeren` and `Fehlupload archivieren` looked like
   normal peer actions although they are demo/local maintenance actions.

Scope:
- Production input panel entry copy and action hierarchy.
- Existing file picker / drag-and-drop path only.
- Existing local cleanup / soft-archive actions only.

Constraints:
- No new offer creation workflow.
- No backend behavior changes.
- No auth, persistence, pricing, margin, allergen, LLM, or web-search changes.
- No real data.
- No broad UI redesign.
- Do not merge the PR.

Success criteria:
1. No visible primary entry action promises generic offer creation.
2. File import is named as file import and uses the existing file picker path.
3. Drag-and-drop copy is truthful about supported files and visible feedback.
4. Local/destructive/demo actions are separated under a secondary maintenance
   area with consequence-oriented labels.
5. Targeted tests, full tests, build, audits, and diff checks pass.
