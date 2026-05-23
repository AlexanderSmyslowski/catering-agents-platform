# Hans 24h Build Plan 7 — Guided Beta Rehearsal Evidence Pack 2026-05-23

> Zweck: Anschlussplan nach `hans-24h-build-plan-6-beta-onboarding-and-friction-corridor-2026-05-23.md`. Plan 6 hat den lokalen synthetischen Beta-Korridor technisch und CI-seitig gruen abgeschlossen, aber noch keine echten manuellen Reibungsdaten erzeugt. Plan 7 baut deshalb keinen neuen grossen Produktbereich. Er soll den ersten kontrollierten manuellen Durchlauf so vorbereiten, dass Alexander oder eine interne Testperson ihn ohne echte Daten, ohne Deployment und ohne Produktionsfreigabe reproduzierbar ausfuehren, Evidenz sammeln und anschliessend priorisieren kann.

## Ausgangspunkt

Verifizierter Stand bei Planerstellung durch Frau Mueller:
- Repo: `/Users/alexandersmyslowski/Projects/catering-agents-platform`
- Branch: `main`
- HEAD/origin/main: `85555901cc33a49a0854435184859dbad9ce363f` (`docs: snapshot plan6 full gates`)
- GitHub Actions CI: Run `26317598240`, `completed/success`
- Working tree: sauber gegen `origin/main`, nur bekanntes untracked `tmp/`; `tmp/` bleibt unberuehrt
- Plan 6: P6-B56 bis P6-B62 abgeschlossen, Full Gates gruen

## Management-Ziel

Plan 7 soll aus dem technisch gruenen Beta-Korridor einen gefuehrten, auswertbaren Beta-Rehearsal-Korridor machen:

1. Ein interner Reviewer weiss vor dem Start, welche fiktive Testrolle und welches synthetische Szenario genutzt wird.
2. Der Durchlauf erzeugt verwertbare Evidenz: beobachtete Route, erwartetes Ergebnis, tatsaechliche Reibung, Export-/Auditbeleg, Stop-Grund.
3. Beobachtungen lassen sich nach dem Durchlauf in eine kleine Priorisierung uebersetzen: sofort beheben, spaeter, Entscheidung erforderlich, out of scope.
4. Die App und Doku fuehren weiterhin nicht in echte Daten, Deployment, Auth, Persistenz- oder API-Entscheidungen.
5. Jeder Cycle liefert messbaren Nutzwert fuer den ersten manuellen Test — keine Endlos-Politur.

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
- kleine Doku-/Runbook-/Checklisten-/Template-Slices, wenn sie den ersten manuellen Beta-Rehearsal-Durchlauf direkt vereinfachen
- kleine UI-/Copy-/Status-Slices in bestehenden Routen `/`, `/angebot`, `/produktion`, nur wenn ein konkreter Reviewer-Orientierungsnutzen entsteht
- Vertragstests/jsdom-Smokes fuer neue Anker und bestehende Marker
- bestehende Services, Stores, Demo-/Seed-Daten und Shared-Core-Typen nutzen
- Memory-/Snapshot-Fortschreibung bei relevantem Stand

## Arbeitsprinzip fuer den fortlaufenden Runner

- Kein Leerlauf: nach gruenem Cycle naechsten Cycle aus dieser Queue starten.
- Kein blindes Coden: nur diese Queue, keine erfundenen Features.
- Kleine Commits, maximal ein fachlicher Baustein pro Cycle.
- Jeder Cycle braucht messbaren Nutzen fuer den ersten manuellen synthetischen Beta-Rehearsal-Durchlauf.
- Wenn CI rot: sofort CI-Fix-Cycle, kein Weiterbau.
- Wenn ohne echte Beta-Beobachtung kein weiterer Nutzwert bleibt: Stop mit Entscheidungsvorlage, nicht Scheinarbeit.
- Wenn ein Cycle eine API-/Persistenz-/Security-/Betriebsentscheidung erfordert: Stop und Entscheidungsvorlage.

## Queue S — Gefuehrter Beta-Rehearsal- und Evidenzkorridor

### P7-B63 — Reviewer-Rehearsal-Startkarte

Ziel:
Ein interner Reviewer kann vor dem Start erkennen: Rolle, synthetisches Ziel, erlaubte Daten, Stop-Gates, fuehrender Pfad `Start -> Angebot -> Produktion -> Rueckfragen -> Exporte/Audit`.

Arbeitsrichtung:
- Plan-6-Unterlagen, `README.md`, `TESTING.md`, P5-Checkliste und P6-Entscheidungsvorlage pruefen.
- Einen kleinen, auffindbaren Startkarten-/Runbook-Anker schaffen oder vorhandene Unterlage gezielt erweitern.
- Keine Produktlogik, wenn ein Doku-/Vertragstest-Anker genuegt.

Akzeptanz:
- Reviewer-Startkarte ist auffindbar und trennt synthetisch/testbar/blockiert/verboten.
- Ein Test oder Doku-Contract schuetzt die wichtigsten Marker.

### P7-B64 — Synthetische Szenario- und Datenkarte

Ziel:
Der manuelle Durchlauf nutzt ein klar fiktives Szenario, ohne echte Kunden-, Personen- oder Einsatzdaten zu erfassen.

Arbeitsrichtung:
- Vorhandene Seed-/Demo-Erwartungsanker und Friction-Log-Vorlage pruefen.
- Eine kleine Szenariokarte oder Checklisten-Erweiterung erstellen, die Beispielnamen/Orte/Zeiten als eindeutig fiktiv markiert.
- Keine neue Seed-Daten-Quelle, keine Persistenz- oder Datenmodell-Aenderung.

Akzeptanz:
- Reviewer weiss, welche synthetischen Angaben erlaubt sind und welche Daten nicht eingetragen werden duerfen.
- Schutzanker verhindern Verwechslung mit echter Nutzung.

### P7-B65 — Evidenzpaket fuer Export/Audit/Route

Ziel:
Der Reviewer kann am Ende belegen, was geprueft wurde: besuchte Route, sichtbarer Erfolg/Fehler, Export-/Auditbeleg, Screenshot-Hinweis ohne PII.

Arbeitsrichtung:
- P6-Reibungslog, lokale Check-Scripts, Export-/Audit-Anker und relevante Tests pruefen.
- Kleine Evidence-Checklist oder Vorlage ergaenzen.
- Keine externe Ablage, kein Upload, keine echten Dateien mit personenbezogenen Daten.

Akzeptanz:
- Evidenzpunkte sind strukturiert: Route, Erwartung, Beobachtung, Beleg, Reibung, naechste Entscheidung.
- Export/Audit bleibt read-only bzw. bestehend; keine neue Betriebsintegration.

### P7-B66 — Reviewer-Orientierung in der UI pruefen und minimal schaerfen

Ziel:
Falls die bestehende UI den Reviewer an einer zentralen Stelle nicht sicher durch den synthetischen Korridor fuehrt, wird ein minimaler Copy-/Marker-Slice in bestehenden Routen umgesetzt.

Arbeitsrichtung:
- `/`, `/angebot`, `/produktion` gegen P7-Start-/Szenario-/Evidenzkarten pruefen.
- Nur bauen, wenn ein konkreter Orientierungsbruch sichtbar ist; sonst No-Product-Change mit Begruendung.
- Bestehende Smoke-/Acceptance-Tests anpassen oder ergaenzen.

Akzeptanz:
- UI-Marker helfen beim synthetischen Durchlauf und verhindern Produktionsmissverstaendnis.
- Kein neuer Workflow, keine API, keine Persistenz.

### P7-B67 — Reibung-zu-Backlog-Triage

Ziel:
Nach dem manuellen Durchlauf kann Frau Mueller/Hans aus Beobachtungen den naechsten kleinsten sicheren Produktwertblock ableiten.

Arbeitsrichtung:
- P6-Managementvorlage, Reibungslog und neue P7-Evidenzanker zusammenfuehren.
- Eine kleine Triage-Matrix schaffen: sofort kleiner Fix, spaeter, Entscheidung noetig, out of scope/verboten.
- Keine Produktlogik, wenn die Priorisierungsvorlage genuegt.

Akzeptanz:
- Beobachtete Reibung fuehrt zu klarer naechster Handlung statt unsortierter Wunschliste.
- Entscheidungs-/Guardrail-Themen werden sauber separiert.

### P7-B68 — Full Gates und Plan-7-Lage

Ziel:
Plan 7 wird voll verifiziert und als Management-Lage abgeschlossen: Was kann jetzt manuell geprobt werden, welche Evidenz wird erwartet, was darf Hans danach nur anhand beobachteter Reibung bauen?

Pflichtchecks:
- fokussierte Tests je nach geaendertem Scope
- `npm test`
- `npm run build`
- `npm audit --omit=dev`
- `git diff --check`
- `npm run local:status` wenn lokale Services laufen oder im Cycle relevant
- `npm run local:check` wenn der Beta-Rehearsal-Korridor betroffen ist und lokale Services laufen/kontrolliert startbar sind
- GitHub Actions CI nach Push pruefen, wenn gh/API verfuegbar ist

Akzeptanz:
- `memory.md` fortgeschrieben, falls relevanter Stand
- Snapshot unter `docs/agent-memory/`, falls relevanter Stand
- Lagebericht trennt: umgesetzt / intern rehearsable / offen / blockiert / Risiko / naechster Schritt
- Wenn ohne echten manuellen Durchlauf kein weiterer sinnvoller Nutzwert bleibt, stoppt Hans mit Entscheidungsvorlage statt Scheinarbeit.

## Cycle-Prompt-Format fuer Hans

Jeder Plan-7-Cycle bekommt einen eigenen Prompt unter:

`/Users/alexandersmyslowski/.hermes/coordination/prompts/hans-24h-plan7-20260523-p7-bXX.md`

Der Prompt muss enthalten:
- aktueller HEAD und CI-Stand
- genau ein Cycle aus Plan 7
- harte Guardrails
- Pflichtkontext: `memory.md`, `HANDOFF_PROMPT.md`, `README.md`, dieser Plan, relevante Dateien
- Pflichtchecks und Reportpfad

Reportpfad je Cycle:

`/Users/alexandersmyslowski/.hermes/coordination/agent-reports/inbox/hans-24h-plan7-20260523-p7-bXX.md`

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
- nur noch Politur ohne messbaren Nutzwert oder ohne realen manuellen Beta-Rehearsal-Bezug moeglich ist
- Plan 7 abgeschlossen ist

Dann schreibt Hans einen finalen Lagebericht und wartet auf Frau Mueller/Supervisor.
