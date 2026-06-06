## PA63 Synthetic-Live Mini-Pilot Probe Guard

PA62 hat den freigegebenen Mini-Pilot-Rahmen als Policy im Repo verankert.
PA63 macht daraus den kleinsten echten Guardrail am sichtbaren Bedienpunkt:
ein dedizierter Probe-Entry darf nur laufen, wenn der bestehende Preflight auch
wirklich `miniPilotReady` meldet.

### Ziel

Der erste enge Mini-Pilot-Befehl soll nicht nur dokumentieren, was erlaubt ist,
sondern den erlaubten Rahmen auch vor dem eigentlichen Probe-Lauf hart
pruefen.

### Umsetzung

- `scripts/run-synthetic-live-llm-readiness.ts` versteht
  `--require-mini-pilot-ready`.
- Mit diesem Flag wird vor dem Probe-Lauf der vorhandene
  `runLlmReadinessSyntheticLivePreflight(...)` ausgefuehrt.
- Wenn der Preflight selbst fehlschlaegt oder `miniPilotReady === false`
  meldet, wird kein Probe-Lauf gestartet.
- `package.json` bekommt den klaren lokalen Bedienpunkt:

```bash
npm run llm:synthetic-live:probe:mini-pilot
```

### Warum das klein genug ist

PA63 fuehrt

- keine neue Provider-Runtime,
- keine neue API,
- keine Persistenz,
- kein Deployment,
- keine UI,
- und keine Produktschreibwirkung

ein.

Es ist nur ein zusaetzlicher lokaler Guardrail ueber dem bereits vorhandenen
`synthetic_live`-Korridor.

### Erfolgskriterium

PA63 ist erreicht, wenn:

- der neue Mini-Pilot-Probe-Entry nur mit voll markiertem PA62-Rahmen laeuft,
- bestehende `probe`- und `probe:strict`-Kommandos unveraendert nutzbar bleiben,
- fokussierte Tests und `npm run build` gruen sind.
