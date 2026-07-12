# Autonome Queue

**Aktive Phase: 4 (Realbetrieb)** — Phasenfolge, Loop-Regeln und
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

---

## ZUR SICHTUNG (menschenpflichtig)

- **Phase 4.2c · Lokalen Subscription-Entwurf fachlich vergleichen.** Das
  bereits freigegebene anonymisierte 45-Personen-Angebot liegt lokal ueber
  `codex_cli` als `pending_review`-Entwurf vor: 11 Komponenten, 1 offene Frage
  und 13 Review-Karten; noch 0 Spezifikationen, Plaene und Einkaufslisten.
  Alexander vergleicht Vollstaendigkeit, Rezepte, Einkauf, Aenderungen und
  Druckmappe mit seinem bisherigen GPT-Arbeitsweg. Echte Kundendaten und
  beliebige Uploads bleiben bis zu dieser Sichtung gesperrt.

---

## ERLEDIGT

- **Phase 4.2d · Review-Kommentare als neue ProductionDraft-Revision.**
  Draft-PR #586 auf `loop/production-draft-revision`. Kommentierte
  `change_requested`-Karten fuer Eckdaten, Menuekomponenten und offene Fragen
  erzeugen ueber den bestehenden BYO-Adapter einen neuen `pending_review`-
  Entwurf mit `supersedesDraftId`; erst nach valider Speicherung wird der alte
  Entwurf `superseded`. Rezept- und Planwuensche bleiben ehrlich als
  Pruefnotiz gespeichert und starten nicht den ungeeigneten Extraktionsweg.
  Vollstaendigkeit, Quellenlinie, Operator-Gate und rohtextfreies Audit sind
  belegt. Batterie: 274 Dateien / 1.248 Tests, TypeScript, Build, Audits und
  internes Beta-Gate gruen; isolierte Desktop-/Mobilprobe ohne Konsolenfehler.
- **Phase 4.2b · Probestand gesichert und operativ geleert.** Alexander gab
  die Bereinigung frei. Vollbackup auf dem Server:
  `/opt/catering-agents-platform-backups/pre-pilot-20260712T144926Z.dump`,
  Modus `600`, 7.180.067 Bytes, `pg_restore`-Katalog lesbar. Danach wurden
  ausschliesslich bekannte operative Collections transaktional geleert:
  6 Erfassungen, 6 Spezifikationen, 3 Plaene, 3 Einkaufslisten und 11
  Audit-Eintraege. Live-APIs belegen jeweils 0; 35 Rezepte blieben erhalten.
- **Phase 4.2b · Lokaler Subscription-Betriebsweg belegt.** PR #585 auf
  `loop/local-subscription-runtime` ignoriert private Codex-Konfigurationen,
  prueft CLI und ChatGPT-Login vor dem Start und stellt
  `npm run local:start:subscription` bereit. Echter synthetischer HTTP-Smoke:
  `201`, Provider `codex-cli`, 4 Komponenten, 8 Review-Karten,
  `pending_review`, keine Produkt-Schreibwirkung. Dauerhafter lokaler
  Pilotbestand liegt ausserhalb des Repos unter
  `~/Library/Application Support/Catering Agents/local-pilot` und enthaelt
  23 Rezepte bei 0 alten operativen Objekten.
- **Phase 4.2a · Interner Login und Trusted-Proxy live.** PRs #582 und #583
  sind gemergt; Merge-Commit `f2e8b26` laeuft unter
  <https://agents.the-one.catering>. Caddys Open-Source-Basic-Auth schuetzt
  UI und APIs mit `401`; mit dem im macOS-Schluesselbund unter
  `agents.the-one.catering` hinterlegten Konto sind UI, Health und alle
  rollenbezogenen Lesewege erreichbar. Frei gesetzte Actor-/Trusted-Header
  werden serverseitig ueberschrieben. Browserprobe: Einstieg und Historie
  sichtbar, keine Konsolen- oder Rollenfehler. Deployment aus einem
  absichtlich auf `700` gesetzten Archiv endete mit Remote-Pfad `755`; der
  externe Eventos-Caddy-Site blieb erhalten und antwortete weiter mit `200`.
  Rollback-Snapshot: `20260712T134436Z`. Keine echten Kundendaten wurden in
  diesem Slice uebertragen.
- **Phase 4.1 · Hetzner-Deployment und Smoke abgeschlossen.** `main`-Commit
  `adca7e6` läuft unter <https://agents.the-one.catering>. Rollback-Snapshot
  `20260712T114154Z` ist vorhanden, die serverseitige `.env` blieb bytegleich,
  alle sechs Compose-Dienste laufen. Drei UI-Routen und vier echte
  JSON-Healthchecks sind grün. Intake, Angebot und Produktion antworten ohne
  vertrauenswürdigen Operator-Kontext sowie bei frei gesetztem Dev-Header mit
  `403 application/json`. Der Browser zeigt deshalb die leere Arbeitsfläche,
  aber noch keine operativ nutzbare Sitzung. Es wurden keine echten
  Kundendaten übertragen oder geschrieben.
- **PRs #576 bis #579 · Deployment-Wurzelfixes gemergt.** Remote-Konfiguration
  wird vor `rsync` geprüft und vor Löschung geschützt; privilegierter Remote-
  `rsync` ist explizit konfigurierbar; Caddy routet APIs vor dem SPA-Fallback;
  der Smoke prüft JSON-Inhalte und toleriert begrenzte Start-Races.
- **GATE QUITTIERT: 3** · Alexander nahm am 2026-07-12 die finale
  anonymisierte 45-Personen-Produktionsmappe fachlich ab und öffnete Phase 4.
  Belegt: 32 A4-Seiten, 11 Rezeptkarten, 70 Einkaufspositionen und 117/117
  gedeckte Rezeptzutaten. Roastbeef, Brombeeren, UNOX-Parameter und
  Meersalzdrillinge wurden gegen den realen Küchenablauf geprüft.
  Unsicherheiten bleiben sichtbar; es erfolgt keine automatische
  Rezeptfreigabe.
- **PR #574 · Meersalzdrillinge nach realem Küchenablauf gemergt.** GN 1/1,
  Rapsöl-Olivenöl-Mix, 230 °C Heißluft, 0 % Dampf und 30-35 Minuten sind auf
  `main`; Merge-Commit `9663e30`.
- **PRs #571, #572 und #573 · Gate-3-Mappenstack gemergt.** A4-Druckeinheiten,
  fachlich korrigierte Roastbeef-/Brombeer-Abläufe sowie konkrete
  XVC305E-Parameter und Kerntemperaturen sind auf `main`; letzter Merge-Commit
  `2326928`.
- **PR #570 · Kleinstmengen ohne Null-Rundung gemergt.** 0,5 g bleibt in
  PurchaseList, CSV und A4-HTML lesbar; Merge-Commit `1891dac`.
- **PR #569 · Einkaufsliste artikelbasiert aufsummiert gemergt.** 70 Positionen
  decken weiterhin 121 von 121 Rezeptzutaten; Merge-Commit `a79fa6a`.
- **PR #568 · Quellenexakte Basismengen gemergt.** Base-Yield bleibt
  mengenidentisch, Verlustfaktoren sind nur Metadaten; Merge-Commit `3e7c0c9`.
- **PR #566 · Rezeptkarten aus freigegebenen KI-Entwürfen gemergt.** Der
  E2E-Vertrag beweist vollständige Rezeptkarten, Draft-only und ehrliche
  Hinweise bei fehlender Verknüpfung; Merge-Commit `6234d61`.
- **PR #567 · Merge von Alexander freigegeben.** Der gestapelte E2E-Vertrag
  belegt 0 Einkaufslisten vor Apply und eine gefüllte Einkaufsliste danach. Die
  damalige Erwartung von 9,45 kg Tomaten enthielt den später in Gate 3
  reproduzierten automatischen Verlustaufschlag; Slice 3.4 korrigiert sie auf
  die quellenexakten 9 kg.
- **Slice 3.3 · Technische IDs aus Hauptflächen nicht reproduziert.** Frische
  Browserprobe auf Wegwerfdaten: Angebot, Auftragshistorien und Produktion
  zeigten 0 sichtbare Treffer für `spec-`, `plan-`, `request-`, `draft-`,
  `purchase-`, `recipe-` und `component-`. Nach bewusstem Öffnen von
  „Technische Details“ blieb die Plan-ID wie vorgesehen erreichbar. Kein
  Produktcode und kein dritter PR.
- **GATE QUITTIERT: 2** · Alexander bestätigte am 2026-07-11 nach Sichtung
  dreier anonymisierter realer Angebotsfälle die Extraktionsqualität und öffnete
  Phase 3. In 57 Komponenten gab es keine stille Auslassung und keine
  Fehlklassifikation von Non-Food als Speise; alle Ergebnisse blieben
  freigabepflichtige Entwürfe ohne Produkt-Write.
- **PR #565 · Gate-2-Vertrauensgrenzen gemergt.** Servergesteuerter Datenmodus
  für anonymisierte Realdokumente und belegpflichtige Ernährungskategorien;
  Merge-Commit `d046413`.
- **Slice 2.3d Batch bewusst beendet.** · Alexander entschied am
  2026-07-10, den Offer-Package-Batch nicht erneut fortzusetzen. Der
  vorhandene Teilkorpus bleibt bei 916 Quellen / 740 erfolgreichen
  Klassifikationen / 26 `no_offer_evidence_retained` / 150
  Quota-Fehlern. Die 150 Restfälle werden nicht erneut an einen Provider
  gesendet; dafür besteht kein Budget- oder Resume-Auftrag.
- Slice 2.3d Resume nach API-Aufladung teilweise abgeschlossen in Branch
  `codex/offer-batch-timeout-checkpoint`. Vor dem Vollresume wurde ein
  hängender Providerlauf ohne Report abgebrochen; Wurzelbefund:
  OpenAI-Transport hatte keinen Timeout und das Batch-Script schrieb nur
  am Ende. Fix: OpenAI-Timeout (`CATERING_OPENAI_TIMEOUT_MS`) plus
  atomischer Report-Checkpoint nach jeder Prediction. Danach erfolgreicher
  Smoke für `offer-570` und Resume der übrigen 332 IDs. Ergebnis:
  182/332 im Resume erfolgreich, 150 Quota-Fehler; Nutzung des 332er-
  Resume: 358.758 Input-Tokens, 90.720 Output-Tokens, 449.478 Tokens
  gesamt. Kombinierter Report nach Aufladung: 740/916 erfolgreiche
  Klassifikationen, 26 no-evidence, 150 Quota-Fehler; Sichtungslisten:
  209 confidence < 0,7, 139 null-Klassifikationen, 26 no-evidence-Fälle,
  2 Flying-Boilerplate-Fälle. Strukturcheck: keine Rohtext-, Prompt-,
  Response-, Dateiname- oder Pfadfelder im kombinierten Report. Lokale
  Artefakte:
  `/tmp/catering-offer-package-night-run-smoke-after-topup-gpt55.json`,
  `/tmp/catering-offer-package-night-run-resume-after-timeoutfix-gpt55.json`,
  `/tmp/catering-offer-package-night-run-combined-after-topup-gpt55.json`,
  `/tmp/catering-offer-package-night-run-analysis-after-topup-gpt55.json`.
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
