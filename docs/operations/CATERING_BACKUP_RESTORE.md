# Catering Backup/Restore – Vertragsnotiz

Dieser Slice beschreibt ausschließlich einen später separat freizugebenden,
repository-only Backup-Kandidaten und einen isolierten Restore-Probe. Es wurde
hier **kein Backup ausgeführt; kein Restore ausgeführt**; Produktion, Host, SSH, Docker und
Restic bleiben außerhalb dieses Fachturns.

## Grenzen

- RPO: 6 Stunden (21.600 Sekunden), RTO: 4 Stunden (14.400 Sekunden).
- Der Backup-Timer erzeugt zuerst einen versionierten Snapshot-Kandidaten und
  einen atomaren Kandidatenzeiger. Die autoritative Evidence wird dabei niemals
  geschrieben.
- Der Snapshot ist genau ein nicht-verboser Restic-`--stdin`-Tar-Stream mit
  relativen Pfaden (`manifest`, `postgres_dump` und eindeutige
  `components/*`-Kennungen). PostgreSQL-Dump und nicht geheimes Manifest dürfen
  nur im kurzlebigen Arbeitsroot liegen; Caddy-Daten, Sites und Caddyfile
  werden direkt aus den zuvor identitätsgeprüften Mountpoints in das
  verschlüsselte Off-host-Repository gestreamt. Es gibt keine lokale Caddy-
  Tar-/Bundle-Kopie.
- Nach dem Snapshot wird genau dessen `restic dump` streamend gehasht; dieser
  Whole-Stream-Hash wird in Kandidat und Artifact gebunden. Der Kandidat
  enthält keine temporären Hostpfade, sondern nur relative interne Tokens.
- Erst ein vollständig isolierter Restore darf Receipt und
  snapshotunabhängigen Repository-Status schreiben; die autoritative Evidence
  wird als letzter atomarer Schritt ersetzt. Bei jedem Fehler davor bleibt ein
  vorhandener Nachweis bytegleich.
- Jede Admission erzeugt zu Beginn genau eine unveränderliche
  Produktionsadress-Generation: live Interfaceadressen, die verpflichtende
  externe Betreiberangabe (`none` oder kanonische IP-CSV), deren Union und die
  einmalige Endpoint-Auflösung werden gemeinsam gebunden. Nachgelagerte
  Prüfungen verwenden ausschließlich diese Generation; eine Überschneidung
  oder Generationsabweichung stoppt fail-closed.
- Die Repository-Identität wird vor Snapshot, vor Kandidat/Zeiger und vor jeder
  Restore-Promotion über dieselben geschützten Deskriptoren frisch gelesen;
  ein Wechsel stoppt ohne Zeigerpromotion. Die vollständige Restore-Dauer wird
  unmittelbar vor Evidence einschließlich Receipt-/Status-Schreibzeit erneut
  gegen 14.400 Sekunden geprüft.
- Der Restore-Receipt ist versioniert und wird über `receipt_path` und
  `receipt_checksum` in der finalen Evidence gebunden. Der Repository-Status
  bleibt auf Status, Identität, Hostbindung, Scope und Verifikationszeitpunkt
  beschränkt.
- Restore liest ausschließlich den gebundenen Snapshot in einem root-only
  isolierten Restore-Root, prüft den Whole-Stream-Hash vor Extraction und
  bindet alle erwarteten Komponentenpfade. Danach nutzt es einen
  digestgepinnten PostgreSQL-Container mit `--pull never`,
  `--network none`, ohne Ports, Produktionsnetze, Produktionsvolumes oder
  Anwendungsdienste. Die beiden autoritativen Tabellen werden mit
  `pg_restore --exit-on-error` geprüft.

## Scope und Betreibergrenzen

Der Backup-Scope ist exakt `postgres,sites,platform-caddy,shared-edge-caddy`. Restic muss ein
Off-host-Ziel verwenden; Repository-/Passwortdateien sind root-owned und 0600.
Secrettragende Caddy-Daten werden ausschließlich im verschlüsselten Off-host-
Restic-Snapshot gesichert; es gibt keine unverschlüsselten lokalen Kopien,
Archive oder Logs. Es werden keine Secretwerte außerhalb dieses verschlüsselten
Snapshots ausgegeben oder geloggt, sondern höchstens stabile Hashes/Referenzen
aus einer unabhängigen Recovery-Quelle gebunden. Installation,
Timeraktivierung, tatsächlicher Backup/Restore, Ports 80/443 und Phase 3
benötigen eine separate Freigabe.

## Installations- und Recordpfade (nur Vertrag)

Die vorgesehenen Installationsziele sind `/usr/local/libexec/catering-backup.sh`
und `/usr/local/libexec/catering-restore-probe.sh`; die gemeinsamen
Datei-/Record-Primitiven liegen in
`/usr/local/libexec/catering-backup-common.sh`. Die drei Unit-Dateien gehören
unter `/etc/systemd/system/`, und die geschützte Konfiguration liegt als
`/etc/catering-backup/catering-backup.env` vor. Diese Pfade sind hier nur
dokumentiert; in diesem Slice wurde nichts installiert oder aktiviert.

Der dauerhafte State-Root ist `/var/lib/catering-backup`:

- `snapshots/catering-backup-artifact-<run-id>` – versionierter, nicht geheimer
  Artifact-Record;
- `candidates/catering-backup-candidate-<run-id>` – versionierter Candidate;
- `catering-backup-candidate` – atomarer Candidate-Pointer;
- `restore-receipts/catering-restore-receipt-<run-id>` – versionierter
  Restore-Receipt;
- `catering-backup-repository-status` – snapshotunabhängiger Statusrecord;
- `catering-backup-evidence` – autoritativer Nachweis, ausschließlich als
  letzter atomarer Promotionsschritt.

Der Restore-Probe-Root ist ausschließlich der systemd-managed flüchtige Pfad
`/run/catering-backup` (root-only, Modus 0700); darin liegen nur kurzlebige
Extraction-/Probe-Daten. Persistente Caddy-Archive oder Klartext-Bundles sind
verboten.

## Erforderliche Eingaben und Identitätsbindungen

Die Environment-Datei benennt nur Werte, die der Betreiber separat provisioniert:
`CATERING_BACKUP_EXPECTED_HOST_SHA256`,
`CATERING_BACKUP_SOURCE_COMMIT`, `CATERING_BACKUP_SOURCE_TREE`,
`CATERING_BACKUP_REPOSITORY_FILE`, `CATERING_BACKUP_PASSWORD_FILE`,
`CATERING_BACKUP_EXPECTED_REPOSITORY_SHA256` (SHA-256 of the canonical
locator line without its terminal LF),
`CATERING_BACKUP_EXPECTED_REPOSITORY_ID`,
`CATERING_BACKUP_PRODUCTION_HOST_SHA256`,
`CATERING_BACKUP_PRODUCTION_INTERFACE_ADDRESSES`,
`CATERING_BACKUP_PRODUCTION_EXTERNAL_ADDRESSES` (exakt `none` oder eine
kommagetrennte Liste gültiger IP-Literale),
`CATERING_BACKUP_PRODUCTION_ADDRESSES_SHA256`,
`CATERING_OFFHOST_ATTESTATION_FILE`,
`CATERING_OFFHOST_ATTESTATION_SHA256`,
`CATERING_SECRET_RECOVERY_ATTESTATION_FILE`,
`CATERING_SECRET_RECOVERY_ATTESTATION_SHA256`,
`CATERING_SECRET_RECOVERY_SOURCE_TYPE`,
`CATERING_SECRET_RECOVERY_SOURCE_REFERENCE`,
`CATERING_REQUIRED_SECRET_SCHEMA_SHA256`,
`CATERING_RESTORE_POSTGRES_IMAGE` und
`CATERING_SECRET_RECOVERY_REFERENCE_SHA256`. Die beiden Attestationsdateien
sind nicht geheim und müssen reguläre, root-owned Dateien mit Modus 0600 sein.
Die Off-host-Datei ist closed-world mit
`status=operator_attested`, Locator-/Endpointdigest, kanonischem aufgelöstem
Adresssatzdigest, Produktionsadresssatzdigest, externe Produktionsadressmenge,
Repository-ID,
Produktionshostbindung, festem Scope, UTC-`verified_at` und einer 64-Hex-
Attestations-ID. Die Secret-Recovery-Datei bindet denselben Repository- und
Hostdigest sowie Scope und UTC-Gültigkeit. Die Secret-Recovery-Datei bindet nur
die geschlossene Quellenklasse `github_environment` oder `offline_vault`, einen
operatorbereitgestellten kanonischen nicht geheimen `source_reference`, dessen
aus dem Locator berechneten SHA-256 und `required_secret_schema_digest`.
Das Schema umfasst mindestens Restic-Verschlüsselungspasswort,
Off-host-Repositoryzugang sowie `POSTGRES_PASSWORD`,
`CATERING_TRUSTED_ACTOR_SECRET` und `CATERING_BASIC_AUTH_PASSWORD_HASH`.
`verified_at`
darf nicht in der Zukunft liegen, `valid_until` muss danach liegen und der
gesamte Operator-Satz darf höchstens 30 Tage umfassen. Für die Backup-Aufnahme
müssen mindestens 21.600 Sekunden, für die Restore-Aufnahme mindestens 18.000
Sekunden Restgültigkeit verbleiben; RPO und Attestations-TTL sind getrennte
Verträge. Beide Werte werden vor jeder Promotion erneut geprüft. `operator_attested`
bezeichnet nur die abgelegte Betreiberattestation, keine automatisch
verifizierte externe Wahrheit. Die Produktionsadressmenge wird aus live
gelesenen globalen Interfaceadressen und separat provisionierten externen
Adressen kanonisch (IPv4/IPv6) gebildet; `none` bestätigt ausdrücklich das
Fehlen weiterer NAT-/Floating-Adressen. Endpoint-Überschneidungen sowie
lokale/reservierte Auflösungen bleiben fail-closed. Der Betreiber erneuert den
attestierten Satz monatlich atomar vor Ablauf; ab 48 Stunden Restgültigkeit
ist über den bestehenden Betriebs-/systemd-Status zu warnen. Eine Änderung von
Repository-ID/Locator, Host-/Adressmenge, Secret-Quelle, Scope oder
Secret-Schema erfordert sofortige Neuattestation. Automatische Erneuerung ist
nicht Bestandteil dieses Slices.
Die optionalen
`CATERING_BACKUP_ROOT`- und `CATERING_RESTORE_RUNTIME_ROOT`-Namen dürfen den
gebundenen Pfadvertrag nicht lockern; die drei `*_COMMAND`-Namen sind nur für
hermetische Test-Fakes vorgesehen. Es werden hier keine Werte oder Secrets
materialisiert.

Vor Capture und jeder Promotion werden Hostdigest, Source-Commit/Tree,
Off-host-Repositorydigest, kanonischer Endpoint-/Adresssatz und die
unabhängige Secret-Recovery-Referenz gebunden. Repository- und Passwortdatei
werden je Restic-Aufruf einmal no-follow geöffnet; der verifizierte Locator-
Digest wird über genau das an Restic übergebene Descriptorpaar gebunden und
nicht über einen Pfad erneut geöffnet.
Der Backup-Readback bindet die Compose-/Service-/Container-Identität des
PostgreSQL-Dienstes, dessen laufende Image-ID und das Volume
`platform-infra_postgres_data` an `/var/lib/postgresql/data`; die DB- und
Rollenbindung lautet `catering_agents`/`catering`. Die beiden Caddy-Container
werden jeweils einmal mit ihrer erwarteten Compose-/Service-/Container- und
Health-Identität sowie der vollständigen Zwei-Volume-Matrix geprüft; die
zugehörigen Volume-Namen, Owner-/Role-Labels und Mountquellen bleiben an den
selben Inspect-Objekten gebunden. Der Backup-Scope ist unveränderlich
`postgres,sites,platform-caddy,shared-edge-caddy`.

## Getrennte Betreiber-Gates

1. **Installations-Gate:** Freigabe nur für das Kopieren der oben genannten
   Skripte/Units und einer root-owned-0600-Environment-Datei; Pfade, Besitzer,
   Modi, Digestbindungen und Produktionsausschlüsse read-only prüfen. Noch
   keine Timeraktivierung und kein Lauf.
2. **Erstes-Backup-Gate:** Separat freigeben, nachdem Host-, PostgreSQL-, Caddy-,
   Off-host-Repository- und Secret-Recovery-Bindungen geprüft sind. Der Lauf
   darf nur den versionierten Candidate und den atomaren Pointer erzeugen;
   autoritative Evidence bleibt unverändert.
3. **Erstes-Restore-Gate:** Separat freigeben, nachdem ein konkreter Candidate-
   Pointer vorliegt und der isolierte `/run/catering-backup`-Probevertrag,
   `--network none`, `--pull never`, Cleanup-Readback sowie RTO/RPO-Grenzen
   geprüft wurden. Receipt, Status und Evidence werden erst nach dieser
   Freigabe erzeugt.
4. **Evidence-/Phase-3-Gate:** Eine spätere Nutzung des autoritativen
   Nachweises, Shared-Edge-/Ingress-Änderung oder Phase 3 benötigt eine weitere
   ausdrückliche Betreiberentscheidung. Kein Gate wird durch eine erfolgreiche
   Validierung automatisch erteilt.
