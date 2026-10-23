# Checkpoint 5.541 — 23.10.2026

Der serverlokale vollständige NUE-Backupdienst ist in PR750 implementiert.
Er verwendet den bestehenden Cold-Capture-/Restorekern für alle drei Datenbanken,
Globals/Rollen/Verifier und acht Dateibäume. Ein einzelner Dienstlauf verbindet
Capture, Wiederanlauf, Offhostbackup, authentifizierten Readback, isolierten
Restore/SQL-/Dateivergleich und eigenes Cleanup. Bestehende Service-/Timernamen
bleiben erhalten; keine neue Prüfplattform und kein OnSuccess-Doppelrestore.
Der zugehörige [Installations-/Recoveryweg](../../platform-infra/backup/NUE-FULL-BACKUP.md)
verlangt einen echten manuellen vollständigen Service-PASS vor Timeraktivierung.
Dienst und Restic sind noch nicht auf Nürnberg installiert; ein automatischer
Betriebsnachweis oder eine Observerabnahme liegt damit nicht vor.

## Tatsächlich angenommener manueller D7-Nachweis

Die aktuelle Koordinatorübergabe bestätigt Run
`0f34717c1c2405543135c50b502924a8` am23.10.2026 um08:21:51UTC als vollständigen
manuellen Backup-/Offhost-/isolierten Restore-/Vergleich-/Cleanup-PASS mit
unabhängiger Annahme. Installiertes Manifest:
`d7a6b39ae9631ef28e332c1e9841c55406b2d81c4730db4b06ad5e0100c64151`.
Diesen Nachweis nicht als tatsächlichen Durchlauf des neuen systemd-Dienstes ausgeben.
Historische Runbookzeilen, die denselben Lauf noch aktiv nennen, sind überholt;
die dortigen alten Ausführungsbefehle werden nicht erneut gestartet.

## Enger Folgefix nach erfolgreicher bisheriger PR-CI

Der bisherige PR750-Stand hat vollständige Pflicht-CI SUCCESS. Danach meldete der
automatische Review einen echten P1: Die offizielle unabhängig signaturgeprüfte
Linux-amd64-Restic-0.19.0-Binary hat30.924.962Bytes; der generische geschützte
Reader erlaubte nur16MiB. Damit blieb bereits die initiale Admission gesperrt.

Nur die feste Binary `/usr/local/bin/restic` erhält jetzt ein64MiB-Limit in der
initialen Dateibindung und den späteren Unveränderlichkeitsprüfungen. Exakter
SHA256, Rootschutz, nlink1 und Metadatengeneration bleiben Pflicht; Version,
Plattform und `--stdin-from-command`-Capability bleiben unverändert gebunden.
Alle anderen Dateien behalten ihre bisherigen kleineren Readergrenzen;
insbesondere bleibt die separate Passwortlesegrenze4096Bytes.

Ein gezielter Regressionstest liest und hasht eine tatsächliche30.924.962Byte-
Datei, prüft die Laufzeitbindung und verwirft falschen Hash, eine andere Datei
sowie eine Resticdatei oberhalb64MiB. Lokaler Einzeltest PASS. Das ist ein
synthetischer Readernachweis, kein Host-/Repository-/Servicelauf.
Die bestehende CI-Einbindung führt die Pythonregressionen weiterhin automatisch
im unveränderten vollständigen Vitestumfang aus. Neue CI und unabhängige
Deltaabnahme dieses Folgefixes stehen bei diesem Checkpoint noch aus.

Keine neue Installation, Timer-, DNS-, IP-, ADH-, Observer- oder Produktaktion
ist Teil dieser Fortschreibung. Reale fachliche Pilotfreigaben bleiben getrennt.
