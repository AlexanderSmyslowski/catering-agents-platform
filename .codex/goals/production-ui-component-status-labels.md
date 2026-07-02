# Production UI Component Status Labels

## Ziel
Die Upload-Ergebnisliste soll fehlende Komponentendaten handlungsfaehig benennen statt einen leeren Doppelstatus zu zeigen.

## Umfang
- Komponenten-Detailstatus fuer fehlende Kategorie und Herstellungsart explizit benennen
- Bestehende Produktions- und Upload-State-Tests anpassen

## Nicht in dieser Einheit
- Kein Parser-/Matching-/Extraktionsumbau
- Kein Layout-Redesign
- Keine neue Heuristik

## Abnahme
- Fehlende Kategorie wird als `Kategorie offen` sichtbar
- Fehlende Herstellungsart wird als `Herstellungsart offen` sichtbar
- Tests, Build und Gate bleiben gruen
