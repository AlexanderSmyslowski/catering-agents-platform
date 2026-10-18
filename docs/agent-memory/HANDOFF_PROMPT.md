# Aktuelle Übergabe —Version5.439 /18.10.2026

## 5.439 —18.10.2026: eigener Opus-Volllauf und Quellen-P1 geschlossen

Ein tatsächlicher neuer100-Gäste-Auftrag wurde durch claude-opus-5-5 selbst vollständig über die normale lokale Oberfläche bearbeitet: Anfrage/Kalkulation/Reload/Freigabe/Handoff,9Rezeptzuweisungen/Planungsnachweise,13Prüfkarten/Produktionsfreigabe/Übernahme,Mappe/Blatt/CSV/Wiederöffnung.9Batches,49Zutatenbeiträge,29Positionen,55/25/20 und2gZimt eigenständig nachgerechnet;synthetische8043,20netto/1528,21Steuer/9571,41brutto. Runtime canonicalModel=claude-opus-5-5,provider=firstParty,118Turns,CLIexit0. NeuerSpec e6bc48db…;13Originalquellen unverändert,Rezepte weiterhin review_required.

Der neue Ablauf fand zusätzlich verlorene„glutenfreie Sonderkost“ und Detailzeiten. Enger Quellenfix: Flexion nur im Gast-Teilgruppenmatcher, globalerFreeFrom-Matcher unverändert; benannteZeit-/Logistiksegmente als ungeprüfter Originalwortlaut über vorhandeneproductionConstraints erhalten. Keine automatische Fachfreigabe,keinSchemawechsel,keine historischen Fassungen umgeschrieben.89relevanteTests/7Dateien (35Normalisierung,18Druck,9Handoff,27angrenzende),Build/gitdiffcheck und unabhängigerCodeReviewPASS. Neue Testassertions200→bestehende201 korrigiert,keine Produktregeländerung.

Gezielte tatsächliche Opus-Nachprüfung an genau einem neuen20-Gäste-Fall bis Übernahme/beidenA4-Drucken/Reload: beideSonderkostgruppen undalle5Zeit-/Logistikeinträge erhalten,ungeprüft,keineglobaleGlutenfrei-Zusage.16Turns,gleichesModell/Provider,exit0. BeideSessions geschlossen;keinCleanup behauptet. Originalberichte/Restbefunde:docs/product/OPUS_PRODUKTPRUEFUNG_20261018.md. Belege tmp/product-pilot-20261018/opus-full-e2e-*,opus-source-p1-*,new-request-context-*;PDF/CSV output/playwright.

Ein konkretesDrive-Angebot2026 belegt45,55€/h„Logistik,Service&Küchencrew“(6,5h→296,08€),nurangebotsspezifisch;geschützteProvenienzactual-2026-offer-rate-source.private.json(0600,ignoriert),keinKundenrohtext. KeinallgemeinerTarif/Steuerfestlegung abgeleitet;vollständigesLexware-Archivweiternichtnachgewiesen.

Gesamtziel ACTIVE,realerPilotNO-GO. NächstekonkreteP2:unterscheidbareAuftragsnamen/Suche und widerspruchsfreieZustände nachÜbernahme/Reopen;übrigeDruck-/Quellen-/CSV-/PlanungsbefundeimOpusbericht. KleineHinweisdopplungdurchSatzsegmentierungoffen,keineRohinformationverloren. AutomatischeGesamt-CI,Integration/Release/NürnbergerAuslieferung,eigeneNürnbergerBackup→Restore→Cleanup/Monitoring und echteFachentscheidungenweiteroffen. HelsinkiOFF/erhalten;keineHost-/DNS-/ADH-/Löschaktion.


# Aktuelle Übergabe — Version5.438 /18.10.2026

## 5.438 — 18.10.2026: ehrlicher Übergabestatus und aktuelle Produktionswiederöffnung

Die lokale UI unterscheidet erfasste Veranstaltungsdaten, tatsächlich revisionsgebundene interne Angebotsfreigabe und erfolgte Produktionsübergabe. Datenvollständigkeit ist kein Handoff und keine Küchenfreigabe. Bereits erledigte Freigabe-/Übergabeaktionen werden nicht erneut angeboten; neue Fassungen bleiben über die vorhandene Bindung wieder freigabefähig. Der irreführende generische Spec→Produktion-Link entfällt; die vorhandene bestätigte Übergabe öffnet den Produktionsauftrag. #history öffnet die eingeklappte Auftragshistorie, Fallstatus sind deutsch.

Die tatsächliche Browsernachprüfung fand zusätzlich einen alten Handoff-Draft-Link: trotz richtigem Fall und vorhandenem Plan erschien „Entwurf nicht verfügbar“, weil der ursprüngliche Entwurf ersetzt war. inspect_handoff öffnet jetzt nach unveränderter serverseitiger Fallauflösung und Staleprüfung die bestätigte case-only URL. Deren bestehende Projektion zeigt den aktuellen Stand; neue Übergaben und explizite Reviewlinks behalten ihre Draftbindung. Kein Backend-/Freigabe-/Datenmodellwechsel.

Gezielte67 Tests/5Dateien, danach29 Tests/4Dateien (überlappend) und finaler Build/gitdiff--check PASS. Ein unabhängiger Reviewer nahm Grunddelta und gezieltes Wiederöffnungsdelta ohne materielle Befunde an. Browser: unfreigegebener20-Gäste-Testfall wahrheitsgemäß ohne Handoff; ursprünglicher100-Gäste-Fall über den echten Angebotsbutton mit korrekter ProductionCase-ID geöffnet, kein veralteter Draftquery, keine falsche Nichtverfügbarkeitswarnung, vorhandener Plan/Einkauf und Sonderkostnotizen sichtbar. Alle13 Originalquellen bytegleich. Belege tmp/product-pilot-20261018/handoff-state-*.log/txt und handoff-reopen-targeted.log.

VollständigerCI39080927362 auf vorigemHead1ea955e läuft regulär weiter; Browser/Compose/macOS PASS, Gesamtstatus noch offen. Nicht abbrechen oder als bestanden ausgeben. Für dieses neue UI-/Navigationsdelta ist die automatische CI am neuen Head separat maßgeblich. Kein Nürnberger Deployment oder Pilot-GO; tatsächlicher vollständiger eigener Opus-End-to-End-Ablauf, reale Fachentscheidungen und Nürnberger Backup→Restore→Cleanup/Monitoring bleiben offen. Nächster Produktpunkt: unterscheidbare Auftragsnamen/Suche, anschließend verbleibende konkret belegte P2-UX-Befunde. Gesamtziel ACTIVE.


# Aktuelle Übergabe — Version5.437 /18.10.2026

Vollständiger lokaler synthetischer100-Gäste-Ablauf aus5.417 erhalten: neun Rezepte/Batches,49 Zutatenbeiträge,29 Einkaufspositionen,55/25/20 und2gZimt exakt; CSV und18-seitigeA4-Mappe,Neustartnachweis. Tatsächliche unabhängige Produktprüfung mit Modell claude-opus-5-5 (canonicalModel/provider firstParty belegt) abgeschlossen; Bericht docs/product/OPUS_PRODUKTPRUEFUNG_20261018.md. Opus bediente vorhandenen Auftrag,Preis-/Mengenfehlerfälle,Desktop/Mobil undExporte selbst; Rezeptimporte/13Karten/Approval/Applywurden nur am gespeicherten Ergebnis geprüft, daher kein eigener vollständiger Opus-E2E-PASS.

Drei priorisierte P1-Befunde gezielt in Produktcommit7c67497 repariert und unabhängig angenommen: bestehende gefrorene Sonderkost-/Zeit-/Logistiknotizen in UI/Produktionsplan/Mappe sichtbar; neue quantifizierte Allergen-Teilgruppen als offene Quellanforderung erhalten, globale Menü-/Veganpflichten bleiben vorrangig. Unpublishter unkalkulierter Angebotsexport enthält keine automatischen Paketleistungen und Kataloggesamtpreise; ungeprüfter Kundentext/Arbeitsbetrag wird in der UI nicht als Angebot ausgegeben. Bereits Publish-freigegebene historische Fassungen bleiben im bestehenden Pfad. Mengenpreview trennt bisherigen effektiven Wert von neuem Proportionalwert:55→60Portionen,6,6→7,2kg;15signifikanteStellen ohne gerundeten Zwischenfaktor,2g-Vorwert bleibt erhalten,Deutschkomma möglich. Neue Menge braucht neue Küchenfreigabe; bisher freigegebener Stand bleibt erhalten.

Nachprüfung derselben drei P1 mit tatsächlichem claude-opus-5-5 in eigener BrowserSession catering-opus-p1-20261018: alle drei geschlossen,Session beendet. Kein neues Gesamt-/Pilot-PASS. Opus hat dabei einen weiteren ausdrücklich synthetischen offenen20-Gäste-Testauftrag angelegt; der Satz im Modellbericht „keine Daten geändert“ bezieht sich nicht auf diese Neuanlage. Zwei offene Opus-Testfälle bleiben erhalten,keine falsche Cleanupbehauptung. Originaler100-Gäste-Fall: alle13 Quellartefakte weiterhin bytegleich,9Batches/29Einkauf,0,002kgZimt unverändert nach Preview/Abbrechen. Küchen-PDF vollständig neu gerendert/als18Seiten-Kontaktbogen geprüft;Sonderkost/Anlieferung sichtbar,keine„KeineblockierendenRückfragen“-Scheingrünheit.

Verifikation:61Core-/Serviceprüfungen in8Dateien,2UI-Previewprüfungen,86Kontext-/Preis-/Printprüfungen in9Dateien undnach gezieltenScopekorrekturen45Diet-/Mappeprüfungen in2Dateien PASS (teilweise überlappend,nicht additiv zählen). FinalerBuild/gitdiff--check PASS. Ein unabhängiger Reviewer deckte alle P1-Deltas; zwei konkrete Scopebefunde am Teilgruppenfilter wurden behoben und nur betroffene Korrekturen nachgeprüft. Keine neue Prüf-/Persistenz-/Autharchitektur. Belege im bisherigen ignorierten tmp/product-pilot-20261018/opus-*.log/jsonl,Ausgaben output/pdf.

CI-Korrektur bleibt verbindlich: kein tatsächlicher Observer-Hänger belegt. LetzterRun39079338322 wurde nach6Minuten zu früh abgebrochen;seinLogzeigt95Operationsprüfungen in244s PASS,Observernoch nicht gestartet. Alle bisherigen RunsCANCELLED,keinFull-Suite-PASS. Statisch begrenztes Observer-Testharness aus2951e10 lokal/ unabhängig angenommen; keine weitere Linux-Ursachenbehauptung oder unbewiesene Reparatur. Jetzt einen gebündelten erforderlichen CI-Lauf vollständig mit realistischer Laufzeit abwarten,keineunveränderte lokaleVollsuite oder weitere vorschnelleAbbrüche.

Nächste Produktpriorität nach Integration: wahrheitsgemäßer Übergabestatus unfreigegebener Entwürfe,findbareAuftragsnamen/Suche und fallgebundene Navigation;übrige konkrete P2s stehen im tatsächlichen Opusbericht,keine neueRoadmap. GesamtesAppzielACTIVE. Nürnberger Auslieferung dieses Inkrements, eigener Backup→Restore→Cleanup/Observer und reale Preis-/Steuer-/Küchen-/Allergen-/Lieferanten-/Temperaturfreigaben weiter offen;realerPilotNO-GO. HelsinkiOFFundvollständigerhalten;keineHost-/DNS-/Konto-/ADH-/Löschaktion. Angebotsunterlagen seit2022 sowie2025/2026sind Recherchegrundlage;vollständigerLexware-Rechnungsbestand im verbundenen Postfachweiter nicht nachgewiesen.

# Aktuelle Übergabe — Version5.436 /18.10.2026

**Korrektur der CI-Deutung, 18.10.2026 01:38 CEST:** Run39079338322 wurde vom Koordinator bei rund sechs Minuten voreilig abgebrochen. Das nun vollständige Log beweist regulären Fortschritt: unter anderem95 Operationsprüfungen in244s PASS; der Observer-Test war noch gar nicht gestartet. Der alte Run39075030417 hatte37 Minuten bis zum Abbruch regulär426 Dateien abgearbeitet; aus der fehlenden Observerausgabe allein ist weder sein Start noch ein tatsächlicher Hänger nachgewiesen. Die frühere Zuschreibung eines konkreten CI-Hängers zum Observer ist zurückgenommen. Das statisch belegte spawnSync-/Nachfahren-/Pipe-Risiko wurde lokal begrenzt und unabhängig geprüft, ist aber kein Nachweis der ursprünglichen CI-Ursache. Keine weitere Linux-Reparatur/Prüfarchitektur ohne Fehlerbeleg. Nach gebündelten tatsächlichen Opus-Produktbefunden einen erforderlichen Gesamt-CI-Lauf mit realistischer Dauer vollständig abwarten; keine manuellen unveränderten Vollsuiten und keine vorschnellen Abbrüche. Alle vier bisherigen CI-Runs sind CANCELLED, kein Full-Suite-PASS. Browser/Compose/macOS des letzten Heads waren PASS. Beleg tmp/product-pilot-20261018/ci-39079338322-build-cancelled.log.

Der konkrete CI-Lifecycle-Defekt ist im bestehenden Observer-Testharness geschlossen: asynchroner eigener POSIX-Prozessverbund statt blockierendem spawnSync, unveränderte180s-/2MiB-Grenzen, live Python-Testnamen und harter begrenzter Abbruch/Drain. Die bestehenden drei Python-Subprozessgrenzen sind auf30s begrenzt; strace -f verwendet zusätzlich das offiziell dokumentierte --kill-on-exit (PTRACE_O_EXITKILL), damit auch getrennte Observer-Helper-Sessions keine offenen Ausgabepipes hinterlassen. Bereits vorhandener CI-Tracer im alten echten Log Version6.8. Parser, Negativkontrolle und fachliche Sicherheitsprüfungen unverändert. Lokaler fokussierter Lauf: zwei Vitestfälle PASS einschließlich echter Nachfahren-/Pipe-Deadline-Regression; darin64 Python-Prüfungen in115,812s PASS. Build PASS, unabhängiger Harness-Review ohne materielle Befunde. Dies ist kein Beweis für die zuerst hängende Linuxoperation; neuer endlicher CI-Lauf muss sie bestätigen oder konkret benennen. Offizielle Quelle: https://github.com/strace/strace/blob/master/doc/strace.1.in . Belege tmp/product-pilot-20261018/observer-bounded-targeted.log und observer-harness-build.log.

Tatsächliches unabhängiges Produktreview mit Modell claude-opus-5-5 über bestehende authentifizierte CLI gestartet. Eigene getrennte Browsersession catering-opus-product-20261018 bedient die lokale synthetische Oberfläche tatsächlich; gemeinsame AgenturOS-Leitlinie gelesen, vorhandener Auftrag/Angebotsexport bereits geöffnet. Keine Vollabnahme behauptet, Review läuft. Kein Zielserverkontakt und keine privaten Angebots-/Rechnungsdaten an das Modell. Gesamtziel ACTIVE; führender vollständiger lokaler Funktionsnachweis bleibt5.417, Nürnberger Betriebs- und reale Fachfreigaben offen.

# Aktuelle Übergabe — Produktstand 5.435 /18.10.2026

Der vollständige neue synthetische 100-Gäste-Referenzauftrag ist jetzt im isolierten lokalen Stack über die normale Oberfläche durchgeführt: Anfrage → Angebot mit fünf belegbar als synthetisch markierten Preiszeilen → interne Variantenentscheidung → Produktionsübergabe → neun Rezeptimporte/-zuordnungen → bestehende modellgebundene Planungsnachweise → 13 Karten prüfen → intern freigeben → übernehmen → neun Produktionsbatches und 29 konsolidierte Einkaufspositionen → CSV und 18-seitige A4-Produktionsmappe. Hauptgerichte 55/25/20, Dessert 80/20. Unabhängige Decimal-Nachrechnung aus den ursprünglichen Rezepttexten bestätigt alle 49 Zutatenbeiträge und 29 Summen exakt. Zimt 0,002 kg (= 2 g) bleibt in CSV, Rezeptkarte, Küchenblatt und Einkauf erhalten. Vollständiges Menü einschließlich Empfang, Beilagen und Dessert; Angebot 8.043,20 EUR netto / 1.528,21 EUR ausdrücklich synthetische 19%-Teststeuer / 9.571,41 EUR brutto. Keine realen Preis-/Steuerfreigaben abgeleitet.

Vier tatsächlich im Browser belegte enge Produktfehler repariert, Produktcommit 75d9f46: Rezeptbibliothek vor dem ersten Plan im aktiv berechtigten Produktionsfall anzeigen; nach gespeicherter kanonischer Entwurfsrevision vorhandenes Refreshsignal auslösen; interne Freigabeanzeige aus dem serverbestätigten Approval-/Applyzustand statt festem „nicht erteilt“ ableiten; kurze Küchenblattblöcke im Druck zusammenhalten. Keine neue API, Persistenz, Freigabewahrheit oder Architektur. 104 gezielte Tests in neun tatsächlich ausgeführten Dateien und finaler Build PASS; unabhängige Prüfung /root/menu_repair_review einschließlich Boundary-/Stale-/Approval-/Printdelta ohne materielle Befunde angenommen. Keine unveränderte Vollsuite lokal wiederholt.

Eigener lokaler Stack vollständig beendet und mit demselben synthetischen Datenroot neu gestartet: neun Batches/29 Positionen und „Interne Produktionsfreigabe: erteilt · übernommen“ bleiben erhalten. Alle 13 eingefrorenen Quellartefakte einschließlich neun Originalrezepten bytegleich. Originalrezepte bleiben review_required; keine Bibliotheks-/echte Küchenfreigabe erteilt. Wiederverwendet ist ausschließlich Alexanders belegte Annahmenbestätigung für den synthetischen Rechentest vom17.10., keine neue Freigabe erfunden. CSV-Mengen sämtlich exakt mit gespeicherter Einkaufsliste verglichen. Neu gerenderte 18-seitige A4-PDF vollständig als Kontaktbogen angesehen; kurze Küchenblätter werden nicht mehr zwischen Rezeptkopf und Zubereitung zerteilt. Lokale Belege tmp/product-pilot-20261018/full-reference-*.txt und *-arithmetic.json/*-restart-export-proof.json; Dateien output/pdf/CateringOS-SYNTHETISCH-100-Gaeste-{Produktionsmappe.pdf,Einkauf.csv}. Keine privaten Angebote, Rechnungen oder Credentials darin.

Dieser Meilenstein ist ein lokaler synthetischer UI-Nachweis, kein Nürnberger Release-/Betriebsnachweis. Auslieferung des Inkrements und endgültige tatsächliche Opus-5.5-Produktprüfung bleiben offen. Bekannte konkrete UX-/Fachlücken: generische Auftragstitel, veralteter Resumehinweis nach Apply, redundante Prüfkarteflächen, technische Rollen-/Quellenbegriffe, noch offene Küchenausrüstung/Stationen/Zeiten und Sonderkost-/Lieferanten-/Temperaturentscheidungen. Kosten/Marge und vollständiges Rechnungsarchiv weiterhin ungeklärt; vorhandene Angebote 2022–2026 und App-Transfer bleiben die bestätigte Recherchegrundlage. Keine echte Küchenfreigabe oder Pilot-GO. Eigene Nürnberger Backup→Restore→Cleanup-/Observerabnahme weiter offen; Helsinki OFF und erhalten, keine DNS-/Host-/Daten-/Konto-/ADH-/Löschaktion.

Integration führt weiterhin Draft-PR #727. Überholter Run39075030417 ist abschließend CANCELLED, nicht PASS. Run39077420694 auf ae65beb hat Browser/Compose/macOS und Build PASS, aber Haupttest weiterhin laufend. Konkreter Diagnosehinweis aus dem abgeschlossenen alten Log: synthetischer Observer-Pythontest ist die einzige damals vorhandene unvollendete Testdatei. Kein blinder Retry, keine Schutzabschwächung; eng begrenzte lesende Ursachenprüfung läuft. Nächster Ausführungsschritt: CI-Hänger konkret schließen, das geprüfte Produktinkrement im bestehenden PR integrieren und danach tatsächliche Opus-Browserprüfung sowie freigegebene Nürnberger Auslieferung/Abnahme fortsetzen. App-Gesamtziel bleibt ACTIVE.

HANDOFF_PROMPT.md

## Produktfortsetzung 18.10.2026

Produktcommit 74bdc25: persistierte Angebotskalkulation mit Quellen und expliziter Steuer, unveränderlichen Fassungen, Approval-Sperren und geprüftem UI-Weg bis Handoff/Wiederöffnen. Siehe aktuellen Abschnitt memory.md 5.434 und docs/product/PRODUKTZIEL_CATERING_AGENTS_PLATFORM.md. Hauptcheckout memory.md / Runbook 5.416 führen den tatsächlichen Betriebs-/Migrationsstand; historische Kandidaten unten nicht als Iststand ausführen. Vollständiger 100-Gäste-Produktions-/Einkaufsneulauf, endgültige Opus-5.5-Produktprüfung und eigene Nürnberger Betriebsnachweise bleiben offen.

Ich moechte die Arbeit an CateringOS in einem neuen Chatfenster, mit Hermes Agent oder mit Codex 5.4 mini nahtlos fortsetzen.

Rolle

Du arbeitest als strukturierter technischer Arbeitsbegleiter fuer Produkt, Architektur, Spezifikation, Governance, UI-Umsetzung und Testabsicherung.

Arbeitsweise
 • Arbeite streng strukturiert und phasenbasiert.
 • Keine Halluzinationen.
 • Keine neuen Features ohne klaren Auftrag.
 • Keine grossen Refactorings ohne direkten Nutzen fuer den aktuellen Schritt.
 • Trenne sauber zwischen:
 • tatsaechlich umgesetzt
 • fachlich beschrieben
 • offen
 • bewusst out of scope
 • Nutze einen knappen, professionellen Stil.
 • Arbeite am realen Repo-Iststand.
 • Lies Repo-Dateien zuerst, bevor du Schlussfolgerungen ziehst.

Zuerst lesen
 1. memory.md
 2. AGENTS.md
 3. README.md
 4. HANDOFF_PROMPT.md
 5. danach die fuer den aktuellen Schritt relevanten Dateien in Services, UI und gemeinsamen Modulen

Aktueller Projektkontext
 • Repository: AlexanderSmyslowski/catering-agents-platform
 • Der reale GitHub-Repo-Stand ist fuehrend.
 • Der verbindliche Stage-A-Codeanker ist `51f6cbc36f9f3ec93f5b7fd7d5d7cdb170e15e3b`; die geprüfte Übergabe wurde durch PR 598 als `5b879d5de22bf276d8e1a3d56e8e203303ece809` in `main` aufgenommen.
 • Aufgaben 1 bis 7 sind durch die zusammengeführten PRs 590 bis 596 belegt. PR 596 wurde als `c6f530c7bae70bf52c3767b68620368060fd00cf` zusammengeführt; PR 597 redigiert fehlerhafte Provider-Kennungen zusätzlich und ist im Codeanker enthalten.
 • Der Stage-A-Kontrollpunkt ist bestanden: geschäftsbezogene Datei-/PostgreSQL-Grenzen, unveränderliche Angebots-/Produktionsartefakte, persistente Fälle/Quellen/Verläufe, explizite Produkt-Ports und ein geschlossenes Provider-Gate sind belegt.
 • OpenAI und Codex CLI unterliegen derselben serverseitigen Freigabegrenze vor Fetch beziehungsweise Subprozess; Fixture-Betrieb bleibt lokal. `ApprovalRequestRecord` bleibt die einzige fachliche Freigabewahrheit.
 • Die vollständige serielle Testsuite, Typprüfung, Build, beide Audits, interne Beta-Gates und die CI-Läufe von PR 596/597 waren grün. PostgreSQL-Konkurrenztests blieben wegen fehlender lokaler PostgreSQL-Instanz übersprungen.
 • PR #612 wurde mit Merge-Commit `5393363fd5a0d7453461eca9bc141655c232b21a` in `main` aufgenommen; der Main-Tree `c9fbab19a70426c9c461356b75953304b41e5761` entspricht dem historischen PR-Head `bf255be310aadca56bc0b5cfbff2c7cd1da46097`. Task 12 und die acht unabhängig geprüften Reviewbefunde sind damit im aktuellen Main-Stand enthalten.

Was aktuell gilt
 • ApprovalRequestRecord bleibt die fuehrende Freigabewahrheit.
 • Die Providerfreigabe ist ein technisches Betriebs-Gate und keine zweite fachliche Freigabewahrheit.
 • Datei- und PostgreSQL-Speicherung bleiben getrennt und geschäftsbezogen; neue Persistenzsysteme sind ausgeschlossen.
 • Freigegebene Angebots- und Produktionsartefakte bleiben unveränderlich; Handoff und Apply können nicht direkt umgangen werden.
 • Externe KI-Aufrufe bleiben ohne exakt passende serverseitige Freigabe geschlossen; reale Unternehmens- und Kundendaten sowie echte Providerläufe bleiben außerhalb dieses Kontrollpunkts.
 • Keine neue Persistenzwelt / kein Prisma ohne ausdruecklichen Grossschnitt.

Naechster explizit beauftragter Schritt

Der Stage-A-Task-12-Stand ist in `main` aufgenommen. Der nächste Schritt ist eine ausdrückliche Supervisor-Entscheidung für weitere Arbeit; Deployment und produktive Migration sind durch den Merge nicht freigegeben.
 • Vor jedem Folgeauftrag erneut `memory.md`, `AGENTS.md`, `README.md` und diesen Handoff am realen Repo-Stand lesen.
 • Keine neue Produktfläche, keine neue Roadmap und keine Scope-Ausweitung ohne ausdruecklichen Auftrag.

Weiter out of scope
 • weiterer Stage-A-Ausbau über den gemergten Task-12-Stand hinaus bis zum ausdruecklichen Supervisor-Auftrag
 • echte externe KI-Ausführung und reale Unternehmens- oder Kundendaten
 • Bereitstellung, Deployment und Änderungen produktiver Infrastruktur
 • neue Persistenzsysteme / Prisma

Erwartete erste Ausgabe im neuen Chat
 1. knappe Einordnung des aktuellen Stands
 2. Benennung des kleinsten sinnvollen naechsten Schritts
 3. klare Begruendung, warum dieser Schritt jetzt richtig ist
 4.
nur dann ein Mini-Umsetzungsplan, wenn er innerhalb des aktuellen Scopes bleibt

Pflicht fuer fortlaufende Arbeit
 • memory.md bei jeder relevanten Neuerung versioniert aktualisieren
 • neue Eintraege in der Versionshistorie unten anhaengen
 • keine stillen inhaltlichen Verschiebungen

Aktueller Handoff-Override – 2026-08-15
 • PR #612 auf `loop/stage-a-complete-chain` wurde als `5393363fd5a0d7453461eca9bc141655c232b21a` in `main` aufgenommen. Er umfasste lokale Business-Scope-Migration, die unveränderliche Angebots-zu-Produktionskette, Business-Isolation, UI-Reload-/Search-/Revision-/Copy-Verträge und die nach Ersatztests entfernten Kompatibilitätspfade.
 • `hostedMultiBusinessReady` ist im gemergten Stage-A-Stand codefest `true`, weil Route-, Store-, Audit- und HTML-/CSV-Export-Matrix geprüft wurden. Kein Umgebungsflag kann dieses Gate umgehen.
 • Der historische PR-Head `bf255be310aadca56bc0b5cfbff2c7cd1da46097` wurde mit Tree `c9fbab19a70426c9c461356b75953304b41e5761` gemergt; der alleinige aktuelle Main-Commit ist `5393363fd5a0d7453461eca9bc141655c232b21a`. Main-CI Run `31897217407` ist mit `build-and-test` und `browser-rehearsal` terminal erfolgreich. Frühere Aussagen über einen offenen PR oder ausstehende Mergeentscheidung sind historische Handoff-Stände; Deployment und produktive Migration bleiben nicht freigegeben.


Aktueller Zusatzauftrag 19.09.2026: Isolierter Catering-Zielaufbau, siehe [versionierte Übergabe](2026-09-19-catering-target-build.md). Die dort ausdrücklich erteilte begrenzte Infrastrukturfreigabe ergänzt historische Out-of-Scope-Aussagen dieses Dokuments. Keine Produktionsumschaltung.

Stand nach Zielprobe19.09.2026: [versionierte Zielübergabe](2026-09-19-catering-target-build.md) enthält die erfolgreichen tatsächlichen Daten-, Backup-, Restore- und Alarmnachweise. Server166533273 niemals neu bestellen; keine Proben wiederholen. Installierter Code f6c0aee4/Tree56854bb7 bleibt gebunden, auch bei einem reinen Dokumentationsfolgecommit. **HOLD vor Produktionsumschaltung und automatischer Jobaktivierung.**


Stand nach geschützter Bedienprobe19.09.2026: Die [bestehende Zielübergabe](2026-09-19-catering-target-build.md#geschützte-bedienprobe-am-19092026) enthält Zugang, neun imagegebundene Advisories und den begrenzten Produktbefund. Echte Anmeldung/Navigation und DB-/API-Persistenz bestanden; Wiederaufnahme der manuellen Spezifikation nach Reload nicht bestanden. Nicht neu anlegen oder Produktcode/PR682 in diesem Infrastrukturauftrag ändern. Zielapps sind aktuell an die eigene synthetische DB gebunden, maßgebliche bisherige Datenkopie unverändert. Test-DB ausdrücklich aus finaler Übernahme ausschließen. Zugang nur zeitlich begrenzt; kein automatischer Neustart, keine neue Probe und kein Cutover ohne Folgeauftrag.

Stand des begrenzten Betriebsübergangs19.09.2026: Das [Übergangspaket](2026-09-19-catering-target-build.md#begrenztes-betriebsübergangspaket--vorbereitet-am-19092026) bindet finalen Vier-Tabellen-Abgleich, Entfernung des Operator-Overrides, eigene TLS-/Routinggrenze, Restartverhalten, Backup/Restore, Heartbeat493066/300/300, Cron300, Timer und Rückweg vor/nach Zielwrites. Die drei additiven Betriebsartefakte für Plattform-Restart, Edge/Public-Bridge/80+443 und finale Caddy-Route sind im PR-Branch implementiert; die Caddy-Route startet fail-closed, bindet eine einzelne Betreiber-IPv4-Adresse und Basic Auth und lässt im Modus `locked` nur die dokumentierten GET-/HEAD-Pfade durch. Probe-Manifeste bleiben unverändert. Finaler Review/CI-Head ist vor Merge zu binden. PR693 bleibt Draft; kein Merge, Cutover oder Jobstart. Reloadbefund nicht auf PR682 übertragen.
