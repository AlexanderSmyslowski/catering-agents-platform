Ziel: Die Produktions-UI darf unzureichende Plaene oder leere Einkaufslisten
nicht als pruefbereite Produktionsarbeit rahmen.

Ausloeser: Operator-Probe-Befund #7 ist auf main f50d70e im Fresh-Stack
sichtbar: Plan unzureichend, Einkaufsliste 0 Positionen, aber Next Step klingt
zu optimistisch.

Umfang: Nur backoffice-ui State-Selectoren und Tests. Kein Backend, keine
Planungslogik, keine neuen Heuristiken.

Abnahme:
- Next Step benennt Nacharbeit, wenn der Plan unzureichend ist.
- Next Step benennt fehlende Einkaufspositionen, wenn Listen leer sind.
- Tests, Build, diff-check und Internal Beta Gate bleiben gruen.
