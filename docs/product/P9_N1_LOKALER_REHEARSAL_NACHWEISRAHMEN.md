# P9-N1 Lokaler Rehearsal-Nachweisrahmen

Status: Doku-/Vertragstest-only Konsolidierung fuer Nachtlauf Plan 9 Cycle P9-N1
Stand: 2026-05-23
Scope: Auffindbarer Nachweisrahmen aus bestehenden lokalen Rehearsal-Dokumenten; keine Produktlogik, keine UI-Aenderung, keine API, keine Persistenz, kein Deployment, keine echten Daten

## 1. Zweck

Dieser Index konsolidiert den vorhandenen lokalen Rehearsal-Nachweis fuer den synthetischen internen Beta-Korridor:

`Start -> Angebot -> Produktion -> Rueckfragen -> Exporte/Audit`

Er fuehrt keine neue Runtime-Funktion, kein neues Gate und keine neue Datenwelt ein. Er ordnet nur die bestehenden Dokumente so, dass eine interne Testperson nach einem lokalen Durchlauf sauber unterscheiden kann:

- was lokal/synthetisch gruen nachgewiesen wurde,
- wo Reibung dokumentiert wurde,
- welche Export-/Audit-/Route-Anker nur read-only Arbeitsbelege sind,
- welche Punkte echte Daten blocked, Produktionsfreigabe blocked oder Compliance blocked bleiben.

## 2. Fuehrende Dokumentkette

| Schritt | Dokument | Rolle im Nachweisrahmen |
| --- | --- | --- |
| Demo-/Abnahmeweg | `docs/product/C8_INTERNER_DEMO_DURCHLAUF_ABNAHMEWEG.md` | fuehrender reproduzierbarer lokaler Demo-/Abnahmeweg mit Scripts, UI-Routen, Export-/Auditankern und Full Gates |
| Start-/Status-Korridor | `docs/product/P6_B57_LOKALER_START_STATUS_KORRIDOR.md` | Starten -> Status pruefen -> Betriebscheck -> UI-Routen oeffnen -> kontrolliert stoppen |
| Reibungslog | `docs/product/P6_B58_BETA_REIBUNGSLOG_VORLAGE.md` | sichere Notizvorlage fuer beobachtete Reibung ohne echte Daten und ohne PII |
| Reviewer-Startkarte | `docs/product/P7_B63_REVIEWER_REHEARSAL_STARTKARTE.md` | fiktive Testrolle, synthetisches Ziel, Stop-Gates und Startablauf fuer interne Testperson |
| Szenario-/Datenkarte | `docs/product/P7_B64_SYNTHETISCHE_SZENARIO_UND_DATENKARTE.md` | ausschliesslich fiktive Beispielwerte und klare Nicht-Eingabe echter Daten |
| Evidence-Paket | `docs/product/P7_B65_EXPORT_AUDIT_ROUTE_EVIDENZPAKET.md` | strukturierte Route-/Erwartung-/Beobachtung-/Beleg-/Export-/Audit-Evidenz inklusive `Zeitfenster-Rehearsal-Notiz` |
| Reibung-zu-Backlog-Triage | `docs/product/P7_B67_REIBUNG_ZU_BACKLOG_TRIAGE.md` | Einordnung beobachteter Reibung in sofort kleiner Fix, spaeter, Entscheidung noetig oder out of scope/verboten |

## 3. Minimaler Nachweisablauf

1. Lokalen Stack mit bestehenden Scripts starten: `npm run local:start`.
2. Lokalen Status pruefen: `npm run local:status`.
3. Lokalen Betriebs-/Seed-/Export-/Auditbeleg pruefen: `npm run local:check`.
4. UI-Routen manuell betrachten: `http://127.0.0.1:3200/`, `http://127.0.0.1:3200/angebot`, `http://127.0.0.1:3200/produktion`.
5. Eigene Eingaben nur aus der synthetischen Szenario- und Datenkarte uebernehmen.
6. Sichtbare Reibung in der P6-B58-Vorlage notieren.
7. Route-/Export-/Audit-Evidenz im P7-B65-Evidence-Paket festhalten.
8. Reibung anschliessend ueber P7-B67 triagieren.
9. Lokalen Stack kontrolliert stoppen: `npm run local:stop`.

## 4. Was als lokal/synthetisch gruen gelten darf

Ein lokales Gruensignal darf nur eng gelesen werden:

- `npm run local:status` zeigt lokale Prozess-/Port-/Session-Plausibilitaet.
- `npm run local:check` belegt den vorhandenen lokalen Betriebs-/Seed-/Export-/Auditkorridor gegen einen laufenden lokalen Stack.
- UI-Routen `/`, `/angebot` und `/produktion` sind im synthetischen internen Beta-Weg manuell betrachtbar.
- Read-only Arbeitsbelege wie Angebots-HTML, Produktionsblatt-/Produktionsplan-HTML, Einkaufsliste-CSV und Audit-Spur koennen als vorhandene interne Arbeitsbelege beobachtet werden.
- Ein ausgefuelltes Reibungslog oder Evidence-Paket belegt nur die Beobachtung im lokalen synthetischen Durchlauf, nicht eine fachliche oder produktionsnahe Freigabe.

## 4.1 P9-N2 Gate-Bindung gegen Scheingruenheit

Fuer den Rehearsal-Nachweis duerfen die bestehenden lokalen Gates nicht isoliert als Freigabe gelesen werden:

- `npm run local:status` allein ist kein Rehearsal-Go. Der Befehl belegt nur lokale Prozess-/Port-/Session-Plausibilitaet.
- `npm run local:check` allein ist kein Rehearsal-Go. Der Befehl belegt nur den lokalen Betriebs-/Seed-/Export-/Auditkorridor gegen einen bereits laufenden lokalen Stack.
- UI-/Smoke-Anker allein sind kein Rehearsal-Go. Sie zeigen nur, dass vorhandene Routen, Marker und read-only Arbeitsbelege sichtbar bleiben.
- Rehearsal-Go darf nur vergeben werden, wenn Status, Check, manuelle UI-Routen, Evidence-Paket und Reibungslog gemeinsam widerspruchsfrei sind.
- Rote lokale Gates, fehlende Export-/Auditanker oder offene Stop-Gates sind als `blocked` oder `decision needed` zu dokumentieren.

Die enge Nachweiskette lautet: `npm run local:status -> npm run local:check -> manuelle UI-Routen -> P7-B65-Evidence-Paket -> P6-B58-Reibungslog`.

Auch bei gruener Nachweiskette bleibt der Befund begrenzt: keine Produktionsfreigabe, keine rechtssichere Audit-/Compliance-Aussage und keine echten Daten.

## 5. Was blocked bleibt

Der Nachweisrahmen darf nicht als Freigabe missverstanden werden.

Verbindlich bleibt:

- echte Daten blocked: keine echten Kunden-, Personen-, Mitarbeiter-, Einsatz-, Schicht-, Abrechnungs- oder produktionsnahen Pilotdaten,
- Produktionsfreigabe blocked: keine produktionsnahe Nutzung, keine externe Freigabe, keine Beschaffungs- oder Signaturfreigabe,
- Compliance blocked: keine rechtssichere Audit-/Compliance-/DSGVO-/Retention-/Backup-Aussage,
- kein Deployment: keine Hetzner-, SSH-, Domain-, TLS-, Proxy- oder Serveraenderung,
- keine Secrets: keine Tokens, produktive `.env`, Connection Strings oder private Schluessel,
- keine neue API,
- keine neue Persistenz, keine Migration und kein Prisma,
- kein OAuth/Login/OIDC und keine Session- oder Nutzerverwaltungswelt,
- keine automatische Spec-Korrektur,
- keine Rezept-/Allergenautomatik,
- kein LLM-/Tool-Use-/OCR-/Parser-Ausbau.

## 6. Plan 8 / Option A bleibt Grenze

Plan 8 ist abgeschlossen. Option A bleibt fuer den internen Beta-MVP die bewusste Copy-/Anleitungsloesung fuer Schedule/Zeitfenster.

Fuer den Rehearsal-Nachweis bedeutet das:

- Die `Zeitfenster-Rehearsal-Notiz` ist nur eine manuelle Notiz im P7-B65-Evidence-Paket.
- Es gibt keine automatische event.schedule-Uebernahme.
- Es gibt kein Schedule-/Zeitfenster-Datenmodell.
- Es gibt keine Runtime-Schedule-Logik.
- Es gibt keine automatische oder halbautomatische Spec-Korrektur aus dieser Notiz.
- Export-/Auditbelege beweisen keine strukturierte Zeitfensterloesung.

Wenn fuer den naechsten Schritt eine echte strukturierte Zeitfensterloesung benoetigt wuerde, ist das eine separate Produkt-/Datenmodellentscheidung und kein P9-N1-Rehearsal-Schritt.

## 7. Ergebnis von P9-N1

P9-N1 konsolidiert den vorhandenen lokalen Rehearsal-Nachweisrahmen als schmalen Index. Der konkrete Nutzwert ist Auffindbarkeit und klare Begrenzung: Start-/Status-Korridor, Reviewer-Start, synthetische Datenkarte, Reibungslog, Evidence-Paket, Triage und Plan-8-Option-A-Grenze stehen in einer Dokumentkette. Der Rahmen bleibt Doku-/Vertragstest-only und fuehrt keine Produktlogik, keine UI, keine API, keine Persistenz, kein Deployment und keine echte Datenverarbeitung ein.
