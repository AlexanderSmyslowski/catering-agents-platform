# ProductionDraft Apply Approved

## Ziel
Freigegebene ProductionDrafts kontrolliert in bestehende Produktobjekte uebernehmen.

## Umfang
- Neuer Operator-Endpunkt fuer approved ProductionDrafts
- Konfliktpruefung gegen bestehende Zielobjekte
- Uebernahme von AcceptedEventSpec, ProductionPlan und PurchaseList
- Applied-Metadaten am Draft
- Minimaler UI-Button nach Freigabe

## Nicht in dieser Einheit
- Kein Provider-Aufruf
- Kein Rezept-/Wissens-Writeback
- Keine neue Persistenzwelt
- Keine automatische Uebernahme vor menschlicher Freigabe

## Abnahme
- Pending Drafts werden nicht uebernommen
- Abweichende bestehende Zielobjekte blockieren
- Audit enthaelt IDs und Counts, aber keine Review-/Draft-Klartexte
- Tests, Build, Audit und Gate bleiben gruen
