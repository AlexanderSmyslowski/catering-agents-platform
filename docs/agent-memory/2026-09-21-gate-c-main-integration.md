# CateringOS – PR682: main-Abgleich und Fortsetzung

Version: 1.0 / 2026-09-21. Memory-Anker: 5.395.
Status: Integrationskandidat; keine Gesamt-, Merge- oder Deploymentfreigabe.

## Auftrag und genaue Quellen

Der bestehende Produktzweig `codex/gate-c-ab-integration-20260830` wird mit dem separat fortgeschriebenen `main` abgeglichen. Beide Historien bleiben erhalten; kein Neustart der Produktplanung und keine Wiederholung von #694.

- Geprüfter Produktelternstand: `f6b04e43fec5a243b938cc6f3d01a00450288f87`, Tree `393414ace5f25976fd44c53acc103ad6a154c11a`.
- Eingehender main-Stand: `8de2e96c8604f12da2ec14c39b187db04dfb61cf`, Tree `1971727c18a3625b508614a665c4aab4a2121d9c`.
- Gemeinsamer Ausgangspunkt: `3c5f6076bf04a88c13f8c10fa6779c4f57c3b65c`.
- Vorheriger Befund und Auftrag: [PR682-Kommentar 5753004623](https://github.com/AlexanderSmyslowski/catering-agents-platform/pull/682#issuecomment-5753004623).
- Kanonische Strategie: [STR-001 in AgenturOS](https://github.com/AlexanderSmyslowski/agenturos/blob/main/docs/strategy/STR-001-agenturos-delivery-and-infrastructure.md), bei diesem Abgleich v1.1 gelesen. Keine zweite Strategiequelle.

## Wiederverwendeter Nachweis, kein umetikettierter Gesamtabschluss

Der isolierte [Actions-Lauf 35540397099](https://github.com/AlexanderSmyslowski/catering-agents-platform/actions/runs/35540397099) prüfte ausschließlich den genannten Produktelternstand: Typecheck/Build und vier Testdateien mit 169 Tests bestanden (Platform 52, Critical Path 1, Planungs-Evidenz/P1 113, Admin 3). Alle zuletzt sechs fehlgeschlagenen Fälle sind in diesem Korridor enthalten. Das ist kein Nachweis einer vollständigen Suite oder des neuen Integrationsbaums.

Das Originalartefakt `10614074020` hat ZIP-SHA256 `60f1972a6cf57c4b1110990e3befb7f8db5066b4cd0e407af86c9df8edf52e13`. Prüfungen und Quellenbindung wurden im obigen Kommentar dokumentiert. Die früheren Irrwege bei Snapshot-/Apply-Annahmen sind keine neuen Fachverträge. Der tatsächliche letzte grüne Korridor gilt für die genannten Dateien auf dem angegebenen Head.

## Begrenzte Zusammenführung

Nur `memory.md` hatte einen tatsächlichen Inhaltskonflikt. Der vollständige Produkttext bleibt bis auf Kopfversion/-datum erhalten. Die 27 zusätzlichen main-Zeilen werden mit Quellcommit und getrenntem historischen Versionskontext ergänzt; keine pauschale ours/theirs-Auflösung. Version 5.393 aus dem Betriebsstrang ist nicht mit Version 5.393 aus dem Produktstrang gleichzusetzen.

Alle übrigen übernommenen Dateien müssen byte- und modusgleich aus einem der beiden Elternstände stammen. Der vorliegende Fortsetzungsvermerk ist die einzige zusätzliche Datei. Der resultierende Baum wird mit nativer Git-Zusammenführung und vollständigen Dateimanifesten gegen beide Eltern abgeglichen. Merge-Commit, Baum, tatsächliche CI-Läufe und Ergebnis gehören in den bestehenden PR-Bericht; diese Datei behauptet kein im Voraus bekanntes CI-Ergebnis.

## Betrieblich getrennte Lage und verbindliche Grenze

Die eingehende main-Dokumentation aus #697 berichtet den technischen Übergang auf den eigenständigen Zielserver und den Zielserver als alleinigen Writer. Ihr dokumentierter installierter Betriebsartefaktstand bleibt `3c5f6076…`; der neuere Repository- und Produktstand ist dadurch nicht installiert. Dieser Produktstrang übernimmt den Bericht als Quellenstand, ohne neue Live-/Serverprüfung oder zusätzliche Betriebsfreigabe. Der dort genannte Reloadbefund bleibt separat offen.

Der bisherige Workflow `Deploy production` ist **kein freigegebener Updateweg für den neuen Zielserver**. Sein Installationsweg setzt `zeiterfassung_default` und die alte Compose-Kette voraus; ein bloßer Austausch der Zieladresse ist keine sichere Anpassung. Vor dem ersten Produktdeployment den eigenständigen Updateweg gesondert festlegen und gezielt prüfen. Neue Datenbank-, Netzwerk-, Zugangs- und Sicherungskonfiguration erhalten. Bis zur gesonderten Deploymentfreigabe weder Alt- noch Zielserver aktualisieren.

Kein Merge von #682 nach `main`, kein Deployment, keine SSH-/DNS-/Proxy-/Timer-/Datenänderung, keine Echtdaten oder kostenpflichtigen Provider. Kein automatischer Rückfall auf Altdaten. Der separate Serverstrang und AgenturOS werden nicht übernommen.

## Nächster Schritt und verbleibende Nachweise

Nach Veröffentlichung des geprüften Zwei-Eltern-Baums ausschließlich die reguläre, nicht deployende PR-CI auswerten. Ein grüner gezielter Testlauf ersetzt weder den neuen PR-Testmerge noch die Vollsuite. Bei konkretem Fehler nur den betroffenen Pfad untersuchen; keine unveränderte Zusatzschleife. Danach begrenzte Integrationsbewertung und HALT vor Merge nach main.

Vier bekannte npm-Advisories (zwei moderate, zwei high) sind noch paketbezogen einzuordnen; kein automatisches Audit-Fix. Reale menschliche Küchenprüfung, belastbare Zukaufspezifikationen und Rezept-/Allergenfreigaben sind durch synthetische Entscheidungen nicht ersetzt; kein Gate-C-Gesamt-GO.

Der originale Mac-Worktree und lokale Agenten-Hub sind hier nicht gemountet, direkter Git-Netzzugriff fehlt. `HANDOFF_PROMPT.md` ist am Produktelternstand nicht vorhanden (404). Kein Hub-Writeback und keine Kenntnis fremder ungesicherter lokaler Änderungen behauptet. GitHub-Head und main werden vor Veröffentlichung erneut gelesen; kein Force-Push. Kein eigener Dokumentations-PR und keine zusätzliche Produkt-Testschleife nur für diesen Vermerk.


## Fortsetzung 2026-09-22 – eigenständiger Target-Updateweg

PR #682 wurde anschließend als Merge-Commit `d6a9b8dbc0987c281c826a88697bddeeb51a9ff5` in `main` aufgenommen. Die zuvor dokumentierte Grenze gegen den historischen `Deploy production`-Pfad bleibt bestehen und ist nun durch einen separaten, target-spezifischen Updateweg umgesetzt.

Der neue Weg liegt in Draft-PR #698. Gebundener Implementierungsstand vor dieser Dokumentationsfortschreibung: `23573a204a51f79e1c62c299bf1778e26bc3ebee`.

Maßgebliche Dateien:
- `platform-infra/catering-target-update-contract.json`
- `platform-infra/scripts/update-catering-target.sh`
- `platform-infra/scripts/catering-target-production-update.sh`
- `platform-infra/scripts/catering-target-authenticated-smoke.mjs`
- `.github/workflows/update-catering-target.yml`
- `docs/operations/CATERING_TARGET_UPDATE.md`

Der neue Workflow ist ausschließlich manuell, main-only, commitgebunden und verlangt die explizite Bestätigung `UPDATE_CATERING_TARGET`. Er verwendet dedizierte `CATERING_TARGET_*`-Secrets und keine historische Shared-Deploy-Konfiguration.

Der Produktionsrunner hält die eigenständige Zieltopologie fail-closed: kein `zeiterfassung_default`, keine alte Edge-Cutover-Kette, keine App-Hostports, PostgreSQL-Volume und Edge-Image werden vor und nach Aktivierung gebunden. Vor Mutation werden außerdem Backup-Observer, Writer-Modus, Business-Records-Schema-Version 3, die unveränderte Runtime-Schema-Migrationsregion und ein kanonisches Manifest aller DDL-Literale in Shared Core, Intake, Offer, Production und Export geprüft.

Migrationen bleiben `explicit-only`; Version 1 besitzt keinen freigegebenen automatischen Migrationsbefehl. Migrationsbedarf oder Schema-Migrationsdrift stoppt vor Updatebeginn.

Der App-Kandidat besteht nur aus immutable Runtime-/Web-Images. Aktiviert werden nur Intake, Offer, Production, Exports und Web. Vorherige App-Images werden als Rücknahmebasis gebunden. Scheitert Aktivierung, Postflight oder authentisierter Read-Smoke, wird nur bei beweisbarer Rücknahme auf den vorherigen Appstand zurückgeschaltet. Nicht beweisbare Rücknahme endet `manual_recovery_required lock_retained=true`.

Der authentisierte Read-Smoke prüft Login, Session, Capability `production_read` und den Produktionsfall-Readpfad; er legt keinen Geschäftsvorgang an.

Nachweise auf `23573a204…`:
- fokussierter Run `35689341911` (#54): 43/43 Vitest und 47/47 Python-Tests, Build und Syntaxprüfungen grün;
- reguläre CI `35689345135` (#3049): Build/Test, Browser-Rehearsal und Compose-Parität grün; Backup-Spezialjob branchbedingt skipped.

Die produktiven Kontrollfluss-Tests führen den echten `catering-target-production-update.sh` aus und ersetzen nur die externen Kommando-Grenzen. Geprüft sind gesunder Preflight, vollständige Update-Reihenfolge, Aktivierungsfehler, Auth-Smoke-Fehler, erfolgreiche Rücknahme, Lock-Retention bei nicht beweisbarer Rücknahme und Migrationsabbruch vor Mutation.

Abschlussreview-Fix: Die erste zusätzliche Gegenprobe für DDL-Drift außerhalb des Business-Records-Blocks scheiterte erwartungsgemäß in Run `35700722316` (10 grün, 1 rot). Der Produktionsrunner vergleicht seit `259b90528d2f19eeabeee9ddb2a9351f1c99f38f` zusätzlich ein kanonisches Runtime-DDL-Manifest mit dem installierten Quellstand; Run `35700855657` bestätigte anschließend 11/11 Kontrollfluss-Tests grün. Der dokumentierte installierte Altstand `3c5f6076…` und der Kandidat hatten bei der Review-Gegenprüfung identische DDL-Literale.

**Betriebsgrenze bleibt unverändert:** Bis zu einer neuen ausdrücklichen Freigabe kein Workflow-Dispatch, kein Live-SSH und kein Deployment. Der erste echte Zielserverlauf beginnt mit frischer read-only Prüfung und ist ein eigener Betriebsauftrag.


## Fortsetzung 2026-09-22 – separater read-only Target-Preflight

Nach Merge des Target-Updatewegs in `main` wurde der erste Live-Kontakt weiter entkoppelt: `.github/workflows/catering-target-preflight.yml` führt ausschließlich den bereits geprüften Produktions-`--preflight` aus. Der Workflow ist manual-only, main-only und an den exakten aktuellen main-Commit gebunden. Er verwendet nur die dedizierten Target-SSH-Secrets, keinen `--update`-Pfad, keine Update-Bestätigung und keine Smoke-Credentials.

Der Vertragstest `tests/catering-target-preflight-workflow.test.ts` wurde RED→GREEN entwickelt. Der erste fokussierte Lauf scheiterte erwartungsgemäß ausschließlich an der fehlenden Workflow-Datei; nach Implementierung bestand der fokussierte Lauf mit 5/5 Tests. Kein Live-SSH und kein Zielserverzugriff wurden durch diese Implementierung ausgelöst.


## Fortsetzung 2026-09-22 – erster Live-Preflight-Versuch und Syntaxkorrektur

PR #699 wurde als Merge-Commit `3031adc20da3d01a14eb080411a11ca38e980974` in `main` aufgenommen. Die ersten beiden manuellen GitHub-Preflightläufe brachen noch vor Serverkontakt wegen fehlender Environment-Secrets ab. Nach sicherer Einrichtung der vier dedizierten Target-Secrets erreichte Run `35735810821` den SSH-Schritt, scheiterte jedoch mit Timeout auf Port 22; der GitHub-hosted Runner kann den Zielserver aktuell nicht direkt erreichen.

Der daraufhin lokal vorbereitete read-only Preflight über den vorhandenen Mac-SSH-Zugang wurde ebenfalls vor Serverkontakt gestoppt: Im `REMOTE_PREFLIGHT`-Heredoc von `catering-target-production-update.sh` fehlte beim Test auf Abwesenheit des Target-Update-Locks ein schließendes Anführungszeichen. Der isolierte Remote-Syntaxcheck lieferte Exit-Code 2.

PR #700 korrigiert ausschließlich diesen Shell-Syntaxfehler und ergänzt eine Regression, die den kompletten `REMOTE_PREFLIGHT`-Block extrahiert und mit `bash -n` validiert. Kein Serverkontakt und keine Mutation erfolgen durch die Korrektur.

Die read-only Lock-Grenze wurde präzisiert: Der Preflight legt keinen `/opt/catering-target-update.lock` an und verändert keinen Serverzustand. Der Backup-Observer darf bei `--check` zur konsistenten Beobachtung seine bereits vorhandene Lockdatei read-only öffnen und kurz per `flock` synchronisieren. Das ist kein Deployment-/Update-Lock; `--check` publiziert keinen Observerstatus und führt keine Reparatur-, Backup-, Restore- oder Dockeraktion aus.

Bis zu einem vollständig grünen echten read-only Preflight bleibt jede mutierende Target-Aktualisierung gesperrt.


## Fortsetzung 2026-09-22 – echter read-only Preflight und Diagnosehärtung

Nach Merge von PR #701 wurde der echte lokale read-only Preflight genau einmal auf `5e9670a256b64cf24cbdb5329b876cd47568ec9a` ausgeführt. Der Lauf endete mit Exit-Code 1, leerem stdout/stderr und ohne `TARGET_PREFLIGHT_OK`. Wegen mehrerer stiller fail-closed Abbruchstellen konnte kein konkretes Ziel-Gate als Ursache behauptet werden. Es gab keine Wiederholung und keine Update-/Deploymentphase.

PR #702 ergänzt deshalb ausschließlich nicht-sensitive Fehlerdiagnostik. Stille read-only Zielprüfungen melden künftig `TARGET_PREFLIGHT_FAIL gate=<statischer-name>`. Die Prüfbedingungen, Update-Lock-Grenze und Servermutation bleiben unverändert; es werden keine Secretwerte, tatsächlichen Hashes, Pfade oder Zielwerte ausgegeben.

Die groben Phasen `runtime_schema_source`, `runtime_ddl_manifest` und `remote_target_invariants` sind gebunden. Im Remote-Preflight werden zusätzlich Zielidentität/Pfade, Target-Datei-Hashes, Lockzustand, Backup-Observer, Compose-Render, Docker-Netzsatz, Containerstatus, Writer-Modus, Schema-Version, Service-Netze/Ports, PostgreSQL-Volume und Edge-Image mit eindeutigen Gate-Namen versehen.

Bis zu einem vollständig grünen echten read-only Preflight bleibt jede mutierende Target-Aktualisierung gesperrt.


## Fortsetzung 2026-09-23 – Preflight-Quellbindung an tatsächliches Target-Layout

Der erste diagnostisch aussagekräftige echte read-only Preflight auf `cfda8ae04295f3adfe3133ce5587eedd099319a6` wurde genau einmal ausgeführt und stoppte ohne Mutation mit `TARGET_PREFLIGHT_FAIL gate=runtime_schema_source_file`, danach grob `runtime_schema_source`.

Die Ursache liegt im Preflight-Vertrag: Der isolierte Zielaufbau installierte gemäß TARGET-REHEARSAL nur die Plattformdefinition unter `/opt/catering-agents-platform/platform-infra/`, nicht den vollständigen Repository-Quellbaum. Deshalb darf die Driftprüfung nicht `/opt/catering-agents-platform/shared-core/src/persistence.ts` oder die Runtime-Quellwurzeln auf dem Host voraussetzen.

Die Korrektur liest migrationsrelevante Quelle und Runtime-DDL read-only aus `/app` aller vier laufenden immutable Runtime-Appcontainer (intake, offer, production, exports) und bindet jeden Fingerprint an den Kandidaten. Kein Serverzustand wird dafür ergänzt oder repariert.


## Fortsetzung 2026-09-23 – Remote-Argumentbindung nach zweitem echten Preflight

Der echte read-only Preflight auf `a24191a4484c204af17afcae417a167b7b5fc2dd` wurde genau einmal ausgeführt und stoppte ohne Mutation. stderr zeigte zuerst eine lokale Python-`SyntaxWarning` wegen der Backtick-Darstellung im DDL-Scanner, danach `bash: line 7: 13: unbound variable` und grob `TARGET_PREFLIGHT_FAIL gate=remote_target_invariants`.

Ursache des Bash-Abbruchs: Im unlocked Preflight ist der erwartete Lock-Owner absichtlich leer. Ein leeres Argument in `ssh ... bash -s -- "" ...` wird beim Remote-Kommandoaufbau nicht zuverlässig als Positionsparameter transportiert; dadurch fehlte remote `${13}`. Die Korrektur verwendet für den leeren Owner einen festen nichtleeren Sentinel und prüft remote vor jeder Positionsauswertung exakt 13 Argumente. Der lokale DDL-Scanner verwendet zugleich eine warnungsfreie Quote-Tupeldarstellung.


## Fortsetzung 2026-09-23 – root-only Runtime-Env-Prüfung

Der echte read-only Preflight auf `5bb4fcd9c9d91450b049097fd3a242a565ca05b0` wurde genau einmal ausgeführt und stoppte ohne Mutation mit `TARGET_PREFLIGHT_FAIL gate=runtime_env_file`, danach grob `remote_target_invariants`.

Der vorhandene Zielaufbau-Nachweis dokumentiert ausdrücklich, dass `/etc/catering-target/runtime.env` auf dem echten Ziel installiert war, von den Plattformdiensten genutzt wurde und root-only 0600 blieb. Der Preflight prüfte die Datei jedoch als unprivilegierter SSH-Benutzer mit `test/stat`. Bei einem nicht traversierbaren root-only Elternpfad kann dies fälschlich wie eine fehlende Datei erscheinen.

Die Korrektur ändert keine erwartete Datei und liest keine Secrets: Existenz, Nicht-Symlink und root:root-0600-Metadaten werden ausschließlich read-only mit `sudo -n test` bzw. `sudo -n stat` geprüft. Fehlt die Datei tatsächlich, bleibt `runtime_env_file` fail-closed.
