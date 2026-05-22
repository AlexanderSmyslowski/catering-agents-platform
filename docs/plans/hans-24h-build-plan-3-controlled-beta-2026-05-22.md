# Hans 24h Build Plan 3 — Controlled Internal Beta Readiness 2026-05-22

> Zweck: Anschlussplan nach `hans-24h-build-plan-2-internal-beta-2026-05-22.md` und den B25-B29 Hetzner-Preflight-Ankern. Alexander will weiter aktiven 24h-Betrieb, aber nicht noch mehr abstrakte Gate-Doku. Plan 3 verschiebt Hans wieder auf konkretere interne Beta-/Demo-Faehigkeit: aus bestehenden Daten, bestehenden Routen, bestehenden Tests und ohne Deployment.

## Ausgangspunkt

Verifizierter Stand bei Planerstellung:
- Repo: `/Users/alexandersmyslowski/Projects/catering-agents-platform`
- Branch: `main`
- HEAD/origin/main: `744fb17c9ed9d19181ac6ae42fbcb229ff6bbd32` (`docs: anchor hetzner operator questions preflight`)
- Letzte GitHub Actions CI: gruen, Run `26301854969`
- Arbeitsbaum: sauber bis auf bekanntes untracked `tmp/`; `tmp/` bleibt unberuehrt
- Aktiver 24h-Runner: `hans-24h-20260522-restart`, zuletzt `waiting_next_cycle`, naechster Cycle waere B30

## Management-Ziel

Plan 3 soll den Stand von "intern abnahmefaehig und gut dokumentiert" in Richtung "kontrolliert intern beta-testbar" bringen.

Das bedeutet:
1. Eine interne Person soll die App lokal reproduzierbar starten, pruefen und einen Demo-Durchlauf verstehen koennen.
2. Die wichtigsten bestehenden Nutzungsrouten sollen mit sichtbaren Status-/Fehler-/Exportankern stabil bleiben.
3. Hetzner bleibt Zielumgebung, aber Plan 3 fuehrt kein Deployment aus und fordert keine Secrets.
4. Wenn ein echter Pilot-/Produktionsentscheid noetig wird, stoppt Hans und formuliert die Entscheidung fuer Alexander.

## Arbeitsprinzip fuer weitere 24h

- Kein Leerlauf: nach gruenem Cycle naechsten Cycle aus dieser Queue starten.
- Kein blindes Coden: nur diese Queue, keine erfundenen Features.
- Kleine Commits, maximal ein fachlicher Baustein pro Cycle.
- Jeder Cycle braucht einen echten Nutzen: Testschutz, reproduzierbarer Ablauf, kleine UI-/Doku-Klarheit oder klare Stop-Entscheidung.
- Wenn CI rot: sofort CI-Fix-Cycle, kein Weiterbau.
- Wenn fachlich blockiert: Stop und Lagebericht, nicht auf Nebenfeatures ausweichen.
- Wenn ein Cycle nur weitere abstrakte Hetzner-Doku erzeugen wuerde: abbrechen und einen konkreteren internen Beta-Baustein waehlen.

## Absolute Guardrails

Nicht bauen:
- kein Deployment, keine SSH-Verbindung, keine Serveraenderung
- keine Secrets, keine produktive `.env`, keine Tokens, keine Connection Strings
- keine neue Persistenzwelt, kein Prisma, keine Migration
- keine neue API ohne ausdrueckliche Minimalfreigabe im konkreten Cycle
- kein OAuth, Google Drive, Login, OIDC
- kein LLM-/Tool-Use-/OCR-/Parser-Ausbau
- keine automatische Spec-Korrektur aus Rueckfragenantworten
- keine Rezept-/Allergenautomatik
- keine Plattform-/Multi-Tenant-/White-Label-Erweiterung
- keine rechtssichere Audit-, DSGVO- oder Compliance-Behauptung
- keine Nutzung echter Personen-/Kunden-/Einsatzdaten

Erlaubt:
- Tests, Dokumentation, lokale Betriebschecks
- kleine Bugfixes an bestehenden Pfaden
- kleine read-only UI-/Statusverbesserungen, wenn ein Test/Check einen echten Nutzbarkeits- oder Stabilitaetsmangel zeigt
- Demo-Fixtures, Beispielablauf und nicht-sensitive Checklisten
- Script-/Seed-/Check-Haertung fuer vorhandene lokale Verifikation
- Memory-/Snapshot-Fortschreibung bei relevanten Aenderungen

## Queue I — Planwechsel und B25-B29 sinnvoll abschliessen

### P3-B30 — Plan-3-Anker und Stop fuer weitere reine Hetzner-Doku

Ziel:
Plan 3 wird im Repo auffindbar und verhindert, dass Hans endlos weitere Hetzner-Preflight-Dokumente stapelt.

Arbeitsrichtung:
- `docs/plans/hans-24h-build-plan-3-controlled-beta-2026-05-22.md` lesen
- `TESTING.md` nur ergaenzen, wenn ein Contract-Test fuer den Plananker angelegt wird
- optional schmaler Doku-Vertragstest: Plan 3 muss Guardrails, Queues und Stop-Regel fuer weitere reine Hetzner-Doku enthalten

Akzeptanz:
- Plan 3 ist auffindbar
- weitere Hetzner-Doku ohne konkrete Entscheidung/Antwort ist out of scope
- kein Produktcode noetig

### P3-B31 — B25-B29 in eine kurze Management-Entscheidungsliste verdichten

Ziel:
Alexander bekommt aus B25-B29 eine kurze, nicht-sensitive Entscheidungsliste statt fuenf einzelner Dokuanker.

Arbeitsrichtung:
- B25-B29-Dokumente lesen
- neues kurzes Dokument unter `docs/product/` oder `docs/deployment/` nur wenn noetig
- keine neuen Fragen erfinden; nur verdichten: Betreiber, Zugriffsschicht, TLS/Health, Stop/Rollback, Daten/PII/Retention/Backup, Sandbox/Worker/AV

Akzeptanz:
- klare Statuswerte: `go`, `blocked`, `not assessed`
- keine Secrets, keine Serverdetails
- Produktiv-/Pilotstatus bleibt `blocked`, solange eine Mussgruppe offen ist

## Queue J — Reproduzierbarer interner Beta-Durchlauf lokal

### P3-B32 — Lokalen Demo-Durchlauf als kompakte Runbook-Route pruefen

Ziel:
Eine interne Person kann lokal nachvollziehen: starten, Status pruefen, Demo-Daten sehen, Angebot/Produktion/Export pruefen, stoppen.

Arbeitsrichtung:
- `README.md`, `TESTING.md`, `scripts/start-local-stack.sh`, `scripts/status-local-stack.sh`, `scripts/check-local-ops.sh` lesen
- bestehende Commands nicht neu erfinden
- falls Doku auseinanderlaeuft: korrigieren
- wenn moeglich Contract-Test fuer genannte Commands/Scripts/Routen

Akzeptanz:
- `npm run local:start`, `npm run local:status`, `npm run local:check`, `npm run local:stop` sind in ihrer Rolle klar eingeordnet
- keine Behauptung, dass lokaler Gruenstatus produktionsnahe Freigabe ist

### P3-B33 — Demo-Fixture-/Seed-Erwartung stabilisieren

Ziel:
Der lokale Demo-Durchlauf ist nicht nur dokumentiert, sondern seine erwarteten sichtbaren Demo-Anker sind testbar.

Arbeitsrichtung:
- vorhandene Seed-/Demo-Daten und lokale Checks lesen
- bestehende Testdateien bevorzugen: `tests/local-ops-check-contract.test.ts`, `tests/backoffice-internal-usage-smoke.test.ts`, `tests/backoffice-route-smoke.test.ts`
- Test nur fuer vorhandene Demo-Anker; Code-Fix nur bei echter Drift

Akzeptanz:
- Demo-Anker fuer Start, Intake/Request, Angebot, Produktion und Export sind test-/dokumentationsseitig auffindbar
- keine neuen Beispieldaten mit echten Personen/Kunden

## Queue K — Bestehende Beta-Nutzungsroute stabilisieren

### P3-B34 — Startseite als Beta-Kontrollzentrum pruefen

Ziel:
Die Startuebersicht zeigt fuer interne Beta-Pruefung die wichtigsten vorhandenen Statusanker ruhig und verstaendlich.

Arbeitsrichtung:
- `backoffice-ui/src/App.tsx` und vorhandene Startseiten-Smokes lesen
- pruefen, ob Startseite vorhandene Demo-/Audit-/Intake-/Offer-/Production-/Exportanker sichtbar macht
- minimaler UI-/Copy-Fix nur bei echter Luecke

Akzeptanz:
- kein neues Dashboard-Konzept
- vorhandene Daten, vorhandene Routen
- Smoke-Test schuetzt zentrale Marker

### P3-B35 — Angebot-Route fuer Beta-Durchlauf pruefen

Ziel:
`/angebot` ist als bestehender interner Schritt im Demo-/Beta-Durchlauf verstaendlich.

Arbeitsrichtung:
- `tests/backoffice-route-smoke.test.ts`, `tests/backoffice-api.test.ts`, Offer-UI lesen
- pruefen: Anfrage-/Spec-Bezug, Angebotsentwurf/status, Exportanker, Uebergabeanker
- minimaler Fix nur, wenn vorhandener Marker fehlt oder irrefuehrend ist

Akzeptanz:
- keine neue Angebotslogik
- keine neue API
- keine automatische Spec-Korrektur

### P3-B36 — Produktion-Route fuer Beta-Durchlauf pruefen

Ziel:
`/produktion` bleibt als bestehende interne Workbench fuer Produktion, Einkaufsliste, Exporte, Herkunft und offene Rueckfragen stabil.

Arbeitsrichtung:
- `tests/backoffice-production-acceptance-smoke.test.ts`, `tests/backoffice-route-smoke.test.ts`, `production-service`-Tests lesen
- nur vorhandene Status-/Export-/Herkunftsanker absichern
- minimaler Copy-/Marker-Fix nur bei echter Luecke

Akzeptanz:
- kein neuer Produktionsworkflow
- keine Rezept-/Allergenautomatik
- keine neue Persistenz

## Queue L — Upload-/Import-/Dateigrenzen fuer interne Beta

### P3-B37 — Upload-Grenzen als Beta-Risiko sichtbar machen

Ziel:
Interne Beta-Nutzer verstehen, welche Uploads erlaubt/abgewiesen werden und dass echte Dateiverarbeitung ohne Sandbox/AV-Gate blockiert bleibt.

Arbeitsrichtung:
- `tests/upload-security.test.ts`, `tests/document-ingestion-boundary.test.ts`, `tests/pa14-document-ingestion-corridor-readiness.test.ts` lesen
- bestehende Limit-/MIME-/Warnungslogik testseitig/dokumentarisch pruefen
- keine neue Parser-/OCR-/LLM-Engine

Akzeptanz:
- zu grosse/unerlaubte Dateien bleiben abgewiesen
- erlaubte Demo-Dateien laufen weiter
- Warnungen sind sicher, ohne Rohtext-/Hash-Leaks

### P3-B38 — Echte-Daten-Stop-Gate im Beta-Runbook verankern

Ziel:
Der interne Beta-Korridor trennt Demo-/synthetische Daten klar von echten Personen-/Kunden-/Einsatzdaten.

Arbeitsrichtung:
- B13 PII/Retention/Backup-Gate und B14 Sandbox/Worker/AV-Gate mit lokalem Beta-Runbook abgleichen
- Contract-Test nur wenn bestehende Doku-Anker driftanfaellig sind

Akzeptanz:
- echte Daten bleiben `blocked`, solange PII/Retention/Backup und Sandbox/AV nicht entschieden sind
- kein Compliance-Freibrief

## Queue M — Abschluss, Werturteil und naechster Produktblock

### P3-B39 — Full Gates und Status-Snapshot

Ziel:
Plan-3-Zwischenstand wird sauber verifiziert und versioniert.

Pflichtchecks:
- fokussierte Tests je nach geaendertem Scope
- `npm test`
- `npm run build`
- `npm audit --omit=dev`
- `git diff --check`
- `npm run local:status` wenn lokale Services laufen oder im Cycle relevant
- `npm run local:check` nur kontrolliert, wenn der Cycle lokale Stack-Arbeit betrifft

Akzeptanz:
- `memory.md` fortgeschrieben, falls relevanter Stand
- Snapshot unter `docs/agent-memory/`, falls relevanter Stand
- CI nach Push geprueft, wenn `gh`/Auth verfuegbar; sonst Report nennt CI-Verifikationsgrenze

### P3-B40 — Entscheidung: weiter Beta-Haertung oder echter Produktwertblock

Ziel:
Hans erzeugt keine Endlos-Politur. Nach Plan 3 muss Alexander entscheiden, ob weiter Beta-Haertung oder ein echter Produktwertblock folgt.

Moegliche Entscheidungsvorlagen:
- kontrollierter interner Beta-Test mit einem synthetischen Eventbeispiel
- strukturierte Antwortannahme/Rueckfragen-Fortsetzung in `/produktion`
- Angebots-/Produktionsuebergabe fachlich tiefer machen
- Setup-/Onboarding-Korridor fuer nicht-technische interne Nutzer
- Hetzner-Preflight mit echten nicht-sensitiven Antworten ausfuellen

Akzeptanz:
- keine Umsetzung dieser Kandidaten ohne neuen Plan oder explizite Freigabe
- harter Lagebericht: umgesetzt / offen / blockiert / Risiko / empfohlener naechster Schritt

## Cycle-Prompt-Format fuer Hans

Jeder Plan-3-Cycle bekommt einen eigenen Prompt unter:

`/Users/alexandersmyslowski/.hermes/coordination/prompts/hans-24h-plan3-20260522-p3-bXX.md`

Der Prompt muss enthalten:
- aktueller HEAD und CI-Stand
- genau ein Cycle aus Plan 3
- harte Guardrails
- Pflichtkontext: `memory.md`, `HANDOFF_PROMPT.md`, `README.md`, dieser Plan, relevante Dateien
- Pflichtchecks und Reportpfad

Reportpfad je Cycle:

`/Users/alexandersmyslowski/.hermes/coordination/agent-reports/inbox/hans-24h-plan3-20260522-p3-bXX.md`

Jeder Bericht enthaelt:
- Kurzstatus
- Erledigt
- RED/GREEN oder No-Change-Begruendung
- geaenderte Dateien
- Checks
- Commit/Push/CI
- Offen/Blocker
- Entscheidung fuer Alexander
- naechster sinnvoller Schritt

## Stop-Regel

Hans stoppt statt weiterzubauen, wenn:
- ein Cycle Deployment, SSH, Secrets oder Serverzugriff erfordert
- echte Daten benoetigt werden
- eine neue API/Persistenz/Architekturentscheidung notwendig wird
- CI rot ist und nicht in einem engen CI-Fix-Cycle repariert werden kann
- kein echter Nutzwert mehr aus der Queue ableitbar ist
- Plan 3 abgeschlossen ist

Dann schreibt Hans einen finalen Lagebericht und wartet auf Frau Mueller/Alexander.
