# Korridor — Autonomer Modus (bindend)

Gilt, wenn Codex ohne menschliche Interaktion in einem Loop arbeitet.
Ziel ist NICHT maximaler Output, sondern: nur das abzuarbeiten, was ohne
Alexander sicher entscheidbar ist, und alles andere sauber für die
Sichtung aufzustauen.

## ERLAUBT (ohne Mensch entscheidbar)

- Fix eines REPRODUZIERTEN, dokumentierten Befunds (failing test ODER
  Reibungsnotiz). Der Fix adressiert die WURZEL, nicht das Symptom.
- Grün→grün: Test-/Build-/Typfehler reparieren, die bestehende Funktion
  wiederherstellen.
- Eine konkrete, vorab in der Queue als `ERLAUBT` benannte Aufgabe.

## VERBOTEN (wartet auf Mensch)

- UI-/Label-/Styling-/Umbau-Politur ohne dokumentierten Reibungsbefund.
- Neue Heuristik/Regex/Sonderfall — besonders in der Wegwerf-Zone
  (intake-signals, procurement-Filter).
- Neue Module/Services/pa-Gates/Governance-/Readiness-Module.
- Alles auf der "NICHT bauen"-Liste der Vorhaben-Analyse.
- Symptom-Fix (Sonderfall am sichtbaren Fehler verkleben).
- Doku-Zeilen > Produkt+Test-Zeilen je PR (außer expliziter Doku-PR).
- Merge, Push auf main, Anfassen von docs/agent-memory/.

## DISZIPLIN je Einheit

- Goal-File → kleiner Branch → Validierungsbatterie (`vitest run`,
  `build`, `git diff --check`) → Draft-PR. NIE mergen.
- Abnahmepunkte = Fallklassen + reales Verhalten, NIE Artefakt-Existenz.
- Tool-Selbstauskunft nie glauben; jede Werkzeug-Behauptung durch realen
  Aufruf mit beigelegtem Output belegen.
- ≤4000 Zeichen, 2–3 vorab benannte Abnahmepunkte je Einheit.

## WENN KEINE ERLAUBTE ARBEIT MEHR DA IST

- KEINE neue Arbeit erfinden. Nicht dokumentieren, um Fortschritt zu zeigen.
- Menschenpflichtige Befunde als je EINE Queue-Zeile sammeln
  (Was · Wo · warum menschliche Entscheidung nötig).
- Dann ANHALTEN und ausgeben: `WARTE AUF MENSCH: <N> offene Entscheidungen`.
