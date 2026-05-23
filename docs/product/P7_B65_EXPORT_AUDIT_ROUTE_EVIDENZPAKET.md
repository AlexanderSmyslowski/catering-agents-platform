# P7-B65 Evidenzpaket fuer Export/Audit/Route

Status: Doku-/Vertragstest-only Evidenzpaket fuer Build Plan 7 Cycle P7-B65
Stand: 2026-05-23
Scope: strukturierte Evidenzsammlung fuer den ersten manuellen internen Beta-Rehearsal-Durchlauf; keine externe Ablage, kein Upload, keine echten Dateien mit personenbezogenen Daten, keine Produktlogik, keine neue API, keine neue Persistenz, kein Deployment

## 1. Zweck

Dieses Evidenzpaket hilft dem Reviewer am Ende des manuellen synthetischen Beta-Rehearsals zu belegen, was tatsaechlich geprueft wurde:

`Start -> Angebot -> Produktion -> Rueckfragen -> Exporte/Audit`

Es ergaenzt die P7-B63-Startkarte, die P7-B64-Szenariokarte und die P6-B58-Reibungslog-Vorlage. Es ist keine QA-Plattform, keine externe Ablage, kein Upload-Weg und keine Produktfreigabe.
Die Auswertung nach dem Durchlauf erfolgt ueber die Triage-Matrix `docs/product/P7_B67_REIBUNG_ZU_BACKLOG_TRIAGE.md`.

## 2. Vor der Evidenzsammlung

Verbindlich gilt:

- nur Demo-/Seed-/synthetische Daten verwenden,
- eigene Eingaben nur aus `docs/product/P7_B64_SYNTHETISCHE_SZENARIO_UND_DATENKARTE.md` uebernehmen,
- keine echten Dateien mit personenbezogenen Daten anhaengen, hochladen oder referenzieren,
- keine echten Kunden-, Personen-, Mitarbeiter-, Einsatz-, Schicht-, Abrechnungs- oder produktionsnahen Pilotdaten dokumentieren,
- Screenshots nur mit Demo-/Seed-/synthetischen Inhalten und als Screenshot-Hinweis ohne PII notieren,
- Export-/Auditbeleg nur als vorhandenen read-only Arbeitsbeleg beobachten, nicht als Freigabe oder rechtssicheren Nachweis einordnen.

## 3. Evidenz-Checkliste

Eine Evidenznotiz soll genau diese Felder enthalten:

| Feld | Inhalt |
| --- | --- |
| Route | Gepruefte Station: `Start`, `/angebot`, `/produktion`, `Rueckfragen`, `Exporte/Audit`, `local:status` oder `local:check`. |
| Erwartung | Was laut Startkarte, Szenariokarte oder UI an dieser Stelle sichtbar bzw. pruefbar sein sollte. |
| Beobachtung | Was tatsaechlich sichtbar war: Erfolg, Fehler, fehlender Marker oder rote lokale Meldung. |
| Beleg | Kurzer interner Nachweis: sichtbarer UI-Marker, lokaler Check-Output, vorhandener Exportlink oder vorhandener Audit-Spur-Hinweis. Keine Rohlogs, keine echten Inhalte. |
| Reibung | `keine`, `unklar`, `fehlender Marker`, `Fehler`, `Stop-Gate` oder Verweis auf eine separate P6-B58-Reibungsnotiz. |
| Export-/Auditbeleg | `Angebots-HTML`, `Produktionsblatt-/Produktionsplan-HTML`, `Einkaufsliste-CSV`, `Audit-Spur`, `nicht vorhanden` oder `nicht geprueft`. |
| Screenshot-Hinweis ohne PII | Optionaler Hinweis wie `kein Screenshot`, `Screenshot mit Demo-Fixture vorhanden` oder `Screenshot verworfen wegen PII-Risiko`. Keine Dateiablage im Repo. |
| Naechste Entscheidung | `weiter beobachten`, `kleiner UI-/Doku-Slice moeglich`, `lokaler Blocker`, `Alexander-Entscheidung noetig` oder `blocked wegen Gate`. |

## 4. Export-/Audit-Grenze

Export und Audit bleiben im P7-B65-Durchlauf strikt im bestehenden read-only Korridor:

- Angebots-HTML: vorhandener interner Arbeitsbeleg, keine externe Freigabe.
- Produktionsblatt-/Produktionsplan-HTML: vorhandener interner Arbeitsbeleg, keine Produktionsfreigabe.
- Einkaufsliste-CSV: vorhandener interner Arbeitsbeleg, keine Beschaffungsfreigabe.
- Audit-Spur: vorhandener interner Betriebs-/Kontrollhinweis, keine rechtssichere Audit-/Compliance-Aussage.

P7-B65 fuehrt keine neue Betriebsintegration, keine externe Ablage, keinen Upload, keine Signatur, keine Export-Verbindlichkeit und keine rechtssichere Audit-/Compliance-Aussage ein.

## 5. Beispiel ohne echte Daten

| Feld | Beispiel |
| --- | --- |
| Route | `/produktion` / `Exporte/Audit` |
| Erwartung | Nach dem synthetischen Produktionsdurchlauf sollen vorhandene Ergebnisobjekte, Exportanker und Audit-Spur als interne Arbeitsbelege erkennbar sein. |
| Beobachtung | Produktionsplan und Einkaufsliste sind sichtbar; Audit-Spur zeigt einen internen Demo-/Operator-Hinweis. |
| Beleg | UI-Marker `Ergebnisobjekte`, vorhandener Link zu Produktionsblatt-/Produktionsplan-HTML, vorhandener Audit-Spur-Hinweis. |
| Reibung | `keine` oder Verweis auf P6-B58, falls ein Marker unklar bleibt. |
| Export-/Auditbeleg | `Produktionsblatt-/Produktionsplan-HTML`, `Einkaufsliste-CSV`, `Audit-Spur`. |
| Screenshot-Hinweis ohne PII | Optionaler Screenshot nur mit Demo-Fixture; keine echten Namen, Kontakte, Adressen, Termine oder Dokumentinhalte. |
| Naechste Entscheidung | `weiter beobachten` oder `kleiner UI-/Doku-Slice moeglich`. |

## 6. Stop- und Nicht-Freigabegrenzen

Sofort stoppen und als `blocked wegen Gate` einordnen, wenn Evidenz nur mit einem davon moeglich waere:

- echte Daten oder produktionsnahe Pilotdaten,
- externe Dateiablage, Upload echter Dateien oder Screenshot mit PII,
- Deployment, SSH, Server-, Domain-, TLS-, Proxy- oder IAP-Aenderung,
- Secrets, Tokens, produktive `.env` oder Connection Strings,
- neue API, Persistenz, Migration oder Auth-/Session-Welt,
- automatische Spec-Korrektur aus Rueckfragenantworten,
- Rezept-/Allergenautomatik,
- Parser-/OCR-/LLM-/Tool-Use-Ausbau,
- PII/Retention/Backup oder Sandbox/Worker/AV-Entscheidung,
- Produktionsfreigabe, externe Freigabe, Signatur oder rechtssichere Audit-/Compliance-Aussage.

## 7. Ergebnis von P7-B65

P7-B65 baut keine Produktlogik und keine Betriebsintegration. Der messbare Nutzen ist eine auffindbare Evidence-Checklist: Der Reviewer kann strukturiert festhalten, welche Route geprueft wurde, welche Erwartung bestand, was beobachtet wurde, welcher read-only Export-/Auditbeleg sichtbar war, ob Reibung entstand und welche naechste Entscheidung daraus folgt.
P7-B67 nutzt diese Evidenz anschliessend fuer die sichere Einordnung in sofort kleiner Fix, spaeter, Entscheidung noetig oder out of scope/verboten.
