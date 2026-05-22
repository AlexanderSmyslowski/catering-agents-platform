# B27 Hetzner-Preflight-Statusvorlage

Status: Statusvorlage-only fuer Alexanders Hetzner-Zielumgebung
Stand: 2026-05-22
Scope: interne Stabilisierung / Abnahmefähigkeit; kein Deployment, keine Serveränderung, keine SSH-Verbindung, keine Secret-Erstellung, keine ENV-Datei mit echten Werten, keine Docker-/systemd-/nginx-Konfiguration, keine neue API, keine neue Persistenz, keine Migration, keine Produktlogik, keine echten Daten und keine rechtssichere Compliance-/DSGVO-Freigabe

## 1. Zweck

B27 ergänzt B25/B26 um eine ausfüllbare, nicht-sensitive Statusvorlage für den späteren Hetzner-Preflight.

Diese Vorlage führt nichts aus und sammelt keine Secrets. Sie hält nur fest, welche B26-Nachweiszeilen für Alexanders Hetzner-Zielumgebung bereits sicher eingeordnet sind, welche Zeilen weiter blockieren und welcher nächste sichere Schritt ohne Infrastrukturänderung möglich wäre.

Bezüge:

- `docs/deployment/B25_HETZNER_DEPLOYMENT_PREFLIGHT.md`
- `docs/deployment/B26_HETZNER_PREFLIGHT_EVIDENCE_CHECKLIST.md`

## 2. Gesamtzustand

- Deploymentstatus: `not deployed`
- Produktiv-/Pilotstatus bleibt `blocked`
- Ohne vollständig grüne Mussnachweise bleibt der Produktiv-/Pilotstatus `blocked`
- Fehlender Nachweis bleibt `not assessed`
- Nachgewiesener Widerspruch bleibt `blocked`
- Ein einzelnes `go` ersetzt keinen Gesamt-Go
- Interner Demo-Go bleibt kein Deployment-Go

## 3. Ausfüllbare Statusvorlage

| Nachweiszeile | Status (`go` / `blocked` / `not assessed`) | Nicht-sensitive Begründung | Nächster sicherer Schritt |
| --- | --- | --- | --- |
| Zielumgebung / Hostrahmen | `not assessed` | Hetzner-Zielumgebung ist noch nicht nicht-sensitiv beschrieben. | Nicht-sensitive Zielbeschreibung ohne IP, Secret, privaten Pfad oder Zugangsdaten ergänzen. |
| Betreiber / Verantwortliche | `not assessed` | Betriebs-, Zugriff- und Stop-Verantwortung ist noch nicht benannt. | Rolle oder Person für Betrieb, Zugriff und Stop benennen. |
| Reverse Proxy / IAP oder vergleichbare Zugriffsschicht | `not assessed` | Zugriffsschicht ist noch nicht entschieden oder nachgewiesen. | Zugriffsschicht nicht-sensitiv benennen; keine Produktivkonfiguration dokumentieren. |
| Direkte Service-Exposition ausgeschlossen | `blocked` | Ohne Nachweis bleibt direkte öffentliche Service-Erreichbarkeit blockierend. | Sicher belegen, dass Intake, Offer, Production und Export nicht direkt öffentlich erreichbar sein sollen. |
| Header-Stripping am äußeren Rand | `not assessed` | Verhalten am Proxy-/IAP-Rand ist noch nicht nachgewiesen. | Nicht-sensitive Aussage zur Entfernung clientseitiger Actor-/Trusted-Header ergänzen. |
| Trusted-Header-Injektion nur durch Proxy/IAP | `not assessed` | Kontrollierte Header-Injektion ist noch nicht nachgewiesen. | Nicht-sensitive Aussage ergänzen, dass nur die Zugriffsschicht Actor-Header und Trusted Secret setzt. |
| Serverseitiges `CATERING_TRUSTED_ACTOR_SECRET` | `blocked` | Secret-Existenz und Setzort sind ohne Wert noch nicht bestätigt. | Nur Existenz und Setzort bestätigen; keinen Secret-Wert dokumentieren. |
| HTTPS/TLS-Terminierung | `not assessed` | Domain-, Zertifikats- und Terminierungsverantwortung ist noch offen. | Verantwortlichkeit und Terminierungsmodell nicht-sensitiv benennen. |
| Nicht-sensitive Healthchecks | `not assessed` | Health-Grenze ist noch nicht für die Zielumgebung bestätigt. | Bestätigen, dass Health nur Minimalstatus liefert und keine sensitiven Daten ausgibt. |
| Rollback-/Stop-Pfad | `blocked` | Stop-/Rollback-Verantwortung ist vor Deployment unbekannt. | Benennen, wer welchen Dienst stoppt und welcher Zustand wiederhergestellt wird. |
| Daten-/PII-/Retention-/Backup-Gate | `blocked` | Echte Daten bleiben ohne B13-Entscheidung blockiert. | Datenumfang als Demo/anonymisiert/echt einordnen oder echte Daten weiter ausschließen. |
| Sandbox-/Worker-/AV-Gate für echte Uploads | `blocked` | Echte oder beliebige Uploads bleiben ohne B14-Entscheidung blockiert. | Uploadumfang eng ausschließen oder B14-Entscheidung separat vorbereiten. |

## 4. Dokumentationsgrenzen

Die Statusvorlage darf ausdrücklich nicht enthalten:

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

Falls ein Status nur mit sensitiven Details begründbar wäre, wird nur die sichere Ergebnisform dokumentiert: `go`, `blocked` oder `not assessed` plus knappe nicht-sensitive Begründung.

## 5. Stop-Kriterien

Sofort `blocked`, wenn:

- ein Deployment, eine Serveränderung oder eine SSH-Verbindung nötig wäre,
- Secrets, Tokens, private SSH-Keys, ENV-Dumps, IP-Adressen oder echte Daten dokumentiert werden sollen,
- direkte öffentliche Service-Exposition vorgesehen ist,
- Proxy/IAP beziehungsweise eine vergleichbare Zugriffsschicht fehlt,
- echte Daten oder echte Uploads ohne B13/B14-Entscheidung genutzt werden sollen,
- ein lokales Demo- oder Smoke-Grün als Deployment-Go gelesen werden soll.

## 6. Nicht-Ziele / Grenzen

B27 führt ausdrücklich nicht ein:

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

B27 ist erfüllt, wenn diese Statusvorlage im Repo auffindbar bleibt, TESTING auf den B27-Vertragstest verweist und `tests/b27-hetzner-preflight-status-template-contract.test.ts` grün ist.

Die technischen Standard-Gates bleiben unverändert: `npm test`, `npm run build`, `npm audit --omit=dev` und `git diff --check`.
