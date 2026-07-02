# ProductionDraft Recipe Candidates

## Ziel
Rezeptkarten aus approved ProductionDrafts als review-pflichtige Kandidaten in die bestehende RecipeLibrary uebernehmen.

## Umfang
- Apply-Pfad speichert valide Draft-Rezepte ueber das bestehende Repository
- Approval-State wird immer auf `review_required` gesetzt
- Konfliktpruefung verhindert abweichendes Ueberschreiben bestehender Rezepte
- Applied-Metadaten nennen uebernommene Rezept-IDs

## Nicht in dieser Einheit
- Keine automatische Rezeptfreigabe
- Kein Produktionsfeedback-Loop
- Kein Provider-Aufruf
- Keine neue Persistenz

## Abnahme
- Draft-Rezept mit behaupteter Freigabe landet als `review_required`
- Abweichendes bestehendes Rezept blockiert mit 409
- Audit enthaelt Counts/IDs, aber keinen Rezept-Klartext
- Tests, Build, Audit und Gate bleiben gruen
