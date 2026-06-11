# B34 Option-B Pilot-Gate-Entscheidungen

Status: Doku-/Vertragstest-only Pilot-Gate-Entscheidungsanker; kein Deployment-Go, kein echte-Daten-Start-Go, kein SSH-Go und keine rechtssichere Compliance-/DSGVO-Freigabe
Stand: 2026-05-24
Scope: nicht-sensitive Verdichtung von Alexanders Option-B-Entscheidungen fuer einen spaeteren Hetzner-/Echtdaten-Pilot; keine SSH-Verbindung, keine Serveraenderung, keine Secret-Erstellung, keine produktive ENV, keine echte Datenverarbeitung, keine neue API, keine neue Persistenz, keine Migration und keine Produktlogik

## 1. Zweck

B34 haelt Alexanders beantwortete Pilot-Gate-Entscheidungen fuer Option B fest und ersetzt die in B33 noch offene Managementklaerung durch einen nicht-sensitiven Entscheidungsanker.

B34 ist bewusst kein technischer Vorbereitungslauf und kein Pilotstart. Das Dokument erlaubt nur, einen spaeteren eng begrenzten Vorbereitungsschritt zu planen, sofern dieser weiterhin ohne Serverzugriff, Secrets, produktive Werte und echte Daten beginnt.

Fuehrende Eingaben:

- `docs/deployment/B32_OPTION_B_REAL_DATA_HETZNER_READINESS.md`
- `docs/deployment/B33_OPTION_B_FOLLOWUP_DECISION.md`
- `docs/deployment/B31_HETZNER_MANAGEMENT_DECISION_LIST.md`
- `docs/architecture/B13_PII_RETENTION_BACKUP_GATE.md`
- `docs/architecture/B14_SANDBOX_WORKER_AV_GATE.md`
- `docs/architecture/PA9_PROXY_DEPLOYMENT_READINESS_ADR.md`
- `docs/architecture/B9_PROXY_IAP_AUTHN_PREFLIGHT_CONTRACT.md`

## 2. Ergebnisstatus

Ergebniswert: `preparation decision go`.

Bedeutung:

- `preparation decision go` erlaubt einen spaeteren, separaten Plan fuer vorbereitende Umsetzung.
- Es ist kein Deployment-Go.
- Es ist kein echte-Daten-Start-Go.
- Es ist kein SSH-Go.
- Es ist keine Serveraenderung.
- Es ist keine Secret-Erstellung.
- Es ist keine Compliance-/DSGVO-Freigabe.

Ein spaeterer Vorbereitungslauf muss erneut scope-begrenzt starten und zuerst Zugriffsschicht, direkte Nicht-Exposition, Trusted-Header-Grenze, sichere Evidence-Regeln und Upload-Blockade technisch/dokumentarisch absichern, bevor echte Daten beruehrt werden.

## 3. Verbindliche Entscheidungen

| Gate | Entscheidung | Status | Grenze |
| --- | --- | --- | --- |
| Fachlicher Betreiber | Alexander / The ONE e.K. Geschaeftsfuehrung | `go` | Verantwortungsrolle, keine personenbezogene Detaildokumentation im Repo. |
| Zugriffsschicht | Tailscale/VPN-only | `go` | Kein oeffentlicher Direktzugriff; genaue Netz-/Geraete-/Serverdetails bleiben ausserhalb des Repos. |
| Direkte Service-Exposition | App/API/Serviceports duerfen nicht direkt aus dem Internet erreichbar sein | `go` | Keine oeffentlichen Serviceports fuer UI, Intake, Offer, Production, Export oder Datenbank. |
| Trusted-Header / Secret-Grenze | Zunaechst Einzelzugriff Alexander; Proxy/IAP beziehungsweise Edge setzt spaeter den Trusted-Kontext serverseitig als Zielregel | `go` | Browser darf produktionsnah keine Rollen-/Trusted-Header frei setzen; Secret-Werte bleiben serverseitig und ausserhalb des Repos. |
| Datenkategorien / PII-Scope | Kunden-, Event-, Angebots- und Produktionsdaten duerfen im Pilot-Scope liegen | `go` | Mitarbeiter-, Schicht- und Abrechnungsdaten bleiben ausgeschlossen. |
| Speicherort / Systemgrenze | Nur Hetzner-App-Systemgrenze | `go` | Keine echten Daten im Git-Repo, in Telegram, Lageberichten, Tests, Screenshots oder externen Diensten. |
| Retention / Loeschung | 90 Tage; Loeschverantwortung Alexander | `go` | Loeschung muss manuell veranlasst und ohne PII im Repo dokumentierbar bleiben. |
| Backup / Restore | Begrenztes Backup ist gewollt | `decision needed` | Konkrete Backup-Retention ist noch festzulegen; Default-Vorschlag bleibt 7-14 Tage. |
| Export / Audit / Logs | Exporte duerfen echte Arbeitsdaten enthalten; Audit/Logs nur, wenn fachlich notwendig | `go with restriction` | Technische Logs sollen keine unnoetigen Rohdaten/PII enthalten; keine produktiven Logauszuege im Repo. |
| Uploads / Sandbox / AV | Echte Uploads erst nach separatem Upload-Sicherheitsgate | `blocked until B14 go` | Keine beliebigen echten Uploads vor B14-Mindestentscheidungen. |
| Recht / DSGVO / AVV | Verantwortung bei The ONE e.K. | `not assessed in repo` | Keine rechtssichere Freigabe im Repo; AVV/TOMs/rechtliche Bewertung ausserhalb klaeren. |
| Dokumentation / Evidence | Erweiterte Dokumentation ohne sensible Inhalte; spaeter vollstaendige Betriebsdokumentation | `go` | Keine Secrets, IPs, Hostnamen, PII, echte Dokumentinhalte oder produktive Logs im Repo. |
| Stop-Regel | Stop-Regel bestaetigt | `go` | Stop sofort bei Verletzung der Zugriff-, Daten-, Upload-, Evidence-, Secret- oder Compliance-Grenzen. |

## 4. Aufgeloeste Risikopunkte

### 4.1 Export / Audit / Logs

Die fruehere breite Option `B` wird eingeschraenkt:

- Exporte duerfen echte Arbeitsdaten enthalten, weil sie fachliche Arbeitsbelege sind.
- Audit darf echte Daten nur enthalten, wenn sie fachlich notwendig sind.
- Technische Logs sollen keine unnoetigen Rohdaten/PII enthalten.
- Produktive Logauszuege gehoeren nicht in Repo, Tests, Telegram, Lageberichte oder allgemeine Evidence.

### 4.2 Uploads / Sandbox / AV

Die fruehere breite Option `C` wird eingeschraenkt:

- beliebige echte Uploads sind nicht unmittelbar freigegeben,
- echte Uploads bleiben bis zum separaten Upload-Sicherheitsgate `blocked until B14 go`,
- vor echten Uploads muessen mindestens Dateitypen, Groessenlimits, Quarantaene-/Reject-Verhalten, Malware-/AV-Scan, Parser-Sandbox, Worker-Isolation, Timeout-/Ressourcenlimits, Warnpfad, Zugriff, Loeschung und Betriebsverantwortung entschieden sein.

## 5. Sichere Evidence-Regeln

Erlaubt sind nur nicht-sensitive Ergebnisformen:

- Gate-Status und Entscheidungsstatus,
- Zugriffsschicht als Typ, ohne IPs, Hostnamen, Geraete- oder Serverdetails,
- Aussage, dass direkte Service-Exposition ausgeschlossen ist,
- Test-/Build-/Smoke-Status ohne produktive Logs,
- Reibungslog ohne PII,
- Export-/Audit-Nachweis nur als Existenz-/Statusnachweis ohne echte Inhalte,
- Loesch-/Retention-Vermerk ohne personenbezogene Inhalte,
- Stop-/Incident-Vermerk ohne Secrets, IPs, Hostnamen oder echte Daten.

Nicht dokumentieren:

- keine Secrets,
- keine Tokens,
- keine privaten SSH-Keys,
- keine produktive ENV,
- keine IP-Adressen,
- keine Hostnamen,
- keine Serverdetails,
- keine personenbezogenen Echtdaten,
- keine Kunden- oder Mitarbeiterdaten,
- keine Einsatz-, Schicht- oder Abrechnungsdetails,
- keine echten Dokumentinhalte,
- keine produktiven Logauszuege,
- keine Screenshots mit PII,
- keine vollstaendigen Headerdumps.

## 6. Harte Stop-Regeln

Sofort `blocked` oder `stop`, wenn:

- App, API, Serviceports oder Datenbank direkt oeffentlich erreichbar sind,
- Tailscale/VPN-only beziehungsweise eine gleichwertige Zugriffsschicht nicht aktiv ist,
- clientseitige Actor-/Trusted-Header produktionsnah akzeptiert werden,
- echte Daten ausserhalb der Hetzner-App-Systemgrenze landen,
- echte Daten in Git, Telegram, Lageberichten, Tests, Screenshots oder externen Diensten landen,
- Mitarbeiter-, Schicht- oder Abrechnungsdaten genutzt werden,
- technische Logs unnoetige Rohdaten/PII enthalten,
- echte Uploads vor B14-Sicherheitsgate genutzt werden,
- Secrets, IPs, Hostnamen, ENV-Werte oder produktive Logauszuege dokumentiert werden sollen,
- eine rechtssichere Compliance-/DSGVO-Freigabe im Repo behauptet werden soll,
- eine neue API, neue Persistenz, Prisma, Migration, Login/OIDC/Session oder neue Produktlogik als Teil dieses Gates erforderlich waere.

## 7. Naechster sicherer Schritt

Naechster sicherer Schritt nach B34 ist ein separater, kleiner Vorbereitungslauf nur fuer nicht-sensitive Vorbereitung:

1. Pilot-Gate-Status in B25-B31/B32/B33/B34 konsistent halten.
2. Technischen Zugriffsschutz als Tailscale/VPN-only vorbereiten, ohne Serverdetails im Repo.
3. Direkte Service-Exposition ausschliessen und nicht-sensitiv belegbar machen.
4. Trusted-Header-/Secret-Grenze gemaess PA9/B9 bestaetigen, ohne Secret-Werte.
5. Backup-Retention konkret entscheiden.
6. Uploads weiter blockieren, bis B14 separat entschieden und technisch verifiziert ist.

Nicht Teil dieses Schritts:

- kein Deployment,
- keine SSH-Verbindung,
- keine Serveraenderung,
- keine Secret-Erstellung,
- keine produktive ENV,
- keine echte Datenverarbeitung,
- keine echten Uploads,
- keine neue API,
- keine neue Persistenz,
- keine Migration,
- keine neue Produktlogik,
- keine Login-/OIDC-/Session-Implementierung.

## 8. Definition of Done

B34 ist erfuellt, wenn:

- dieses Pilot-Gate-Dokument im Repo auffindbar ist,
- Alexanders Entscheidungen 1-13 mit den Risikobegrenzungen dokumentiert sind,
- 9B und 10C nicht als pauschale Freigaben missverstanden werden koennen,
- Backup-Retention als einziges engeres Folgeentscheidungsfeld sichtbar bleibt,
- echte Uploads bis B14 `blocked until B14 go` bleiben,
- der naechste Schritt nur Vorbereitung ohne Serverzugriff/Secrets/echte Daten erlaubt,
- `entfernter Doku-Contract-Test` gruen ist,
- die Standard-Gates gruen sind: `npm test`, `npm run build`, `npm audit --omit=dev`, `git diff --check`.
