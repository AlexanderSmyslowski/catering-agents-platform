# ProductionDraft Review State

## Ziel
Den ProductionDraft-Import um einen kleinen, auditierbaren Review-State ergaenzen.

## Umfang
- Review-Karten eines pending_review-Drafts entscheiden
- Draft als approved oder rejected markieren
- Approval nur, wenn alle Review-Karten passen und kein Blocking-Risiko offen ist
- Audit-Metadaten ohne Review-/Prompt-/Response-Klartext

## Nicht in dieser Einheit
- Keine UI-Aenderung
- Keine Provider-Aufrufe
- Keine Produktwrites auf Spec, Plan, Einkaufsliste oder Rezepte
- Keine Wissensdatenbank-Uebernahme

## Abnahme
- Kartenentscheidung, Approval-Blocker und Reject-Lock sind getestet
- Auth-, Safety- und Audit-Vertraege kennen die neuen Routen
- npm test, build, audit/gate und diff-check sind gruen
