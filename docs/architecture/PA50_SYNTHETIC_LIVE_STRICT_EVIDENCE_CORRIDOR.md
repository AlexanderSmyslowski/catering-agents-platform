# PA50 Synthetic-Live Strict Evidence Corridor

## Ziel

Der bereits vorhandene lokale `synthetic_live`-Preflight und der strikte
Probe-Lauf sollen auch als ein gemeinsamer Repo-Entry sichtbar sein, damit
ein Operator den kompletten lokalen Evidence-Korridor mit einem Befehl
ausfuehren kann.

## Umfang

- kein neuer Providerpfad
- keine neue API
- keine Persistenz
- keine Schreibwirkung
- nur ein gebuendelter lokaler Entry fuer den vorhandenen
  Preflight- plus Strict-Probe-Weg

## Script

```bash
npm run llm:synthetic-live:check
```

Dieser Entry fuehrt nacheinander aus:

```bash
npm run llm:synthetic-live:preflight
npm run llm:synthetic-live:probe:strict
```

## Nutzen

Damit bleibt der `synthetic_live`-Korridor nicht nur aus Einzelbausteinen
auffindbar, sondern auch als wiederholbarer lokaler Guardrail- und
Evidence-Check.

## Nicht-Ziele

Dieser Entry ist kein Deployment, kein UI-Test, kein Echte-Daten-Korridor,
keine Produktionsfreigabe und keine neue Runtime-Orchestrierung.
