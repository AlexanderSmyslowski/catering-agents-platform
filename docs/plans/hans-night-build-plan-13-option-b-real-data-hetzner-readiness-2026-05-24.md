# Hans Night Build Plan 13 - Option-B echter-Daten-Hetzner-Readiness

Status: startbereit nach Alexanders Option-B-Entscheidung / kein Deploymentstart in diesem Plan
Stand: 2026-05-24
Scope: Doku-/Vertragstest-only Readiness-Plan fuer einen spaeteren echten-Daten-Hetzner-Pilot; keine Serveraenderung, keine SSH-Verbindung, keine Secret-Erstellung, keine ENV-Datei mit echten Werten, keine echte Datenverarbeitung, keine neue API, keine neue Persistenz, keine Migration, keine Produktlogik und keine rechtssichere Compliance-/DSGVO-Freigabe

## 1. Ausgangslage

Alexander hat nach P12 Option B bewusst gewaehlt:

- Pilot-Zielrichtung: echter begrenzter interner Pilot
- Zielumgebung: Hetzner Server
- Zugriffskontext: Nutzung nur durch Berechtigte, kein oeffentlicher Link
- Datenrahmen: echte Daten
- Dokumentation: lieber mehr notwendige Dokumentation als weniger
- Stop-Verantwortung: Alexander

Diese Entscheidung ist kein direktes Start-Go, weil sie mehrere bisher blockierte Gates beruehrt:

- Hetzner-/Deployment-Kontext aus B25-B31,
- echte Daten / PII / Retention / Backup aus B13,
- echte oder beliebige Uploads / Sandbox / Worker / AV aus B14,
- Trusted-Actor-/Proxy-/IAP-Grenze aus PA7/PA8/PA9 und B8/B9,
- P12-N2-Grenze: echte/produktive Daten bleiben ohne gesonderten Korridor `blocked`.

Der naechste echte Bottleneck ist deshalb kein Produktfeature, sondern ein enger Option-B-Readiness-Korridor.

## 2. Ziel von Plan 13

Plan 13 soll die Option-B-Entscheidung in eine umsetzbare, nicht-sensitive Readiness-Grundlage ueberfuehren.

Ziel ist genau ein enger Plan-13-Artefaktkorridor:

1. Ein Option-B-Readiness-Entscheidungspaket fuer echten-Daten-Hetzner-Pilot erstellen.
2. Die notwendigen Mussgruppen aus B13, B14 und B25-B31 zusammenfuehren.
3. Alexanders bekannte Entscheidungen vorbefuellen, ohne sensitive Werte zu dokumentieren.
4. Harte Stop-Gates sichtbar halten.
5. Einen Folgeentscheid ableiten: `go fuer vorbereitende Umsetzung`, `blocked` oder `decision needed`.

Plan 13 startet keinen Pilot und verarbeitet keine echten Daten.

## 3. Fuehrende Anker

Diese vorhandenen Repo-Anker sind fuehrend:

- `docs/product/P12_N2_MANAGEMENT_GO_NO_GO_ENTSCHEIDUNGSPAKET.md`
- `docs/deployment/B31_HETZNER_MANAGEMENT_DECISION_LIST.md`
- `docs/deployment/B28_HETZNER_PREFLIGHT_DECISION_PACKET.md`
- `docs/deployment/B25_HETZNER_DEPLOYMENT_PREFLIGHT.md`
- `docs/architecture/B13_PII_RETENTION_BACKUP_GATE.md`
- `docs/architecture/B14_SANDBOX_WORKER_AV_GATE.md`
- `docs/architecture/PA7_AUTH_READ_PATH_DECISION_ADR.md`
- `docs/architecture/PA9_PROXY_DEPLOYMENT_READINESS_ADR.md`
- `docs/architecture/B8_AUTH_GATE_DECISION_BOUNDARY.md`
- `docs/architecture/B9_PROXY_IAP_AUTHN_PREFLIGHT_CONTRACT.md`

## 4. Alexanders bekannte Entscheidungen

Diese Punkte duerfen im neuen Option-B-Paket nicht-sensitiv festgehalten werden:

| Feld | Entscheidung | Einordnung |
| --- | --- | --- |
| Option | Option B | Echte-Daten-Hetzner-Korridor statt P12-lokal/synthetisch |
| Nutzerkreis | Alexander | Einzelner interner Berechtigter / Entscheider |
| Technischer Betreiber | The ONE e.K. | technische Projektverantwortung, ohne Serverdetails oder Secrets |
| Zugriffskontext | Hetzner Server, Nutzung nur durch Berechtigte, kein oeffentlicher Link | Noch nicht ausreichend: Zugriffsschutz muss technisch konkretisiert werden |
| Datenrahmen | echte Daten | B13-Gate erforderlich |
| Synthetik/Anonymisierung | echte Daten, kein Synthetiknachweis | B13 statt P12-Synthetiklinie |
| Dokumentation | was notwendig ist, eher mehr als weniger | Nachweise duerfen keine PII, Secrets, IPs oder produktive Logs enthalten |
| Stop-Verantwortung | Alexander | Stop-/Rollback-Pfad muss noch operationalisiert werden |

Noch offen:

- fachlicher Betreiber als Rolle/Funktion,
- konkrete Zugriffsschicht fuer Berechtigte,
- Datenkategorien und PII-Scope,
- Retention/Loeschung/Backup/Restore,
- Uploadumfang und Sandbox/Worker/AV-Gate,
- rechtliche/DSGVO-/Auftragsverarbeitungsbewertung,
- Gesamtbewertung fuer einen spaeteren Umsetzungsschritt.

## 5. Mussgruppen fuer Option B

Jede Mussgruppe muss im naechsten Artefakt auf `go`, `blocked` oder `not assessed` gesetzt werden.

| Mussgruppe | Default fuer Planstart | Muss klaeren |
| --- | --- | --- |
| Betreiber / Verantwortliche | `decision needed` | fachlicher Betreiber, technischer Betreiber, Stop-Verantwortung |
| Zugriffsschutz / Berechtigte | `blocked` | Kein oeffentlicher Link reicht nicht; benoetigt VPN/Tailscale, IP-Allowlist plus Auth, Proxy/IAP/OIDC oder gleichwertige Zugriffsschicht |
| Direkte Service-Exposition | `blocked` | Services duerfen nicht direkt oeffentlich erreichbar sein |
| Trusted-Header / Secret-Grenze | `blocked` | Header-Stripping, kontrollierte Trusted-Header-Injektion, serverseitiges Secret ohne Wert |
| Datenkategorien / PII-Scope | `blocked` | Welche echten Kunden-, Personen-, Mitarbeiter-, Event-, Schicht-, Abrechnungs- und Dokumentdaten sind erlaubt? |
| Retention / Loeschung | `blocked` | Aufbewahrungsfrist, Loeschpfad, Nachweis ohne PII |
| Backup / Restore | `blocked` | Backup-Verantwortung, Restore-Risiko, Loeschwirkung in Backups |
| Export / Audit / Logs | `blocked` | Klassifikation interner Arbeitsbelege; keine sensiblen Rohdaten in Logs/Nachweisen |
| Uploads / Sandbox / AV | `blocked` | echte Uploads nur mit bewusstem B14-Gate oder explizitem Ausschluss |
| Dokumentation / Evidence | `decision needed` | sichere Nachweisstruktur ohne Secrets, IPs, PII, produktive Logs oder echte Dokumentinhalte |
| Recht / DSGVO / AVV | `not assessed` | keine rechtssichere Freigabe im Repo behaupten |
| Gesamtentscheidung | `decision needed` | erst nach obigen Mussgruppen: Vorbereitung starten, blockieren oder weiter klaeren |

## 6. Harte Stop-Gates

Sofort `blocked` oder `decision needed`, wenn eines davon fuer den naechsten Schritt erforderlich waere:

- SSH-Zugriff, Serveraenderung, Deployment oder produktive Config vor Readiness-Entscheidung,
- echte Secret-Werte, Tokens, private SSH-Keys, ENV-Dumps, IP-Adressen oder Serverdetails im Repo, Chat, Bericht oder Test,
- direkter oeffentlicher Zugriff auf App oder APIs,
- unklare Zugriffsschicht fuer Berechtigte,
- echte Daten ohne ausgefuellten B13-PII-/Retention-/Backup-Entscheid,
- echte Uploads ohne B14-Sandbox-/Worker-/AV-Entscheid oder expliziten Ausschluss,
- Logs, Screenshots, Exporte oder Evidence mit PII, Kundendaten, Mitarbeiterdaten, Einsatzdaten, echten Dokumentinhalten oder produktiven Logauszuegen,
- neue API, neue Persistenz, Prisma, Migration oder Produktlogik als vermeintlicher Readiness-Fix,
- rechtliche/Compliance-/DSGVO-Freigabe wird im Repo behauptet statt separat entschieden.

## 7. Arbeitsweise fuer Plan 13

### Cycle P13-N1 - Option-B-Readiness-Paket

Ziel:
- Ein nicht-sensitives Entscheidungspaket fuer Option B erstellen, das Alexanders bekannte Entscheidungen aufnimmt und die offenen Mussgruppen sichtbar macht.

Erlaubt:
- Doku-/Vertragstest-only,
- vorhandene B13/B14/B25-B31/PA7-PA9/B8-B9/P12-Anker verlinken,
- konservative Defaults `blocked`/`not assessed` beibehalten,
- Nachweisstruktur fuer spaetere Dokumentation definieren.

Nicht erlaubt:
- Deployment,
- SSH,
- Hetzner-Serveraenderung,
- Secret-Erstellung,
- echte Datenverarbeitung,
- produktive `.env`,
- neue API/Persistenz/Migration,
- Auth/OIDC/Login-Implementierung,
- neue Produktlogik,
- echte Logs, IPs, Hostnamen oder PII im Repo.

Pflicht-Gates bei Aenderung:
- fokussierter Contract-Test fuer das Option-B-Paket,
- `npm test`,
- `npm run build`,
- `npm audit --omit=dev`,
- `git diff --check`.

### Cycle P13-N2 - Abschluss- und Folgeentscheidung

Ziel:
- Nach P13-N1 pruefen, ob ein klarer, sicherer Folgeplan fuer vorbereitende Umsetzung existiert oder ob `decision needed`/`blocked` stehen bleiben muss.

Moegliche Ergebniswerte:

- `go fuer vorbereitende Umsetzung`: nur wenn alle nicht-sensitiven Mussgruppen ausreichend entschieden sind und der naechste Schritt ohne echte Daten/Secrets/Serverzugriff vorbereitet werden kann.
- `decision needed`: wenn Zugriffsschutz, Datenrahmen, Retention/Backup, Uploads, Recht/DSGVO oder Dokumentation noch nicht entscheidbar sind.
- `blocked`: wenn Option B technisch/organisatorisch nicht ohne Stop-Gate begonnen werden kann.

## 8. Definition of Done

Plan 13 ist erledigt, wenn:

- ein Option-B-Readiness-Entscheidungspaket im Repo liegt,
- Alexanders bekannte Entscheidungen nicht-sensitiv aufgenommen sind,
- B13/B14/B25-B31/PA7-PA9/B8-B9/P12 verlinkt bleiben,
- echte Daten und Hetzner nicht mehr versehentlich als P12-Go lesbar sind,
- ein fokussierter Contract-Test die Grenzen schuetzt,
- Gates gruen sind,
- ein Lagebericht den Status, Blocker, Risiken und naechsten Schritt zusammenfasst.

## 9. Erwarteter naechster kleinster Schritt

Starte P13-N1:

- Datei erstellen: `docs/deployment/B32_OPTION_B_REAL_DATA_HETZNER_READINESS.md`
- Test erstellen: `entfernter Doku-Contract-Test`
- Nur Doku-/Contract-Guards, kein Deployment, keine echten Daten, keine Secrets.
