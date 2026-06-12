# B35 Option-B Vorbereitungskorridor ohne sensible Werte

Status: Doku-/Vertragstest-only Vorbereitungskorridor; kein Deployment-Go, kein echte-Daten-Start-Go, kein SSH-Go, keine Serveraenderung und keine rechtssichere Compliance-/DSGVO-Freigabe
Stand: 2026-05-24
Scope: nicht-sensitive Eingrenzung des ersten spaeteren Vorbereitungslaufs nach B34; keine SSH-Verbindung, keine Serveraenderung, keine Secret-Erstellung, keine produktive ENV, keine echte Datenverarbeitung, keine echten Uploads, keine neue API, keine neue Persistenz, keine Migration und keine Produktlogik

## 1. Zweck

B35 uebersetzt B34 in den kleinsten sicheren Vorbereitungskorridor.

Der Zweck ist nicht, den Hetzner-Server zu veraendern oder echte Daten zu nutzen. B35 legt nur fest, welche vorbereitenden Punkte spaeter zuerst nicht-sensitiv geklaert oder geprueft werden duerfen, damit aus dem `preparation decision go` kein stilles Deployment-, SSH-, Secret- oder Echtdaten-Go wird.

Fuehrende Eingaben:

- `docs/deployment/B34_OPTION_B_PILOT_GATE_DECISIONS.md`
- `docs/deployment/B32_OPTION_B_REAL_DATA_HETZNER_READINESS.md`
- `docs/deployment/B33_OPTION_B_FOLLOWUP_DECISION.md`
- `docs/deployment/B31_HETZNER_MANAGEMENT_DECISION_LIST.md`
- `docs/architecture/B13_PII_RETENTION_BACKUP_GATE.md`
- `docs/architecture/B14_SANDBOX_WORKER_AV_GATE.md`
- `docs/architecture/PA9_PROXY_DEPLOYMENT_READINESS_ADR.md`
- `docs/architecture/B9_PROXY_IAP_AUTHN_PREFLIGHT_CONTRACT.md`

## 2. Ergebnisstatus

Ergebniswert: `preparation corridor defined`.

Bedeutung:

- Der naechste technische Schritt darf als Vorbereitung geplant werden.
- Der Vorbereitungsschritt darf keine produktiven Werte, Secrets, IPs, Hostnamen oder echte Daten benoetigen.
- Der Vorbereitungsschritt muss abbrechen, sobald SSH, Serveraenderung, produktive ENV, echte Daten, echte Uploads oder rechtliche Freigabe erforderlich werden.
- B35 ist keine Umsetzung und kein Betriebsfreigabeersatz.

## 3. Erlaubter Vorbereitungskorridor

| Korridorpunkt | Erlaubte Vorbereitung | Nicht erlaubt |
| --- | --- | --- |
| Gate-Konsistenz | B25-B35, B13/B14, PA9/B9 und TESTING konsistent halten | Deploymentstatus auf `go` setzen oder echte Werte dokumentieren |
| Zugriffsschicht | Tailscale/VPN-only als Zieltyp nicht-sensitiv beschreiben | IPs, Hostnamen, Geraetenamen, Keys, Tailnet-Details oder Serverbefehle dokumentieren |
| Direkte Service-Exposition | Nicht-sensitive Regel festhalten: App/API/Serviceports duerfen nicht direkt oeffentlich erreichbar sein | Portscans gegen produktive Hosts, Firewall-Aenderungen oder echte Infrastrukturwerte im Repo |
| Trusted-Header-Grenze | PA9/B9-Regel ueber Header-Stripping und serverseitig gesetzten Trusted-Kontext als Mussregel wiederverwenden | Secret-Werte, Headerdumps, produktive Proxy-Konfiguration oder clientseitige Header-Freigabe |
| Evidence-Regeln | Nicht-sensitive Evidence-Formen definieren: Status, Test-/Buildsignal, Existenznachweis ohne Inhalte | PII, echte Dokumentinhalte, produktive Logs, Screenshots mit echten Daten, IPs oder Hostnamen |
| Backup-Retention | Offene Entscheidung sichtbar halten: begrenztes Backup, konkrete Retention noch festzulegen | Backup aktivieren, Restore testen oder Backup-Werte mit echten Daten dokumentieren |
| Uploads | B14 als harte Blockade vor echten Uploads sichtbar halten | echte oder beliebige Uploads, Parser-/Sandbox-/AV-Implementierung, Dateiannahme mit echten Inhalten |
| Recht/DSGVO/AVV | Verantwortung und ausserhalb-des-Repos-Klaerung benennen | rechtssichere Freigabe im Repo behaupten |

## 4. Mussreihenfolge fuer einen spaeteren Vorbereitungslauf

Ein spaeterer Vorbereitungslauf muss in dieser Reihenfolge stoppen oder fortfahren:

1. Pruefen, ob die Entscheidung aus B34 weiter gilt.
2. Backup-Retention konkretisieren oder als offene Entscheidung markieren.
3. Zugriffsschicht nur als Typ vorbereiten: `Tailscale/VPN-only`.
4. Nicht-Exposition als harte Betriebsregel festhalten.
5. Trusted-Header-/Secret-Grenze aus PA9/B9 uebernehmen.
6. Evidence-Regeln ohne PII/Secrets/IPs/Hostnamen bestaetigen.
7. Uploads weiter `blocked until B14 go` halten.
8. Erst danach einen separaten, erneut freizugebenden technischen Umsetzungsplan formulieren.

Wenn ein Schritt echte Infrastrukturwerte, SSH, Secrets, produktive ENV oder echte Daten benoetigt, stoppt der Vorbereitungslauf.

## 5. Offene Entscheidung

Noch offen bleibt:

- konkrete Backup-Retention.

Default-Vorschlag bleibt: 7-14 Tage, sofern Alexander keine andere Retention festlegt.

Diese offene Entscheidung blockiert nicht das Schreiben eines Vorbereitungskorridors, aber sie blockiert einen echten Datenstart, wenn die Backup-/Loeschwirkung nicht bewusst geklaert ist.

## 6. Harte Stop-Regeln

Sofort `blocked` oder `stop`, wenn:

- ein B35-Schritt als Deployment-Go gelesen wird,
- SSH-Verbindung, Serveraenderung oder produktive Config erforderlich wird,
- Secrets, Tokens, private SSH-Keys oder ENV-Werte dokumentiert werden sollen,
- IP-Adressen, Hostnamen, Serverdetails oder Tailnet-/Geraetedetails ins Repo sollen,
- echte Daten, echte Dokumente oder echte Uploads benoetigt werden,
- technische Logs Rohdaten/PII enthalten oder als Evidence ins Repo sollen,
- direkte oeffentliche Service-Exposition akzeptiert werden soll,
- clientseitig gesetzte Actor-/Trusted-Header produktionsnah akzeptiert werden sollen,
- B14 fuer echte Uploads nicht entschieden ist,
- eine Compliance-/DSGVO-/AVV-Freigabe im Repo behauptet werden soll,
- neue API, neue Persistenz, Prisma, Migration, Login/OIDC/Session oder neue Produktlogik erforderlich waere.

## 7. Naechster sinnvoller Schritt nach B35

Naechster sinnvoller Schritt nach B35 ist kein Serverlauf, sondern entweder:

1. Backup-Retention als kurze Managemententscheidung nachtragen, oder
2. einen separaten technischen Vorbereitungsplan erstellen, der nur die nicht-sensitiven Regeln aus B35 in eine Arbeitsreihenfolge bringt und weiterhin ohne SSH, Secrets, produktive ENV, echte Daten und echte Uploads startet.

## 8. Definition of Done

B35 ist erfuellt, wenn:

- dieser Vorbereitungskorridor im Repo auffindbar ist,
- er B34 nicht zu einem Deployment-, SSH-, Secret- oder Echtdaten-Go erweitert,
- die erlaubten Vorbereitungspunkte von den verbotenen Umsetzungs-/Betriebspunkten getrennt sind,
- Backup-Retention als offene Folgeentscheidung sichtbar bleibt,
- echte Uploads bis B14 `blocked until B14 go` bleiben,
- `entfernter Doku-Contract-Test` gruen ist,
- die Standard-Gates gruen sind: `npm test`, `npm run build`, `npm audit --omit=dev`, `git diff --check`.
