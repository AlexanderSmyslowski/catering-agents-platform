# Nürnberg: vollständige serverlokale Sicherung

Der optionale Nürnberger Beobachteranschluss steht in
[OBSERVER-RUNBOOK.md](OBSERVER-RUNBOOK.md). Er verwendet die bestehenden
Vollnachweise und denselben begrenzten Sender. Ohne explizite `observerFiles`-
Hashbindungen bleibt jeder Beobachter-Cron gesperrt. Mit Anschluss muss vor
Aktivierung ein neuer vollständiger Dienstlauf mit tatsächlicher
`serviceInvocation`-Bindung angenommen werden; alte Nachweise werden nicht
nachträglich ergänzt. Produktimages, Datenbanken, bestehende Konten und der
Drei-Stunden-Timerplan werden dadurch nicht geändert.

Dieses Paket führt einen einzigen zusammenhängenden Dienstlauf aus: vollständiger
Cold Capture, Wiederanlauf der sieben Originalcontainer, Restic-Offhostbackup,
authentifizierter Repository-ID-Vergleich, kompletter Readback mit SHA256/Bytevergleich,
isolierter PostgreSQL-Restore mit SQL-/Globalsvergleich, Metadatenvergleich aller acht
Dateibäume und Cleanup der eigenen Proben/tmpfs. Der Timer bleibt bei der Erstabnahme
inaktiv. Es gibt keinen zweiten Restore über `OnSuccess`.

Der Core stammt aus dem mehrfach geprüften `nue_backup_once.py`, SHA256
`5250a27c00b7845f2ff945558ac9993d7b46905745785976216e7370b473127e`.
Die Änderungen daran sind Mount-Namespace-Prüfung, optionales enges Scheduler-Gate,
injektierbarer Restore-Stream und ein reiner Stream-CLI. Ohne Scheduler-Gate verlangt
`assert_current` weiterhin die Abwesenheit aller drei bisherigen Backup-/Restoreunits.
Die bisherigen Ein-DB-Skripte und Units bleiben als historische Quellen erhalten.
Sie sind für Nürnberg keine vollständige Sicherung und werden nicht installiert.

## Verbindliche Installation in zwei Phasen

Die folgenden Befehle sind ein konkreter Installationsweg für einen gesondert
freigegebenen Hostschritt, keine automatische Deployment- oder Timerfreigabe.
Vor einer Betriebsinstallation ist der aktuelle D7-Stand mit dem vorhandenen
manuellen Verfahren vollständig zu sichern, offhost rückzulesen, isoliert
wiederherzustellen und unabhängig abzunehmen. Lock-/Rollback-/Zugangsvorgaben der
bestehenden Betriebsübergabe gelten weiter. Keine bereits installierte Datei
ungeprüft überschreiben; abweichende Bestände sind HOLD und brauchen eine eigene
geprüfte Änderung mit Rückfallkopie.

1. Im angenommenen Patch `python3 -I -B -m unittest discover -s platform-infra/backup/tests -v`
   ausführen. Die unabhängige Patchprüfung muss insbesondere den absichtlich
   hostweiten Root-/Dockeradminservice akzeptieren. Der Host braucht eine separat
   geprüfte offizielle signierte und gehashte Restic-0.19.0-Linux-amd64-Installation
   unter `/usr/local/bin/restic`. Ubuntus Apt-Kandidat 0.16.4 unterstützt den
   benötigten `--stdin-from-command`-Vertrag nicht. Die gesondert freigegebene
   Erstinstallation überschreibt keinen Apt-Pfad. Der Job prüft die gepinnte
   Binary, genaue Version/Plattform und das tatsächliche `backup --help` vor
   seiner ersten Mutation. Das Paket installiert keine Programme und
   initialisiert kein Repository.
2. `nue-service.json.example` in einem geschützten lokalen Arbeitsbereich konkret
   ausfüllen. Platzhalter und leere Baselines sind absichtlich nicht ausführbar.
   `installedSnapshot` ist der **bereits geprüfte** aktuelle `snapshot()`-Wert des
   gepinnten installierten Updatehelpers: Container-IDs/Images/Mounts/Restart/Ports/
   Netze/Environmenthashes, Konfigurationshashes, fünf Volumes, Netze, Catalogue/
   Schema3. Ein Live-Snapshot darf verglichen, nicht ungeprüft als neue Wahrheit
   übernommen werden. Für `expectedCore.containers` die sieben erwarteten Bindungen
   als Liste mit `name`, `id`, `image`, `mounts`, `restart` aus derselben angenommenen
   Baseline übernehmen. `runtimeEnvSha256` und die vollständige `files`-Map werden
   explizit gepinnt. Nach jedem Produktupdate oder Credentialwechsel ist ein neuer
   geprüfter Konfigurationsstand erforderlich; automatische Neuanlernung gibt es nicht.
3. Die vorhandenen Offhost-/Recovery-Attestationsbytes unverändert erhalten.
   Pfade dürfen auf die tatsächlich bestehende geschützte Generation zeigen;
   Beide Attestationen liegen in derselben geschützten Generationsablage; deren
   Verzeichnis ist die lexikalische Rootgrenze des gemeinsamen Validators.
   `files` und die Pfadfelder müssen exakt zusammenpassen. `verified_at` und
   `valid_until` nicht umdatieren. Der gemeinsame Validator prüft Live-DNS und
   Hostadressen; `21600` bedeutet **mindestens sechs Stunden Restgültigkeit**,
   keine Höchstaltersgrenze. Die bisherige Gültigkeit bis 11.11. bleibt bestehen.
4. Aktuelle Offhostcredentials separat rootgeschützt bereitstellen. Die JSON-Datei
   darf genau `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_DEFAULT_REGION`
   mit nichtleeren Stringwerten enthalten. Das bestehende Resticpasswort bleibt in
   einer separaten Datei. Beide Mode0600, Root, nlink1, keine Symlinks und geschützte
   Eltern; niemals Werte in Befehlszeilen, Git, Logs oder Reports übernehmen.
   SHA256 beider Dateien und ein bewusster Generationstoken binden dieselbe geprüfte
   Credentialgeneration wie Runtimeenv und Attestationen. Das Passwort wird Restic
   ausschließlich über einen geerbten FD übergeben, AWS nur über eine feste Env-Allowlist.
5. Zunächst `timerState: "inactive"` verwenden. Vor Installation alle Zielpfade und
   fehlende Units prüfen. Die vorhandene `/etc/catering-backup`-Ablage muss Root gehören
   und darf nicht von Gruppe/anderen beschreibbar sein. Aus dem separat verifizierten
   Patchverzeichnis nur folgende Dateien installieren:

   ```sh
   install -o root -g root -m 0755 platform-infra/backup/catering-nue-core.py /usr/local/libexec/catering-nue-core.py
   install -o root -g root -m 0755 platform-infra/backup/catering-nue-service.py /usr/local/libexec/catering-nue-service.py
   install -o root -g root -m 0600 platform-infra/backup/catering-backup-common.sh /usr/local/libexec/catering-backup-common.sh
   install -o root -g root -m 0644 platform-infra/backup/catering-nue-backup.service /etc/systemd/system/catering-backup.service
   install -o root -g root -m 0644 platform-infra/backup/catering-backup.timer /etc/systemd/system/catering-backup.timer
   ```

   Die Quellen und Zielbytes müssen zu den unabhängig angenommenen `files`-Hashes
   passen. Die ausgefüllte, geprüfte Konfiguration als
   `/etc/catering-backup/nue-service.json`, Root0600/nlink1, installieren. Daneben
   `/etc/catering-backup/nue-generation.json`, ebenfalls Root0600, mit genau
   `{"configSha256":"<SHA256 der exakten Konfigurationsbytes>","credentialGeneration":"<derselbe geprüfte Generationstoken>"}`
   installieren. Generation/Config/Dateien werden mit Metadatengeneration und Hash
   vor und während des Laufs geprüft. Keine fremde Update-/Recoverysperre entfernen.
6. `systemctl daemon-reload` und `systemd-analyze verify /etc/systemd/system/catering-backup.service /etc/systemd/system/catering-backup.timer`
   ausführen. Timer **nicht** starten/aktivieren. Genau einen manuellen normalen
   `systemctl start catering-backup.service` ausführen. Der Dienst prüft vor der
   ersten Dateierstellung den installierten Releasehelper, den normalen `verify`
   mit unverändertem historischem Receipt, die volle genehmigte Baseline, Namespace,
   Unitbytes/Dropins, echte systemd-Invocation/MainPID/cgroup, Cron, Credentials,
   Repositoryauthentifizierung und Attestationen.
7. Nur `service-proof.json` mit Status
   `FULL_BACKUP_OFFHOST_READBACK_RESTORE_CLEANUP_PASS` unter dem tatsächlichen
   `/var/lib/catering-nue-proof-<runId>` sowie erfolgreiches Dienstende, beide
   Cleanupbelege und sieben gesunde Originalcontainer bilden die manuelle technische
   Abnahme. Der historische Updatehelper meldet weiterhin
   `automaticBackupRestoreChainAccepted:false`; dieser Wert wird nicht verändert.
   Zusätzlich muss die neue Dienstabnahme unabhängig bestätigt werden.
8. Timeraktivierung ist ein **gesonderter freigegebener** Schritt nach diesem PASS.
   Erst dann die geprüfte Config auf `timerState:"active"` umstellen, den
   Config-SHA im Generationmarker aktualisieren und den vorhandenen 3h-Timer
   `catering-backup.timer` aktivieren. Der Timerplan selbst bleibt unverändert.
   Das Paket führt diesen Schritt nicht aus. Bei Wartung den Timer deaktivieren
   und den erwarteten Configzustand bewusst passend ändern; ein unerwarteter
   Timerzustand bleibt HOLD.

## Schutz und Recovery

Keine `ProtectSystem`, `ProtectHome`, `PrivateTmp`, `ReadWritePaths` oder andere
mountenden Sandboxdirektiven hinzufügen: der Dockerdaemon muss dieselben tmpfs-
Hostpfade sehen. `PrivateMounts=no` oder `MountFlags=shared` reparieren einen schon
privaten Namespace nicht. Vor jeder mutierenden Phase müssen die Mount-Namespace-
Inodes des Prozesses und PID1 übereinstimmen; kein `nsenter` oder Propagationstrick.
Siehe [systemd.exec](https://www.freedesktop.org/software/systemd/man/latest/systemd.exec.html).
Die alten Sandboxunits waren auf diesem Ziel nie installiert. Die neue Unit ist
ein ausdrücklicher Root-/Dockeradminservice mit festen Pfaden, Rootschutz,
Hash-/Generationsbindung, NoNewPrivileges und UMask0077; die Restorecontainer behalten
Netzwerkisolation, Ressourcenbegrenzung, Capabilitiesentzug und eigene Labels.

Der Job hat 90 Minuten Arbeitsbudget, danach dieselbe geordnete Recovery wie bei
SIGTERM. Der Core stellt eigene gestoppte Originalcontainer und Restartpolicies
wieder her. Bekannte Restic-/Producerprozesse werden als eigene Prozessgruppe
beendet; der direkte Kindprozess wird gewartet. Child-Kommandos haben eigene
Fristen. systemd lässt bis zu 15 Minuten Stop-Recovery zu (`KillMode=mixed`).
Ein harter Kill oder nicht bestätigbarer Dockerstop kann die sichere Recovery
unterbrechen: dann ist `OWNED_RECOVERY_HOLD` bzw. ein fehlender PASS ehrlich offen.
Es gibt keinen `ExecStopPost`, der fremde oder unbestätigte Guards entfernt.

Bei HOLD zuerst ausschließlich den konkreten Run und seine vorhandenen
`original-state`, Capture-, Resume-, Restore- und Cleanupbelege lesen. Einen noch
vorhandenen `/opt/catering-target-update.lock` niemals durch Neustart, Fremdcleanup
oder geliehene Run-ID umgehen. Ohne belegten Wiederanlauf bleibt die Sperre stehen.
Ein neuer Lauf setzt eine abgeschlossene eigene Recovery voraus. Tmpfs enthält
sensible Daten und wird nur bei nachgewiesenem Eigentum/unveränderten Probelabels
unmountet; Belege enthalten keine Passwörter/SQLdumps. Kein automatisches Forget,
Prune, Repository-Unlock, Retentionumbau oder Löschen fremder Daten.

Die lokalen synthetischen Tests ersetzen keinen tatsächlichen Service-/Offhost-/
Docker-Restoredurchlauf. Installation, echter Dienstnachweis, Timeraktivierung und
spätere Observerabnahme bleiben getrennt, bis ihre tatsächlichen Belege vorliegen.
