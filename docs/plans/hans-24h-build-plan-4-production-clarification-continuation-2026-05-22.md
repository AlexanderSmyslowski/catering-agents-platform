# Hans 24h Build Plan 4 — Production Clarification Continuation 2026-05-22

> Zweck: Anschlussplan nach `hans-24h-build-plan-3-controlled-beta-2026-05-22.md`. Plan 3 hat die kontrollierte interne Beta-Strecke, lokale Demo-/Route-Smokes, Upload-/Echte-Daten-Gates und Full Gates bis `9c24c0f` gruen stabilisiert. Plan 4 nutzt diesen Stand fuer einen kleinen echten Produktwertblock in `/produktion`: strukturierte Rueckfragen-Fortsetzung und Antwortannahme innerhalb des bereits vorhandenen Clarification-Strangs — konservativ, testgetrieben, ohne Deployment, ohne echte Daten, ohne neue Persistenzwelt und ohne automatische Spec-Korrektur.

## Ausgangspunkt

Verifizierter Stand bei Planerstellung durch Frau Mueller:
- Repo: `/Users/alexandersmyslowski/Projects/catering-agents-platform`
- Branch: `main`
- HEAD/origin/main vor Plan-4-Commit: `9c24c0fd85e50ad3124b3ef64d72bca8a47ffa14` (`docs: snapshot plan3 full gates`)
- Letzte GitHub Actions CI via GitHub API: Run `26307942784`, Commit `9c24c0f`, `completed/success`
- Arbeitsbaum: sauber bis auf bekanntes untracked `tmp/`; `tmp/` bleibt unberuehrt
- Plan 3: P3-B31 bis P3-B40 abgeschlossen; P3-B40 war No-Change-/Entscheidungscycle mit Empfehlung fuer Produktwertblock `/produktion`

## Management-Ziel

Plan 4 soll aus dem bestehenden Rueckfragenmodell einen fuer interne Nutzer nachvollziehbaren Fortsetzungsstrang machen:

1. `/produktion` soll klar zeigen, welche Rueckfrage offen oder beantwortet ist.
2. Antworten sollen nur innerhalb der vorhandenen Clarification-/Session-/Spec-Bindung angenommen bzw. vorbereitet werden.
3. Beantwortete Rueckfragen sollen read-only im bestehenden Conversation-/Workbench-Fluss sichtbar bleiben.
4. Interne Testbarkeit soll steigen: synthetische Demo-/Fixture-Pfade, Contract-/Smoke-Tests und klare Stop-Gates.
5. Es entsteht kein produktionsnaher Betrieb, keine echte Kundendatenverarbeitung und keine automatische Fachableitung aus Antworten.

## Absolute Guardrails

Nicht bauen:
- kein Deployment, keine SSH-Verbindung, keine Serveraenderung
- keine Secrets, keine produktive `.env`, keine Tokens, keine Connection Strings
- keine neue Persistenzwelt, kein Prisma, keine Migration
- keine neue API-Flaeche ausser einem ausdruecklich minimalen, bestehenden Service-/Route-konformen Slice dieses Plans; vor groesserer API-Entscheidung stoppen
- kein OAuth, Google Drive, Login, OIDC
- kein LLM-/Tool-Use-/OCR-/Parser-Ausbau
- keine automatische Spec-Korrektur aus Rueckfragenantworten
- keine Rezept-/Allergenautomatik, keine rechtssichere Compliance-Behauptung
- keine Nutzung echter Personen-/Kunden-/Einsatzdaten

Erlaubt:
- Tests, kleine bestehende `shared-core`-/`production-service`-/Backoffice-UI-Slices
- Nutzung der bestehenden `ProductionClarificationQuestion`-/`ProductionClarificationAnswer`-/Session-Bindung
- bestehende PersistentCollection-Grenze, sofern bereits vorhanden und ohne neue Persistenzwelt
- kleine read-only UI-/Statusverbesserungen in `/produktion`
- synthetische Demo-Fixtures und nicht-sensitive Checklisten
- Memory-/Snapshot-Fortschreibung bei relevantem Stand

## Arbeitsprinzip fuer den fortlaufenden Runner

- Kein Leerlauf: nach gruenem Cycle naechsten Cycle aus dieser Queue starten.
- Kein blindes Coden: nur diese Queue, keine erfundenen Features.
- Kleine Commits, maximal ein fachlicher Baustein pro Cycle.
- Jeder Cycle braucht messbaren Nutzen: Testschutz, Antwortannahme-Sicherheit, UI-Verstaendlichkeit oder Demo-/Runbook-Faehigkeit.
- Wenn CI rot: sofort CI-Fix-Cycle, kein Weiterbau.
- Wenn fachlich blockiert: Stop und Lagebericht, nicht auf Nebenfeatures ausweichen.
- Wenn ein Cycle eine API-/Persistenz-/Security-/Betriebsentscheidung erfordert, stoppt Hans und formuliert die Entscheidung.

## Queue N — Clarification Answer Contract und Sicherheitsgrenzen

### P4-B41 — Antwortannahme-Iststand und Testanker schaerfen

Ziel:
Der bestehende Clarification-Answer-Stand ist exakt verstanden und regressionssicher: Was gilt als beantwortet, was bleibt unbeantwortet, welche Bindung schuetzt den Kontext?

Arbeitsrichtung:
- `shared-core/src/production-clarification.ts`, `shared-core/src/conversation-projection.ts` und vorhandene Tests lesen.
- Bestehende Tests fuer `submitted` vs. `draft`/`reviewed`, falsche `specId`, falsche Session und falschen Question-Key pruefen.
- Nur fehlenden Contract-Test ergaenzen; kein Produktcode, wenn der Contract bereits stabil ist.

Akzeptanz:
- Tests belegen: nur passende `submitted`-Antworten mit gleicher Frage, stabilem Key, `specId` und `production-session-${specId}` werden als beantwortet projiziert.
- Keine automatische Spec-Korrektur, keine API, keine UI-Pflicht.

### P4-B42 — Minimaler Answer-Draft/Submission-Pfad im bestehenden Service pruefen

Ziel:
Interne Antwortannahme wird nur so weit vorbereitet/abgesichert, wie sie in vorhandenen Service-Grenzen bereits angelegt ist.

Arbeitsrichtung:
- `production-service` und vorhandene Store-/Route-Tests auf Clarification-Answer-Support pruefen.
- Falls es bereits eine bestehende Store-Grenze fuer `production/clarification-answers` gibt: fokussierten Service-/Store-Test fuer sichere Annahme synthetischer Antworten ergaenzen.
- Falls eine neue API-Entscheidung noetig waere: nicht bauen, sondern BLOCKED mit minimaler Entscheidungsvorlage.

Akzeptanz:
- Entweder gruener Test fuer vorhandene Antwortannahme innerhalb bestehender Grenzen oder klarer Blocker: welche minimale API/Route waere noetig?
- Keine neue Persistenzwelt, keine Migration.

### P4-B43 — Malformed-/Safety-Grenzen fuer Antworten absichern

Ziel:
Fehlerhafte oder unsichere Antworten verschlechtern die Projektion nicht und spiegeln keine sensiblen Rohdaten.

Arbeitsrichtung:
- Tests fuer leere, zu lange, falsche Typen, falschen Kontext oder unerwartete Statuswerte pruefen/ergaenzen.
- Bestehende Sanitization/Normalization nutzen; keine neue Security-Plattform.

Akzeptanz:
- Malformed Answers bleiben ignoriert oder sicher sichtbar als nicht verwendbar.
- Keine Rohtext-/Hash-/PII-Leaks in UI-/Projection-Markern.

## Queue O — `/produktion` Rueckfragen-Fortsetzung nutzbar machen

### P4-B44 — Read-only Status in `/produktion` schaerfen

Ziel:
Interne Nutzer sehen in `/produktion` ruhig und eindeutig, welche Rueckfragen offen oder beantwortet sind.

Arbeitsrichtung:
- `backoffice-ui/src/production-workbench.tsx`, `backoffice-ui/src/App.tsx` und `tests/backoffice-production-acceptance-smoke.test.ts` lesen.
- Nur vorhandene Projektion/Props nutzen.
- Minimaler UI-/Copy-Fix plus Smoke-Test, wenn beantwortete Rueckfragen noch nicht eindeutig erkennbar sind.

Akzeptanz:
- `/produktion` zeigt Statusanker fuer offene und beantwortete Rueckfragen aus vorhandenen Daten.
- Kein freier Chat, keine LLM-Behauptung, keine automatische Schliessung.

### P4-B45 — Synthetischer beantworteter Rueckfragen-Demoanker

Ziel:
Der lokale interne Demo-/Beta-Durchlauf kann eine beantwortete Rueckfrage nachvollziehen, ohne echte Daten.

Arbeitsrichtung:
- vorhandene Demo-Fixtures/Seed-Daten und `tests/local-ops-check-contract.test.ts` pruefen.
- Wenn sinnvoll: synthetischen, nicht-sensitiven Answer-Fixture-Anker oder Testfixture ergaenzen.
- Keine realen Namen/Kunden/Einsatzdaten.

Akzeptanz:
- Ein Test oder Runbook-Anker belegt den Demo-Pfad fuer beantwortete Rueckfragen.
- `tmp/` bleibt unberuehrt.

### P4-B46 — Antwort-Fortsetzung im Conversation-Fluss pruefen

Ziel:
Die bestehende `ProductionConversationProjection` bleibt bei offenen, beantworteten und outputbezogenen Nachrichten geordnet und verstaendlich.

Arbeitsrichtung:
- Projektionstests fuer Reihenfolge und Labels pruefen/ergaenzen.
- Bestehende Message-Typen nutzen; keine neue Chat-/Agent-Runtime.

Akzeptanz:
- Offene Frage, passende Antwort und Output-Anker erscheinen deterministisch und verstaendlich.
- Keine neue Produktflaeche ausser vorhandener Projektion/UI.

## Queue P — Interne Abnahme und Abschluss

### P4-B47 — Interner synthetischer Beta-Durchlauf fuer Rueckfragen

Ziel:
Ein interner Nutzer kann lokal mit synthetischem Beispiel nachvollziehen: Rueckfrage sehen, Antwortstatus verstehen, Ergebnis-/Exportanker abgrenzen.

Arbeitsrichtung:
- `README.md`, `TESTING.md`, C8/B12-Dokumente und lokale Checks lesen.
- Dokumentation nur minimal korrigieren, wenn der neue Rueckfragen-Fortsetzungsstand sonst nicht reproduzierbar ist.
- `npm run local:status`/`local:check` nur kontrolliert, wenn lokale Services laufen oder der Cycle dies wirklich braucht.

Akzeptanz:
- Lokaler Rueckfragen-Demo-Korridor ist test-/dokumentationsseitig auffindbar.
- Produktiv-/echte-Daten-Nutzung bleibt geblockt.

### P4-B48 — Full Gates, Memory-Snapshot und naechster Nutzwertentscheid

Ziel:
Plan-4-Stand wird sauber verifiziert, versioniert und als Management-Lage zusammengefasst.

Pflichtchecks:
- fokussierte Tests je nach geaendertem Scope
- `npm test`
- `npm run build`
- `npm audit --omit=dev`
- `git diff --check`
- `npm run local:status` wenn lokale Services laufen oder im Cycle relevant
- GitHub Actions CI nach Push pruefen, wenn `gh`/API verfuegbar ist

Akzeptanz:
- `memory.md` fortgeschrieben, falls relevanter Stand
- Snapshot unter `docs/agent-memory/`, falls relevanter Stand
- harter Lagebericht: umgesetzt / offen / blockiert / Risiko / empfohlener naechster Schritt
- naechster Plan darf nur entstehen, wenn noch klarer Nutzwert innerhalb der Guardrails vorhanden ist

## Cycle-Prompt-Format fuer Hans

Jeder Plan-4-Cycle bekommt einen eigenen Prompt unter:

`/Users/alexandersmyslowski/.hermes/coordination/prompts/hans-24h-plan4-20260522-p4-bXX.md`

Der Prompt muss enthalten:
- aktueller HEAD und CI-Stand
- genau ein Cycle aus Plan 4
- harte Guardrails
- Pflichtkontext: `memory.md`, `HANDOFF_PROMPT.md`, `README.md`, dieser Plan, relevante Dateien
- Pflichtchecks und Reportpfad

Reportpfad je Cycle:

`/Users/alexandersmyslowski/.hermes/coordination/agent-reports/inbox/hans-24h-plan4-20260522-p4-bXX.md`

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
- eine neue Persistenzwelt, Migration, OAuth/Login oder produktionsnahe Security-Entscheidung notwendig wird
- eine neue API-Flaeche groesser als der explizit minimale, bestehende Service-konforme Slice erforderlich wird
- automatische Spec-Korrektur, Rezept-/Allergenlogik oder LLM-/Tool-Use noetig waere
- CI rot ist und nicht in einem engen CI-Fix-Cycle repariert werden kann
- kein messbarer Nutzwert mehr aus der Queue ableitbar ist
- Plan 4 abgeschlossen ist

Dann schreibt Hans einen finalen Lagebericht und wartet auf Frau Mueller/Supervisor.
