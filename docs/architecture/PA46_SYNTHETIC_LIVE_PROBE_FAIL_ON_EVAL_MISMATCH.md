# PA46 Synthetic-Live Probe Fail-on-Eval-Mismatch

## Ziel

Der bestehende synthetische Probe-Runner soll optional hart fehlschlagen, wenn
ein echter `synthetic_live`-Lauf zwar technisch erfolgreich war, aber gegen die
synthetische Fixture-Erwartung driftet.

## Umfang

- kein neuer Runner
- keine neue API
- keine Persistenz
- keine Schreibwirkung
- nur ein optionaler CLI-Schalter ueber dem bestehenden PA44/PA45-Korridor

## Schalter

```bash
npm run llm:synthetic-live:probe -- --fail-on-eval-mismatch
```

## Verhalten

- normale Probe-Laeufe bleiben rein berichtend
- mit `--fail-on-eval-mismatch` setzt das Script Exit-Code `1`, wenn:
  - der Probe-Lauf selbst fehlschlaegt oder
  - `evaluation.valid === false`

## Nutzen

Damit kann derselbe lokale synthetische Live-Probe jetzt sowohl als
Beobachtungstool als auch als harter Automation-/CI-Guardrail dienen.
