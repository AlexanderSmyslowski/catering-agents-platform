# PA49 Synthetic-Live Operator Env Preflight

## Ziel

Vor dem eigentlichen `synthetic_live`-Probe-Lauf soll es einen kleinen,
lokalen Vorab-Check geben, der die Bediengrenzen des Korridors sichtbar macht:
Feature-Flag aktiv, notwendige Env-Werte gesetzt, Prompt-Artefakte vorhanden
und mindestens eine synthetische Clarification-Fixture verfuegbar.

## Umfang

- kein Provider-Call
- keine UI
- keine API
- keine Persistenz
- keine Runtime-Conversation
- keine Schreibwirkung
- nur lokaler Operator-/Env-Preflight fuer den bereits vorhandenen
  `synthetic_live`-Korridor

## Script

```bash
npm run llm:synthetic-live:preflight
```

Der Check gibt lokales JSON aus und beendet sich mit Exit-Code `1`, wenn
Feature-Flag, Env-Contract oder die internen Readiness-Anker nicht stimmen.

## Gepruefte Grenzen

- `CATERING_SYNTHETIC_LLM_SLICE` muss aktiviert sein.
- `OPENAI_API_KEY` und `CATERING_SYNTHETIC_LLM_MODEL` muessen gesetzt sein.
- Der anschliessende Default-Transport benoetigt zusaetzlich den serverseitig
  bestimmten Business-Kontext, Region, Kostenrahmen, Retention-/Training-Fakten,
  einen expliziten Endpoint und eine passende Approval-Datei ausserhalb des
  Repos. Der Preflight ersetzt diesen Approval-Abgleich nicht.
- Prompt-Schema und Prompt-Artefakte fuer
  `clarification_draft_request` muessen vorhanden bleiben.
- Mindestens eine synthetische Clarification-Fixture muss verfuegbar bleiben.

## Nicht-Ziele

Dieser Preflight ist kein echter Providerlauf, kein Eval-Nachweis, kein
Deployment, kein Echte-Daten-Korridor und keine Produktionsfreigabe.
