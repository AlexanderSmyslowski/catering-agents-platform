# Hans Continuous Build Plan 2026-05-22

> Zweck: Alexander will, dass Hans ohne Leerlauf weiterarbeitet, aber weiterhin innerhalb klarer Guardrails. Dieser Plan ist die naechste freigegebene Arbeitsqueue nach dem abgeschlossenen `hans-day-build-plan-2026-05-22.md`.

## Fuehrender Stand

Ausgangspunkt:
- letzter gruener HEAD: `094b493353ef7181fbc89c80ae60dd70946e3c69` (`docs: update production workbench build status`)
- Hans Day Build 2026-05-22 abgeschlossen: PA26-PA31 plus CI-Fix und PA32 gruen
- `/produktion` ist als interne Workbench deutlich nutzbarer
- offene Betriebsbeobachtung aus PA32: `npm run local:check` ist lokal nicht voll gruen, weil der erwartete `production.seed_demo`-Auditbeleg im lokalen Auditfenster fehlt bzw. Seed-/Auditdatenstand nicht robust genug fuer den Check ist

## Arbeitsprinzip fuer 24h-Betrieb

- Kein Leerlauf: wenn ein Cycle gruen abgeschlossen ist, naechsten Cycle aus dieser Queue starten.
- Kein blindes Coden: nur diese Queue, keine erfundenen Features.
- Kleine Commits, jeweils mit Tests/Build/CI.
- Wenn CI rot: sofort Fix-Cycle, kein Weiterbau.
- Wenn ein Cycle fachlich blockiert: Stop und Lagebericht, nicht ausweichen.
- `tmp/` bleibt unberuehrt.

## Absolute Guardrails

Nicht bauen:
- keine neue Persistenzwelt, kein Prisma, keine Migration
- keine neue API ohne ausdruecklich im Cycle erlaubten Minimalpfad
- kein LLM-/Tool-Use-/OCR-/Parser-Ausbau
- keine automatische Spec-Korrektur aus Rueckfragenantworten
- keine Allergenautomatik
- keine Rezeptgenerierung oder neue Rezeptskalierungslogik
- kein OAuth, Google Drive, Login, OIDC
- keine rechtssichere Audit-Behauptung
- keine Plattform-/Multi-Tenant-/White-Label-Erweiterung

Erlaubt:
- Tests, Dokumentation, lokale Betriebschecks
- kleine Bugfixes an bestehenden Pfaden
- kleine read-only UI-/Statusverbesserungen nur, wenn ein Test/Check einen echten Nutzbarkeits- oder Stabilitaetsmangel zeigt
- kleine Script-/Seed-/Check-Haertung, wenn sie bestehende lokale Verifikation reproduzierbarer macht

## Queue A — Betriebscheck und Seed-/Audit-Robustheit

### C1 — local:check Auditbeleg reproduzierbar machen

Ziel:
`npm run local:check` soll auf einem kontrolliert gestarteten lokalen Stack reproduzierbar gruen werden oder eine fachlich korrekte, deterministische Nicht-Gruen-Ursache melden.

Arbeitsrichtung:
- `scripts/check-local-ops.sh`, `scripts/start-local-stack.sh`, Seed-/Auditpfade lesen
- Fehler lokal reproduzieren
- klaeren, ob der erwartete `production.seed_demo`-Beleg wirklich erzeugt werden muss oder ob das Auditfenster/Timing zu eng ist
- minimal fixen: Seed-/Check-Logik, nicht Produktlogik

Akzeptanz:
- `npm run local:start` nur wenn noetig und kontrolliert
- `npm run local:status` gruen
- `npm run local:check` gruen oder bewusst robuster mit klarer, testbarer Erwartung
- `npm test`, `npm run build`, `npm audit --omit=dev`, `git diff --check` gruen

Stop-Gates:
- keine grossen Service-Refactorings
- kein neues Auditmodell
- keine neue Persistenz

### C2 — local:check als CI-unabhaengigen Betriebsbeleg dokumentieren und testen

Ziel:
Der lokale Check ist als Operationsbeleg lesbar, ohne falsche CI- oder Produktionsbehauptung.

Arbeitsrichtung:
- falls C1 Code/Scripts angepasst hat: fokussierten Test fuer Check-/Seed-Annahme ergaenzen
- `TESTING.md` und `memory.md` knapp fortschreiben
- neuen Snapshot unter `docs/agent-memory/` anlegen

Akzeptanz:
- Doku sagt klar: local:status vs local:check
- kein Anspruch auf externe Produktionsreife
- Full Gates gruen

## Queue B — Angebot-Workbench als naechster echter Nutzungsengpass

Begruendung:
Nach `/produktion` ist der naechste Nutzungsengpass nicht weiterer Produktions-Polish, sondern der End-to-End-Nutzfluss von Anfrage/Angebot zu Produktion. `/angebot` darf nicht gross umgebaut werden, aber vorhandene Workbench-Sicht kann testseitig und minimal nutzbarer stabilisiert werden.

### C3 — Angebot-Happy-Path als interner UI-Smoke

Ziel:
Ein realistisch interner Angebotsfluss ist als jsdom-Smoke abgesichert: Anfrage anlegen/sehen, Angebotsentwurf/Status, Uebergabe-/Exportanker.

Arbeitsrichtung:
- bestehende `tests/backoffice-route-smoke.test.ts`, Angebots-UI und Offer-Service-Tests lesen
- neuen fokussierten Smoke oder Erweiterung bestehender Smoke-Testdatei
- Code-Fix nur, wenn der Test einen echten Marker-/Nutzbarkeitsbug zeigt

Akzeptanz:
- `/angebot` zentrale Frage/Eingabe sichtbar
- Angebotsentwurf/Status sichtbar
- Uebergabe/Audit/Exportanker sichtbar, soweit vorhandene Daten da sind
- kein Umbau der Angebotslogik

### C4 — Angebot zu Produktion: Uebergabeanker pruefbarer machen

Ziel:
Der bestehende Uebergabepfad von Angebot/Spec zur Produktion ist fuer interne Nutzung nachvollziehbarer und regressionsgeschuetzt.

Arbeitsrichtung:
- bestehende Intake-/Offer-/Production-E2E-Tests lesen
- Test fuer vorhandene Spec-/Request-/Exportanker zwischen `/angebot` und `/produktion`
- minimale UI-/Copy-Korrektur nur, wenn Marker fehlen

Akzeptanz:
- keine neue API
- keine automatische Spec-Korrektur
- keine neue Persistenz
- E2E-/Smoke-Test gruen

## Queue C — Read-path/Auth- und Export-Regressionen fuer interne Nutzbarkeit

### C5 — Exportlinks mit Trusted-Actor-Kontext absichern

Ziel:
Die heute sichtbaren Exportlinks bleiben unter Trusted-Actor-/Read-path-Auth-Annahmen testbar und brechen nicht bei UI-/Route-Aenderungen.

Arbeitsrichtung:
- `tests/pa8-read-path-auth.test.ts`, `tests/backoffice-api.test.ts`, Print-Export-Pfade lesen
- fehlende Regression nur fuer vorhandene Exportpfade ergaenzen

Akzeptanz:
- Angebot-, Produktionsblatt- und Einkaufsexporte read-only geschuetzt
- Health bleibt offen
- keine OIDC-/Login-Implementierung

### C6 — Upload-/Import-Pfade im Workbench-Kontext stabilisieren

Ziel:
Bestehende Upload-/Import-Pfade fuer Intake/Offer/Production bleiben mit Limit-/MIME-/Warnungslogik im UI-/Servicekontext pruefbar.

Arbeitsrichtung:
- `tests/upload-security.test.ts`, DocumentIngestion-Tests, UI-Dateianker lesen
- Regression nur dort ergaenzen, wo heutige Workbench-Zonen sonst driftanfaellig sind

Akzeptanz:
- zu grosse/unerlaubte Dateien bleiben abgewehrt
- erlaubte Demo-Dateien laufen weiter
- Warnungen werden sicher angezeigt
- keine neue Parser-/OCR-Engine

## Queue D — Interne Bedienbarkeit ohne neue Featurewelt

### C7 — Leer-/Fehlerzustaende fuer interne Nutzung schaerfen

Ziel:
Die wichtigsten leeren oder fehlerhaften Zustaende in `/angebot` und `/produktion` sind fuer interne Nutzer verstaendlich statt still/technisch.

Arbeitsrichtung:
- nur bestehende Fehler-/Leerzustaende sichtbar machen oder testen
- keine neue Recovery-Plattform

Akzeptanz:
- leere Datenbestaende, fehlender Plan, fehlende Einkaufsliste, fehlender Export sind ruhig erklaert
- Tests sichern Marker

### C8 — Interner Demo-Durchlauf als dokumentierter Abnahmeweg

Ziel:
Ein interner Demo-Durchlauf ist als Schrittfolge dokumentiert und mit bestehenden Smokes/Gates verknuepft.

Arbeitsrichtung:
- keine Featureimplementierung
- `TESTING.md` / kleine Doku unter `docs/product/` nur falls sinnvoll
- Bezug auf bestehende Tests, local:status/check, Exportlinks

Akzeptanz:
- neuer Nutzer/Hans kann Demo-Durchlauf reproduzieren
- klare Grenzen: intern, nicht extern, nicht rechtssicher

## Queue E — Abschluss und naechste Planung

### C9 — Full Gates und Memory-Snapshot

Ziel:
Nach den Arbeitsbloecken wird der Stand dokumentiert, versioniert und remote/CI-verifiziert.

Akzeptanz:
- `npm test`
- `npm run build`
- `npm audit --omit=dev`
- `git diff --check`
- `npm run local:status`
- wenn lokale Services laufen und C1 erfolgreich war: `npm run local:check`
- `memory.md`, `TESTING.md` falls relevant, Snapshot unter `docs/agent-memory/`

### C10 — Stop oder neuer Plan

Wenn C1-C9 abgeschlossen sind:
- keine neuen Features erfinden
- finalen Lagebericht schreiben
- Frau Mueller muss naechsten Build-Plan erstellen

## Lageberichte

Jeder Cycle schreibt nach Abschluss:
`/Users/alexandersmyslowski/.hermes/coordination/agent-reports/inbox/hans-continuous-build-20260522-CYCLE.md`

Beispiele:
- `hans-continuous-build-20260522-c01.md`
- `hans-continuous-build-20260522-c02.md`

Jeder Bericht enthaelt:
- Cycle
- Root Cause / Umsetzung
- geaenderte Dateien
- Tests/Build/Audit/local status
- Commit SHA
- Push/Remote/CI
- Risiken
- naechster Cycle
