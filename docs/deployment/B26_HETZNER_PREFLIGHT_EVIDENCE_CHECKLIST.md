# B26 Hetzner-Preflight-Nachweischeckliste

Status: Nachweischeckliste-only fuer Alexanders Hetzner-Zielumgebung
Stand: 2026-05-22
Scope: interne Stabilisierung / Abnahmefähigkeit; kein Deployment, keine Serveränderung, keine SSH-Verbindung, keine Secret-Erstellung, keine ENV-Datei mit echten Werten, keine Docker-/systemd-/nginx-Konfiguration, keine neue API, keine neue Persistenz, keine Migration, keine Produktlogik, keine echten Daten und keine rechtssichere Compliance-/DSGVO-Freigabe

## 1. Zweck

B26 konkretisiert den B25-Hetzner-Preflight als reine Nachweischeckliste.

Diese Checkliste soll vor einem späteren Deployment sichtbar machen, welche Nachweise für Alexanders Hetzner-Server fehlen, welche Punkte blockieren und welche Informationen ausdrücklich nicht im Repo, in Reports, Logs oder Chatverläufen landen dürfen.

B26 führt nichts auf dem Server aus. Der Deploymentstatus bleibt `not deployed`.

Bezug: `docs/deployment/B25_HETZNER_DEPLOYMENT_PREFLIGHT.md`.

## 2. Gesamtzustand

- Deploymentstatus: `not deployed`
- Gesamtzustand ohne ausgefüllte Nachweise: `not assessed` beziehungsweise `blocked`
- Produktiv-/Pilotstatus bleibt ohne vollständig grüne Mussnachweise `blocked`
- Interner Demo-Go bleibt kein Deployment-Go
- Ein einzelnes `go` ersetzt keinen Gesamt-Go

## 3. Ergebniszustände je Nachweiszeile

Jede Zeile nutzt genau einen dieser Zustände:

- `go`: Nachweis ist für die konkrete Hetzner-Zielumgebung positiv erbracht und nicht sensitiv dokumentiert.
- `blocked`: Nachweis widerspricht einer Mussbedingung oder zeigt ein Stop-Kriterium.
- `not assessed`: Nachweis fehlt, ist noch nicht geprüft oder darf ohne sichere Dokumentationsform nicht abgelegt werden.

Fehlender Nachweis bleibt `not assessed`.
Nachgewiesener Widerspruch bleibt `blocked`.

## 4. Nachweiszeilen für den Hetzner-Preflight

| Nachweiszeile | Mindestnachweis ohne sensitive Werte | Default |
| --- | --- | --- |
| Zielumgebung / Hostrahmen | Hetzner-Zielumgebung ist nicht-sensitiv benannt; keine IPs, Zugangsdaten oder geheimen Pfade nötig. | `not assessed` |
| Betreiber / Verantwortliche | Verantwortliche Person oder Rolle für Betrieb, Zugriff und Stop ist benannt. | `not assessed` |
| Reverse Proxy / IAP oder vergleichbare Zugriffsschicht | Zugriffsschicht ist benannt; öffentliche Direktfreigabe ist nicht vorgesehen. | `not assessed` |
| Direkte Service-Exposition ausgeschlossen | Intake, Offer, Production und Export sind nicht direkt öffentlich erreichbar oder ein offener direkter Zugriff ist als `blocked` markiert. | `blocked` |
| Header-Stripping am äußeren Rand | Clientseitig gesetzte Actor-/Trusted-Header werden am Rand entfernt oder erreichen Services nicht unverändert. | `not assessed` |
| Trusted-Header-Injektion nur durch Proxy/IAP | Nur die Zugriffsschicht setzt `x-catering-actor-name` und injiziert das Trusted Secret serverseitig. | `not assessed` |
| Serverseitiges `CATERING_TRUSTED_ACTOR_SECRET` | Secret-Existenz und Setzort sind bestätigt, ohne den Wert zu dokumentieren. | `blocked` |
| HTTPS/TLS-Terminierung | Domain-/Zertifikats-/Terminierungsverantwortung ist geklärt. | `not assessed` |
| Nicht-sensitive Healthchecks | Health liefert nur Minimalstatus und keine Kunden-, Event-, Rezept-, Angebots-, Produktions-, Einkaufs-, Audit-, Secret-, Token-, Pfad- oder Stackdaten. | `not assessed` |
| Rollback-/Stop-Pfad | Wer stoppt welchen Dienst und welcher Zustand wird wiederhergestellt, ist benannt. | `blocked` |
| Daten-/PII-/Retention-/Backup-Gate | B13-Entscheidung ist für den Datenumfang geklärt oder echte Daten bleiben ausgeschlossen. | `blocked` |
| Sandbox-/Worker-/AV-Gate für echte Uploads | B14-Entscheidung ist geklärt oder echte/beliebige Uploads bleiben ausgeschlossen. | `blocked` |

## 5. Dokumentationsgrenzen

Diese Nachweischeckliste darf ausdrücklich nicht enthalten:

- keine echten Secret-Werte,
- keine Tokens,
- keine privaten SSH-Keys,
- keine vollständigen ENV-Dumps,
- keine personenbezogenen Echtdaten,
- keine Kunden- oder Mitarbeiterdaten,
- keine vollständigen produktiven Logauszüge,
- keine Infrastrukturänderungsanweisungen mit echten Zugangsdaten.

Falls ein Nachweis nur mit sensitiven Details möglich wäre, wird nur die sichere Ergebnisform dokumentiert: `go`, `blocked` oder `not assessed` plus knappe nicht-sensitive Begründung.

## 6. Stop-Kriterien

Sofort `blocked`, wenn:

- ein Deployment, eine Serveränderung oder eine SSH-Verbindung nötig wäre, um die Checkliste auszufüllen,
- Secrets im Repo, in Reports, Logs oder Chatverläufen dokumentiert werden sollen,
- direkte öffentliche Service-Exposition vorgesehen ist,
- Proxy/IAP beziehungsweise eine vergleichbare Zugriffsschicht fehlt,
- echte Daten oder echte Uploads ohne B13/B14-Entscheidung genutzt werden sollen,
- ein lokales Demo- oder Smoke-Grün als Deployment-Go gelesen werden soll.

## 7. Nicht-Ziele / Grenzen

B26 führt ausdrücklich nicht ein:

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

B26 ist erfüllt, wenn dieser Nachweisanker im Repo auffindbar bleibt, TESTING auf den B26-Vertragstest verweist und `entfernter Doku-Contract-Test` grün ist.

Die technischen Standard-Gates bleiben unverändert: `npm test`, `npm run build`, `npm audit --omit=dev` und `git diff --check`.
