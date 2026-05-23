# P6-B58 Reibungslog fuer manuellen Beta-Durchlauf

Status: Doku-/Vertragstest-only Vorlage fuer Build Plan 6 Cycle P6-B58
Stand: 2026-05-23
Scope: strukturierte manuelle Reibungserfassung im lokalen synthetischen Beta-Durchlauf; keine externe QA-Plattform, keine neue Produktlogik, keine neue API, keine neue Persistenz, keine neue Speicherung echter Nutzerdaten

## 1. Zweck

Diese Vorlage strukturiert Reibung aus dem manuellen internen Beta-Weg:

`Start -> Angebot -> Produktion -> Rueckfragen -> Exporte/Audit`

Sie dient Alexander oder einer internen Testperson dazu, Beobachtungen einheitlich festzuhalten, ohne echte Daten einzutragen. Die Vorlage ist ein sicherer Notizanker, keine QA-Plattform, kein Ticket-System und keine Produktfreigabe.

## 2. Vor jeder Notiz

Verbindlich gilt:

- nur mit Demo-/Seed-/synthetischen Daten arbeiten,
- fuer eigene P7-Rehearsal-Eingaben die Szenario- und Datenkarte `docs/product/P7_B64_SYNTHETISCHE_SZENARIO_UND_DATENKARTE.md` verwenden,
- fuer Export-/Audit-/Route-Evidenz das P7-Evidenzpaket `docs/product/P7_B65_EXPORT_AUDIT_ROUTE_EVIDENZPAKET.md` verwenden,
- fuer die Auswertung nach dem Durchlauf die Triage-Matrix `docs/product/P7_B67_REIBUNG_ZU_BACKLOG_TRIAGE.md` verwenden,
- keine echten Daten verwenden: keine Kunden-, Mitarbeiter-, Einsatz-, Schicht-, Abrechnungs- oder produktionsnahen Pilotdaten,
- keine personenbezogenen Daten in Textnotizen oder Screenshots uebernehmen,
- Screenshots nur ohne Namen, Kontaktdaten, Adressen, echte Termine oder echte Dokumentinhalte,
- lokale rote Signale aus `npm run local:status` oder `npm run local:check` als lokalen Blocker notieren, nicht durch Featurebau ueberdecken.

## 3. Reibungslog-Vorlage

Eine Reibungsnotiz soll genau diese Felder enthalten:

| Feld | Inhalt |
| --- | --- |
| Beobachtung | Kurzer neutraler Titel der Reibung, z. B. `Unklarer naechster Klick nach Angebot`. |
| Route | Eine der vorhandenen Stationen: `Start`, `/angebot`, `/produktion`, `Rueckfragen`, `Exporte/Audit`, `local:status`, `local:check` oder `local:stop`. |
| Erwartetes Verhalten | Was die Testperson an dieser Stelle erwartet hat, ohne neue Produktlogik zu fordern. |
| Tatsaechliches Verhalten | Was tatsaechlich sichtbar war, inklusive vorhandener UI-Marker oder Fehlermeldung. |
| Schweregrad | `niedrig`, `mittel`, `hoch` oder `blockierend`. |
| Screenshot-Hinweis ohne personenbezogene Daten | Optionaler Hinweis, ob ein Screenshot existiert; nur anonymisierte/synthetische Inhalte, keine Namen, Kontaktdaten, Adressen, echten Termine oder echten Dokumentinhalte. |
| Naechste Entscheidung | `weiter beobachten`, `kleiner UI-/Doku-Slice moeglich`, `lokaler Blocker`, `Alexander-Entscheidung noetig` oder `blocked wegen Gate`. |

## 4. Schweregrad-Leitlinie

- `niedrig`: irritierend, aber der synthetische Durchlauf kann ohne Entwicklerwissen fortgesetzt werden.
- `mittel`: Testperson kann fortsetzen, muss aber raten oder zwischen Dokumenten wechseln.
- `hoch`: der Beta-Weg ist an dieser Stelle nur mit Entwicklerkontext sinnvoll fortsetzbar.
- `blockierend`: Durchlauf muss gestoppt werden, z. B. rote lokale Checks, echte Daten erforderlich, fehlender Export-/Auditanker oder ein Gate-Thema.

## 5. Stop- und Nicht-Freigabegrenzen

Sofort als `blockierend` oder `blocked wegen Gate` notieren und nicht weiterbauen, wenn eine Beobachtung eines davon benoetigt:

- keine echten Daten oder produktionsnahen Pilotdaten,
- kein Deployment, keine SSH-Verbindung, keine Server-, Domain-, TLS- oder Proxy-Aenderung,
- keine Secrets, Tokens, produktive `.env` oder Connection Strings,
- keine neue API, keine neue Persistenz, keine Migration, kein Prisma,
- kein OAuth/Login/OIDC und keine Session- oder Nutzerverwaltungswelt,
- keine automatische Spec-Korrektur aus Rueckfragenantworten,
- keine Rezept-/Allergenautomatik,
- kein Parser-/OCR-/LLM-/Tool-Use-Ausbau,
- keine PII/Retention/Backup- oder Sandbox/Worker/AV-Entscheidung im Durchlauf.

Ein ausgefuelltes Reibungslog bedeutet ausdruecklich:

- keine Produktionsfreigabe,
- keine externe Freigabe,
- keine Freigabe fuer echte Daten,
- keine rechtssichere Audit-/Compliance-Aussage,
- keine Signatur- oder Export-Verbindlichkeit,
- keine neue Speicherung echter Nutzerdaten.

## 6. Beispiel ohne echte Daten

| Feld | Beispiel |
| --- | --- |
| Beobachtung | Unklar, ob nach beantworteter Rueckfrage noch etwas zu tun ist. |
| Route | `/produktion` / `Rueckfragen` |
| Erwartetes Verhalten | Ich erwarte einen sichtbaren Hinweis, ob der synthetische Test weiter zu Ergebnisobjekten oder Exporte/Audit gehen soll. |
| Tatsaechliches Verhalten | `Agent fragt · beantwortet` ist sichtbar, aber der naechste manuelle Beta-Schritt wirkt fuer mich noch nicht eindeutig. |
| Schweregrad | `mittel` |
| Screenshot-Hinweis ohne personenbezogene Daten | Optionaler Screenshot nur mit Demo-Fixture, keine echten Namen, Kontakte, Adressen, Termine oder Dokumentinhalte. |
| Naechste Entscheidung | `kleiner UI-/Doku-Slice moeglich` |

## 7. P6-B58-Ergebnis

P6-B58 fuehrt keine neue Produktfunktion ein. Der manuelle Beta-Durchlauf hat nun eine sichere, einheitliche Reibungslog-Vorlage mit Beobachtung, Route, erwartetem Verhalten, tatsaechlichem Verhalten, Schweregrad, Screenshot-Hinweis ohne personenbezogene Daten und naechster Entscheidung. Der naechste sichere Plan-6-Schritt kann die synthetische Beta-Grenze in vorhandenen UI-Kontexten pruefen; echte Daten, Deployment, neue Persistenz/API, Auth/OIDC, automatische Spec-Korrektur sowie Rezept-/Allergenautomatik bleiben ausgeschlossen. P6-B61 ist in `docs/product/P6_B61_BETA_MANAGEMENT_ENTSCHEIDUNGSVORLAGE.md` als Entscheidungsvorlage verankert: sofort testbar, Stop-Gates, No-go und kein weiterer Mikroausbau ohne beobachtete Reibung.

Fuer Plan 7 uebersetzt `docs/product/P7_B67_REIBUNG_ZU_BACKLOG_TRIAGE.md` die ausgefuellte Reibungsnotiz zusammen mit P7-Evidenz in die Kategorien sofort kleiner Fix, spaeter, Entscheidung noetig oder out of scope/verboten.
