# CateringOS – eigenständiger Zielserver-Updateweg

**Stand:** 2026-09-29
**Ziel:** `catering-prod-1`  
**Status:** Versionierter Mac-Operator mit getrennten Commit- und Artefaktbindungen. **P2-Reconciliation gegen #712 abgeschlossen; kein echter Zielserverlauf, kein Deployment-GO.**

## Zweck und Grenze

Dieser Updateweg ist ausschließlich für den bereits isolierten CateringOS-Zielserver vorgesehen. Er ersetzt dort den historischen gemeinsamen Deploymentpfad.

Der historische Workflow `Deploy production` und `platform-infra/scripts/deploy-hetzner.sh` sind **nicht** für `catering-prod-1` freigegeben. Der neue Pfad darf insbesondere weder `zeiterfassung_default` noch die frühere gemeinsame Edge-/Compose-Kette verwenden.

Der erste echte Lauf gegen den Zielserver bleibt ein separater Betriebsauftrag und beginnt mit einer frischen read-only Zielprüfung.

## Versionierter Operator-Einstieg

Der einzige neue Einstieg ist `platform-infra/scripts/catering-target-operator.py` auf dem autorisierten Operator-Mac. Produktquelle und Betriebswerkzeug werden aus getrennten, sauberen, detached Checkouts desselben Repositorys gelesen. Beide Commits werden als vollständige lowercase SHA übergeben.

Voraussetzung sind macOS, Python 3.9 oder neuer, Git, die GitHub CLI `gh`, Docker mit `linux/amd64`-Buildunterstützung, `rsync` und OpenSSH. Der Operator wird aus dem Betriebswerkzeug-Checkout gestartet; `--product-source` zeigt auf den separaten Produktcheckout.

Beispiel mit gesetzten Shellvariablen:

```bash
operator=platform-infra/scripts/catering-target-operator.py
product=0000000000000000000000000000000000000000
operations=1111111111111111111111111111111111111111
product_source=/path/to/detached-product-checkout
bundle=/path/to/catering-target-bundle
manifest_sha=PASTE_THE_64_CHARACTER_SHA_FROM_BUNDLE_OUTPUT

python3 "$operator" validate \
  --product-commit "$product" \
  --operations-commit "$operations" \
  --product-source "$product_source"

python3 "$operator" bundle \
  --product-commit "$product" \
  --operations-commit "$operations" \
  --product-source "$product_source" \
  --output-dir "$bundle"

python3 "$operator" preflight \
  --product-commit "$product" \
  --operations-commit "$operations" \
  --product-source "$product_source"

python3 "$operator" stage \
  --product-commit "$product" \
  --operations-commit "$operations" \
  --product-source "$product_source" \
  --bundle-dir "$bundle" \
  --manifest-sha256 "$manifest_sha" \
  --confirm STAGE_CATERING_TARGET

python3 "$operator" apply \
  --product-commit "$product" \
  --operations-commit "$operations" \
  --product-source "$product_source" \
  --bundle-dir "$bundle" \
  --manifest-sha256 "$manifest_sha" \
  --confirm ACTIVATE_CATERING_TARGET

python3 "$operator" verify \
  --product-commit "$product" \
  --operations-commit "$operations" \
  --product-source "$product_source" \
  --bundle-dir "$bundle" \
  --manifest-sha256 "$manifest_sha"
```

`validate` prüft beide Commitbindungen ohne Zielkontakt. Jeder Commit muss in der aktualisierten `origin/main`-Historie liegen und einen abgeschlossenen, erfolgreichen Lauf **CI** mit exakt `event=push`, `head_branch=main` und `head_sha=<gebundener Commit>` besitzen. Ein `pull_request`-Lauf reicht nicht. Historische Commits sind zulässig; der Commit muss nicht dem aktuellen `main`-Head entsprechen.

Die Betriebswerkzeug-Mindestannahme ist dieselbe überprüfbare Kombination: Integration in `origin/main` plus erfolgreicher `CI`-Pushlauf genau auf diesem SHA. Das belegt Herkunft und den erfolgreichen Push-CI-Nachweis. Es belegt weder menschliches Review noch eine reale Produktionsausführung dieses Betriebswerkzeug-Commits. Ein zusätzlicher Zertifizierungsdienst oder ein separates Draft-PR-Merkmal ist nicht Teil des Gates. Die historischen E1-/E2-Läufe vom 25.09. waren an #712 und dessen damaligen Head gebundene Nachweise; sie werden nicht als Freigabe für spätere Tool-SHAs wiederverwendet.

`bundle` baut Runtime- und Web-Image für `linux/amd64`, exportiert nur getrackte Dateien des exakten Produktcommits und schließt damit ignorierte lokale Dateien wie `.env` aus dem Docker-Buildkontext aus. Manifest v3 bindet Repository, Ziel, Produktcommit, Betriebswerkzeug-Commit, Image-IDs, Anwendungsdienste, SHA-256-Werte von Images und Compose-Override, die beiden vom Ziel-Compose-Aufruf tatsächlich verwendeten Produkt-Compose-Dateien und einen kanonischen SHA-256 des vollständigen exportierten Source-Baums. Exportierte Verzeichnisse erhalten deterministisch Modus 0755; Dateien erhalten 0644 oder bei im Git-Tree ausführbaren Dateien 0755. `stage` prüft dieselben Bindungen vor Zielkontakt und hält sie im Stage-Receipt fest.

Der neue Operator verlangt Manifest v3 für Stage und Apply. Der Ziel-Release-Validator vergleicht die `sourceFiles`-Digests und beim v3-Stand zusätzlich den vollständigen Source-Tree-Digest, einschließlich Dateitypen, relativen Pfaden und normalisierten Modi. Bereits installierte v1-/v2-Releases bleiben für die bisherige Receipt-/Rollbackprüfung lesbar; das macht sie nicht zu zulässigen neuen Stage-Kandidaten.

Die freigebbaren Phasen bleiben getrennt:

1. `validate`: Commit-/CI-Gates und Checkoutzustand, ohne Zielkontakt.
2. `bundle`: lokaler secret-freier Build und unveränderlich gebundene Artefakte, ohne Zielkontakt.
3. `preflight`: read-only Zielprüfung.
4. `stage`: erneuter Preflight und Übertragung der exakt gebundenen Produktquelle, Manifestdatei, Image-Archive und Override in einen neuen Releasepfad. Der Releasepfad und die Dateien haben feste root:root-Modi; Stage schreibt einen root-owned, mode-0600 Stage-Receipt einschließlich Produkt-/Operationscommit, Manifest-, Image-, Archive-, Compose- und vollständiger Source-Tree-Bindung. Ein vorhandener Releasepfad wird read-only klassifiziert. Ein vollständig identisches Stage mit gültigem Receipt wird ohne erneute Übertragung oder Receipt-Schreibvorgang wiederverwendet. Ein passendes installiertes Release wird als `already_installed` gemeldet. Teilstände, andere Manifeste/Image-IDs, zusätzliche Dateien, abweichende Modi/Eigentümer, widersprüchliche Receipts und ein unvollständiger Apply-Zustand enden fail-closed. Stage löscht und überschreibt kein vorhandenes Release; es lädt keine Images und führt kein Compose-`up` aus.
5. `apply`: prüft Commit-, CI-, Manifest-, Stage-Receipt-, Release-Layout-, Source-Tree- und Digestbindungen erneut. Ein bereits passendes installiertes Release wird vor Lock-Erwerb als `already_installed` bestätigt. Nach Lock-Erwerb klassifiziert Apply den Releasepfad erneut, bevor es den Vorgänger sichert oder Images lädt: Eine zwischenzeitlich installierte identische Version wird nach Receipt-/Aktivmarkerprüfung als No-op beendet; ein Teilzustand wird fail-closed abgewiesen und der noch nicht für Aktivierung benötigte Lock freigegeben. Andernfalls aktiviert Apply ausschließlich die bereits gestagten Artefakte. `apply` baut nicht neu und überträgt keine Dateien.
6. `verify`: read-only Postflight-, Health-, Install-Receipt-, Stage-/Manifest- und Commitprüfung des installierten Releases. Diese Phase führt keinen authentisierten Anwendungssmoke aus.

Vor `stage` und `apply` werden Herkunfts-, CI- und Bundle-Gates mit begrenzten Git-/GitHub-Timeouts fail-closed abgeschlossen. Der Update-Lock wird während des Aktivierungslaufs gehalten. Vor dem Compose-Preflight im `apply` und unmittelbar vor `docker compose up` prüft ein Remote-Schritt im selben SSH-Aufruf erneut Stage-Receipt, Produkt-/Betriebswerkzeug-Commit, Manifest, Override, Image-Archive und beide konsumierten Compose-Quelldateien. Nach Beginn der Aktivierung verwenden Postflight, Smoke, Receipt, Rollback und die separate `verify`-Phase keine GitHub- oder Git-Netzabfrage. Jeder fehlende oder abweichende Commit, Lauf, Manifestwert, Digest oder Stage-Receipt stoppt vor der nächsten Phase.

`stage`, `apply` und `verify` sind Zielbefehle. P2 hat sie ausschließlich lokal bzw. mit synthetischen Ziel-Fixtures geprüft; kein echter Zielserver wurde kontaktiert. Die zwei bestehenden GitHub-Workflows `update-catering-target.yml` und `catering-target-preflight.yml` bleiben unverändert; sie sind nicht der neue Einstieg und dürfen bis zur gesonderten Entscheidung nicht ausgelöst werden. Für Kompatibilität bleibt der historische Workflow-Kontext `Update Catering target` technisch als einziger ungebundener `--update`-Aufrufer zugelassen: exakt dieses Repository, `workflow_dispatch`, `refs/heads/main`, die versionierte Workflow-Referenz, übereinstimmender Workflow-SHA, Event-Input `confirmation=UPDATE_CATERING_TARGET` und identischer `commit_sha`. Dieses Zulassen ist keine Auslösefreigabe; das Auslösen bleibt organisatorisch untersagt. Der Mac-Operator verwendet ausschließlich `stage` und `apply`. Der historische `Deploy production`-Workflow, `deploy-hetzner.sh` und `deploy-web-listener-hetzner.sh` gehören nicht zum neuen Pfad.

## Bestehende GitHub-Zielworkflows

`.github/workflows/update-catering-target.yml` und `.github/workflows/catering-target-preflight.yml` bleiben vorhanden. Sie laufen manuell und erzwingen den aktuellen `main`-Head; sie sind nicht Teil des neuen Operatorwegs. Ihr Auslösen ist bis zu einer gesonderten Entscheidung organisatorisch untersagt. Der neue Operator ruft sie nicht auf.

## Reconciliation-Matrix PR #712 gegen den P1-Updateweg

Geprüfte Referenz: PR #712 war während P2 weiterhin offen und Draft; sein per GitHub gelesener Head stimmte mit `f2546468c5bce0e8f2298ee1a92c6c6da3b2ae71` überein. Der #712-Diff wurde als Referenz gelesen. Es gab keinen Merge, Cherry-pick oder automatischen Konfliktabgleich. P1/main bleibt die Architekturführung.

Entscheidungscodes: **A** = durch P1 gleichwertig oder besser gedeckt; **B** = in P2 gezielt in P1 übertragen; **C** = für den neuen Updateweg obsolet und verworfen; **D** = noch offen, weil der Nachweis keine sichere Entscheidung erlaubt.

| Thema aus #712 / den Läufen vom 26.09. | Ergebnis | P1/P2-Entscheidung und Beleg |
|---|---|---|
| Request- und Smoke-Timeouts | B | Die authentisierte dateibasierte Smoke verwendet `AbortSignal.timeout(20000)`. P2 setzt den Invoke-Modus explizit auf `node --input-type=module -e`, damit Top-Level-await nicht von impliziter Eval-Syntaxerkennung abhängt. `Dockerfile.runtime` deklariert `node:22-alpine`; der gezielte lokale Test prüft dieselbe Modul-Invocation, aber führt den Smoke nicht in diesem Image aus. |
| SSH-/Transport-Timeouts und Keepalive | B | Der P1-Runner setzte `ConnectTimeout=10`, `ServerAliveInterval=15` und `ServerAliveCountMax=4` für gewöhnliches SSH. P2 ergänzt dieselben Werte im separat konfigurierten rsync-SSH-Aufruf; dessen Argumente werden im Kontrollfluss-Test geprüft. |
| Remote-Argument-Quoting | A | P1 quotiert Remote-Argumente als Argumentvektor mit `shlex.quote`. Der Smoke-Quelltext geht als ein gequotetes `node --input-type=module -e`-Argument zum Container; nur der credential payload läuft über stdin. Zugangsdaten stehen nicht in Remote-Kommandozeilen oder Logs. |
| Ownership und Dateirechte | B | P2 normalisiert den exportierten Source-Baum unabhängig von Mac-umask: Verzeichnisse 0755, normale Dateien 0644, in Git ausführbare Dateien 0755. Release-Verzeichnis und Dateien haben festgelegte root:root-Modi; Stage-/Install-/Rollback-Receipts sind 0600. Abweichungen führen zu Fehler statt pauschalem permissivem `chmod`. |
| Release-Verzeichnis-Erstellung | A | P1 erstellt nur einen fehlenden Commitpfad unter dem festen Release-Root; P2 prüft zusätzlich Root-Eigentümer und Modus vor Erstellung bzw. Klassifizierung. |
| Wiederverwendung vorhandener Release-Verzeichnisse | B | Ein read-only Prüfer verifiziert Layout, vollständige Bindungen, Modi und Stage-Receipt. Nur ein vollständig identisches Stage ohne Install-/Apply-Zustand ist `reusable`; Übertragung und Receipt-Schreiben entfallen. |
| Abgebrochener oder teilweiser Stage | B | Fehlendes Receipt, fehlende Datei, zusätzlicher Eintrag, Symlink, Spezialdatei oder abweichende Bindung werden fail-closed klassifiziert. Der Inhalt wird weder gelöscht noch überschrieben. |
| Retry mit identischem Bundle | B | Derselbe gebundene Produkt- und Operationscommit, Manifest, Image-IDs, Archive, Override, Compose-Dateien und Source-Tree-Digest ergeben eine unveränderte Stage-Wiederverwendung ohne Transfer. |
| Neubau für gleichen Produktcommit mit anderem Manifest/Image-IDs | B | Das Release-Verzeichnis ist nach Produktcommit benannt; die erneute Prüfung vergleicht den expliziten Manifest-SHA und beide unveränderlichen Image-IDs. Ein abweichender Bundle-Neubau stoppt, statt bestehende Inhalte zu ersetzen. |
| Vorhandenes Install-Receipt | B | Install- und Stage-Receipt bleiben semantisch getrennt. Ein vollständig passendes installiertes Release wird bei `stage` und `apply` vor Lock-Erwerb als `already_installed` gemeldet; `apply` prüft den Zustand nach Lock-Erwerb erneut, bevor es Vorgängerdateien überschreibt oder Images lädt. In beiden Fällen müssen Receipt und aktiver Installed-Marker auf den gebundenen Kandidaten passen. Teil-, Drift- oder widersprüchliche Zustände blockieren; ein vor Aktivierung erlangter Lock wird freigegeben. |
| Stage-Receipt | B | Das P1-Receipt bleibt erhalten und bindet nun zusätzlich den vollständigen Source-Baum. Es wird nur bei neuem Stage geschrieben; Apply prüft die Stage-Bindung erneut. |
| Receipt-Marker allgemein | A/B | P1 unterscheidet Stage-, Install- und Installed-Marker sowie Phasen-/Ergebnismarker. P2 ergänzt `staged_reused` und `already_installed`; unbekannte oder widersprüchliche Release-Einträge scheitern. |
| Source-Root | B | P1 bindet den realen sauberen Produktcheckout und prüft die Compose-Dateien. P2 bindet zusätzlich den kanonischen vollständigen Export mit Manifest v3 `sourceTreeSha256`; Symlinks, Spezialdateien und ungebundene Zusatzdateien werden abgelehnt. |
| Detached-/Clean-/HEAD-Bindung des Betriebswerkzeug-Roots | A | Der P1-Operator verlangt explizite getrennte Checkouts; Operations-HEAD muss exakt dem Operationscommit entsprechen, der Checkout detached und einschließlich untracked Dateien sauber sein. Keine implizite Working-Tree-Ausführung. |
| Runtime-Identität | A | P1 ordnet den installierten Release-Marker und dessen Receipt dem real laufenden Runtimezustand zu; Preflight und Release-State-Validator prüfen Bindungen vor Kandidaten- und Rollbackaktionen. |
| Compose-/Container-Labels | A | P1-Preflight prüft Compose-Projekt, Working Directory, Config-Dateien und Service-Labels der Platform- und Edge-Container. #712s `bind_release_runtime`-Implementierung wird nicht dupliziert. |
| Kandidatenbindung | A | Manifest, Produktcommit, Operationscommit, Runtime-/Web-Image-IDs und Archive werden in P1 getrennt gebunden. P2 ergänzt die Source-Tree-Bindung, ohne Image-IDs oder Digestprüfungen abzuschwächen. |
| Override-Bindung | A | P1 erlaubt nur den exakten Kandidaten- oder Vorgänger-Overridepfad, prüft die Image-Zuordnung und validiert Compose vor Aktivierung. |
| Vorgänger-/Rollback-Bindung | A | P1 verwendet den unter Lock beobachteten Vorgängerrelease und validiert dessen Install-/Manifest-/Image-Bindung. Bei fehlendem Nachweis wird kein Release erraten. |
| Rollback-Verhalten | A | Der neue P1-Rollback verwendet den lokal gebundenen vorherigen Release und braucht nach Aktivierungsbeginn kein GitHub oder Git-Netz. Der historische #712-`previous-images`-Fallback wird nicht zum neuen Operatorpfad. |
| Smoke nach Aktivierung | A | P1 führt den authentisierten read-only `/api/production/v1/production/plans`-Smoke gegen den aktivierten Intake-Kandidaten aus; ein Fehler geht in den gebundenen Rollbackpfad oder endet mit manueller Wiederherstellung. |
| Postflight-, Health- und Auth-Smoke-Diagnosemarker aus #712 | B | P2 gibt getrennte Start-/Erfolgsmarker für Postflight, Health und Auth-Smoke aus, dazu Health-Ergebnisse je Intake-/Offer-/Production-/Exports-Service sowie `TARGET_AUTH_SMOKE_STAGE` für Payload, Login-, Session- und Production-Read-Response/Erfolg. Die Marker enthalten keine Zugangsdaten oder Response-Inhalte. |
| `TARGET_UPDATE_STAGE`- und Ergebnis-Marker | A/B | P1 gibt Phasen-/Ergebnismarker aus. P2 kennzeichnet sichere Wiederverwendung, bereits installierte Bundles und Postflight-/Health-/Auth-Smoke-Schritte gesondert; unbekannte Releasezustände bleiben Fehler. |
| Release-Datei-/Layout-Prüfungen | B | P2 akzeptiert nur den festgelegten Top-Level-Inhalt und den per Manifest gebundenen rekursiven Source-Baum. Dateityp, SHA, Owner und Modus aller Stage-Artefakte werden geprüft. |
| Reale Ownership-/Modus-Erkenntnisse | B | Die 0755-Annahme für `source/` hängt nicht mehr von der Mac-umask ab. Transfer setzt Root-Ownership durch den privilegierten rsync-Empfänger voraus; der anschließende Validator weist abweichende Owner/Modi zurück. |
| #712s gebündelter direkter `--update`-Ablauf | C | Der Ein-Schritt-Updateweg wird nicht in den versionierten Operator zurückgeführt. `validate`, `bundle`, `preflight`, `stage`, `apply` und `verify` bleiben getrennt. Der historische GitHub-Workflow-Kontext ist nur für Kompatibilität im Runner zugelassen und organisatorisch weiter nicht auszulösen. |

Für die aufgelisteten #712-Betriebskenntnisse verbleibt kein ungeklärter Reconciliation-Punkt (**kein D**). Die älteren v1-/v2-Installationsbelege bleiben nur für vorhandene Install-/Rollbackprüfungen lesbar; sie erlauben keine neuen Stage-Kandidaten. O-1 bis O-8 bleiben als frühere Review-Beobachtungen außerhalb der P2-Reconciliation offen; P2 hat sie nicht als allgemeine Nebenbaustellen umgesetzt oder als erledigt erklärt.

**#712 ist inhaltlich absorbiert und für den dauerhaften Updateweg nicht mehr als Codequelle erforderlich.** Der PR wird durch diese Dokumentation nicht geschlossen; seine Schließung bleibt eine separate GitHub-Aktion.

## Zugangsdaten der unveränderten GitHub-Zielworkflows

Die vorhandenen GitHub-Zielworkflows verwenden ausschließlich dedizierte `CATERING_TARGET_*`-Secrets. Schlüssel und known_hosts werden temporär unter `RUNNER_TEMP` angelegt und am Ende entfernt. Der neue Mac-Operator verwendet diese Actions-Secrets nicht.

## Lokale Zugangsdaten für den Mac-Operator

Für die Zielphasen `preflight`, `stage`, `apply` und `verify` erwartet der Runner die Umgebungsvariablen `CATERING_TARGET_DEPLOY_HOST`, `CATERING_TARGET_DEPLOY_USER`, `CATERING_TARGET_SSH_KEY_FILE` und `CATERING_TARGET_SSH_KNOWN_HOSTS_FILE`. `apply` benötigt zusätzlich `CATERING_TARGET_SMOKE_BASIC_AUTH_USER`, `CATERING_TARGET_SMOKE_BASIC_AUTH_PASSWORD`, `CATERING_TARGET_SMOKE_LOGIN_CODE` und `CATERING_TARGET_SMOKE_PIN`. Werte werden nur zur Laufzeit lokal bereitgestellt; sie gehören weder in Shellargumente noch in Dateien, Logs oder Bundle-Artefakte.

SSH erzwingt:

- BatchMode;
- IdentitiesOnly;
- StrictHostKeyChecking;
- explizites UserKnownHostsFile;
- festen Port 22.

Secretwerte werden weder in dieses Dokument noch in das Repository geschrieben.
`apply` prüft, dass alle vier Smoke-Variablen vor einem Zielkontakt gesetzt und nicht leer sind; spätere Prüfungen kehren kontrolliert mit Fehler zurück, damit die vorhandene Rollback-Behandlung greifen kann. `stage` und `apply` verlangen getrennte Bestätigungen: `STAGE_CATERING_TARGET` überträgt Artefakte, `ACTIVATE_CATERING_TARGET` startet die spätere Aktivierung. `verify` benötigt keine Smoke-Secrets und führt keine GitHub-Abfrage aus.

## Read-only Preflight des unveränderten GitHub-Workflows

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
- `/etc/catering-target/runtime.env` als root:root 0600; Existenz, Symlinkstatus und Metadaten werden wegen der root-only Ablage ausschließlich read-only über `sudo -n test/stat` geprüft, ohne den Secretinhalt auszugeben;
- getrennte Bindung von Repository-Quelldateien und den sechs bestätigten installierten Runtime-Dateien aus Contract v2 und Runtime-Inventar;
- root:root-0644-Metadaten und SHA-256-Bindung der vier Target-Compose-Dateien, der Edge-Caddy-Konfiguration und der privaten Target-Site;
- Docker-Compose-Projekt, Working Directory, Config-File-Labels und Service-Label der sechs Platformcontainer und des Edge-Containers;
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

Der Remote-Preflight transportiert den absichtlich leeren Lock-Owner im unlocked/read-only Lauf als festen nichtleeren Sentinel, weil OpenSSH leere Remote-Argumente beim Aufbau der Remote-Kommandozeile nicht zuverlässig als Positionsparameter erhält. Vor dem Lesen der 30 Remote-Argumente wird deren Anzahl fail-closed geprüft; eine Abweichung meldet `TARGET_PREFLIGHT_FAIL gate=remote_argument_count`.

Fehler im read-only Preflight müssen dabei einen nicht-sensitiven Gate-Namen auf stderr ausgeben:

`TARGET_PREFLIGHT_FAIL gate=<gate>`

Bei den sechs statisch gebundenen Target-Dateien wird zusätzlich zwischen fehlender Datei (`*_file`), Symlink (`*_symlink`), nicht lesbarem/ungültigem SHA-256 (`*_hash_read`) und einem tatsächlich abweichenden SHA-256 (`*_hash`) unterschieden. Damit schwächt die Diagnose keinen Hashvergleich ab und gibt weder Soll- noch Ist-Hash aus.

Die Gate-Namen beschreiben nur die fehlgeschlagene Prüfkategorie, z. B. `platform_base_hash`, `backup_observer_health`, `docker_network_set`, `schema_version`, `web_network`, `edge_ports` oder `postgres_volume`. Tatsächliche Secretwerte, Hashes, Pfade, Hostdaten oder sonstige Zielwerte werden durch diese Diagnose nicht ausgegeben. Zusätzlich existieren grobe Marker für Fehler beim installierten Schemaquell-Read, beim Runtime-DDL-Manifest und im gesamten Remote-Invariantenblock.


### Lock-Grenze des read-only Preflights

Read-only bedeutet hier: Der Preflight legt **keinen** `/opt/catering-target-update.lock` an, verändert keine Container, Dateien, Firewall-, Netzwerk- oder Anwendungszustände und startet keinen Updatepfad.

Der Backup-Observer darf bei `--check` zur konsistenten Beobachtung kurzzeitig einen exklusiven, nicht blockierenden `flock` auf seiner **bereits vorhandenen, read-only geöffneten** Observer-Lockdatei halten. Dieser Synchronisations-Lock ist kein Deployment-/Update-Lock. Laut Observer-Vertrag schreibt `--check` keinen Observerstatus und führt weder Docker, Restic, Dump, Restore noch Reparaturen aus.


## Kanonisches Laufzeitinventar

Der tatsächliche Zielzustand wird ab 23.09.2026 zusätzlich in `platform-infra/catering-target-runtime-inventory.json` maschinenlesbar geführt. Das Inventar unterscheidet ausdrücklich zwischen bestätigten Beobachtungen, aus laufenden Docker-Compose-Labels abgeleiteten Pfaden und noch nicht separat bestätigten Zuständen; unbekannte Werte dürfen nicht als Annahmen ergänzt werden.

Zwei separat freigegebene, jeweils auf genau eine SSH-Sitzung begrenzte read-only Diagnosen auf dem an `25a62be3a18142977e552081b90b802933971ef0` gebundenen Stand haben das Runtime-Layout vollständig für die sechs relevanten Dateien bestätigt. Alle sechs Plattformcontainer melden Compose-Projekt `platform-infra`, Working Directory `/opt/catering-agents-platform/platform-infra` und `compose.json` plus `operations.json`. Der Edge-Container meldet Projekt `catering-edge`, Working Directory `/opt/catering-edge` und ebenfalls `compose.json` plus `operations.json`. Diese vier Compose-Dateien sowie `/opt/catering-edge/Caddyfile` und `/opt/catering-agents-platform/platform-infra/sites/catering-target.caddy` sind reguläre root:root-0644-Dateien und stimmen jeweils bytegenau per SHA-256 mit der zugeordneten Repository-Quelldatei am Vergleichscommit überein; Hashwerte und Dateiinhalte wurden nicht ausgegeben.

Die vier zuvor vom Preflight erwarteten Remote-Pfade mit Repository-Dateinamen `docker-compose.catering-target*.json` sind auf dem Ziel nicht vorhanden. Das war ein Vertragsmodellfehler: Repository-Quelldateien wurden zugleich als installierte Remote-Dateinamen verwendet. Contract-Schema v2 trennt deshalb `repositorySourcePaths` strikt von `installedRuntime`. Der Produktionsrunner validiert diese Bindung lokal gegen das bestätigte `catering-target-runtime-inventory.json`, übergibt dem Remote-Preflight die installierten Pfade explizit und prüft zusätzlich root:root:0644, SHA-256 sowie die Docker-Compose-Labels der laufenden Platform- und Edge-Container. Runtimepfade werden nicht mehr aus Repository-Dateinamen konstruiert. Bis dieser v2-Stand CI-geprüft und gemergt ist, bleibt der echte Preflight fail-closed und es gibt kein Deployment-GO.

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

Der versionierte Operator baut das lokale Bundle getrennt von Zielprüfung und Aktivierung:

1. Runtime- und Web-Image entstehen für `linux/amd64` aus dem exakten Produktcommit auf dem Operator-Mac;
2. beide müssen als immutable `sha256:...`-IDs vorliegen und ihre Docker-Archive müssen dieselbe Image-ID belegen;
3. der Candidate-Override enthält ausschließlich die fünf Appdienste und jeweils nur das Feld `image`;
4. PostgreSQL und Edge werden nicht als Kandidaten gebaut oder ersetzt;
5. Manifest, Override und komprimierte Image-Archive werden gegenseitig über SHA-256 gebunden.

`stage` überträgt die bereits gebauten Images, den Candidate-Override, das Manifest und die Produktquelle in einen neuen Releasepfad; es baut nicht und lädt keine Images. `apply` baut nicht neu und überträgt keine Dateien. Es prüft lokales Bundle, remote Stage-Receipt und alle Artefakt-Digests erneut, lädt die gebundenen Images und prüft Manifest, Stage-Receipt und Override unmittelbar vor der Aktivierung erneut im selben Remote-Aufruf.

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

`stage` schreibt nur in einen noch nicht vorhandenen, durch den Produktcommit benannten Releasepfad. Existiert der Pfad bereits, wird er ausschließlich read-only klassifiziert: Nur ein vollständig identisches Stage mit gültigem Stage-Receipt und exakt erwartetem Layout darf ohne Transfer wiederverwendet werden. Installierte, teilweise, abweichende oder unbekannte Zustände werden nicht überschrieben oder gelöscht und enden fail-closed. Vor der Aktivierung in `apply` wird `/opt/catering-target-update.lock` exklusiv angelegt; Owner-Datei und Modi werden fail-closed geprüft.

Vor Aktivierung werden die aktuell laufenden Image-IDs von Intake, Offer, Production, Exports und Web als `previous-images.json` im Release gebunden. Die unveränderten PostgreSQL-Volume- und Edge-Image-Bindungen stammen aus dem Preflight. Der Stage-Receipt bindet Produktcommit, Betriebswerkzeug-Commit, Manifest-Digest, Override-Digest, beide Archiv-Digests und Image-IDs.

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
4. Beim versionierten Mac-Operator ein Read der Produktionspläne über `/api/production/v1/production/plans` mit dem an den Betriebswerkzeug-Commit gebundenen Smoke-Skript. Der unveränderte GitHub-Legacypfad verwendet weiterhin sein bestehendes Produkt-Skript.

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

Der Lock bleibt absichtlich bestehen; der Zustand darf nicht automatisch als gesund behandelt werden. Schlägt eine vor Aktivierungsbeginn erforderliche SSH-Lock-Freigabe fehl, bleibt `LOCK_HELD` gesetzt, der Prozess endet fehlerhaft und meldet manuelle Wiederherstellung statt einen erfolgreichen No-op oder eine freigegebene Sperre zu behaupten.

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

Vor dem ersten echten Zielzugriff sind erneut erforderlich:

1. ausgewählter Produktcommit in `origin/main` mit erfolgreicher `CI` auf exakt diesem SHA als `push` auf `main`;
2. ausgewählter Betriebswerkzeug-Commit in `origin/main` mit erfolgreicher `CI` auf exakt diesem SHA als `push` auf `main`;
3. frischer read-only Zielzustand;
4. Bestätigung, dass Backup-Observer und Rückweg weiterhin gesund sind;
5. lokal verfügbare, passende Zielzugangsdaten auf dem autorisierten Operator-Mac;
6. ausdrückliche Betriebsfreigabe für genau diese Commit- und Bundlebindungen.

Bis dahin gilt: **kein Dispatch, kein SSH-Live-Lauf, kein Deployment.**
