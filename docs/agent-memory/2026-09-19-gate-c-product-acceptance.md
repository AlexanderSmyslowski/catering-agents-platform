# Gate C – lokale Produktabnahme am 19.09.2026

Status: Der zusammenhängende technische Operatorweg ist auf der erhaltenen isolierten Kopie desselben synthetischen Falls bis Revision 9, vier Einzelreviews, simulierter Freigabe, idempotenter Übernahme, drei tatsächlich geprüften Exportformaten und Wiederöffnung abgeschlossen. Rezeptstatus, Zukaufquelle sowie reale Küchen-, Allergen-, Lieferanten-, Preis-, Gebinde- und Bestandsprüfung bleiben ausdrücklich offen. Keine reale Produktionsfreigabe und kein Gate-C-Gesamt-GO.

## Übernommener Stand

- Produktbasis PR #682: `4cdf61f6961e7bd71f50868a540014d0adffa598`, Tree `92788e97a5b6186e812542dbafe17e703f883b84`.
- Fix PR #694: `0b3e59832c3012b1c210a9de12fb6d871541d11d`, Tree `1fb5336165aa2c9894e29c06399442a9a065c3da`.
- Frisch abgefragtes main: `8ccdfd4e1feae46cd6a8c4013aa6b25d6bfbf4be`; spätere Betriebs-/Infrastrukturarbeit wird nicht integriert.
- Beide PR-Beschreibungen, tatsächlicher Fix-Diff, Kommentare und Reviews gelesen; keine neuen Kommentare/Reviews. Historische PR-Beschreibungsanker ersetzen nicht den aktuellen Head.
- Isolierter Worktree: `.worktrees/gate-c-product-acceptance-20260919`, auf dem vorhandenen Fix-Branch `codex/gate-c-local-session-rehearsal-20260919`.
- Fremde ungesicherte Rezept-/Allergenarbeit im Gate-A-Worktree erfasst und erhalten; Hauptcheckout sowie Serverzweige bleiben unangetastet.
- STR-001 v1.1 aus AgenturOS main `2db5e7cd32bd2abc9af5628d687160e5c75475b7` gelesen. CateringOS ist laut Betreiberauftrag noch nicht geschäftlich produktiv eingesetzt; dies erteilt keine Löschfreigabe.

## Ausgeführte Prüfungen am ursprünglichen Fix-Head

Arbeitsverzeichnis für alle npm-Kommandos: oben genannter Produkt-Worktree. Node `v26.0.0`, npm `12.0.2`.

| Kommando | Ergebnis | Exit |
| --- | --- | --- |
| `npm ci --no-audit --no-fund` | 269 Pakete nach unverändertem Lockfile installiert; keine Versionsänderung. npm blockierte vorhandene esbuild-/fsevents-Installationsskripte; Test und Build funktionieren dennoch. | 0 |
| `npm test -- tests/local-dev-session-proxy.test.ts tests/task-3-local-trusted-channel.test.ts tests/catering-login-ui.test.tsx --maxWorkers=1` | 3 Dateien, 49 Tests bestanden; 6,76 s. | 0 |
| `npx --no-install tsc --noEmit` | Repository-Typecheck bestanden. | 0 |
| `npm run build` | Typecheck und Vite-Produktionsbuild bestanden, 194 Module. | 0 |
| `npm test -- tests/hosted-session-actor-boundary.test.ts tests/catering-hosted-session-e2e.test.ts --maxWorkers=1` | 2 Dateien, 9 Tests bestanden; 3,72 s. Synthetischer Vier-App-/Cookie-/Rollenpfad, 401 ohne Cookie trotz gefälschter Identitätsheader/Bearer, 403 bei fehlender Capability/falschem Origin. | 0 |

Lockfile-SHA256: `9e87460f1cdf88a68dbce46798655ffa6f5ebd9766bcc33ce17fc7ee79165a46`.
Bei diesen Prüfungen waren Index, verfolgte Dateien und unversionierte Produktdateien sauber. Generierte Abhängigkeiten und UI-Build sind ignorierte lokale Artefakte. Keine Secrets, fremden Daten oder Rohlogs wurden zur Identifikation gelesen.
Der zusätzliche Auth-Korridor lief während der Erstellung dieses Berichts und des isolierten Lifecycle-Regressionstests; die Auth-/Produktquellen, Konfiguration und Abhängigkeiten waren unverändert. Die Prüfung nutzt echte Fastify-Apps über `app.inject()`, keinen externen Hosted-Proxy.

## Unabhängige Prüfung und konkreter Laufzeitblocker

- Rolle: unabhängiger Spezifikations-/Qualitätsreview, Agent `review_session_fix`, frischer Kontext, `gpt-6-astra` / `high`; wegen Auth-/Berechtigungsgrenze starke Modellwahl.
- Ergebnis am ursprünglichen Fix-Head: Scope/Spezifikation bestanden für den kanonischen Modus `CATERING_DEV_AUTH=1`; kein abnahmehindernder Security-Befund. `git diff --check`: Exit 0.
- Nicht blockierende Beobachtung: Der Vite-Test unterstützt zusätzlich `true`, der tatsächliche Backend-Modus nur getrimmtes `1`. Das ist kein Rechtebypass; `true` ist kein verifizierter Gesamtstack-Modus. Der abgenommene Auth-Kern wird deshalb nicht erweitert.
- Vor dem ersten Dienststart: Ports 3101–3104/3200 frei, keine Screen-Sitzungen oder Catering-LaunchAgent-Dateien gefunden. Im frischen Worktree existierten weder `data` noch `.runtime` oder kopierte Umgebungsdateien.
- Das bestehende lokale Stop-Skript würde trotzdem globale LaunchAgents und Screen-Namen anfassen und `rm` verwenden. Dieser konkrete Konflikt mit dem Betreiberauftrag blockiert zunächst nur den Browserstart.
- Begrenzte Reparatur: Eigentum lokaler Start-/Stop-Ressourcen an den Worktree binden, globale LaunchAgent-Mutation entfernen, Daten erhalten und Marker recoverable bereinigen. Browsermarker, Rechte, Provider und Serverkonfiguration bleiben außerhalb der Reparatur.
- Rolle: Implementierung `local_lifecycle_fix`, `gpt-6-astra` / `high`, wegen Prozess-/Datenrisiko; eigene unabhängige Nachprüfung vor Laufzeitnutzung erforderlich.

## Lifecycle-Abnahme

- Initialer unabhängiger Review hielt die erste Reparatur wegen verloren gegangener Legacy-Writer-Sperren vor der Migration an. Isolierte Baseline: Exit 1, Migration nicht aufgerufen; erste Reparatur: Fake-Migration aufgerufen, Exit 99. Das war ein echter Befund und wurde vor jedem Dienststart behoben.
- Alle fünf alten Screen-Namen bleiben nun reine Lesesperren. Zusätzlich blockieren belegte oder nicht sicher prüfbare Ports 3101–3104 und 3200 vor Migration/Start. Stop verarbeitet ausschließlich eigene exakte Screen-IDs und verifizierte Worktree-Prozesse; keine globale LaunchAgent-Mutation.
- Unabhängiger Review `review_session_fix`, weiterhin `gpt-6-astra/high`: GO für Scope/Spezifikation und Qualität/Datensicherheit. Reproduktion: alter Intake-Writer und fremder Port 3101 jeweils Exit 1 ohne Migration; freie Umgebung erreicht die Fake-Migration (erwarteter Exit 99). Shell-Syntax und Diff-Check: Exit 0.
- Koordinatorprüfung: `npm test -- --maxWorkers=1 tests/local-dev-session-proxy.test.ts tests/task-3-local-trusted-channel.test.ts tests/catering-login-ui.test.tsx tests/local-stack-ownership.test.ts tests/local-stack-migration-guard.test.ts tests/local-stack-process-lifecycle.test.ts tests/local-ops-check-contract.test.ts` → 7 Dateien, 87 Tests bestanden, 33,26 s, Exit 0.
- `npm run build` nach den neuen TypeScript-Tests erneut bestanden, Exit 0 (inklusive Repository-Typecheck); 194 UI-Module. Dies war die betroffene Nachprüfung, keine unveränderte Vollsuite.
- Verfolgter Dirty-Diff SHA256 gegen `0b3e598`: `ab2444d6aa11899aa5e9b5180ba27324bb9e67552326ce9ca2b8c20e1d8ca546`. Neuer Ownership-Test SHA256: `fd7aee1e162c85f0d87b06401cb3dcbe8129e7928fc683c17d885552c077da72`. Der laufende Bericht ist getrennt und nicht Teil der Runtime-Prüfidentität.

## Browserabnahme

- `npm run browser:rehearsal:full-fresh`: **Exit 0**, 19.09.2026 12:56:38–13:00:34 UTC, rund 236 s. Vier frische synthetische Datenwurzeln; keine vorhandene Datenwurzel gelöscht. Eigene Services und Browser wurden danach beendet.
- Der unveränderte Browservertrag bestätigt den leeren Angebotsstart auf Desktop (1440×900) und Mobil (390×844), Erstellung/Öffnung eines synthetischen Angebots, Angebotsfreigabe und fallgebundene Produktionsübergabe. Konsolenfehler: keine; API-Requestbericht vorhanden.
- Ausführung mit bereinigter Umgebung: `CATERING_LLM_PROVIDER=fixture`, `CATERING_SYNTHETIC_LLM_SLICE=0`, `CATERING_PRODUCTION_DRAFT_DATA_MODE=synthetic_or_demo_only`; separater Browsername `catering-gatec-20260919`. Keine geerbten Provider-/Datenbank-/Proxywerte, keine echten Daten oder kostenpflichtigen Provider. Vorher nochmals alle fünf Ports frei geprüft.
- Browserwerkzeug: vorhandener Playwright-CLI-Wrapper, CLI `0.1.21`. Laufnachweis und vollständige lokale synthetische Ausgabe: `.runtime/acceptance-20260919/browser-full-fresh-1.json` und `.log` im Worktree. Die JSON-Bindung bestätigt alle neun relevanten Quellen-/Test-/Lockfile-Hashes während des Laufs unverändert.
- Geprüft: Head `0b3e59832c3012b1c210a9de12fb6d871541d11d`, Tree `1fb5336165aa2c9894e29c06399442a9a065c3da` **plus** der oben identifizierte Lifecycle-Diff und Ownership-Test. Kein bloßer Clean-Head-Nachweis.
- Beweisgrenze des bestehenden Runners: Alle vier benannten Modi aktivieren `CREATE_OFFER_CASE=1` und enden im vorhandenen erfolgreichen Handoff-Zweig. Sie belegen damit vier Angebots-/Handoff-Durchläufe, nicht zusätzlich eigenständige Answer-Submit-, Archiv- oder Failed-Upload-Aktionen. Die abschließende Skriptmeldung allein wird nicht als Beleg dieser Aktionen übernommen. Keine Browsererwartung wurde für Grün verändert.
- Zusammen mit den 49/87 gezielten Tests und neun ergänzenden echten Service-App-Tests ist der begrenzte Fehler „Leerer Angebotsstart unvollständig“ abgenommen. Hosted-Betrieb, menschliche Küchenprüfung und Gesamtprodukt bleiben getrennte Grenzen.

## Operatorweg: begrenzter Quellenabgleich

| Übergang | Bereits belegt | Konkret offen / nächste Prüfung |
| --- | --- | --- |
| Angebots-/Eventgrundlage → Fall und Handoff → Produktionsentwurf | Aktueller echter Browserlauf; synthetisch, Desktop/Mobil. | Nicht unverändert wiederholen. |
| Produktionsentwurf → Vorbereitung von Entscheidungen/Rezepten/Plan/Einkauf | Historische Goldläufe PR #676/#677; vorhandene API-/Panel-Tests. Zusätzlich unten beschriebener Browsernachweis für Vorbereitung und Wiederöffnung auf `7b3b536`. | Technische Vorbereitung belegt; fehlende Klassifikationen blockieren weiter belastbare Rezepte, Mengen und Einkauf. |
| Vorbereiteter Stand → Übernahme / Produktionsunterlagen / Export | Historische Goldlauf-/Apply-/Exportverträge; PR #682 lieferte erfolgreichen Build/Test-CI am historischen Integrationsstand. | Keine aktuelle vollständige Operator-Abnahme daraus ableiten; nach dem nächsten Übergang neu einordnen. |
| Fachliche Küchenabnahme | Keine neue tatsächliche menschliche Prüfung in diesem Auftrag. | Menschlich offen; synthetische Entscheidungen sind keine menschliche Freigabe. |

`PRODUCTION_PROMPT_REPLACEMENT_CONTRACT.md` bleibt das fachliche Ziel. Die Checkliste vom 16.08.2026 gilt für ihren damaligen Referenzanker; fehlende echte Quellen, menschliche Prüfung und `full_cost_model` werden nicht erfunden. Der dortige erledigte Evaluatorplan wird nicht erneut implementiert. Die spätere eventbezogene Rezeptprüfung und die Goldlauf-Fortschritte werden durch historische offene Checklistenpunkte nicht aufgehoben.

Historische Quellenbindung: PR #676 auf `13553dbd14dd020e11f69fe02d3a9b14662726c9` dokumentiert Goldlauf 1/2; PR #677 auf `faf17e8a1def016b4263a7288a81161e14288145` Goldlauf 3/3 und Gate-B-Produktbaseline; PR #678 auf `002027cd176bebc321eeee0034fe63fa17ec5daa` den nachfolgenden Session-/Gate-B-Stand. Dies sind gelesene historische Nachweise, keine heute erneut ausgeführten Goldläufe. Die heutige technische Belegung ersetzt weder deren Fallanker noch den fehlenden Köpff-Quellnachweis oder eine menschliche Unterschrift.

## Begrenzter Operator-Folgeblock

- Geprüfter sauberer Commit `7b3b5366e29b0f71f8c96ad79019eb229b2253b2`, Tree `1a06abd5b548dac3e0670fb2480a75d76acf4beb`. Dieser Commit sichert exakt den zuvor mit Dirty-Fingerprint geprüften Lifecycle-Code plus Dokumentation. Alle neun Quellen-/Test-/Lockfile-Hashes aus der ersten Browserabnahme nochmals identisch bestätigt; keine unveränderte Volltestwiederholung.
- Die letzte eigene synthetische Datenwurzel des erfolgreichen Full-Fresh-Laufs wurde erhalten und wiederverwendet, anhand des Laufprotokolls gebunden (`.runtime/acceptance-20260919/operator-continuation-root.txt`). Eigene Dienste über `bash scripts/start-local-stack.sh` gestartet, Exit 0; dieselbe bereinigte Fixture-Umgebung wie zuvor. Browsername `catering-operator-20260919`.
- Browseraktionen: `/produktion` öffnen → Historie öffnen → vorhandenen Auftrag wiederöffnen → **Entwurf vorbereiten** anklicken. Alle CLI-Aktionen Exit 0. Genau ein `POST …/production/drafts/…/prepare` am 19.09.2026 um 13:03:38 UTC, Antwort **201**. Kein neuer Angebotslauf und keine Review-/Freigabe-/Apply-Mutation in diesem Browserblock.
- Die Antwort enthält Revision 2 mit `pending_review`, unveränderter Handoff-Quelle und identischer Event-Spec. Die vorherige Revision ist serverseitig `superseded`. Nach Browser-Reload und ausdrücklich erneuter Fallauswahl liefert `GET …/drafts?caseId=…` HTTP 200 mit exakt derselben gespeicherten Revision 2; das sichtbare Panel zeigt fünf offene Prüfpunkte und deaktiviertes **Entwurf freigeben**.
- Fachlicher Zustand: `productionPlan.readiness.status=insufficient`, zwei Klassifikationsblocker, keine Produktionsbatches, keine Rezepte und leere Einkaufspositionen. Vorhandene Küchenblätter enthalten ausdrücklich Rezeptklärungs-/Blocking-Hinweise. Das ist ein vorbereiteter Prüfstand, kein ausführbares Produktionsdokument. Keine `approvedProductionSpecs`, keine menschliche Küchenprüfung und keine Übernahme in freigegebene Produktobjekte.
- `python3 .runtime/acceptance-20260919/check-operator-transition.py` → **Exit 0**, 13:10:11 UTC. Prüft tatsächlich sichtbare DOM-Marker und gesperrte Freigabe, Konsolenfehler (0), Antwortgleichheit nach Wiederöffnung, Handoff-/Event-Spec-Bindung, Supersede-Status, offene Entscheidungen und obige Blocker. Einzelne Browser-`eval`-/`console`-Kommandos ebenfalls Exit 0. Lokale synthetische Rohbelege: `operator-prepare-response.json`, `operator-reloaded-drafts.json`, `operator-draft-requests.json`, `operator-dom-assertions.json`, `operator-console.json`, `operator-transition-check.json`; Snapshots vor/nach Wiederöffnung in `.playwright-cli/`.
- Abschluss: ausschließlich den benannten Browser geschlossen und `bash scripts/stop-local-stack.sh` ausgeführt, jeweils Exit 0. Separater Cleanup-Check Exit 0: alle fünf Ports wieder ohne Listener (`lsof` jeweils Exit 1 = kein Treffer), keine eigenen Screen-Sitzungen, synthetische Datenwurzel weiterhin vorhanden. Nachweis `operator-cleanup-check.json`. Keine fremden Dienste beendet und keine Daten gelöscht.

## Verbleibende Grenzen

- **Bereits belegt:** Angebotsstart/Handoff und nun zusätzlich die fallgebundene, persistierte Entwurfsvorbereitung im echten lokalen Browser.
- **Konkret fehlender Nachweis:** Operatorübergang von fachlich geklärten Klassifikationen/Produktionswegen/Rezepten zu vollständigem, übernommenem Plan mit Einkaufsabdeckung und Export. Die heute korrekt ausgewiesenen Eingabelücken sind keine neue Fehlfunktion und werden nicht automatisch als gelöst behandelt.
- **Reproduzierbarer Produktfehler:** Angebotsstart behoben; für den begrenzten neuen Vorbereitungsschritt kein abnahmehindernder Fehler reproduziert. Der dokumentierte Umfangsmangel des bestehenden Full-Fresh-Runners bleibt eine Nachweisgrenze seiner vier Modusnamen.
- **Notwendige menschliche Prüfung:** eventbezogene Küchenprüfung einschließlich Rezept-/Allergen-/Mengen-/Quellenprüfung und Bestätigung ohne Rettungs-Chat weiterhin offen. Synthetische UI-Aktionen oder Testentscheidungen liefern diese Prüfung nicht.

## Folgeauftrag: Klassifikationen desselben Handofffalls

Ausgangsstand: `d0ce78f93a0f77a553e804214f22b07430bcb34c`, Tree `54e70dc9d33f8ebb2cf960da7540a989b3fcb774`, Memory 5.389. Vor Änderungen sauber; Remote-PR #694, Produktbasis #682 und main unverändert, keine neuen PR-Kommentare. Die vorige Angebots-/Handoff-Abnahme wurde nicht wiederholt. Derselbe erhaltene synthetische Datenroot und ausschließlich Fixture-Provider; alle fünf Ports vor Start frei, Start Exit 0.

### Tatsächliche offene Punkte vor der Klärung

Die Planung liefert für diese beiden Fehler keinen eigenen maschinenlesbaren Fehlercode. Die Review-IDs in Revision 2 und die konkreten Datenpfade sind:

| Review-ID / Ziel | Komponente | Fehlende Angabe | Vorhandener Klärungsweg |
| --- | --- | --- | --- |
| `card-planning-blocker-1`, `productionPlan.blockingIssues[0]` | `kaffeepause-1` – Kaffeepause kompakt | `menuPlan[0].menuCategory` | Rückfragen beantworten → Kategorie im Angebot → klassisch / vegetarisch / vegan → Antworten speichern |
| `card-planning-blocker-2`, `productionPlan.blockingIssues[1]` | `croissants-und-wasserservice-2` – Croissants und Wasserservice. kompakt | `menuPlan[1].menuCategory` | Derselbe Editor, zugehörige zweite Komponentenkarte |

`planning-component-readiness-artifacts.ts` prüft das fehlende `menuCategory` vor der Herstellungsart. Die zwei Texte lauten „Klassifikation für Kaffeepause kompakt fehlt.“ und „Klassifikation für Croissants und Wasserservice. kompakt fehlt.“ Das beschreibt eine fehlende Auswahl, keine bewiesene Ernährungs- oder Rezeptklassifikation.

Alle fünf Karten der vorbereiteten Revision 2 stehen auf `pending`, `requiredApproval=true`:

| Karte | Einordnung |
| --- | --- |
| `card-prepared-event-spec` | Eventdaten-/Quellenstand des Snapshots noch zu prüfen; Klassifikationsauswahl ersetzt diese Prüfung nicht. |
| `card-prepared-production-plan` | Mengen, Ablauf und Küchenblätter noch zu prüfen; aktueller Plan ist `insufficient`. |
| `card-prepared-purchase-list` | Aggregierte Einkaufsmengen noch zu prüfen; die leere Liste ist keine fertige Einkaufsgrundlage. |
| `card-planning-blocker-1` | Blockierendes Klassifikationsrisiko der ersten Komponente. |
| `card-planning-blocker-2` | Blockierendes Klassifikationsrisiko der zweiten Komponente. |

Zusätzlich zeigt der Frageneditor fünf Rückfragen: Zeitfenster, je eine Herstellungsentscheidung und je eine Kategorie pro Komponente. Diese Rückfragen sind nicht dieselben fünf Reviewkarten.

### Synthetische Operatorentscheidungen und reproduzierter Fehler

- Der Quellfall enthält keine belegte `classic`-/`vegetarian`-/`vegan`-Auswahl. Für diesen autorisierten Test ausdrücklich synthetisch entschieden: `kaffeepause-1 = classic`, `croissants-und-wasserservice-2 = vegetarian`. Dies ist keine Aussage einer echten Küche und keine Allergen-, Rezept- oder Produktionsfreigabe. Herstellungsarten, Rezeptbezüge und Zeitfenster bleiben unverändert offen.
- Reproduktion im echten Browser am 19.09.2026: vorhandenen Fall wiederöffnen → Rückfragen beantworten → die beiden Kategorien auswählen → **Antworten speichern**. Sämtliche CLI-Aktionen Exit 0. `PATCH /api/intake/v1/intake/specs/spec-browser-rehearsal-offer-case` liefert HTTP 200, UI meldet „Spezifikation wurde gespeichert.“
- Nach erneutem Öffnen des Editors stehen beide Auswahlen jedoch wieder auf leer; die zwei Kategoriefragen bleiben. Beleg `classification-reopen-editor-repro.json`: `categories=["", ""]`, `savedNotice=true`. Der aktive Handoff-Draft wird durch diesen Intake-PATCH nicht aktualisiert.
- Die tatsächliche PATCH-Antwort (`classification-save-response.json`) zeigt zudem neu normalisierte Komponenten-IDs (`kaffeepause-kompakt-1`, `croissants-und-wasserservice-kompakt-2`), `commercialState=manual`, `sourceType=manual_input` und einen leeren Serviceplan statt der Handoff-Quelle und ihrer drei Module. Der unveränderliche Handoff-/Draftstand blieb erhalten; diese fehlerhafte synthetische Intake-Antwort wird nicht als Ersatzquelle verwendet oder durch direkte Dateieingriffe repariert.
- Ursache: `production-spec-edit-persist-action.ts` speichert ohne Unterscheidung per Intake-PATCH; die Handoff-Arbeitsansicht und `/drafts/:draftId/prepare` lesen dagegen den kanonischen Draft-Snapshot. Revision 2 besitzt bereits abgeleitete Artefakte, daher bietet sie auch kein erneutes **Entwurf vorbereiten**. Änderungen an den zwei Risk-Reviewkarten sind ausdrücklich kein freier Extraktions-Revisionsweg.
- Unabhängiger Scopecheck: `review_classification_flow`, `gpt-6-astra/high` (API-/Persistenz-/Lineagerisiko). Reparaturauftrag an `fix_classification_revision`, ebenfalls `gpt-6-astra/high`: vorhandenen Editor mit einer begrenzten kanonischen Klassifikationsrevision verbinden; keine Intake-Normalisierung, keine neue Case-/Angebotsanlage, bestehende Sicherheits- und Reviewgrenzen erhalten. Koordinator führt Browserabnahme und Dokumentation getrennt aus.
- Vor Implementierung ausschließlich eigenen Browser und eigene Dienste beendet, jeweils Exit 0; alle fünf Ports wieder frei. Die fremden vier Rezept-/Allergenpfade im Gate-A-Worktree wurden separat identifiziert und per SHA256 festgehalten (`classification-protected-work.json`); sie bleiben außerhalb dieser Reparatur.

### Gezielte Implementierungs- und Reviewnachweise

- Die bestehende `/drafts/:draftId/revise`-Route erhält einen streng begrenzten, providerlosen Klassifikationsauftrag mit Case-ID, erwarteter Revision und Komponenten-ID/Kategorie. Keine neue API-Route, kein Shared-Core-Vertrag und keine neue Datenhaltung. Das vorhandene Critical-Section-/Revisionsverfahren bewahrt den kanonischen Snapshot und erzeugt eine offene Folgerevision; abgeleitete Artefakte müssen daraus neu vorbereitet werden.
- Gezielte Regressionen hielten echte Zwischenfehler an: Wiederholung nach unterbrochener Timeline-Speicherung durfte nicht dauerhaft bei 409 hängen; ein unabhängiger Quellrisikopunkt durfte beim Speichern und Vorbereiten nicht verschwinden. Die Korrektur erhält unabhängige Quellfragen, Notizen und offene Reviewpflichten einschließlich ihrer Zielpfade; nicht ersetzbare Prüfziele auf entfernten Artefakten werden abgewiesen.
- Eingefrorener erster Codekandidat: Source-/Test-Diff SHA256 `e4936d4a3226b2abc8fe876a8138400049b8f8e0db9588374141f72329a244af` gegen `d0ce78f`. `npx vitest run tests/production-planning-evidence-p1.test.ts tests/production-spec-edit-persist-action.test.ts tests/production-planning-controls.test.ts tests/production-plan-submission-action.test.ts tests/production-draft-review-panel.test.tsx tests/use-production-spec-editor.test.ts --maxWorkers=1`: 6 Dateien, 97 Tests bestanden, Exit 0. `npx tsc --noEmit`: Exit 0. Der Koordinator las die tatsächlichen Logs und identischen neun Dateihashes; `npm run build` einschließlich Typecheck und Vite-Build zusätzlich beim Koordinator: Exit 0.
- Nachweise dieses ersten Kandidaten: `classification-implementation-evidence.json`, `classification-final-focused-tests.log`, `classification-final-typecheck.log`, `classification-build-binding.json` und `classification-build.log`. Diese grünen Prüfungen ersetzen den unabhängigen Review nicht.
- Unabhängiger Review hielt das Code-GO wegen eines konkreten Fallwechsels an: Bei einem angepinnten Editor von Fall A, aktivem Fall B mit derselben Spec-ID und unveränderten Kategorien konnte der No-op-Speicherpfad die Prüfung umgehen und anschließend A vorbereiten. Datenfreier Probe mit echten Actionfunktionen: `activeCaseId=new-case`, `pinnedCaseId=old-case`, `prepareCalls=[old-case-draft]`. Der betroffene Browserlauf blieb angehalten; Nachbesserung und fokussierter Re-Review sind erforderlich. Keine unveränderte Wiederholung der Angebotsabnahme.

- F1 geschlossen: Die Live-Fall-/Draft-/Revisionsprüfung greift vor No-op/Save/Prepare und erneut nach Save/Refresh; nur die eigene erfolgreiche Folgerevision erlaubt ihren exakten Vorgänger bis zum React-Render. Vier gezielte RED-Fälle (Exit 1), danach fünf UI-Testdateien mit **41 Tests**, Typecheck und Diffcheck jeweils **Exit 0**. Unabhängiger datenfreier Recheck: kein Prepare-Aufruf bei Fallwechsel. Code-GO des Reviewers auf Source-/Test-Diff `d0f761178b6e7aaed061e3817c12bc1e1abe0c80e3ced95d4a21a6347e0bd49f`, Dateifingerprint `79c129765b353152320ec73d59bfbbcb02f45670af3f827adec925d49c4dce74`. Backend-/P1-Dateien bytegleich, deren gültige Prüfung nicht wiederholt. Nachweise: `classification-f1-implementation-evidence.json`, `classification-f1-independent-review.json`, `classification-f1-final-tests.log`. Erneuter betroffener Build beim Koordinator **Exit 0** (`classification-build-f1.log`, Bindungsmanifest).
- Tatsächlicher Browser-Speichernachweis auf diesem F1-Stand: am 19.09.2026 um 13:57:35 UTC **Antworten speichern** → genau ein `POST …/drafts/production-draft-prepared-3a37eb6d4aef9c3905a2c59d95da699c75db10b48257cd628a6f97ed92d2462a/revise`, **201**. Neue Revision **3**, ID `production-draft-revision-94a2e82e56a881df30dcdd499bc516d90b082f6d84530c5d8bddcfe280413a51`, `pending_review`. Die Event-Spec entspricht der Revision 2 exakt bis auf die zwei expliziten Kategorien; Quelle, IDs, drei Servicemodule und bekannte Angaben erhalten. GET bestätigt exakt dieselbe gespeicherte Revision; Revision 2 ist `superseded`. Offline-Speicherprüfung Exit 0, `classification-save-check.json`.
- Neuer tatsächlicher Browserbefund **F2**: Frageneditor zeigt bereits drei statt fünf Rückfragen, aber beide lokalen Prüfpanels halten die fünf alten Karten der Revision 2 im eigenen Zustand. Dadurch fehlt **Entwurf vorbereiten**. `classification-fixed-after-save.log` belegt den Fehler trotz korrektem `classification-fixed-save-drafts.log`. Nur diesen Schritt angehalten; eigener Browser und Stack beendet (Exit 0), alle fünf Ports frei, gespeicherte Revision 3 unverändert erhalten (`classification-f2-stop-check.json`). Kein Datenreset und keine Kategorieänderung als Testumgehung. Begrenzte Aktualisierungskorrektur und unabhängiger Delta-Review folgen.

- F2-Kandidat: Die vorhandene Review-Benachrichtigung wird beim kanonischen Save erst nach erfolgreichem Dashboard-Refresh und F1-Liveprüfung gesendet; beide Panels wechseln auf die gespeicherte Revision. Auch separates Prepare aktualisiert Dashboard und beide Panels. Zwei tatsächliche RED-Stufen im Test mit zwei gemounteten, explizit auf Revision 2 fokussierten Panels: zuerst blieben die Panels alt, danach blieb beim separaten Prepare das Dashboard alt (jeweils Exit 1). Abschließend **42 UI-Tests in fünf Dateien**, Typecheck und Diffcheck **Exit 0**. Betroffener Build beim Koordinator **Exit 0**. Backend und P1-Test bytegleich zum geprüften ersten Kandidaten; keine erneute Backend-Vollschleife.
- F2-Prüfbindung: unveränderter Basishead/Tree `d0ce78f` / `54e70dc`, Source-/Test-Diff SHA256 `86d5888dbb639645996557e9538daf4704117e24191db1d30360f01781dd43a2`, elf Dateihashes im Manifest mit Fingerprint `3ad0cc89d505494a7acc83173258e73eb86ed723e32457798f5cb8af30c87dc4`. Nachweise `classification-f2-implementation-evidence.json`, `classification-f2-red-tests.log`, `classification-f2-prepare-red-tests.log`, `classification-f2-green-tests.log`, `classification-f2-typecheck.log`, `classification-build-f2.log` und Bindungsmanifest. Unabhängiger F2-Code-Review vor Wiederaufnahme der Laufzeit.


### Tatsächlicher Abschluss des Klassifikationsblocks

- Unabhängiger F2-Review: **Code-GO**, keine abnahmehindernden Findings (`classification-f2-independent-review.json`). Danach Ports/Datenroot und elf Quellenhashes erneut geprüft; eigener Fixture-Stack gestartet, **Exit 0**. Dieselbe Datenwurzel, Revision 3 erhalten. Der Browser-Save ist auf dem F1-Kandidaten belegt; die F2-Anzeigekorrektur ist durch den Test belegt. Kein künstlicher neuer Save, Kategorienwechsel oder Datenreset für eine vermeintlich ununterbrochene Abnahme.
- Am 19.09.2026 um **14:06:56 UTC** im Browser **Entwurf vorbereiten** auf Revision 3: `POST …/drafts/production-draft-revision-94a2e82e56a881df30dcdd499bc516d90b082f6d84530c5d8bddcfe280413a51/prepare` → **201**. Neue Revision **4**, `production-draft-prepared-4826a6f5ae94d23e88c518b56cc4a42c5cf0f0f7779ba6d84c9cce43f2bc62f3`, `pending_review`. Beide Prüfpanels aktualisieren sich auf fünf neue offene Karten; keine alten Klassifikationsblocker mehr.
- Danach Browser **Reload → Historie → denselben Fall wiederöffnen → Rückfragen beantworten**. Antwort aus `GET …/drafts?caseId=production-case-handoff-6e0bf64a6bafbc9f5e43b5af9e935b5a5474ff2749c394bcc54005bd0a9b0291` → **200**: gespeicherte Revision 4 exakt gleich der Prepare-Antwort. Revisionen 2 und 3 sind `superseded`; pro Folgerevision genau ein passendes Timeline-Event mit Vorgängerreferenz. Case-Handoff `handoff-c6118104258962aa50d11638df006a97e50207c2bf7d3a745df4931fda6a458e`, `sourceSpecId=spec-browser-rehearsal-offer-case` und Draftquelle stimmen überein.
- Event-Spec vor/nach Save/Prepare strukturell vollständig verglichen: nur `menuCategory` der beiden Originalkomponenten geändert. Teilnehmerzahl 35, Datum, dreistündige Dauer, drei Servicemodule, Komponenten-IDs, Quellbelege, Annahmen, offene Zeitfenster-Unsicherheit und übrige bekannte Angaben exakt erhalten. Editor nach Wiederöffnung: `classic`, `vegetarian`; Herstellungsarten beide leer. Noch drei Rückfragen statt fünf, keine erneute Kategoriefrage.
- `python3 .runtime/acceptance-20260919/classification-assert-payloads.py` → **Exit 0**. Ergänzende DOM-/Timeline-/Request-/Konsolenprüfung → **Exit 0** (`classification-browser-check.json`): zwei Panels mit aktuellen Herstellungsblockern und jeweils gesperrtem **Entwurf freigeben**, null Konsolenfehler, 33 protokollierte Browserkommandos jeweils Exit 0. Der vollständige dynamische Request-Nachweis der Prepare-/Wiederöffnungsphase enthält genau eine Mutation: obiges Prepare. Save-Requests sind separat nach `production/drafts` gefiltert belegt. Keine Reviewkarte bestätigt; `approvedProductionSpecs=[]`.
- Browserbelege: `classification-fixed-save-response.log`, `classification-fixed-prepare-response.log`, `classification-fixed-reloaded-drafts.log`, `classification-fixed-case-response.log`, `classification-fixed-dom.log`, `classification-fixed-console.log`; sichtbarer Editor in `.playwright-cli/page-2026-09-19T14-07-58-176Z.yml`, Screenshot `page-2026-09-19T14-08-35-457Z.png`. Rohbelege bleiben lokal unter `.runtime/acceptance-20260919/` bzw. `.playwright-cli/`; geprüfte Ergebnisse und SHA256-Bindungen sind zusätzlich in `docs/agent-memory/2026-09-19-classification-acceptance-evidence.json` versioniert.
- Eigener Browser und ausschließlich eigener Stack beendet, **Exit 0**. Cleanupprüfung **Exit 0**, alle fünf Ports frei (`lsof` jeweils Exit 1 = keine Listener), Datenroot erhalten, elf Quellenhashes unverändert. Die vier fremden Rezept-/Allergenpfade stimmen weiterhin mit ihren ursprünglichen Hashes überein. Keine vorhandenen Daten gelöscht.

| Gegenstand nach Revision 4 | Belegter Status / nächste Voraussetzung |
| --- | --- |
| Zwei Kategorien | `kaffeepause-1=classic`, `croissants-und-wasserservice-2=vegetarian` gespeichert und wiedergefunden; ausdrücklich synthetische Operatorentscheidungen. |
| `card-prepared-event-spec` | Weiter `pending`, menschliche Prüfung der Event-/Quellenbasis erforderlich. |
| `card-prepared-production-plan` | Weiter `pending`; Plan bleibt `insufficient`, kein ausführbarer Produktionsstand. |
| `card-prepared-purchase-list` | Weiter `pending`; Liste enthält 0 Positionen, keine Einkaufsdeckung belegt. |
| `card-planning-blocker-1` | Neu berechnet: „Herstellungsentscheidung für Kaffeepause kompakt fehlt.“ Keine Kategoriefrage mehr. |
| `card-planning-blocker-2` | Neu berechnet: „Herstellungsentscheidung für Croissants und Wasserservice. kompakt fehlt.“ Keine Kategoriefrage mehr. |
| Produktionswege / Rezepte | Für beide Komponenten fehlt `productionDecision.mode`; keine Produktionsbatches, keine Rezept-Snapshots. Abhängig vom expliziten Weg werden nutzbare Rezepte oder belastbare Zukaufangaben benötigt. |
| Mengen / Küchenblätter | Die bekannten 35 Portionen je Komponente bleiben erhalten. Zwei Küchenblätter enthalten weiterhin Blocking-Hinweise, keine Zutaten und keine Arbeitsschritte. Keine neu belegten Rezeptmengen, Produktionsausbeuten oder vollständigen Unterlagen. |
| Weiterer technischer Übergang | Dieser begrenzte Handoff-Speicherpfad akzeptiert ausschließlich Kategorien. Andere Editoränderungen werden ausdrücklich abgewiesen; Herstellungsarten-, Zeitfenster- und Rezeptklärung sind durch diesen Block nicht als funktionierender Handoff-Speicherweg abgenommen. |
| Menschliche Küchenprüfung / Export | Nicht erfolgt. Keine Freigabe, Übernahme oder Exportvollständigkeit behauptet; Produktvertrag Abschnitt 9 und Definition of Done bleiben unerfüllt. |

Der beauftragte Klassifikationsübergang ist damit begrenzt belegt. Es gibt kein Gate-C-Gesamt-GO und kein Wiederaufrollen der vorherigen Angebots-, Gate-A- oder Gate-B-Abnahmen.


## Folgeauftrag: Herstellungsentscheidungen und Zeitfenster

- Auftrag: den vorhandenen kanonischen Handoff-Revisionsweg für ausdrücklich geänderte Herstellungs-/Zukauf-/Rezeptauswahl- und Zeitfensterangaben vervollständigen, gemeinsam speichern, Vorbereitung prüfen und denselben Fall wiederöffnen. Bestehende Kategorienabnahme bleibt erhalten. Maßgeblicher neuer PR-Kommentar: https://github.com/AlexanderSmyslowski/catering-agents-platform/pull/694#issuecomment-5742696479 (19.09.2026, 14:34:07 UTC), vollständig gelesen; keine weiteren Reviewthreads.
- Ausgangshead `d3129c5c9e2b1dc5547bb1e58dde3b7759b218d4`, Tree `964a562d3ea271713729f61735e716bfff90e0c2`, sauberer Produkt-Worktree. Remote #694, #682 und main bestätigt unverändert. Neuere separate Serverzweige werden nicht verändert. Die vier geschützten Rezept-/Allergenpfade weiterhin hashgleich. Bestehende Lockfile-Installation wiederverwendet; keine Versionsaktualisierung.
- Die beiden im Kommentar genannten Git-Blobs stimmen lokal exakt: Update-Modul `93911a54722867e896a9e783c025988fb627f7f1`, Snapshot-Modul `a4f5c848279ef2a1b48327d6d95b8cc4daebb985`. Direkte Ausführung der Originalfunktionen mit Node 26.0.0 bestätigt **zwei Kontrollen bestanden, Z1–Z3 fehlgeschlagen, Exit 1**: Wiederöffnung verdoppelt den Zeittext, zwei vorhandene Abschnitte werden auf einen reduziert, `Station 2` wird als `02:00` gelesen. Keine Datenmutation. Belege `manufacturing-original-z1-z3.log`, `manufacturing-original-z1-z3-binding.json` und aufgezeichneter Programmeingang.
- Diese RED-Evidenz ist weiterhin ein isolierter Funktionsnachweis, keine Behauptung eines geschehenen Handoff-Datenverlusts. Der vorherige Handoff-Speicherweg weist Zeitfenster-/Herstellungsänderungen ausdrücklich ab. Die Reparatur muss deshalb vor seiner Öffnung die strukturgetreue Erhaltung unveränderter Angaben, feldweise Deltas und klare Ablehnung unklarer Zeitänderungen sicherstellen.
- Unabhängiger Scope-Review `manufacturing_scope_review` und Implementierung `manufacturing_implementation`, beide `gpt-6-astra/high` wegen API-/Persistenz-/Datenintegritätsrisiko; Scope-GO, Code-/Laufzeitabnahme noch offen. Koordinator behält Browser und Dokumentation, Implementer alleinige Quellen-/Testverantwortung. Keine parallele zweite Zeitparser-Reparatur.
- Geplante, noch nicht ausgeführte synthetische Operatorentscheidungen für den erhaltenen Fall: Kaffeepause `scratch`, Croissants/Wasserservice `convenience_purchase` mit ausdrücklich benannten Croissants und Wasser, Service-Zeitfenster `09:00–12:00`. Kein Quellbeleg behauptet diese Herstellungsarten; die Wahl wird als Testentscheidung dokumentiert. Das vorhandene Prepare-Gate fordert für `scratch`/`hybrid` genau eine fall-/revisionsgebundene Planungs-Evidenz. Fehlende Rezept-/Mengengrundlagen dürfen nicht durch einen anderen Testmodus oder erfundene Freigabe umgangen werden.

### Umsetzung und Prüfstand vor dem Browserlauf

- Der kanonische Revisionsbefehl übernimmt nur explizit geänderte erlaubte Felder. Unveränderte Kategorien und Komponentenangaben werden nicht erneut geschrieben; ausgelassene optionale Felder bleiben erhalten. Die bestehende Kategorie-Retryidentität bleibt kompatibel. Fremde Rezept-/Allergenimplementierung bleibt unberührt.
- Der Editor erhält die ursprüngliche strukturierte Zeitliste zusätzlich zur Anzeige. Unveränderte mehrteilige oder unstrukturierte Zeitangaben bleiben exakt erhalten. Neu bearbeitbar ist ein eindeutiger Abschnitt `HH:mm–HH:mm` am selben Tag; unklare/mehrteilige Änderungen werden verständlich abgewiesen. Nur die bekannte beantwortete Extraktionsfrage zum Zeitfenster wird entfernt, unabhängige Fragen/Prüfpflichten bleiben offen.
- Source-Freeze vor unabhängiger Codeprüfung: elf Dateien gegen `d3129c5`, Diff-SHA256 `3ed8da2ddab76179461dcb6fd6b4fc0a2e4947e0ab54d3a2f1d330c10fe4d025`; vollständiges Manifest `manufacturing-implementation-freeze.json`. Der Koordinator hat Quellen-, Test- und Protokollhashes selbst abgeglichen.

| Ausgeführter Befehl / Nachweis | Ergebnis / Exitcode |
| --- | --- |
| `npx vitest run tests/production-planning-evidence-p1.test.ts --maxWorkers=1` | 82/82 bestanden, Exit 0 (`manufacturing-api-final.log`). |
| `npx vitest run tests/production-spec-edit-update.test.ts tests/production-spec-edit-snapshot.test.ts tests/production-spec-edit-persist-action.test.ts tests/use-production-spec-editor.test.ts tests/production-planning-controls.test.ts tests/production-draft-review-panel.test.tsx --maxWorkers=1` | Abschließend 55/55 in sechs Dateien, Exit 0 (`manufacturing-ui-accepted.log`). |
| `npx tsc --noEmit` | Exit 0 (`manufacturing-typecheck-accepted.log`). |
| `npm run build` beim Koordinator | Typecheck und Vite-Build Exit 0 (`manufacturing-build.log`, Bindungsmanifest). |
| Ursprüngliches Fünf-Fälle-Programm, unverändert über `node --import tsx --input-type=module` | Z1–Z3 und beide Kontrollen bestanden, Exit 0 (`manufacturing-fixed-z1-z3.log`). Installierter tsx-Resolver löst die projektüblichen `.js`-Imports aus TypeScript auf; keine neue Abhängigkeit. |
| `git diff --check` | Exit 0. |

Die initialen RED-Läufe und tatsächlichen Zwischenfehler bleiben im Freeze-Manifest mit Kommandos, Exitcodes und Loghashes erhalten: UI 12 neue Fehler, API drei neue Speicherfälle abgewiesen; später undefinierter Schedule-Vergleich mit HTTP 500 sowie ausgelassene optionale Felder gezielt behoben. Testpräzisierungen unterscheiden operative Projektion von vollständigem gespeicherten Snapshot und erwarten die Entfernung ausschließlich der beantworteten generierten Zeitfrage. Keine Reviewpflicht wurde für ein grünes Ergebnis deaktiviert. Dies ist noch keine Laufzeitabnahme.


### Unabhängiger Reviewbefund vor Laufzeit

Der unabhängige Review reproduzierte einen **P1/Important**-Befund auf diesem ersten Freeze: Beim expliziten Ersetzen eines vorhandenen Zeitplans mit zwei Abschnitten durch einen einzelnen Abschnitt lieferte `POST …/revise` **201**, während eine unabhängige erforderliche offene Prüfkarte weiter auf `$.draftArtifacts.eventSpec.event.schedule[1]` zeigte. Dieses Ziel existierte anschließend nicht mehr. Isolierter Probe `manufacturing-review-schedule-target-probe.ts` mit tatsächlichem Servicecode und ausschließlich separaten synthetischen Testobjekten, erwartetes fail-closed 422 nicht erreicht, **Exit 1** (`manufacturing-review-schedule-target-probe.log`). Keine Mutation des erhaltenen Falls und kein behaupteter dortiger Datenverlust. Code-GO und Browserlauf wurden angehalten; gezielte Korrektur mit erneuter betroffener Prüfung erforderlich. Grüne vorherige Tests ersetzen diesen offenen Datenintegritätsbefund nicht.


M-R1-Nachbesserung: Ein unabhängiges Prüfziel unter `event.schedule` darf bei einer tatsächlichen Zeitplanänderung nur erhalten bleiben, wenn der vollständige referenzierte Abschnitt am selben Index inhaltlich identisch bleibt. Ein entferntes/ersetztes Element oder eine unabhängige Prüfung des geänderten Gesamtzeitplans wird vor der Persistenz mit **422** abgewiesen. Herstellungsspeicherung bei unverändertem Zeitplan bleibt zulässig. Regression-RED: **vier Fehler, zwei bestandene Positivkontrollen, Exit 1**; danach der gesamte betroffene Revisionskorridor (`npx vitest run tests/production-planning-evidence-p1.test.ts -t 'explicit handoff classification revisions' --maxWorkers=1`) mit **40 bestandenen Tests**, 48 andere Tests bewusst nicht erneut ausgeführt, **Exit 0**. Typecheck, Diffcheck und erneuter betroffener Build beim Koordinator **Exit 0**. Nur API-Route und zugehörige Testdatei gegenüber dem ersten Freeze verändert; die gültigen 55 UI-Tests und der Fünf-Fälle-Nachweis bleiben nach Hashvergleich wiederverwendet. Aktueller Source-/Test-Diff SHA256 `8ad79c4da8c4de8a1d043268b0bb1c92c5f9476f19deb9e99fb4f90dad01631e`, elf Dateihashes in `manufacturing-m-r1-freeze.json`, Buildbindung `manufacturing-build-m-r1-binding.json`. Unabhängiges Delta-GO noch erforderlich.


### Tatsächliches Ergebnis des Herstellungs-/Zeitfensterblocks

- Unabhängiger Delta-Review **Code-GO**, M-R1 geschlossen, keine weiteren Findings (`manufacturing-m-r1-independent-review.json`). Der unveränderte Reviewer-Probe erreicht jetzt **422, Exit 0**. Vor dem Browserstart elf Quellenhashes, freien Ports und erhaltenen Datenroot abgeglichen; eigener Fixture-Stack **Exit 0**, alle Migrationen bereits vorhanden. Keine neue Installation, Version, Referenzfall- oder Angebotsanlage.
- Synthetische Operatorentscheidungen tatsächlich über die Oberfläche eingetragen: **Kaffeepause = Eigenproduktion (`scratch`)**, **Croissants/Wasserservice = Convenience-Zukauf (`convenience_purchase`)**, Zukauf „Croissants, Wasser“, **Service 09:00–12:00**. Beide Komponenten tragen ausdrücklich synthetische Testnotizen mit offenen Rezept-/Mengen- bzw. Produktspezifikationsgrundlagen. Kategorien `classic` und `vegetarian` unverändert. Keine Rezeptzuweisung erfunden: die sichtbare Bibliothek enthält **0 Rezepte**.
- **Antworten speichern**, 19.09.2026 **15:05:00.887 UTC**: genau ein `POST …/drafts/production-draft-prepared-4826a6f5ae94d23e88c518b56cc4a42c5cf0f0f7779ba6d84c9cce43f2bc62f3/revise` → **201**. Gespeicherte Revision **5**, `production-draft-revision-fe73b9d268bebeaa20b213567133c2b95aacacaed15b1ca20b92f5b28e7fea6c`, `pending_review`, Vorgänger Revision 4 `superseded`. Genau ein neues `revision_created`-Timeline-Ereignis mit diesem Vorgänger.
- **Entwurf vorbereiten**, 15:05:18 UTC: `POST …/drafts/production-draft-revision-fe73b9d268bebeaa20b213567133c2b95aacacaed15b1ca20b92f5b28e7fea6c/prepare` → **409**, sichtbar: „Prepare benötigt exakt eine Planungs-Evidenz je Produktionskomponente.“ Keine Revision 6 und keine neuen vorbereiteten Artefakte. Dieser Schritt ist **blockiert**, nicht erfolgreich abgenommen. Kein Wechsel auf einen anderen Herstellungsmodus, keine Direktdatei-/Datenbankänderung und keine erfundene Evidenz zum Umgehen des Gates.
- Danach **Reload → Historie → denselben Fall öffnen → Rückfragen und Antworten → Angaben prüfen**. Revision 5 aus `GET …/drafts?caseId=…` → **200** entspricht exakt der gespeicherten Antwort. Editor zeigt `09:00-12:00` ohne Verdopplung, beide Herstellungsarten, Zukauf und beide Notizen unverändert; **Antworten speichern** ist ohne Änderung deaktiviert. Keine verlorenen bekannten Angaben oder erneute Kategorie-/Herstellungs-/Zeitfrage.
- Vollständiger Strukturvergleich mit Revision 4: ausschließlich die ausdrücklich eingetragenen `productionDecision`-Felder, `event.schedule` und die beantwortete generierte Zeit-Unsicherheit geändert. Alle übrigen Event-/Komponentenfelder einschließlich Datum, drei Stunden Dauer, 35 Teilnehmern/Portionen, drei Servicemodulen und Herkunft identisch. Fall `production-case-handoff-6e0bf64a6bafbc9f5e43b5af9e935b5a5474ff2749c394bcc54005bd0a9b0291`, Handoff `handoff-c6118104258962aa50d11638df006a97e50207c2bf7d3a745df4931fda6a458e` und Spec `spec-browser-rehearsal-offer-case` weiter exakt gebunden.
- Revision 5 enthält einen erforderlichen offenen Event-/Herstellungsprüfpunkt; beide Panels zeigen ihn und sperren **Entwurf freigeben**. Die fünf vorherigen Karten verbleiben unverändert im supersedierten Stand: Eventprüfung wird in der neuen Revision erneut verlangt, bisheriger Plan/Einkauf und deren Karten sind als abgeleitete Ergebnisse verworfen und müssen nach erfolgreicher Vorbereitung neu entstehen; die zwei fehlenden Herstellungsarten sind jetzt beantwortet. **Keine Karte bestätigt**, `approvedProductionSpecs=[]`. „Keine offenen Rückfragen“ bzw. vollständige Event-Spec bezeichnet nur diese Eingabebasis, keinen ausführbaren Produktionsstand.
- `python3 .runtime/acceptance-20260919/manufacturing-assert-payloads.py` → **Exit 0**, prüft vollständige Snapshotgleichheit, Fall-/Handoff-/Spec-/Revisions-/Timelinebindung, alle erlaubten Änderungen, DOM-Werte und die weiter gesperrte Freigabe. **44 Browserkommandos jeweils Exit 0**; im gesamten dynamischen Netzwerkprotokoll genau zwei Mutationen: Save 201 und Prepare 409. Der erwartete 409 erzeugt genau einen Browser-Netzwerkfehler, keine weiteren unerwarteten Konsolenfehler. Nicht als null Fehler im Gesamtlauf ausgegeben.
- Rohbelege: `manufacturing-save-response.log`, `manufacturing-prepare-response.log`, `manufacturing-reopened-drafts.log`, `manufacturing-reopened-case.log`, `manufacturing-final-requests.log`, `manufacturing-dom.log`, `manufacturing-payload-check.json`. Snapshot `.playwright-cli/page-2026-09-19T15-06-32-417Z.yml`; Screenshots `page-2026-09-19T15-06-57-334Z.png` und `page-2026-09-19T15-07-40-324Z.png`. Kuratierte Resultate/Hashbindungen zusätzlich in `docs/agent-memory/2026-09-19-manufacturing-acceptance-evidence.json` versioniert.
- Eigener Browser und ausschließlich eigener Stack beendet, **Exit 0**. Alle fünf Ports wieder frei (`lsof` je Exit 1), Datenroot und alle elf Quellenhashes erhalten, vier geschützte fremde Rezept-/Allergenpfade unverändert (`manufacturing-stop-check.json`).

| Grundlage nach Revision 5 | Tatsächliches Ergebnis / nächste Voraussetzung |
| --- | --- |
| Herstellung / Zeitfenster | Für beide Originalkomponenten und den bekannten dreistündigen Termin gespeichert; ausdrücklich synthetische Entscheidungen, keine Küchenbestätigung. |
| Eigenproduktion Kaffeepause | Weg jetzt eindeutig; vorhandenes Rezept, konkrete Mengenentscheidung und menschlicher `RecipeEventUseReview` fehlen. Für diese Fall-/Draft-/Revisionsbindung liegt keine Planungs-Evidenz vor, daher tatsächliches Prepare 409. |
| Croissants / Wasser | Zukaufrichtung und Produktbezeichnungen vorhanden. Produktspezifikation, Einheiten/Packungen und belastbare Beschaffungsmengen offen. Noch keine neu berechneten Einkaufspositionen. |
| Rezepte / Produktionsplan / Mengen | Revision 5 hat keine Rezept-Snapshots, Produktionsbatches oder Produktionsunterlagen. Die bekannten 35 Portionen je Komponente sind erhalten, aber keine Zutaten-/Ausbeute-/Skalierungsgrundlage. |
| Einkauf / Export | Keine neue Einkaufsliste und kein vollständiger Export. Historische leere Unterlagen sind kein fertiges Ergebnis. |
| Vorhandener Operatorweg zur nächsten Evidenz | Quellcodeabgleich: Backend `POST /v1/production/cases/:caseId/planning-evidence` verlangt passendes Bibliotheksrezept, Mengenentscheidung und vertrauenswürdige menschliche Event-Rezeptprüfung; im Backoffice fehlt ein Aufrufer für diesen Bindungsschritt. Der bestehende Mengenworkflow wird erst für `approvedProductionSpecId` aufgebaut; tatsächliches Browser-GET liefert `items=[]`. Rezeptauswahl allein ersetzt diese Evidenz nicht. |
| Menschliche Küchenprüfung | Nicht erfolgt und ausdrücklich offen. Kein pauschales Bestätigen von Reviewkarten und keine reale Freigabe. |

Damit sind sämtliche Korrekturen aus dem Kommentar und M-R1 sowie gemeinsame Speicherung/Wiederöffnung konkret geprüft. Der vollständige Übergang zur erneuten Vorbereitung ist weiterhin am benannten Rezept-/Mengen-/menschlichen Evidenz-Gate und dessen fehlendem bestehenden Operator-Anschluss blockiert. Kein pauschales Abschluss-GO für den Folgeblock und kein Gate-C-Gesamt-GO. Die fehlende Fachbasis wird nicht durch neue Testdaten, eine neue Funktion oder Änderungen an fremder Rezept-/Allergenarbeit ersetzt.


## Folgeauftrag: Rezept-, Mengen- und Prüfungsanschluss

- Maßgeblicher Kommentar [#5743033256](https://github.com/AlexanderSmyslowski/catering-agents-platform/pull/694#issuecomment-5743033256) vollständig gelesen. Ausgangshead `24519660988db8970a7c84db58a39c0e979ba557`, Tree `79ef97b995e0aa8b0761ace4707903d63ae2fea0`; keine Rücksetzung, kein neuer Angebots- oder Referenzfall. Die unveröffentlichte Rezept-/Allergenarbeit blieb außerhalb dieses Scopes. Der Lauf verwendete eine isolierte Kopie des erhaltenen synthetischen Falls, Fixture-Provider und freie Alternativports; der ursprüngliche Datenroot blieb unverändert.
- Das bestehende Backoffice führt jetzt im vorhandenen Produktionsarbeitsbereich durch den Backend-Vertrag: vorhandene Rezeptbibliothek laden beziehungsweise ausdrücklich synthetischen Kandidaten über den bestehenden Upload anlegen, Rezeptzuordnung als kanonische Folgerevision speichern, diese Revision frisch lesen, konkrete Mengenentscheidung und vier Event-Prüfbestätigungen erfassen, exakt gebundene Planungs-Evidenz speichern und danach erneut vorbereiten. Es gibt keine neue Route, keine zweite Datenhaltung und keine zweite Mengen-/Freigabewahrheit.
- Die GET-Projektion für fallgebundene Produktionsentwürfe liefert die vorhandenen Planungs-Evidenzen und die zugehörigen Rezept-Snapshots samt serverberechnetem Hash. Schreibzugriffe prüfen Fall, Komponente, aktuelle Draft-ID und Revision, zugewiesene Rezept-ID, unveränderten Snapshot-Hash, `ready_for_scaling`, den aktuellen vertrauenswürdigen Actor und alle vier Eventbestätigungen. Zukauf bleibt von der Eigenproduktions-Evidenz ausgenommen. Fremde, veraltete, doppelte, malformed oder durch Rezeptänderung stale gewordene Daten bleiben fail-closed.
- Der lokale Vite-Proxy setzt die Administrator-Sitzungsidentität nur für den exakten Planning-Evidence-POST und nur bei DevAuth, nichtleerem Trusted-Secret sowie Loopback-Zielen für Intake und Produktion. Alle anderen Methoden/Pfade behalten die vorhandene lokale Produktionsidentität; Hosted-/Session-/Capability-Grenzen wurden nicht geöffnet.

### Implementierungs- und Prüfnachweise

Unabhängiger Scope-Review: **GO**. Der erste unabhängige Code-Review hielt zwei Important-Befunde an: nicht-stringförmige Mengen-Enums konnten die Provenienzprüfung umgehen oder einen 500 auslösen; endgültige 409/422-Antworten behielten eine veraltete Retry-Nutzlast. Beide wurden mit gezielten RED→GREEN-Prüfungen korrigiert. Abschließender unabhängiger Code-Review, separater Import-/Build-Delta-Review und Gesamtprüfung der Laufzeit-/Dokumentationsbelege: **GO**, keine offenen Critical-/Important-/Minor-Befunde. Dies gilt ausschließlich für diesen begrenzten technischen Block, nicht für Merge, Deployment oder Gate-C insgesamt. Vollständiger geprüfter Zehn-Dateien-Inhaltsfingerabdruck `1624621f9f442f4fcfc30e75e4127b511b0e09a230b19645a20b795a17c10f2e`.

| Ausgeführter Befehl / Nachweis | Ergebnis / Exitcode |
| --- | --- |
| Gezielter Review-Fix-RED über Backend/API/Panel mit fünf Namensfiltern | 12 fehlgeschlagen, 2 bestanden, Exit 1. |
| Derselbe Review-Fix-Korridor nach Korrektur | 14/14 bestanden, Exit 0. |
| `npx vitest run` über 15 betroffene Planning-Evidence-, UI-, Session-, Proxy-, Mengenbridge-, Rezeptreview- und Login-Dateien mit `--maxWorkers=1` | 15 Dateien, **286/286 Tests**, Exit 0. |
| `npx tsc --noEmit` | Exit 0. |
| `npm run build` | Exit 0; 196 Vite-Module, Browserbundle ohne serverseitigen `node:crypto`-Import. |
| `git diff --check` | Exit 0. |
| `python3 .runtime/acceptance-20260919/recipe-evidence-assert.py` | Exit 0; Bindungen, Snapshot-Hash, Revisionen und sämtliche abgeleiteten Artefakte geprüft. |

Keine unveränderte Vollsuite wurde wiederholt. Abhängigkeiten blieben am vorhandenen Lockfile; `package-lock.json` SHA256 `9e87460f1cdf88a68dbce46798655ffa6f5ebd9766bcc33ce17fc7ee79165a46`.

### Tatsächlicher Browserlauf am erhaltenen Fall

- **Rezeptupload** über die vorhandene Produktionsbibliothek: `POST …/recipes/upload` → **201**. Kandidat `upload-kaffeepause-kompakt-synthetische-testfixture-3d824e6ef7`, Grundausbeute 10 Portionen, Status weiter `review_required`, Fixture-SHA256 `1724211e7bc330be4d2972343bbd7e45078f240c52999259fa24d4d9ccd44e95`. Keine Hausrezept-, Allergen- oder globale Rezeptfreigabe erzeugt.
- **Rezeptzuordnung speichern**: `POST …/drafts/production-draft-revision-fe73…/revise` → **201**. Kanonische Revision **6** `production-draft-revision-8cb13f68d61e99bdb9c2a91595e3c5b849086e4a7e331e95cbfd65ddfa327aa9`, Vorgänger Revision 5 danach `superseded`. Fall, Handoff, Event-Spec, Kategorien, Herstellungsentscheidungen, Zukauf und Service 09:00–12:00 unverändert.
- Nach frischem Lesen von Revision 6 wurde sichtbar und ausdrücklich synthetisch entschieden: Rolle `snack`, eine Portion pro Person, Ziel **35 servings**, Herkunft `synthetic:browser-rehearsal-2026-09-19`. Alle vier Eventbestätigungen wurden durch den angemeldeten synthetischen Testakteur `Administrator` betätigt; dies ist keine reale Küchenprüfung.
- **Menge und Eventprüfung speichern**: `POST …/cases/:caseId/planning-evidence` → **201**. Evidenz exakt an Fall, `kaffeepause-1`, Revision 6, Event-Spec und Rezept gebunden; Bridge `ready_for_scaling`; Rezept-Snapshot `sha256:9d27f077525ef5e05a08fe4e0b485f3dfce99df07a1f9174eca7d7f2ab0a6c6e` unabhängig nachgerechnet.
- **Entwurf vorbereiten**: `POST …/drafts/production-draft-revision-8cb13…/prepare` → **201**. Kanonische Revision **7** `production-draft-prepared-31f5a1cb7559da8fe3ac1bea4f7fe62e22e743a78be25e0f02b1f7c252f68a29`, `pending_review`, Revision 6 `superseded`.
- **Reload und Wiederöffnung**: Revision 7 wird als aktueller Entwurf desselben Falls mit derselben Handoff-/Spec-Bindung und derselben Rezeptzuordnung angezeigt. Sie enthält Eventdaten, Produktionsplan, Einkaufsliste und eine Rezeptkarte. Die Evidenz von Revision 6 wird nur als Vorgängerherkunft gezeigt und nicht still als Prüfung der neuen Revision übernommen. Vier neue erforderliche Reviewkarten bleiben `pending`; **Entwurf freigeben** bleibt gesperrt.
- Browser-Netzwerk: alle vier Mutationen 201; danach fallgebundene GETs 200. Browserkonsole: **0 Errors**. Direkter Planning-Evidence-Zugriff ohne vertrauenswürdigen Operator → **403**. Wiederholung der D6-Evidenz nach Erzeugung von D7 → **409**. Damit bleiben Auth- und Stale-Revision-Grenzen am Laufzeitstand geschlossen.

### Tatsächlich entstandene Artefakte und Grenzen

| Gegenstand nach Revision 7 | Belegter Stand |
| --- | --- |
| Rezept-Snapshot | Ein synthetischer Snapshot mit Grundausbeute 10 Portionen; Status `review_required`, keine reale oder globale Rezeptfreigabe. |
| Menge / Produktionsbatch | Ein Batch für `kaffeepause-1`, Ziel 35 Portionen, vier Chargen; 350 g Kaffeebohnen, 70 g Tee, 3,5 l Haferdrink. Keine automatischen Zuschläge als Operatorentscheidung behauptet. |
| Küchenunterlagen | Zwei Küchenblätter: ein rezeptgebundenes Eigenproduktionsblatt und ein Zukaufblatt für Croissants/Wasser. Beide liegen nur im offenen Entwurf. |
| Einkaufsliste | Fünf Positionen: drei Rezeptzutaten mit Rezeptlineage sowie Croissants und Wasser mit Zukauflinie, jeweils 35 Portionen. Produktspezifikation, Gebinde, Lieferant und reale Einkaufsdeckung für den Zukauf bleiben offen. |
| Review / Freigabe | Vier Karten offen: Eventdaten, Produktionsplan, Einkaufsliste, Rezept-Snapshot/Skalierung. `approvedProductionSpecs=[]`; kein Plan angewendet, kein Export als vollständig gewertet. |
| Menschliche Grenze | Die Testbestätigungen belegen ausschließlich den technischen Operatorweg. Echte Küchenprüfung von Ausbeute, Methode/Ausstattung, Allergenen/Ernährung sowie Warmhaltung/Regeneration ist nicht erfolgt. |

Kuratierter Nachweis einschließlich Befehlen, Exitcodes, Hashbindungen und Laufzeitgrenzen: `docs/agent-memory/2026-09-19-recipe-planning-evidence-acceptance.json`. Rohantworten und Browser-Snapshots bleiben lokal unter `.runtime/acceptance-20260919/` beziehungsweise `.playwright-cli/`. Eigener Browser und eigener Stack wurden beendet; Ports 3311–3314 und 3320 sind wieder frei. Fremde Prozesse wurden nicht gestoppt, Daten wurden nicht gelöscht.

Der vorherige technische 409-Blocker ist damit für diesen synthetischen Fall über den vorgesehenen Operatorweg geschlossen. Offen bleiben die reale menschliche Küchenprüfung, die vier Entwurfsreviews, belastbare Zukaufspezifikation, Übernahme/Freigabe und Exportabnahme. Kein Gate-C-Gesamt-GO.


## Folgeauftrag: Zukauf-, Review-, Übernahme- und Exportblock ab D7

- Maßgeblicher Kommentar [#5743734627](https://github.com/AlexanderSmyslowski/catering-agents-platform/pull/694#issuecomment-5743734627) vollständig gelesen. Arbeitsbasis `3deb5547910e2795388a62a04555a0811c40eb9c`, Tree `76eb97f3e26e7c44a3dc902fd86093d07246d257`; weiter im vorhandenen isolierten Produkt-Worktree und ausschließlich auf der erhaltenen D7-Kopie `/tmp/catering-recipe-continuation-4ANJAV`. Der ursprüngliche D5-Datenroot, Angebotsstart, Referenzfall und bereits abgenommene D5→D7-Arbeit wurden nicht wiederholt oder zurückgesetzt.
- Ruling: Der ausführliche PR-Kommentar ist die bindende Produktspezifikation; der ignorierte lokale Ausführungsplan zerlegt nur die Umsetzung und fügt keinen Produktscope hinzu.
- Ruling: Die ausdrücklich synthetischen Beschaffungsentscheidungen sind **Croissants 1 Stück je Person → 35 Stück** und **Wasser 0,5 l je Person → 17,5 l**. Sie sind keine Aussage einer echten Küche und enthalten keine bestätigten Lieferanten-, Preis-, Gebinde- oder Bestandsdaten.

### Begrenzte Produktkorrekturen

- Der bestehende kanonische Draft-Revisionsweg erfasst für jede Zukaufkomponente eine vollständige, namensgenau gebundene Menge je Person. Der Server validiert positive endliche Mengen, Einheiten, Vollständigkeit, Eindeutigkeit und die bestehende Komponenten-/Fall-/Revisionsbindung; die Einkaufsliste multipliziert genau einmal mit 35 Teilnehmern. Legacy-Kontexte ohne diesen kanonischen Speicherweg zeigen keinen nicht speicherbaren Mengeneditor. Änderungen erzeugen eine Folgerevision und invalidieren frühere abgeleitete Artefakte, Planungs-Evidenz und Draft-Reviews wie vorgesehen.
- Die vier vorhandenen Reviewkarten zeigen vor der Einzelentscheidung ihren jeweils eingefrorenen Zielinhalt: Eventdaten, Produktionsplan mit Batch/Küchenblättern, Einkaufsliste mit Herkunft sowie Rezept-Snapshot mit Quelle, Status und Skalierung. Keine Karte wird automatisch entschieden oder auf eine Folgerevision übertragen.
- Approval, Apply und die vorhandenen Exporte sind an den freigegebenen kanonischen Produktionssnapshot sowie die exakten Plan-, Einkaufslisten- und Rezeptidentitäten gebunden. Apply publiziert File-backed Artefakte erst gemeinsam mit abgeschlossenem Audit/Manifest; Rollback und Wiederholung erzeugen keine sichtbar halbfertigen oder doppelten Exporte.
- Der erste Laufzeit-Apply blieb mit 409 bei fehlender lesbarer Offer-/Handoff-Evidenz stehen; der nächste enge Kandidat blieb mit 409 bei inkonsistenter `sourceLineage` stehen. Die tatsächliche Ursache war der ältere erhaltene Handoff: Er besitzt noch keinen neu eingeführten Intake-Quellsnapshot, während der fachlich zulässige Produktionsnachfolger Kategorien, Herstellungsangaben, Zeit, Rezept und Zukaufmenge enthält. Der endgültige Kompatibilitätspfad akzeptiert diesen Altfall nur durch exakte Rekonstruktion aus Rohrequest, ausgewählter Offer-Variante und den belegten Reviewfeldern. Neu erzeugte Handoffs transportieren den unveränderlichen Intake-Quellsnapshot und prüfen ihn vor jedem Fallback. Budget-, Label-, Modus-, Handoff-Root-, Rollen- und Tenant-Abweichungen bleiben fail-closed. Ein zuvor zu breiter Kandidat wurde nach unabhängiger Prüfung nicht akzeptiert.

### Tatsächlicher Bedienweg auf der erhaltenen D7-Kopie

1. In der vorhandenen Oberfläche wurden für die Convenience-Komponente Croissants `1 Stück` und Wasser `0,5 l` je Person eingetragen. **Antworten speichern** erzeugte Revision 8 `production-draft-revision-429e40c9f71ff1548caf52034ae407886bcbb2177f668341d9d037489723abc7` aus D7. Kategorien, `scratch`-/`convenience_purchase`-Entscheidungen, Rezeptzuordnung und Service 09:00–12:00 blieben erhalten.
2. Der erste Prepare-Versuch auf D8 antwortete korrekt 409, weil die D6-Planungs-Evidenz nach der mengenändernden Folgerevision nicht still weitergalt. Über denselben vorgesehenen Operatorweg wurde die synthetische Mengen-/Eventprüfung frisch an D8 gebunden (`planning-evidence` 201); danach erzeugte Prepare 201 die Revision 9 `production-draft-prepared-92bfcfccedfcc6b518e7698314a2a4e28f754533abcdd6efe8165ed5817c921d`.
3. Eventdaten, Produktionsplan, Einkaufsliste und Rezept-Snapshot/Skalierung wurden sichtbar und einzeln geprüft; alle vier Review-PATCHes antworteten 200. Der angemeldete Fixture-Akteur `Produktions-Mitarbeiter` entschied jede Karte einzeln als `fits`. Diese technische Testhandlung ist keine tatsächliche menschliche Küchenprüfung.
4. Die vorhandene Entscheidungsschaltfläche erzeugte die technische Freigabe `approved-production-spec-4b9e04e12d2f2038ec868fab74ee088f68afadf966b3b9247cc680a9e55290e4` mit Approval `approval-926d227bc313c799aec258624e84887ac5a58a1b79527c11ad44dfa52b208281` (201). Nach der begrenzten Apply-Korrektur führte **Entwurf übernehmen** im Browser zu 200 und genau den bestehenden IDs `plan-spec-browser-rehearsal-offer-case`, `purchase-spec-browser-rehearsal-offer-case` und `upload-kaffeepause-kompakt-synthetische-testfixture-3d824e6ef7`. Das Manifest bindet sie an denselben Event-Spec; der Fall steht in Version 3 auf `completed`.
5. Ein identischer Apply-Retry am abschließend geprüften Code-Head antwortete 200 mit exakt denselben IDs; keine zweiten Pläne, Einkaufslisten oder Rezepte entstanden. Direkte Apply- und Exportzugriffe ohne vertrauenswürdigen Produktionsoperator antworteten jeweils 403.
6. Reload, Historie und Wiederöffnung zeigten denselben Fall als `completed · geöffnet`, dieselbe freigegebene Revision, genau einen Plan, eine Einkaufsliste mit fünf Zeilen, dieselben Exportlinks und den weiterhin prüfpflichtigen Rezeptkandidaten.

### Inhalt der übernommenen Artefakte und Exporte

| Gegenstand | Geprüfter Inhalt |
| --- | --- |
| Rezept / Skalierung | Synthetischer Upload, Grundausbeute 10 Portionen, Zielausbeute **35 Portionen**, **vier Chargen**. Die Chargenzahl vervielfacht weder Zielausbeute noch Zutaten. Status bleibt `review_required`. |
| Produktionsbatch | Genau ein Eigenproduktionsbatch: 350 g Kaffeebohnen, 70 g Tee und 3,5 l Haferdrink. |
| Küchenblätter | Zwei Blätter: rezeptgebundene Kaffeepause und Convenience-Zukauf. Der Zukauf nennt weiter die Prüfung von Lieferquelle/Gebinde; kein Rezept dafür erfunden. |
| Einkauf | Genau fünf eindeutige Zeilen: **35 Stück Croissants**, **17,5 l Wasser**, 3,5 l Haferdrink, 350 g Kaffeebohnen und 70 g Tee. Alle drei Rezeptzutaten besitzen Rezeptlineage; beide Zukäufe besitzen Komponentenlineage. Es gibt keine unbelegte oder doppelte Zeile. |
| Produktionsplan-HTML | Tatsächlich im Browser geöffnet und Text geprüft: Fall-, Approved-Spec-, Quelldraft-/Revision-, Apply-, Plan- und Einkaufslistenanker; 35 Portionen, vier Chargen, alle fünf Mengen, beide Küchenblätter und `Prüfung nötig`. |
| Produktionsmappe-HTML | Tatsächlich im Browser geöffnet und Text geprüft: dieselben Anker, Rezeptkarte, Küchenblätter, Zutatenabgleich und fünf Einkaufszeilen. Die Unterlage nennt sie als Arbeitsdokument und fordert Mengen-, Allergen- und Preisprüfung vor Produktion. |
| Einkaufs-CSV | Browser meldete Start und Abschluss des Downloads `purchase-spec-browser-rehearsal-offer-case.csv`; heruntergeladene Datei und Belegkopie sind bytegleich, SHA256 `29e3dbc16ac9b4e14b8c23b9f6b3ffc5478ffd5776937c411b88dd7675bd2171`, fünf geparste Datenzeilen. Der Playwright-Wrapper beendete genau diesen Befehl trotz abgeschlossenen Downloads mit Exit 1; dieses Werkzeugergebnis wird nicht als Exit 0 umgedeutet. |

Die in der Produktionsmappe vorhandenen Hinweise `Metro Convenience` und `Metro Fresh` sind bestehende System-Arbeitshinweise. Sie belegen keinen realen Lieferanten, keine Preise, Gebinde, Bestände oder Bestellung. Für den synthetischen Lauf war keine Gebindeumrechnung nötig, weil die gewählten Beschaffungseinheiten Stück und Liter sind; konkrete Produktauswahl und Gebinde bleiben vor einer echten Beschaffung offen.

### Prüfungen und unabhängige Abnahme

| Befehl / Nachweis | Ergebnis |
| --- | --- |
| Task-1-Korridor für Schema, Editor, Revision und Einkauf | initial 216/216; nach zwei Important-Befunden 97/97; unabhängiger Abschlussreview PASS. |
| Task-2-Korridor für eingefrorene Reviewinhalte | 47 UI-Tests sowie 15/15 präzisierte Mengenfixture-Tests; unabhängiger Abschlussreview PASS. |
| Task-3-Korridor für Apply, Transaktion, Exporte, Auth und Vertraulichkeit | 9 Dateien / 307 Tests; unabhängiger Abschlussreview nach Transaktionskorrektur GO. |
| Abschließender aktueller Delta-Korridor: `npm test -- --run tests/production-draft-apply.test.ts tests/offer-accepted-event-spec-transport.test.ts tests/production-applied-snapshot.test.ts tests/production-commercial-access.test.ts tests/offer-production-handoff.test.ts tests/production-handoff-port.test.ts --maxWorkers=1` | 6 Dateien, **75/75 Tests**, Exit 0. |
| `npx --no-install tsc --noEmit` | Exit 0. |
| `npm run build` | Exit 0. |
| `python3 .runtime/acceptance-20260919/purchase-review-assert.py` | Nach einer korrigierten rein lokalen Formatannahme Exit 0; IDs, Reviews, Manifest, 35/4-Trennung, fünf Einkaufszeilen, beidseitige Herkunft, beide HTML-Inhalte und CSV geprüft. |
| Unabhängiger abschließender Auth-/Datenintegritätsreview | **PASS**, keine offenen materiellen Befunde; gebunden an Code-Head `571c1d4cb9ab87280ab5c9b29a09e34a579d1bfd`, Tree `457ff3bc37f1dd432f634dd55cb3490a52717e34`, Inhaltsfingerabdruck `9c2abf32ff6ffdb4f94a4ebec1f534d0db63aad9aac0e7caad60e1a347a01d76`. |

Keine unveränderte Vollsuite wurde wiederholt. Eigener Browser und ausschließlich eigener Fixture-Stack wurden beendet; Ports 3311–3314 und 3320 sind frei. Die erhaltene D7-Kopie bleibt mit 514 Dateien und Manifest `0c7b8bb0450428c32476005d7c6134b5cc2f01dbd5ac56e6cdc125df4ec6ec10` bestehen. Kuratierter maschinenlesbarer Beleg: `docs/agent-memory/2026-09-19-purchase-review-apply-export-acceptance.json`.

Der technische Zukauf-/Review-/Freigabe-/Apply-/Exportweg ist für diesen isolierten synthetischen Fall vollständig durchlaufen. Weiter offen bleiben echte menschliche Küchenprüfung, fachliche Rezept-/Allergenfreigabe, reale Produktauswahl und Gebinde, verifizierte Lieferanten/Preise/Bestände sowie jede tatsächliche Bestellung oder Produktionsfreigabe. Kein Merge, Deployment, Server-/AgenturOS-Eingriff, Echtdatenlauf, kostenpflichtiger Provider und kein Gate-C-Gesamt-GO.
