# B31 Hetzner-Management-Entscheidungsliste

Status: Management-Entscheidungsliste-only fuer Alexanders Hetzner-Zielumgebung
Stand: 2026-05-22
Scope: interne Stabilisierung / Abnahmefähigkeit; kein Deployment, keine Serveränderung, keine SSH-Verbindung, keine Secret-Erstellung, keine ENV-Datei mit echten Werten, keine Docker-/systemd-/nginx-Konfiguration, keine neue API, keine neue Persistenz, keine Migration, keine Produktlogik, keine echten Daten und keine rechtssichere Compliance-/DSGVO-Freigabe

## 1. Zweck

B31 verdichtet B25-B29 in eine kurze Management-Entscheidungsliste fuer Alexander.

Die Liste ersetzt nicht die Detailanker. Sie macht nur sichtbar, welche wenigen Mussgruppen vor einem spaeteren Hetzner-Schritt bewusst eingeordnet werden muessen. Sie fuehrt nichts aus, verbindet sich mit keinem Server, erzeugt keine Secrets, sammelt keine Infrastrukturwerte und dokumentiert keine Serverdetails.

Bezüge:

- `docs/deployment/B25_HETZNER_DEPLOYMENT_PREFLIGHT.md`
- `docs/deployment/B26_HETZNER_PREFLIGHT_EVIDENCE_CHECKLIST.md`
- `docs/deployment/B27_HETZNER_PREFLIGHT_STATUS_TEMPLATE.md`
- `docs/deployment/B28_HETZNER_PREFLIGHT_DECISION_PACKET.md`
- `docs/deployment/B29_HETZNER_PREFLIGHT_OPERATOR_QUESTIONS.md`

## 2. Gesamtzustand

- Deploymentstatus: `not deployed`
- Produktiv-/Pilotstatus bleibt `blocked`
- Eine offene Mussgruppe haelt den Produktiv-/Pilotstatus `blocked`
- Eine `not assessed`-Mussgruppe ist keine Freigabe
- Eine `blocked`-Mussgruppe ist ein Stop-Signal
- Ein Teil-`go` ersetzt keinen Gesamt-Go
- Lokale Smoke- oder Demo-Gruensignale bleiben kein Deployment-Go
- Diese Liste ist keine Deployment-, Pilot-, Produktiv-, Compliance- oder DSGVO-Freigabe

## 3. Kurze Management-Entscheidungsliste

Jede Zeile nutzt nur die Statuswerte `go`, `blocked` oder `not assessed`.

`go` bedeutet nur: Die nicht-sensitive Entscheidungsgrundlage fuer diese Mussgruppe ist ausreichend beschrieben. `go` bedeutet nicht Deployment, nicht Pilotfreigabe und nicht Nutzung echter Daten.

| Mussgruppe | Status (`go` / `blocked` / `not assessed`) | Management-Entscheidung | Nicht-sensitive Entscheidungsnotiz | Blockiert bis |
| --- | --- | --- | --- | --- |
| Betreiber / Verantwortliche | `not assessed` | Wer traegt Betrieb, Zugriff und Stop-Verantwortung? | Verantwortliche Rolle oder Person muss ohne Zugangsdaten, IPs, private Pfade oder Serverdetails benannt werden. | Betriebs-, Zugriff- und Stop-Verantwortung nicht-sensitiv benannt sind. |
| Zugriffsschicht und direkte Service-Exposition | `blocked` | Welche Zugriffsschicht liegt vor App/API, und ist direkte Service-Erreichbarkeit ausgeschlossen? | Reverse Proxy / IAP oder vergleichbare Zugriffsschicht muss benannt sein; direkte Service-Exposition bleibt ausgeschlossen. | Zugriffsschicht entschieden und direkte Service-Erreichbarkeit ausgeschlossen ist. |
| Trusted-Header und serverseitiges Secret | `blocked` | Wer entfernt clientseitige Actor-/Trusted-Header und wer setzt den Trusted-Kontext serverseitig? | Header-Stripping und kontrollierte Trusted-Header-Injektion muessen ohne Secret-Wert, Headerdump oder produktive Config bestaetigt sein. | Header-Grenze und serverseitige Secret-Setzverantwortung ohne Wert bestaetigt sind. |
| TLS/Health | `not assessed` | Wer verantwortet TLS/Terminierung, und welche Health-Ausgabe bleibt nicht-sensitiv? | TLS-/Zertifikats-/Terminierungsverantwortung und minimale Health-Ausgabe muessen nicht-sensitiv bestaetigt sein. | TLS-Verantwortung und nicht-sensitive Health-Grenze bestaetigt sind. |
| Stop/Rollback | `blocked` | Wer stoppt welchen Betriebsweg, und welcher Zustand wird wiederhergestellt? | Stop-/Rollback-Verantwortung muss ohne echte Serverbefehle, Zugangsdaten oder produktive Werte benannt sein. | Stop-/Rollback-Pfad nicht-sensitiv bestaetigt ist. |
| Daten/PII/Retention/Backup | `blocked` | Bleibt der Korridor bei Demo/anonymisierten Daten, oder ist ein B13-Gate fuer echte Daten entschieden? | Echte Daten bleiben ohne B13-Entscheidung ausgeschlossen. | Datenumfang und B13-Gate bewusst entschieden sind oder echte Daten weiter ausgeschlossen bleiben. |
| Sandbox/Worker/AV | `blocked` | Bleiben echte/beliebige Uploads ausgeschlossen, oder ist ein B14-Gate entschieden? | Echte oder beliebige Uploads bleiben ohne B14-Entscheidung ausgeschlossen. | Uploadumfang ausgeschlossen oder B14-Gate bewusst entschieden ist. |

## 4. Blockierende Regeln

- Jede `not assessed`-Mussgruppe bleibt offen und haelt den Gesamtstatus `blocked`.
- Jede `blocked`-Mussgruppe haelt den Gesamtstatus `blocked`.
- Ein Teil-`go` ersetzt keinen Gesamt-Go.
- Eine Management-Entscheidung ersetzt keinen ausgefuellten B25-B29-Preflight.
- Eine lokale Test-, Build-, Demo- oder Smoke-Pruefung ersetzt kein Hetzner-Go.
- Lokale Smoke- oder Demo-Gruensignale bleiben kein Deployment-Go.
- Der Produktiv-/Pilotstatus bleibt `blocked`, solange eine Mussgruppe offen, `not assessed` oder `blocked` ist.

## 5. Dokumentationsgrenzen

Diese Management-Liste darf ausdruecklich nicht enthalten:

- keine echten Secret-Werte,
- keine Tokens,
- keine privaten SSH-Keys,
- keine vollständigen ENV-Dumps,
- keine IP-Adressen,
- keine Serverdetails,
- keine personenbezogenen Echtdaten,
- keine Kunden- oder Mitarbeiterdaten,
- keine produktiven Logauszüge,
- keine Zugangsdaten,
- keine Infrastrukturänderungsanweisungen mit echten Werten.

Falls eine Entscheidung nur mit sensitiven Details begruendbar waere, bleibt die Mussgruppe `not assessed` oder `blocked` und wird ausserhalb des Repos geklaert. Im Repo bleibt nur die sichere Ergebnisform.

## 6. Stop-Kriterien

Sofort `blocked`, wenn:

- ein Deployment, eine Serveränderung oder eine SSH-Verbindung nötig wäre,
- Secrets, Tokens, private SSH-Keys, ENV-Dumps, IP-Adressen, Serverdetails oder echte Daten dokumentiert werden sollen,
- direkte öffentliche Service-Exposition vorgesehen ist,
- Proxy/IAP beziehungsweise eine vergleichbare Zugriffsschicht fehlt,
- echte Daten oder echte Uploads ohne B13/B14-Entscheidung genutzt werden sollen,
- ein lokales Demo- oder Smoke-Grün als Deployment-Go gelesen werden soll,
- eine einzelne `go`-Zeile als Gesamtfreigabe verwendet werden soll.

## 7. Nicht-Ziele / Grenzen

B31 führt ausdrücklich nicht ein:

- kein Deployment,
- keine Serveränderung,
- keine SSH-Verbindung,
- keine Secret-Erstellung,
- keine ENV-Datei mit echten Werten,
- keine Docker-/systemd-/nginx-Konfiguration,
- keine neue API,
- keine neue Persistenz,
- keine Migration,
- keine Produktlogik,
- kein Login/OIDC,
- keine echten Daten,
- keine rechtssichere Compliance-/DSGVO-Freigabe.

## 8. Abnahmehinweis

B31 ist erfüllt, wenn diese Management-Entscheidungsliste im Repo auffindbar bleibt, TESTING auf den B31-Vertragstest verweist und `tests/b31-hetzner-management-decision-list-contract.test.ts` grün ist.

Die technischen Standard-Gates bleiben unverändert: `npm test`, `npm run build`, `npm audit --omit=dev` und `git diff --check`.
