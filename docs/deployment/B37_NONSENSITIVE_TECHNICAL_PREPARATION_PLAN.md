# B37 Nicht-sensitiver technischer Vorbereitungsplan fuer Option-B-Pilot

Status: Doku-/Vertragstest-only technischer Vorbereitungsplan; kein Deployment-Go, kein SSH-Go, keine Serveraenderung, keine Secret-/ENV-Erstellung, kein Echtdatenstart und keine rechtssichere Compliance-/DSGVO-Freigabe
Stand: 2026-05-24
Scope: reine Arbeitsreihenfolge fuer einen spaeteren technischen Vorbereitungslauf; keine Ausfuehrung, kein Serverlauf, keine Infrastrukturwerte, keine produktive ENV, keine echten Daten, keine echten Uploads, keine Backup-Aktivierung, keine neue API, keine neue Persistenz, keine Migration und keine Produktlogik

## 1. Zweck

B37 formuliert die sichere Reihenfolge fuer einen spaeteren technischen Vorbereitungslauf fuer den Option-B-Pilot.

B37 fuehrt keinen Serverlauf aus. Das Dokument ist kein Runbook zur Ausfuehrung, sondern nur eine nicht-sensitive Planungsreihenfolge, damit die vorbereitende Technikarbeit spaeter nicht versehentlich in Deployment, SSH, Serveraenderung, Secret-Erstellung, echte Datenverarbeitung, Backup-Aktivierung oder Upload-Freigabe kippt.

Fuehrende Eingaben:

- `docs/deployment/B25_HETZNER_DEPLOYMENT_PREFLIGHT.md`
- `docs/deployment/B26_HETZNER_PREFLIGHT_EVIDENCE_CHECKLIST.md`
- `docs/deployment/B27_HETZNER_PREFLIGHT_STATUS_TEMPLATE.md`
- `docs/deployment/B28_HETZNER_PREFLIGHT_DECISION_PACKET.md`
- `docs/deployment/B29_HETZNER_PREFLIGHT_OPERATOR_QUESTIONS.md`
- `docs/deployment/B30_HETZNER_PREFLIGHT_ANSWER_HANDOFF.md`
- `docs/deployment/B31_HETZNER_MANAGEMENT_DECISION_LIST.md`
- `docs/deployment/B32_OPTION_B_REAL_DATA_HETZNER_READINESS.md`
- `docs/deployment/B33_OPTION_B_FOLLOWUP_DECISION.md`
- `docs/deployment/B34_OPTION_B_PILOT_GATE_DECISIONS.md`
- `docs/deployment/B35_OPTION_B_PREPARATION_BOUNDARY.md`
- `docs/deployment/B36_BACKUP_RETENTION_DECISION.md`
- `docs/deployment/B37_NONSENSITIVE_TECHNICAL_PREPARATION_PLAN.md`
- `docs/architecture/B13_PII_RETENTION_BACKUP_GATE.md`
- `docs/architecture/B14_SANDBOX_WORKER_AV_GATE.md`
- `docs/architecture/PA9_PROXY_DEPLOYMENT_READINESS_ADR.md`
- `docs/architecture/B9_PROXY_IAP_AUTHN_PREFLIGHT_CONTRACT.md`
- `TESTING.md`

## 2. Ergebnisstatus

Ergebniswert: `non-sensitive technical preparation plan documented`.

Bedeutung:

- B37 ist eine Planungsunterlage, keine Umsetzung.
- B37 darf spaeter als Checkliste fuer die Reihenfolge dienen.
- B37 erzeugt kein Deployment-Go.
- B37 erzeugt kein SSH-Go.
- B37 erzeugt keine Serveraenderung.
- B37 erzeugt keine Secret-/ENV-Erstellung.
- B37 erzeugt keinen Echtdatenstart.
- B37 erzeugt keine Backup-Aktivierung.
- B37 erzeugt keine echten Uploads.
- B37 erzeugt keine Compliance-/DSGVO-/AVV-Freigabe.

## 3. Arbeitsreihenfolge fuer einen spaeteren Vorbereitungslauf

Ein spaeterer technischer Vorbereitungslauf darf nur in dieser Reihenfolge geplant werden und muss stoppen, sobald ein Schritt echte Infrastrukturwerte, rechtliche Freigaben oder produktive Entscheidungen benoetigt:

1. Gate-Konsistenz pruefen: B25-B37, B13/B14, PA9/B9 und TESTING
   - Pruefen, ob die Statusworte weiter konsistent sind: Doku-/Vertragstest-only, `preparation decision go`, Vorbereitungskorridor, 14 Tage Pilot-Default aus B36 und Upload-Blockade.
   - Kein Deploymentstatus darf auf `go` umgedeutet werden.

2. Zugriffsschutz als Typ festhalten: Tailscale/VPN-only
   - Tailscale/VPN-only als Zugriffsschutz-Typ bestaetigen.
   - Nur den Schutztyp dokumentieren, ohne Tailnet-, Geraete-, IP-, Hostname- oder Serverdetails.
   - Keine Serverbefehle, keine Keys, keine Geraetelisten und keine Netzwerktopologie im Repo dokumentieren.

3. Nicht-Exposition als Regel bestaetigen
   - App/API/Serviceports nicht direkt oeffentlich erreichbar halten.
   - Die Regel gilt fuer UI, Intake, Offer, Production, Export und Datenbankzugriff.
   - Kein Portscan gegen produktive Hosts, keine Firewall-Aenderung und keine Infrastrukturmesswerte in diesem Schritt.

4. Trusted-Header-Grenze pruefen
   - PA9/B9 bleiben fuehrend: serverseitiger Trusted-Kontext, Header-Stripping am Rand und kontrollierte Trusted-Header-Injektion.
   - keine clientseitige Rollen-/Trusted-Header-Freigabe.
   - Keine vollstaendigen Headerdumps, keine Secret-Werte und keine produktive Proxy-Konfiguration im Repo.

5. Evidence-Regeln anwenden
   - Erlaubt sind nur Status-/Existenz-/Testsignale.
   - Erlaubt sind Gate-Status, Test-/Buildstatus, Existenznachweis einer Regel und nicht-sensitive Stop-/Rollback-/Incident-Notizen.
   - Nicht erlaubt: keine PII, keine Secrets, keine Tokens, keine privaten SSH-Keys, keine IPs, keine Hostnames, keine Tailnetdetails, keine echten Inhalte, keine produktiven Logs, keine Screenshots mit echten Daten und keine vollstaendigen Headerdumps.

6. Backup-Retention als Entscheidungsanker uebernehmen
   - 14 Tage Pilot-Default aus B36 nur als Entscheidungsanker uebernehmen.
   - Das ist keine Backup-Aktivierung, kein Backup-Job, kein Restore-Test und keine technische Backup-Konfiguration.
   - Wenn Backup-Aktivierung, echte Backup-Ziele, Restore-Test oder produktive Werte notwendig wuerden, stoppt der Vorbereitungslauf.

7. Uploads weiter `blocked until B14 go` halten
   - Echte Uploads bleiben blockiert, bis B14 separat entschieden und technisch verifiziert ist.
   - Keine echten Dokumente, keine beliebigen Uploads, keine Parser-/Sandbox-/AV-Umsetzung und keine Dateiannahme mit echten Inhalten in diesem Plan.

8. Stop-, Rollback- und Incident-Notizen nicht-sensitiv vorbereiten
   - Notizen duerfen nur Verantwortungsrolle, Status, Entscheidung, naechsten sicheren Schritt und nicht-sensitive Ursache enthalten.
   - Keine echten Daten, keine produktiven Logs, keine IPs/Hostnames, keine Secrets, keine Serverdetails und keine personenbezogenen Inhalte.

## 4. Harte Nicht-Ziele

B37 ist ausdruecklich:

- kein Deployment-Go,
- kein SSH-Go,
- kein Serverzugriff,
- keine Serveraenderung,
- keine Secret-/ENV-Erstellung,
- keine produktive ENV,
- kein Echtdatenstart,
- keine echten Daten,
- keine echten Uploads,
- keine Backup-Aktivierung,
- kein Restore-Test,
- keine neue API,
- keine neue Persistenz,
- keine Migration,
- kein Login/OIDC/Session-Ausbau,
- keine Produktlogik,
- keine Compliance-/DSGVO-Freigabe,
- keine AVV-Freigabe.

## 5. Stop-Regeln

Sofort `blocked` oder `stop`, wenn fuer B37 oder einen daraus abgeleiteten spaeteren Schritt eines der folgenden Dinge noetig wuerde:

- SSH, Serverzugriff oder Serveraenderung,
- produktive ENV oder Secret-/ENV-Erstellung,
- echte Infrastrukturwerte,
- IPs, Hostnames, Tailnet-, Geraete- oder Serverdetails,
- echte Kunden-, Event-, Angebots-, Produktions- oder Dokumentdaten,
- echte Uploads,
- Backup-Aktivierung, Backup-Ziel oder Restore-Test,
- produktive Logs oder vollstaendige Headerdumps,
- neue API, neue Persistenz, Prisma oder Migration,
- Login/OIDC/Session-Ausbau,
- rechtliche, Compliance-, DSGVO- oder AVV-Freigabe.

## 6. Definition of Done

B37 ist erfuellt, wenn:

- dieses Dokument im Repo auffindbar ist,
- die Arbeitsreihenfolge aus Gate-Konsistenz, Zugriffsschutz-Typ, Nicht-Exposition, Trusted-Header-Grenze, Evidence-Regeln, Backup-Retention, Upload-Blockade und Stop-/Rollback-/Incident-Notizen dokumentiert ist,
- keine sensiblen Infrastrukturwerte oder echten Daten dokumentiert sind,
- B37 nicht als Deployment-, SSH-, Secret-, Echtdaten-, Backup-, Upload-, API-, Persistenz-, Migrations-, Compliance-, DSGVO- oder AVV-Go gelesen werden kann,
- `entfernter Doku-Contract-Test` gruen ist,
- `TESTING.md` und `memory.md` fortgeschrieben sind,
- die beauftragten Checks gruen sind.
