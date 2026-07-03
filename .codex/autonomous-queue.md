# Autonome Queue

**Aktive Phase: 1 (Harness-Kern)** — Phasenfolge, Loop-Regeln und
Endziel: `.codex/ziellauf.md` (bindend seit 2026-07-03). Die Queue wird
nur aus der aktiven Phase gespeist; die nächste Phase öffnet erst mit
einem `GATE QUITTIERT: <Phase>`-Eintrag von Alexander unter ERLEDIGT.

Steuerung für den autonomen Codex-Loop (siehe `autonomous-corridor.md`).
Codex zieht nur Einträge mit Status `ERLAUBT` von oben. Alles andere ist
Stauraum für Alexanders Sichtung. Ist kein `ERLAUBT`-Eintrag da, hält der
Loop an mit `WARTE AUF MENSCH: <N> offene Entscheidungen`.

Status-Werte: `ERLAUBT` (autonom abarbeitbar) · `ZUR SICHTUNG` (wartet auf
menschliche Entscheidung) · `ERLEDIGT` (mit Branch-/PR-Referenz).

---

## ERLAUBT

_(Befüllt von Fable am 2026-07-03 aus Ziellauf Phase 1. Reihenfolge
bindend; 1.2 baut auf 1.1 auf und wird auf dessen Branch gestapelt,
falls 1.1 noch nicht gemerged ist.)_

1. **1.5 Ballast-Inventur** · report-only, vom WIP-Limit ausgenommen,
   kein PR · Klassifikation gegen Pflichtenheft §9: intake-signals-
   Regexe (Eval-Baseline-Status), llm-readiness-Module (eingefroren vs.
   gebraucht), Branch `slice4-codex-procurement-guard` (Procurement-
   Filter-Frage), tote UI-/Import-Pfade.
   Abnahme: (a) Jeder Löschkandidat mit Beweisführung (Test/Flow/
   Ersatzartefakt) + Zeilenumfang; (b) Abschluss-Empfehlung je Eintrag:
   löschbar jetzt / löschbar nach X / behalten; (c) KEINE Löschung.

---

## ZUR SICHTUNG (menschenpflichtig)

### 2026-07-03 · Produktfrage #494

PR #494 `codex/production-plan-clarification-gate` bleibt offen: Soll
Produktionsplanung bei blockierenden Rückfragen hart gesperrt sein? Empfehlung
aus der Triage: alten PR nicht direkt mergen; wenn fachlich ja, als frischen
kleinen Loop-Slice neu bauen.

### 2026-07-03 · Optionaler Branch-Cleanup nach Gate 0

Remote-Tracking-Branches ohne offenen PR und zwei lokale unmerged Branches
bleiben bewusst liegen. Kein autonomes Löschen ohne neuen Cleanup-Auftrag.

---

## ERLEDIGT

- Slice 1.4 Übergabe-Reproduktion ohne Codefix abgeschlossen: Auf
  frischer Datenwurzel wurde `draft-demo-offer-conference-buffet`
  Variante `variant-2` über die UI übernommen. `/produktion` fokussierte
  danach `Konferenz · 180 Teilnehmer · 2026-11-20` als aktuellen Vorgang.
  Nach strukturierten Antworten (`classic` + `scratch` für beide
  Komponenten) erzeugte die UI den Plan
  `plan-draft-demo-offer-conference-buffet-variant-2` und die Liste
  `purchase-draft-demo-offer-conference-buffet-variant-2`; Plan-HTML,
  Produktionsmappe-HTML und Einkaufslisten-CSV lieferten HTTP 200.
  Ergebnis: Juni-Blocker auf aktuellem Stand nicht reproduziert; kein
  Branch, kein Code.
- Slice 1.3 Wissenstyp production_feedback abgeschlossen in Branch
  `loop/production-feedback-knowledge`, Draft-PR #548
  <https://github.com/AlexanderSmyslowski/catering-agents-platform/pull/548>.
  Belegt: pending/rejected erscheinen nicht in geprüfter Wissenssicht,
  approved erscheint; Approval nur über Produktions-Operator und
  serverseitige Provenienz; forbidden/raw payloads und zu lange Inhalte
  werden abgewiesen. Batterie grün: `npm test` 269 Dateien / 1176 Tests,
  Build, Audit, Hidden/Bidi-Check und Internal-Beta-Gate.
- Slice 1.2 Entscheidungs-Provenienz abgeschlossen in Branch
  `loop/review-decision-provenance`, Draft-PR #547
  <https://github.com/AlexanderSmyslowski/catering-agents-platform/pull/547>.
  Belegt: fits/change_requested/unclear/blocked brauchen
  `decidedBy`/`decidedAt`; Client-Spoofing dieser Felder wird von der
  Route ignoriert und durch den Server-Actor ersetzt. Batterie grün:
  `npm test` 268 Dateien / 1167 Tests, Build, Audit, Hidden/Bidi-Check
  und Internal-Beta-Gate.
- Slice 1.1 E2E-Kettentest abgeschlossen in Branch
  `loop/e2e-harness-chain`, Draft-PR #546
  <https://github.com/AlexanderSmyslowski/catering-agents-platform/pull/546>.
  Belegt: Draft-only-Zählungen 0/0/0 bis Apply, danach 1/1/1 plus
  Produktionsmappen-Export 200; Apply auf pending/rejected/superseded
  409 ohne Bestandsänderung. Batterie grün: `npm test` 268 Dateien /
  1166 Tests, Build, Audit, Hidden/Bidi-Check und Internal-Beta-Gate.
- **GATE QUITTIERT: 0** · Alexander entschied am 2026-07-03
  "Ja, alles wie empfohlen." Umgesetzt: #545 gemerged; #496/#497/#500/#503/
  #504/#506 gemerged; #484 gemerged; Alt-PRs #490/#505/#508/#511/#512/#515/
  #48/#491/#492/#498/#499/#509/#510/#493/#513/#514/#495/#501/#507/#502
  geschlossen; #494 offen gelassen; 36 lokal in `main` gemergte Branches
  gelöscht; 0.2 Batterie-Beschleunigung gestrichen, weil aktuelles Budget
  erfüllt ist.
- Slice 0.1 Alt-PR-Stapel #490-#515 plus #543/#484/#48 triagiert;
  Umsetzung erfolgte in der Gate-0-Session.
- Operator-Probe 2026-07-03 auf frischer Datenwurzel durchgeführt und in
  `docs/product/OPERATOR_PROBE_NOTIZ_2026-06.md` ergänzt. Rehearsals grün:
  `npm run browser:rehearsal`, `npm run browser:rehearsal:answer-submit`.
  Reproduzierter Blocker: sichtbarer Produktionsmappe-Link für aktuellen
  Seed-Plan liefert 404.
- Reproduzierter Blocker aus Operator-Probe behoben und gemerged mit PR #545
  `loop/production-folder-current-plan-404`: Production-Seed persistiert
  seine Specs, `local:check` prüft den Produktionsmappen-Link, Batterie
  grün.
- Ziellauf 0.3 Stale-Branch-Inventur durchgeführt; Report steht unter
  Gate-0-Umsetzung; 36 lokal in `main` gemergte Branches gelöscht.
- PR #538 `codex/purchase-handoff-empty-honesty` wurde gemerged
  (`6b8659e7d8b306d0dc18409c650bf8d11ba595ad`); der alte
  Sichtungseintrag ist damit erledigt.
- Computer Use ist verfügbar: `mcp__computer_use.list_apps` lieferte am
  2026-07-03 laufende Mac-Apps zurück. Der alte Blocker
  "Freigabe fehlt" ist damit überholt.
- PDF-Semantik-Richtung entschieden: Alexander wählte A
  (BYO-AI/ProductionDraft-Harness), und PR #535 stärkt diesen Pfad über
  per-Artefakt-Review-Abdeckung. Weitere Arbeit braucht jetzt entweder
  einen konkreten Slice oder einen reproduzierten Befund.
- PR #535 `codex/production-draft-review-coverage` auf ausdrückliche
  menschliche Freigabe gemerged; `main` steht auf Merge-Commit `f50d70e`,
  Post-Merge-Checks und `scripts/check-internal-beta-gate.sh` grün.
- Korridor-Datei `autonomous-corridor.md` im Repo nachgezogen (war zuvor
  nur im Chat) — bindende Regeln jetzt aus der vorgesehenen Quelle prüfbar.
- Zwei Verhaltensfixes aus `codex/operator-probe-polish` nach
  `slice4-codex-procurement-guard` gerettet (`b1af3c1`, `613c8a8`),
  Validierungsbatterie grün; reine UI-Politur verworfen.
- Entscheidung 1A festgehalten: Slice-4 / Procurement wird erst nach
  `npm run local:start:fresh` plus späterer Operator-Probe bewertet. Wenn
  der Befund im Frischlauf wieder auftritt, folgt ein Wurzelfix upstream;
  wenn nicht, gilt der Slice als Altdaten-Rauschen und wird verworfen.
- Entscheidung 3A festgehalten: Für weitere Entscheidungen zählt nur ein
  Fresh-Run; `./data` wird nicht autonom bereinigt oder soft-archiviert.
- Entscheidung 4A umgesetzt: PR #488 geschlossen; kein weiteres
  C12-Prozess-/Triage-Dokument.
- Technischer Fresh-Beleg am 2026-06-29: `npm run local:start:fresh`,
  `npm run local:status`, `npm run local:check` grün auf temporärer
  Datenwurzel; `./data` blieb unangetastet. Fresh-Seed enthielt zwei
  Einkaufslisten mit 0 Positionen, daher kein reproduzierter
  Procurement-Pollution-Befund im Seed, aber auch kein fachlicher
  Abschluss ohne Operator-Probe.
- `npm run browser:rehearsal:full-fresh` grün: normaler Kernpfad,
  Answer-Submit, Soft-Archiv und Failed-Upload wurden jeweils auf
  temporären synthetischen Datenwurzeln geprüft.
