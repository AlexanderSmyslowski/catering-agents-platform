# PA45 Synthetic-Live Probe Eval Comparison

## Ziel

Der PA44-Probe-Runner soll nach einem echten `synthetic_live`-Lauf nicht nur
`response`, `AgentAudit` und `RunResult` zeigen, sondern auch die direkte
Bewertung gegen die zugehoerige synthetische Fixture-Erwartung.

## Umfang

- keine neue Runtime
- keine neue API
- keine Persistenz
- keine Schreibwirkung
- nur eine kleine Eval-Schicht ueber dem bestehenden Probe-Lauf

## Ergebnis

Der Probe-Output enthaelt jetzt zusaetzlich:

- `evaluation.valid`
- `evaluation.errors`
- kompakte Check-Felder fuer:
  - `outputKindMatches`
  - `humanApprovalMatches`
  - `writesProductObjectMatches`
  - `sourceRefsMatch`
  - `textMatches`
  - `structuredCandidateMatches`

## Nutzen

Damit sehen wir bei einem echten synthetischen Providerlauf sofort den
Unterschied zwischen:

- technisch erfolgreich ausgefuehrt
- vertraglich erfolgreich gegen die synthetische Erwartung bestanden

Der Korridor bleibt dabei weiter klein, lokal und produktfrei.
