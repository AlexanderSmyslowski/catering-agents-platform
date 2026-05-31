# Catering Agents Platform

MVP-Monorepo fuer zwei spezialisierte Catering-Agenten:

- `offer-service`: Angebots-CoPilot
- `intake-service`: Intake, Parsing, Normalisierung
- `production-service`: Produktions-/Kuechen-CoPilot
- `shared-core`: kanonische Schemata, Regeln und Taxonomien
- `print-export`: HTML-/CSV-Exportservice fuer Angebote, Produktionsplaene und Einkaufslisten
- `backoffice-ui`: interne Web-App fuer Intake, Angebote, Produktion und Exporte

## Schnellstart

```bash
npm install
npm test
npm run build
```

## Entwicklungsserver

```bash
npm run dev:intake
npm run dev:offer
npm run dev:production
npm run dev:exports
npm run dev:ui
```

Fuer den kompletten lokalen Stack mit Demo-Daten:

```bash
npm run local:start
npm run local:start:fresh
```

Der lokale Stack laeuft dabei bewusst in getrennten `screen`-Sitzungen mit automatischem Neustart pro Dienst. Dadurch bleiben UI und Agenten auch dann erreichbar, wenn das startende Terminal oder die Codex-Sitzung endet.

Status und Stop:

```bash
npm run local:status
npm run local:check
npm run local:stop
```

`npm run local:status` ist eine lokale Prozess- und Erreichbarkeitsuebersicht fuer die erwarteten `screen`-Sitzungen und Service-Ports. `npm run local:check` ist der lokale Betriebs-/Seed-/Export-/Auditbeleg gegen einen bereits laufenden lokalen Stack: UI-Routen, Health-Endpunkte, read-only Exportpfade und Demo-Start-/Auditbeleg.
`npm run local:start` startet diesen lokalen Stack mit Demo-Seeding; `npm run local:start:fresh` stoppt den laufenden lokalen Stack kontrolliert und startet mit einer temporaeren synthetischen Datenwurzel neu, damit Browser-Rehearsals nicht gegen Repo-Altlasten laufen. `npm run local:stop` beendet die lokalen `screen`-Sitzungen und zugehoerigen Repo-Prozesse wieder. Dieser lokale Runbook-Weg bleibt interne Demo-/Abnahmeverifikation und ist kein Deployment, keine Produktionsfreigabe und keine rechtssichere Audit-/Compliance-Aussage.
`npm run local:start` zeichnet die wirksame lokale Datenwurzel auf. `npm run local:check` nutzt diese Aufzeichnung, damit isolierte Frischlaeufe mit `CATERING_DATA_ROOT=/tmp/...` nicht versehentlich gegen Repo-Altlasten bewertet werden; eine abweichende Check-Env ist ein lokales Konsistenzsignal und verlangt einen kontrollierten Stop/Neustart.
Wenn `local:check` einen aufgefuellten lokalen Datenbestand erkennt, meldet der Check nur einen Rehearsal-Datenhinweis: kein rotes Gate, aber auch kein sauberer Frischlauf. Wenn lokale Einkaufslisten moegliche Rezept-Arbeitsschritte als Einkaufspositionen enthalten, meldet der Check ebenfalls nur einen lokalen Stale-Datenbefund. Der Check loescht, bereinigt oder archiviert lokale Daten nicht automatisch; einzelne falsche interne/synthetische Intake-Kontexte koennen nach C9 in `/produktion` bewusst per Soft-Archiv aus aktiven Listen genommen werden.

Browser-Rehearsals sind optional lokale Prueflaeufe gegen den laufenden Stack: `npm run browser:rehearsal` prueft den nicht-mutierenden Kernpfad `Start -> Angebot -> Produktion -> Rueckfragen -> Ergebnisobjekte -> Exporte/Audit`. Mutierende Browser-Rehearsals muessen nach `npm run local:start:fresh` laufen: `npm run browser:rehearsal:answer-submit` speichert synthetische Rueckfragenantworten und berechnet den aktuellen Produktionskontext, `npm run browser:rehearsal:archive-intake` klickt den Soft-Archiv-Pfad fuer den synthetischen Fehlupload-/Intake-Kontext. `npm run browser:rehearsal:full-fresh` fuehrt die drei Browser-Rehearsal-Modi jeweils mit kontrolliert frischer temporaerer synthetischer Datenwurzel hintereinander aus. Die Browser-Rehearsals veraendern nur synthetische lokale Fresh-Datenwurzeln und sind kein Echte-Daten-, Deployment-, Compliance- oder Produktionsfreigabe-Beleg.

Demo-Seed ist eine interne Verifikationshilfe fuer den lokalen MVP-Korridor und kein Produktionsdatenmodell. Der Auditbeleg ist ein interner Betriebs-/Kontrollnachweis fuer den Demo-Startweg und keine rechtssichere Audit-/Compliance-Aussage. Der C8-Rahmen bleibt ein interner Demo-/Abnahmeweg, keine Produktionsfreigabe und keine externe Freigabe.

Standardmaessig speichern die Services ihre Laufzeitdaten unter `./data`.
Auf Servern sollte dafuer ein persistentes Verzeichnis gesetzt werden:

```bash
export CATERING_DATA_ROOT=/var/lib/catering-agents
```

Fuer PostgreSQL statt Dateispeicher:

```bash
export CATERING_DATABASE_URL=postgresql://user:password@localhost:5432/catering_agents
```

Die interne Web-App laeuft im Dev-Modus ueber Vite auf Port `3200` und proxied standardmaessig auf:

- `http://localhost:3101` fuer Intake
- `http://localhost:3102` fuer Offers
- `http://localhost:3103` fuer Production
- `http://localhost:3104` fuer Exporte

Optional konfigurierbar ueber:

- `VITE_INTAKE_PROXY_TARGET`
- `VITE_OFFERS_PROXY_TARGET`
- `VITE_PRODUCTION_PROXY_TARGET`
- `VITE_EXPORTS_PROXY_TARGET`

Die Oberflaeche hat jetzt drei Einstiege:

- `http://localhost:3200/` als Startseite mit Agentenwahl
- `http://localhost:3200/angebot` fuer den Angebotsagenten
- `http://localhost:3200/produktion` fuer den Produktionsagenten

Fuehrender Produktzielanker fuer weitere Arbeit:

- [docs/product/PRODUKTZIEL_CATERING_AGENTS_PLATFORM.md](docs/product/PRODUKTZIEL_CATERING_AGENTS_PLATFORM.md) beschreibt die interne Catering-Arbeitsplattform, den aktuellen kontrollierten MVP-/Beta-Korridor und die Grenzen gegen externe Nutzung, echte Multi-Tenant-Plattform, produktionsnahe echte Daten, Auth/OIDC, neue Persistenz/API und Deployment ohne gesonderte Gates.
- [docs/architecture/PRODUCTION_AGENT_10_10_CODING_ARCHITECTURE.md](docs/architecture/PRODUCTION_AGENT_10_10_CODING_ARCHITECTURE.md) beschreibt die Coding-Architektur bis zum internen 10/10-ProductionAgent: deterministischer Kern zuerst, LLM-Readiness ohne Provider, danach LLM nur hinter Gates, Schemas, Tool-Allowlist, Kostenlimit, Audit und Human Approval.
- Die aktualisierte Autonomiegrenze erlaubt kleine lokale, testbare und reversible Slices fuer synthetische Smokes, Rezept-/Import-/Einkaufslisten-/UI-Haertung und Doku-/Contract-Klaerungen autonom; echte Daten, Auth/OIDC/IAP, Deployment, neue API/Persistenz/Migration, echte ConversationSession-Runtime und LLM-Provider bleiben Gates.
- [docs/product/C10_CURRENT_WORKTREE_PR_SLICES.md](docs/product/C10_CURRENT_WORKTREE_PR_SLICES.md) sortiert den aktuellen uncommitted Arbeitsbaum in reviewbare Slices; es ist kein Commit-, PR-, LLM-, Deployment-, API-, Persistenz- oder Echtdaten-Go.

Fuehrendes Architektur-Gate vor weiterem Produktionsagent-v1-Featurebau:

- [docs/architecture/PRODUCTION_AGENT_V1_ARCHITECTURE_GATE.md](docs/architecture/PRODUCTION_AGENT_V1_ARCHITECTURE_GATE.md)
- [docs/product/PA6_INTERNAL_BETA_READINESS_SUMMARY.md](docs/product/PA6_INTERNAL_BETA_READINESS_SUMMARY.md) fasst die interne Beta-/Abnahme-Readiness aus bestehenden Status-, Test-, Export-, Audit- und Gate-Signalen zusammen; externe Nutzung und echte Produktionsagent-v1-Faehigkeiten bleiben gesperrt, bis die benannten Gates bewusst entschieden sind.
- [docs/product/P5_BETA_DURCHLAUF_IST_KARTE.md](docs/product/P5_BETA_DURCHLAUF_IST_KARTE.md) kartiert den aktuellen internen Beta-Durchlauf Start -> Angebot -> Produktion -> Exporte/Audit aus Nutzersicht und trennt intern nutzbar, nur dokumentiert, blockiert und schon testbar.
- [docs/product/P5_B54_MANUELLE_BETA_TEST_CHECKLISTE.md](docs/product/P5_B54_MANUELLE_BETA_TEST_CHECKLISTE.md) fuehrt Alexander manuell durch den lokalen Beta-Weg Start -> Angebot -> Produktion -> Rueckfragen -> Exporte/Audit, inklusive URLs, sichtbarer Marker, Stop-Gates und Nicht-Freigaben.
- [docs/product/P6_B56_BETA_ONBOARDING_ISTSTAND_LUECKENKARTE.md](docs/product/P6_B56_BETA_ONBOARDING_ISTSTAND_LUECKENKARTE.md) kartiert fuer Plan 6 den lokalen Beta-Onboarding-Iststand Starten -> Durchlaufen -> Reibung notieren -> Stop-Gates und trennt intern testbar, nur synthetisch, blockiert und verboten.
- [docs/product/P6_B57_LOKALER_START_STATUS_KORRIDOR.md](docs/product/P6_B57_LOKALER_START_STATUS_KORRIDOR.md) buendelt fuer Plan 6 den lokalen Beta-Start-/Status-Korridor Starten -> Status pruefen -> Betriebscheck -> UI-Routen oeffnen -> kontrolliert stoppen mit relevanten lokalen URLs, Health-Endpunkten und Reaktion auf rote Status-/Check-Signale.
- [docs/product/P6_B58_BETA_REIBUNGSLOG_VORLAGE.md](docs/product/P6_B58_BETA_REIBUNGSLOG_VORLAGE.md) strukturiert fuer Plan 6 sichere Reibungsnotizen ohne echte Daten mit Beobachtung, Route, Erwartung, tatsaechlichem Verhalten, Schweregrad, Screenshot-Hinweis ohne personenbezogene Daten und naechster Entscheidung.
- [docs/product/P6_B61_BETA_MANAGEMENT_ENTSCHEIDUNGSVORLAGE.md](docs/product/P6_B61_BETA_MANAGEMENT_ENTSCHEIDUNGSVORLAGE.md) verdichtet P6-B61 als Management-Entscheidungsvorlage: sofort testbar, Stop-Gates, No-go und naechster enger Produktwertblock nur nach beobachteter Reibung.
- [docs/product/P7_B63_REVIEWER_REHEARSAL_STARTKARTE.md](docs/product/P7_B63_REVIEWER_REHEARSAL_STARTKARTE.md) buendelt P7-B63 als Reviewer-Rehearsal-Startkarte: fiktive Testrolle, synthetisches Ziel, erlaubte Daten, Stop-Gates und den fuehrenden Pfad Start -> Angebot -> Produktion -> Rueckfragen -> Exporte/Audit.
- [docs/product/P7_B64_SYNTHETISCHE_SZENARIO_UND_DATENKARTE.md](docs/product/P7_B64_SYNTHETISCHE_SZENARIO_UND_DATENKARTE.md) konkretisiert P7-B64 als synthetische Szenario- und Datenkarte: fiktive Beispielwerte fuer Kunde, Kontakt, Ort, Termin, Anlass und Testdokument, ohne echte Kunden-, Personen- oder Einsatzdaten.
- [docs/product/P7_B65_EXPORT_AUDIT_ROUTE_EVIDENZPAKET.md](docs/product/P7_B65_EXPORT_AUDIT_ROUTE_EVIDENZPAKET.md) strukturiert P7-B65 als Evidence-Checklist fuer Route, Erwartung, Beobachtung, read-only Export-/Auditbeleg, Reibung und naechste Entscheidung ohne externe Ablage, Upload oder echte Dateien mit personenbezogenen Daten.
- [docs/product/P7_B67_REIBUNG_ZU_BACKLOG_TRIAGE.md](docs/product/P7_B67_REIBUNG_ZU_BACKLOG_TRIAGE.md) ordnet P7-B67 als Triage-Matrix ein: beobachtete Reibung aus Reibungslog und Evidenzpaket wird in sofort kleiner Fix, spaeter, Entscheidung noetig oder out of scope/verboten uebersetzt.
- [docs/product/P9_N1_LOKALER_REHEARSAL_NACHWEISRAHMEN.md](docs/product/P9_N1_LOKALER_REHEARSAL_NACHWEISRAHMEN.md) konsolidiert den lokalen Rehearsal-Nachweisrahmen aus C8, P6-B57, P6-B58, P7-B63/B64/B65/B67 und der Plan-8-Option-A-Grenze; lokal/synthetisch gruene Signale bleiben von echten Daten, Produktionsfreigabe und Compliance blocked getrennt.
- [docs/product/P11_N1_LIMITED_INTERNAL_PILOT_PREFLIGHT_INDEX.md](docs/product/P11_N1_LIMITED_INTERNAL_PILOT_PREFLIGHT_INDEX.md) uebersetzt den B24-Korridor `begrenzter interner Pilot mit anonymisierten Daten: not assessed` in nicht-sensitive Preflight-Pruefpunkte fuer Zielumgebung, Nutzerkreis, Datenumfang, Betreiber-/Zugriffskontext und Anonymisierungsnachweis; lokaler Demo-/Rehearsal-Go bleibt getrennt von Pilot-Go und produktionsnah blocked.
- [docs/product/P11_N3_INTERNER_PILOT_PREFLIGHT_RUNBOOK.md](docs/product/P11_N3_INTERNER_PILOT_PREFLIGHT_RUNBOOK.md) ordnet Starten -> Status pruefen -> UI-Routen -> Reibungslog -> Export-/Auditbelege -> kontrolliert stoppen und konkretisiert fuer Plan 11 die Entscheidungspunkte fuer Nutzerkreis, Betreiber, Trusted-Actor-Kontext und Zugriffskontrollfragen; Auth-/Proxy-/Deployment-/Secret-Umsetzungsideen bleiben Stop-Gates und lokales Rehearsal-Go bleibt kein Pilot-/Auth-Go.
- [docs/product/P12_N2_MANAGEMENT_GO_NO_GO_ENTSCHEIDUNGSPAKET.md](docs/product/P12_N2_MANAGEMENT_GO_NO_GO_ENTSCHEIDUNGSPAKET.md) verdichtet Plan-11-Preflight, B24, PA7/PA8/PA9, B8/B9, P6/P7/P9/C8 und R4 in ein nicht-sensitives Management-Go/No-Go-Paket fuer Nutzerkreis, Betreiber, Zugriffskontext, Datenrahmen, Nachweis, Stop-Verantwortung und finale Bewertung; lokaler Preflight bleibt `go`, echter begrenzter Pilot bleibt bis zur bewussten Entscheidung `not assessed`, echte/produktive Daten bleiben `blocked`.
- [docs/product/C8_INTERNER_DEMO_DURCHLAUF_ABNAHMEWEG.md](docs/product/C8_INTERNER_DEMO_DURCHLAUF_ABNAHMEWEG.md) beschreibt den reproduzierbaren internen Demo-/Abnahmeweg ueber bestehende lokale Scripts, UI-Routen, Angebot-zu-Produktion-Handoff, Upload-/Warnanker, Exporte und Full Gates; er ist keine Produktionsfreigabe und keine rechtssichere Audit- oder Compliance-Aussage.
- [docs/product/C9_FEHLUPLOAD_ARCHIV_LOESCH_ENTSCHEIDUNG.md](docs/product/C9_FEHLUPLOAD_ARCHIV_LOESCH_ENTSCHEIDUNG.md) dokumentiert den nach Alexander-Go umgesetzten Fehlupload-Pfad: `POST /v1/intake/requests/:requestId/archive` markiert interne/synthetische Intake-Kontexte per Soft-Archiv; `/produktion` bietet dafuer beim fokussierten Intake-Kontext `Fehlupload archivieren`, filtert aktive Intake-Listen und haelt Detail-/Audit-Nachvollziehbarkeit ohne Hard-Delete, Retention-Freigabe oder echte-Daten-Go.

Die Web-App bietet Exportlinks fuer:

- Angebots-HTML
- Produktionsblatt-HTML
- Einkaufslisten-CSV
- einen sichtbaren Audit-Trail der letzten Operator-Aktionen

Die Rezeptbibliothek kann jetzt von beiden Agenten aus erweitert werden:

- `POST /v1/offers/recipes/upload` fuer Datei-Uploads ueber den Angebotsagenten
- `POST /v1/production/recipes/upload` fuer Datei-Uploads ueber den Produktionsagenten
- beide Pfade schreiben in dieselbe persistierte Rezeptbibliothek
- `.pages`-Rezeptdateien werden beim Import jetzt ueber Quick-Look-Preview-PDFs textlich ausgelesen
- fuer Tests und interne Automationen existieren zusaetzlich die JSON-Endpunkte `.../recipes/import-text`
- `PATCH /v1/offers/recipes/:recipeId/review` und `PATCH /v1/production/recipes/:recipeId/review` erlauben Freigabe, Verifizierung oder Ablehnung
- `review_required` und `rejected` Rezepte werden nicht still weiter als interne Kandidaten verwendet

Fuer einen Bulk-Import eures bestehenden Catering-Rezeptbestands:

```bash
npm run import:recipes:caterings -- "/Users/alexandersmyslowski/Library/Mobile Documents/com~apple~CloudDocs/Dateien/THE ONE von Alexander/Buchhaltung/Caterings"
```

Der Import scannt bevorzugt Rezeptdateien in `Rezepte`-Ordnern, bevorzugt PDF vor `.pages`, schreibt in dieselbe persistierte Rezeptbibliothek und verbessert dadurch direkt die internen Treffer fuer Agent 2.

Fuer frische Deployments stehen ausserdem Admin-Endpunkte bereit:

- `GET /health` auf Intake, Offer, Production und Export
- `POST /v1/intake/seed-demo`
- `POST /v1/offers/seed-demo`
- `POST /v1/production/seed-demo`
- `GET /v1/production/audit/events?limit=30` fuer den gemeinsamen Audit-Feed

Operator-Namen koennen im lokalen Dev-/Testbetrieb weiterhin ueber den Header `x-actor-name` mitgegeben werden.
Sobald `CATERING_TRUSTED_ACTOR_SECRET` gesetzt ist, zaehlt `x-actor-name` nicht mehr als Sicherheitskontext: Services akzeptieren Rollen dann nur aus dem Trusted-Proxy-Kontext `x-catering-actor-name` plus passendem `x-catering-trusted-secret`.
Die Backoffice-UI speichert den lokalen Operatornamen weiterhin lokal und sendet ihn bei mutierenden Dev-/Test-Aktionen automatisch mit; produktionsnah muss der Reverse Proxy die Trusted-Header setzen.
Die verbindlichen Proxy-/Deployment-Annahmen fuer Header-Stripping, Trusted-Header-Injektion, Secret-Setzung und Health-Grenzen sind in [docs/architecture/PA9_PROXY_DEPLOYMENT_READINESS_ADR.md](docs/architecture/PA9_PROXY_DEPLOYMENT_READINESS_ADR.md) dokumentiert.
Echte Login-, OIDC-/SSO- und Session-Mechanik bleibt bewusst offen und ist nicht Teil dieses Hardening-Blocks.

Die Web-App nutzt diese Pfade jetzt direkt fuer Service-Status und Demo-Befuellung.
Zusatzlich kann sie nun PDF-, TXT-, MD- und E-Mail-Dateien ueber den Intake-Pfad hochladen und daraus direkt `AcceptedEventSpec`-Datensaetze erzeugen.
Dokument-Uploads sind bewusst eng limitiert: Intake akzeptiert maximal 8 MiB pro Datei und bis zu 3 Dateien pro Multipart-Request; Rezeptuploads in Angebot und Produktion akzeptieren maximal 5 MiB und genau den vorhandenen Dokumentkorridor PDF/TXT/MD/EML/Pages mit passender MIME-/Extension-Kombination. Andere Dateitypen werden kontrolliert abgelehnt.
Angebotsvarianten koennen ausserdem direkt aus der UI in operative `AcceptedEventSpec`-Datensaetze promoted werden.
Unvollstaendige `AcceptedEventSpec`-Datensaetze lassen sich im Intake-Bereich nun direkt im Backoffice nachbearbeiten und erneut validieren.
Zusatzlich gibt es jetzt einen strukturierten manuellen Intake-Pfad, der ohne Freitext direkt ein `AcceptedEventSpec` aus Formularfeldern erzeugt.
Die Web-App zeigt ausserdem Detailansichten fuer Angebotsentwuerfe und Produktionsplaene, damit operative Inhalte direkt lesbar sind.
Bei Produktionslaeufen ist nun auch eine Suchspur je Gericht sichtbar: interne Kandidaten, ausgefuehrte Websuchen und Verwerfungsgruende werden direkt an der Rezeptauswahl angezeigt.

## Docker / Hetzner-MVP

Fuer einen zentralen Serverbetrieb liegt unter [platform-infra/README.md](platform-infra/README.md) eine Compose-Basis mit:

- PostgreSQL
- Intake-, Offer-, Production- und Export-Service
- Caddy-Web-Frontend mit Reverse-Proxy auf die APIs und optionaler automatischer HTTPS-Terminierung

Start:

```bash
cd platform-infra
cp .env.example .env
docker compose up --build -d
```

Fuer eine echte Hetzner-Domain wird in `platform-infra/.env` z. B. gesetzt:

```bash
CATERING_SITE_ADDRESS=app.example.com
CADDY_EMAIL=ops@example.com
HTTP_PORT=80
HTTPS_PORT=443
```

Danach ist die Web-App unter `https://app.example.com` vorgesehen.
Die getrennten Arbeitsflaechen liegen dann unter:

- `https://app.example.com/angebot`
- `https://app.example.com/produktion`

## Checkpoints

Einen reproduzierbaren Zwischenstand erzeugst du mit:

```bash
npm run checkpoint -- <kurzname>
```

Optional direkt mit Push:

```bash
npm run checkpoint -- <kurzname> --push
```

## Betrieb und Versionierung

- Deployment-Empfehlung fuer den MVP: Hetzner-VM als interne Plattform mit HTTPS-Reverse-Proxy, Web-App fuer Mitarbeiter und getrennten API-Services.
- Zugriff fuer Angebots-Ersteller und Kuechenplanung erfolgt ueber die interne Web-App, nicht direkt per Shell auf dem Server.
- Intake-, Angebots-, Produktions- und Rezeptdaten werden im MVP entweder dateibasiert oder ueber PostgreSQL persistiert und ueberstehen Server-Neustarts.
- Nutzeraktionen aus Intake, Angebot, Produktion und Rezept-Review landen in einem gemeinsamen Audit-Log und sind in der Web-App sichtbar.
- GitHub- und Checkpoint-Strategie siehe [docs/deployment-and-versioning.md](docs/deployment-and-versioning.md).
