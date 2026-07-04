# Autonome Queue

**Aktive Phase: 2 (Echte KI-Anbindung)** — Phasenfolge, Loop-Regeln und
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

_Keine Einträge._

---

## ZUR SICHTUNG (menschenpflichtig)

- **Provider-Quota für Slice 2.3d weiterhin blockiert.** · Alexander
  gab am 2026-07-04 den Resume frei (`gpt-5.5`, max. 333 Requests,
  max. 10 EUR). Der Resume wurde exakt mit der lokalen Liste
  `/tmp/catering-offer-package-night-run-quota-source-ids.txt`
  gestartet, aber alle 333 Provider-Versuche kamen ohne Tokenverbrauch
  mit `current quota exceeded` zurück. Für einen weiteren Versuch muss
  zuerst im Provider-Dashboard/Billing real Headroom geschaffen werden;
  vorher keine weiteren Provider-Calls. Die Resume-Liste bleibt gültig
  (333 IDs, `offer-570` bis `offer-916`).

---

## ERLEDIGT

- Slice 2.3d Resume-Versuch ausgeführt in Branch
  `loop/offer-package-night-run`. Freigabe: `gpt-5.5`, max. 333
  Requests, max. 10 EUR. Dry-Run belegte exakt 333 Restfälle
  (`offer-570` bis `offer-916`) und 0 Provider-Requests. Realer Resume:
  333 Quellen / 333 geplante Requests / 333 Provider-Versuche /
  0 erfolgreiche Klassifikationen / 333 Provider-Quota-Fehler
  (`current quota exceeded`, `missing outputCandidate`). Nutzung im
  Resume: 0 Tokens. Kombinierter Report bleibt dadurch beim Teilstand:
  916 Quellen / 557 erfolgreiche Klassifikationen / 26
  `no_offer_evidence_retained` / 333 Quota-Fehler; Sichtungslisten:
  161 confidence < 0,7, 104 null-Klassifikationen, 26 no-evidence-Fälle,
  2 Flying-Boilerplate-Fälle. Kombinierter Strukturcheck: keine
  Rohtext-, Prompt-, Response-, Dateiname- oder Pfadfelder im Report.
  Lokale Artefakte:
  `/tmp/catering-offer-package-night-run-resume-gpt55.json`,
  `/tmp/catering-offer-package-night-run-combined-gpt55.json`,
  `/tmp/catering-offer-package-night-run-analysis-gpt55.json`.
- Slice 2.3d 916er-Nachtlauf teilweise ausgeführt in Branch
  `loop/offer-package-night-run`. Belegt: Full-Run bleibt ohne
  `--allow-full-run` blockiert; Dry-Run über 916 Quellen plante 916
  Requests, 0 Provider-Requests, rohtextfreien Report und
  `fullBatchRunBlocked=false` nur mit Opt-in. Realer Lauf:
  916 Quellen / 916 geplante Requests / 890 Provider-Versuche /
  557 erfolgreiche Klassifikationen / 26 `no_offer_evidence_retained` /
  333 `current quota exceeded`-Fehler. Nutzung bis Quota-Block:
  1.141.903 Input-Tokens, 300.901 Output-Tokens, 1.442.804 Tokens
  gesamt. Sichtungslisten im Report: 161 confidence < 0,7,
  104 null-Klassifikationen, 26 no-evidence-Fälle,
  2 Flying-Boilerplate-Fälle. Strukturcheck: keine Rohtext-, Prompt-,
  Response-, Dateiname- oder Pfadfelder im Report. Report lokal:
  `/tmp/catering-offer-package-night-run-gpt55.json`; kompakte
  Summary lokal:
  `/tmp/catering-offer-package-night-run-summary-gpt55.json`.
  Resume-Fähigkeit per `--source-id-file` ergänzt, damit die 333
  Quota-Fälle später ohne Re-Run der 557 erfolgreichen Fälle
  fortgesetzt werden können.
- 20er-Re-Pilot nach Slice 2.3d ausgeführt mit `gpt-5.5` solo, Budget
  2 EUR / 25 Requests. Ergebnis: 20 geplante Requests, 19
  Provider-Requests, 1 vor Provider gestoppt, 53.275 Tokens gesamt.
  Report-Guardrails: keine geprüften Leak-Treffer, keine Rohtexte,
  Rohprompts oder Rohantworten, 916er-Block weiter aktiv. Fachliche
  Negativklassen erfüllt: 0 Hochzeitspakete ohne Hochzeitsbegriff,
  0 `institution_framework_catering` ohne Rahmenvertrags-/Serienbeleg.
  Sichtungslisten: 5 null-Klassifikationen und 7 confidence < 0,7.
  Kein Nachtlauf gestartet.
- Slice 2.3d Package-Classification-Guardrails abgeschlossen in Branch
  `loop/package-classification-guardrails`. Belegt: Prompt-Kontext und
  Prompt-Artefakt enthalten negative Abgrenzungsregeln:
  `institution_framework_catering` nur bei Rahmenvertrags-/Serienbeleg,
  `wedding_*` nur bei Hochzeitsbegriffen, `null` als erwünschtes
  Nicht-Match. Der Pilot-Report weist confidence < 0,7 und null-
  Klassifikationen als eigene Sichtungslisten aus, ohne Rohtexte zu
  speichern. Der 916er-Lauf bleibt gesperrt bis zum geprüften
  20er-Re-Pilot.
- Slice 2.3c Batch-Modell-Rebaseline abgeschlossen in Branch
  `loop/batch-model-rebaseline`. Belegt: Das Batch-Pilot-Harness
  defaultet auf `gpt-5.5` und `gpt-5.4`, der 20-Angebote-Deckel und
  der 916er-Block bleiben aktiv. Dry-Run über die 20 lokalen Angebote:
  40 geplante Requests, keine Provider-Requests, keine geprüften
  Leak-Treffer. Realer Provider-Rebaseline-Lauf: 40 geplante Requests,
  38 Provider-Requests, 2 vor Provider gestoppt wegen fehlender
  Angebots-Evidenz nach Pseudonymisierung, 96.895 Tokens gesamt.
  Modellbild: `gpt-5.5` lieferte 19 erfolgreiche Klassifikationen mit
  7 Konfidenzen unter 0,7; `gpt-5.4` lieferte 19 erfolgreiche
  Klassifikationen mit 1 Konfidenz unter 0,7, klassifizierte aber 9
  Fälle als `institution_framework_catering`. 8 Abweichungen bleiben
  vor einem 916er-Lauf menschlich zu sichten.
- Slice 2.3a Batch-Pilot abgeschlossen in Branch
  `loop/batch-classification-pilot`, gemerged über Ersatz-PR #552
  <https://github.com/AlexanderSmyslowski/catering-agents-platform/pull/552>
  (Stack-PR #551 wurde nach Merge von #550 automatisch geschlossen).
  Belegt: Pseudonymisierung entfernt Kontakt-/Namens-/Adresszeilen vor
  Provider-Nutzung und speichert im Report keine Dateinamen, Rohtexte,
  Rohprompts oder Rohantworten; sichtbarer BYO-Data-Mode
  `pseudonymized_approved`; Klassifikation ist auf die 13 kuratierten
  Paket-IDs oder `null` begrenzt; der 916er-Lauf bleibt technisch
  geblockt (`limit > 20`). Realer 20-Angebote-Pilot mit `gpt-4.1` und
  `gpt-4.1-mini`: 40 geplante Requests, 38 Provider-Requests, 2 vor
  Provider gestoppt wegen fehlender Angebots-Evidenz nach
  Pseudonymisierung, 8 Modell-Abweichungen, 90.398 Tokens gesamt.
  Batterie grün: `npm test` 272 Dateien / 1194 Tests, `tsc`, Build,
  Audit, Hidden/Bidi-Check und Internal-Beta-Gate.
- Slice 2.2 Intake-Schattenmodus abgeschlossen in Branch
  `loop/intake-shadow-mode`, Draft-PR #550
  <https://github.com/AlexanderSmyslowski/catering-agents-platform/pull/550>.
  Belegt: Sichere synthetische/anonymisierte Eingaben erzeugen Regex-
  Baseline und BYO-LLM-Extraktion nebeneinander als `pending_review`-
  Vergleich; EventRequest/AcceptedEventSpec-Zählung bleibt unverändert,
  der Schattenlauf speichert nur Hashes, IDs, Provider-Metadaten und
  Feld-Diffs. Nicht freigegebene Safety-Modes werden vor Provider-
  Ausführung mit 422 abgewiesen. Audit und Store enthalten keinen
  Rohprompt, keine Rohantwort und keinen Eingabetext. Batterie grün:
  `npm test` 271 Dateien / 1188 Tests, `tsc`, Build, Audit,
  Hidden/Bidi-Check und Internal-Beta-Gate.
- Slice 2.1 PDF→ProductionDraft über BYO-Schiene abgeschlossen in Branch
  `loop/pdf-production-draft-byo`, Draft-PR #549
  <https://github.com/AlexanderSmyslowski/catering-agents-platform/pull/549>.
  Belegt: Das Gate-1-PDF wird nach Operator-Gate und BYO-Extraktion als
  `pending_review`-ProductionDraft angelegt; Buffet-Komponenten werden zu
  Review-Karten, Nahtreffer wie Vitello Tonnato/Kokos-Cheesecake bleiben
  ohne automatische Rezeptzuordnung prüfpflichtig; keine Pläne oder
  Einkaufslisten werden geschrieben, Audit enthält keine Roh-PDF-/Prompt-/
  Response-Inhalte. Externe Verifikation: echte PDF-Läufe erfüllen die
  Fallklasse mit `CATERING_LLM_MODEL=gpt-4.1`; `gpt-4o-mini` verlor
  Komponenten still und ist für diesen Betriebspfad disqualifiziert.
  Batterie grün: `npm test` 270 Dateien / 1182 Tests, `tsc`, Build,
  Audit, Hidden/Bidi-Check und Internal-Beta-Gate.
- **GATE QUITTIERT: 1** · Alexander benannte am 2026-07-03 das
  anonymisierte PDF
  `data/gate1/angebot_flying_buffet_45p_anonymisiert.pdf` und gab fuer
  Slice 2.1 ein Provider-Budget von 10 EUR / 100 Requests frei; das
  OpenAI-Dashboard-Hardlimit soll bei 20 EUR/Monat liegen. Technischer
  Check: PDF liegt unter `data/`, ist per `.gitignore` ausgeschlossen,
  hat 5 A4-Seiten, ist nicht verschluesselt und enthaelt kein
  JavaScript. Phase 2 ist damit fuer genau Slice 2.1 geoeffnet.
- Gate-1-Merge-Session umgesetzt: #546, #547 und #548 wurden in
  Stack-Reihenfolge nach `main` gemerged; die drei `loop/*`-Branches
  wurden lokal und remote geloescht. #494 wurde geschlossen mit
  Entscheidung: fachlich ja zu einer harten Sperre an der
  Produktionsuebergabe/Produktionsmappe bei blockierenden Rueckfragen,
  aber nicht den alten konfligierten PR mergen; bei Bedarf frisch als
  kleiner Loop-Slice bauen. Lokale alte `codex/*`-Branches wurden
  bereinigt; `alex/*`, `claude/*`, `side/*` und `slice4-*` blieben
  unangetastet.
- Slice 1.5 Ballast-Inventur report-only abgeschlossen, keine Löschung:
  `intake-signals.ts` (300 Zeilen) bleibt jetzt als Runtime-Parser und
  spätere Eval-Baseline bis Phase 2.2; LLM-Readiness-Core (2321 Zeilen)
  bleibt, weil BYO-Klarstellungsentwürfe, OpenAI/Codex-Adapter und
  Audit ihn direkt nutzen; Eval-/Synthetic-Live-Tooling (1866 Zeilen)
  bleibt eingefroren bis reale Provider-Flows die Fixture-/No-Raw-
  Prüfungen ersetzen. Mini-Pilot-UI ist der einzige echte spätere
  Löschkandidat: 630 UI-Zeilen plus Testfläche, verborgen hinter
  `VITE_SHOW_MINI_PILOT_PANEL`; Empfehlung: löschbar nach Phase 2, wenn
  BYO-Draft-Review die Pilot-Oberfläche vollständig ersetzt. Procurement
  Planning (290 Zeilen) bleibt, weil Hybrid/Convenience/externe
  Fertigprodukte aktuell in Planung und Purchase-Coverage hängen.
  Import-Scripts (451 Zeilen) bleiben als reproduzierbare Fixture-
  Generatoren. Branch `slice4-codex-procurement-guard` ist veraltet
  (über 10k Zeilen Massendiff gegen `main`); Empfehlung: schließen/
  löschen, keine Rebase. Kein PR, kein Code.
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
