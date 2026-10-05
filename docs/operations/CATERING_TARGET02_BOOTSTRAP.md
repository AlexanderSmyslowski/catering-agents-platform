# CateringOS prod-02: gebundener Erstaufbau

**Implementierung zur unabhängigen Prüfung. Kein Host wurde damit eingerichtet.**
Der normale Produktions-Preflight bleibt erhalten: sieben Container, reale
Runtime-Dateien, gesunder Backupbeobachter, Writer enabled und die bestehenden
Preservation-/Receipt-Gates. Es gibt keinen `skip-preflight`-Schalter.

Dieser begrenzte Pfad ergänzt den bestehenden [Operator](CATERING_TARGET_UPDATE.md).
Er gilt ausschließlich für `catering-prod-02`, Hetzner **168651076**, **2.28.200.16**,
CX33, Ubuntu 24.04, x86_64. Quelle bleibt 166533273 / catering-prod-1 / 2.29.43.174.
Die führende konkrete Migrationsvorbereitung bleibt das lokale
`CateringOS-Migration-Preparation-168651076-20261004/RUNBOOK.md`.

## Bindungen und getrennte Wahrheiten

- `--target catering-prod-02` ist obligatorisches Opt-in. Ohne Angabe bleibt
  ausschließlich prod-1 kompatibel. Unbekannte Ziele und Zielverwechslungen werden abgewiesen.
- Operationsvertrag/Prüfcode kommen aus dem **neuen angenommenen Operationscheckout**;
  Compose und der gesamte Sourcebaum kommen aus dem Produktcheckout.
- Produkt ist **9ce4fbc96a5dd877f2cd2f00588a22be861306b9**, PG **17.9**, Schema **3**.
  Der Entwicklungs-Main `9c09aa98…` mit PWA ist keine Migrationsproduktfreigabe.
- `b1e3d44573bf6fe6d3c8e46861792a592535e856` bleibt historische Quell-Operationsbasis.
  Neue target02-Bindungen verlangen einen anderen, regulär angenommenen SHA.
- Das alte P4-Bundle und seine Receipts bleiben unverändert. Die neue Manifestbindung
  trägt `migrationSource` mit altem Ziel, Operationscommit und Manifest-SHA
  `9a0bb5c49fd09a9e64a99d00babf69ac771e66238ec5ae728eeedebe7ed79df0`.
- Wiederverwendung kopiert geprüfte Archivbytes. Runtime-A
  `3e540113a4dfbe272d15c8eac5713f0911c2fc0831873e87e9d35588701ba43b`,
  Web-A `886d43cde21132b644f91c5a7f52c578a2bc2e6e31b533fd31ff96ea98f64166`.
  Erste Appausführung verwendet zwingend Runtime-M
  `sha256:6ba5bef903323aa5f4fdc63d1043b627fdaed1cb681526ba19b94a7d7f72c0f3`
  und Web-M `sha256:3e45d18ffae79f78d84a4018aa52ac17419f29f2bda3e49ccb3e94311440d48e`.
  Neubau und Pull sind ausgeschlossen.
- `catering-target02-update-contract.json` ist ein beabsichtigter Vertrag.
  Er ist kein beobachtetes Runtimeinventar. Das prod-1-Inventar bleibt unverändert.

## Vorbedingungen, die gegenwärtig offen bleiben

Die Codeannahme ist keine Ausführungsfreigabe. Vor jedem späteren Hostkontakt:
angenommener exakter Operations-SHA samt main/push-CI, frische geschützte Provider-
und Hostkeybindung, ausdrückliches Wartungsfenster und Schreibpause, Ressourcenbudget,
vollständiges Quellinventar, vollständige DB-/Datei-/Authsicherung und Rückfallfreigabe.
PG- und Edge-Archive sind derzeit nicht nachgewiesen. Alle unbekannten Bestände bleiben
unbekannt. Die neuen Helfer beschaffen keine dieser Eingaben selbst.

Der Zielhost benötigt vorab geprüftes Python 3, Docker/Compose mit dem gebundenen
Image-Store-Verhalten, GNU-Werkzeuge, `systemctl`, ausreichend Platten-/Inode-/RAMreserve
und einen sauberen detached Operationscheckout aus dem richtigen Repository. Diese
Datei ist kein Paketinstaller. Die Sicherheits-/Betriebsprüfung dieses Hostfundaments
bleibt eigenständig. Keine automatische Fremdinstallation, kein universeller Multihost-Dispatcher.

## Geschützte Eingaben

Alle folgenden Dateien liegen **außerhalb von Git, Hub und Berichten**, root:root
0600 auf dem Ziel (auf dem Mac Eigentümer des Operators). Keine Secretwerte in argv.
Nicht aus Beispielen einen Erfolgsbeleg erzeugen: die Inhalte sind frisch erhobene,
geschützt übergebene und vor Ausführung geprüfte Beobachtungen.

`access.json` enthält `windowStart`/`windowEnd` als UTC-ISO-Zeitpunkte (höchstens acht
Stunden), den tatsächlichen Hetzner-`server`-Datensatz mit `id`, `name`,
`public_net.ipv4.ip`, `server_type.name`, `server_type.architecture`,
`image.os_flavor`, `image.os_version` sowie `hostKeyFingerprint` (SSH SHA256).
`known_hosts` enthält genau eine explizite `2.28.200.16 ssh-ed25519 …`-Zeile.
Der Prüfer vergleicht Providerkennung, IP, Namen, Architektur/OS und Hostkey; der
spätere SSH-Transport verwendet strikt diese IP und `StrictHostKeyChecking=yes`.

`migration-inputs.json` wird über seinen ausdrücklich übergebenen SHA gebunden:

| Feld | Inhalt / Herkunft |
| --- | --- |
| `targetId`, `serverId`, `productCommit`, `operationsCommit` | Exakte neue Ziel-/Commitbindung |
| `windowStart`, `windowEnd` | Tatsächlich freigegebenes Zeitfenster |
| `sourceInventory` | Für jeden unten genannten Bereich ein `{path, sha256}` auf die geschützte vollständige Quellbeobachtung |
| `fullDatabaseDump`, `rolesDump`, `databaseSettings`, `sourceFence`, `fileInventory`, `smokeCredentials` | Je `{path, sha256}`, alle obligatorisch |
| `dumpFormat`, `postgresVersion`, `schemaVersion` | `custom-with-owners-and-acls`, `17.9`, `3`; zusätzlich prüft der Helfer reale Archivmagic und restaurierten Server/Schema |
| `logicalDigests` | `{database, globals}`: SHA-256 der unten beschriebenen vollständigen logischen Quellausgaben |
| `infraArchives` | `postgres` und `edge`, jeweils `{path, sha256}`; echte OCI-Bytes müssen die exakt gepinnten PG-/Edge-IDs enthalten |
| `resources` | Positive, vorab dimensionierte Mindestreserven `freeBytes`, `freeInodes`, `availableRamBytes`; reale Werte werden je Phase gemessen |

`sourceInventory` muss alle Bereiche enthalten: `database`, `roles`, `owners`, `acls`,
`settings`, `extensions`, `tablespaces`, `sequences`, `large_objects`, `auth`,
`uploads`, `documents`, `configuration`, `caddy`, `os_identity_mapping`.
Hashprüfung dieser Eingaben ersetzt keine unabhängige Prüfung ihrer Vollständigkeit.
Unbekannte Mounts, Zusatzpfade, Tablespaces, Writer oder Authspeicher halten die
Migration an; den aktuellen begrenzten Pfad dafür nicht ad hoc erweitern.

`sourceFence` enthält `serverId=166533273`, `ip=2.29.43.174`, das freigegebene
Zeitfenster, die tatsächliche vollständige `dockerInspect`-Beobachtung aller sieben
Quellcontainer (gestoppt, Restart-Policy `no`), `scheduledCateringUnits` und
`runningCateringUnits` (nach abgeschlossenem Backup-/OnSuccess-Zyklus leer) sowie
`firewallRulesetSha256`. Die zugehörige Firewallbeobachtung muss vor Freigabe geprüft
sein. Dieser geschützte, zeitlich begrenzte Quellbeleg ist eine externe Voraussetzung;
der Zielhelfer behauptet keine eigene Live-Quellabfrage. Änderungen an Fencing,
Direkt-IP-/DNS-Erreichbarkeit oder Automatik invalidieren ihn.

`fileInventory` ist ein Objekt `absoluter Zielpfad -> vollständige Recordliste`.
Die Listen entsprechen `file_inventory(path)` im Bootstraphelfer: relative Pfade,
Typ, UID/GID, Modi, Inhalts-SHA beziehungsweise Symlinkziel, Hardlinkbeziehung und
xattr-SHAs (einschließlich Linux-ACLs). Erforderlich sind Datenwurzel, runtime.env,
Sites und beide Plattform-/Edge-Caddy-Volumes. Optionale .env-Dateien und Edge-Caddyfile
sind ausdrücklich begrenzt. Keine globale Benutzerdatei-/Shadowkopie, kein rohes
PostgreSQL-Datenvolume und keine fremden Docker-Volumes übernehmen. Der geschützte
Zielvergleich berücksichtigt ausschließlich **vorab geprüfte Zielkonfigurationsdeltas**
(z.B. Writer disabled); Auth-/Secretänderungen dürfen nicht als Zielwechsel versteckt werden.
`smokeCredentials` enthält ausschließlich `basicUser`, `basicPassword`, `loginCode`, `pin`
des bestehenden geeigneten Read-only-Smoke-Accounts; sie gelangen nur über stdin in Docker.

## Ausführbare Reihenfolge nach gesonderter Freigabe

Die folgenden Befehle sind Anweisungen für das spätere freigegebene Fenster. In diesem
Repositoryauftrag wurden sie nicht ausgeführt. Fehler bedeutet HALT und Evidenz erhalten;
keine Wiederholung eines unklaren Schritts.

1. **Mac, angenommene Checkouts:** `OPS` ist der neue saubere detached Operationscheckout,
   `PRODUCT_SOURCE` der separat gebundene Produktcheckout. `ACCEPTED_OPS_SHA` wird erst
   nach Annahme gesetzt; niemals den historischen b1-SHA einsetzen.

   ```bash
   python3 "$OPS/platform-infra/scripts/catering-target-operator.py" validate \
     --target catering-prod-02 --product-commit 9ce4fbc96a5dd877f2cd2f00588a22be861306b9 \
     --product-source "$PRODUCT_SOURCE" --operations-commit "$ACCEPTED_OPS_SHA"
   python3 "$OPS/platform-infra/scripts/catering-target-operator.py" reuse-migration-bundle \
     --target catering-prod-02 --product-commit 9ce4fbc96a5dd877f2cd2f00588a22be861306b9 \
     --product-source "$PRODUCT_SOURCE" --operations-commit "$ACCEPTED_OPS_SHA" \
     --source-bundle "$UNCHANGED_P4_BUNDLE" --output-dir "$NEW_TARGET02_BUNDLE"
   ```

   Neues Manifest-SHA aus der Ausgabe festhalten. Nur ein **neues** Verzeichnis wird
   akzeptiert; alte Archive, Manifeste und Receipts bleiben unangetastet. Exportierten
   Produktbaum und neue gehashte Stage-/OCI-Prüfer für den isolierten Bootstrap hinzufügen:

   ```bash
   python3 -B - "$OPS" "$PRODUCT_SOURCE" "$NEW_TARGET02_BUNDLE" <<'PY'
   import pathlib, runpy, shutil, sys, tempfile
   ops, product, bundle = map(pathlib.Path, sys.argv[1:])
   tool = runpy.run_path(str(ops / 'platform-infra/scripts/catering-target-operator.py'))
   with tempfile.TemporaryDirectory() as tmp:
       export = pathlib.Path(tmp) / 'source'
       tool['export_product_context'](product, tool['MIGRATION_PRODUCT'], export)
       shutil.copytree(export, bundle / 'source')
   for original, target in [('catering-target-stage-binding.py', 'stage-binding.py'), ('catering_target_oci.py', 'catering_target_oci.py')]:
       shutil.copyfile(ops / 'platform-infra/scripts' / original, bundle / target)
       (bundle / target).chmod(0o644)
   PY
   python3 "$OPS/platform-infra/scripts/catering-target-bootstrap.py" access \
     --access-evidence "$ACCESS_EVIDENCE" --known-hosts "$KNOWN_HOSTS" --host 2.28.200.16
   ```

2. **Geschützte Bereitstellung im freigegebenen Zugangsweg:** neues Release nach
   `/opt/catering-releases/9ce4fbc96a5dd877f2cd2f00588a22be861306b9`, Verzeichnisse root:root
   0755, Dateien 0644 und exportierte ausführbare Produktdateien 0755. Sourcebaum
   nicht umformen. Root-Empfänger verwenden (`rsync --no-owner --no-group`), keine
   Mac-UID/GID übernehmen. Sauberen angenommenen Operationscheckout separat bereitstellen;
   protected inputs/Archive/config root:root 0600 außerhalb beider Checkouts halten.
   **Kein normales `stage` auf dem leeren Host:** dessen Produktions-Preflight bleibt
   absichtlich unverändert. Keine alten prod-1-Receipts übertragen.

3. **Ziel lokal als root:** gemeinsame Parameter setzen. `observe` ist lesend und
   meldet ausschließlich einen beobachteten Containerzustand, niemals „installiert“.

   ```bash
   BOOT="$OPS/platform-infra/scripts/catering-target-bootstrap.py"
   COMMON=(--access-evidence "$ACCESS_EVIDENCE" --known-hosts "$KNOWN_HOSTS" --host 2.28.200.16
     --operations-commit "$ACCEPTED_OPS_SHA" --manifest-sha256 "$NEW_MANIFEST_SHA256"
     --inputs "$MIGRATION_INPUTS" --inputs-sha256 "$MIGRATION_INPUTS_SHA256")
   python3 -B "$BOOT" observe "${COMMON[@]}"
   python3 -B "$BOOT" prepare "${COMMON[@]}"
   python3 -B "$BOOT" load "${COMMON[@]}"
   ```

   `prepare` validiert das vollständige Release, schreibt den gebundenen Stage-Receipt,
   richtet ausschließlich bekannte Runtime-Dateien ein und hält den gemeinsamen
   Update-Ausschluss. `load` lädt die vier vorab gehashten Archive ohne Pull und prüft
   tatsächliche unveränderliche Image-IDs. Fehlende PG-/Edge-Archive halten bereits
   vor Einrichtung an. Es gibt kein erfolgreiches manuelles Boolean-Receipt.

4. **Konfiguration/Dateien und Datenbank:** geprüfte geschützte Zielkonfiguration
   bereitstellen (`runtime.env` root:root 0600, Writer nicht enabled), dann:

   ```bash
   python3 -B "$BOOT" postgres "${COMMON[@]}"
   ```

   Dies startet ausschließlich PostgreSQL auf internen isolierten Netzen. Kein Appstart.
   Fehlende Caddy-Datenvolumes vor Dateirestore explizit ohne Container anlegen:

   ```bash
   docker volume create platform-infra_caddy_data
   docker volume create platform-infra_caddy_config
   docker volume create catering-edge_edge_caddy_data
   docker volume create catering-edge_edge_caddy_config
   ```

   Danach die geschützte, quellbezogen geprüfte Restore-Reihenfolge anwenden. Bestehende
   Bootstraprolle `catering` gezielt abgleichen; **kein blindes Roles-dump-Replay**, keine
   pauschale Ownerumschreibung, kein Fehlerignorieren. `roles-reconcile.sql` und
   `tablespaces-extensions.sql` müssen aus dem tatsächlichen Inventar geprüft vorliegen.
   Ohne diese Prüfung bleibt der Schritt gesperrt.

   ```bash
   docker exec -i platform-infra-postgres-1 psql --no-psqlrc --no-password \
     --username=catering --dbname=postgres --set=ON_ERROR_STOP=1 < "$ROLES_RECONCILE_SQL"
   docker exec -i platform-infra-postgres-1 psql --no-psqlrc --no-password \
     --username=catering --dbname=catering_agents --set=ON_ERROR_STOP=1 < "$TABLESPACES_EXTENSIONS_SQL"
   docker exec -i platform-infra-postgres-1 pg_restore --no-password --username=catering \
     --dbname=catering_agents --exit-on-error --single-transaction < "$FULL_DATABASE_DUMP"
   docker exec -i platform-infra-postgres-1 psql --no-psqlrc --no-password \
     --username=catering --dbname=postgres --set=ON_ERROR_STOP=1 < "$DATABASE_SETTINGS_SQL"
   ```

   Dump ohne `--no-owner`, `--no-privileges` oder Tabellenfilter. Eigentümer,
   Default-ACLs, Rollenmitgliedschaften/-attribute/-verifikatoren, DB-/Rollensettings,
   Extensions und Tablespaces vollständig wiederherstellen. Der bestehende reduzierte
   Backupdump genügt nicht. Dateien je freigegebenem Inventarpfad mit Eigentümern,
   Hardlinks, ACLs/xattrs und Symlinks wiederherstellen (z.B. geprüfter
   `rsync -aHAX --numeric-ids`-Aufruf pro Pfad, ohne Delete); keine Pfade erraten.

   Die vollständigen logischen Quellvergleichswerte werden bei PG17.9 aus
   `pg_dump --username=catering --no-password --dbname=catering_agents --create --format=plain`
   und `pg_dumpall --username=catering --no-password --globals-only` erhoben. Nur die
   zufälligen `\restrict`-/`\unrestrict`-Tokenzeilen werden vor SHA256 entfernt
   (`logical_digest` im Helfer). Ausgaben können Secrets enthalten und bleiben geschützt.
   Der Zielhelfer führt genau dieselben Reads selbst aus und vergleicht vollständige
   Hashes, zusätzlich reale PG-/Schemaversion und alle Dateiinventare:

   ```bash
   python3 -B "$BOOT" verify-restored "${COMMON[@]}"
   ```

5. **Erster Appstart = Schreibgrenze:** Quelle weiterhin wirksam eingezäunt,
   Eingaben/Fenster/Ressourcen frisch, automatische Jobs und Heartbeat aus,
   kein öffentlicher Edge und kein öffentliches Docker-Netz.

   ```bash
   python3 -B "$BOOT" start "${COMMON[@]}"
   python3 -B "$BOOT" verify-install "${COMMON[@]}"
   ```

   `start` vergleicht Restore und Isolation erneut, prüft effektive Compose-Images und
   schreibt **vor** Appausführung exklusiv `first-app-write.json`. Compose verwendet
   Base + P4-Candidate-Override, Restart `no`, `--no-deps --pull never`. Selbst ein Fehler
   unmittelbar danach gilt als mögliche Zielschreibwirkung und sperrt automatischen Retry.
   `verify-install` prüft echte Containeridentitäten, M-Descriptor, Netze/Restart/Ports,
   PG17.9/Schema3, HTTP-Health und den gebundenen authentisierten Read-Smoke. Auch dessen
   Login-/Session-/Auditwrites liegen bereits hinter der markierten Schreibgrenze.
   Erst danach entstehen `bootstrap-verification.json`, `installation_kind=initial`
   im Install-Receipt und der installierte Marker. Kein `previous-images.json` wird erfunden.

## Danach: eigener Produktionsfreigabeschritt

Ein verifizierter Erstaufbau bedeutet **isolierte Erstinstallation**, nicht produktiver
Writer. Stage-/Release-State-Prüfer und der normale Install-Receipt-Prüfer können diesen
Initial-Receipt vollständig gebunden lesen; veränderte Belege bleiben abgewiesen.
Der normale Produktions-Preflight bleibt bis zur separat geprüften Betriebsfreigabe rot.
Insbesondere müssen produktive Compose-Labels/Restart-Policy (PG aus kanonischem
Runtimepfad; Apps Base + Operations + Candidate), sieben Container einschließlich Edge,
Backupkette und frische target02-Attestation erst in diesem eigenen Schritt hergestellt
und geprüft werden. Die isolierten Bootstrap-Compose-Labels werden nicht als bereits
produktive Labels ausgegeben oder vom normalen Prüfer akzeptiert.

Die echte geplante Timer→Backup→OnSuccess-Restoreprobe, extern bestätigter Alarm-/Heartbeat-
Empfang, TLS/DNS und sole-writer-Freigabe bleiben getrennte spätere Gates. Der Bootstrap
startet oder aktiviert nichts davon. Ein neueres Produkt bleibt ebenfalls separat freizugeben.

Vor Zielwrites kann nach eigenständiger Prüfung die Quelle wieder freigegeben werden.
Nach irgendeinem Zielwrite beide Writer sperren und vollständigen aktuellen Zielstand
rückübertragen/prüfen, bevor die Quelle wieder öffnet. Kein normaler Rollback auf einen
nicht existierenden Vorgänger, kein DNS-only-Rückfall, keine Löschung alter Installation.
Fehler/Teilreceipt behalten Lock und Beweise; unbekannter Ausgang verlangt manuelle
Recovery im genehmigten Verfahren. Kein automatischer Retry oder künstlicher Installed-Marker.
