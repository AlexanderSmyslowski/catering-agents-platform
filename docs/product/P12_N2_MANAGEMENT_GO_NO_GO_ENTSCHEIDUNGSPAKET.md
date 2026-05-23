# P12-N2 Management-Go/No-Go-Entscheidungspaket

Status: Doku-/Vertragstest-only Entscheidungsvorlage fuer Nachtlauf Plan 12 Cycle P12-N2
Stand: 2026-05-24
Scope: kurze nicht-sensitive Managementvorlage fuer einen moeglichen begrenzten internen Pilot; kein Pilotstart, kein Deployment, keine Auth-Implementierung, keine echten Daten, keine neue API, keine Persistenz, keine produktive Konfiguration und keine rechtliche/Compliance-/DSGVO-Freigabe

## 1. Zweck

Dieses Entscheidungspaket verdichtet die offenen Pilotentscheidungen aus Plan 11 in eine kurze Go/No-Go-Sicht fuer Alexander.

Es ersetzt keinen Pilot, keine Betriebsfreigabe und keine Rechtsfreigabe. Es macht nur sichtbar, welche nicht-sensitiven Punkte vor einem echten begrenzten internen Pilot bewusst beantwortet werden muessen.

Fuehrende Repo-Anker:

- `docs/product/P11_N1_LIMITED_INTERNAL_PILOT_PREFLIGHT_INDEX.md`
- `docs/product/P11_N2_PILOT_DATENKORRIDOR_ANONYMISIERT_SYNTHETISCH.md`
- `docs/product/P11_N3_INTERNER_PILOT_PREFLIGHT_RUNBOOK.md`
- `docs/product/B24_PILOT_KORRIDOR_ENTSCHEIDUNGSANKER.md`
- `docs/architecture/PA7_AUTH_READ_PATH_DECISION_ADR.md`
- PA8 Read-path Auth Hardening Slice 1 in `docs/architecture/PA7_AUTH_READ_PATH_DECISION_ADR.md` Abschnitt 11
- `docs/architecture/PA9_PROXY_DEPLOYMENT_READINESS_ADR.md`
- `docs/architecture/B8_AUTH_GATE_DECISION_BOUNDARY.md`
- `docs/architecture/B9_PROXY_IAP_AUTHN_PREFLIGHT_CONTRACT.md`
- `docs/product/P6_B57_LOKALER_START_STATUS_KORRIDOR.md`
- `docs/product/P6_B58_BETA_REIBUNGSLOG_VORLAGE.md`
- `docs/product/P7_B65_EXPORT_AUDIT_ROUTE_EVIDENZPAKET.md`
- `docs/product/P7_B67_REIBUNG_ZU_BACKLOG_TRIAGE.md`
- `docs/product/P9_N1_LOKALER_REHEARSAL_NACHWEISRAHMEN.md`
- `docs/product/C8_INTERNER_DEMO_DURCHLAUF_ABNAHMEWEG.md`
- `docs/product/R4_SCHEDULE_OPTION_A_DECISION_RECORD.md`

## 2. Harte Statusentscheidung

| Korridor | Default | Management-Bedeutung |
| --- | --- | --- |
| lokaler Demo-/Preflight-Korridor mit Demo-/Seed-/synthetischen oder nachweisbar anonymisierten Daten | `go` | Nur fuer lokale Sichtung, Rehearsal, read-only Export-/Auditbelege und Reibungsnotizen. Kein Pilot-Go. |
| echter begrenzter interner Pilot mit anonymisierten/synthetischen Daten | `not assessed` | Erst bewertbar, wenn Nutzerkreis, fachlicher Betreiber, technischer Betreiber, Zugriffskontext, Datenrahmen, Anonymisierungs-/Synthetiknachweis, Nachweisablage ohne sensible Inhalte, Stop-Verantwortung und finale Entscheidung ausgefuellt sind. |
| produktionsnaher Pilot mit echten Daten | `blocked` | Nicht freigegeben. Echte Kunden-, Personen-, Mitarbeiter-, Einsatz-, Schicht- oder Abrechnungsdaten bleiben verboten. |
| oeffentlicher Direktzugriff, produktive Konfiguration oder beliebige echte Uploads | `blocked` | Nicht starten. Bedarf gesonderter Auth-/Proxy-/Deployment-/Daten-/Sandbox-/Compliance-Entscheidungen ausserhalb von Plan 12. |

Kurzregel: `not assessed` ist kein stilles Go. Ein lokales Gruensignal aus Status, Check, UI, Export oder Audit ersetzt kein Management-Go.

## 3. Nicht-sensitive Entscheidungsfelder

Diese Felder duerfen nur Rollen, Funktionen, Kontrollprinzipien und nicht-sensitive Nachweise enthalten. Keine echten Namen, keine personenbezogenen Daten, keine Hostnamen, IPs, Secrets, Tokens, private SSH-Keys, produktive ENV-Werte, Kunden-/Mitarbeiter-/Einsatzdaten oder echten Dokumentinhalte eintragen.

| Feld | Auszufuellende nicht-sensitive Frage | Default |
| --- | --- | --- |
| Nutzerkreis | Welche internen Funktionen duerfen den Pilot sichten: Angebotsverantwortung, Produktionsplanung, Operations/Audit, technische Begleitung? | `not assessed` |
| Fachlicher Betreiber | Welche Verantwortungsrolle entscheidet fachlich ueber Weiterfuehrung, Fix oder Stop? | `not assessed` |
| Technischer Betreiber | Welche Verantwortungsrolle prueft lokale Gates, Berichte und Reibung, ohne Deployment/SSH/Secrets zu starten? | `not assessed` |
| Zugriffskontext | Bleibt die Nutzung lokal oder kontrolliert intern, ohne oeffentlichen Direktzugriff und ohne produktionsnahe Service-Exposition? | `not assessed` |
| Trusted-Actor-/Auth-Kontext | Ist verstanden, dass `x-actor-name` nur Dev-/Test-Kompatibilitaet ist und produktionsnah erst ein bewusst entschiedener Trusted-Proxy-/IAP-Kontext zaehlen duerfte? | `not assessed` |
| Datenrahmen | Welche Demo-, Seed-, synthetischen oder nachweisbar anonymisierten Daten duerfen genutzt werden; welche echten Daten bleiben ausgeschlossen? | `not assessed` |
| Anonymisierungs-/Synthetiknachweis | Woran wird nicht-sensitiv belegt, dass kein Rueckschluss auf echte Kunden, Personen, Mitarbeitende, Einsaetze, Schichten oder Abrechnung moeglich ist? | `not assessed` |
| Nachweis | Welche vorhandenen lokalen Nachweise werden herangezogen: `npm run local:status`, `npm run local:check`, UI-Routen, read-only Export-/Auditbelege, Reibungslog, Evidence-Paket? | `not assessed` |
| Stop-Verantwortung | Welche Verantwortungsrolle stoppt bei echten Daten, Deployment/Auth/Proxy/Secrets, neuer API/Persistenz, Retention/Backup, Sandbox/Worker/AV oder Compliance-Bedarf? | `not assessed` |
| Finale Bewertung | Darf der echte begrenzte interne Pilot gestartet werden: `go`, `blocked` oder weiter `not assessed`? | `not assessed` |

## 4. Minimaler Entscheidungsblock fuer Alexander

Vor einem echten begrenzten internen Pilot muessen alle Mussfelder bewusst beantwortet sein:

1. Nutzerkreis benannt, aber nicht personenbezogen dokumentiert.
2. Fachlicher Betreiber benannt als Rolle/Funktion.
3. Technischer Betreiber benannt als Rolle/Funktion.
4. Zugriffskontext erklaert, ohne Deployment-/Proxy-/Secret-Konfiguration.
5. Datenrahmen auf Demo-/Seed-/synthetisch oder nachweisbar anonymisiert begrenzt.
6. Anonymisierungs-/Synthetiknachweis nicht-sensitiv beschrieben.
7. Nachweisweg auf bestehende lokale Status-/Check-/UI-/Export-/Audit-/Reibungsanker begrenzt.
8. Stop-Verantwortung fuer echte Daten, Deployment/Auth/Secrets/API/Persistenz/Compliance geklaert.
9. Finale Bewertung explizit gesetzt.

Wenn eines dieser Mussfelder fehlt, widerspruechlich ist oder ein Stop-Gate beruehrt, bleibt der echte begrenzte interne Pilot `not assessed` oder `blocked`.

## 5. Option-A-Zeitfenstergrenze

R4 bleibt fuehrend:

- verbindliches Zeitfenster manuell klaeren und nur als Rehearsal-/Preflight-Notiz festhalten,
- keine strukturierte Schedule-/Zeitfenster-Runtime,
- keine automatische oder halbautomatische `event.schedule`-Uebernahme,
- kein neues Schedule-Datenmodell,
- keine neue API, Persistenz, Prisma oder Migration,
- keine automatische Spec-Korrektur.

Wenn ein Pilot-Go strukturierte Zeitfensterverarbeitung voraussetzt, ist das `decision needed` und kein P12-N2-Fix.

## 6. Stop- und No-Go-Kriterien

Sofort `blocked` oder `decision needed`, wenn einer dieser Punkte fuer den Pilot erforderlich waere:

- echte Kunden-, Personen-, Mitarbeiter-, Einsatz-, Schicht- oder Abrechnungsdaten,
- pseudonymisierte echte Daten statt nachweisbar anonymisierter oder synthetischer Daten,
- echte oder beliebige Betriebsdateien, echte PDFs, echte E-Mails, echte Pages-Dateien, Logos, Signaturen oder Metadaten,
- Deployment, Hetzner, SSH, Secrets, produktive `.env`, Domains, TLS, Proxy/IAP-Konfiguration,
- oeffentlicher Direktzugriff auf App oder APIs,
- OAuth/Login/OIDC/Session/Nutzerverwaltung,
- neue API, API-Vertragsaenderung, neue Persistenz, Prisma oder Migration,
- PII/Retention/Loeschung/Backup/Restore-Entscheidung,
- Sandbox/Worker/AV-Freigabe fuer echte oder beliebige Uploads,
- rechtliche/Compliance-/DSGVO-/Signatur-/Export-Verbindlichkeitsfreigabe,
- Runtime-Schedule-/Zeitfenster-Modell oder automatische Spec-Korrektur,
- Multi-Tenant/White-Label/Plattformausbau, Rezept-/Allergenautomatik oder LLM-/Tool-/Parser-/OCR-Ausweitung.

## 7. Triage fuer die finale Bewertung

| Befund | Triage | Ergebnis |
| --- | --- | --- |
| Alle Mussfelder sind nicht-sensitiv beantwortet, kein Stop-Gate ist beruehrt und B24/R4/PA7/PA8/PA9/B8/B9 bleiben eingehalten | `go` nur nach Alexanders bewusster Managemententscheidung | Erst dann waere ein echter begrenzter interner Pilot bewertbar. P12-N2 startet ihn nicht. |
| Kleine Doku- oder Contract-Unklarheit ohne Stop-Gate | `fix` | Engen Doku-/Contract-Fix ableiten. Kein Pilotstart. |
| Nutzerkreis, Betreiber, Zugriffskontext, Datenrahmen, Nachweis oder Stop-Verantwortung fehlen | `decision needed` | Alexander muss entscheiden; bis dahin bleibt der echte begrenzte Pilot `not assessed`. |
| Echte Daten, produktionsnahe Nutzung, Deployment/Auth/Secrets, neue API/Persistenz, Sandbox/AV/Worker, Retention/Backup oder Compliance waeren noetig | `blocked` | Stop. Keine Umsetzung im Nachtlauf. |

## 8. Ergebnis von P12-N2

Das Management-Go/No-Go-Paket ist ein kurzer, nicht-sensitiver Entscheidungsanker. Es macht den Unterschied zwischen lokalem Preflight-`go`, echtem begrenztem Pilot-`not assessed` und produktionsnahem/echte-Daten-`blocked` sichtbar.

P12-N2 fuehrt keine Runtime-, UI-, API-, Persistenz-, Deployment-, Auth-, Secret-, Daten-, Schedule- oder Compliance-Aenderung ein und startet keinen Pilot.
