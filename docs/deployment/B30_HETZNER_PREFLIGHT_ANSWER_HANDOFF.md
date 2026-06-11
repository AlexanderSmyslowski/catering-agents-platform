# B30 Hetzner-Preflight-Antwortübergabe

Status: Antwortübergabe-only fuer Alexanders Hetzner-Zielumgebung
Stand: 2026-05-22
Scope: interne Stabilisierung / Abnahmefähigkeit; kein Deployment, keine Serveränderung, keine SSH-Verbindung, keine Secret-Erstellung, keine ENV-Datei mit echten Werten, keine Docker-/systemd-/nginx-Konfiguration, keine neue API, keine neue Persistenz, keine Migration, keine Produktlogik, keine echten Daten und keine rechtssichere Compliance-/DSGVO-Freigabe

## 1. Zweck

B30 macht aus den B29-Operatorfragen eine kleine, sichere Antwortübergabe.

Die Vorlage soll Alexander erlauben, nicht-sensitive Antworten aus Betrieb, Zugriff, TLS, Daten- und Upload-Gates im Repo oder in einem Lagebericht knapp einzuordnen, ohne IPs, Secrets, Tokens, ENV-Dumps, private Pfade, Logs oder echte Daten zu erfassen. Sie führt nichts aus, verbindet sich mit keinem Server, erzeugt keine Secrets und enthält keine Infrastrukturwerte.

Bezüge:

- `docs/deployment/B25_HETZNER_DEPLOYMENT_PREFLIGHT.md`
- `docs/deployment/B26_HETZNER_PREFLIGHT_EVIDENCE_CHECKLIST.md`
- `docs/deployment/B27_HETZNER_PREFLIGHT_STATUS_TEMPLATE.md`
- `docs/deployment/B28_HETZNER_PREFLIGHT_DECISION_PACKET.md`
- `docs/deployment/B29_HETZNER_PREFLIGHT_OPERATOR_QUESTIONS.md`

## 2. Gesamtzustand

- Deploymentstatus: `not deployed`
- Produktiv-/Pilotstatus bleibt `blocked`
- Unbeantwortete Antwortzeilen bleiben `not assessed` oder `blocked`
- Widerspruch zu B25/B26/B27/B28/B29 bleibt `blocked`
- Eine einzelne `go`-Antwort ersetzt keinen B28-Gesamt-Go
- Lokale Smoke- oder Demo-Gruensignale bleiben kein Deployment-Go
- Keine B30-Antwort darf als Deployment-Go gelesen werden

## 3. Antwortübergabe

Jede Antwort muss nicht-sensitiv bleiben. Zulässig sind Rollen, Verantwortlichkeiten, Ja/Nein-Einordnungen, grobe Architekturentscheidungen, Ergebniszustände und der nächste sichere Klärungsschritt. Nicht zulässig sind IPs, Secrets, Tokens, private Pfade, ENV-Dumps, Logauszüge oder echte Daten.

| Mussgruppe | Antwortstatus: `go` / `blocked` / `not assessed` | Nicht-sensitive Antwortnotiz | Nächster sicherer Schritt |
| --- | --- | --- | --- |
| Zielumgebung und Verantwortliche | `not assessed` | Noch keine nicht-sensitive Bestätigung zu Betrieb, Zugriff und Stop-Verantwortung dokumentiert. | Verantwortliche Rolle/Person ohne Zugangsdaten, IPs oder private Pfade benennen. |
| Zugriffsschicht und direkte Service-Exposition | `not assessed` | Zugriffsschicht und Ausschluss direkter Service-Erreichbarkeit noch nicht als sichere Antwort übergeben. | Reverse Proxy, IAP oder vergleichbare Zugriffsschicht grob bestätigen und direkte Service-Exposition verneinen oder blockieren. |
| Trusted-Header und serverseitiges Secret | `not assessed` | Header-Stripping, Trusted-Header-Injektion und Secret-Setzverantwortung noch nicht nicht-sensitiv bestätigt. | Verantwortliche Komponente/Rolle ohne Secret-Wert, Headerdump oder produktive Config benennen. |
| HTTPS/TLS und nicht-sensitive Healthchecks | `not assessed` | TLS-/Terminierungsverantwortung und Health-Ausgabegerenze noch nicht sicher übergeben. | Verantwortliche Rolle/Komponente und Health-Minimalstatus ohne sensitive Felder bestätigen. |
| Rollback-/Stop-Pfad | `not assessed` | Stop-/Rollback-Verantwortung und wiederherzustellender Zustand noch nicht nicht-sensitiv beschrieben. | Verantwortliche Rolle/Person und groben Stop-/Rollback-Zustand ohne echte Serverbefehle festhalten. |
| Daten-/PII-/Retention-/Backup-Gate | `blocked` | Echte Daten bleiben ohne B13-Entscheidung blockiert; Demo/anonymisiert/echt ist noch nicht sicher entschieden. | Datenumfang nicht-sensitiv festlegen und B13-Gate als `go`, `blocked` oder `not assessed` einordnen. |
| Sandbox-/Worker-/AV-Gate für echte Uploads | `blocked` | Echte oder beliebige Uploads bleiben ohne B14-Entscheidung blockiert. | Uploadumfang nicht-sensitiv festlegen und B14-Gate als `go`, `blocked` oder `not assessed` einordnen. |

## 4. Dokumentationsgrenzen

Diese Antwortübergabe darf ausdrücklich nicht enthalten:

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

Falls eine Antwort nur mit sensitiven Details möglich wäre, bleibt die Antwortzeile `not assessed` oder `blocked` und wird außerhalb des Repos geklärt. Im Repo bleibt nur die sichere Ergebnisform.

## 5. Stop-Kriterien

Sofort `blocked`, wenn:

- ein Deployment, eine Serveränderung oder eine SSH-Verbindung nötig wäre,
- Secrets, Tokens, private SSH-Keys, ENV-Dumps, IP-Adressen oder echte Daten dokumentiert werden sollen,
- direkte öffentliche Service-Exposition vorgesehen ist,
- Proxy/IAP beziehungsweise eine vergleichbare Zugriffsschicht fehlt,
- echte Daten oder echte Uploads ohne B13/B14-Entscheidung genutzt werden sollen,
- ein lokales Demo- oder Smoke-Grün als Deployment-Go gelesen werden soll,
- eine einzelne Antwort oder Teilantwort als B28-Gesamtfreigabe verwendet werden soll.

## 6. Nicht-Ziele / Grenzen

B30 führt ausdrücklich nicht ein:

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

B30 ist erfüllt, wenn diese Antwortübergabe im Repo auffindbar bleibt, TESTING auf den B30-Vertragstest verweist und `entfernter Doku-Contract-Test` grün ist.

Die technischen Standard-Gates bleiben unverändert: `npm test`, `npm run build`, `npm audit --omit=dev` und `git diff --check`.
