# B32 Option-B echter-Daten-Hetzner-Readiness

Status: Readiness-Entscheidungspaket-only fuer Option B; kein Deployment-Go, kein echte-Daten-Go und keine rechtssichere Compliance-/DSGVO-Freigabe
Stand: 2026-05-24
Scope: nicht-sensitive Readiness fuer einen spaeteren echten-Daten-Hetzner-Pilot; keine SSH-Verbindung, keine Serveraenderung, keine Secret-Erstellung, keine ENV-Datei mit echten Werten, keine echte Datenverarbeitung, keine neue API, keine neue Persistenz, keine Migration und keine Produktlogik

## 1. Zweck

B32 ueberfuehrt Alexanders Option-B-Entscheidung in ein sicheres, nicht-sensitives Readiness-Paket.

Option B bedeutet Zielrichtung: echter begrenzter interner Pilot auf einem Hetzner Server mit echten Daten und Nutzung nur durch Berechtigte.

B32 ist bewusst noch keine Umsetzung. Das Paket entscheidet nicht ueber Deployment, echte Datenverarbeitung, rechtliche Freigabe oder produktionsnahe Nutzung. Es macht nur sichtbar, welche Mussgruppen vor einem spaeteren Vorbereitungsschritt bewusst auf `go`, `blocked` oder `not assessed` gesetzt werden muessen.

## 2. Fuehrende Anker

- `docs/plans/hans-night-build-plan-13-option-b-real-data-hetzner-readiness-2026-05-24.md`
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

## 3. Bekannte Managemententscheidungen

Diese Punkte sind aus Alexanders Option-B-Entscheidung bekannt und duerfen nicht-sensitiv dokumentiert werden:

| Feld | Entscheidung | Readiness-Einordnung |
| --- | --- | --- |
| Option | Option B | Zielrichtung ist echter-Daten-Hetzner-Pilot statt P12-lokal/synthetisch. |
| Zielumgebung | Hetzner Server | Zielumgebung benannt, aber kein Deployment-Go und keine Serverdetails im Repo. |
| Nutzerkreis | Alexander | Einzelner interner Berechtigter / Entscheider. |
| Zugriffskontext | Nutzung nur durch Berechtigte, kein oeffentlicher Link | Kein oeffentlicher Link reicht nicht als Zugriffsschutz; technische Zugriffsschicht bleibt Mussentscheidung. |
| Datenrahmen | echte Daten | echte Daten erfordern B13: Datenkategorien, Speicherort, Retention, Backup, Zugriff, Export-/Audit-Klassifikation und Incident-/Loeschpfad. |
| Synthetik/Anonymisierung | echte Daten, kein Synthetiknachweis | P12-Synthetiklinie ist verlassen; B13 wird fuehrend. |
| Technischer Betreiber | The ONE e.K. | technische Projektverantwortung ohne Serverdetails, IPs, Secrets oder produktive ENV-Werte. |
| Dokumentation | notwendig und eher mehr als weniger | Evidence-Paket ohne sensible Inhalte, keine PII, keine Secrets und keine produktiven Logauszuege. |
| Stop-Verantwortung | Alexander | Stop-Verantwortung liegt bei Alexander; Stop-/Rollback-Pfad muss operationalisiert werden. |

Noch nicht ausreichend entschieden:

- fachlicher Betreiber als Rolle/Funktion,
- konkrete Zugriffsschicht fuer Berechtigte,
- Ausschluss direkter Service-Exposition,
- Trusted-Header-/Secret-Grenze am Proxy/IAP,
- Datenkategorien und PII-Scope,
- Speicherort / Systemgrenze,
- Retention / Loeschung,
- Backup / Restore,
- Export / Audit / Logs,
- echte Uploads oder expliziter Upload-Ausschluss,
- Recht / DSGVO / AVV,
- Gesamtstatus.

## 4. Statuswerte

Statuswerte: `go`, `blocked`, `not assessed`.

- `go` bedeutet nur: Die nicht-sensitive Entscheidungsgrundlage fuer diese Mussgruppe ist ausreichend beschrieben. `go` ist kein Deployment-Go und kein echte-Daten-Go.
- `blocked` bedeutet: Die Mussgruppe ist fuer Option B noch nicht sicher freigabefaehig oder beruehrt ein Stop-Gate.
- `not assessed` bedeutet: Die Mussgruppe ist noch nicht bewertet, insbesondere bei Rechts-, DSGVO-, AVV-, Betriebs- oder externen Fragen.

Eine offene oder blockierte Mussgruppe haelt den Gesamtstatus `blocked`. Ein Teil-`go` ersetzt keinen Gesamt-Go.

## 5. Mussgruppen fuer Option B

| Mussgruppe | Status | Nicht-sensitive Entscheidung | Blockiert bis |
| --- | --- | --- | --- |
| Betreiber / Verantwortliche | `not assessed` | Technischer Betreiber ist The ONE e.K.; Stop-Verantwortung liegt bei Alexander; fachlicher Betreiber muss noch als Rolle/Funktion bestaetigt werden. | fachlicher Betreiber, technischer Betreiber und Stop-Verantwortung als nicht-sensitive Rollen bestaetigt sind. |
| Zugriffsschutz / Berechtigte | `blocked` | Nutzung nur durch Berechtigte ist gewollt, aber die konkrete Zugriffsschicht fehlt. | VPN/Tailscale, IP-Allowlist plus Auth, Proxy/IAP/OIDC oder gleichwertige Zugriffsschicht bewusst entschieden ist. |
| Direkte Service-Exposition | `blocked` | Kein oeffentlicher Link reicht nicht; direkte Erreichbarkeit von App/API/Serviceports muss technisch ausgeschlossen sein. | direkte Service-Exposition ausgeschlossen und nicht-sensitiv belegbar ist. |
| Trusted-Header / Secret-Grenze | `blocked` | PA9/B9 verlangen Header-Stripping und kontrollierte serverseitige Trusted-Header-Injektion. | Header-Grenze und serverseitiges Secret ohne Wert bestaetigt sind. |
| Datenkategorien / PII-Scope | `blocked` | Echte Daten sind gewollt; Kategorien sind noch nicht eng genug bestimmt. | Kunden-, Personen-, Mitarbeiter-, Event-, Schicht-, Abrechnungs-, Dokument- und Auditdaten im Scope geklaert sind. |
| Speicherort / Systemgrenze | `blocked` | Hetzner ist Zielumgebung; konkrete Daten-/Artefaktgrenzen duerfen ohne sensitive Details nur als Systemgrenze beschrieben werden. | beteiligte Services, Volumes, Datenpfade, Exporte und Repos nicht-sensitiv klassifiziert sind. |
| Retention / Loeschung | `blocked` | Aufbewahrung und Loeschung echter Daten sind nicht entschieden. | Fristen, Loeschpfad und Loeschnachweis ohne PII festgelegt sind. |
| Backup / Restore | `blocked` | Backup-/Restore-Auswirkungen auf echte Daten und Loeschung sind nicht entschieden. | Backup-Verantwortung, Restore-Risiko und Loeschwirkung in Backups geklaert sind. |
| Export / Audit / Logs | `blocked` | Interne Arbeitsbelege, Auditspuren und Logs koennen echte Daten enthalten. | Klassifikation und Log-/Evidence-Regeln ohne sensible Rohdaten festgelegt sind. |
| Uploads / Sandbox / AV | `blocked` | Echte Uploads sind ohne B14 nicht freigegeben. | echte Uploads explizit ausgeschlossen oder B14-Mindestentscheidungen getroffen sind. |
| Dokumentation / Evidence | `not assessed` | Mehr Dokumentation ist gewollt, aber nur ohne sensible Inhalte. | Evidence-Paket, Reibungslog ohne PII und sichere Ablageform definiert sind. |
| Recht / DSGVO / AVV | `not assessed` | Keine rechtssichere Freigabe im Repo. | externe/rechtliche Bewertung separat erfolgt oder bewusst weiter offen bleibt. |
| Gesamtstatus | `blocked` | Option B ist Zielrichtung, aber noch kein Start-Go. | alle Mussgruppen ohne Widerspruch auf `go` oder bewusst akzeptiertes separates Entscheidungsrisiko gesetzt sind. |

## 6. Sichere Dokumentation und Evidence-Regeln

B32 erlaubt nur nicht-sensitive Ergebnisformen. Das geplante Evidence-Paket ohne sensible Inhalte darf enthalten:

- Status der Mussgruppen,
- gewaehlte Zugriffsschutz-Variante als Typ, ohne Hostnamen, IPs oder Secrets,
- Nachweis, dass direkte Service-Exposition ausgeschlossen wurde, nur als nicht-sensitive Aussage,
- Test-/Build-/Auditstatus ohne produktive Logs,
- Reibungslog ohne PII,
- Stop-/Rollback-Entscheidung ohne echte Serverbefehle oder Zugangsdaten,
- Entscheidung, ob echte Uploads ausgeschlossen bleiben oder B14 separat entschieden wird.

Nicht in Repo, Tests, Lageberichte, Chat oder Evidence gehoeren:

- keine Secrets,
- keine Tokens,
- keine privaten SSH-Keys,
- keine ENV-Dumps,
- keine IP-Adressen,
- keine Hostnamen,
- keine personenbezogenen Echtdaten,
- keine echten Kunden- oder Mitarbeiterdaten,
- keine Einsatz-, Schicht- oder Abrechnungsdetails,
- keine produktiven Logauszuege,
- keine echten Dokumentinhalte,
- keine Screenshots mit PII,
- keine vollstaendigen Headerdumps oder Infrastrukturwerte.

## 7. Harte Stop-Kriterien

Sofort `blocked` oder `decision needed`, wenn:

- Deployment, SSH, Serveraenderung oder produktive Config vor Abschluss der Readiness noetig waeren,
- echte Daten ohne B13-Mindestentscheidungen genutzt werden sollen,
- echte Uploads ohne B14-Entscheidung genutzt werden sollen,
- Services direkt oeffentlich erreichbar waeren,
- Zugriffsschutz nur ueber "kein oeffentlicher Link" begruendet wird,
- Trusted-Actor-/Trusted-Secret-Header clientseitig frei setzbar blieben,
- Evidence, Logs, Exporte oder Screenshots PII oder echte Dokumentinhalte enthalten wuerden,
- eine rechtliche/Compliance-/DSGVO-Freigabe im Repo behauptet werden soll,
- eine neue API, neue Persistenz, Prisma, Migration, neue Produktlogik oder neue Auth-/OIDC-/Login-Implementierung als Teil dieses Readiness-Schritts erforderlich waere.

## 8. Naechster sicherer Schritt

Naechster sicherer Schritt: P13-N2 Abschluss- und Folgeentscheidung.

vorbereitende Umsetzung nur nach separatem Go. Bis dahin gilt:

- keine SSH-Verbindung,
- keine Serveraenderung,
- keine Secret-Erstellung,
- keine produktive ENV,
- keine echte Datenverarbeitung,
- kein Deployment,
- keine neue API,
- keine neue Persistenz,
- keine Migration,
- keine Login-/OIDC-/Session-Implementierung.

Falls P13-N2 kein klares Go fuer eine vorbereitende Umsetzung findet, bleibt der Gesamtstatus `blocked` oder `decision needed`.

## 9. Definition of Done

B32 ist erfuellt, wenn:

- dieses Readiness-Paket im Repo auffindbar ist,
- Alexanders bekannte Option-B-Entscheidungen nicht-sensitiv dokumentiert sind,
- die Mussgruppen B13, B14, B25-B31, PA9/B9 und P12 weiter fuehrend bleiben,
- der Gesamtstatus ohne vollstaendige Mussgruppen nicht als Go gelesen werden kann,
- `tests/b32-option-b-real-data-hetzner-readiness-contract.test.ts` gruen ist,
- die Standard-Gates gruen sind: `npm test`, `npm run build`, `npm audit --omit=dev`, `git diff --check`.
