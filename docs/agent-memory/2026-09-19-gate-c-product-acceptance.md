# Gate C – lokale Produktabnahme am 19.09.2026

Status: Angebotsstart-Fix und Vorbereitung abgenommen; zusätzlich Klassifikationen desselben synthetischen Handofffalls über den Operatorweg gespeichert, erneut vorbereitet und nach Wiederöffnung erhalten. Herstellungsentscheidungen, Rezepte und menschliche Küchenprüfung bleiben offen. Kein Gate-C-Gesamt-GO, Merge oder Deployment.

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
