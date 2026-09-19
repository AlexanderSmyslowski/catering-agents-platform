# Catering: isolierter Zielaufbau

Dieser Kandidat gehört ausschließlich zum freigegebenen zusätzlichen Zielserver.
Er ist kein allgemeines App-Deployment und kein In-place-Umbau des Altservers.
STR-001 bleibt maßgeblich. Vor der öffentlichen Umschaltung ausdrücklich halten.

## Herkunft und Umfang

Hetzner-Projekt Default/13344062, Server catering-prod-1/166533273, HEL1,
CPX32, Ubuntu24.04, IPv4 2.29.43.174; monatlich35,99EUR netto einschließlichIPv4.
Keine Zusatzprodukte oder zweite Storage-Grundgebühr. Wiederaufnahme immer
anhand dieser Identität; niemals erneut bestellen.

Die beiden `docker-compose.catering-target.json` enthalten die sieben am
19.09.2026 gelesenen unveränderlichen Image-IDs. Manifestcommit des Altbetriebs
ist b2dbd056e0f9a1ada80d735f1c6e53a93c81c041; der später gebaute Webcontainer
macht dieses Manifest allein nicht zur vollständigen Versionsidentität.
PG bleibt17.9. Keine Builds, automatischen Pulls oder App-/Schemaupdates.

Die genehmigte Erweiterung entfernt ausschließlich die Tabellenfilter des
konsistenten Custom-Dumps. `catering_records` und `catering_schema_migrations`
werden dadurch neben BusinessRecords und SourceDocuments erhalten. Der reale
Probecontainer prüft Restore-Exit und Lesbarkeit aller vier Tabellen. Das
synthetische CI-Orakel vergleicht zusätzlich deren Spalten, Primärschlüssel
und Testdaten. Diesen erweiterten synthetischen Vergleich niemals als bereits
ausgeführten Vergleich sämtlicher Produktionsdaten ausgeben.

Neuer Scope: `postgres-full,sites,platform-caddy,catering-edge-caddy`.
Komponenten heißen `catering_edge_*`; eigenes Projekt `catering-edge`, eigene
Volumes, `/opt/catering-edge/Caddyfile`. Alte Shared-Edge-/Zweitabellen-Evidence
bleibt historisch erhalten und kann den neuen Scope nicht freigeben. Die alten
installierten Skripte werden in diesem Auftrag nicht ersetzt. Historische
In-place-/Phase3-Anleitungen dürfen nicht auf dem Ziel ausgeführt werden.

## Installation und Datenprobe in Reihenfolge

1. Ziel-ID/SSH-Pin, keine konkurrierenden Writer, unveränderte Image-IDs und
   freien Speicher erneut bestätigen. Keine Quellcontainer neu starten.
2. Nur die expliziten Catering-Konfigurationsschlüssel geschützt übertragen:
   DB-Passwort, Business-ID, Trusted-Actor-Secret, Basic-Auth-Nutzer/-Hash und
   Caddy-Kontakt. Quellwerte aus tatsächlich laufenden Catering-Containern
   gegeneinander abgleichen; keine kompletten Environments/Shared-Proxy-Daten.
   Root-only Dateien, keine Werte in argv, Ausgabe, Git oder lokalen Reports.
3. Die Plattformdefinition nach `/opt/catering-agents-platform/platform-infra/`
   und Edge-Dateien nach `/opt/catering-edge/` installieren. Das Sites-Verzeichnis
   enthält ausschließlich `target-sites/catering-target.caddy`; die beiden
   Fremdanwendungsfragmente des Altservers nicht kopieren. Die tatsächlichen
   privaten HTTPS-Routen catering-web.invalid:8443 und catering-target.invalid:8443
   verwenden jeweils Caddys eigene interne CA. Keine öffentliche Zertifikats-
   anforderung, kein Kopieren alter TLS-Stores, keine künstlichen Markerdateien.
   Beide Caddys müssen reale eigene /data- und /config-Inhalte erzeugen; vor
   Backup die unveränderten Nichtleer-/Checksumprüfungen bestehen lassen.
   Diese privaten TLS-Proben belegen keine öffentliche Domain-/TLS-Freigabe.
   Mit geschützter Env-Datei `docker compose config --quiet` prüfen; gerenderte
   Environmentwerte nicht ausgeben. Projektname platform-infra bzw. catering-edge.
4. Nur leere Zielnetze/-container erzeugen und tatsächliche Isolation prüfen,
   bevor die Datenkopie startet. Beide Netze sind internal, IPv6 deaktiviert,
   IPv4-Gatewaymodus isolated, keine Hostports, kein Hostnetz oder Docker-Socket.
   Auch der Edge ist während der Probe ausschließlich intern. Prüfzutritt erfolgt
   gezielt per SSH/Docker-exec, nicht über eine öffentliche Vorschauadresse.
   Docker dokumentiert den fehlenden Host-Bridge-Zugang im Modus isolated unter
   https://docs.docker.com/engine/network/port-publishing/#gateway-modes.
   Tatsächliche Endpoints, Routen und abgewiesene externe IPv4-/IPv6-Verbindungen
   prüfen; DNS/HTTP/SMTP/Webhooks dürfen keine Geschäftswirkung auslösen.
5. Einmaliger geschützter, konsistenter vollständiger pg_dump des Altbetriebs
   mit den geprüften Parametern, unmittelbar begrenzt auf96MiB. Keine Installation
   eines Skripts auf dem Altserver. Verschlüsselte SSH-Übertragung; root-only
   Zielablage. Vorzustand und eindeutige leere Ziel-DB prüfen, dann einmal
   pg_restore mit exit-on-error in die Zielkopie. Keine Alt-DB schreiben.
6. Schema-/Tabellenmenge, Migrationseinträge und geschützte Inhaltsbindungen
   der Kopie vergleichen; nur aggregierte Ergebnisse veröffentlichen. Exakte
   Images starten, Kernabläufe in der isolierten Kopie prüfen. Kein Übernehmen
   fremder Worker-/Versandkonfiguration, kein automatischer Seed/Migrationslauf.
7. Geprüfte Backup-/Restore-/Common-/Collector-/Observerdateien aus einem exakt
   erfassten Commit installieren; source_commit/tree müssen diesen Stand nennen.
   Root:root, Skripte0755, Pythonbeobachter0755, Konfiguration0600. Eigene
   Vorzustände geschützt sichern, atomar ersetzen und Dateien/Verzeichnisse fsync.
   Keine Units/Timer/Cron aktivieren. Das verwendete Skriptverzeichnis gehört
   ausschließlich dem neuen Zielserver.
8. Repository-ID und bestehendes NBG1-Backend behalten. Nur erforderliche
   Catering-Backendzugänge übertragen. Frische Ziel-Host-/IP-/Endpointbindungen
   und Attestationshashes validieren. Vorhandene geprüfte Recovery-Quelle und
   unveränderte Secrets wiederverwenden; keine Gültigkeit verlängern. Alte
   Nachweise nicht als Zielprüfung umetikettieren. B/P/M/R/J bleiben
   100663296/268435456/536870912/67108864/10000.
9. Vor genau einem Zielbackup und einem isolierten Restore Ressourcen und
   attestierte Kostenobergrenze frisch prüfen. Geprüften transienten oneshot-
   Start mit EnvironmentFile, RuntimeDirectory=catering-backup/0700,
   ReadWritePaths=/var/lib/catering-backup und /run/catering-backup, NoNewPrivileges,
   ProtectSystem=strict, ProtectHome, PrivateTmp, Restart=no und --wait verwenden.
   Original-Backupservice mit OnSuccess nicht zusätzlich starten. Exit,
   Invocation-ID, UTC-Zeiten, Snapshot, Readback, Receipt, Evidence und Cleanup
   getrennt bestätigen. Bei unbekanntem Ausgang nur vorhandenen Lauf auswerten.
10. Beobachter zunächst ohne Übertragung gegen echte Zielrecords prüfen.
    Gekennzeichneter Testalarm an Alexander ausschließlich mit zugeordnetem
    Test-/Meldeweg; bestehenden Produktionscheck nicht mit Zielerfolgen bedienen.
    HTTP-Erfolg ersetzt keine Empfangsbestätigung. Kein dauerhafter Cronstart.

## Haltepunkte und Rücknahme

Keine DNS-/Proxyumschaltung, öffentlichen Zielwriter oder alten Hostressourcen
ändern. Keine Timeraktivierung. Das60-Minuten-Fenster bleibt unbestätigter
Planwert bis zur späteren ausdrücklichen Umschaltfreigabe.

Bei Fehlern innerhalb der isolierten Probe nur zweifelsfrei eigene Probeobjekte
aufräumen, Ziel-Appcontainer bei Bedarf gezielt stoppen; keine globalen Prunes,
keine Löschung alter Daten oder fremder Sicherungen. Ein teilweise erstellter
Zieldatenstand ist kein Erfolg und wird nicht automatisch weiterverwendet.
Quellproduktion bleibt Writer und Rückfallanker, solange noch keine produktiven
Zielschreibvorgänge freigegeben wurden. Nach späteren Zielschreibvorgängen wäre
ein geprüfter Rücktransfer erforderlich, niemals Rückfall auf veraltete Altdaten.

Ressourcen während tatsächlicher Zielproben beobachten. Einzelbeobachtungen
sind keine garantierten Spitzen-/RPO-/RTO-Werte. Vor Aktivierung gelten weiter
exakt Cron300/BetterStack period300/grace300 sowie offene Frist-/Startreserven;
Issue692 ist keine pauschal gelöste Konfigurationsfrage.
