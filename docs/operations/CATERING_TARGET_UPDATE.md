# CateringOS – eigenständiger Zielserver-Updateweg

**Stand:** 2026-09-22  
**Ziel:** `catering-prod-1`  
**Status:** Implementiert und synthetisch/CI-geprüft. **Nicht gegen den echten Zielserver ausgeführt. Kein Deployment-GO.**

## Zweck und Grenze

Dieser Updateweg ist ausschließlich für den bereits isolierten CateringOS-Zielserver vorgesehen. Er ersetzt dort den historischen gemeinsamen Deploymentpfad.

Der historische Workflow `Deploy production` und `platform-infra/scripts/deploy-hetzner.sh` sind **nicht** für `catering-prod-1` freigegeben. Der neue Pfad darf insbesondere weder `zeiterfassung_default` noch die frühere gemeinsame Edge-/Compose-Kette verwenden.

Der erste echte Lauf gegen den Zielserver bleibt ein separater Betriebsauftrag und beginnt mit einer frischen read-only Zielprüfung.

## Manueller Einstieg

Workflow: **Update Catering target**

Datei: `.github/workflows/update-catering-target.yml`

Der Workflow besitzt ausschließlich `workflow_dispatch` und benötigt:

- `commit_sha`: exakter 40-stelliger Git-Commit;
- `confirmation`: exakt `UPDATE_CATERING_TARGET`.

Der Job läuft nur von `refs/heads/main`. Nach Checkout wird zusätzlich geprüft, dass:

1. der ausgecheckte Commit exakt `commit_sha` entspricht;
2. der aktuelle Remote-Head von `main` exakt derselbe Commit ist.

Damit kann kein älterer oder inzwischen überholter `main`-Stand absichtlich oder versehentlich installiert werden.

## Eigene Zielserver-Zugangsdaten

Der Workflow verwendet ausschließlich die dedizierten `CATERING_TARGET_*`-Secrets. Schlüssel und known_hosts werden temporär unter `RUNNER_TEMP` angelegt und am Ende entfernt.

SSH erzwingt:

- BatchMode;
- IdentitiesOnly;
- StrictHostKeyChecking;
- explizites UserKnownHostsFile;
- festen Port 22.

Secretwerte werden weder in dieses Dokument noch in das Repository geschrieben.

## Separater read-only Preflight

Workflow: **Catering target preflight**

Datei: `.github/workflows/catering-target-preflight.yml`

Dieser Workflow ist bewusst vom mutierenden Updateworkflow getrennt. Er besitzt ausschließlich `workflow_dispatch`, akzeptiert nur einen exakten `commit_sha` und läuft nur von `refs/heads/main`.

Vor dem SSH-Zugriff wird geprüft, dass der ausgecheckte Commit und der aktuelle Remote-Head von `main` exakt dem angegebenen Commit entsprechen. Der Workflow verwendet ausschließlich die dedizierten Target-SSH-Secrets und ruft nur:

`bash platform-infra/scripts/update-catering-target.sh --preflight`

auf. Es gibt keinen `--update`-Schritt, keine `UPDATE_CATERING_TARGET`-Bestätigung, keine Smoke-Credentials und keine mutierende Folgephase.

Der Preflight verwendet dasselbe geschützte Environment `catering-target-production`, lädt den read-only Nachweis als Actions-Artefakt hoch und entfernt das temporäre SSH-Material anschließend wieder.

## Read-only Preflight

Vor jeder Mutation prüft der Produktionsrunner mindestens:

- Contract-Version und Ziel-ID `catering-prod-1`;
- Deploypfad `/opt/catering-agents-platform`;
- Edgepfad `/opt/catering-edge`;
- Release-Root `/opt/catering-releases`;
- exakten Checkout-Commit;
- unveränderte Runtime-Schema-Migrationsregion gegenüber dem tatsächlich laufenden Quellstand aller vier Runtime-Appcontainer;
- identisches Runtime-DDL-Manifest über Shared Core, Intake, Offer, Production und Export in allen vier laufenden Runtime-Appcontainern;
- Hostname des Zielservers;
- reale, nicht-symlinkende Zielpfade;
- `/etc/catering-target/runtime.env` als root:root 0600;
- Hashbindung der vier Target-Compose-Dateien, der Edge-Caddy-Konfiguration und der privaten Target-Site;
- freien Target-Update-Lock bzw. beim Recheck exakt eigenen Lock;
- vorhandenen und gesunden Catering-Backup-Observer;
- renderbare Platform- und Edge-Compose-Konfiguration;
- exakt erwarteten Docker-Netzsatz einschließlich `catering_private`, `catering_ingress`, `catering_public`;
- laufende Container für PostgreSQL, Intake, Offer, Production, Exports, Web und Edge;
- `CATERING_WRITER_MODE=enabled`;
- Business-Records-Schema-Version 3 über einen `psql --no-psqlrc`-Read, damit weder System- noch User-Startup-Dateien vor dem vorgesehenen SELECT ausgeführt werden;
- exakte Service-Netzzuordnung;
- keine Hostports an PostgreSQL oder den fünf Appdiensten;
- ausschließlich 80/tcp und 443/tcp am Edge;
- gebundenes PostgreSQL-Datenvolume;
- immutable Edge-Image-ID.

Jeder unbekannte oder nicht lesbare kritische Zustand führt zum Abbruch.

Der isolierte Zielaufbau enthält absichtlich keinen vollständigen Repository-Quellbaum unter `/opt/catering-agents-platform`; dort wurden nur die Ziel-Plattformdefinition und servereigene Zustände installiert. Die Migrations- und DDL-Driftprüfung liest den installierten Quellstand deshalb read-only aus `/app` der laufenden immutable Runtime-Appcontainer `intake`, `offer`, `production` und `exports`. Alle vier Fingerprints müssen dem Kandidaten entsprechen; es wird nichts in die Container oder auf den Host geschrieben.

Fehler im read-only Preflight müssen dabei einen nicht-sensitiven Gate-Namen auf stderr ausgeben:

`TARGET_PREFLIGHT_FAIL gate=<gate>`

Die Gate-Namen beschreiben nur die fehlgeschlagene Prüfkategorie, z. B. `platform_base_hash`, `backup_observer_health`, `docker_network_set`, `schema_version`, `web_network`, `edge_ports` oder `postgres_volume`. Tatsächliche Secretwerte, Hashes, Pfade, Hostdaten oder sonstige Zielwerte werden durch diese Diagnose nicht ausgegeben. Zusätzlich existieren grobe Marker für Fehler beim installierten Schemaquell-Read, beim Runtime-DDL-Manifest und im gesamten Remote-Invariantenblock.


### Lock-Grenze des read-only Preflights

Read-only bedeutet hier: Der Preflight legt **keinen** `/opt/catering-target-update.lock` an, verändert keine Container, Dateien, Firewall-, Netzwerk- oder Anwendungszustände und startet keinen Updatepfad.

Der Backup-Observer darf bei `--check` zur konsistenten Beobachtung kurzzeitig einen exklusiven, nicht blockierenden `flock` auf seiner **bereits vorhandenen, read-only geöffneten** Observer-Lockdatei halten. Dieser Synchronisations-Lock ist kein Deployment-/Update-Lock. Laut Observer-Vertrag schreibt `--check` keinen Observerstatus und führt weder Docker, Restic, Dump, Restore noch Reparaturen aus.


## Migrationsgrenze

Der Contract lautet:

`migrationPolicy.mode = explicit-only`  
`migrationPolicy.supportedCommand = null`

Damit gibt es in Version 1 **keinen freigegebenen automatischen Migrationspfad**.

Der Lauf stoppt vor Updatebeginn, wenn:

- eine Migrationsdeklaration vorhanden ist;
- `CATERING_TARGET_MIGRATION_REQUIRED=1` gesetzt ist;
- die Runtime-Schema-Migrationsregion im Kandidaten vom installierten Stand abweicht;
- sich irgendein produktives Runtime-DDL-Literal (CREATE/ALTER/DROP TABLE oder CREATE INDEX) in den überwachten Runtime-Quellen gegenüber dem installierten Stand ändert oder neu hinzukommt.

Eine erforderliche Schemaänderung braucht zuerst einen eigenen geprüften Migrationsvertrag.

## Kandidatenbau

Nach erfolgreichem Preflight und ausdrücklicher Bestätigung:

1. werden lokal auf dem GitHub-Runner ein Runtime-Image und ein Web-Image aus dem exakten Commit gebaut;
2. beide müssen als immutable `sha256:...`-IDs vorliegen;
3. der Candidate-Override enthält ausschließlich die fünf Appdienste und jeweils nur das Feld `image`;
4. PostgreSQL und Edge werden nicht als Kandidaten gebaut oder ersetzt;
5. die Images werden als komprimierte Archive für den Zielserver vorbereitet.

## Geschützter Release-Sync

Für den exakten Commit entsteht ein eigener Releasepfad unter `/opt/catering-releases/<commit>`.

Der Quell-Sync verwendet `--delete`, schließt aber servereigene Zustände ausdrücklich aus, darunter:

- `.git`;
- `node_modules`;
- `backoffice-ui/dist`;
- `platform-infra/.env`;
- `platform-infra/sites`;
- `data`.

Zusätzlich bleiben die im Contract geschützten Zielzustände wie `/etc/catering-target/runtime.env` und `/opt/catering-edge/Caddyfile` außerhalb des Repository-Syncs.

## Lock und vorheriger Stand

Vor Remote-Mutationen wird `/opt/catering-target-update.lock` exklusiv angelegt. Owner-Datei und Modi werden fail-closed geprüft.

Vor Aktivierung werden die aktuell laufenden Image-IDs von Intake, Offer, Production, Exports und Web als `previous-images.json` im Release gebunden. Die unveränderten PostgreSQL-Volume- und Edge-Image-Bindungen stammen aus dem Preflight.

## Aktivierung

Der neue Compose-Lauf verwendet ausschließlich:

- `docker-compose.catering-target.json`;
- `docker-compose.catering-target.operations.json`;
- den Candidate-Image-Override.

Aktualisiert werden nur:

- intake;
- offer;
- production;
- exports;
- web.

PostgreSQL und Edge werden nicht neu erzeugt oder ausgetauscht.

## Postflight und fachlicher Read-Smoke

Nach Aktivierung werden die Candidate-Image-IDs und laufenden Appcontainer geprüft. PostgreSQL-Volume und Edge-Image müssen weiterhin exakt der Preflight-Bindung entsprechen.

Danach läuft ein authentisierter Read-Smoke:

1. Login über `/api/intake/v1/auth/login`;
2. Session-Read über `/api/intake/v1/auth/session`;
3. Prüfung auf Capability `production_read`;
4. Read der Produktionsfälle über `/api/production/v1/production/cases`.

Der Smoke erzeugt keinen Geschäftsvorgang.

Erst nach grünem Postflight und Smoke werden Installationsreceipt und installierter Commit geschrieben.

## Rücknahme

Scheitert Aktivierung, Postflight oder Auth-Smoke vor einer freigegebenen Schemaänderung, wird der vorherige App-Image-Override erneut aktiviert.

Die Rücknahme gilt nur als bewiesen, wenn anschließend:

- der vollständige Preflight unter dem eigenen Lock erneut besteht;
- die vorherigen App-Images wieder aktiv und laufend sind;
- PostgreSQL-Volume und Edge-Image unverändert gebunden sind.

Bei erfolgreicher Rücknahme endet der Updateversuch als `rolled_back`.

Kann Rücknahme oder Nachweis nicht erfolgreich abgeschlossen werden, lautet das Ergebnis:

`manual_recovery_required lock_retained=true`

Der Lock bleibt absichtlich bestehen; der Zustand darf nicht automatisch als gesund behandelt werden.

## Nachweise der Implementierung

Gebundener Implementierungsstand vor der Abschlussdokumentation: `23573a204a51f79e1c62c299bf1778e26bc3ebee`.

Fokussierter Run **35689341911 / #54**:

- 5 Vitest-Dateien, **43/43 Tests bestanden**;
- Python-Ziel-/Operations-/Backup-Observer-Regressionssatz: **47/47 bestanden**;
- Build erfolgreich;
- Syntaxprüfungen für beide Bash-Runner, Auth-Smoke-JavaScript und Python-Harness erfolgreich.

Reguläre CI **35689345135 / #3049** auf demselben Head:

- Build und vollständiger regulärer Testschritt erfolgreich;
- Browser-Rehearsal erfolgreich;
- Compose-Parität erfolgreich;
- branchspezifischer Backup-Spezialjob regulär skipped.

Die produktiven Kontrollfluss-Tests führen den echten `catering-target-production-update.sh` aus und ersetzen nur die externen Kommando-Grenzen. Geprüft werden unter anderem gesunder Preflight, vollständige Update-Reihenfolge, Aktivierungsfehler, Auth-Smoke-Fehler, erfolgreiche Rücknahme, nicht beweisbare Rücknahme mit Lock-Retention und Migrationsabbruch vor Mutation.

Abschlussreview-Korrektur: Ein zusätzlicher RED→GREEN-Test deckt Runtime-DDL außerhalb des Business-Records-Migrationsblocks ab. Run `35700722316` war mit genau dieser Gegenprobe rot (10 bestanden, 1 fehlgeschlagen); nach dem erweiterten DDL-Manifest-Guard war Run `35700855657` grün (11/11). Der installierte dokumentierte Altstand `3c5f6076…` und der aktuelle Kandidat hatten bei der Gegenprüfung identische DDL-Literale.

## Erster echter Zielserverlauf

Vor einem ersten Dispatch sind erneut erforderlich:

1. aktueller `main`-Commit und grüne CI;
2. frischer read-only Zielzustand;
3. Bestätigung, dass Backup-Observer und Rückweg weiterhin gesund sind;
4. passende `catering-target-production`-Environment-Secrets;
5. ausdrückliche Betriebsfreigabe für genau diesen Commit.

Bis dahin gilt: **kein Dispatch, kein SSH-Live-Lauf, kein Deployment.**
