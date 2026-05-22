# B28 Hetzner-Preflight-Entscheidungspaket

Status: Entscheidungspaket-only fuer Alexanders Hetzner-Zielumgebung
Stand: 2026-05-22
Scope: interne Stabilisierung / Abnahmefähigkeit; kein Deployment, keine Serveränderung, keine SSH-Verbindung, keine Secret-Erstellung, keine ENV-Datei mit echten Werten, keine Docker-/systemd-/nginx-Konfiguration, keine neue API, keine neue Persistenz, keine Migration, keine Produktlogik, keine echten Daten und keine rechtssichere Compliance-/DSGVO-Freigabe

## 1. Zweck

B28 verdichtet B25/B26/B27 zu einem kleinen nicht-sensitiven Entscheidungspaket für Alexander.

Das Paket soll vor einem späteren Hetzner-Schritt sichtbar machen, welche Mussgruppen bewusst auf `go` oder `blocked` gesetzt werden müssten. Es führt nichts aus, verbindet sich mit keinem Server, erzeugt keine Secrets und enthält keine Infrastrukturwerte.

Bezüge:

- `docs/deployment/B25_HETZNER_DEPLOYMENT_PREFLIGHT.md`
- `docs/deployment/B26_HETZNER_PREFLIGHT_EVIDENCE_CHECKLIST.md`
- `docs/deployment/B27_HETZNER_PREFLIGHT_STATUS_TEMPLATE.md`

## 2. Gesamtzustand

- Deploymentstatus: `not deployed`
- Produktiv-/Pilotstatus bleibt `blocked`
- Jede nicht entschiedene Mussgruppe bleibt `blocked`
- Jeder Widerspruch zu B25/B26/B27 bleibt `blocked`
- Ein Teil-`go` ersetzt keinen Gesamt-Go
- Interner Demo-Go bleibt kein Deployment-Go
- Keine Entscheidung in B28 darf als Deployment-Go gelesen werden

## 3. Entscheidungspaket

Jede Zeile darf nur mit einer expliziten Entscheidung `go` oder `blocked` gefüllt werden. `go` bedeutet nur: Die nicht-sensitive Entscheidungsgrundlage ist für diese Mussgruppe ausreichend beschrieben. `go` bedeutet nicht Deployment, nicht Pilotfreigabe und nicht Nutzung echter Daten.

| Mussgruppe | Entscheidung: `go` oder `blocked` | Nicht-sensitive Entscheidungsbegründung | Blockiert bis |
| --- | --- | --- | --- |
| Zielumgebung und Verantwortliche | `blocked` | Zielumgebung, Betriebsverantwortung, Zugriff und Stop-Verantwortung sind nicht als freigegebene Entscheidungsgrundlage bestätigt. | Zielumgebung und Verantwortliche nicht-sensitiv bestätigt sind. |
| Zugriffsschicht und direkte Service-Exposition | `blocked` | Reverse Proxy / IAP oder vergleichbare Zugriffsschicht und Ausschluss direkter Service-Exposition sind nicht als freigegebene Entscheidungsgrundlage bestätigt. | Zugriffsschicht und Ausschluss direkter Service-Erreichbarkeit entschieden sind. |
| Trusted-Header und serverseitiges Secret | `blocked` | Header-Stripping, kontrollierte Trusted-Header-Injektion und serverseitiges Secret ohne Wert sind nicht als freigegebene Entscheidungsgrundlage bestätigt. | Header-Grenze und Secret-Setzverantwortung ohne Secret-Wert bestätigt sind. |
| HTTPS/TLS und nicht-sensitive Healthchecks | `blocked` | HTTPS/TLS-Verantwortung und Health-Grenze für die Zielumgebung sind nicht als freigegebene Entscheidungsgrundlage bestätigt. | Terminierungsmodell und nicht-sensitive Health-Ausgabe bestätigt sind. |
| Rollback-/Stop-Pfad | `blocked` | Wer welchen Dienst stoppt und welcher Zustand wiederhergestellt wird, ist nicht als freigegebene Entscheidungsgrundlage bestätigt. | Stop-/Rollback-Verantwortung nicht-sensitiv bestätigt ist. |
| Daten-/PII-/Retention-/Backup-Gate | `blocked` | Echte Daten bleiben ohne B13-Entscheidung blockiert. | Datenumfang Demo/anonymisiert/echt und B13-Gate bewusst entschieden sind. |
| Sandbox-/Worker-/AV-Gate für echte Uploads | `blocked` | Echte oder beliebige Uploads bleiben ohne B14-Entscheidung blockiert. | Uploadumfang ausgeschlossen oder B14-Gate bewusst entschieden ist. |

## 4. Dokumentationsgrenzen

Dieses Entscheidungspaket darf ausdrücklich nicht enthalten:

- keine echten Secret-Werte,
- keine Tokens,
- keine privaten SSH-Keys,
- keine vollständigen ENV-Dumps,
- keine IP-Adressen,
- keine personenbezogenen Echtdaten,
- keine Kunden- oder Mitarbeiterdaten,
- keine produktiven Logauszüge,
- keine Zugangsdaten,
- keine Infrastrukturänderungsanweisungen mit echten Werten.

Falls eine Entscheidung nur mit sensitiven Details begründbar wäre, bleibt die Mussgruppe `blocked` oder wird separat außerhalb des Repos geklärt. Im Repo bleibt nur die nicht-sensitive Ergebnisform.

## 5. Stop-Kriterien

Sofort `blocked`, wenn:

- ein Deployment, eine Serveränderung oder eine SSH-Verbindung nötig wäre,
- Secrets, Tokens, private SSH-Keys, ENV-Dumps, IP-Adressen oder echte Daten dokumentiert werden sollen,
- direkte öffentliche Service-Exposition vorgesehen ist,
- Proxy/IAP beziehungsweise eine vergleichbare Zugriffsschicht fehlt,
- echte Daten oder echte Uploads ohne B13/B14-Entscheidung genutzt werden sollen,
- ein lokales Demo- oder Smoke-Grün als Deployment-Go gelesen werden soll,
- eine Teilentscheidung als Gesamtfreigabe verwendet werden soll.

## 6. Nicht-Ziele / Grenzen

B28 führt ausdrücklich nicht ein:

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

## 7. Abnahmehinweis

B28 ist erfüllt, wenn dieses Entscheidungspaket im Repo auffindbar bleibt, TESTING auf den B28-Vertragstest verweist und `tests/b28-hetzner-preflight-decision-packet-contract.test.ts` grün ist.

Die technischen Standard-Gates bleiben unverändert: `npm test`, `npm run build`, `npm audit --omit=dev` und `git diff --check`.
