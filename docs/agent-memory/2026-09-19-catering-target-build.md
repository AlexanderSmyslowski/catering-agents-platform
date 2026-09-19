# Catering-Zielaufbau — geprüft am 19.09.2026

## Ergebnis und Grenze

Der isolierte Zielstand ist aufgebaut; Datenkopie, externe Sicherung,
isolierter Restore und gekennzeichneter E-Mail-Test sind nachgewiesen.
**HOLD BEFORE PRODUCTION CUTOVER AND AUTOMATIC JOB ACTIVATION.**
Keine öffentliche DNS-/Proxyroute und keine alte Anwendung wurde geändert.
Der alte Host hält weiterhin den maßgeblichen bisherigen Datenbestand.
CateringOS ist laut Betreiber noch nicht geschäftlich produktiv eingesetzt. Das 60-Minuten-Wartungsfenster ist
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
  der maßgebliche bisherige Datenbestand bleibt an den obigen Kopier-Snapshot gebunden.
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


## Geschützte Bedienprobe am 19.09.2026

**Teilweise bestanden:** echte Browseranmeldung, sichere TLS-Verbindung,
Navigation, synthetische Anlage und persistenter API-/DB-Readback bestanden.
**Wiederaufnahme des manuell angelegten Vorgangs nach Browser-Reload offen.**
Kein vollständiger fachlicher CateringOS-Abnahmenachweis. PR682 unverändert.
STR-001 v1.1 gelesen (Blob158ae4b9c37a18804d70c45b100241d56a87ebcf).

Nur auf Ziel166533273 eine neue leere Datenbank aus `template0` angelegt:
`catering_operator_probe_20260919`, eigene gleichnamig begrenzte Loginrolle
`catering_operator_probe`, Business-ID `cccb044b-b47b-4d23-aff5-1abaeaeaec12`.
Keine erhöhten Rollenrechte oder Mitgliedschaften; keine Tabellen-/Spaltenrechte
oder dauerhaften CREATE-Rechte in `catering_agents`. Dessen unverändertes PUBLIC-
CONNECT-Recht ist keine Datenberechtigung. Beide DBs nutzen denselben PG17.9-
Container; es wird keine physische Isolation behauptet.

Vier Appdienste und Web wurden ausschließlich mit separaten geschützten
Testbindungen und **denselben Image-IDs** neu erstellt. PG und Edge wurden nicht
neu erstellt. Base-Compose und `/etc/catering-target/runtime.env` unverändert.
Aktiv ist zusätzlich das root-only Override unter
`/var/lib/catering-operator-probe/20260919/operator-override.json` mit `operator.env`.
Ein späteres Compose-Up ohne dieses Override würde die Testbindung verlieren;
nicht beiläufig ausführen. Die gesamte Test-DB ist von jeder finalen Übernahme
und jeder späteren Sicherung des maßgeblichen Datenbestands auszuschließen.

### Betreiberzugang

- Auf diesem Mac: **https://catering-target.localhost:18443** im offenen Chrome-Tab
  „Catering-Agenten“. Normale Basic-Auth-Anmeldung und Chromes „Verbindung ist
  sicher“ tatsächlich bestätigt; kein Zertifikatsfehler übergangen.
- Anmeldung ausschließlich aus der geschützten lokalen Datei
  `~/.codex/private/catering-target-operator-20260919/browser-login.json`
  (Ordner0700/Datei0600), keine Zugangswerte in Bericht/Git. Passwort nicht im
  Google-Passwortmanager gespeichert. Die offene Sitzung ist bereits angemeldet.
- Zugriff nur über Betreiber-SSH, lokales `127.0.0.1:18443` und zielseitigen
  Unixsocket `/run/catering-operator/tls.sock`. Keine öffentlichen Appports,
  öffentlichen DNS-/Bestandsproxyeingriffe oder Änderungen der Egresssperren.
- Der manuelle Transport `catering-operator-tls-20260919.service` endet spätestens
  **19.09.2026 18:03:55UTC / 20:03:55MESZ** (RuntimeMaxSec14400, Restart=no).
  Kein Timer, Cron oder dauerhafter Zugangsdienst. Lokaler SSH-Forward ist für
  diese begrenzte Bedienphase geöffnet; nicht parallel ein zweites Mal starten.
- Chrome importierte durch den Betreiber **nur das vorhandene Endzertifikat**,
  SHA256 `91A7C5F8E61131AB7DC65D5FF6F3CEE327ABDD7FF7A0EB748C94286816558FA7`,
  SAN ausschließlich `catering-target.localhost`; DigitalSignature, kein
  keyCertSign. BasicConstraints fehlen, nicht als explizites CA:false ausgeben.
  Gültig bis **20.09.2026 02:03:46UTC**. Kein automatisches Vertrauen für dessen
  Nachfolger; den eigenen Chrome-Eintrag nach der Bedienphase gezielt entfernen.
- Die vorherige macOS-Trustbindung ist im Benutzer-Keychain nur für
  Chrome/SSL/diesen Host hinterlegt; Chrome unterstützt diese Einschränkungsform
  nicht und ignoriert sie. Keine breit vertraute CA in Chrome hinzugefügt.
  Der Browser-Connector blockierte seinen Basic-Auth-Aufruf mit
  ERR_BLOCKED_BY_CLIENT. Nach Beenden ausschließlich seiner Debugverbindung
  funktionierte der normale Chrome-Anmeldedialog, ohne Schutzabschaltung.

Falls nur der lokale Forward beendet wurde und der begrenzte Zieltransport noch
aktiv ist, denselben Zugang einmal manuell öffnen (keine Secrets im Befehl):

```sh
ssh -N -T -o BatchMode=yes -o ExitOnForwardFailure=yes \
  -o ControlMaster=no -o IdentitiesOnly=yes -o StrictHostKeyChecking=yes \
  -o ServerAliveInterval=30 -o ServerAliveCountMax=3 \
  -o UserKnownHostsFile="$HOME/.codex/local-evidence/catering-finalconfig-0jae6hqe/target-known-hosts-20260919" \
  -i "$HOME/.ssh/codex_hetzner_review" \
  -L 127.0.0.1:18443:/run/catering-operator/tls.sock codex@2.29.43.174
```

Bei abgelaufenem Transport/Zertifikat nicht durch Warnungsumgehung, neue
öffentliche Ports oder einen ungeprüften automatischen Neustart ersetzen.

### Speichernachweis und konkrete Übergabe an den Produktstrang

Genau eine UI-Anlage am **19.09.2026 14:23:10UTC**:
Produktion → Auftrag manuell erfassen → „Manuellen Auftrag anlegen“.
Kundenlabel `SYNTHETISCH SERVERPROBE 166533273 20260919`, Konferenz,
01.10.2026,2Teilnehmer,Buffet,Wasser; eindeutig synthetischer Ort/Notiz.
Keine KI-/Versand-/Webhookaktion, kein Seed oder zweiter Speicherversuch.

Die UI meldete „Manuelle Spezifikation wurde angelegt“ und zeigte die Daten.
Nach vollständigem Reload verschwand der Bezug; „Frühere Produktionsaufträge“
zeigte0/„Keine passenden Aufträge gefunden“. Persistenz dagegen bestätigt:
`manual-1789827790122`, `spec-manual-1789827790122` und genau ein Audit-Eintrag,
alle drei in der eigenen Business-ID; Anfrage/Spezifikation erneut authentisiert
und TLS-geprüft über die vorhandenen GET-Leserouten abgerufen. Produktionsfälle0.

Begrenzte Fehlerzuordnung: Der tatsächliche Intake-Handler
`intake-service/src/app.ts:866–906` speichert Anfrage, Spezifikation und Audit,
aber keinen Produktionsfall. Mitgelieferte Quellen
`backoffice-ui/src/production-manual-spec-submit-action.ts:31–42`,
`App.tsx:471–484,560–565,1309–1315` und `api.ts:550–607` halten den Fokus im
React-Zustand und laden Spezifikationen nur über Fall-/Fokusbindung. Das erklärt
konsistent den beobachteten Reloadverlust, **keinen Verlust der DB-Daten**.
Webartefakt `index-B7dQcOZX.js`, SHA256
`bf9acd1008dfbaf7a550f1ce3553f4f87debc13e6c2800636556f7bc752218f9`;
keine vollständige Source-map-Zuordnung des minifizierten Bundles behauptet.

Produktstrang: Diesen bestehenden manuellen Pfad samt Reload/Wiederaufnahme
prüfen und gegebenenfalls dort korrigieren. Keine Fallobjekte per SQL nachbauen,
keine globale „erstes Objekt“-Auswahl als Umgehung. Hier kein Produktcode,
kein neuer Build und keine Arbeit an PR682. Die technische Bedienprobe ist
wegen dieses End-to-End-Teils nicht vollständig bestanden.

### Nachzustand, Rücknahme und Grenzen

Zielnachprüfung **14:27:38UTC**: Alle sieben Image-IDs unverändert, keine
veröffentlichten Ports, interne isolierte Netze/IPv6aus/Restart=no unverändert.
Keine SMTP-/Webhook-/AWS-/API-Key-Schlüssel in den vier App-Environments.
Die aggregierten Inhalts-/Schema-/Owner-/ACL-Signaturen der kopierten bisherigen
DB sind unverändert:35Legacyrecords,
1Migrationsmarker,0Businessrecords,0Dokumente. Der Altserver wurde nicht betreten.

Geschützte Rücknahmequelle: `/var/lib/catering-operator-probe/20260919/`
mit `runtime.env.before`, `compose.json.before`, `Caddyfile.before` und
Original-DB-/ACL-Nachweis. Zugriff schließen: lokalen Forward beenden und
gegebenenfalls ausschließlich den genannten temporären Relayservice stoppen;
keine Daten/Evidence löschen. Rückbindung der App an die bisherige Datenkopie
wäre eine gesonderte bewusste Konfigurationsaktion mit denselben Images und
Originalenv, kein automatischer Abschluss dieser Probe. Eigenes zusätzliches
TLS-Hostfragment nur bei einer späteren gezielten Rücknahme aus Originalbytes
entfernen/validieren; keine alten oder fremden Proxys berühren.

Backup-/Restore-/Alarmnachweise oben bleiben historische gültige Einzelbelege;
sie wurden nicht wiederholt und beweisen nicht das neue Test-DB-/Zugangsdelta.
Vor Umzug bleiben: Wiederaufnahme des manuellen Produktpfads, endgültige
Daten-/Zugangskonfiguration ohne Test-DB, aktuelle finale Datenübernahme mit
alleiniger Schreibhoheit/Rückweg sowie ausdrückliche öffentliche Umschaltfreigabe.
Automatischer Betrieb/Monitoring bleibt separat unaktiviert.

### Neun Abhängigkeitswarnungen, unveränderte Images

Paketinventar frisch aus allen vier Nodeimages: fastify5.8.5,fast-uri3.1.5,
browserslist4.28.2,baseline-browser-mapping2.10.38. Alle neun Versionswarnungen
betreffen enthaltene Pakete; keine behoben, kein Update/Build ausgeführt.
340 statische Quell-/Manifestdateien in den vier Images identisch gebunden.
`not_actionable` im lokalen Triageformat gilt ausschließlich für den jeweils
untersuchten Ausführungspfad, nicht als allgemeine Entwarnung.

| Warnung | Enthaltene Version | Imagebefund | Ausführungspfad und Begrenzung |
|---|---|---|---|
| 1 / [GHSA-3m5p-2c4r-xxw2](https://github.com/advisories/GHSA-3m5p-2c4r-xxw2) | fastify 5.8.5 | Ja, alle vier Node-Images | Proxy-Vertrauensprüfung: Alle vier Fastify-Konstruktoren ohne trustProxy; app.ts:508/185/198 und print-export index.ts:342. Dienste intern, keine veröffentlichten Ports. Bei später aktiviertem numerischem trustProxy neu bewerten. |
| 2 / [GHSA-w2qp-rph6-63g4](https://github.com/advisories/GHSA-w2qp-rph6-63g4) | fastify 5.8.5 | Ja, alle vier Node-Images | Body-Typumwandlung: Keine Route installiert ein Fastify-Body-Schema. Eigene Ajv-Validierung mit festen Objektschemas ohne coerceTypes; Anlage sendet ein JSON-Objekt. Neue Body-Schema-Pfade wären erneut zu prüfen. |
| 3 / [GHSA-5jgf-p345-68v8](https://github.com/advisories/GHSA-5jgf-p345-68v8) | fast-uri 3.1.5 | Ja, alle vier Node-Images | Schema-relative IDN-Hostnamen: fast-uri nur transitiv für feste JSON-Schema-Referenzen (Ajv/Compiler/Serializer). Kein Produktimport, untrusted dynamisches Schema oder loadSchema. Konfigurierte Dienst-URLs verwenden URL/fetch; kein solcher Netzwerkpfad. |
| 4 / [GHSA-fph4-wmhf-6fwf](https://github.com/advisories/GHSA-fph4-wmhf-6fwf) | fast-uri 3.1.5 | Ja, alle vier Node-Images | Mehrfache Prozentdekodierung von Hostnamen: gleicher fest gebundener Schemapfad. Keine frei wählbare URI-Normalisierung als Grundlage für Netzwerk-/Redirectentscheidungen. Egress bleibt zusätzlich gesperrt. |
| 5 / [GHSA-73wf-gq98-2v4g](https://github.com/advisories/GHSA-73wf-gq98-2v4g) | browserslist 4.28.2 | Ja, alle vier Node-Images | Benutzerdefinierte Statistiknormalisierung: über Babel-Buildwerkzeuge enthalten. Dienste starten per tsx; kein Produktaufruf, Statistikimport oder Frontendbuild zur Laufzeit. Kein Build in dieser Probe. |
| 6 / [GHSA-c83g-rgw3-j3cx](https://github.com/advisories/GHSA-c83g-rgw3-j3cx) | browserslist 4.28.2 | Ja, alle vier Node-Images | Unbegrenzte Query-Caches/Speicherverbrauch: gleicher Buildwerkzeugpfad; keine Route leitet Eingaben an Browserslist-Queries weiter, kein Buildprozess gestartet. |
| 7 / [GHSA-jqff-g426-hqxp](https://github.com/advisories/GHSA-jqff-g426-hqxp) | fast-uri 3.1.5 | Ja, alle vier Node-Images | Kodierte URI-Schemen: gleicher fester Schemapfad. Keine Kette aus Nutzereingabe, Normalisierung und fetch/Header/Redirect in den ausgelieferten Dienstquellen. |
| 8 / [GHSA-f65p-4m7j-42xc](https://github.com/advisories/GHSA-f65p-4m7j-42xc) | fast-uri 3.1.5 | Ja, alle vier Node-Images | Fehlerhafte IPv6-Normalisierung: vertrauenswürdige feste Schemas; kein Aufrufer verwendet normalisierte Schema-IDs als Netzwerkziele. |
| 9 / [GHSA-w5vr-8v7q-w6rv](https://github.com/advisories/GHSA-w5vr-8v7q-w6rv) | baseline-browser-mapping 2.10.38 | Ja, alle vier Node-Images | Ungültige Eingabe kann Prozess beenden: über Browserslist/Babel enthalten, von den vier App-Entrypoints/Leserouten nicht aufgerufen. Keine solche Buildwerkzeugausführung im Test. |

Web/Edge sind Caddy-Laufzeitimages, PG ist17.9; kein Node/npm an den geprüften
Laufzeitpfaden. Keine vollständige transitive SBOM des statischen Webbundles.
Fast-uri-Bewertung hat deshalb weiterhin die dokumentierte statische Beweisgrenze;
kein konkreter erreichbarer Advisorypfad in der Bedienprobe festgestellt.
Vor öffentlicher Erreichbarkeit Warnungen/Pfade gezielt erneut beurteilen und
über kompatible Produktkorrekturen entscheiden; nicht stillschweigend schließen.

### Prüfung dieses Blocks

Unabhängiger Scope-/Befehls-/Trustreview durch target_operator_scope_review,
Astra/xhigh; konkrete Vorbereitungs- und Relayaufrufe nach Review ausgeführt.
Keine unveränderte Vollsuite oder Backup-/Restoreprobe wiederholt.
Bestehende [CI35445643679/V1](https://github.com/AlexanderSmyslowski/catering-agents-platform/actions/runs/35445643679)
am Dokumentationshead7bed609200536d6ff815365957bcde120110a00b abgeschlossen:
alle4Jobs success,2696Tests/14bestehendeSkips sowie ausgeführter synthetischer
Docker-/Restic-/Restoretest und Cleanup. Kein Retry. Installierter Code weiterf6c0aee4,
Produktivbudget3878/3911,Rest33. Dieses Delta ist Betriebsnachweis/Dokumentation.

Belege im bestehenden lokalen Ordner: `target-operator-prepare-result-20260919.json`,
`target-operator-relay-result-20260919.json`, `target-operator-trust-review-20260919.json`,
`target-operator-ui-after-save-20260919.txt`, `target-operator-ui-after-reload-20260919.txt`,
`target-operator-ui-history-after-reload-20260919.txt`,
`target-operator-testdb-after-save-corrected-20260919.json`,
`target-operator-persisted-readback-20260919.json`, `target-operator-postcheck-20260919.json`,
`target-advisory-triage-20260919.json/.md`, `target-image-source-binding-20260919.json`.
Die erste SQL-Zählabfrage erwartete in der neuen DB noch nicht vorhandene
Legacy-/Dokumenttabellen und scheiterte rein lesend; die Katalog-/Businessrecord-
Abfrage danach belegt den tatsächlichen Zustand. Kein fehlgeschlagener Appwrite.

## Begrenztes Betriebsübergangspaket — vorbereitet am 19.09.2026

Dieses Paket konkretisiert den späteren Übergang; es führt ihn nicht aus.
STR-001 v1.1, Blob `158ae4b9c37a18804d70c45b100241d56a87ebcf`,
bleibt maßgeblich. PR #693 steht bei Erstellung dieses Abschnitts auf Head
`64a80a74d08de23aaca346a02a787485682c9ed6`, Tree
`43793910c4e157f75ba7c98d854a3d35de96a80c`. Der automatisch gestartete
[CI-Lauf 35449296866/V1](https://github.com/AlexanderSmyslowski/catering-agents-platform/actions/runs/35449296866)
war zu diesem Zeitpunkt noch nicht abgeschlossen; drei Jobs waren erfolgreich,
`build-and-test` lief noch. Das ist kein grüner Gesamtstatus.

### Produktbefund und Umzugsbezug

Der Reload-/Wiederaufnahmefehler ist an die unveränderten App-/Webimage-IDs, das
ausgelieferte Webartefakt und die getrennte synthetische Testdatenbank gebunden.
Die Speicherung selbst blieb erhalten; Anfrage und Spezifikation waren über die
vorhandenen API-Leserouten erneut lesbar. Dafür gibt es keinen Hinweis auf einen
verlorenen Dump, eine fehlerhafte PostgreSQL-Übernahme, ein Netzwerkproblem oder
eine falsche Ziel-Hostbindung. Ein **umzugsbedingter Datenverlust ist damit nicht
erkennbar**. Die verbleibende Grenze ist wichtig: PR #682 wurde weder geprüft
noch verändert. Der Befund beweist deshalb nicht, dass dessen Produktstand
dasselbe Verhalten zeigt. Er blockiert die Behauptung einer vollständigen
fachlichen Bedienabnahme, aber nicht die technische Vorbereitung der
Serverentkopplung. Vor geschäftlicher Nutzung muss der Produktstrang den
Reload-/Wiederaufnahmepfad eigenständig abnehmen.

### Festgelegter Zielzustand und begrenztes Konfigurationsdelta

| Bereich | Zielzustand | Noch vorzubereitende beziehungsweise auszuführende Änderung |
|---|---|---|
| Daten | `catering_agents` enthält den finalen konsistenten Stand des bisherigen Writers. | Das aktive Operator-Override wird aus der Compose-Kette entfernt. `catering_operator_probe_20260919` und seine synthetischen Records werden weder umbenannt noch in Dump, Restore, Backup oder Anwendung eingebunden. |
| Anwendung | Dieselben sechs unveränderlichen Plattform-Images und PostgreSQL 17.9 laufen mit `/etc/catering-target/runtime.env`. | Ausschließlich ein Betriebs-Override setzt für die vorhandenen Dienste `restart: unless-stopped`; Images, Befehle, Schema und Appkonfiguration bleiben gleich. `docker.service` und dessen Bootstatus sind vor Ausführung frisch zu bestätigen. |
| Zugang | Ein eigener Edge beendet gültiges TLS für den tatsächlich bestätigten Catering-Host und leitet ausschließlich auf `web:8081`. Eine frisch gebundene enge Betreiber-Quelladresse und Basic Auth liegen vor allen App-/API-Routen. | Der private `.invalid`-/Unixsocket-Probeweg wird nicht als Dauerzugang verwendet. Der aktuelle Repositorydefault `catering.the-one.catering` ist vor Freigabe gegen den effektiv betriebenen Hostnamen und die DNS-Zone zu bestätigen. Ein eigener öffentlicher Edge-Override veröffentlicht nur 80/443, erhält das exakte Caddy-Zielrouting und sperrt die Anwendung für alle nicht gebundenen Quellen, ohne die ACME-Prüfung zu umgehen. |
| Netze | PostgreSQL und vier Fachdienste bleiben nur auf `catering_private`; Web bleibt auf `catering_private` und `catering_ingress`. | Nur der Edge erhält zusätzlich eine eigene nicht interne Public-Bridge für 80/443. Kein anderer Container erhält einen Hostport oder diese Bridge. Beide Appnetze bleiben `internal`, IPv6 aus und im isolierten IPv4-Gatewaymodus; die bestehende Egresssperre der Appdienste bleibt bestehen. |
| Secrets | Nur die bereits begrenzten Catering-Werte werden verwendet. | Werte werden geschützt in den bestehenden root-only Env-/Policydateien gebunden; keine Übernahme fremder Proxy-, App- oder Providersecrets. Das befristete Betreiberzertifikat und der Test-Forward werden nicht verlängert oder als Produktionszugang übernommen. |
| Sicherung | Der vollständige Vier-Tabellen-Scope sichert ausschließlich `catering_agents`. | Bestehende Backup-/Restore-Units bleiben bytegleich. Nach dem finalen Datenabgleich ist genau ein neuer vollständiger Backup-→Restore-Nachweis nötig, weil der historische Snapshot den finalen Datenstand und die Betriebsroute nicht belegt. |
| Überwachung | Der lokale Beobachter bewertet die finale Evidence und Heartbeat 493066 ausschließlich als `backup_restore_health`. | Policy auf den Zielhost und den bestätigten Monitor binden; Cron exakt 300 Sekunden, Provider `period=300`, `grace=300`. Keine alte Shared-Host-Evidence und kein bloßes Lebenszeichen darf den Monitor grün halten. |

Die drei additiven Betriebsartefakte sind jetzt getrennt von der unveränderten
Probe- und Rücknahmebasis vorhanden:

- `platform-infra/docker-compose.catering-target.operations.json` setzt nur die
  sechs vorhandenen Restartpolicies auf `unless-stopped`.
- `edge-infra/docker-compose.catering-target.operations.json` setzt die
  Edge-Restartpolicy, ergänzt nur `catering_public` und veröffentlicht nur
  TCP 80/443. Hostname, eine einzelne Betreiber-IPv4-Adresse, Basic-Auth-Daten
  und Writer-Modus sind ohne Default erforderlich.
- `edge-infra/Caddyfile.catering-target.operations` bindet genau den gesetzten
  Hostnamen, `web:8081`, Betreiber-IP `/32` und Basic Auth. Modus `locked`
  lässt nur die dokumentierten UI-/Health-/Fachlesepfade mit `GET`/`HEAD` zum
  Upstream; andere Leserouten enden mit 404 und alle Schreibmethoden mit 423
  am Edge. Nur der exakte Modus `enabled` öffnet den vollständigen Apppfad;
  jeder andere Wert bleibt gesperrt. Ein fehlender Wert lässt zusätzlich schon
  das Rendern der finalen Compose-Kette scheitern.

Vor Installation werden beide Base-/Override-Paare aus dem später akzeptierten
Mergecommit gerendert. Der synthetische CI-Vertrag prüft exakte Images, Dienste,
Netze, Ports, Mounts und DB-Bindung sowie Caddy-Konfiguration, Source-/Auth-
Schranke, Leseallowlist, Writerfreigabe und erneute Sperre. Die vorhandenen
Target-Dateien bleiben unverändert die isolierte Probe- und Rücknahmebasis.

### Ausführbare Übergangsreihenfolge

1. **Aktualität und Freigabebindung.** Den freigegebenen PR-Head, Mergecommit,
   installierbare Blobhashes, Ziel-ID 166533273, Images, Hostschlüssel,
   Attestationsrestlaufzeit, DNS-Hostname/-TTL/-Kontrolle, Firewall und freien
   Speicher frisch prüfen. Vor der Writer-Sperre zusätzlich Timerstempel,
   `LastTriggerUSec`, `NextElapseUSecRealtime`, laufende Jobs und einen möglichen
   Persistent-Nachhollauf lesend zuordnen; fehlende Stempel nicht erzeugen oder
   verändern. Ist ein sofortiger Nachhollauf möglich, das Fenster nur wählen,
   wenn bis zum nächsten Kalendertermin mindestens 9.300 Sekunden verbleiben.
   Ist ein Nachhollauf belegbar ausgeschlossen, darf der ausgewählte nächste
   reguläre Termin im Fenster liegen; sein darauffolgender Termin muss die
   9.300-Sekunden-Reserve lassen. Die
   Attestationen laufen am 09.10.2026 14:53:16 UTC aus; weniger als 48 Stunden
   Restlaufzeit sperren den Start. Abgelaufene Probezugänge nicht erneuern oder
   umgehen. Keine konkurrierenden Daten-, Backup-, Restore- oder
   Deploymentvorgänge.
2. **Schreibhoheit am Altbetrieb sperren.** Im angekündigten 60-minütigen
   Planfenster ausschließlich die alten Catering-Writer und ihren
   öffentlichen Schreibweg anhalten. PostgreSQL und fremde Anwendungen bleiben
   unangetastet. Aktive DB-Verbindungen und den alten autoritativen Datenstand
   festhalten; der alte Host bleibt bis zur Umschaltung Rückfallanker.
3. **Finale Datenkopie.** Einen konsistenten vollständigen logischen Dump des
   maßgeblichen Altstands mit den vorhandenen Größen-/Geheimnisgrenzen erzeugen,
   geschützt übertragen und zunächst in eine neue, nicht von Apps verwendete
   Ziel-DB restaurieren. Vier Tabellen, Schema, Migrationseintrag,
   Inhaltsbindungen und ACLs vergleichen. Erst nach bestandenem Vergleich unter
   ausgeschlossenen Appverbindungen die bisherige Zielkopie geschützt erhalten
   und die neue DB als `catering_agents` schalten. Die Operator-Test-DB bleibt
   getrennt und unreferenziert; sie wird in diesem Übergang nicht gelöscht.
4. **Zielkonfiguration zunächst ohne öffentlichen Verkehr.** App/Web/Edge stoppen,
   Operator-Override und temporären Relay aus der aktiven Kette nehmen. Den
   Plattform-Restartoverride aus dem akzeptierten Mergecommit installieren und
   Plattform/DB mit den identischen
   Images starten. Den bestehenden Ziel-Edge weiterhin ausschließlich in seiner
   privaten, portlosen Basiskonfiguration starten; sein Caddy-Datenstand gehört
   zum vertraglichen Backupscope. Intern Health, exakte Image-/DB-/Business-
   bindung, Lesbarkeit, Restartpolicies und fehlende fremde Netz-/Volume-
   Mitgliedschaften prüfen. Public-Bridge, öffentlicher Edge-Override und DNS
   bleiben noch aus.
5. **Finalen Edge und TLS bei weiter gesperrten Zielwrites herstellen.** Den
   geprüften öffentlichen Edge-Override und die finale Caddy-Datei aus demselben
   akzeptierten Mergecommit installieren, den geschützten Writerwert explizit
   auf `locked` setzen,
   ausschließlich Ziel-80/443 öffnen und den bestätigten Catering-DNS-Eintrag
   auf `2.29.43.174` umschalten. Der finale Caddy-Vertrag lässt App-/API-Zugriffe
   nur aus der frisch bestätigten engen Betreiber-Quelladresse und nach Basic
   Auth zu; die ACME-Challenge bleibt erreichbar, ohne eine Approute zu öffnen.
   Importierte alte Zugangswerte allein gelten nicht als Schreibsperre. Altwriter
   bleiben gestoppt; der Betreiber führt bis Schritt 8 ausschließlich benannte
   Leseprüfungen aus. Gültige Zertifikatskette, richtigen Hostnamen,
   Quelladresssperre, Basic-Auth-Challenge, internen Upstream und Caddy-
   Datenvolumes prüfen. Scheitert Zertifikatsausstellung, Zugriffsfence oder
   Routing, vor jedem Zielwrite DNS auf den unveränderten Altweg zurückstellen
   und Zielports schließen.
6. **Genau einen timergestarteten finalen Backup-/Restorezyklus ausführen.** Die
   unveränderten Originalunits installieren. Timerstempel, `LastTriggerUSec`,
   `NextElapseUSecRealtime` und den in Schritt 1 gewählten Nachhollauf- oder
   regulären Terminpfad samt zugehöriger 9.300-Sekunden-Reserve erneut lesen;
   ein zwischenzeitlich neuer oder unklarer Zustand stoppt. Dann genau einmal
   `systemctl enable --now catering-backup.timer`; kein zusätzliches
   `start catering-backup.service`, kein Restorestart und keine Stempeländerung.
   Systemd entscheidet über Nachhollauf oder nächste reguläre Fälligkeit. Beginnt
   im begrenzten Fenster kein Lauf, vor Zielwrites zurücknehmen und ein neues
   geeignetes Fenster wählen, statt manuell nachzustarten. Der eine tatsächliche
   Timerlauf muss Backup und `OnSuccess`-Restore gegen den finalen Datenstand
   samt finalem Edge/TLS ausführen. Snapshot, Source-/Host-/Scopebindung,
   Readback, vier Tabellen, Caddy-Komponenten, Cleanup und finale Evidence
   prüfen. Der historische Snapshot
   `6a96e397f8c25c2e4c713d3294c9e3ca9b774243578c20be9d80c6fe8ebdeab7`
   bleibt gültiger Probenachweis, wird aber nicht als dieser finale Nachweis
   umetikettiert.
7. **Echten Meldeweg prüfen.** Erst mit frischer finaler Evidence den
   dedizierten Heartbeat 493066 exakt auf Team 569103, 300/300 und den bestätigten
   Empfänger, alleinigen Sender, Signalbedeutung und Policywerte binden.
   `provider_delay`, `escalation_delay`, `clock_margin` und `request_seconds`
   müssen tatsächliche oder ausdrücklich bedingte Werte bleiben; NTP oder HTTP
   200 ersetzt keine Garantie. Nur bei genügend verbleibender Evidence- und
   Attestationsfrist Heartbeat 493066 ausdrücklich entpausieren, den Cron alle
   300 Sekunden aktivieren und einen realen gesunden Ping samt Providerannahme
   belegen. Den Ausbleibetest am UTC-Zeitpunkt
   dieses letzten angenommenen Pings verankern, Cron kontrolliert aussetzen und
   mindestens die gebundene Summe aus `period`, `grace`, `provider_delay`,
   `escalation_delay`, `clock_margin` und `request_seconds` abdecken. Cron bei Erfolg,
   Fehler oder Verbindungsabbruch sicher wiederherstellen. Erst tatsächlichen
   Ausbleibeincident und Alexanders Empfang bestätigen; danach ausschließlich
   eine neue reale gesunde Beobachterauswertung als Recovery verwenden. Keine
   Backup-Evidence verändern.
8. **Zielschreibhoheit freigeben und Nachzustand belegen.** Erst nach den
   Schritten 1–7 den geschützten Writerwert explizit von `locked` auf `enabled`
   setzen und ausschließlich den Edge mit beiden finalen Compose-Dateien neu
   erstellen. Danach den neuen Host als alleinigen Writer freigeben; der alte
   Catering-Schreibweg bleibt gesperrt. Authentisierte Anmeldung und vorhandene
   Leserouten nachprüfen, aber keinen synthetischen Ersatzdatensatz erzeugen.
   Single-writer-Nachweis, TLS/Auth/Routen,
   Containerneustartregeln, Timer/Cron/Monitorbindung, letzten Snapshot,
   Restore-Evidence, Alarm/Recovery, Ressourcenwerte und unveränderte fremde
   Anwendungen erfassen. Keine synthetischen Probeobjekte in die finale DB
   kopieren und den bekannten Reloadbefund nicht als bestanden darstellen. Das
   60-Minuten-Fenster bleibt ein Planwert für Writer-Sperre, finalen Timerlauf,
   Alarmtest und Umschaltung; keine Unterbrechungsfreiheit oder Einhaltung ohne
   tatsächliche Lauf-/Providerzeiten behaupten.

### Rückweg vor und nach neuen Zielschreibvorgängen

Beide Rückwege beginnen gleich: Writerwert auf `locked` zurücksetzen und nur den
Edge mit der gebundenen Konfigurationskette neu erstellen; Zielwriter sperren; künftige Timer- und
Cronstarts verhindern; Heartbeat 493066 pausieren, damit der nicht autoritative
Zielstand nicht weiter gesund gemeldet wird; aktive/queued Backup-, OnSuccess-
und Restore-Invocations eindeutig zuordnen. Eine gesunde fast beendete Kette
gezielt auslaufen lassen. Bei festgefahrener oder fehlgeschlagener Kette nur die
exakten zugehörigen Units stoppen, deren Cleanup und Nachzustand prüfen. Erst
nach quieszentem Zustand DB-, Edge- oder Routingbindungen ändern. Den neuen
autoritativen Writer und dessen noch fehlende oder vorhandene Überwachung als
explizites `HOLD` beziehungsweise Coverage-Ergebnis festhalten.

- **Vor dem ersten Zielschreibvorgang:** Zielroute schließen, DNS auf den
  unveränderten Altweg zurückstellen und die alten Catering-Writer wieder
  freigeben. Der alte Datenstand ist dann noch autoritativ. Weder Ziel-Evidence
  noch Backups löschen.
- **Nach dem ersten Zielschreibvorgang:** kein Rückfall auf die inzwischen
  veraltete Alt-DB. Nach dem gemeinsamen Rücknahmevorspann einen konsistenten vollständigen
  Zieldump erstellen, getrennt auf dem Altserver restaurieren und mit denselben
  Vier-Tabellen-/Schema-/ACL-Prüfungen validieren. Erst danach Alt-DB und Route
  gemeinsam zurückschalten. Falls dieser Rücktransfer nicht sicher gelingt,
  bleibt das Ziel der einzige Writer und der Fehler wird vorwärts behoben.

### Warnungen unter der vorgesehenen Erreichbarkeit

Der öffentliche Angriffsrand verschiebt sich von SSH/Unixsocket zu Caddy auf
80/443. Die App-/API-Route ist zusätzlich zur vollständigen Basic-Auth-Prüfung
auf die gebundene Betreiber-Quelladresse begrenzt. Die vier Node-Dienste und
PostgreSQL bleiben ohne Hostports; Caddy entfernt fremde Actor-/Business-/Trusted-
Header, und `trustProxy` bleibt ausgeschaltet. Damit entstehen für die beiden
Fastify- und vier fast-uri-Advisories keine neu belegten Trigger. Browserslist
und baseline-browser-mapping bleiben Buildwerkzeuge; auf dem Ziel wird kein
Build gestartet. Die neun betroffenen Versionen bleiben dennoch vorhanden.
Diese Einordnung gilt nur für die exakt beschriebene Route: eine unauthentisierte
API, numerisches `trustProxy`, dynamische Schemas/URIs, Runtime-Builds oder ein
direkter Appport wären neue Freigabeblocker. Die fehlende vollständige SBOM des
statischen Webbundles bleibt eine Nachweisgrenze, ist aber bei unverändertem,
vor Basic Auth ausgeliefertem Bundle kein neu belegter Advisorypfad.

### Benötigte nächste Betreiberfreigabe und echte Restblocker

Es folgen zwei getrennte Betreiberentscheidungen. Zuerst darf nach gebundenem
Review und grüner CI ausschließlich der reguläre Merge freigegeben werden.
Danach folgt ein frischer Betriebs-Preflight; erst dessen Ergebnis trägt die
gesonderte Freigabe für das technische Wartungsfenster. Diese spätere
Betriebsfreigabe muss exakt umfassen:
(a) Installation der drei aus dem Mergecommit gebundenen Betriebsartefakte;
(b) Stop/Freigabe der alten Catering-Writer;
(c) finalen Vier-Tabellen-Dump, geschützten DB-Tausch und App-Rückbindung;
(d) genau einen timergestarteten finalen Originalservice-Backup-/Restorezyklus;
(e) Ziel-Firewall/DNS/TLS-
Umschaltung; (f) Aktivierung von Heartbeat 493066, Cron und Drei-Stunden-Timer
samt vollständig gebundenem Ausbleibe-/Recoverytest; sowie
(g) die beiden beschriebenen Rückwege. Fremde Anwendungen, Alt-Datenlöschung,
Produktcode, PR #682, Schemaänderungen und zusätzliche Plattformen bleiben aus.

Vor dieser Freigabe sind nur folgende echte Punkte offen:

1. Der abschließende unabhängige Review und die automatisch ausgelöste CI müssen
   an den finalen Implementierungs-Head gebunden und terminal grün sein; erst
   danach kann ein gesondert freigegebener Merge erfolgen.
2. Beim späteren Preflight muss der exakte Caddy-Imagebestand des Zielhosts die
   finale Datei zusätzlich validieren. Die Hosted-CI prüft denselben Caddy-
   Versionsvertrag synthetisch, kann aber den nur lokal vorhandenen Imagebestand
   nicht als dessen Byteidentität ausgeben.
3. Effektiver öffentlicher Catering-Hostname, DNS-Kontrolle/TTL, Firewallregel,
   ACME-Erreichbarkeit und die enge Betreiber-Quelladresse sind unmittelbar vor
   dem Wartungsfenster frisch zu bestätigen. Der Repositorydefault oder Basic
   Auth allein ist kein Live- beziehungsweise Schreibfence-Nachweis.
4. Provider-/Eskalationsverzögerung, Uhrreserve, Requestbudget, alleiniger
   Heartbeat-Sender und tatsächlicher Empfänger müssen vor Aktivierung gegen
   Provider, Policy und verbleibende Evidencefrist gebunden werden; 300/300
   allein beweist keine Zustellfrist.
5. Attestationen müssen am Ausführungstag mehr als 48 Stunden gültig sein;
   andernfalls ist eine getrennt freigegebene Neubindung erforderlich.
6. Der Reload-/Wiederaufnahmefehler bleibt ein Produktabnahmehindernis vor
   geschäftlicher Nutzung. Er ist nach heutigem Beleg kein Migrationsfehler und
   keine Aussage über PR #682.

Bis dahin gilt weiter: **HOLD BEFORE PRODUCTION CUTOVER, AUTOMATIC JOB
ACTIVATION AND MERGE.** Dieser Abschnitt hat keine Betriebs-, Zugangs-, DNS-,
Proxy-, Daten-, Timer- oder Monitoringänderung ausgeführt.
