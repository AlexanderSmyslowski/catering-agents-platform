# ProductionDraft Import

## Ziel
Den BYO-AI-Harness-Vertrag als ersten Runtime-Schritt nutzbar machen:
schema-valide ProductionDrafts koennen importiert und gelistet werden.

## Umfang
- `POST /v1/production/drafts` und `GET /v1/production/drafts`
- Speicherung im bestehenden ProductionStore
- Operator-Gate, Safety-Inventar und Audit-Metadaten
- Tests fuer Import, Auth, Safety und Draft-only-Grenze

## Nicht in dieser Einheit
- Keine Provider-Aufrufe
- Keine Review-/Approval-Uebernahme
- Keine Produktwrites auf Spec, Plan, Einkaufsliste oder Rezepte
- Keine UI-Aenderung

## Abnahme
- Valider pending_review-Draft wird gespeichert und gelistet
- Invalid/non-pending wird mit 422 abgelehnt
- Audit enthaelt keine Review-/Prompt-/Response-Klartexte
- npm test, build, audit/gate und diff-check sind gruen
