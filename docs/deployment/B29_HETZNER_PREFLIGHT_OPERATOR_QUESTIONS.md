# B29 Hetzner-Preflight-Operatorfragen

Status: Operatorfragen-only fuer Alexanders Hetzner-Zielumgebung
Stand: 2026-05-22
Scope: interne Stabilisierung / Abnahmefähigkeit; kein Deployment, keine Serveränderung, keine SSH-Verbindung, keine Secret-Erstellung, keine ENV-Datei mit echten Werten, keine Docker-/systemd-/nginx-Konfiguration, keine neue API, keine neue Persistenz, keine Migration, keine Produktlogik, keine echten Daten und keine rechtssichere Compliance-/DSGVO-Freigabe

## 1. Zweck

B29 uebersetzt das B28-Entscheidungspaket in ein kleines, nicht-sensitives Operatorfragenpaket.

Das Paket soll Alexander vor einem spaeteren Hetzner-Schritt die wenigen sicheren Fragen geben, die ohne Deployment, ohne SSH, ohne Serverzugriff und ohne Secret-/PII-Dokumentation beantwortet werden koennen. Es fuehrt nichts aus, verbindet sich mit keinem Server, erzeugt keine Secrets und enthaelt keine Infrastrukturwerte.

Bezüge:

- `docs/deployment/B25_HETZNER_DEPLOYMENT_PREFLIGHT.md`
- `docs/deployment/B26_HETZNER_PREFLIGHT_EVIDENCE_CHECKLIST.md`
- `docs/deployment/B27_HETZNER_PREFLIGHT_STATUS_TEMPLATE.md`
- `docs/deployment/B28_HETZNER_PREFLIGHT_DECISION_PACKET.md`

## 2. Gesamtzustand

- Deploymentstatus: `not deployed`
- Produktiv-/Pilotstatus bleibt `blocked`
- Unbeantwortete Fragen bleiben `not assessed` oder `blocked`
- Widerspruch zu B25/B26/B27/B28 bleibt `blocked`
- Eine beantwortete Frage ersetzt keinen B28-Gesamt-Go
- Lokale Smoke- oder Demo-Gruensignale bleiben kein Deployment-Go
- Keine Antwort in B29 darf als Deployment-Go gelesen werden

## 3. Operatorfragen

Jede Antwort muss nicht-sensitiv bleiben. Zulässig sind Rollen, Verantwortlichkeiten, Ja/Nein-Einordnungen, grobe Architekturentscheidungen und Ergebniszustände. Nicht zulässig sind IPs, Secrets, Tokens, private Pfade, ENV-Dumps, Logauszüge oder echte Daten.

| Mussgruppe | Nicht-sensitive Operatorfrage | Zulässige Antwortform | Bleibt blocked, wenn |
| --- | --- | --- | --- |
| Zielumgebung und Verantwortliche | Wer trägt Betrieb, Zugriff und Stop-Verantwortung für die Hetzner-Zielumgebung? | Rolle oder Person ohne Zugangsdaten, IPs oder private Pfade. | keine verantwortliche Rolle/Person benannt ist. |
| Zugriffsschicht und direkte Service-Exposition | Welche Zugriffsschicht soll vor der App liegen und ist direkte Service-Erreichbarkeit ausgeschlossen? | Grobe Benennung wie Reverse Proxy, IAP oder vergleichbare Zugriffsschicht plus Ja/Nein zur direkten Exposition. | keine Zugriffsschicht benannt ist oder direkte Service-Exposition vorgesehen bleibt. |
| Trusted-Header und serverseitiges Secret | Wer entfernt clientseitige Actor-/Trusted-Header und wer setzt den Trusted-Kontext serverseitig? | Verantwortliche Komponente/Rolle ohne Secret-Wert, Headerdump oder produktive Config. | Header-Stripping oder kontrollierte Trusted-Header-Injektion ungeklärt bleibt. |
| HTTPS/TLS und nicht-sensitive Healthchecks | Wer verantwortet TLS/Terminierung und welche Health-Ausgabe bleibt nicht-sensitiv? | Verantwortliche Rolle/Komponente und knappe Aussage, dass Health nur Minimalstatus liefert. | TLS-Verantwortung offen ist oder Health sensitive Daten ausgeben soll. |
| Rollback-/Stop-Pfad | Wer stoppt welchen Betriebsweg und welcher Zustand wird wiederhergestellt? | Rolle/Person und grober Stop-/Rollback-Zustand ohne Serverbefehle mit echten Werten. | Stop-/Rollback-Verantwortung unbekannt bleibt. |
| Daten-/PII-/Retention-/Backup-Gate | Werden nur Demo/anonymisierte Daten genutzt oder ist ein B13-Gate fuer echte Daten entschieden? | Datenumfang als Demo, anonymisiert oder echt plus Gate-Status `go`/`blocked`/`not assessed`. | echte Daten ohne B13-Entscheidung genutzt werden sollen. |
| Sandbox-/Worker-/AV-Gate für echte Uploads | Bleiben echte/beliebige Uploads ausgeschlossen oder ist ein B14-Gate entschieden? | Uploadumfang als ausgeschlossen, eng begrenzt oder Gate-Status `go`/`blocked`/`not assessed`. | echte/beliebige Uploads ohne B14-Entscheidung genutzt werden sollen. |

## 4. Dokumentationsgrenzen

Dieses Operatorfragenpaket darf ausdrücklich nicht enthalten:

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

Falls eine Antwort nur mit sensitiven Details möglich wäre, bleibt die Frage `not assessed` oder `blocked` und wird außerhalb des Repos geklärt. Im Repo bleibt nur die sichere Ergebnisform.

## 5. Stop-Kriterien

Sofort `blocked`, wenn:

- ein Deployment, eine Serveränderung oder eine SSH-Verbindung nötig wäre,
- Secrets, Tokens, private SSH-Keys, ENV-Dumps, IP-Adressen oder echte Daten dokumentiert werden sollen,
- direkte öffentliche Service-Exposition vorgesehen ist,
- Proxy/IAP beziehungsweise eine vergleichbare Zugriffsschicht fehlt,
- echte Daten oder echte Uploads ohne B13/B14-Entscheidung genutzt werden sollen,
- ein lokales Demo- oder Smoke-Grün als Deployment-Go gelesen werden soll,
- eine einzelne beantwortete Frage als B28-Gesamt-Go verwendet werden soll.

## 6. Nicht-Ziele / Grenzen

B29 führt ausdrücklich nicht ein:

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

B29 ist erfüllt, wenn dieses Operatorfragenpaket im Repo auffindbar bleibt, TESTING auf den B29-Vertragstest verweist und `entfernter Doku-Contract-Test` grün ist.

Die technischen Standard-Gates bleiben unverändert: `npm test`, `npm run build`, `npm audit --omit=dev` und `git diff --check`.
