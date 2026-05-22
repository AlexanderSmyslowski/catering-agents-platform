# B25 Hetzner-Deployment-Preflight

Status: Doku-/Vertragstest-only Preflight-Anker fuer Alexanders Hetzner-Zielumgebung
Stand: 2026-05-22
Scope: interne Stabilisierung / Abnahmefähigkeit; kein Deployment, keine Serveränderung, keine SSH-Verbindung, keine Secret-Erstellung, keine ENV-Datei mit echten Werten, keine Docker-/systemd-/nginx-Konfiguration mit produktiven Annahmen, kein öffentlicher Direktzugriff, kein produktionsnaher Pilot, keine neue API, keine neue Persistenz, keine Migration, keine Produktlogik und keine rechtssichere Compliance-/DSGVO-Freigabe

## 1. Zweck

B25 verankert die nächste Betriebsentscheidung für einen späteren Catering-Agent-Zielbetrieb auf Alexanders Hetzner-Server.

Der Anker deployt nichts. Er beschreibt nur, welche Annahmen eine Hetzner-Zielumgebung erfüllen muss, welche Punkte vor einem Deployment zu prüfen sind, welche Stop-Kriterien gelten und was aus dem internen Demo-Go weiterhin nicht abgeleitet werden darf.

## 2. Aktuelle Vorentscheidung

- Zielumgebung: Alexanders Hetzner-Server
- Deploymentstatus: `not deployed`
- Produktiv-/Pilotstatus: weiterhin `blocked`, bis Preflight ausgefüllt ist
- öffentlicher Direktzugriff: `blocked`
- direkte Service-Exposition: `blocked`
- produktionsnaher Pilot: `blocked`

Diese Vorentscheidung ist nur ein Betriebsanker. Sie ist kein Deployment-Go, kein Pilot-Go und keine Freigabe für echte Daten oder echte Uploads.

## 3. Mindestannahmen für die Hetzner-Zielumgebung

Vor jedem Deployment müssen mindestens diese Annahmen konkret ausgefüllt und nachgewiesen sein:

| Annahme | Mindestanforderung | Default |
| --- | --- | --- |
| Zugriffsschicht | Reverse Proxy / IAP oder vergleichbare Zugriffsschicht erforderlich | `blocked` |
| Service-Erreichbarkeit | direkte Service-Exposition blockiert; App/API-Services dürfen nicht direkt öffentlich erreichbar sein | `blocked` |
| Secrets/ENV | serverseitige Secrets/ENV bleiben außerhalb des Repos | `blocked` |
| Secret-Leak-Grenze | keine Secrets in Git, Reports, Logs oder Telegram | `blocked` |
| HTTPS/TLS | HTTPS/TLS muss geklärt sein, inklusive Terminierung und Zertifikatsverantwortung | `not assessed` |
| Prozessmodell | Prozessmodell muss geklärt sein; systemd/pm2/docker sind nur Entscheidungspunkte, keine B25-Implementierung | `not assessed` |
| Healthchecks | Healthchecks dürfen nicht sensitiv sein und keine Kunden-, Event-, Rezept-, Angebots-, Produktions-, Einkaufs-, Audit-, Secret-, Token-, Pfad- oder Stackdaten ausgeben | `blocked` |
| Stop/Rollback | Rollback-/Stop-Pfad muss vor Deployment bekannt sein | `blocked` |

## 4. Vor Deployment zu prüfen

B25 ersetzt B10/B13/B14/B24 nicht. Für Alexanders Hetzner-Server müssen vor jedem Deployment mindestens diese Punkte geprüft werden:

- B10-Preflight für die konkrete Zielumgebung ausfüllen: `docs/architecture/B10_PILOT_PREFLIGHT_RUNBOOK.md`.
- Reverse-Proxy-/IAP- oder vergleichbare Zugriffsschicht benennen.
- Prüfen, dass öffentliche Requests nicht direkt Intake-, Offer-, Production- oder Export-Service erreichen.
- Header-Stripping und kontrollierte Trusted-Header-Injektion aus B9/B10 prüfen.
- Server-seitige Secret-Setzung klären, ohne echte Werte im Repo, in Reports, Logs oder Telegram zu dokumentieren.
- HTTPS/TLS-Terminierung, Zertifikats-/Domain-Verantwortung und Weiterleitung klären.
- Prozessmodell als Entscheidung klären, zum Beispiel systemd/pm2/docker; B25 implementiert keines davon.
- Daten-/Storage-/Backup-/Retention-Verantwortung bleibt vor echten Daten blockierend und ist über `docs/architecture/B13_PII_RETENTION_BACKUP_GATE.md` zu entscheiden.
- Upload-/Dateiverarbeitung bleibt ohne Sandbox/Worker/AV blockiert und ist über `docs/architecture/B14_SANDBOX_WORKER_AV_GATE.md` zu entscheiden.
- Rollback-/Stop-Pfad vor Deployment benennen: Wer stoppt was, welcher Zustand wird wiederhergestellt, welche Daten/Artefakte sind betroffen?

## 5. Stop-Kriterien

Sofort stoppen beziehungsweise blockieren, wenn einer dieser Fälle eintritt:

- Preflight nicht ausgefüllt oder nicht nachgewiesen,
- öffentlicher Direktzugriff geplant,
- direkte Service-Exposition vorgesehen,
- Reverse Proxy / IAP oder vergleichbare Zugriffsschicht fehlt,
- Secrets sollen im Repo, in Reports, Logs oder Telegram erscheinen,
- serverseitige ENV-/Secret-Verantwortung ungeklärt,
- HTTPS/TLS ungeklärt,
- Prozessmodell ungeklärt,
- Healthchecks geben sensitive Informationen aus oder sollen sensitive Informationen ausgeben,
- Rollback-/Stop-Pfad unbekannt,
- Daten-/Storage-/Backup-/Retention-Verantwortung vor echten Daten ungeklärt,
- echte Daten, echte Uploads oder längere Speicherung ohne B13/B14-Entscheidung,
- ein internes Demo-Go soll als Deployment-Go, Produktionsfreigabe oder produktionsnahe Pilotfreigabe gelesen werden.

Bei einem Stop-Kriterium bleibt der betroffene Korridor `blocked` oder mindestens `not assessed`.

## 6. Was aus dem internen Demo-Go nicht abgeleitet werden darf

Der interne Demo-Go aus B24 bleibt eng begrenzt. Für B25 gilt ausdrücklich:

- interner Demo-Go ist kein Deployment-Go,
- kein Produktivbetrieb,
- keine produktionsnahe Pilotfreigabe,
- keine externe Freigabe,
- keine Freigabe für echte Daten,
- keine Freigabe für echte Kunden-, Mitarbeiter-, Einsatz-, Schicht- oder Abrechnungsdaten,
- keine Freigabe für beliebige echte Uploads,
- keine Freigabe für öffentliche Erreichbarkeit,
- keine AuthN/AuthZ-, Login-, OIDC-, Proxy-/IAP-, Sandbox-/Worker-/AV-, Retention- oder Backup-Implementierung,
- keine rechtssichere Compliance-/DSGVO-Freigabe.

## 7. Bezug zu bestehenden Gates

B25 ist ein konkreter Hetzner-Zielumgebungsanker, aber kein Ersatz für bestehende Gates:

- `docs/architecture/B10_PILOT_PREFLIGHT_RUNBOOK.md` bleibt führend für konkrete Zielumgebung, Betreiber, Proxy-/IAP-Rahmen, direkte Service-Exposition, Header-Stripping, Trusted-Header-Injektion, serverseitiges Secret, Health-Grenzen und Export-/Read-Kontext.
- `docs/architecture/B13_PII_RETENTION_BACKUP_GATE.md` bleibt führend für echte Daten, PII-Scope, Speicherort, Retention, Löschung, Backup/Restore, Zugriff und Incident-/Löschpfad.
- `docs/architecture/B14_SANDBOX_WORKER_AV_GATE.md` bleibt führend für echte Uploads, erlaubte Dateitypen, Größenlimits, Quarantäne/Reject, Scan-/Sandbox-Verantwortung, Worker-Isolation, Ressourcenlimits und Fehler-/Warnpfad.
- `docs/product/B24_PILOT_KORRIDOR_ENTSCHEIDUNGSANKER.md` bleibt führend für die konservative Pilot-Korridor-Entscheidung: interner Demo-Modus `go`, begrenzter interner Pilot mit anonymisierten Daten `not assessed`, produktionsnaher Pilot mit echten Daten, öffentlicher Direktzugriff und beliebige echte Uploads `blocked`.

## 8. Nicht-Ziele / Grenzen

B25 führt ausdrücklich nicht ein:

- kein Deployment,
- keine Serveränderung,
- keine SSH-Verbindung,
- keine Secret-Erstellung,
- keine ENV-Datei mit echten Werten,
- keine Docker-/systemd-/nginx-Konfiguration,
- keine neue API,
- keine neue Persistenz,
- keine Migration,
- kein Login/OIDC,
- keine Produktlogik,
- keine Produktfläche,
- keine echten Daten,
- keine rechtssichere Compliance-/DSGVO-Freigabe.

## 9. Abnahmehinweis

B25 ist erfüllt, wenn dieser Anker im Repo auffindbar bleibt, TESTING auf den B25-Vertragstest verweist und `tests/b25-hetzner-deployment-preflight-contract.test.ts` grün ist.

Die technischen Standard-Gates bleiben unverändert: `npm test`, `npm run build`, `npm audit --omit=dev` und `git diff --check`.
