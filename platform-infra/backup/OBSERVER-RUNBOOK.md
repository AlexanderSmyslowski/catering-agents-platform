# Catering-Beobachter: Installation und kontrollierter Betriebsstart

Stand: 13.09.2026. Repository-Kandidat; **keine Installations- oder
Aktivierungsfreigabe**. Der bestehende Drei-Stunden-Timer und die Folge
`catering-backup.service` → `OnSuccess=catering-restore-probe.service` bleiben
unverändert. Zeiterfassung wird nicht verändert.

Der unabhängig geprüfte lokale Grundplan bleibt führend:
`~/.codex/local-evidence/catering-finalconfig-0jae6hqe/catering-operations-activation-plan.md`,
SHA-256 `10c6b007603eeabb90cb590731e3b1a0eaba808a38aff6b3c8fa0907596cba98`.
Dieses Runbook konkretisiert dessen Beobachterdelta, keine neue Architektur.

## Beobachtervertrag

`catering-backup-observer.py --check` liest ausschließlich kleine geschützte
lokale Records und systemd-Metadaten. Ohne `--check` publiziert er zusätzlich
seinen eigenen begrenzten Zustand und sendet höchstens einen HTTPS-Aufruf.
Er führt weder Docker, Restic, Dump, Restore noch Reparaturen aus und liest
keine Datenbank-, Dokument-, Archiv- oder TLS-Inhalte.

Die gemeinsame Bibliothek stellt dieselben festen Recordschemas, begrenzten
Leser und den atomaren/fsync-Publisher bereit, die der Restore verwendet.
Nur diese reinen Helfer wurden aus dem operativen Restore-Einstieg verschoben.
Der Beobachter prüft Evidence → Artifact/Receipt und Repositorystatus,
Source-/Host-/Repository-/Scope-/Recovery-/Imagebindungen sowie die gespeicherten
Stream-/Komponentendigest-Beziehungen. Dies ist keine erneute Prüfung der
verschlüsselten Remoteobjekte oder der Archivbytes.

Ein Candidate allein ist kein Erfolg. Ein neuer Candidatepointer darf während
des nächsten Zyklus vor der noch gültigen finalen Evidence liegen. Ein neuer
Dienstfehler überstimmt den alten Erfolg; seine Zeit bleibt gesperrt, bis ein
später gesicherter Datenstand vollständig wiederhergestellt wurde. Wiederholte
Auswertung derselben Sperre verschiebt diese Zeit nicht. Neue Reader-/Netzfehler
werden als solche behandelt, nicht als erfundener Produktionsfehler.

Auch ein erstmals in der letzten Dienstabfrage erkannter Ausfall wird vor dem
Abbruch mit dem vorhandenen Publisher als kritischer Zustand gespeichert.
Fehlerzeitpunkt und bereits gespeicherte Uhrmarke werden dabei nicht gesenkt.
Scheitert die Veröffentlichung, bleibt der Lauf fehlgeschlagen und sendet
kein Signal; er behauptet weder dauerhafte Vormerkung noch vollständige
Rücknahme. Nach einem Fehler nach Dateiaustausch kann die Dauerhaftigkeit
ungeklärt sein. Alte Evidence allein hebt die erfolgreich gespeicherte Sperre
nicht auf; erst ein späterer vollständig gebundener Nachweis erlaubt Recovery.

Geprüfte Grenzen: Datenalter 21600 Sekunden; Backup 1800, Restore 7200,
Timer-Accuracy 60 plus insgesamt 240 Dispatchsekunden; vollständige neue
Evidence und beendete Dienste spätestens 9300 Sekunden nach Fälligkeit.
Die eigenen Zyklusbudgets bleiben auch über die nächste Kalendergrenze wirksam.
Die technischen Originaltimeouts 3600/14400 Sekunden werden nicht geändert.
Attestationen werden auf die gebundenen festen Felder, Schema, Hash,
Zeitgültigkeit und Recoverysemantik geprüft. Die Vorwarnung beginnt spätestens
48 Stunden vor Ablauf; keine Verlängerung, keine neue DNS-/Repositoryabfrage.

Der JSON-Ausgang trennt `backup_health`, `observer_run`, `reason`,
`delivery_accepted`, `recipient_confirmed=false` und
`remote_repository_checked=false`. HTTP 200 belegt Annahme des Signals,
keinen Empfang durch Alexander. Ein angenommener `/fail`-Aufruf belegt
Erreichbarkeit, aber keinen Backuperfolg. Der eigene Status ist kein Ersatz
für autoritative Backup-Evidence und kein Zustellreceipt.

## Noch zu bindender Better-Stack-Bestand

Vor Installation im vorhandenen Konto/Team genau **Catering Backup Timer** lesen:
ID, Typ, Status, period, grace, Wartungsfenster, Eskalationsregel/Wartezeit,
zugeordneter Empfänger und bestehende Signalquelle samt Erfolgsbedingung.
Der Name allein erlaubt keine Umwidmung zu einem Beobachter-Lebenszeichen.
Ein zweiter Writer auf demselben Heartbeat ist auszuschließen. Bestehende
Zeiterfassungschecks bleiben unverändert. Keine Monitoranlage oder Tarifänderung.

Noch nicht belegte Kontoangaben bleiben offen. Ein zusätzlicher Check ist nur
bei konkret fehlender separater Beobachterverfügbarkeitsaussage und belegter
freier Kontokapazität vorzulegen; er wird nicht automatisch vorausgesetzt.

Für Datenzeitpunkt `created_at` ist `D=created_at+21600`. Die letzte zulässige
Startzeit eines Gesundheitspings ist strikt kleiner als

`min(D, attestations_valid_until−172800)−(T+H+G+P+E+C)`.

T ist das begrenzte Requestbudget (1–15 Sekunden), H/G der tatsächliche
Heartbeatvertrag, P zusätzliche Anbieter-Erkennungsverzögerung, E die
Eskalationswartezeit und C die begründete Uhrreserve. Wiederholungen desselben
Records ändern D nicht. Terminale Prüfung und worker-seitige Prüfung nach dem
TLS-Aufbau sperren späte Gesundheitssignale. Der eigene dauerhafte Uhrstand
verhindert das erneute Öffnen eines beobachtet geschlossenen Fensters durch
einen Rücksprung. Nicht synchronisierte Uhr ist ein Fehler.

**Die rechnerische Frist ist bedingt:** NTP-Synchronisation allein beweist keine
numerische maximale Uhrabweichung. Ein Clienttimeout garantiert weder maximale
Annahmeverzögerung auf dem Server noch eine Anbieter-/E-Mail-Zustellzeit. P/C,
Kontofristen und Eskalationsweg müssen vor Aktivierung belastbar eingeordnet
sein. Unbelegte Werte nicht als Garantien in `policy.json` eintragen. Für die
tatsächliche Zustellung ist zusätzlich der unten geplante Empfangstest nötig.
Ein Beobachterausfall kurz vor der Datenfrist ist durch das frühe Ende
zulässiger Pings im bedingten Fristmodell berücksichtigt.

## Geschützte Installationsartefakte

Nur nach separater Freigabe und aus **tatsächlich gemergten Git-Blobs**:

| Quelle | Ziel | Eigentümer/Modus |
| --- | --- | --- |
| catering-backup-observer.py | /usr/local/libexec/catering-backup-observer.py | root:root 0755 |
| catering-backup-common.sh | /usr/local/libexec/catering-backup-common.sh | root:root 0755 |
| catering-restore-probe.sh | /usr/local/libexec/catering-restore-probe.sh | root:root 0755 |
| catering-backup-monitor.cron | zunächst außerhalb /etc/cron.d geschützt bereitstellen | root:root 0644 |
| gebundene Policy | /etc/catering-backup-monitor/policy.json | root:root 0600 |
| vorhandene Heartbeat-URL, nur hostintern | /etc/catering-backup-monitor/heartbeat-url | root:root 0600 |
| eigener Zustand und Lock | /var/lib/catering-backup-monitor/{state,lock} | root:root 0600 |

Beide Monitorverzeichnisse root:root/0700, echte Verzeichnisse ohne Symlinks.
Keine mehrfach verlinkten Dateien. `catering-backup.sh` und Originalunits
bleiben bytegleich und werden nicht neu installiert. Eigene betroffene
Vorzustände geschützt sichern; atomarer Dateiaustausch und Datei-/Verzeichnis-
fsync nach dem vorhandenen geprüften Installations-/Rücknahmeverfahren.
Erforderliche Source-Commit/Tree-Felder kontrolliert auf den späteren Merge
binden; übrige ENV-Felder erhalten und ENV ausschließlich als Daten lesen.
Historische Evidence, Fragmente und Attestationslaufzeiten nicht umetikettieren.

Die Policy hat Version 1, absolute getrennte `root`/`state_root` und genau
folgende `bindings`: scope, host_binding, source_commit, source_tree,
repository_identity, secret_recovery_reference_sha256, restore_postgres_image.
Unter `attestations` stehen `offhost`/`secret` jeweils mit path, sha256 und
`fields` (alle festen vorhandenen Felder außer verified_at, valid_until,
attestation_id). Unter `heartbeat`: belegte id/team/meaning
`backup_restore_health`, account_verified, period, grace, provider_delay,
escalation_delay, clock_margin, request_seconds sowie url_file/url_sha256.
Alle Fristwerte sind ganze Sekunden. Kein Token und keine URL im Policytext.
Die URL-Datei enthält genau den gebundenen HTTPS-Pingendpunkt plus LF.
Secrets weder in argv, Environment, Trace, Git noch Berichte übertragen.
Keine Redirects/Proxies; TLS-Zertifikat und Hostname werden geprüft.

Initialer eigener Status, ohne erfundenen Erfolg, mit abschließendem LF:

```text
status=observer
last_seen_epoch=0
failure_epoch=0
delivery_accepted=false
backup_health=unknown
```

Der Lock ist eine leere Datei. Ein vorhandener eigener Zustand wird erhalten.
Nicht neu initialisieren, um eine Uhr- oder Fehlersperre zu umgehen.

## Begrenzte Ausführungsfolge nach separater Freigabe

1. Merge/Tree/Blobhashes, Host, geschützte Konfiguration, unveränderte Original-
   units und fehlende konkurrierende Writer frisch prüfen. P2-Konto-/Fristweg
   und P3-Ressourcenlücke müssen geschlossen sein. Keine Installation bei
   unbekanntem Monitorziel oder nicht zugeordneten Restore-Resten.
2. Nur die Tabelle oben installieren; Cron bleibt inaktiv. Keine neue Unit:
   bei weiterhin `NeedDaemonReload=no` ist kein daemon-reload erforderlich.
   `sudo -n /usr/bin/timeout --kill-after=5s 115s /usr/bin/python3 -I
   /usr/local/libexec/catering-backup-observer.py --check` als einen Befehl
   ausführen. Historische alte Evidence muss ehrlich ungesund/HOLD bleiben.
3. Im konkreten Konto prüfen, wie der vorhandene pending-Heartbeat vor dem
   ersten Erfolg auf `/fail` reagiert. Ohne Nachweis keine bereits wirksame
   Ausbleibeüberwachung behaupten. Kein synthetischer Erfolgsping zum Aktivieren.
4. Nach expliziter Alarmtestfreigabe ein angekündigtes Testfehlersignal über
   den gebundenen Cateringweg; Production-Evidence unverändert. HTTP-Annahme,
   Incident-ID/UTC und Alexanders Empfangsbestätigung getrennt sichern.
   Keine neuen Empfänger, SMS oder Anrufkanäle. Bei stale Evidence darf der
   normale Beobachter ohnehin nur Fehler signalisieren.
5. Den geprüften Cron unter `/etc/cron.d/catering-backup-monitor` atomar
   scharfschalten: alle fünf Minuten, Gesamtgrenze 115 Sekunden TERM plus
   fünf Sekunden KILL. Eigener flock verhindert Parallelität. Der Beobachter
   beendet seine eigenen Helfergruppen auch bei Timeout/TERM; kein Retry.
   Bei pending ohne bewiesene Alarmierung bleibt persönliche Begleitung nötig.
6. Vor Originaltimerstart freie Bytes/Inodes/MemAvailable und Fremdjobs frisch
   nach Grundplan prüfen. Mögliches Persistent-Catch-up berücksichtigen; bis
   zum nächsten regulären Termin müssen mindestens 9300 Sekunden bleiben.
   Genau einmal `sudo -n systemctl enable --now catering-backup.timer`.
   Kein zusätzlicher Backup-/Restorestart. Bei SSH-Abbruch nur vorhandenen
   Ablauf lesen. Alle 15–30 Sekunden Metadaten/Übergänge verfolgen.
7. Beide Invocation-IDs, UTC/monotone Laufzeiten, Budgets, vollständige neue
   Snapshot-/Source-/Receipt-/Statuskette, atomare finale Evidence und Cleanup
   nach Grundplan prüfen. Recovery auf dem vorhandenen Heartbeat erst aus
   diesem tatsächlich gesunden Zustand; Incident-Recovery und Alexanders
   Empfang getrennt belegen. Kein umfassender Geschäftsdatengleichheitsnachweis.
8. Ausbleibetest nur bei genügend verbleibender Datenfrist: eigenen Cron im
   vereinbarten Testfenster aussetzen, Anwendungen/Backups laufen lassen.
   Ausbleibeincident und Empfang bestätigen, dann Cron wiederherstellen.
   Recovery wieder nur nach gültiger vollständiger Beobachterprüfung.

## Ressourcen und Rücknahme

Produktivzählung: ursprüngliche Ersatzbasis 3181, bestätigter Vorstand 3511,
jetzt 3877 inklusive Beobachter, gemeinsamem Helferdelta und Cron. Das sind
696 kumulativ seit der ursprünglichen Basis und 366 seit dem Vorstand;
gegenüber dem ersten Kandidaten 3870 kommen sieben Zeilen hinzu. Vom
ausdrücklich genehmigten Gesamtdeckel 3911 bleiben 34 Zeilen. Tests und
Dokumentation zählen separat; keine historische Basis wurde zurückgesetzt.

Die bestehende synthetische Werkzeug-CI ist auf den eindeutigen Branch
`codex/catering-betterstack-observer-20260913` und das konkrete Draft-PR-
Ereignis gebunden. Positive ganzzahlige PR-Nummer, Übereinstimmung beider
Eventnummern und `refs/pull/<number>/merge`, beide Repositoryidentitäten,
`main`-Base, sauberer exakter Event-Head und GitHub-hosted Linux bleiben
Pflichtprüfungen vor Werkzeugbeschaffung. Die tatsächliche Nummer/Head/Tree
wird im Laufnachweis festgehalten. Das ersetzt den historischen PR-690-Filter;
der datierte Branch darf für keinen anderen Auftrag wiederverwendet werden.
Kein zusätzlicher Workflow, Produktionszugang oder manueller Dispatch.

Die Messung vom 13.09.2026 09:22 UTC ist eine Momentaufnahme:
2.229.190.656 MemAvailable-Bytes, 397.840.384 freie Runtime-Bytes.
Restorezulassung bei K=4096: 309.403.648 Bytes, 20.002 Inodes,
846.274.560 MemAvailable. B/P/M/R/J bleiben
100663296/268435456/536870912/67108864/10000.

**P3 bleibt offen:** gemeinsamer Speicher-/I/O-Spitzenbedarf einschließlich
Anwendungen, halbstündlichem Zeiterfassungsbackup, Wartung bis etwa 05:01,
Quartalsrestore gegebenenfalls über 06:00 und zeitlich unbegrenztem EventOS-Job
ist nicht gemessen oder vollständig begrenzt. M begrenzt nur den Probecontainer.
10,086/11,85 Sekunden Einzel-Laufdauer und freie Startwerte beweisen keine
gemeinsame Reserve. Die kleinste nötige Ergänzung ist numerische vorhandene
Telemetrie über natürliche Überlappungen; fehlt sie, separat freizugebende
begrenzte Messinstrumentierung. Keine Lasttests oder Zeitplanänderungen hier.

Rücknahme: `sudo -n systemctl disable --now catering-backup.timer` verhindert
künftige Timerstarts, beendet aber keine schon laufende Backup-/OnSuccess-/
Restorekette. Diese weiter eindeutig zuordnen und nach Grundplan begleiten.
Keine Evidence, Daten, Kandidaten oder Timerstempel löschen. Bei Fehler im
Beobachter nur seinen Cron deaktivieren und ausschließlich eigene gesicherte
Artefakte kontrolliert zurücknehmen; fehlende Überwachung ausdrücklich melden.
Keine globale Bereinigung, kein Ersatzlauf. **HOLD BEFORE TIMER ACTIVATION
AND PHASE 3** bleibt bis zur separaten Betriebsentscheidung bestehen.
