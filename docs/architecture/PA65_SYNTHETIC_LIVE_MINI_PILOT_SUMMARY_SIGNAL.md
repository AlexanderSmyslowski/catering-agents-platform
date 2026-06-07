## PA65 Synthetic-Live Mini-Pilot Summary Signal

PA64 liefert bereits einen gebuendelten lokalen Mini-Pilot-Check.
PA65 macht dessen Ergebnis fuer einen menschlichen Operator leichter lesbar:
das JSON traegt jetzt ein kleines `summary`-Signal mit Status, Grund und
naechstem Schritt.

### Ziel

Ein interner Operator soll nicht mehrere Felder manuell zusammensuchen muessen,
um zu verstehen, ob der Mini-Pilot-Lauf freigegeben ist oder warum er blockiert
bleibt.

### Umsetzung

- `scripts/check-synthetic-live-mini-pilot.ts` gibt zusaetzlich `summary` aus
- `summary.status` ist `ready` oder `blocked`
- `summary.reason` erklaert den dominanten Grund
- `summary.nextStep` nennt den naechsten sicheren Bedienhinweis

### Warum das klein genug ist

PA65 fuehrt

- keinen neuen Providerpfad,
- keine neue API,
- keine Persistenz,
- kein Deployment,
- keine UI,
- und keine Produktschreibwirkung

ein.

Es ist nur ein lesbarer Ergebnisanker ueber dem bestehenden lokalen
Mini-Pilot-Check.

### Erfolgskriterium

PA65 ist erreicht, wenn:

- der Mini-Pilot-Check bei Erfolg `ready` meldet,
- bei fehlendem Rahmen, Probe-Fehler oder Eval-Drift ein klares `blocked`
  Signal kommt,
- fokussierte Tests und `npm run build` gruen sind.
