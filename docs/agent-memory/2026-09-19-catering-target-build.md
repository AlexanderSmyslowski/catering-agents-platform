# Catering-Zielaufbau — geprüft am 19.09.2026

## Ergebnis und Grenze

Der isolierte Zielstand ist aufgebaut; Datenkopie, externe Sicherung,
isolierter Restore und gekennzeichneter E-Mail-Test sind nachgewiesen.
**HOLD BEFORE PRODUCTION CUTOVER AND AUTOMATIC JOB ACTIVATION.**
Keine öffentliche DNS-/Proxyroute und keine alte Anwendung wurde geändert.
Der alte Host bleibt produktiver Writer. Das 60-Minuten-Wartungsfenster ist
weiter nur ein Planwert, weder terminiert noch als Dauer garantiert.

## Ressource und unveränderte Anwendung

Genau ein Hetzner CPX32 HEL1, 4 AMD-vCPU, 8 GB RAM, 160 GB NVMe,
Ubuntu 24.04: `catering-prod-1`, Server **166533273**, Projekt Default/13344062,
IPv4 **2.29.43.174**. Einmal bestellt; **35,99 EUR netto/Monat inklusive IPv4**.
42,83 EUR ist der Rechenwert bei 19 % USt.; die aktuelle Kontonutzung zeigt
0 % USt. und ist keine Monatsrechnung. Keine kostenpflichtigen Addons und
keine zweite Storage-Grundgebühr. Bei Wiederaufnahme niemals erneut bestellen.

Verwaltungszugang codex, Key-only SSH, Rootlogin gesperrt. Unabhängig über die
angemeldete Provider-Konsole gebundener ED25519-Hostschlüssel:
`SHA256:9RHv3VPuNcWSaaQlj50WLthf9m+oN/h0hPbMw7gkACA`.
Firewall nur für den geprüften Betreiber-SSH-Zugang; Anwendung nicht öffentlich.

Alle sieben ursprünglichen Image-IDs sind unverändert in den beiden
`docker-compose.catering-target.json` gebunden und laufen auf dem Ziel.
PostgreSQL bleibt 17.9; kein App-main-Deployment, Build oder Schemawechsel.
Der alte Manifestcommit b2dbd056 allein beschreibt den später gebauten
Webcontainer nicht vollständig; die exakten Images sind maßgeblich.

Beide Zielnetze sind internal, IPv6 aus, IPv4-Gatewaymodus isolated; keine
Hostports, Hostnetze, Docker-Sockets oder automatischen Containerrestarts.
Eigener Edge und eigene Caddy-Daten/CA, keine fremden Sites/TLS-Dateien.
Externe IPv4-/IPv6-/DNS-Zugriffe aus beiden Netzen wurden abgewiesen;
private Web-/Edge-TLS-Routen mit richtiger CA geprüft, jeweils Auth-Challenge401.

## Tatsächliche Zielnachweise

- **Datenkopie:** genau ein konsistenter vollständiger pg_dump mit exportiertem
  Read-only-Snapshot **2026-09-19 12:57:44.910344 UTC**, 5.970.142 Bytes;
  SSH-Übertragung und genau ein Restore in die leere Ziel-DB, alle Exitcodes0.
  Vier Tabellen samt aggregierten Inhaltshashes, Spalten, Constraints und
  Indizes identisch. Auch 35 Legacy-Datensätze und der Migrationsmarker erhalten.
  Keine Sequenzen, benutzerdefinierten Trigger/Funktionen oder anderen vom
  Vergleich ausgeschlossenen Objekte vorhanden. Dump und eigene Tempdaten weg.
- **Anwendung:** vier Healthchecks und sechs authentisierte Fach-Leserouten
  HTTP200; DB-Inhalte und Schema nach Appstart unverändert. Die leeren fachlichen
  Listen entsprechen den ebenfalls frisch gelesenen Quell-Health-Zählern.
  Das ist kein vollständiger interaktiver Basic-Auth-Login oder schreibender
  Geschäftsdurchlauf. Keine Migration der vorhandenen Legacy-Daten vorgenommen.
- **Zielbackup:** genau einmal, Invocation
  `501623541d874cc6aaa235480f4ce3b9`, Start13:02:51UTC,
  systemd-Laufzeit17,621s, Gesamtergebnis success/Exit0. Candidate/Artifact/Pointer,
  vollständiger Scope und verschlüsselter Readback geprüft; Cleanup bestätigt.
- **Externer Snapshot:**
  `6a96e397f8c25c2e4c713d3294c9e3ca9b774243578c20be9d80c6fe8ebdeab7`.
  Dessen created_at13:02:51UTC ist der Erfassungszeitpunkt der Zielkopie;
  produktive Quelldaten sind weiterhin an den obigen Kopier-Snapshot gebunden.
- **Isolierter Restore:** genau einmal aus diesem Offhost-Snapshot, Invocation
  `bf45da66373a43f7b5e972bdbeb15664`, Start13:05:38UTC,
  systemd-Laufzeit17,142s, Gesamtergebnis success/Exit0. Echter PG-Innenrestore,
  Lesbarkeit aller vier Tabellen, Stream-/Komponentenchecksummen bestanden.
  Kein Produktionsvolume, Netzwerk oder Port am Probecontainer.
  Eigener Probecontainer, temporäre Daten und automatische Probevolumes entfernt.
- **Finale Records:** bestehende Observer-proof()- und Common-Validatoren
  bestätigen Snapshot-/Source-/Receipt-/Artifact-/Statusbindungen. Erfolgreicher
  Entrypoint hat atomare Veröffentlichung samt fsync durchlaufen. Receiptalter
  179s; erfolgreiche Veröffentlichung spätestens beim Wrapperende mit
  Candidatealter184,799s, innerhalb21600s. Nicht mit dem Receiptzeitpunkt
  gleichsetzen. Kein Power-Loss-Experiment oder kompletter Host-Rebuild behauptet.
- **Alarm:** Better-Stack-Team569103, ausdrücklich als Zielserver-Test markierter
  manueller Incident1017835477. E-Mail13:53MESZ, Empfang durch Alexander bestätigt,
  eigener Testincident14:02MESZ geschlossen. Heartbeat493066 unverändert pausiert;
  keine Heartbeat-/Beobachtersignale. Dies belegt den manuellen Meldeweg, nicht
  die automatische Ende-zu-Ende-Überwachung.

Backup/Restore bleiben klar unter den Betriebsbudgets1800/7200s und den
technischen Grenzen3600/14400s. Transiente Units wurden anschließend durch
systemd eingesammelt; Endzeit/Exit/Dauer stammen deshalb aus dem zugeordneten
systemd-run-Abschluss und Journalmetadaten, nicht aus einer leeren späteren Unit.

## Herkunft, Tests und Installation

Installierter Backup-/Restore-/Common-/Collector-/Observercode:
**f6c0aee4b54209b30d7cb1cf36a4ea53908f1acb**, Tree
**56854bb7adcd8e08212d1c013967f0dd4faaa5c4**, [Draft-PR693](https://github.com/AlexanderSmyslowski/catering-agents-platform/pull/693).
Scope `postgres-full,sites,platform-caddy,catering-edge-caddy`.
Fünf Git-Blobs atomar als root:root0755 installiert; Konfiguration0600.
Kein Installieren von Units/Timern/Cron. Historische Quellartefakte unverändert.
Ein erster Aufruf scheiterte vor Zielkontakt an einer falschen Quellpfadangabe;
`restic-password` wurde gezielt berichtigt und unabhängig nachgeprüft.
Der tatsächliche Zielinstallationsaufruf danach war erfolgreich, kein Backupretry.

Neue Host-/IP-/Scopebindungen sind frisch geprüft; Originalattestationen durch
frisch validierte feste Hashes gebunden. Recoverygarantie für identische Secrets
und denselben Vault-Locator übernommen, keine erneute Vault-Abholung behauptet.
Gültigkeitsende unverändert **2026-10-09 14:53:16 UTC**.
B/P/M/R/J:100663296/268435456/536870912/67108864/10000.

Unabhängiger read-only Review target_candidate_review, Astra/xhigh: Scope/Code
und konkrete Daten-/Installationsaufrufe PASS nach begrenzten Korrekturen.
[CI35442024153/V1](https://github.com/AlexanderSmyslowski/catering-agents-platform/actions/runs/35442024153)
am genannten Codehead: alle vier Jobs success; Build/Test auf Test-Merge
1be47263687b0bf2a53a1b3cc37894d17d03d380 mit identischem Tree.
**2696 Tests bestanden,14 bestehende Skips**, tatsächlicher Docker-/Restic-/
Vier-Tabellen-Restorevergleich und Cleanup, Browser und Compose bestanden.
Lokales RED/GREEN,199 Vitest-Fokusfälle,47 Python-Werkzeugverträge,
41 Observerfälle,2 Zielkonfigurationsfälle, Build/Syntax/Shellcheck bestanden.
Frühe Python3.14-Cleanupfehler bleiben dokumentiert; Linux-/Python3.11-Gates
bestanden ohne Abschwächung. Produktivcode **3878/3911**, Rest33;
Basen3181/3511 unverändert. Folgeänderungen an dieser Übergabe sind Dokumentation,
kein neuer installierter Quellstand und kein Anlass für einen erneuten Zieljob.

## Ressourcen und Kosten der Probe

Vorhandenes vmstat lieferte einmal 600 Ausgaben während der echten Prüfungen:
599 Intervallmessungen nach Ausschluss der ersten Seit-Boot-Zeile. Das nominelle
Intervall war 1 s; zwischen 13:06:54 und 13:06:56 UTC lag einmal ein Abstand von 2 s.
Mindestens4.725.387.264Bytes freier RAM,
kein Swap, größte beobachtete I/O-Wartequote2 %. Appstart kurz etwa96 % CPU-busy;
Backup maximal39 %, Restore32 % in den Samples. Das sind Beobachtungen,
keine garantierten Spitzen, Langzeitlasten oder dauerhafte CPU-Reserve.
Nach Probe MemAvailable7.003.844.608Bytes, Rootfrei151.270.027.264Bytes,
/run frei810.639.360Bytes. App-/DB-cgroups ohne harte RAM-/CPU-Caps wie im
übernommenen Stand; Restore-PG begrenzt auf512MiB RAM/256MiB PG-tmpfs.
Die flüchtige Docker-stats-Aufnahme erfasste den kurzen Probecontainer nicht;
systemd-Unit-MemoryPeak ist kein Gesamtmaximum einschließlich Dockerkindern.

Bestehender NBG1-Bucket13252127: gerundete UI-Metadaten nach Probe5,78MB/23Objekte,
vorher78,9KB/15Objekte. Ein neuer Ziel-Snapshot, kein zweiter Bucket oder Storage-
Grundpreis. Konservativ vorab genannte1GiB-Abrechnungsreserve für diese einzelne
Probe bleibt unter0,01EUR netto/Monat; keine unbekannte Freiquote oder exakte
zukünftige Rechnung behauptet. Keine Retention-/Lifecycleänderung.

## Nächster erlaubnispflichtiger Schritt

Vor Cutover sind die finale Datenübernahme und eindeutige Schreibhoheit,
DNS-/eigener Web-Eingang, fachliche Bedienabnahme und Rückweg getrennt freizugeben.
Nach Zielschreibvorgängen wäre ein geprüfter Rücktransfer erforderlich;
niemals bloß den alten veralteten Datenstand wieder einschalten.

Keine automatische Zielüberwachung/Jobs aktiv: vorhandene Serviceprüfung liefert
korrekt `TIMER_NOT_ARMED`. Vor späterer Aktivierung eigene Policy/Checkbindung,
Cron300/BetterStack period300/grace300, echte Alarm-/Ausbleibeprüfung und noch
nicht garantierte Anbieter-/Uhr-/Startreserven abgleichen. Issue692 bleibt offen
für andere Varianten. Weder Provider300s noch Uhr30s als Garantie ausgeben.
Keine Altressourcen löschen, keine neue Bestellung, kein zweiter Probe-/Backup-
Start nur wegen Kontextwechsel. Weitere Betriebsaktionen benötigen neuen Auftrag.

Detaillierte, geheimnisfreie Belege im bestehenden Arbeitsledger
`~/.codex/local-evidence/catering-finalconfig-0jae6hqe/observer-merge-approved-report.md`.
Maßgebliche JSON-Belege: target-data-result-20260919, target-app-readonly-result-
20260919, target-backup-first-result-20260919, target-backup-postcheck-20260919,
target-restore-first-result-20260919, target-restore-postcheck-20260919,
target-alarm-result-20260919, target-resources-probes-summary-20260919.
Diese versionierte Kurzfassung trägt die Ergebnisse auch ohne Zugriff auf den Mac.
