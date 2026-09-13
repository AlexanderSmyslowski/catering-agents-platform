# Catering: dritter Backupversuch, 12.09.2026

**THIRD BACKUP SUCCESS – CANDIDATE ONLY – HOLD BEFORE RESTORE**

Die ausdrückliche Betreiberfreigabe umfasste PR #690, Installation des geprüften Caddy-Fixes, erforderliche Herkunftsbindungen und genau einen dritten Backupversuch. Produktionsänderungen führte ausschließlich der Hauptagent aus. Unabhängige Reviews blieben lesend.

PR #690 wurde regulär mit gebundenem Head `1cab2e6c86b21c26bb74597fe3312906aa3c733a` als `3393b475e69b6c22e34923e2b273fa66bfb67fb4` gemergt. Der Tree `2f1e9624558f7b6488255b2514f9b69ca9b3d1eb` ist identisch zum bereits geprüften Kandidaten. Die Installation verwendete ausschließlich dessen tatsächlichen Git-Blob. Nur das Backupskript und die zwei Source-Felder der Environment-Datei änderten sich; fünf andere Artefakte sowie beide Attestationen blieben unverändert. Der Skripthash lautet `f08608144a70577d7486bb02002e11f4c2f4426b164b6a47b5baca0e89de45fb`.

Der erste Installationsaufruf stoppte vor jeder Änderung im Prozess-Preflight. Der danach nicht mehr sichtbare Auslöser ist nicht eindeutig zugeordnet. Nach gesichertem Nulländerungsnachweis und unabhängigem Gegenreview wurde derselbe geprüfte Installer fortgesetzt; es gab keinen zusätzlichen Backupversuch.

Der dritte Backupversuch lief unter `catering-backup-third-gate.service`, Invocation `85ae0223cb0b456c9111d03287809d44`, vom 12.09.2026 18:19:47 bis 18:19:57 UTC. Der wartende Startprozess endete mit Exit 0 nach 10,086 Sekunden; systemd bestätigt erfolgreiche Deaktivierung und `JOB_RESULT=done`. Die erfolgreiche transiente Unit wurde anschließend entladen; spätere `systemctl show`-Standardwerte sind kein historischer ExecMain-Nachweis.

Snapshot `869292d94fdd23351715dec18185f1bbf58f05cc6b3242a66a88a1950259144f` hat Backendzeit 18:19:51.386239054 UTC und Datenzeitpunkt 18:19:47 UTC. Readback, Komponentenchecksummen, Source-/Repositorybindung und Artifact-/Candidate-/Pointerkette sind geprüft. Scope: `postgres,sites,platform-caddy,shared-edge-caddy`. Arbeitsreste fehlen; Originaldienste sind inaktiv, der Timer deaktiviert. Der nicht validierte Snapshot aus Versuch 2 ist weiterhin vorhanden.

Es erfolgte kein Restore, keine neue Schemaaktion, keine Timeraktivierung und keine Anwendungs-/Netzänderung. Ein späterer Restore braucht eine eigene Betreiberfreigabe und frische Prüfung von Candidate-Alter, Repository-/Host-/Adress-/Recoverybindungen, Artefakten, Kapazität, Isolation und Konkurrenzfreiheit. Produktiver Restore, autoritative Restore-Evidence und RTO-Nachweis bleiben offen.

Geheimnisfreie Detailnachweise liegen auf dem Operator-Mac unter `~/.codex/local-evidence/catering-finalconfig-0jae6hqe/`: `third-execution-report.md`, `third-start-result.json`, `third-postcheck-result.json`, `third-unit-lifecycle.json` und der unabhängig geprüfte Adapter samt Manifest. Geschützte Originalkonfigurationen verbleiben auf dem Host; keine Secrets in Repository oder Bericht.
