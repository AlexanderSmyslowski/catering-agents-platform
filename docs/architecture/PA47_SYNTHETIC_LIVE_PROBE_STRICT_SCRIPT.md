# PA47 Synthetic-Live Probe Strict Script

## Ziel

Der bereits vorhandene Hard-Fail-Modus aus PA46 soll einen klaren und
bequemen npm-Script-Einstieg bekommen, damit er in lokalen Checks und kleinen
Automationsschritten konsistent genutzt werden kann.

## Umfang

- kein neuer Runner
- keine neue API
- keine Persistenz
- keine Schreibwirkung
- nur ein zusaetzlicher npm-Script-Alias

## Script

```bash
npm run llm:synthetic-live:probe:strict
```

Dieser Alias entspricht:

```bash
tsx scripts/run-synthetic-live-llm-readiness.ts --fail-on-eval-mismatch
```

## Nutzen

Damit ist der strikte synthetische Live-Probe-Modus nicht nur als
CLI-Option bekannt, sondern auch als kompakter, wiederholbarer Repo-Entry
sichtbar.
