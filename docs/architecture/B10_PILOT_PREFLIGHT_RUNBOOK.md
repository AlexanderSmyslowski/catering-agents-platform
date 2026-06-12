# B10 Pilot-Preflight-Runbook

Status: Doku-/Runbookanker; ausfuellbarer Vor-Pilot-Korridor fuer eine konkrete Zielumgebung
Stand: 2026-05-22
Scope: Abfragbares Runbook fuer die B9-Mussbedingungen vor einem produktionsnahen Pilot; kein Deployment-Code, keine neue Runtime, keine Login-/Session-/OIDC-Implementierung, keine neue API, keine Persistenz, keine Migration und keine rechtssichere Compliance-Behauptung

## Zweck

B10 macht den B9 Proxy/IAP-AuthN-Preflight-Vertrag als konkrete Vor-Pilot-Checkliste abfragbar.

Das Runbook ist ein Nachweisanker fuer eine benannte Zielumgebung. Es implementiert keinen Proxy/IAP, kein Deployment und keine App-AuthN. Es verhindert nur, dass ein Pilot als produktionsnah freigegeben wird, obwohl direkte Service-Exposition, Header-Spoofing, fehlendes Trusted Secret oder falsche Auth-/Compliance-Behauptungen noch ungeprueft sind.

Grundlage bleibt `docs/architecture/B9_PROXY_IAP_AUTHN_PREFLIGHT_CONTRACT.md`.

## Ergebniszustände

Jede Pruefzeile muss genau einen Ergebniszustand tragen:

- `go`: fuer diese konkrete Zielumgebung positiv nachgewiesen; Nachweis/Quelle ist benannt.
- `blocked`: nicht erfuellt oder Risiko nachgewiesen; produktionsnaher Pilot ist blockiert, bis der Blocker beseitigt und erneut geprueft ist.
- `not assessed`: noch nicht geprueft oder Nachweis fehlt; produktionsnaher Pilot ist nicht freigegeben.

Keine produktionsnahe Freigabe ohne ausgefuellten und erfuellten Preflight. Wenn eine Mussbedingung `blocked` oder `not assessed` ist, bleibt der Gesamtzustand mindestens `blocked` bzw. nicht pilotbereit.

## Zielumgebung und Betreiberrahmen

Vor einem Pilot muss dieser Rahmen konkret ausgefuellt sein:

| Feld | Eintrag | Ergebniszustand | Nachweis / Quelle |
| --- | --- | --- | --- |
| Zielumgebung | Noch einzutragen: Host/Domain, Netzwerkrahmen, Umgebungstyp | `not assessed` | Noch kein Nachweis |
| Betreiber | Noch einzutragen: verantwortliche Person/Team fuer Betrieb und Zugriff | `not assessed` | Noch kein Nachweis |
| Proxy-/IAP-Rahmen | Noch einzutragen: geplanter Reverse Proxy oder Identity-Aware Proxy | `not assessed` | Noch nicht implementiert |
| App-/Service-Runtime | Bestehende Services; keine neue Runtime durch B10 | `not assessed` | Repo-Stand pruefen |
| Deployment-Mechanik | Kein Deployment-Code in B10; Umsetzung bleibt separater Schritt | `not assessed` | Nicht Teil dieses Runbooks |

Der Proxy-/IAP-Rahmen ist damit benannt, aber noch nicht implementiert. Ein leerer oder nur angenommener Zielumgebungsrahmen darf nicht als `go` gewertet werden.

## B9-Mussbedingungen als Vor-Pilot-Checkliste

| Nr. | Pruefpunkt | Mindestnachweis | Ergebniszustand |
| --- | --- | --- | --- |
| 1 | Direkte Service-Exposition ist ausgeschlossen oder als Blocker markiert. | Intake, Offer, Production und Print-Export sind aus dem oeffentlichen Netz nicht direkt erreichbar; direkte Service-Exposition ist bei jedem offenen Port als `blocked` zu markieren. | `not assessed` |
| 2 | Header-Stripping am aeusseren Rand ist geprueft/zu pruefen. | Externe Requests mit `x-catering-actor-name`, `x-catering-trusted-secret` oder `x-actor-name` erreichen die Services nicht unveraendert. | `not assessed` |
| 3 | Trusted-Header-Injektion erfolgt nur durch Proxy/IAP. | Nur Proxy/IAP setzt `x-catering-actor-name`; nur Proxy/IAP injiziert `x-catering-trusted-secret` nach vorgelagertem AuthN-/Kontrollkontext. | `not assessed` |
| 4 | `CATERING_TRUSTED_ACTOR_SECRET` ist serverseitig gesetzt und nicht clientseitig/offen. | Secret ist serverseitig gesetzt, nicht leer und nicht in Frontend-Bundle, HTML, JavaScript, Browser-Speicher, API-Antworten, Logs oder oeffentlicher Config auffindbar. | `not assessed` |
| 5 | Health-Endpunkte bleiben nicht-sensitiv. | `GET /health` liefert nur Minimalstatus und keine Kunden-, Event-, Rezept-, Angebots-, Produktions-, Einkaufs-, Audit-, Secret-, Token-, Pfad- oder Stackdaten. | `not assessed` |
| 6 | Exporte/read-only Arbeitsbelege bleiben hinter Trusted-Actor-/Proxy-Kontext. | Angebots-HTML, Produktionsplan-/Produktionsblatt-HTML, Einkaufslisten-CSV, Detail-Reads und Audit-Reads sind nicht ohne Trusted-Actor-/Proxy-Kontext erreichbar. | `not assessed` |
| 7 | Keine falsche Auth-/Compliance-Behauptung. | Pilotunterlagen nennen den Stand nicht als produktionsreife Auth, externe Freigabe oder rechtssichere Compliance. | `not assessed` |

## Separate Gates, die B10 nicht loest

Diese Punkte bleiben separate Gates und duerfen nicht durch ein `go` in B10 als geloest behauptet werden:

- PII-Pruefung und Datenklassifikation
- Retention-/Loesch-/Archivierungsentscheidung
- Backup-/Restore-Konzept und Wiederanlaufnachweis
- Sandbox-/Mandanten-/Testdatenabgrenzung
- AV-/Malware-Pruefung fuer Upload- und Dokumentpfade
- echte Login-/OIDC-/SSO-/Session-Entscheidung
- rechtliche und organisatorische Compliance-Freigabe

PII, Retention, Backup, Sandbox und AV sind separate Gates, nicht durch B10 geloest.

Der separate B13-Entscheidungsanker `docs/architecture/B13_PII_RETENTION_BACKUP_GATE.md` konkretisiert das PII-/Retention-/Backup-Gate ohne B10 fuer eine Zielumgebung auszufuellen.

Der separate B14-Entscheidungsanker `docs/architecture/B14_SANDBOX_WORKER_AV_GATE.md` konkretisiert das Sandbox-/Worker-/AV-Gate fuer Upload-, Ingestion- und Dokumentpfade. Ein produktionsnaher Pilot bleibt `blocked`, solange echte Uploads ohne diese Sandbox/Worker/AV-Entscheidung verarbeitet werden sollen.

## Gesamtentscheidung

| Gesamtzustand | Bedeutung |
| --- | --- |
| `go` | Alle B9-Mussbedingungen sind fuer die konkrete Zielumgebung mit Nachweis `go`; separate Gates sind entweder ebenfalls entschieden oder ausdruecklich ausserhalb des Pilotumfangs bestaetigt. |
| `blocked` | Mindestens eine Mussbedingung ist `blocked`, oder direkte Service-Exposition, Header-Spoofing, fehlendes/serverseitig offenes Secret, sensible Health-Daten oder ungeschuetzte Export-/Read-Pfade sind nachgewiesen. |
| `not assessed` | Zielumgebung, Betreiber, Proxy-/IAP-Rahmen oder mindestens eine Mussbedingung sind noch nicht nachgewiesen. |

Default fuer ein unausgefuelltes Runbook ist `not assessed`. Eine produktionsnahe Freigabe ist erst moeglich, wenn das Runbook fuer die konkrete Zielumgebung ausgefuellt ist und alle B9-Mussbedingungen `go` sind.

## Nicht-Ziele / Grenzen

B10 fuehrt ausdruecklich nicht ein:

- kein Deployment-Code
- keine neue Runtime
- keine Login-/Session-/OIDC-Implementierung in der App
- keine neue API
- keine neue Persistenz
- keine Migration
- keine Exportlogik- oder Produktlogik-Ausweitung
- keine rechtssichere Compliance-Behauptung
- keine Multi-Tenancy-, White-Label- oder Plattform-Erweiterung

## Abnahmehinweis

B10 ist erfuellt, wenn dieses Runbook im Repo auffindbar bleibt, B9/TESTING auf den Runbookanker verweisen und der Marker-Test `entfernter Doku-Contract-Test` gruen ist.

Die technischen Standard-Gates bleiben unveraendert: `npm test`, `npm run build`, `npm audit --omit=dev` und `git diff --check`.
