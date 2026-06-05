# PA53 Synthetic-Live Preflight Policy Hints

Status: kleiner Runtime-/Vertragstest-Schnitt innerhalb des vorhandenen lokalen
`synthetic_live`-Korridors
Stand: 2026-06-05
Scope: der bestehende Preflight aus PA49 bekommt zusaetzliche lokale
Policy-Hinweise fuer den in PA52 beschriebenen Operatorrahmen; kein neuer
Providerpfad, kein Deployment, keine neuen APIs, keine Persistenz, keine echten
Daten und keine Schreibwirkung

## Ziel

Der technische Preflight soll vor einem echten lokalen Probe-Lauf nicht nur
Flag, Env und Prompt-Artefakte pruefen, sondern auch die kleinsten
Policy-Hinweise aus PA52 sichtbar machen:

- benannter interner Operator,
- explizite lokale Budgetnotiz,
- Human Approval bleibt Pflicht,
- Raw Prompt-/Response-Logging bleibt verboten,
- der bevorzugte lokale Evidence-Weg bleibt `npm run llm:synthetic-live:check`.

## Umsetzung

Der Preflight bleibt weiter lokal und leichtgewichtig:

- fehlender Operatorname oder fehlende Budgetnotiz erzeugen nur Warnings,
  keine harten Errors,
- `ok` bleibt an den technischen Mussbedingungen haengen,
- `policyReady` trennt den weichen lokalen Bedienrahmen von den harten
  technischen Gates,
- bestehende Script-Einstiege bleiben unveraendert.

Optional lokale Policy-Env-Hinweise:

- `CATERING_SYNTHETIC_LLM_OPERATOR_NAME`
- `CATERING_SYNTHETIC_LLM_BUDGET_NOTE`

Diese Werte sind keine Secrets und bleiben fuer lokale Bedienbarkeit gedacht.
Sie duerfen nicht als Freigabe fuer Shared-, Deployment- oder Echte-Daten-Laeufe
missverstanden werden.

## Nicht-Ziele

- kein neuer Provider-Call
- keine Modell-Allowlist als hartes Runtime-Gate
- keine Kostenabrechnung
- keine Persistenz des Operatorkontexts
- keine neue Runtime-Orchestrierung
- keine Lockerung von Human Approval oder Logging-Grenzen
