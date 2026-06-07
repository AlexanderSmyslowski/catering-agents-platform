## PA64 Synthetic-Live Mini-Pilot Check Entry

PA63 hat den Probe-Lauf selbst an den Mini-Pilot-Rahmen gebunden.
PA64 legt darueber den kleinsten kompletten Operator-Einstieg:

```bash
npm run llm:synthetic-live:check:mini-pilot
```

Der Befehl liefert einen zusammenhaengenden lokalen Evidence-Check fuer den
freigegebenen Mini-Pilot-Rahmen.

### Ziel

Ein benannter interner Operator soll den engen Mini-Pilot-Korridor mit genau
einem lokalen Befehl pruefen koennen, statt Preflight und Guarded-Probe
gedanklich selbst zusammenzusetzen.

### Umsetzung

- neues Script `scripts/check-synthetic-live-mini-pilot.ts`
- fuehrt zuerst den vorhandenen `synthetic_live`-Preflight aus
- fuehrt danach denselben Guarded-Probe-Weg wie PA63 aus
- gibt ein gemeinsames JSON mit `preflight`, `probe`, `ok` und `errors` aus
- scheitert hart bei fehlendem PA62-Rahmen, Probe-Fehler oder Eval-Drift

### Warum das klein genug ist

PA64 fuehrt

- keinen neuen Providerpfad,
- keine neue API,
- keine Persistenz,
- kein Deployment,
- keine UI,
- und keine Produktschreibwirkung

ein.

Es ist nur ein zusaetzlicher lokaler Bedienpunkt ueber dem bereits vorhandenen
Preflight-, Probe- und Mini-Pilot-Guard-Korridor.

### Erfolgskriterium

PA64 ist erreicht, wenn:

- `npm run llm:synthetic-live:check:mini-pilot` als repo-weiter Einstieg
  sichtbar ist,
- der Befehl ohne voll markierten PA62-Rahmen fehlschlaegt,
- der Befehl bei vollstaendigem Mini-Pilot-Rahmen gruen laufen kann,
- fokussierte Tests und `npm run build` gruen sind.
