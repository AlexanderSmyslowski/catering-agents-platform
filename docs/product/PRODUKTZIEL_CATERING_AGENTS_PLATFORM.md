# Aktueller Produktstand — Version5.441 /18.10.2026

## 5.441 — 18.10.2026: widerspruchsfreie Produktionsübernahme und lesbare Quellnachweise

Die Produktionsansicht unterscheidet jetzt serverbestätigte Übernahme, noch nicht übernommenen freigegebenen Entwurf und tatsächlich nicht verfügbare Entwürfe. „Bereits übernommen“ erfordert approved-Status sowie passende serverseitige Apply-Projektion mit exakt derselben Draft-ID und Revision; ein lokales appliedAt oder eine falsche Revision reicht nicht. Die doppelte Reviewinstanz im Rückfragenbereich entfällt. Bestehende Verbraucher werden nach Entscheidung/Übernahme aktualisiert. Verspätete Decision-/Apply-Antworten bleiben auch nach A→B→A wirkungslos: Fallwechsel erhöht eine Generation, die vor nachgelagertem State/Callback/Refresh und bei Fehler/Abschluss geprüft wird.

Ein vorhandener Plan wird als Neuberechnung bezeichnet; offene Rückfragen und ungeprüfte Quellen blockieren weiterhin unverändert. Der Downloadbereich spricht präzise von Berechnungshinweisen und verweist separat auf fachliche Rückfragen/Freigaben. Eingefrorene oder abgeschlossene Rezeptplanungen zeigen gespeicherte Mengenbegründungen und Herkunft lesbar mit ORIGINAL-Quellrevision statt leeren deaktivierten Bestätigungsfeldern. Historische Nachweise bleiben Herkunft, werden weder auf die aktuelle Revision übertragen noch neu freigegeben. Keine neue API, Persistenz, automatische Fachentscheidung oder Änderung bestehender Freigaben.

Normale lokale Browsernachprüfung am vorhandenen synthetischen Identitätstest: 20 Gäste/20 Portionen Gurken-Canapés, Herstellungs-/Rezeptzuordnung als neue Revision, kanonischer Planungsnachweis ausschließlich auf den bereits bestätigten synthetischen Rezeptannahmen, Vorbereitung, fünf gefrorene Karten gelesen/entschieden, interne Freigabe und Übernahme. Ergebnis: ein Batch, fünf Einkaufspositionen, eindeutige Übernahmeanzeige, keine falsche Nichtverfügbarkeit/zweiten offenen Karten. Reload und echte Historien-Wiederöffnung erhalten Plan/Einkauf/Freigabestatus; Quellrevision2 und Mengenbegründung sichtbar, keine editierbaren Bestätigungsfelder. Desktop/Mobil ohne Überbreite geprüft. Bestehender Opus100-Fall mit offener Sonderkostfrage: Neuberechnung bleibt gesperrt, gespeicherter Plan/Einkauf erhalten. Alle13 ursprünglichen Referenzquellen bytegleich; keine nachträgliche Reparatur oder neue Vollabnahme alter Quellfassungen behauptet.

Verifikation: zunächst60 betroffene Tests/5Dateien PASS; nach dem konkreten unabhängigen ABA-Befund52 betroffene Review-/Shelltests/2Dateien inklusive vier Deferred-Fällen PASS;13 Planungs-Paneltests einschließlich Fremdfall-Sentinel/fehlender Editieraktionen PASS, nach kleinem Darstellungsfeinschliff erneut13 PASS. Gruppen überlappen, nicht addieren. Finaler Build und git diff --check PASS. Ein unabhängiger Reviewer nahm Grunddelta, consequential ABA-Korrektur und enges rein lesendes Provenienzdelta ohne verbleibende materielle Befunde an; unveränderte Komponenten nicht erneut voll geprüft.

Belege im bisherigen tmp/product-pilot-20261018/post-apply-*: RED/gezielte/finale Tests, Build und browser-proof.json; Screenshots output/playwright/post-apply-*.png. Dieses Inkrement wird zunächst lokal versioniert; noch kein zusätzlicher Push/CI-Lauf allein für jeden kleinen Folgeschritt. Automatische CI am bereits gepushten fae8969 läuft unter39084476486 (Browser/Compose/macOS PASS, Gesamtprüfung offen), voriger c408b72-Run39083127291 läuft ebenfalls weiter. Beide nicht vorschnell abbrechen. Nach verwandten Unterlagenkorrekturen gebündelten Head einmal pushen und erforderliche CI am tatsächlichen Releasehead vollständig abwarten.

Nächster konkreter Produktpunkt: belegte Druck-/CSV-Mängel einschließlich Allergen-Quellvorbehalt und missverständlichem Verlustfaktor beheben; danach gebündelte Integration/Auslieferung. Die Mengensteuerung meldet teilweise weiterhin fehlende professionelle Empfehlung trotz vorhandener Quellentscheidung; diese Unterscheidung und die fachlichen Stations-/T-1-/Lieferantenvorgaben bleiben ausdrücklich offen. Gesamtziel ACTIVE, realer Pilot NO-GO. Nürnberger Auslieferung, eigener Backup→Restore→Cleanup-/Monitoringnachweis und reale Fachfreigaben offen. Helsinki OFF/erhalten; keine Host-, DNS-, ADH- oder Löschaktion.

# Aktueller Arbeitsstand — Version 5.440 / 18.10.2026

## 5.440 — 18.10.2026: erkennbare Kundenaufträge, brauchbarer offener Export und konkrete CI-Korrekturen

Neue Textanfragen haben ein ausdrücklich beschriftetes Kundenfeld. Die Kennung wird sichtbar als „Kunde:“ zur Quellanfrage ergänzt und über die vorhandenen EventRequest-/Snapshot-Felder bis zur Produktionsübergabe erhalten. Bereits gebundene Aufträge übernehmen keine fremde Formulareingabe; Wiederholung nach verlorener Antwort behält Anfrage-ID und annotierten Quelltext. Nur explizite Kunden-/Auftraggeberzeilen werden gelesen, keine Signatur- oder Begrüßungsheuristik. Keine neue API, kein Schema, keine historischen Datenänderungen. Beide Historien zeigen zusätzlich die lokale Anlagezeit; die innere Liste heißt korrekt „Angebotsentwürfe dieses Auftrags“ statt eine zweite widersprüchliche Auftragszählung zu behaupten.

Der unkalkulierte interne Angebotsexport erhält strukturierte Menüpositionen/Portionen, neutrale Varianten-/Rückfragenzähler und die bestehenden internen Prüfgrenzen. Ungeprüfter Kundentext, automatische Paketleistungen und Kataloggesamtpreise bleiben ausgeschlossen; bereits Publish-freigegebene Altstände behalten ihren Pfad. Escaping und Geschäfts-/Rollenprüfungen bleiben erhalten. Die wiederholten fünf 404 beim Wiederöffnen waren falsche Intake-Abfragen für Draft-/Approval-/Handoff-IDs; der vorhandene Leser verwendet jetzt ausschließlich die typisierten Spec-IDs der aktuellen Snapshots.

Normale lokale Browsernachprüfung: ein neuer klar synthetischer 20-Gäste-Auftrag mit Kundenkennung, offener Menüexport, synthetische Kalkulation 1.160,00 € netto / 220,40 € Steuer / 1.380,40 € brutto, interne Variantenfreigabe, reguläre Produktionsübergabe, Kundenname in beiden Historien/Suchwegen und Wiederöffnung bestätigt. Desktop und 390-px-Mobilansicht ohne horizontales Überlaufen visuell geprüft. Nach Reload/Wiederöffnung keine neuen falschen 404. Die Küchenfreigabe dieses neuen Identitätstestfalls bleibt offen, Testdaten erhalten. Alle 13 ursprünglichen Referenzquellen weiterhin bytegleich; der vollständige Opus-100-Gäste-Nachweis aus 5.439 wird wiederverwendet.

Verifikation: 114 betroffene CI-Regressionstests in neun Dateien nach gezielten Korrekturen bestanden; 75 Kundenidentitäts-/Handofftests in sechs Dateien bestanden; anschließend 27 betroffene UI-Tests und 38 API-/Shelltests bestanden (Gruppen überlappen, nicht additiv zählen). Der neue typisierte Spec-Lesetest zeigt den konkreten Fehler zuvor und die Korrektur danach. Finaler Build und git diff --check PASS. Ein unabhängiger Reviewer nahm das substanzielle Kundenidentitäts-/Exportdelta einschließlich Anforderungen und Geschäftsgrenzen ohne materielle Befunde an; keine zusätzliche Vollreviewrunde.

Die erste vollständig ausgelaufene Gesamt-CI 39080927362/1ea955e endete nach 37 Minuten regulär mit neun Fehlern in acht Dateien, 3.538 bestandenen Tests; Observer selbst PASS (zwei Tests, rund 145 s), kein Hänger. 39081623970/51ca799 zeigte dieselben Regressionsfamilien. Die Korrekturen erhalten Schutztests: neue ehrliche Exporttitel/Status, präziser ungerundeter Rezeptwert und veröffentlichungsgebundener Kundentext statt veralteter Erwartungen. Gesamt-CI auf c408b72 (39083127291) läuft separat; Browser/Compose/macOS bestanden. Für den gebündelten neuen Head ist dessen eigene automatische CI maßgeblich. Kein Gesamt-CI-PASS, Merge oder Nürnberg-Deployment behauptet.

Belege im bisherigen ignorierten tmp/product-pilot-20261018: ci-regressions-*, customer-identity-*, customer-ui-polish-tests.log, typed-spec-read-{red,green}.log; Screenshots output/playwright/customer-identity-*.png. Nächste Produktarbeit: widerspruchsfreie Zustände nach Produktionsübernahme/Wiederöffnung, anschließend die konkret belegten Druck-/CSV-/Planungslücken im Opusbericht. Bestehende Angebote seit 2022 und die genannten Lexware-Mails 2025/2026 bleiben Recherchequellen; angebotsspezifischer 45,55-€/h-Beleg ist geschützt gesichert, vollständiges Rechnungsarchiv weiter nicht nachgewiesen. Keine pauschalen Unternehmenspreise oder Steuerentscheidungen erfunden.

Gesamtziel ACTIVE; realer Pilot NO-GO. Release/Nürnberger Auslieferung, eigener Backup→Restore→Cleanup-/Monitoringnachweis und echte Preis-/Steuer-/Küchen-/Allergen-/Lieferanten-/Temperaturfreigaben bleiben offen. Helsinki OFF und erhalten; keine Host-, DNS-, ADH- oder Löschaktion.

# Produktziel CateringOS

## Verbindliches Arbeitsziel — 18.10.2026: intern nutzbarer CateringOS-Pilot

Alexander hat die weitere Arbeit am eigentlichen Produkt und ein autonom verfolgbares Ziel ausdrücklich beauftragt. Der vorhandene Nürnberger Stand 5.413 wird übernommen. Dieses konkrete Arbeitsziel setzt das bestehende Pflichtenheft für den nächsten nutzbaren Stand um; dessen Produktgrenzen bleiben erhalten.

**Ziel:** Ein berechtigter Mitarbeiter kann einen Cateringauftrag in der normalen Oberfläche von der Anfrage über ein nachvollziehbar kalkuliertes und bearbeitbares Angebot bis zu freigegebenen Produktions-, Rezept-, Einkaufs- und Druckunterlagen führen. Dafür ist keine Terminal-/API-Handarbeit im Fachablauf nötig.

**Nachweis der Zielerreichung:** Der vorhandene 100-Gäste-Referenzauftrag wird als neue dauerhafte Fassung mit 55/25/20 Hauptgerichten, vollständigem Menü und 2 g Zimt regulär in der App verarbeitet. Speichern, Wiederöffnen, Änderungen, Freigaben, Produktionsübergabe und Exporte stimmen überein. Preisbestandteile einschließlich Personal/Logistik sowie Netto/Steuer/Brutto sind nachvollziehbar; fehlende Belege werden sichtbar als offen behandelt und sperren eine fachliche Freigabe. Küchenunterlagen enthalten die tatsächlich benötigten Mengen, Zubereitung, Zeit-/Logistikangaben, Ernährungs-/Allergenhinweise und nachvollziehbare offene Sonderkostprüfungen. Reale Küchen-/Lieferantenfreigaben werden vom Menschen bestätigt.

**Arbeitsreihenfolge, keine neue Architektur-Roadmap:**
1. Vorhandenen Produktstand stabilisieren: ausgelieferte Fixes in den führenden Code-/CI-Weg übernehmen; die im echten Test belegten Übergabe-/Statusprobleme schließen und einen brauchbaren Bürozugang über die bestehende Rollenverwaltung klären.
2. Bestehende Angebots-/Kalkulationsfunktionen bis zu einer prüfbaren Leistungs- und Preisaufstellung schließen. Nur belegte Unternehmenspreise oder bewusst eingegebene Testannahmen verwenden; keine Preise, Steuersätze, Margen oder Freigaben erfinden.
3. Bestehende Rezept-/Produktions-/Einkaufswege auf tatsächlich nutzbare Büro- und Küchenunterlagen ausrichten und den Referenzauftrag dauerhaft im Backoffice abschließen.
4. Vor realem Pilotbetrieb die noch offenen Nürnberger Backup→Restore→Cleanup-/Monitoringnachweise und die menschlichen fachlichen Freigaben schließen; anschließend belastbar über Pilot-GO entscheiden.

**Verbindliche UX-/UI-Grundlage:** Die gemeinsame AgenturOS-Designsprache unter /Users/alexandersmyslowski/.codex/design/AGENTUROS-DESIGNSPRACHE.md gilt ausdrücklich auch für dieses Produktziel und das spätere Opus-Review. Ruhige klassische Apple-like-Oberfläche, gemeinsame Hülle/Navigation/Typografie/Abstände/Komponenten, ein klarer primärer nächster Schritt und verständliche Zustände für Büro und Küche. Bestehende Entwürfe und die AgenturOS-Referenz weiterentwickeln; bei wesentlichen neuen Oberflächen Opus 5.5 zur Ausarbeitung und impeccable zur Konsistenzkritik einsetzen, tatsächliche Bedienwege anschließend im Browser prüfen. Fachliche Schutzinformationen, Herkunft, synthetische/historische Stände und offene Freigaben bleiben sichtbar. Keine ungefragten Änderungen anderer Projekte.

**Verbindliche unabhängige Produktabnahme mit Opus 5.5:** Nach dem umgesetzten nutzbaren Produktstand lässt Alexander ausdrücklich Opus 5.5 Funktionalität, UX und UI auf Herz und Nieren prüfen. Das Review muss den vollständigen Referenzauftrag und relevante Änderungen/Fehlerfälle in der tatsächlichen Oberfläche sowie Küchen-/Einkaufs-/Angebotsdruck beurteilen. Erwartet werden reproduzierbare Befunde nach Alltagsauswirkung, belegte Mengen-/Preis-/Freigabekonsistenz, Verständlichkeit für Büro/Küche und eine ehrliche Pilotempfehlung. Kein bloßes Code- oder Screenshotreview als vollständiger Praxistest ausgeben. Nur synthetische Testdaten und berechtigte Testzugänge; keine Secrets oder echten Kundenbestände an den Reviewer weitergeben. Tatsächliche Modellkennung claude-opus-5-5 nachweisen; bei Zugangs-/Toolgrenzen genau diese benennen und keine Ersatzmodell-Abnahme behaupten. Materielle Befunde im beauftragten Umfang beheben und gezielt nachprüfen.

**Helsinki-Kostenentscheidung nach Abnahme:** Auf Alexanders ausdrücklichen Wunsch ist die stündliche, rein lesende Erinnerung cateringos-helsinki-kosten-nach-produktabnahme-beenden aktiv. Bei unverändertem Stand bleibt sie still. Sie legt nach erfolgreichem Produktablauf, tatsächlicher Opus-5.5-Abnahme und eigenständigem Nürnberger Backup-/Restore-/Cleanup-Nachweis die konkrete Löschentscheidung vor. Helsinki ist bereits ausgeschaltet, aber weiter kostenpflichtig; eine endgültige Löschung einschließlich separat berechneter entbehrlicher Ressourcen braucht eine konkrete gesonderte Freigabe. Sicherungen aller drei Datenbanken, Konten, erforderlichen Dateien und der unabhängige Wiederherstellungs-/Rückfallweg bleiben erhalten. Die Erinnerung führt keinerlei Betriebs- oder Löschaktion aus. Offizielle Abrechnungsgrundlage: https://docs.hetzner.com/cloud/billing/faq/

**Autonom ausführbar:** Code lesen/verbessern, relevante Regressionen/Builds, sichere lokale Tests mit synthetischen Daten, unabhängige Prüfung wesentlicher Änderungen, konkrete Integrations-/Releasevorbereitung und Fortschrittsführung in diesen bestehenden Projektdateien. Aktuelle Nutzerfreigaben und strengere Release-/Betriebsvorgaben bleiben maßgeblich. Menschliche Anmeldung, echte Unternehmens-/Preis-/Küchenfestlegungen und fehlende externe Ausführungsbefugnis gezielt anfragen; unabhängige Arbeiten weiterführen.

**Erhaltungsgrenzen:** Alle drei Datenbanken, Konten, erforderlichen Dateien und historischen Freigaben erhalten. Keine Änderung echter Kundenaufträge, keine neue Persistenz-/Auth-/Prüfplattform, keine ADH-Reaktivierung, keine fremden Locks, keine Helsinki-Löschung oder neue DNS- oder Änderungen fremder Projekte. Synthetische Testergebnisse sind keine echte Küchenfreigabe.

## 5.439 —18.10.2026: eigener Opus-Volllauf und Quellen-P1 geschlossen

Ein tatsächlicher neuer100-Gäste-Auftrag wurde durch claude-opus-5-5 selbst vollständig über die normale lokale Oberfläche bearbeitet: Anfrage/Kalkulation/Reload/Freigabe/Handoff,9Rezeptzuweisungen/Planungsnachweise,13Prüfkarten/Produktionsfreigabe/Übernahme,Mappe/Blatt/CSV/Wiederöffnung.9Batches,49Zutatenbeiträge,29Positionen,55/25/20 und2gZimt eigenständig nachgerechnet;synthetische8043,20netto/1528,21Steuer/9571,41brutto. Runtime canonicalModel=claude-opus-5-5,provider=firstParty,118Turns,CLIexit0. NeuerSpec e6bc48db…;13Originalquellen unverändert,Rezepte weiterhin review_required.

Der neue Ablauf fand zusätzlich verlorene„glutenfreie Sonderkost“ und Detailzeiten. Enger Quellenfix: Flexion nur im Gast-Teilgruppenmatcher, globalerFreeFrom-Matcher unverändert; benannteZeit-/Logistiksegmente als ungeprüfter Originalwortlaut über vorhandeneproductionConstraints erhalten. Keine automatische Fachfreigabe,keinSchemawechsel,keine historischen Fassungen umgeschrieben.89relevanteTests/7Dateien (35Normalisierung,18Druck,9Handoff,27angrenzende),Build/gitdiffcheck und unabhängigerCodeReviewPASS. Neue Testassertions200→bestehende201 korrigiert,keine Produktregeländerung.

Gezielte tatsächliche Opus-Nachprüfung an genau einem neuen20-Gäste-Fall bis Übernahme/beidenA4-Drucken/Reload: beideSonderkostgruppen undalle5Zeit-/Logistikeinträge erhalten,ungeprüft,keineglobaleGlutenfrei-Zusage.16Turns,gleichesModell/Provider,exit0. BeideSessions geschlossen;keinCleanup behauptet. Originalberichte/Restbefunde:docs/product/OPUS_PRODUKTPRUEFUNG_20261018.md. Belege tmp/product-pilot-20261018/opus-full-e2e-*,opus-source-p1-*,new-request-context-*;PDF/CSV output/playwright.

Ein konkretesDrive-Angebot2026 belegt45,55€/h„Logistik,Service&Küchencrew“(6,5h→296,08€),nurangebotsspezifisch;geschützteProvenienzactual-2026-offer-rate-source.private.json(0600,ignoriert),keinKundenrohtext. KeinallgemeinerTarif/Steuerfestlegung abgeleitet;vollständigesLexware-Archivweiternichtnachgewiesen.

Gesamtziel ACTIVE,realerPilotNO-GO. NächstekonkreteP2:unterscheidbareAuftragsnamen/Suche und widerspruchsfreieZustände nachÜbernahme/Reopen;übrigeDruck-/Quellen-/CSV-/PlanungsbefundeimOpusbericht. KleineHinweisdopplungdurchSatzsegmentierungoffen,keineRohinformationverloren. AutomatischeGesamt-CI,Integration/Release/NürnbergerAuslieferung,eigeneNürnbergerBackup→Restore→Cleanup/Monitoring und echteFachentscheidungenweiteroffen. HelsinkiOFF/erhalten;keineHost-/DNS-/ADH-/Löschaktion.


## 5.438 — 18.10.2026: ehrlicher Übergabestatus und aktuelle Produktionswiederöffnung

Die lokale UI unterscheidet erfasste Veranstaltungsdaten, tatsächlich revisionsgebundene interne Angebotsfreigabe und erfolgte Produktionsübergabe. Datenvollständigkeit ist kein Handoff und keine Küchenfreigabe. Bereits erledigte Freigabe-/Übergabeaktionen werden nicht erneut angeboten; neue Fassungen bleiben über die vorhandene Bindung wieder freigabefähig. Der irreführende generische Spec→Produktion-Link entfällt; die vorhandene bestätigte Übergabe öffnet den Produktionsauftrag. #history öffnet die eingeklappte Auftragshistorie, Fallstatus sind deutsch.

Die tatsächliche Browsernachprüfung fand zusätzlich einen alten Handoff-Draft-Link: trotz richtigem Fall und vorhandenem Plan erschien „Entwurf nicht verfügbar“, weil der ursprüngliche Entwurf ersetzt war. inspect_handoff öffnet jetzt nach unveränderter serverseitiger Fallauflösung und Staleprüfung die bestätigte case-only URL. Deren bestehende Projektion zeigt den aktuellen Stand; neue Übergaben und explizite Reviewlinks behalten ihre Draftbindung. Kein Backend-/Freigabe-/Datenmodellwechsel.

Gezielte67 Tests/5Dateien, danach29 Tests/4Dateien (überlappend) und finaler Build/gitdiff--check PASS. Ein unabhängiger Reviewer nahm Grunddelta und gezieltes Wiederöffnungsdelta ohne materielle Befunde an. Browser: unfreigegebener20-Gäste-Testfall wahrheitsgemäß ohne Handoff; ursprünglicher100-Gäste-Fall über den echten Angebotsbutton mit korrekter ProductionCase-ID geöffnet, kein veralteter Draftquery, keine falsche Nichtverfügbarkeitswarnung, vorhandener Plan/Einkauf und Sonderkostnotizen sichtbar. Alle13 Originalquellen bytegleich. Belege tmp/product-pilot-20261018/handoff-state-*.log/txt und handoff-reopen-targeted.log.

VollständigerCI39080927362 auf vorigemHead1ea955e läuft regulär weiter; Browser/Compose/macOS PASS, Gesamtstatus noch offen. Nicht abbrechen oder als bestanden ausgeben. Für dieses neue UI-/Navigationsdelta ist die automatische CI am neuen Head separat maßgeblich. Kein Nürnberger Deployment oder Pilot-GO; tatsächlicher vollständiger eigener Opus-End-to-End-Ablauf, reale Fachentscheidungen und Nürnberger Backup→Restore→Cleanup/Monitoring bleiben offen. Nächster Produktpunkt: unterscheidbare Auftragsnamen/Suche, anschließend verbleibende konkret belegte P2-UX-Befunde. Gesamtziel ACTIVE.


**Vorheriger Fortschritt —18.10.2026:** Vollständiger lokaler synthetischer100-Gäste-Ablauf aus5.417 erhalten: neun Rezepte/Batches,49 Zutatenbeiträge,29 Einkaufspositionen,55/25/20 und2gZimt exakt; CSV und18-seitigeA4-Mappe,Neustartnachweis. Tatsächliche unabhängige Produktprüfung mit Modell claude-opus-5-5 (canonicalModel/provider firstParty belegt) abgeschlossen; Bericht docs/product/OPUS_PRODUKTPRUEFUNG_20261018.md. Opus bediente vorhandenen Auftrag,Preis-/Mengenfehlerfälle,Desktop/Mobil undExporte selbst; Rezeptimporte/13Karten/Approval/Applywurden nur am gespeicherten Ergebnis geprüft, daher kein eigener vollständiger Opus-E2E-PASS.

Drei priorisierte P1-Befunde gezielt in Produktcommit7c67497 repariert und unabhängig angenommen: bestehende gefrorene Sonderkost-/Zeit-/Logistiknotizen in UI/Produktionsplan/Mappe sichtbar; neue quantifizierte Allergen-Teilgruppen als offene Quellanforderung erhalten, globale Menü-/Veganpflichten bleiben vorrangig. Unpublishter unkalkulierter Angebotsexport enthält keine automatischen Paketleistungen und Kataloggesamtpreise; ungeprüfter Kundentext/Arbeitsbetrag wird in der UI nicht als Angebot ausgegeben. Bereits Publish-freigegebene historische Fassungen bleiben im bestehenden Pfad. Mengenpreview trennt bisherigen effektiven Wert von neuem Proportionalwert:55→60Portionen,6,6→7,2kg;15signifikanteStellen ohne gerundeten Zwischenfaktor,2g-Vorwert bleibt erhalten,Deutschkomma möglich. Neue Menge braucht neue Küchenfreigabe; bisher freigegebener Stand bleibt erhalten.

Nachprüfung derselben drei P1 mit tatsächlichem claude-opus-5-5 in eigener BrowserSession catering-opus-p1-20261018: alle drei geschlossen,Session beendet. Kein neues Gesamt-/Pilot-PASS. Opus hat dabei einen weiteren ausdrücklich synthetischen offenen20-Gäste-Testauftrag angelegt; der Satz im Modellbericht „keine Daten geändert“ bezieht sich nicht auf diese Neuanlage. Zwei offene Opus-Testfälle bleiben erhalten,keine falsche Cleanupbehauptung. Originaler100-Gäste-Fall: alle13 Quellartefakte weiterhin bytegleich,9Batches/29Einkauf,0,002kgZimt unverändert nach Preview/Abbrechen. Küchen-PDF vollständig neu gerendert/als18Seiten-Kontaktbogen geprüft;Sonderkost/Anlieferung sichtbar,keine„KeineblockierendenRückfragen“-Scheingrünheit.

Verifikation:61Core-/Serviceprüfungen in8Dateien,2UI-Previewprüfungen,86Kontext-/Preis-/Printprüfungen in9Dateien undnach gezieltenScopekorrekturen45Diet-/Mappeprüfungen in2Dateien PASS (teilweise überlappend,nicht additiv zählen). FinalerBuild/gitdiff--check PASS. Ein unabhängiger Reviewer deckte alle P1-Deltas; zwei konkrete Scopebefunde am Teilgruppenfilter wurden behoben und nur betroffene Korrekturen nachgeprüft. Keine neue Prüf-/Persistenz-/Autharchitektur. Belege im bisherigen ignorierten tmp/product-pilot-20261018/opus-*.log/jsonl,Ausgaben output/pdf.

CI-Korrektur bleibt verbindlich: kein tatsächlicher Observer-Hänger belegt. LetzterRun39079338322 wurde nach6Minuten zu früh abgebrochen;seinLogzeigt95Operationsprüfungen in244s PASS,Observernoch nicht gestartet. Alle bisherigen RunsCANCELLED,keinFull-Suite-PASS. Statisch begrenztes Observer-Testharness aus2951e10 lokal/ unabhängig angenommen; keine weitere Linux-Ursachenbehauptung oder unbewiesene Reparatur. Jetzt einen gebündelten erforderlichen CI-Lauf vollständig mit realistischer Laufzeit abwarten,keineunveränderte lokaleVollsuite oder weitere vorschnelleAbbrüche.

Nächste Produktpriorität nach Integration: wahrheitsgemäßer Übergabestatus unfreigegebener Entwürfe,findbareAuftragsnamen/Suche und fallgebundene Navigation;übrige konkrete P2s stehen im tatsächlichen Opusbericht,keine neueRoadmap. GesamtesAppzielACTIVE. Nürnberger Auslieferung dieses Inkrements, eigener Backup→Restore→Cleanup/Observer und reale Preis-/Steuer-/Küchen-/Allergen-/Lieferanten-/Temperaturfreigaben weiter offen;realerPilotNO-GO. HelsinkiOFFundvollständigerhalten;keineHost-/DNS-/Konto-/ADH-/Löschaktion. Angebotsunterlagen seit2022 sowie2025/2026sind Recherchegrundlage;vollständigerLexware-Rechnungsbestand im verbundenen Postfachweiter nicht nachgewiesen.

**Zielverwaltung — aktualisiert am 18.10.2026:** Alexander hat das alte pausierte Ziel im Zielbereich beendet. Das neue vollständige Produktziel wurde danach erfolgreich angelegt; der bestätigte App-Status ist active. Die bisherigen offenen Betriebs-/Fachnachweise werden weitergeführt und nicht nachträglich als erfüllt ausgegeben.


## Zweck

Dieses Dokument beschreibt das eigentliche Ziel von CateringOS in knapper, pruefbarer Form.

Es dient als Zielanker fuer Codex-/Hermes-Reviews, Produktentscheidungen, Scope-Kontrolle und weitere kleine Umsetzungsslices. Es ersetzt nicht `memory.md`, `README.md` oder die Detaildokumente, sondern fasst die Zielrichtung zusammen.

---

## Kurzfassung

Ziel ist eine interne, praxistaugliche Catering-Arbeitsplattform, die aus eingehenden Catering-Anfragen strukturiert verwertbare Angebots-, Produktions-, Einkaufslisten-, Export- und Audit-Arbeitsbelege erzeugt.

Die Plattform soll den realen Arbeitsfluss von The One / CommCats unterstuetzen:

```text
Intake -> Angebot -> Produktion -> Rueckfragen -> Exporte/Audit
```

Der aktuelle Zielbetrieb ist ein kontrollierter interner MVP-/Beta-Korridor. Externe Kundennutzung, oeffentliche Produktfreigabe, echte Multi-Tenant-Plattform, White-Label-Rollout und produktionsnahe echte Datenverarbeitung sind ohne gesonderte Gates nicht Teil des aktuellen freigegebenen Ziels.

---

## Produktziel

CateringOS soll den operativen Catering-Prozess schrittweise entlasten:

- Catering-Anfragen und Dokumente werden erfasst und in strukturierte Event-Spezifikationen ueberfuehrt.
- Der Angebotsagent unterstuetzt Angebotsentwurf, Varianten, Uebergabe und Angebots-HTML-Export.
- Der Produktionsagent unterstuetzt Produktionsplanung, Rueckfragen, Rezept-/Mengenbezug, Produktionsblatt, Einkaufsliste und Produktions-Exports.
- Die Backoffice-UI bietet eine ruhige, interne Arbeitsoberflaeche fuer Start, Angebot, Produktion, Rueckfragen, Exporte und Audit-/Handoff-Belege.
- Gemeinsame Kernmodelle, Regeln, Rollen-/Guard-Mechanik und Audit-Spuren bleiben im `shared-core` bzw. in den bestehenden Services verankert.
- Exporte und Audit-/Review-Spuren sind interne Arbeits- und Kontrollbelege, keine rechtssichere Compliance- oder externe Freigabeaussage.

---

## Aktueller Arbeitsmodus

Aktuell geht es nicht um moeglichst viele neue Features, sondern um einen stabilen, nachvollziehbaren internen MVP-Korridor.

Fuehrend ist:

- kleine echte Bausteine statt grosser Architekturverschiebungen;
- keine neue Persistenzwelt / kein Prisma ohne ausdrueckliche Entscheidung;
- Governance additiv, nicht als zweiter Kern;
- `ApprovalRequestRecord` bleibt fuehrende Freigabewahrheit;
- `SpecGovernanceStateRecord` bleibt Statusspur;
- `SpecChangeSetRecord` bleibt Aenderungseinheit;
- Finalize ist nicht gleich Freigabe;
- M1 Owned Memory Foundation bleibt intern, modellagnostisch und ohne neue API-/Persistenz-/UI-Flaeche;
- die aktuelle Phase ist eine Konsolidierungsphase ohne neue Fachlogik, sofern kein enger Auftrag etwas anderes verlangt.

---

## Nicht-Ziele im aktuellen Stand

Aktuell nicht Ziel und nicht stillschweigend einzufuehren:

- neue Produktflaeche ohne ausdruecklichen Auftrag;
- echte Multi-Tenant-Runtime oder Plattformisierung als operativer Kern;
- externe Kundennutzung oder oeffentliche Produktfreigabe;
- produktionsnahe Verarbeitung echter Kunden-, Personen-, Event-, Angebots-, Rezept- oder Produktionsdaten ohne freigegebene Gates;
- neue Auth-/Login-/OIDC-/Session-Welt ohne bewusste Architekturentscheidung;
- neue API-Endpunkte, neue Persistenz, Prisma, Migrationen oder Datenmodell-Grossschnitt ohne ausdrueckliche Entscheidung;
- automatische Spec-Korrektur, Rezept-/Allergenautomatik, LLM-/Tool-Use-Ausbau, OCR-/Parser-Engine-Ausbau oder echte Upload-Verarbeitung ausserhalb der dokumentierten Gates;
- Deployment, SSH, Secrets, produktive ENV, Serveraenderungen, Backup-Aktivierung oder Live-Datenaktionen ohne explizite Freigabe;
- rechtssichere Compliance-, Audit-, DSGVO-, AVV-, SLA- oder externe Freigabe-Behauptungen.

---

## Zielnutzer im MVP-Korridor

### Interne Angebots-/Backoffice-Nutzung

Die interne Angebots-/Backoffice-Nutzung braucht:

- klare Erfassung bzw. Uebernahme von Catering-Anfragen;
- pruefbare Angebotsentwuerfe und Varianten;
- sichtbare Uebergabe in die Produktion;
- nachvollziehbare Export- und Handoff-Anker;
- einfache Reibungsnotizen fuer Beta-/Rehearsal-Durchlaeufe.

### Interne Produktion / Kuechenplanung

Die interne Produktion braucht:

- verstaendliche Produktionskontexte;
- klare Rueckfragen statt Scheinautomatik;
- sichtbare Ergebnisobjekte;
- Produktionsblatt, Einkaufslistenbezug und Exportanker;
- Herkunfts-, Quellen-, Audit- und Handoff-Kontext;
- klare Stop-Gates bei fehlenden Daten, unklaren Quellen oder nicht freigegebenen echten Uploads.

### Alexander / Betreiberrolle

Alexander braucht:

- eine belastbare Management- und Go/No-Go-Sicht;
- klare Trennung zwischen intern testbar, nur dokumentiert, offen, blockiert und out of scope;
- konservative Freigabegrenzen fuer echte Daten, Deployment, Auth, Retention, Backup, Sandbox/Worker/AV und Compliance;
- kleine entscheidbare Folgeschritte statt Feature-Sammelbecken.

---

## Qualitaetsziel

Die Plattform soll zuerst intern vertrauenswuerdig werden.

Prioritaet haben:

1. Nachvollziehbarkeit: Jede relevante Uebergabe, Rueckfrage, Export- und Auditspur muss verstaendlich bleiben.
2. Scope-Kontrolle: Keine verdeckte Ausweitung in Plattform, Multi-Tenant, externe Nutzung oder echte Daten.
3. Bedienbarkeit: Der interne Pfad `Start -> Angebot -> Produktion -> Rueckfragen -> Exporte/Audit` muss ruhig und pruefbar bleiben.
4. Daten- und Quellenvorsicht: Rohtexte, Vollhashes, sensible Inhalte und echte Daten duerfen nicht unkontrolliert gespiegelt oder verarbeitet werden.
5. Testbarkeit: Kernpfade, UI-Marker, Verträge und lokale Runbooks bleiben test-/smoke-gesichert.
6. Betriebsreife: Hetzner-/Option-B-Vorbereitung bleibt nicht-sensitiv, gate-basiert und ohne stilles Deployment.
7. Ehrliche Freigabelogik: Interne Demo-/Beta-/Rehearsal-Signale sind keine Produktions-, Kunden- oder Compliance-Freigabe.

---

## Aktueller Reifegrad

Der aktuelle Stand ist ein interner MVP-/Beta-/Rehearsal-Korridor.

Verbindliche Einordnung:

```text
Lokaler interner Demo-/Rehearsal-Korridor: nutzbar/pruefbar unter dokumentierten Grenzen
Begrenzter interner Pilot mit anonymisierten oder synthetischen Daten: entscheidungsbeduerftig / not assessed
Produktionsnahe Nutzung mit echten Daten: blocked bis Gates bewusst freigegeben sind
Externe Kundennutzung / oeffentlicher Rollout: blocked
```

Das bedeutet:

- Gruene Tests, lokale Smokes und Export-/Auditbelege zeigen interne technische Reife, aber keine externe Freigabe.
- Echte Daten, Deployment, Auth, PII/Retention/Backup, Sandbox/Worker/AV und Compliance bleiben eigene Gates.
- Neue Produktfaehigkeiten duerfen nur als enger, begruendeter und testbarer Slice umgesetzt werden.

---

## Entscheidungsregel fuer neue Arbeit

Jede neue Code-, Doku-, Review-, Deploy- oder Produktaufgabe soll gegen diese Fragen geprueft werden:

1. Staerkt sie direkt den bestehenden internen MVP-Korridor oder die Nachvollziehbarkeit?
2. Ist sie klein, reversibel und innerhalb vorhandener Architektur-/Persistenz-/API-Grenzen?
3. Fuehrt sie neue Produktflaeche, neue API, neue Persistenz, echte Daten, Deployment, Auth oder externe Freigabeversprechen ein?
4. Gibt es eine klare Verifikation durch Test, Smoke, Doku-Vertrag oder nachvollziehbaren Review?
5. Trennt sie sauber zwischen umgesetzt, fachlich beschrieben, offen, blockiert und out of scope?

Wenn Punkt 3 zutrifft oder Punkt 4 fehlt, ist die Aufgabe zunaechst zu stoppen oder ausdruecklich neu freizugeben.

### Autonomer Umsetzungskorridor

Codex/Hans soll nicht fuer jeden kleinen planfolgenden Schritt stoppen. Autonom erlaubt sind kleine, lokale, testbare und reversible Slices, wenn sie den bestehenden internen MVP-/Rehearsal-Korridor direkt staerken und keine neue Gate-Grenze beruehren.

Autonom erlaubt:

- synthetische Produktionskern-Smokes fuer haeufige Catering-Faelle;
- enge Rezept-Matching-, Import-, Einkaufslisten-, Export- und UI-Haertungen anhand belegter Reibung;
- verhaltensgleiche UI-Wartbarkeitsschnitte;
- Doku-/Contract-Tests, die bestehende Ziele, Gates oder Runbooks operationalisieren;
- lokale Browser-/Rehearsal-Evidenz mit synthetischen oder Demo-Daten.

Weiter entscheidungspflichtig:

- echte Daten oder echte Google-Drive-Angebote;
- Auth/OIDC/IAP/Proxy, Deployment, Secrets, produktive ENV oder Serveraenderungen;
- PII/Retention/Backup/Restore, Sandbox/Worker/AV oder produktionsnahe Uploads;
- neue API-Endpunkte, neue Persistenz, Migrationen oder Datenmodell-Grossschnitte;
- echte `ConversationSession`-Runtime, LLM-Provider, Providerkosten, Logging, Secrets, Datenuebertragung oder Tool-Orchestrierung mit Schreibwirkung;
- externe Freigabe-, Compliance-, Audit-, DSGVO-, AVV-, SLA- oder Kunden-Nutzungsbehauptungen.

Sicherer Default: Wenn ein Schritt fachlich sinnvoll ist, aber eine Gate-Grenze beruehrt, wird er nicht stillschweigend gebaut. Dann entsteht eine knappe Entscheidungsvorlage oder eine kleinere gate-freie Variante.

---

## Praktischer Zielzustand vor dem naechsten groesseren Reifeschritt

Der naechste sinnvolle Zielzustand ist nicht „mehr Plattform“, sondern ein sauberer interner Arbeitskern:

- `Start -> Angebot -> Produktion -> Rueckfragen -> Exporte/Audit` ist lokal und synthetisch reproduzierbar;
- UI und Dokumentation vermeiden Scheingruenheit;
- Export- und Auditanker sind intern lesbar und testbar;
- Reibung aus manuellen Durchlaeufen kann in kleine Fixes, spaeter, Entscheidung noetig oder out of scope sortiert werden;
- Hetzner-/Option-B-Vorbereitung bleibt nicht-sensitiv und gate-basiert;
- echte Daten, echte Uploads, Deployment, Auth und Compliance-Freigaben bleiben blockiert, bis Alexander sie bewusst entscheidet.

---

## Fuehrende Referenzen

Bei tieferer Pruefung sind insbesondere diese Dokumente heranzuziehen:

- `memory.md`
- `HANDOFF_PROMPT.md`
- `README.md`
- `TESTING.md`
- `docs/product/C8_INTERNER_DEMO_DURCHLAUF_ABNAHMEWEG.md`
- `docs/product/P12_N2_MANAGEMENT_GO_NO_GO_ENTSCHEIDUNGSPAKET.md`
- `docs/product/P11_N3_INTERNER_PILOT_PREFLIGHT_RUNBOOK.md`
- `docs/product/P7_B67_REIBUNG_ZU_BACKLOG_TRIAGE.md`
- `docs/architecture/PRODUCTION_AGENT_V1_ARCHITECTURE_GATE.md`
- `docs/architecture/PA9_PROXY_DEPLOYMENT_READINESS_ADR.md`
- `docs/deployment/B37_NONSENSITIVE_TECHNICAL_PREPARATION_PLAN.md`

---

## Merksatz

Dieses Projekt soll zuerst eine ruhige, intern kontrolliert nutzbare Catering-Arbeitsplattform fuer Anfrage, Angebot, Produktion, Rueckfragen, Exporte und Audit werden — nicht vorschnell eine externe SaaS-Plattform, nicht vorschnell ein Produktionssystem fuer echte Daten und nicht ein unkontrolliertes Feature-Sammelbecken.
