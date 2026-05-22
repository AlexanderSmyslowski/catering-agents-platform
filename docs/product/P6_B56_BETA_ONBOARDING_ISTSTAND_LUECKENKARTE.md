# P6-B56 Beta-Onboarding-Iststand und Lueckenkarte

Status: Doku-/Vertragstest-only Iststand fuer Build Plan 6 Cycle P6-B56
Stand: 2026-05-23
Scope: vorhandener lokaler Beta-Onboarding-Korridor; keine Produktlogik, keine neue API, keine neue Persistenz, kein Deployment

## 1. Zweck

Diese Karte ordnet den vorhandenen lokalen Beta-Onboarding-Pfad fuer interne Tester:

`Starten -> Durchlaufen -> Reibung notieren -> Stop-Gates`

Sie fuehrt keine neue Runtime-Funktion ein. Sie buendelt nur die bereits vorhandenen Start-, Test-, Stop- und Ergebnisanker aus README, TESTING, C8, B12, P5-B49 und P5-B54, damit vor weiteren Plan-6-Slices klar ist, welche Luecken wirklich bestehen.

## 2. Schon klar

Folgende Punkte sind im Repo bereits auffindbar und fuer einen synthetischen internen Beta-Durchlauf nutzbar:

- Lokaler Start ueber `npm run local:start` mit Demo-Seeding und bestehenden `screen`-Sitzungen.
- Lokale Statussicht ueber `npm run local:status`.
- Lokaler Betriebs-/Seed-/Export-/Auditbeleg ueber `npm run local:check`.
- Kontrollierter Abschluss ueber `npm run local:stop`.
- Nutzerweg ueber die vorhandenen Routen:
  - `http://127.0.0.1:3200/`
  - `http://127.0.0.1:3200/angebot`
  - `http://127.0.0.1:3200/produktion`
- Manueller Beta-Pfad aus P5-B54: `Start -> Angebot -> Produktion -> Rueckfragen -> Exporte/Audit`.
- Ergebnisvermerk ueber B12 mit Ergebniszustand `go`, `blocked` oder `not assessed`.
- Bestehende Tests schuetzen Kernrouten, Angebots-Happy-Path, Produktionssicht, read-only Export-/Auditanker und sichere Ingestion-/Warnmarker.

## 3. Verstreute Start-/Test-/Stop-Schritte

Die relevanten Schritte sind vorhanden, aber fuer einen neuen internen Beta-Nutzer auf mehrere Dokumente verteilt:

| Schritt | Fuehrender vorhandener Anker | Iststand |
| --- | --- | --- |
| Starten | README, C8, P5-B54 | `npm run local:start` ist dokumentiert, inklusive Demo-Seed-Grenze. |
| Status pruefen | README, TESTING, C8 | `npm run local:status` ist als lokale Prozess-/Portsicht beschrieben. |
| Durchlaufen | P5-B54, P5-B49, C8 | Route-Reihenfolge und sichtbare Marker sind dokumentiert. |
| Technisch belegen | TESTING, C8, B12 | `npm run local:check`, fokussierte Smokes und Full Gates sind beschrieben. |
| Reibung notieren | P5-B54, B12 | Reibung wird knapp erwaehnt, aber noch nicht als eigene strukturierte Vorlage gefuehrt. |
| Stop-Gates | P5-B54, C8, B12, B13/B14/B24 | Grenzen sind klar dokumentiert, aber aus Beta-Onboarding-Sicht ueber mehrere Anker verteilt. |
| Abschluss | C8, B12 | `npm run local:stop` und B12-Ergebnisvermerk sind vorhanden. |

## 4. Wahrscheinliche Reibung fuer interne Nutzer

Ohne Entwicklerkontext sind im aktuellen Iststand diese Reibungspunkte wahrscheinlich:

1. Start-/Status-Reibung
   - Nutzer muss README, C8 und P5-B54 zusammenlesen, um Start, Status, Check und Stop als einen lokalen Beta-Korridor zu verstehen.
   - Wenn `local:status` oder `local:check` rot ist, ist zwar dokumentiert, dass kein Featurebau erfolgen soll; die konkrete Nutzerreaktion ist aber noch nicht als kompakter Beta-Onboarding-Abschnitt zusammengezogen.

2. Durchlauf-Reibung
   - Die Reihenfolge `Start -> Angebot -> Produktion -> Rueckfragen -> Exporte/Audit` ist vorhanden, aber die Orientierung verteilt sich auf UI-Copy, P5-B49, P5-B54 und C8.
   - Rueckfragen, beantwortete Rueckfragen und Ergebnisobjekte sind testbar, koennen fuer eine interne Testperson aber weiterhin wie Produktlogik statt synthetischer Demo-Korridor wirken.

3. Reibungsnotiz-Reibung
   - P5-B54 fordert Reibungspunkt-Notizen, aber es gibt noch keine eigene sichere Vorlage mit Route, Erwartung, Beobachtung, Schweregrad, Screenshot-Hinweis ohne personenbezogene Daten und naechster Entscheidung.

4. Stop-Gate-Reibung
   - Die Grenzen sind korrekt, aber auf mehrere Dokumente verteilt. Ein Beta-Nutzer braucht eine kompakte Sicht darauf, wann der Durchlauf sofort als `blocked` zu markieren ist.

## 5. Lueckenkarte

| Luecke | Einordnung | Warum relevant | Sicherer Plan-6-Folgepunkt |
| --- | --- | --- | --- |
| Kompakter lokaler Start-/Status-Korridor | intern testbar, aber verstreut | Beta-Nutzer sollen vor dem UI-Durchlauf wissen, ob der lokale Stack plausibel laeuft. | P6-B57 kann README/TESTING/C8 minimal sichtbarer verbinden oder Testanker schaerfen. |
| Strukturierte Reibungsnotiz | nur dokumentiert / noch nicht als Vorlage gefuehrt | Ohne einheitliche Notizform entsteht schwer auswertbares Beta-Feedback. | P6-B58 kann eine sichere Friction-Log-Vorlage ergaenzen. |
| Synthetische Beta-Grenze in UI-Kontexten | intern testbar, aber potenziell missverstaendlich | UI darf nicht wie Produktionsfreigabe oder echte-Daten-Freigabe wirken. | P6-B59 kann nur bei belegter Luecke kleine vorhandene UI-Copy schaerfen. |
| Rueckfragen-/Produktions-Weiterpunkt | intern testbar, aber erklaerungsbeduerftig | Nutzer muessen erkennen: pruefbar, offen, blockiert, nicht freigegeben. | P6-B60 kann vorhandene Produktions-/Rueckfragenanker minimal einordnen. |
| Management-Entscheidung nach Beta-Onboarding | noch nicht bewertet | Ohne echte Reibungsdaten droht weiterer Mikroausbau. | P6-B61 soll verdichten, was Alexander jetzt manuell testen sollte. |

## 6. Zustandsgrenzen fuer den Beta-Onboarding-Korridor

### intern testbar

- Lokaler synthetischer Durchlauf mit Demo-/Seed-Daten.
- Startseite, Angebotsroute und Produktionsroute.
- Vorhandene read-only Arbeitsbelege: Angebots-HTML, Produktionsblatt-/Produktionsplan-HTML, Einkaufsliste-CSV und Audit-Spur.
- Reproduzierbare Checks ueber bestehende Tests und lokale Scripts.

### nur synthetisch

- Demo-/Seed-/synthetische Daten und synthetische Rueckfragenantworten.
- Upload-/Ingestion-Warnanker nur mit sicheren Status-/Warnkey-/Hash-Kurzmarkern.
- Ergebniszustand `go` nur fuer interne Demo-Abnahmefaehigkeit, nicht fuer echte Nutzung.

### blockiert

- produktionsnaher Pilot mit echten Daten ohne separate Gate-Entscheidungen.
- konkrete Zielumgebung ohne ausgefuellten Preflight.
- PII/Retention/Backup ohne Gate-Entscheidung.
- Sandbox/Worker/AV fuer beliebige echte Uploads ohne Gate-Entscheidung.
- produktionsnahe AuthN/AuthZ-/Proxy-/IAP-Entscheidung ohne Alexander-Freigabe.

### verboten

- keine echten Daten: keine echten Kunden-, Mitarbeiter-, Einsatz-, Schicht-, Abrechnungs- oder produktionsnahen Pilotdaten.
- kein Deployment.
- keine SSH-Verbindung.
- keine Secrets, Tokens, produktive `.env` oder Connection Strings.
- keine neue Persistenz, keine Migration, kein Prisma.
- kein OAuth/Login/OIDC und keine Session- oder Nutzerverwaltungswelt.
- keine automatische Spec-Korrektur aus Rueckfragenantworten.
- keine Rezept-/Allergenautomatik.
- kein LLM-/Tool-Use-/OCR-/Parser-Ausbau.
- keine rechtssichere Audit-/Compliance- oder Export-Freigabebehauptung.

## 7. P6-B56-Ergebnis

P6-B56 entscheidet keinen neuen Produkt- oder Betriebsumfang. Der kleinste nutzbare Ergebnisanker ist diese Lueckenkarte: Der vorhandene lokale Beta-Onboarding-Korridor ist auffindbar, aber Start-/Status-Sicht, Reibungsnotiz und Stop-Gates sind aus Nutzersicht noch verteilt. Der naechste sichere Plan-6-Schritt ist deshalb P6-B57 oder P6-B58, nicht Featurebau ausserhalb des bestehenden lokalen synthetischen Beta-Korridors.

P6-B57 konkretisiert die erste Luecke in `docs/product/P6_B57_LOKALER_START_STATUS_KORRIDOR.md`: Starten -> Status pruefen -> Betriebscheck -> UI-Routen oeffnen -> kontrolliert stoppen wird als lokaler Start-/Status-Korridor mit bestehenden Scripts, URLs, Health-Endpunkten und Reaktion auf rote Signale gebuendelt, ohne Deployment, echte Daten, neue API, Persistenz oder Betriebsplattform einzufuehren. P6-B58 konkretisiert die Reibungsnotiz-Luecke in `docs/product/P6_B58_BETA_REIBUNGSLOG_VORLAGE.md`: Beobachtung, Route, Erwartung, tatsaechliches Verhalten, Schweregrad, Screenshot-Hinweis ohne personenbezogene Daten und naechste Entscheidung werden als sichere Vorlage gefuehrt, ohne externe QA-Plattform oder echte Nutzerdaten-Speicherung.
