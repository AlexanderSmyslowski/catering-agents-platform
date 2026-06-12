# B24 Pilot-Korridor-Entscheidungsanker

Status: Doku-/Vertragstest-only Entscheidungsanker auf Basis der von Alexander freigegebenen konservativen Pilot-Korridor-Entscheidung
Stand: 2026-05-22
Scope: interne Stabilisierung / Abnahmefähigkeit; keine neue Produktlogik, keine neue Produktfläche, keine neue API, keine neue Persistenz, keine Migration, kein Login/OIDC, kein Proxy/IAP-Code, keine Sandbox-/AV-/Worker-Implementierung, keine Retention-/Backup-Implementierung, keine echten Daten, keine rechtssichere Compliance-/DSGVO-Freigabe

## 1. Zweck

B24 verankert die Alexander-Entscheidung vom 2026-05-22 als lesbaren, testbaren Repo-Vertrag.

Der Anker beantwortet nur:

1. Was ist jetzt erlaubt?
2. Was ist vorbereitbar, aber noch nicht ausgefüllt?
3. Was bleibt blockiert?
4. Welche Stop-Kriterien gelten?
5. Was darf Hans beziehungsweise der Catering-Agent daraus ausdrücklich nicht ableiten?

B24 baut keinen Produktivbetrieb, keine neue Runtime-Funktion, keine Produktfläche, keine API, keine Persistenz, keine Migration und keine rechtssichere Compliance- oder DSGVO-Freigabe.

## 2. Entscheidung jetzt

| Korridor | Status | Bedeutung |
| --- | --- | --- |
| interner Demo-Modus | `go` | Lokale oder kontrolliert interne Demo-/Abnahmezwecke sind erlaubt, solange nur Demo-/synthetische/anonymisierte Daten und kuratierte Testdateien genutzt werden. |
| begrenzter interner Pilot mit anonymisierten Daten | `not assessed` | Vorbereitbar, aber noch nicht konkret ausgefüllt: Zielumgebung, beteiligte Personen, Datenumfang, Betreiber- und Zugriffskontext sind noch nicht benannt und geprüft. |
| produktionsnaher Pilot mit echten Daten | `blocked` | Nicht freigegeben, solange B10/B13/B14 und die konkreten Betriebs-, Daten- und Zugriffsgates nicht positiv entschieden sind. |
| öffentlicher Direktzugriff | `blocked` | App/API dürfen nicht direkt öffentlich erreichbar gemacht werden. |
| beliebige echte Uploads | `blocked` | Echte oder beliebige Betriebsdateien dürfen nicht produktionsnah verarbeitet werden, solange Sandbox/AV/Worker und Datenumfang nicht entschieden sind. |

Kurzform der Entscheidung:

- interner Demo-Modus: `go`
- begrenzter interner Pilot mit anonymisierten Daten: `not assessed`
- produktionsnaher Pilot mit echten Daten: `blocked`
- öffentlicher Direktzugriff: `blocked`
- beliebige echte Uploads: `blocked`

## 3. Jetzt erlaubt

Erlaubt ist nur der enge interne Demo-/Abnahmekorridor:

- lokale oder kontrolliert interne Demo-/Abnahme,
- Demo-Daten,
- synthetische Daten,
- anonymisierte Testdaten,
- kuratierten Testdateien,
- interne Smoke-, UI-, Export- und Abnahmeprüfungen,
- vorhandene read-only Arbeitsbelege und interne Betriebs-/Kontrollnachweise ohne echte Personen-, Kunden- oder Betriebsdaten.

Verbindliche Grenze: nur Demo-/synthetische/anonymisierte Daten erlaubt. Es gilt: keine echten Kunden- oder Mitarbeiterdaten und keine beliebigen echten Uploads.

## 4. Jetzt nicht ausgefüllt / not assessed

Ein begrenzter interner Pilot mit anonymisierten Daten ist vorbereitbar, aber noch `not assessed`, solange mindestens diese Punkte nicht konkret benannt und geprüft sind:

- Zielumgebung,
- beteiligte Personen / Nutzerkreis,
- Datenumfang,
- Betreiber- und Zugriffskontext,
- Nachweis, dass Daten tatsächlich anonymisiert oder synthetisch sind,
- konkrete Abgrenzung zu echten Kunden-, Mitarbeiter-, Einsatz-, Schicht- oder Abrechnungsdaten.

Ein `not assessed`-Korridor ist kein stilles Go. Er darf erst konkret bewertet werden, wenn Zielumgebung, Personen und Datenumfang benannt sind.

## 5. Weiterhin blockiert

Blockiert bleiben:

- produktionsnaher Pilot mit echten Daten,
- echte personenbezogene Daten,
- echte Mitarbeiterdaten,
- echte Kundendaten,
- echte Einsatz-/Schicht-/Abrechnungsdaten,
- keine echten Mitarbeiter-/Kunden-/Einsatz-/Schicht-/Abrechnungsdaten,
- echte Kunden- oder Mitarbeiterdaten in Demo-, Upload-, Export-, Audit- oder Testartefakten,
- öffentliche Erreichbarkeit von App/API,
- öffentlicher Direktzugriff ohne kontrollierte vorgelagerte Zugriffsschicht,
- beliebige echte Uploads,
- produktionsnahe Dateiannahme oder Ingestion echter Betriebsdateien,
- längerfristige Speicherung echter Daten ohne Retention-/Lösch-/Backup-Entscheidung,
- jede Aussage, dass lokale Demo-, Health-, Export-, Upload- oder Smoke-Gruensignale eine produktionsnahe Freigabe ersetzen.

Der produktionsnaher Pilot bleibt ohne B10/B13/B14-Entscheidungen blockiert.

Explizit: produktionsnah bleibt ohne B10/B13/B14-Entscheidungen `blocked`.

## 6. Bindende Gate-Bezüge

B24 ersetzt keine bestehenden Gates. Für produktionsnahe Nutzung bleiben mindestens diese Repo-Anker führend:

- `docs/architecture/B10_PILOT_PREFLIGHT_RUNBOOK.md` für konkrete Zielumgebung, Betreiber, Proxy-/IAP-Rahmen, direkte Service-Exposition, Header-Stripping, Trusted-Header-Injektion, serverseitiges Secret, Health-Grenzen und Export-/Read-Kontext.
- `docs/architecture/B13_PII_RETENTION_BACKUP_GATE.md` für echte Daten, PII-Scope, Speicherort, Retention, Löschung, Backup/Restore, Zugriff und Incident-/Löschpfad.
- `docs/architecture/B14_SANDBOX_WORKER_AV_GATE.md` für echte Uploads, erlaubte Dateitypen, Größenlimits, Quarantäne/Reject, Scan-/Sandbox-Verantwortung, Worker-Isolation, Ressourcenlimits und Fehler-/Warnpfad.

Ohne ausgefüllte und positiv entschiedene B10/B13/B14-Gates bleibt produktionsnahe Nutzung `blocked` oder mindestens `not assessed`; sie ist nicht freigegeben.

## 7. Stop-Kriterien

Sofort stoppen beziehungsweise blockieren, wenn einer dieser Fälle eintritt:

- echte personenbezogene Daten sollen genutzt werden,
- echte Mitarbeiter-/Kunden-/Einsatz-/Schicht-/Abrechnungsdaten sollen genutzt werden,
- öffentliche Erreichbarkeit ist geplant,
- App/API sollen direkt öffentlich erreichbar werden,
- beliebige echte Uploads sollen verarbeitet werden,
- echte Betriebs-, Kunden- oder Mitarbeiterdateien sollen importiert werden,
- Daten sollen längerfristig gespeichert werden,
- Retention-/Löschentscheidung fehlt,
- Backup-/Restore-Verantwortung ist unklar,
- Sandbox/AV/Worker-Isolation ist für echte Uploads nicht entschieden,
- Zielumgebung, Personen oder Datenumfang sind nicht konkret benannt,
- ein lokales Demo-Go soll als produktionsnahe, externe oder rechtssichere Freigabe gelesen werden.

Bei einem Stop-Kriterium bleibt der betroffene Korridor `blocked` oder `not assessed`; Hans darf daraus keine Umsetzung eines produktionsnahen Betriebs ableiten.

## 8. Was Hans / der Catering-Agent daraus nicht ableiten darf

Aus B24 folgt ausdrücklich:

- kein Produktivbetrieb,
- keine produktionsnahe Pilotfreigabe,
- keine externe Freigabe,
- keine Freigabe für echte Daten,
- keine Freigabe für echte Mitarbeiter-, Kunden-, Einsatz-, Schicht- oder Abrechnungsdaten,
- keine Freigabe für öffentliche Erreichbarkeit,
- keine Freigabe für beliebige echte Uploads,
- keine AuthN/AuthZ-, Login-, OIDC- oder Proxy-Implementierung,
- keine Sandbox-/AV-/Worker-Freigabe,
- keine Retention-, Backup- oder DSGVO-Freigabe,
- keine rechtssichere Compliance-/Audit-Aussage,
- keine Marketing- oder Außenfreigabe.

B24 ist ein Entscheidungsanker, kein Implementierungsauftrag für Infrastruktur, Auth, Upload-Sandboxing, Datenhaltung, Retention, Backup oder Compliance.

## 9. Abnahmehinweis

B24 ist erfüllt, wenn dieser Entscheidungsanker im Repo auffindbar bleibt, TESTING auf den B24-Vertragstest verweist und `entfernter Doku-Contract-Test` grün ist.

Die technischen Standard-Gates bleiben unverändert: `npm test`, `npm run build`, `npm audit --omit=dev` und `git diff --check`.
