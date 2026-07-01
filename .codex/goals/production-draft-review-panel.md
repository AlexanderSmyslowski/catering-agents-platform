# ProductionDraft Review Panel

## Ziel
ProductionDraft-Review im Produktionsfenster sichtbar und einfach bedienbar machen.

## Umfang
- Vorhandene ProductionDrafts laden
- Review-Karten mit klaren Buttons entscheiden
- Draft freigeben oder verwerfen
- UI bleibt draft-only und nutzt bestehende Operator-Header

## Nicht in dieser Einheit
- Keine Import-UI
- Keine Provider-Aufrufe
- Keine Produktuebernahme in Spec, Plan, Einkaufsliste oder Rezepte
- Kein Wissensdatenbank-Writeback

## Abnahme
- Operator-Labels zeigen keine rohen Status-/Providerwerte
- Buttons rufen die draft-only Review-Endpunkte auf
- Backoffice-Smokes, npm test, build, audit/gate und diff-check sind gruen
