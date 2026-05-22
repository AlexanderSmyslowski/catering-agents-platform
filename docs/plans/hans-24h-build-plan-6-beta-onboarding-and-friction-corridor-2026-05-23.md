# Hans 24h Build Plan 6 — Beta Onboarding and Friction Corridor 2026-05-23

> Zweck: Anschlussplan nach `hans-24h-build-plan-5-internal-usability-beta-2026-05-22.md`. Plan 5 hat den lokalen internen Beta-Korridor `Start -> Angebot -> Produktion -> Rueckfragen -> Exporte/Audit` gruen abgeschlossen. Plan 6 baut keinen neuen grossen Produktbereich, sondern macht den kontrollierten internen Beta-Durchlauf fuer Alexander und eine spaetere interne Testperson reproduzierbarer: Starten, Orientieren, Durchlaufen, Reibung notieren, Grenzen erkennen.

## Ausgangspunkt

Verifizierter Stand bei Planerstellung durch Frau Mueller:
- Repo: `/Users/alexandersmyslowski/Projects/catering-agents-platform`
- Branch: `main`
- HEAD/origin/main: `7c763a76da2c9acce00f67f7c00a1e2121cf9659` (`docs: snapshot plan5 full gates`)
- GitHub Actions CI: Run `26314851036`, `completed/success`
- Working tree: sauber gegen `origin/main`, nur bekanntes untracked `tmp/`; `tmp/` bleibt unberuehrt
- Plan 5: P5-B49 bis P5-B55 abgeschlossen, Full Gates gruen

## Management-Ziel

Plan 6 soll die App nicht weiter theoretisch polieren, sondern die naechste reale interne Beta-Handlung absichern:

1. Ein interner Nutzer kann lokal nachvollziehen: Wie starte ich, welchen Pfad teste ich, woran erkenne ich Erfolg, wo stoppe ich?
2. Die App und die repo-lokalen Unterlagen fuehren nicht in echte Daten, Deployment oder produktionsnahe Freigaben hinein.
3. Reibungspunkte werden strukturiert erfasst, damit der naechste Produktwertblock aus echtem Beta-Feedback statt Vermutung entsteht.
4. Verbesserungen bleiben klein, sichtbar und testbar.
5. Ziel ist ein kontrollierter synthetischer Beta-Durchlauf, nicht Produktion, Auth, echte Kunden, neue Persistenz oder Deployment.

## Absolute Guardrails

Nicht bauen:
- kein Deployment, keine SSH-Verbindung, keine Serveraenderung
- keine Secrets, keine produktive `.env`, keine Tokens, keine Connection Strings
- keine echten Personen-/Kunden-/Einsatzdaten
- keine neue Persistenzwelt, kein Prisma, keine Migration
- kein OAuth, Google Drive, Login, OIDC oder Session-System
- keine neue grosse API-Flaeche; vor groesserer API-Entscheidung stoppen
- kein LLM-/Tool-Use-/OCR-/Parser-Ausbau
- keine automatische Spec-Korrektur aus Rueckfragenantworten
- keine Rezept-/Allergenautomatik, keine rechtssichere Compliance-Behauptung
- keine Multi-Tenancy-, Plattform- oder White-Label-Erweiterung

Erlaubt:
- kleine UI-/Copy-/Status-Slices in bestehenden Routen `/`, `/angebot`, `/produktion`
- bestehende Services, Stores, Demo-/Seed-Daten und Shared-Core-Typen nutzen
- Vertragstests, jsdom-Smokes, lokale Status-/Check-Anker
- kleine Runbook-/Checklisten-/Friction-Log-Dokumente, wenn sie den Beta-Durchlauf reproduzierbarer machen
- Memory-/Snapshot-Fortschreibung bei relevantem Stand

## Arbeitsprinzip fuer den fortlaufenden Runner

- Kein Leerlauf: nach gruenem Cycle naechsten Cycle aus dieser Queue starten.
- Kein blindes Coden: nur diese Queue, keine erfundenen Features.
- Kleine Commits, maximal ein fachlicher Baustein pro Cycle.
- Jeder Cycle braucht messbaren Nutzen fuer interne Nutzbarkeit: bessere Orientierung, klarerer lokaler Start, reproduzierbarer Check, strukturierte Reibungserfassung oder klarere Nicht-Freigabe.
- Wenn CI rot: sofort CI-Fix-Cycle, kein Weiterbau.
- Wenn fachlich blockiert: Stop und Lagebericht, nicht auf Nebenfeatures ausweichen.
- Wenn ein Cycle eine API-/Persistenz-/Security-/Betriebsentscheidung erfordert, stoppt Hans und formuliert die Entscheidung.

## Queue R — Kontrollierter Beta-Onboarding-Korridor

### P6-B56 — Beta-Onboarding-Iststand und Lueckenkarte

Ziel:
Der vorhandene lokale Beta-Onboarding-Pfad wird repo-lokal kartiert: Was ist schon klar, welche Start-/Test-/Stop-Schritte sind verstreut, welche Reibung ist fuer einen internen Nutzer wahrscheinlich?

Arbeitsrichtung:
- `memory.md`, `HANDOFF_PROMPT.md`, `README.md`, `TESTING.md`, C8/B12, Plan 5 und die manuelle Checkliste lesen.
- Keine Produktlogik bauen, wenn zuerst eine klare Lueckenkarte fehlt.
- Wenn sinnvoll: kleiner Vertragstest oder Doku-Anker, der den fuehrenden Onboarding-Korridor benennt.

Akzeptanz:
- Es gibt einen auffindbaren Plan-/Doku-Anker fuer Starten -> Durchlaufen -> Reibung notieren -> Stop-Gates.
- Klar getrennt: intern testbar, nur synthetisch, blockiert, verboten.

### P6-B57 — Lokalen Start-/Status-Korridor fuer interne Beta pruefbarer machen

Ziel:
Ein interner Nutzer versteht vor dem Durchlauf, welche lokalen Services/URLs relevant sind und wie der Gesundheitszustand geprueft wird.

Arbeitsrichtung:
- `README.md`, `TESTING.md`, lokale Scripts (`local:status`, `local:check`) und vorhandene Health-/UI-Smokes pruefen.
- Minimaler Doku-/Test-/Copy-Slice, falls Start/Status nicht klar genug ist.
- Keine neue Betriebsplattform, keine Deployment- oder Serveraenderung.

Akzeptanz:
- Lokaler Beta-Start und Statuscheck sind eindeutig auffindbar.
- Tests oder Check-Anker schuetzen die wichtigsten Marker.

### P6-B58 — Reibungslog fuer manuellen Beta-Durchlauf strukturieren

Ziel:
Alexander oder eine interne Testperson kann Reibungspunkte einheitlich erfassen, ohne echte Daten einzutragen.

Arbeitsrichtung:
- Bestehende manuelle Checkliste und Produktdokumente pruefen.
- Eine kleine, sichere Friction-Log-Vorlage oder Checklisten-Erweiterung ergaenzen, falls nicht vorhanden.
- Keine externe QA-Plattform, keine Speicherung echter Nutzerdaten.

Akzeptanz:
- Vorlage trennt Beobachtung, Route, erwartetes Verhalten, tatsaechliches Verhalten, Schweregrad, Screenshot-Hinweis ohne personenbezogene Daten und naechste Entscheidung.
- Nicht-Freigaben und synthetische-Daten-Regel sind sichtbar.

### P6-B59 — UI-Grenzen fuer synthetischen Beta-Durchlauf schaerfen

Ziel:
Die bestehende UI macht an den relevanten Stellen klarer, dass der Durchlauf intern/synthetisch ist und nicht produktionsnah freigegeben ist.

Arbeitsrichtung:
- Bestehende Routen `/`, `/angebot`, `/produktion` und vorhandene Smoke-Tests pruefen.
- Minimaler UI-/Copy-Slice, falls die synthetische Beta-Grenze in der Nutzerfuehrung nicht ausreichend sichtbar ist.
- Keine neue Auth-, Daten- oder Freigabefunktion.

Akzeptanz:
- Sichtbare Marker verhindern Verwechslung mit echter Produktion.
- Smoke-/Acceptance-Test schuetzt die Marker.

### P6-B60 — Rueckfragen-/Produktions-Reibung aus Betasicht schaerfen

Ziel:
Im Beta-Durchlauf ist erkennbar, wann Rueckfragen/Produktionsobjekte ausreichend fuer den synthetischen Test sind und wann gestoppt werden muss.

Arbeitsrichtung:
- `/produktion`, Rueckfragen-Demos, Acceptance-Smokes und Audit-/Exportanker pruefen.
- Minimaler UI-/Doku-/Test-Slice, wenn der Stop-/Weiter-Punkt unklar ist.
- Keine automatische Spec-Korrektur, keine Rezept-/Allergenautomatik.

Akzeptanz:
- Der Nutzer erkennt: pruefbar, offen, blockiert, nicht freigegeben.
- Bestehende Produktions- und Auditanker bleiben fuehrend.

### P6-B61 — Beta-Durchlauf als Management-Entscheidungsvorlage verdichten

Ziel:
Nach dem Onboarding-Korridor gibt es eine knappe Entscheidungsvorlage: Was kann Alexander jetzt sinnvoll manuell testen, was sollte Hans danach nur anhand real beobachteter Reibung bauen?

Arbeitsrichtung:
- Plan-6-Ergebnisse, Reports, README/TESTING/Produktdocs zusammenziehen.
- Keine neue Produktlogik, wenn nur Verdichtung noetig ist.
- Memory/Snapshot nur fortschreiben, wenn ein relevanter Stand entstanden ist.

Akzeptanz:
- Entscheidungsvorlage trennt: sofort testbar, Stop-Gates, no-go, naechster enger Produktwertblock nach Feedback.
- Kein weiterer Mikroausbau wird empfohlen, wenn kein echter Nutzwert ohne Feedback bleibt.

### P6-B62 — Full Gates und Plan-6-Lage

Ziel:
Plan-6-Stand wird sauber verifiziert und als Management-Lage zusammengefasst: Wie beta-testbar ist die App lokal jetzt, welche Reibungsdaten fehlen, was ist der naechste sichere Hebel?

Pflichtchecks:
- fokussierte Tests je nach geaendertem Scope
- `npm test`
- `npm run build`
- `npm audit --omit=dev`
- `git diff --check`
- `npm run local:status` wenn lokale Services laufen oder im Cycle relevant
- `npm run local:check` wenn der Beta-Durchlauf betroffen ist und lokale Services laufen/kontrolliert startbar sind
- GitHub Actions CI nach Push pruefen, wenn `gh`/API verfuegbar ist

Akzeptanz:
- `memory.md` fortgeschrieben, falls relevanter Stand
- Snapshot unter `docs/agent-memory/`, falls relevanter Stand
- Lagebericht trennt: umgesetzt / intern testbar / offen / blockiert / Risiko / naechster Schritt
- Wenn ohne echtes manuelles Beta-Feedback kein weiterer sinnvoller Nutzwert bleibt, stoppt Hans mit Entscheidungsvorlage statt Scheinarbeit.

## Cycle-Prompt-Format fuer Hans

Jeder Plan-6-Cycle bekommt einen eigenen Prompt unter:

`/Users/alexandersmyslowski/.hermes/coordination/prompts/hans-24h-plan6-20260523-p6-bXX.md`

Der Prompt muss enthalten:
- aktueller HEAD und CI-Stand
- genau ein Cycle aus Plan 6
- harte Guardrails
- Pflichtkontext: `memory.md`, `HANDOFF_PROMPT.md`, `README.md`, dieser Plan, relevante Dateien
- Pflichtchecks und Reportpfad

Reportpfad je Cycle:

`/Users/alexandersmyslowski/.hermes/coordination/agent-reports/inbox/hans-24h-plan6-20260523-p6-bXX.md`

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
- eine groessere neue API-Flaeche erforderlich wird
- automatische Spec-Korrektur, Rezept-/Allergenlogik oder LLM-/Tool-Use noetig waere
- CI rot ist und nicht in einem engen CI-Fix-Cycle repariert werden kann
- nur noch Politur ohne messbaren Nutzwert oder ohne reales Beta-Feedback moeglich ist
- Plan 6 abgeschlossen ist

Dann schreibt Hans einen finalen Lagebericht und wartet auf Frau Mueller/Supervisor.
