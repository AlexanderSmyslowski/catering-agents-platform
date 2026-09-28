# Catering-Zielserver-Release 5b2c7708 — abgeschlossen am 26.09.2026

## Status

**Release am 26.09.2026 erfolgreich durchgeführt und verifiziert.** Der
autorisierte Produktcommit `5b2c77089e7fd9051b4a55e38240cd69d6e9ed99` läuft auf
`catering-prod-1`. Es gab genau einen freigegebenen One-shot-Lauf,
09:55:11–09:56:14 UTC, Wrapper-Exit 0. Die Einmalfreigabe ist damit
verbraucht; der Runner darf **nicht erneut ausgeführt** werden.

Dieser Snapshot dokumentiert ausschließlich den technischen Release. Er ist
keine fachliche Abnahme der CateringOS-Funktionen (siehe „Grenzen“).

## Bindungen

| Punkt | Wert |
|---|---|
| Installierter Produktcommit | `5b2c77089e7fd9051b4a55e38240cd69d6e9ed99` (unverändert, zugleich `main`) |
| Separat verwendeter Operationscommit | `f2546468c5bce0e8f2298ee1a92c6c6da3b2ae71` (Draft-PR #712, ungemergt) |
| Runner-Blob im Operationscommit | `8a00e97ec021c3e015f7a0fa7ef57141f3204a30` (identisch mit dem in E2 bewiesenen Runner) |
| One-shot-Wrapper | `cateringos-final-one-shot-release-20260926.py`, SHA-256 `d1240d472d99f256b95fa3ea7501fd7a180c2fd1d4de950700aae2f7c19b8ebf` (nicht in Git) |
| Runtime-Image V2 (intake, offer, production, exports) | `sha256:778c2daadc272666192a1212095275c1cafb5bdb4b0845f49ce16312207050b2` |
| Web-Image V2 | `sha256:d95343680e0b02491b3fb668b1ecd70bd9120f29c27c3dcf8c8f5fb9992099ab` |
| V2-Bundle-Manifest | SHA-256 `ccc93da8710ffa631835f2a1a9fefae4a3a0cb1e415f464025d9570f8fa59fd4`, `sourceCommit` = Produktcommit |
| Edge-Image (unverändert) | `sha256:5f5c8640aae01df9654968d946d8f1a56c497f1dd5c5cda4cf95ab7c14d58648` |
| PostgreSQL-Volume (unverändert) | `platform-infra_postgres_data` |

Die V2-Images wurden wiederverwendet: kein Rebuild, kein Image-Load, keine
Migration. Der Runner band beide Digests fest und prüfte ihr Vorhandensein
auf dem Ziel vor der Aktivierung.

## Ausführung

- Ausgeführt vom Mac des Projektverantwortlichen, nicht über den GitHub-Workflow
  `update-catering-target.yml` (der Workflow verlangt `commit_sha == main` und
  führt den Runner des Produktcommits aus; der korrigierte Runner liegt nur im
  Operationscommit).
- Produkt- und Operationsstand wurden als zwei getrennte, detached und saubere
  Checkouts gebunden; `CATERING_TARGET_SOURCE_ROOT` zeigte auf den Produktcommit.
- Der Wrapper prüfte vor jedem Targetkontakt: PR #712 offen/Draft mit Head
  `f2546468…` und Base `5b2c7708…`, `main` = `5b2c7708…`, grüne Nachweise
  (CI-Run `36186874649` #3155, „PR712 E1 release gates v3“ `36186895348`,
  „PR712 E2 real sshd smoke proof“ `36186649188`), Proof-Commit-Umfang,
  Runner-Blob und lokale Credential-Dateien (nur Existenz, Rechte, Form).

### Vollständige nicht-sensitive Markerausgabe

```
CATERING_FINAL_ONE_SHOT_RELEASE_START
GITHUB_RELEASE_GATES_OK full_ci=success e1=success e2=success ops_commit=f2546468c5bce0e8f2298ee1a92c6c6da3b2ae71
LOCAL_RELEASE_INPUTS_OK product_commit=5b2c77089e7fd9051b4a55e38240cd69d6e9ed99 runtime_v2=sha256:778c2daadc272666192a1212095275c1cafb5bdb4b0845f49ce16312207050b2 web_v2=sha256:d95343680e0b02491b3fb668b1ecd70bd9120f29c27c3dcf8c8f5fb9992099ab
LOCAL_CHECKOUT_BINDINGS_OK product=5b2c77089e7fd9051b4a55e38240cd69d6e9ed99 ops=f2546468c5bce0e8f2298ee1a92c6c6da3b2ae71 source_detached=true source_clean=true runner_e2_identical=true
FINAL_READ_ONLY_GATE_OK schema=3 smoke_version=1 lock=absent receipt=absent candidate_binding=v2 postgres_volume=platform-infra_postgres_data edge_unchanged=true
TARGET_PREFLIGHT_OK target=catering-prod-1 backup=healthy writer=enabled schema_version=3 runtime_state=baseline postgres_volume=platform-infra_postgres_data edge_image=sha256:5f5c8640aae01df9654968d946d8f1a56c497f1dd5c5cda4cf95ab7c14d58648
INITIAL_OPS_PREFLIGHT_OK runtime_state=baseline
ONE_SHOT_UPDATE_AUTHORIZATION_CONSUMED
TARGET_PREFLIGHT_OK target=catering-prod-1 backup=healthy writer=enabled schema_version=3 runtime_state=baseline postgres_volume=platform-infra_postgres_data edge_image=sha256:5f5c8640aae01df9654968d946d8f1a56c497f1dd5c5cda4cf95ab7c14d58648
TARGET_CANDIDATE_BINDING runtime=sha256:778c2daadc272666192a1212095275c1cafb5bdb4b0845f49ce16312207050b2 web=sha256:d95343680e0b02491b3fb668b1ecd70bd9120f29c27c3dcf8c8f5fb9992099ab
TARGET_UPDATE_STAGE stage=activate status=start
TARGET_UPDATE_STAGE stage=activate status=success
TARGET_UPDATE_STAGE stage=postflight status=start
TARGET_UPDATE_STAGE stage=postflight status=success
TARGET_UPDATE_STAGE stage=health status=start
TARGET_UPDATE_STAGE stage=health service=intake status=success
TARGET_UPDATE_STAGE stage=health service=offer status=success
TARGET_UPDATE_STAGE stage=health service=production status=success
TARGET_UPDATE_STAGE stage=health service=exports status=success
TARGET_UPDATE_STAGE stage=health status=success
TARGET_UPDATE_STAGE stage=auth_smoke status=start
TARGET_AUTH_SMOKE_STAGE stage=script_start status=success
TARGET_AUTH_SMOKE_STAGE stage=payload_valid status=success
TARGET_AUTH_SMOKE_STAGE stage=login_response status=200
TARGET_AUTH_SMOKE_STAGE stage=login status=success
TARGET_AUTH_SMOKE_STAGE stage=session_response status=200
TARGET_AUTH_SMOKE_STAGE stage=session status=success
TARGET_AUTH_SMOKE_STAGE stage=production_read_response status=200
TARGET_AUTH_SMOKE_STAGE stage=production_read status=success
TARGET_UPDATE_STAGE stage=auth_smoke status=success
TARGET_UPDATE_RESULT updated commit=5b2c77089e7fd9051b4a55e38240cd69d6e9ed99 runtime_image=sha256:778c2daadc272666192a1212095275c1cafb5bdb4b0845f49ce16312207050b2 web_image=sha256:d95343680e0b02491b3fb668b1ecd70bd9120f29c27c3dcf8c8f5fb9992099ab
CATERING_ONE_SHOT_UPDATE_OK commit=5b2c77089e7fd9051b4a55e38240cd69d6e9ed99 runtime_image=sha256:778c2daadc272666192a1212095275c1cafb5bdb4b0845f49ce16312207050b2 web_image=sha256:d95343680e0b02491b3fb668b1ecd70bd9120f29c27c3dcf8c8f5fb9992099ab
TARGET_PREFLIGHT_OK target=catering-prod-1 backup=healthy writer=enabled schema_version=3 runtime_state=release:5b2c77089e7fd9051b4a55e38240cd69d6e9ed99 postgres_volume=platform-infra_postgres_data edge_image=sha256:5f5c8640aae01df9654968d946d8f1a56c497f1dd5c5cda4cf95ab7c14d58648
POST_RELEASE_PREFLIGHT_OK runtime_state=release:5b2c77089e7fd9051b4a55e38240cd69d6e9ed99
TARGET_FINAL_VERIFY_OK commit=5b2c77089e7fd9051b4a55e38240cd69d6e9ed99 runtime_state=release:5b2c77089e7fd9051b4a55e38240cd69d6e9ed99 schema_version=3 auth_users=1 smoke_version=2 failedLoginCount=0 lock=absent postgres_container_unchanged=true postgres_volume=platform-infra_postgres_data edge_container_unchanged=true
CATERING_RELEASE_AND_VERIFY_OK
```

Wrapper-Exit-Code: 0.

## Nachzustand laut Endverifikation

- `runtime_state=release:5b2c77089e7fd9051b4a55e38240cd69d6e9ed99`; die fünf
  App-Container laufen aus dem Release-Verzeichnis
  `/opt/catering-releases/5b2c77089e7fd9051b4a55e38240cd69d6e9ed99` mit den
  oben genannten V2-Images.
- Authentisierter Smoke mit dem bestehenden Smoke-User (Rolle
  `read_only_operator`): Login, Session und
  `GET /api/production/v1/production/plans` jeweils HTTP 200.
- Business-Records-Schema-Version 3; keine Migration.
- `auth/users` = 1; Smoke-User-Version 2 (durch den einen Smoke-Login),
  `failedLoginCount` = 0.
- Update-Lock absent. Install-Receipt und `installed`-Marker auf dem Ziel
  vorhanden, gebunden an Commit, Runtime- und Web-Image.
- PostgreSQL- und Edge-Container laut Vorher-/Nachher-Vergleich von Container-ID
  und Image unverändert; PostgreSQL-Volume `platform-infra_postgres_data`.

Nach dem Lauf gab es keinen weiteren Targetzugriff. Dieser Snapshot beruht
ausschließlich auf der Endverifikation des Laufs selbst.

## Vorgeschichte und Einordnung

- Mehrere vorherige Updateversuche endeten jeweils mit sauberem Rollback.
  Behoben wurden in dieser Zeit: Smoke-Bootstrap ohne Bash im Alpine-Image,
  falsche Business-ID-Annahme, Compose-Runtime-Identität bei Aktivierung aus
  dem Release-Verzeichnis, Ownership nach `rsync` und die für
  `read_only_operator` verbotene Smoke-Route `/cases` (ersetzt durch `/plans`).
- Der letzte abgebrochene Versuch lief auf dem Operationsstand `91818d8`.
  Ein unabhängiger Read-only-Review bewertete diesen Stand als **NO-GO**. Das
  bleibt historisch gültig. Ursache: OpenSSH verbindet Remote-Argumente zu
  einem Shell-String; der inline übergebene mehrzeilige Node-Smoke wurde von
  der Remote-Login-Shell als Shell-Code geparst und brach mit einem
  Syntaxfehler ab, bevor Node startete.
- Zusätzlich hätte ein Rebuild pro Lauf nicht mehr die V2-Images erzeugt,
  weil `COPY . .` auch das Ops-Skript in den Build-Kontext aufnimmt.
- Der Operationscommit `f2546468…` behebt dies additiv: POSIX-Quoting des
  Remote-Befehls, feste V2-Bindung ohne Rebuild/Load, separater sauberer
  Source-Root, SSH-Keepalive, Fetch-Timeouts und ein eigener Receipt-Fehlermarker.
  Nachweise: CI #3155 grün, E1 v3 grün, E2 mit echtem sshd und bash-/dash-
  Login-Shell grün. Vor dem Lauf wurde der Kontrollfluss lokal zusätzlich unter
  macOS bash 3.2 mit dem synthetischen Harness in sechs Szenarien geprüft, ohne
  Targetkontakt.

## Nicht-sensitive Belegpfade

Nur lokal auf dem Mac des Projektverantwortlichen, nicht in Git:

- `~/.codex/private/catering-final-release-20260926-f2546468/attempt-redacted.log`
  — redigiertes Protokoll des Update-Schritts (0600).
- `~/.codex/private/catering-final-release-20260926-f2546468/production-update-attempted`
  — One-shot-Marker; blockiert jede Wiederholung mit diesem Runner.
- `~/.codex/private/catering-target-release-5b2c7708-v2/bundle/manifest.json`
  — V2-Bundle-Manifest (SHA-256 siehe Bindungen).

Auf dem Ziel (nicht erneut gelesen):

- `/opt/catering-releases/5b2c77089e7fd9051b4a55e38240cd69d6e9ed99/install-receipt`
- `/opt/catering-releases/installed`

GitHub: CI-Run `36186874649`, E1-Run `36186895348`, E2-Run `36186649188`.

## Betriebshinweise

- **PR #712 ist noch ungemergt.** Seine dauerhafte Integration ist ein
  separater, noch nicht freigegebener Arbeitsschritt.
- **Der alte Produkt-Preflight kennt die Release-Verzeichnisse nicht.** Er
  bewertet die App-Container deshalb abweichend. Diese Abweichung darf nicht
  durch Abschwächen von Prüfungen „repariert“ werden.
- **Alte kanonische Compose-Dateien und Legacy-Deploywege nicht für ein
  manuelles Update verwenden.** `/opt/catering-agents-platform/platform-infra/compose.json`
  und `operations.json` pinnen weiterhin die alten App-Images; ein manuelles
  `docker compose … up` damit würde die App still zurückrollen. Gleiches gilt
  für `Deploy production`, `deploy-hetzner.sh` und
  `deploy-web-listener-hetzner.sh`.
- **Einmalfreigabe verbraucht.** Den One-shot-Runner nicht erneut ausführen;
  Marker und Protokolle nicht entfernen.

## Grenzen

- Ein technisch erfolgreicher Release ist **nicht** gleich einer vollständigen
  fachlichen Abnahme aller CateringOS-Funktionen. Reale Küchenprüfung,
  Rezept- und Allergenfreigaben sowie weitere fachliche Abnahmen bleiben offen.
- Keine Secrets, Cookies, PINs, Zugangsdaten oder Roh-Logs in diesem Snapshot.
- Kein Merge, keine Produkt-, Runner- oder Workflowänderung durch diese
  Dokumentation.
