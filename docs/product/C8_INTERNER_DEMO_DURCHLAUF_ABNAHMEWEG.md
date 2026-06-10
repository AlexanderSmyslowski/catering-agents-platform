# C8 Interner Demo-Durchlauf als reproduzierbarer Abnahmeweg

Status: Doku-only Abnahmeweg auf Basis bestehender Scripts, Routen und Tests
Stand: 2026-05-22
Scope: interner MVP-/Demo-Korridor; keine neue Runtime-Funktion, keine neue API, keine neue Persistenz

## 1. Zweck

Dieses Dokument beschreibt den kleinsten reproduzierbaren internen Demo- und Abnahmeweg fuer den aktuellen MVP-Stand der Catering Agents Platform.

Der Weg verknuepft nur bereits vorhandene Scripts, UI-Routen, Exportpfade, Upload-/Warnanker und Test-/Build-Gates. Er baut keine neue Demo-Plattform und fuehrt keine neuen Produktfeatures ein.

Repo-Anker: `docs/product/C8_INTERNER_DEMO_DURCHLAUF_ABNAHMEWEG.md` ist aus `README.md` und `TESTING.md` auffindbar und wird durch den schmalen Vertragstest `tests/local-ops-check-contract.test.ts` gegen vorhandene Scripts, Routen und Gates abgesichert. Die P5-Ist-Karte `docs/product/P5_BETA_DURCHLAUF_IST_KARTE.md` kartiert denselben Start -> Angebot -> Produktion -> Exporte/Audit-Weg aus Nutzersicht und trennt intern nutzbar, nur dokumentiert, blockiert und schon testbar. Die P5-B54-Checkliste `docs/product/P5_B54_MANUELLE_BETA_TEST_CHECKLISTE.md` fuehrt Alexander manuell durch Start -> Angebot -> Produktion -> Rueckfragen -> Exporte/Audit, inklusive URLs, sichtbarer Marker, Stop-Gates und Nicht-Freigaben. Die P6-B56-Lueckenkarte `docs/product/P6_B56_BETA_ONBOARDING_ISTSTAND_LUECKENKARTE.md` buendelt den Beta-Onboarding-Iststand Starten -> Durchlaufen -> Reibung notieren -> Stop-Gates und trennt intern testbar, nur synthetisch, blockiert und verboten. Der P6-B57-Start-/Status-Korridor `docs/product/P6_B57_LOKALER_START_STATUS_KORRIDOR.md` buendelt Starten -> Status pruefen -> Betriebscheck -> UI-Routen oeffnen -> kontrolliert stoppen, relevante lokale URLs, Health-Endpunkte und sichere Reaktion auf rote Status-/Check-Signale. Die P6-B58-Reibungslog-Vorlage `docs/product/P6_B58_BETA_REIBUNGSLOG_VORLAGE.md` strukturiert Beobachtung, Route, Erwartung, tatsaechliches Verhalten, Schweregrad, Screenshot-Hinweis ohne personenbezogene Daten und naechste Entscheidung, ohne echte Daten oder eine externe QA-Plattform einzufuehren. Die P6-B61-Management-Entscheidungsvorlage `docs/product/P6_B61_BETA_MANAGEMENT_ENTSCHEIDUNGSVORLAGE.md` verdichtet sofort testbare Beta-Schritte, Stop-Gates, No-go-Grenzen und den naechsten engen Produktwertblock nach beobachteter Reibung. Der P9-N1-Nachweisrahmen `docs/product/P9_N1_LOKALER_REHEARSAL_NACHWEISRAHMEN.md` konsolidiert C8, P6-B57, P6-B58, P7-B63/B64/B65/B67 und die Plan-8-Option-A-Grenze zu einem lokalen Rehearsal-Index; lokal/synthetisch gruene Signale bleiben von echten Daten, Produktionsfreigabe und Compliance blocked getrennt. Der B11-Ergebnisanker `docs/product/B11_LOCAL_DEMO_PILOT_ACCEPTANCE_RUN.md` ordnet den lokalen Demo-/Pilotdaten-Durchlauf zusaetzlich in `go`, `blocked` oder `not assessed` ein, ohne Produktionsfreigabe oder rechtssichere Compliance-/Audit-Freigabe zu behaupten. Der B12-Ergebnisvermerk `docs/product/B12_LOCAL_DEMO_RESULT_NOTE.md` strukturiert den konkreten lokalen Ergebnisnachweis mit tatsaechlichen Checks, Quellen, Ergebniszustand, offenen Blockern und klaren Nicht-Behauptungen.

## 2. Lokale Voraussetzungen

Vor einem internen Demo-Durchlauf gelten diese Voraussetzungen:

1. Repository lokal ausgecheckt und Abhaengigkeiten installiert:
   ```bash
   npm install
   ```
2. Lokaler Stack wird ueber die bestehenden Repo-Scripts betrieben:
   ```bash
   npm run local:start
   ```
   Der Script startet den lokalen Stack inklusive Demo-Seeding. Er nutzt bewusst die vorhandenen Services und `screen`-Sitzungen.
3. Standard-Ports laut README bleiben frei bzw. werden durch den lokalen Stack belegt:
   - Backoffice-UI: `http://127.0.0.1:3200/`
   - Intake-Service: `http://127.0.0.1:3101/health`
   - Offer-Service: `http://127.0.0.1:3102/health`
   - Production-Service: `http://127.0.0.1:3103/health`
   - Export-Service: `http://127.0.0.1:3104/health`
4. `tmp/` oder andere lokale Arbeitsverzeichnisse sind fuer diesen Abnahmeweg nicht relevant und werden nicht benoetigt.

## 3. Start- und Statuspruefung

Der Demo-Durchlauf beginnt mit dem vorhandenen lokalen Startweg:

```bash
npm run local:start
```

`npm run local:start` startet den lokalen Stack mit Demo-Seeding in den bestehenden `screen`-Sitzungen. Der Befehl nutzt die vorhandenen Services und Demo-Fixtures; er ist kein Deployment und keine Produktionsfreigabe.

Danach folgt die lokale Statussicht:

```bash
npm run local:status
```

Ein plausibler Status zeigt, dass die erwarteten lokalen Services bzw. `screen`-Sitzungen laufen und die Service-Ports erreichbar sind. `npm run local:status` ist damit nur eine lokale Prozess- und Erreichbarkeitsuebersicht; der Befehl belegt noch keinen vollstaendigen Betriebsweg.

Danach folgt der bestehende lokale Betriebscheck:

```bash
npm run local:check
```

`npm run local:check` ist der lokale Betriebs-/Seed-/Export-/Auditbeleg gegen einen bereits laufenden lokalen Stack. Der Check prueft den schmalen MVP-Betriebsweg mit UI-Routen, Health-Endpunkten, read-only Exportpfaden und Demo-Start-/Auditbeleg.
Wenn der Check einen aufgefuellten lokalen Datenbestand meldet, ist das kein rotes Gate, aber auch kein sauberer Frischlauf. Wenn lokale Einkaufslisten moegliche Rezept-Arbeitsschritte als Einkaufspositionen enthalten, ist das ebenfalls nur ein lokaler Stale-Datenbefund. Die UI-Sichtung und das Reibungslog muessen dann Altlasten oder Stale-Fokus benennen; `local:check` loescht, bereinigt oder archiviert lokale Daten nicht automatisch.

P9-N2 Gate-Bindung gegen Scheingruenheit: `npm run local:status` allein ist kein Rehearsal-Go. `npm run local:check` allein ist kein Rehearsal-Go. UI-/Smoke-Anker allein sind kein Rehearsal-Go. Rehearsal-Go darf nur vergeben werden, wenn Status, Check, manuelle UI-Routen, Evidence-Paket und Reibungslog gemeinsam widerspruchsfrei sind. Rote lokale Gates, fehlende Export-/Auditanker oder offene Stop-Gates sind als `blocked` oder `decision needed` zu dokumentieren.

Demo-Seed ist eine interne Verifikationshilfe fuer den lokalen MVP-Korridor und kein Produktionsdatenmodell. Der Auditbeleg ist ein interner Betriebs-/Kontrollnachweis fuer den Demo-Startweg und keine rechtssichere Audit-/Compliance-Aussage.

Option-A-Zeitfenster-Grenze im lokalen Smoke-Korridor: lokale Gruensignale aus `npm run local:status` und `npm run local:check` belegen keine strukturierte Zeitfensterloesung; die `Zeitfenster-Rehearsal-Notiz` bleibt eine manuelle Copy-/Anleitungsnotiz; es gibt keine automatische `event.schedule`-Uebernahme und kein Schedule-/Zeitfenster-Datenmodell.

Wenn `local:check` rot wird, ist das zuerst als lokaler Betriebs- oder Demo-Datenstand zu behandeln. Der Abnahmeweg wird dann nicht durch Featurebau repariert, sondern der lokale Stack wird kontrolliert neu gestartet oder die konkrete Check-Meldung wird als Blocker dokumentiert.

Der lokale Demo-Durchlauf endet kontrolliert mit:

```bash
npm run local:stop
```

`npm run local:stop` beendet die lokalen `screen`-Sitzungen und zugehoerigen Repo-Prozesse wieder. Der Befehl ist der Abschluss des lokalen Demo-Durchlaufs und kein Server- oder Deployment-Eingriff.

## 4. Relevante UI-Routen fuer die manuelle Demo

Die manuelle Demo nutzt nur die vorhandenen Kernrouten:

1. Startseite
   - `http://127.0.0.1:3200/`
   - Erwartung: Agentenwahl mit Angebotsagent, Produktionsagent und gemeinsamem Regelkern.
2. Angebotsagent
   - `http://127.0.0.1:3200/angebot`
   - Erwartung: zentrale Anfrage-/Angebotsflaeche, vorhandene Entwurfs-/Statussicht, Uebergabe-/Exportanker.
3. Produktionsagent
   - `http://127.0.0.1:3200/produktion`
   - Erwartung: Produktions-Workbench mit Spezifikationskontext, Rueckfragen-/Antwortstatus, Produktionsobjekten, Einkaufslisten-/Downloadankern, Rezeptpruefstatus sowie Herkunft/Uebergabe.

## 5. Angebot-Happy-Path und Handoff-Anker

Der interne Angebots-Demo-Weg ist:

1. `/angebot` oeffnen.
2. Eine neue Anfrage in die vorhandene zentrale Anfrageflaeche geben oder mit Demo-Daten arbeiten.
3. Pruefen, dass ein Angebotsentwurf bzw. fokussierter Entwurf sichtbar wird.
4. Pruefen, dass Status-, Uebergabe-, Audit- und Exportanker im Angebotskontext sichtbar bleiben.
5. Den Uebergabeanker Richtung Produktion nachvollziehen:
   - sichtbarer `draftId`-/`specId`-/`requestId`-Kontext,
   - Link oder Bezug zur Produktionsansicht,
   - gleiche fachliche Spezifikation als Grundlage fuer `/produktion`.

Dieser Schritt ist durch bestehende Backoffice-Smokes abgesichert, insbesondere `tests/backoffice-route-smoke.test.ts`. Er behauptet keine neue Angebotslogik und keine automatische fachliche Freigabe.

## 6. Produktionssicht, Upload-/Import-Warnanker und Empty States

In `/produktion` wird fuer die interne Demo geprueft:

1. Die aktive Spezifikation bzw. der Demo-Kontext ist sichtbar.
2. Vorhandene Rueckfragen und Antworten erscheinen als strukturierte Workbench-/Conversation-Sicht.
3. Upload-/Import-Warnungen erscheinen nur als sichere Status- und Warnmarker:
   - Warnstatus und Warnkey, zum Beispiel `Ingestion-Warnung: Status fallback · Warnkey document_text_extraction_fallback`,
   - keine Rohtextspiegelung aus Dokumenten,
   - sichere Quellen-/Hash-Kurzanker,
   - gekuerzte Quellenmetadaten,
   - keine vollen SHA-256-Hashes,
   - kontrollierte Servermeldungen statt generischer HTTP-Statuszeilen, soweit vorhanden.
4. P3-B37 Upload-Grenzen als Beta-Risiko bleibt fuer interne Beta-Nutzer sichtbar:
   - Intake-Dokumentuploads: maximal 25 MB pro Datei und bis zu 3 Dateien pro Multipart-Request,
   - Rezeptuploads in Angebot und Produktion: maximal 5 MB und genau eine Datei pro Upload,
   - erlaubt bleibt nur der vorhandene Dokumentkorridor PDF/TXT/MD/EML/Pages mit passender MIME-/Extension-Kombination,
   - zu grosse oder nicht erlaubte Dateien bleiben kontrolliert abgewiesen,
   - erlaubte Demo-Dateien laufen im internen Korridor weiter,
   - Produktionsnahe Verarbeitung echter oder beliebiger Uploads bleibt ohne Sandbox/Worker/AV-Gate `blocked`,
   - Warnungen bleiben sichere Status-/Warnkey-Marker ohne Rohtext- oder Vollhash-Spiegelung.
5. P3-B38 Echte-Daten-Stop-Gate bleibt fuer den Beta-Runbook-Kontext verbindlich:
   - Demo-/Seed-/synthetische Daten bleiben der erlaubte interne Beta-Korridor,
   - echte Personen-/Kunden-/Einsatzdaten bleiben `blocked`, solange PII/Retention/Backup-Gate und Sandbox/Worker/AV-Gate nicht bewusst entschieden sind,
   - ein lokaler Demo- oder Upload-Gruenstatus ist kein Compliance-Freibrief und keine Freigabe fuer echte Daten.
6. Wenn Plan, Einkaufsliste oder Exportlinks noch fehlen, erklaert die UI den Zustand ruhig und benennt den naechsten Schritt, insbesondere `Berechnung starten`.

Diese Anker sind in den bestehenden Tests dokumentiert und abgesichert, insbesondere in:

- `tests/backoffice-route-smoke.test.ts`
- `tests/backoffice-production-acceptance-smoke.test.ts`
- `tests/backoffice-internal-usage-smoke.test.ts`
- `tests/pa14-document-ingestion-corridor-readiness.test.ts`

## 7. Rueckfragen-Fortsetzung im synthetischen Demo-Korridor

Der Plan-4-Rueckfragenstand ist fuer interne Nutzer ohne echte Daten nachvollziehbar:

- Der synthetische Fixture-Anker `spec-demo-production-answered-clarification` / `demo-production-answered-clarification` belegt eine beantwortete Rueckfrage mit `Synthetische Demo-Antwort`.
- In der Conversation-/Workbench-Sicht bleiben Rueckfragen als `Agent fragt · offen` oder `Agent fragt · beantwortet` lesbar; passende Antworten erscheinen read-only als `user_structured_answer` direkt im bestehenden Verlauf.
- Produktionsobjekte/Downloads bleiben read-only Ergebnis-/Exportanker; beantwortete Rueckfragen loesen keine automatische Spec-Korrektur, keine Fachableitung, keine Rezept-/Allergenautomatik und keine LLM-/Tool-Use-Behauptung aus.
- Der lokale Nachweis ist test-/dokumentationsseitig ueber `tests/local-ops-check-contract.test.ts` und die vorhandenen Projection-/Backoffice-Smokes auffindbar; er ersetzt keinen produktionsnahen Pilot, keine echte Datenfreigabe und keine externe Freigabe.

## 8. Exporte mit Trusted-Actor-Kontext

Der Demo-Durchlauf betrachtet Exporte als interne read-only Arbeitsbelege unter Trusted-Actor-Kontext:

- Angebots-HTML
- Produktionsblatt-/Produktionsplan-HTML
- Einkaufslisten-CSV

Im lokalen Dev-/Testbetrieb funktionieren die vorhandenen Pfade ueber den bekannten Operator-/Demo-Kontext. Fuer produktionsnahe Nutzung gilt jedoch der Trusted-Actor-Rahmen:

- Bei gesetztem `CATERING_TRUSTED_ACTOR_SECRET` zaehlen Rollen nur aus `x-catering-actor-name` plus passendem `x-catering-trusted-secret`.
- Frei gesetztes `x-actor-name` ist nur lokale Dev-/Test-Kompatibilitaet und kein produktionsnaher Sicherheitskontext.
- Exporte bleiben read-only Arbeitsartefakte und sind keine Signatur, keine externe Freigabe, keine Produktionsfreigabe und keine rechtssichere Audit-/Compliance-Behauptung.
- Dieser Abnahmeanker fuehrt kein OIDC/Login, keine Session-Welt und keine neue Exportlogik ein.

Die Export-/Read-path-Auth-Annahmen werden durch bestehende Tests und Doku getragen, insbesondere `tests/pa8-read-path-auth.test.ts` und `docs/architecture/PA9_PROXY_DEPLOYMENT_READINESS_ADR.md`.

## 9. Full Gates fuer einen C8-Abnahmelauf

Fuer einen vollstaendigen internen C8-Abnahmelauf werden die bestehenden Gates in dieser Reihenfolge genutzt:

```bash
npm run local:status
npm run local:check
npm test
npm run build
npm audit --omit=dev
git diff --check
npm run local:stop
```

Ein gruener Lauf bedeutet nur: Der aktuelle interne MVP-/Demo-Korridor ist anhand der bestehenden Repo-Signale reproduzierbar abnehmbar.

Ein roter Lauf bedeutet: Der konkrete Check oder Gate-Fehler ist zu dokumentieren und gezielt zu beheben. Daraus folgt nicht automatisch ein neuer Produkt- oder Infrastrukturauftrag.

## 10. Klare Grenzen

Dieser C8-Abnahmeweg ist bewusst begrenzt.
Der Rahmen bleibt ein interner Demo-/Abnahmeweg und keine externe Freigabe.

Er ist:

- ein interner Demo- und Abnahmeweg,
- eine Verknuepfung bestehender Scripts, Routen, Exportpfade, Warnanker und Gates,
- ein reproduzierbarer Kontrollpfad fuer den aktuellen MVP-Stand.

Er ist ausdruecklich nicht:

- keine Produktionsfreigabe,
- keine Freigabe fuer externe Nutzung,
- keine rechtssichere Audit-/Compliance-Behauptung,
- keine Signatur- oder Freigabewelt fuer Exporte,
- keine neue QA-, Release- oder Monitoring-Plattform,
- keine neue API, Persistenz, Migration oder Recovery-Plattform,
- kein Parser-/OCR-/LLM-/Rezept-/Allergen-Ausbau.

## 11. Minimaler Ergebnisvermerk nach einem Demo-Durchlauf

Nach einem internen Demo-Durchlauf genuegt ein knapper Vermerk mit:

- Zeitpunkt und Commit-SHA,
- Ergebnis von `npm run local:start`,
- Ergebnis von `npm run local:status`,
- Ergebnis von `npm run local:check`,
- Ergebnis von `npm run local:stop`,
- manuell betrachtete UI-Routen,
- betrachtete Exportanker,
- Ergebnis von `npm test`, `npm run build`, `npm audit --omit=dev` und `git diff --check`,
- bekannte Blocker oder Risiken,
- klare Aussage, dass keine externe/produktive Freigabe behauptet wird.

Fuer B12 wird dieser Vermerk durch `docs/product/B12_LOCAL_DEMO_RESULT_NOTE.md` konkretisiert und durch `tests/b12-local-demo-result-note-contract.test.ts` als Doku-Vertrag abgesichert.
