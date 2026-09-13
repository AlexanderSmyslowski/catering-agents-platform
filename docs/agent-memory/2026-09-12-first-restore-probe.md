# Erster isolierter Catering-Restore, 12.09.2026

**RESTORE PROBE SUCCESS – SNAPSHOT-BOUND EVIDENCE VERIFIED**

**HOLD BEFORE TIMER ACTIVATION AND PHASE 3**

Genau ein tatsächlicher Restore, nach ausdrücklicher Betreiberfreigabe, ausschließlich durch den Hauptagenten. Snapshot: `869292d94fdd23351715dec18185f1bbf58f05cc6b3242a66a88a1950259144f`. Installierte Herkunft: `3393b475e69b6c22e34923e2b273fa66bfb67fb4`, Tree `2f1e9624558f7b6488255b2514f9b69ca9b3d1eb`.

Die transiente Unit `catering-restore-first-gate.service` lief mit Invocation `11186cea6cb34f849dc99e50d4be2c26` am 12.09.2026 von 20:33:42 bis 20:33:54 UTC. Wartender Prozess: Exit 0, 11,85 Sekunden. systemd bestätigt die erfolgreiche Deaktivierung und `JOB_RESULT=done` für dieselbe Invocation. Ein vorheriger, transportseitig eindeutiger Prozess-Preflight hatte 0 Restorestarts; der kurzzeitige Auslöser bleibt unbekannt. Seine Nachweise sind unverändert erhalten.

Der tatsächliche Prüflauf verwendet das gepinnte lokale PostgreSQL-Image ohne Pull, ein isoliertes Netzwerk ohne Ports, begrenztes RAM/tmpfs und lediglich einen lesenden Bind-Mount des temporären Dumps. `pg_restore --exit-on-error` und die Abfragbarkeit beider vorgesehenen Tabellen sind belegt. Auch leere Tabellen bestehen diese Prüfung; kein umfassender Schema-, Zeilenzahl- oder Geschäftsdatenvergleich. Sites/Caddy-Material wurde als wiederhergestellte Bytes geprüft und nicht produktiv eingespielt.

Receipt SHA-256: `6da7d40268c4fe7ac63320c70f6abbbaf783075fac7857ac350c7ca4aa4e777f`.
Repositorystatus SHA-256: `805791740f93f73c8504fdb131a24826b021b0c5902c74483498f22e3352fd96`.
Finale Evidence SHA-256: `e82a889c5cc463ed42fce9aefc031e3554f3f262675a47059b2f148bb0550ddc`.

Die Veröffentlichung ist über den unveränderten Publisher (Datei-fsync, atomarer Austausch, Verzeichnis-fsync, Readback), Exit 0 und geschützte Nachprüfung belegt. Candidate-Alter beim Evidence-Schreiben: etwa 8047,427 Sekunden. Betriebsbudget 7200 Sekunden und technische Grenze 14400 Sekunden sind separat eingehalten.

Probecontainer `24a5c73cea029f55b3ec86544e63719c6e578ab5ecb38644a8618275d6ff01fd`, sein automatisch erzeugtes anonymes Volume und eigene temporäre Daten wurden entfernt. Anwendungs-/Mount-/Netzidentitäten, Startzeiten, Neustartzähler und Volume-Inventar sind unverändert. Originaldienste inaktiv, Timer deaktiviert. Kein neuer Backupversuch, keine Produktion wiederhergestellt, keine Aktivierung von Phase 3.

Dauerhafte Nachweise: `~/.codex/local-evidence/catering-finalconfig-0jae6hqe/restore-first-start-result.json`, `restore-first-postcheck-result.json`, `restore-first-unit-lifecycle.json`, geprüfte Quell-/Test-/Reviewmanifeste und unveränderte Vorprüfungsnachweise. Produktionssecrets und Rohdaten bleiben außerhalb dieser Unterlagen.
