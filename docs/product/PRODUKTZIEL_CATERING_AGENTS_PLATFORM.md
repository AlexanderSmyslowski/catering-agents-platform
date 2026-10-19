## CI-Zeitbudget zweier zusammengesetzter Rollbacktests korrigiert — Version 5.468 / 19.10.2026

Der tatsächliche neue Nürnberger Backup→Offhost→Restore→Vergleich→Cleanup aus5.467 bleibt unabhängig angenommen: Runf9dddc12c27fc09ece46331ec46c4380, Abschluss18:42:44.858084UTC, alle3Datenbanken/Globals/8Dateibäume identisch, sieben ursprüngliche Dienste und genau fünf Namedvolumes, keine eigenen Proben/Arbeitsbereiche/Updatelock. Keine Auth- oder Produktzielabnahme daraus. Privater ErgebnisbelegT/nue-backup-restore-f9dddc12c27fc09ece46331ec46c4380.private.json;6h-Grenze20.10.00:42:44UTC unverändert.

CI39295667334 Versuch2 endete nach39m28s mit3.588PASS/21SKIP/einem Timeout: zusammengesetzter Rollbacktest120,299s bei120s; zweiter ähnlicher Fall119,375s. Kein fachlicher Assertionsfehler. Beide Tests/Harness-/Produktionsquellen waren seit angenommenemc3bf1e8 unverändert; erster gezielter lokaler Lauf86,141s/102,221s, ältereCI79,878s/76,461s. Deshalb keine dritte blinde Wiederholung: ausschließlich das aggregierte Vitestbudget dieser beiden Aktivierung→Crash→Wiederaufnahme-Szenarien auf180s gesetzt und begründet. Sämtliche Assertions, übrige Testlimits, produktive Stop-/Transport-/Rollbackfristen und Sicherheitsgates unverändert. Gezielte Nachprüfung dieser beiden Fälle: 2PASS/55 nicht ausgewählte Fälle, Gesamt153,07s. git diff --check bestanden. Harmloses Testbudgetdelta selbstgeprüft; angenommene unabhängige Produkt-/Operationsreviews bleiben gültig.

Der spätere PIN-only-AufruferT/nue_auth_smoke_active_interactive_20261019.py ist ebenfalls unabhängig angenommen: feste aktuelleReadybytes/Ownruns/Digests/Providerpfad, neues exklusives Metadatum; unveränderte geschützteTTY→SSHstdin→Targettmpfs-Übergabe und eigenerCleanup. Noch NICHT gestartet, keinPIN/Authslot erzeugt. PersönlicheEingabe erst unmittelbar vor konkreter ausführbarerInstallation; technischeHTTP-Zugangsdaten aus vorhandener geschützterBetreiberablage. BestehenderChrome-Tab1456369328 zeigt normalesApp-Anmeldeformular.

Produktstand auf Nürnberg weiterhinPR727/c3bf1e8; keinMerge oder Deployment vonPR732. NächsterSchritt: neuePflicht-CI am gezielt korrigierten PR732-Head, danach Integration/exakteMain-Push-CI und normaleNUE-Prepare/Build/Stage/Apply-/Auth-/100Gäste-Nachprüfung mit frischen Zugangsgates. Keine neueArchitektur, Daten-/DNS-/Firewall-/Helsinki-/ADH-Änderung. HelsinkiOFF/erhalten, Produktzielweiteroffen.


## Heimnetzzugang offen; Update- und Exportregressionen gezielt geschlossen — Version 5.465 / 19.10.2026

Heimnetz92.208.68.223 durch beide Live-IPdienste bestätigt; tatsächliche aktuelle Provider-/Firewall-/Hostkey-/Key-/Ownlockprüfung und gepinnterNürnbergread bestanden. SiebenDienste laufen, OriginalEdge2f432e…85001, keinUpdatelock; HelsinkiOFF/erhalten. Keine neueFirewall-/HTTPSfreigabe nötig oder durchgeführt. Aktuelle reine Recovery-/Address-/Repositoryleser bestätigen unabhängigesArchiv und alle drei Runtime-Secrets verdeckt; keine Zugangsdaten ausgegeben. Erste rein lokaleAdmissionvorbereitung hielt wegen falsch benannterIP-Authorizationdatei; tatsächliche geschütztePR727-Ausführungsquittung anschließend korrekt gebunden, keinGrant umetikettiert. KeinHoststopp/keinCapture daraus abgeleitet.

Unabhängiger Ausführungsreview fand die bereits bekannte anonymePG-Probevolume-Lücke im altenHelper: nur cleanup_probe erhält nach unverändertemOwnname/Runlabelcheck --volumes, keinPrune/Fremdzugriff. Lostcreate-Test vorherFAIL, danach drei betroffeneSafetyfällePASS; consequentialReview angenommen. NeuerRemotehelperSHA5250a27c00b7845f2ff945558ac9993d7b46905745785976216e7370b473127e; alterdd9-Helper geschützt erhalten. Der schon vorbereiteteReadyrecord64dd…2b71 enthält nochdd9 und wird NICHT ausgeführt. Für neueAusführung alle aktuellenBelege/neuenSHA neu gemeinsam binden.

Zweiter tatsächlicher Updateblocker: alter current_base_gate akzeptiert nurBootstrapimages und/app; laufenderPR727/c3-Vorgänger wird amOCIvergleich zurückgewiesen (gezielt mit vorhandenemVorgängertest reproduziert). Fixd56a53a in PR733 https://github.com/AlexanderSmyslowski/catering-agents-platform/pull/733 unabhängig angenommen. Exakteursprünglichefb26/b2ffe-Basen/Aliase/Dockerfiles/npmci/Pullverbot unverändert. Nur festerPR727-Predecessorzweig über vollständigesManifest8e3bbad3…df50 und tatsächlichenManualreceipt8f588b75…008b, lesendenunverändertenaltenBundleverifier und tatsächlichefünfM-/Config-/Cmd-/CWD-/Mount-/Compose-/vollständigeRuntimeQuell-/Schema-/Webroot-/Sites-/Caddybindungen. Vorher/Nachher-/Stage-/Apply-/Signatur-/Smokegates bleiben; keinhistorischerApply/keineerfundeneinstalled.json.45NUEtestsPASS einschließlichneuer12Driftfälle/Vertrauensanker-Negative, alteLegacytests erhalten. EigeneCI39295165796 läuft; macOS/ComposePASS.

ProduktPR732-GesamtCI39290930892 regulär nach25min beendet: 3.582PASS,21SKIP,7FAIL in4Dateien; Build/macOS/Compose/BrowserPASS. Drei alteHeadingerwartungen und vierKopfzugriffe bei unvollständigenExportdaten betroffen. EngeKorrektur: fehlendeEvent-/Gäste-/Serviceformwerte als offen ausgeben; Headerweiterescaped, Publish-/Prüfgrenze unverändert. DreiHeadingtests prüfen jetzt gemeinsameninternenH1 PLUS tatsächlichenH2Kalkulationoffen; keinePrüfwarnung gelöscht. Fünf betroffeneDateien/72Tests danachPASS, TypeScriptPASS. HarmlosesDarstellungs-/Assertiondelta selbstgeprüft; unabhängigeAnnahme des übrigenunverändertenProduktpakets bleibt gültig. KeineWiederholung derunveränderten3.582Tests lokal; neueverpflichtendeCI amgebündeltenkorrigiertenHead folgt.

Noch keineWriterpause, kein neuerBackupcapture/Hostbuild/Deployment in diesemBlock. NeuenRestorelauf bewusst bis zur baldigenInstallierbarkeit zurückgehalten. NächsterSchritt: korrigiertenPR732-Head und PR733 über erfolgreichePflicht-CI integrieren, exakteReleasehead-CI abwarten, dann frischeProvider-/Zugangsbindung, einmaligeBackup→Offhost→Restore→Compare→Cleanup, normales signiertesUpdate mitgeschütztemSmoke und gezielter100-Gäste-Zielnachprüfung.5.463bleibtlokalerProduktnachweis; keinefalscheNürnberg-/Pilot-/Opus5.5-Abnahme. Gesamtproduktzielweiteroffen; automatischeBackup-/Observerkette und realeFachfreigaben bleibenoffen. Helsinki/DNS/ADH unverändert. OffizielleCore-Routerwartung weiterhin inBearbeitung laut https://status.hetzner.com/de/incident/cd31dd45-f431-4639-8f9a-d4bfb5353f30 .


## Datum, Angebotsänderung und Sonderkostweg lokal geschlossen — Version 5.463 / 19.10.2026

Alexanders GO aus 5.462 gezielt umgesetzt, ohne neue Architektur, Endpunkte, Persistenz oder Schemaänderung. Der Parser trennt ausdrücklich beschriftete Kunden-/Dokumentdatumszeilen vom Veranstaltungsdatum; ungültige oder mehrdeutige Kalenderdaten bleiben offen. Veranstaltungsdaten werden am bestehenden Angebotsentwurf über denselben geschützten Menü-Revisionsweg in eine neue unveränderliche Fassung übernommen, einschließlich Varianten, Rückfragen, Handoff und Export. Alle neun Portionswerte bleiben erhalten; Änderung verlangt erneute Kalkulation/Prüfung. Unabhängige Risiken werden nicht durch gleichnamige beantwortete Extraktionsfragen entfernt, und die ursprüngliche Quellfassung bleibt unverändert.

Sonderkost-Antwort wird auch als reine Antwortänderung gespeichert, im freizugebenden Snapshot, Apply und Druck erhalten und vor Produktionsfreigabe verlangt. Nur die konkret bekannte Extraktionsfrage wird geschlossen; unabhängige Risiken bleiben bestehen. Antwort ist ausdrücklich keine Allergen-/Küchenfreigabe. Originalfall und alte Freigaben werden nicht nachträglich umgeschrieben. Der Angebotskopf zeigt Kunde, Eventtyp, Datum, Gäste, Serviceform und alle Zeitfenster; offener Export bleibt wahrheitsgemäß interner Entwurf, vorhandene Publishgrenze unverändert. Gestaltungsleitlinie AgenturOS und impeccable im engen bestehenden Formular-/Drucklayout angewandt.

Gezielte Verifikation: 12 betroffene Testdateien / 220 Tests nach Behebung des konkreten optionalen-Constraints-Vergleichs vollständig bestanden (98 unverändert grün wiederverwendet, nur die beiden betroffenen Dateien mit 122 Tests erneut ausgeführt). Danach 37 Frozen-/Reviewtests bestanden; Gruppen überlappen, nicht addieren. TypeScript für tatsächlichen Quell-/Testbaum und Vitebuild bestanden; ignorierte historische tmp-Quellkopien waren allein vom lokalen Typcheck ausgeschlossen, Repo-tsconfig unverändert. git diff --check bestanden. Ein unabhängiger Reviewer nahm Anforderungen/Implementierung einschließlich Antwort-only-, Präzisions-Rückfragen- und Frozen-Review-Korrekturen ohne verbleibende materielle Befunde an; er führte keine eigenen Tests oder Hostprüfung durch. Keine neue Opus-5.5-Abnahme behauptet. Verpflichtende neue Gesamt-CI und Integration stehen noch aus.

Tatsächlicher normaler lokaler UI-Test desselben synthetischen 100-Gäste-Szenarios mit den neun unveränderten bestätigten Modellrezepten: Anfrage erkennt 12.11.2026 trotz 19.10.2026 im Kundenlabel; Veranstaltung auf 13.11. korrigiert, zwei Zeitfenster ergänzt und auf 12.11. zurückgestellt, jeweils neue Angebotsfassung mit 100/100/55/25/20/100/100/80/20 Portionen. Synthetische Kalkulation 8.043,20 EUR netto + 1.528,21 Teststeuer = 9.571,41 brutto, 80,43 netto/Gast. Interne Freigabe, Produktionshandoff, reine Sonderkostantwort, neun Mengen-/Rezeptbelege, 13 Prüfkarten, interne Produktionsfreigabe und Apply erfolgreich. Bei rascher Kartenbearbeitung blieb eine Karte offen; gezielt nachgelesen/gespeichert, erst danach 13/13 und Freigabe. Kein ungeprüftes Massenbestätigen als erfolgreicher erster Speichervorgang ausgegeben.

Lokale finale Spec spec-request-ui-4ec694d8-c7ca-477f-934c-122f0c09bdcc; Fall production-case-handoff-c944b0b6c7a5653d70c05396c619686b6a336063b95642b7aedb1b8b02083967; ApprovedProductionSpec approved-production-spec-533198f95f902b3243d534f5b2c4a25dca88bef212e4f9646a947c481d6d4e1b; Apply 16:55:51.107 UTC. Reload/Historie erhalten Antwort, Plan, Mengen und Einkauf. Dabei bleibt ein irreführender Hinweis „angeforderter Produktionsentwurf nicht verfügbar“ trotz sichtbarem übernommenem Stand als P2 offen; kein Datenverlust beobachtet.

Tatsächlich aus Chrome gespeicherte Angebots-PDF (2 Seiten), vollständige Produktionsmappe (13 Seiten) und normal heruntergeladene CSV geprüft. Alle 15 PDF-Seiten gerendert und visuell gelesen: neun Rezeptkarten/Küchenblätter und Einkauf vorhanden, keine fehlende Mengenzeile beobachtet. Decimal-Vergleich aller 49 Zutatenbeiträge gegen 29 gespeicherte und CSV-Summen exakt ohne Toleranz; Zimt 0,002 kg bzw. 2 g erhalten. Sonderkostantwort mit Freigabevorbehalt und Veranstaltungsdaten im Druck. Lokale Daten und Originaldateien: /Users/alexandersmyslowski/.codex/worktrees/catering-menu-portions/catering-agents-platform/tmp/event-corrections-local-nc3a5qbj (Angebot-Nachpruefung-100-Gaeste.pdf, Produktionsmappe-Nachpruefung-100-Gaeste.pdf, Einkauf-Nachpruefung-100-Gaeste.csv). Ausschließlich synthetisch; keine echten Kunden-/Betriebsdaten bearbeitet.

Nürnberg bleibt auf angenommenem PR727/c3bf1e8, PR731/e07265e9 als angenommener Operationsstand wiederverwenden. Dieser lokale Nachweis ist kein neuer Nürnberger Test. Alexander wechselt in iPhone-Hotspot; Abschluss des Netzwechsels noch nicht bestätigt, Provideranmeldung zuletzt abgemeldet. Vor Hosteingriff aktuelle IP/Provider/Firewall/Hostkey/Ownlock prüfen und erforderliche neue /32-Freigabe einholen. Zeitgebundenes Installationsgate erfordert neuen aktuellen Nürnberger Restore-/Cleanupnachweis; alten 18.10.-Erfolg nicht umdatieren. Nächster Schritt: gebündelte PR und vollständige verpflichtende CI, dann mit frischem Zugang und Wiederherstellungsbeleg veröffentlichte Update-/Rückfallprozedur ausführen und genau diesen Ablauf auf Nürnberg nachprüfen. Offene automatische Backup-/Observerkette, echte Preis-/Steuer-/Küchen-/Allergen-/Lieferantenfreigaben, T-1/Stationslogik und Druckfeinschliff bleiben Pilotgrenzen. Helsinki OFF/erhalten; keine Host-, DNS-, Lösch- oder ADH-Aktion in diesem Block.


## Tatsächlicher Nürnberger100-Gäste-Durchlauf mit Befunden angenommen — Version 5.462 /19.10.2026

Alexander hat die normale HTTP-/PIN-Anmeldung bestätigt; doppelte HTTP-Basic-Abfrage berichtet. Angemeldeten eigenen Catering-Tab tatsächlich gelesen und danach normalen UI-Ablauf durchgeführt, ohne Credentialinjektion, API-Geschäftsschreibzugriff oder Datenreset. Bei den weiteren Angebot-/Produktionsnavigationen keine erneute Basic-Abfrage beobachtet; Ursache der zuvor doppelten Abfrage nicht bewiesen, Zugangsfehler bleibt dokumentiert.

ProduktPR727/c3bf1e8 läuft weiterhin auf Nürnberg; PR731/e07265e9 und exakte Main-CI39255318331SUCCESS bleiben angenommen. Keine weitere Softwareauslieferung in diesem Block. Vorhandener17.10.-Altauftrag erhalten; neue klar synthetische Fassung desselben100-Gäste-Szenarios über Anfrage→Menübearbeitung→Testkalkulation→interne Freigabe→Produktionsübergabe→9Rezept-/Mengenbezüge→13Prüfkarten→interne Produktionsfreigabe→Übernahme→Reload/Historie→Druck/CSV tatsächlich durchgespielt. Finale Spec spec-request-ui-40125f09-dcbb-4f8b-8101-562e4cf8f6ca, Produktionsfall production-case-handoff-6a7d04c2868236e536b3af59e5621810b9efcaa64645e2b8c6a7f2a50dd8a9bb; PreparedDraftdf5acf…5b10Revision3, Apply14:15:10.700UTC. Bestätigte menschliche Modellannahmen vom17.10. nur für synthetischen Rechentest wiederverwendet, reale Fachfreigaben ausdrücklich offen.

Unabhängiger Reviewer prüfte tatsächliche CSV, drei PDFs samt22gerendertenSeiten und Ergebnisbindungen. Je49GEDRUCKTEZutatenbeiträge aus Blatt UND Mappe eigenständig mitDecimal aufsummiert→genau29Artikel; alle normalisierten/Einkaufsmengen und29gedrucktenSummen exaktgleich ohneToleranz. Portionsfolge100/100/55/25/20/100/100/80/20 erhalten, Zimt0,002kg inDrucken/CSV und2g imCSV exakt. Synthetisch8043,20netto+1528,21Teststeuer=9571,41brutto,80,43netto/Gast,24Service-/16Küchenstunden; keine Unternehmenspreis-/Steuerfreigabe. Angebot2PDF-Seiten, Blatt6, Mappe14; keine fehlendeRezeptkarte/abgeschnitteneMenge beobachtet. Technischer synthetischerDurchlauf MIT BEFUNDEN angenommen; kein fehlerfreierStandardablauf/keinPilot-GO/keine reale Küchenabnahme.

Wesentliche Produktblocker: (P1) Datumsparser wertet DatumimKundennamen statt Veranstaltung aus; Spezifikationskorrektur aktualisiert bestehendenAngebotsentwurf nicht ausreichend sichtbar. Test nur mit normalerUI-Quellenkorrektur/Neuerzeugung auf12.11.2026fortgesetzt. (P1) Sonderkostfrage bleibt strukturiertoffen; Antwortformular hat keinen vollständigen Weg. Plan/13Karten/Freigabe/Übernahme dennochmöglich, StatusPrüfungnötig nebenPlanvollständig; keine reale Freigabe daraus. (P1) KalkulierterAngebotsexport weiterhin internePrüfliste, Kunde/Datum/Servicezeit imKopf fehlen; keinversandfertigesAngebot behauptet, keine externePublishaktion. P2: alleStationenhot-kitchen/T-1pauschal, keine9Mengenänderungszeilen imneuenübernommenenFall, doppelteKalkulierteFassung-Labels, ungünstigerPreiszeilenumbruch/langedominanteQuell-IDs. BerichtT/nue-100-e2e-findings-20261019.md, tatsächlicheBindingsT/nue-100-e2e-actual-20261019.private.json, DateienT/nue-100-{purchase.csv,production.pdf,folder.pdf,offer.pdf} jeweilsmit-20261019imNamen. Altes tatsächlichverwendetesOpus5.5-Lokalreview weiter gültig; dieserKoordinator-Ziellauf und dessen unabhängigeArtefaktprüfung sind KEIN neuerOpus-Zielbrowserlauf.

Regulärer sichererAbschluss14:26:27UTC: tatsächlichesUI-Abmelden, bestehendesTestkonto über unveränderten hashgeprüftenCLI deaktiviert; PIN/Rolle erhalten. Nur eigenenaktuellenHTTPS-Run3a971e688bf241479ef1f984de1a40c6 mit unverändertemHelfer zurückgenommen, OriginalEdge2f432e92…85001 wiederhergestellt, eigenesRAM-Backup entfernt. NeueSSH-Mutationen erstnach tatsächlichem frischemProvider-UI-Read beiderFirewallressourcen/Originalregeln; beideLiveIPs/Keys/Hostkeys/Ownlocks bestanden. Schlussread7laufendeDienste, keinUpdatelock/eigenerUI-RAM-Pfad; öffentlicheProbe403/TLSverify0/2.28.200.16 zeigt regulär zurückgenommenen temporärenHTTPS-Zugang, keinenAppausfall. BestehendesSSH78/alleFirewallregeln erhalten; keine neueCredentialablage. T/nue-ui-live-{test-account-disabled-after-e2e,https-restored-after-e2e,safe-stop-after-e2e}-20261019.private.json.

Gesamtproduktziel weiterhin offen. Nächster enger Umsetzungsschritt: Datum/Kundenname voneinander trennen und bearbeitete Veranstaltungsdaten nachvollziehbar an neue Angebotsfassung binden; danach Sonderkost-Antwortweg und kundentauglichenAngebotkopf imbestehendenProdukt schließen. TatsächlicheNürnbergerBackup→Restore→Compare→Cleanup vom18.10. bleibt belegt; automatischeBackup-/Observerkette bleibt offen. HelsinkiOFF/erhalten, keineDNS-/Lösch-/ADH-Aktion. Alle eigenenWorker beendet; drei aktive eigeneLocks/Koordinator41347 werden nach Abschlussdokumentation regulärfreigegeben, alteRunIDs danach nicht wiederverwenden.


# Aktueller Produktstand — Version 5.443 / 18.10.2026

## 5.443 — 18.10.2026: Release-Audit geschlossen und Nürnberger Betriebsbestand tatsächlich gelesen

Die vorgeschriebenen npm-Audits deckten vier betroffene Abhängigkeiten auf. Ausschließlich kompatible Korrekturstände wurden im vorhandenen Overrides-/Lockfile-Verfahren gebunden: @fastify/busboy 3.2.2, fast-jwt 6.3.4, source-map-js 1.2.2 und das nur für Tests verwendete moment 2.31.0. Die vier Pakete bleiben innerhalb der vorhandenen Parent-Semverbereiche; keine weitere transitive Abhängigkeit oder Produkt-/Auth-/Upload-/Schemafunktion eingeführt. Beide Audits melden nach der Änderung Exit0 und null bekannte Schwachstellen. Dies ist keine allgemeine Sicherheitszertifizierung.

Der neue enge JWT-Regressionstest reproduzierte vor der Korrektur tatsächlich die Akzeptanz eines abgelaufenen gecachten Tokens ohne optionales iat. Nachher wird ausdrücklich FAST_JWT_EXPIRED verlangt; der Uhrmock wird sicher zurückgesetzt. Das aktiviert keinen Cache in der Anwendung und behauptet weder ihre konkrete Ausnutzbarkeit noch einen Angriff. Offizielle Referenzen: https://github.com/advisories/GHSA-x937-hj6v-793p, https://github.com/advisories/GHSA-gxm5-99cw-xjw9, https://github.com/advisories/GHSA-68fv-2mgg-jv7q und https://github.com/advisories/GHSA-4p3w-j4w9-5jqw.

Gezielte Auth-, Upload-, Dokumentupload-, Applied-Snapshot-/PGmem- und Criticalpath-Gruppe: 176 bestanden, ein konkreter alter Druck-Heading-Assert fehlgeschlagen. Dieser und der angrenzende Herkunftstest erwarten jetzt das eine kanonische h3-Küchenblatt; negative interne-ID-Guards gelten für h2 und h3, die Tomaten-Anweisung wird exakt einmal verlangt. Herkunft, Publisher und URL bleiben geprüft. Acht betroffene Tests in zwei Dateien danach bestanden; keine Wiederholung der unveränderten 176. Finaler Build, beide Audits und git diff --check bestanden. Ein unabhängiger Reviewer nahm das Paket-/Sicherheitsdelta ohne materielle Befunde an; die präzisen harmlosen Assertionkorrekturen benötigen keine weitere Gesamtreview.

Tatsächliche erste vollständig grüne Gesamt-CI: 39084476486 auf fae89696ea934fbc82bf1b6fc0c9a2970d591011 ist SUCCESS. 432 Testdateien bestanden, eine übersprungen; 3.569 Tests bestanden, 21 übersprungen; reguläre Vitestdauer 2.288,74s (rund38 Minuten), zusätzlich64 Pythonprüfungen bestanden. Browser, Compose und macOS-Operator bestanden. Das ist der ältere Head vor 7c84ff6/57adea3 und ersetzt nicht die CI des späteren Releaseheads. 39086164314/57adea3 läuft separat weiter; dieses neue sicherheitsnotwendige Delta und die Druckassertkorrekturen werden gemeinsam einmal gepusht. Keine Läufe vorschnell abgebrochen.

Zusätzlich tatsächlich rein lesende Nürnberger Zugangs-/Bestandsprüfung: authentifizierte aktuelle Provider-/Firewallseiten, beide Operator-IP-Quellen, unveränderte Schlüsselmetadaten und Hostkeypins sowie eigene Locks bestanden. Beide Catering-Server identisch zu den genehmigten IDs/IPs; Nürnberg AN, Helsinki AUS. Sieben ursprüngliche Dienste laufen auf den angenommenen 5.413-Images, PG17.9, exakt drei erforderliche Geschäfts-/Alt-/Probe-Datenbanken neben Systemdatenbanken, keine externen Tablespaces oder vorbereiteten Transaktionen. Rund67,39GiB frei. Keine Hostmutation, Writerpause, Installation oder neue Datenübernahme durchgeführt.

Der aktuelle Zielbestand hat weder Restic noch Backup-/Restore-Units, Timer, Observerkonfiguration oder Backup-State. Das bestehende Repositoryskript wäre außerdem unzureichend: nur catering_agents, ohne Owner/ACL; Restore liest nur vier Tabellen. Ein unabhängiger Reviewer bestätigte diese konkrete Lücke und die wiederverwendbaren angenommenen Drei-DB-/Globals-/kalten PGDATA-/Dateivergleichsbausteine aus5.410. Alte Skripte sind wegen HEL-Bindung, echten Produktionsobjektnamen und globalem Docker-/Cron-Stopp NICHT unverändert auszuführen. Ein neuer begrenzter Lauf braucht aktuelle Dateiscope-/Imagebindung, nur eigene neue Probeobjekte, geschützte verschlüsselte Offhost-Sicherung, vollständigen Metadaten-/Datenvergleich und belegtes Cleanup. Ein Einmallauf allein belegt keine automatische Timer→Restore-/Observerkette.

Die nötigen bestehenden Offhost-/Recoverymaterialien sind im geschützten Originalarchiv vorhanden. Ihre bisherigen Attestationen gelten zeitlich bis11.11.2026, sind aber an den bisherigen Host/Scope gebunden; sie wurden nicht für Nürnberg umetikettiert oder automatisch erneuert. Neue Host-/Adress-/Scopebindung und heutige Ressourcen müssen vor einer echten Kette gültig vorliegen. Keine Secrets oder Rohkundeninhalte in Chat/Git/Reports.

Belege im bisherigen ignorierten tmp/product-pilot-20261018: dependency-security-*, release-npm-audit-*, ci-39084476486-completed.log, nue-current-provider-readonly-20261018.json, nue-current-backup-readiness.json, nue-backup-prerequisites-readonly.json und nue-backup-current-gap-proof.json. Gesamtziel ACTIVE, realer Pilot NO-GO. Nächste Schritte: neuer gebündelter Head mit vollständiger CI, zulässige Integration/Auslieferung, eigener vollständiger Nürnberger Backup/Restore-/Cleanup-/Monitoringnachweis und reale Fachentscheidungen. Helsinki bleibt ausgeschaltet und erhalten.

# Aktueller Produktstand — Version5.442 /18.10.2026

## 5.442 — 18.10.2026: nutzbare Küchenausgaben und deutsches Excel-CSV

Produktionsblatt und Produktionsmappe verwenden ausschließlich eingefrorene Plan-/Apply-Daten für Küchenmengen, Allergene, Station, Vorbereitung und Anweisungen. Identische Anweisungen aus Batch und Küchenblatt erscheinen einmal; zusätzliche Batchanweisungen und Zutaten bei leerem Küchenblatt bleiben erhalten. Allergenangaben tragen ausdrücklich den Vorbehalt zu Lieferantendeklaration/Kreuzkontakt, keine neue Fachfreigabe. Der gefrorene Batch-Verlustfaktor hat Vorrang vor später geänderten Rezeptmetadaten und ist klar als Metadatum ohne behaupteten eingerechneten Zuschlag bezeichnet. Mengen und Kalkulation bleiben unverändert.

Der vorhandene CSV-Endpunkt erhält optional format=excel-de: UTF-8-BOM, Semikolon, Dezimalkomma, elf beschriftete Spalten, präzise Mengen und zusätzliche Küchenumrechnung (0,002 kg = 2 g). Die normale Oberfläche einschließlich archivierter Aufträge verwendet dieses Format. Der bisherige Standard-CSV-Vertrag bleibt erhalten. Excel-Zellen mit formelauslösenden Präfixen werden neutralisiert; Operator-/Geschäfts-/Apply-Snapshotgrenzen bleiben wirksam, unbekannte Formate werden abgewiesen.

Tatsächliche lokale UI-Nachprüfung am ursprünglichen abgeschlossenen 100-Gäste-Referenzfall (01:05:39): Historie geöffnet, Produktionsblatt, Produktionsmappe und Einkaufsliste über ihre normalen Links exportiert. Neun Küchenblätter/neun Rezeptkarten, 55/25/20 Portionen und 2 g Zimt erhalten. Alle 29 CSV-Positionen mit elf Spalten unabhängig mittels Python-csv/Decimal gegen die eingefrorenen normalisierten/Einkaufsmengen und Rezept-IDs verglichen. Alle13 ursprünglichen Referenzquellen bytegleich. Browser-PDFs mit CSS-A4: Produktionsblatt fünf Seiten, Mappe13 statt zuvor18 Seiten; alle18 gerenderten Seiten auf Kontaktbögen visuell geprüft, keine abgeschnittenen Überschriften/Tabellen oder fehlenden Rezeptkarten beobachtet. Kurze Rezeptkarten teilen Seiten. Historische fehlende Kundenkennung wird nicht nachträglich erfunden.

Gezielte Prüfungen wiederverwendet: ursprüngliche sechs betroffene Dateien 54 Fälle; die konkreten Zähler-/URL-Erwartungen korrigiert und betroffene Applied-Snapshot-/Routen-/UI-Zustandsgruppen nachgeprüft. 26 von27 Fällen im Zwischenlauf bestanden, einzige verbliebene URL-Erwartung danach in allen vier Zustandsfällen bestanden. Nach unabhängig gefundenem Stations-/Anweisungsverlust 35 betroffene Druck-/XSS-/Präzisionstests bestanden. Gruppen überlappen und werden nicht addiert. Finaler Build und git diff --check PASS. Unabhängige Review nahm CSV-/Allergen-/Faktor-/Zugriffsdelta sowie die konkrete consequential Druckkorrektur ohne verbleibende materielle Befunde an. Keine neue vollständige Produktreviewrunde.

Belege im bestehenden ignorierten tmp/product-pilot-20261018/kitchen-exports-*, insbesondere browser-proof.json, gezielte Logs und finaler Build. Sichtbare synthetische Unterlagen output/playwright/CateringOS-SYNTHETISCH-100-Produktionsblatt.pdf und CateringOS-SYNTHETISCH-100-Produktionsmappe-kompakt.pdf. Tatsächliches Opus-5.5-Gesamtreview aus5.439 bleibt gültig; dieses begrenzte Folgeinkrement ist unabhängig geprüft.

CI-Korrektur:39083127291/c408b72 endete regulär nach rund38 Minuten mit denselben neun bereits im späteren fae8969 korrigierten Regressionen; kein Hänger.39084476486/fae8969 läuft beim Abgleich weiterhin, Browser/Compose/macOS PASS. Das lokale7c84ff6 und dieses verwandte Druck-/CSV-Inkrement werden einmal gemeinsam gepusht; maßgeblich bleibt anschließend die erforderliche automatische CI des tatsächlichen neuen Heads. Kein Gesamt-CI-PASS, Merge oder Nürnberg-Deployment behauptet.

Gesamtziel ACTIVE, realer Pilot NO-GO. Nächster Schritt ist der gebündelte Push mit vollständigem CI-Ergebnis, anschließend zulässige Integration/Auslieferung. Offene Mengenempfehlungs-/Stations-/T-1-/Lieferantenentscheidungen und reale Preis-/Steuer-/Küchen-/Allergen-/Temperaturfreigaben bleiben sichtbar; eigener Nürnberger Backup→Restore→Cleanup-/Monitoringnachweis offen. Historische Angebote und Lexwarequellen bleiben die Recherchegrundlage, kein vollständiges Rechnungsarchiv behauptet. Helsinki OFF/erhalten; keine Host-, DNS-, ADH- oder Löschaktion.

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
