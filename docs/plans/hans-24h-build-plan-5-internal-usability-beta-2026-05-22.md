# Hans 24h Build Plan 5 — Internal Usability Beta 2026-05-22

> Zweck: Anschlussplan nach `hans-24h-build-plan-4-production-clarification-continuation-2026-05-22.md`. Plan 4 hat den Rueckfragen-/Antwort-Fortsetzungsstrang fuer `/produktion` gruen abgeschlossen. Plan 5 richtet Hans klar auf Alexanders Ziel aus: Die App soll bald intern nutzbar sein. Der Fokus liegt deshalb auf einem nachvollziehbaren Beta-Durchlauf in der vorhandenen Web-App — Start -> Angebot -> Produktion -> Rueckfragen -> Exporte/Audit — ohne Deployment, echte Daten, neue Persistenzwelt, OAuth/Login/OIDC oder automatische Fachableitung.

## Ausgangspunkt

Verifizierter Stand bei Planerstellung durch Frau Mueller:
- Repo: `/Users/alexandersmyslowski/Projects/catering-agents-platform`
- Branch: `main`
- HEAD/origin/main: `cf5de21fc065ca5e3201e350a5477a6a7a5bb16c` (`docs: snapshot plan4 full gates`)
- GitHub Actions CI: Run `26312229955`, `completed/success`
- Working tree: sauber bis auf bekanntes untracked `tmp/`; `tmp/` bleibt unberuehrt
- Plan 4: P4-B41 bis P4-B48 abgeschlossen, Full Gates gruen, kein weiterer Clarification-Mikroausbau empfohlen

## Management-Ziel

Plan 5 soll die vorhandene App nicht theoretisch perfektionieren, sondern fuer einen internen Beta-Durchlauf glatter und verstaendlicher machen:

1. Ein interner Nutzer soll den Weg `Start -> Angebot -> Produktion -> Rueckfragen -> Export/Audit` ohne Entwicklerbrille nachvollziehen koennen.
2. Die UI soll klarer sagen: Was ist der naechste Schritt? Was ist bereit? Was ist offen? Was bleibt blockiert?
3. Die vorhandenen Kernobjekte, Exporte und Audit-/Herkunftsanker bleiben fuehrend; keine Chat- oder LLM-Behauptung ersetzt pruefbare Produktobjekte.
4. Verbesserungen muessen klein, sichtbar und testbar sein.
5. Plan 5 soll Richtung 7/10 interne Nutzbarkeit arbeiten, nicht Richtung produktionsnahe echte-Daten-Freigabe.

## Absolute Guardrails

Nicht bauen:
- kein Deployment, keine SSH-Verbindung, keine Serveraenderung
- keine Secrets, keine produktive `.env`, keine Tokens, keine Connection Strings
- keine echte Personen-/Kunden-/Einsatzdaten
- keine neue Persistenzwelt, kein Prisma, keine Migration
- kein OAuth, Google Drive, Login, OIDC oder Session-System
- keine neue grosse API-Flaeche; vor groesserer API-Entscheidung stoppen
- kein LLM-/Tool-Use-/OCR-/Parser-Ausbau
- keine automatische Spec-Korrektur aus Rueckfragenantworten
- keine Rezept-/Allergenautomatik, keine rechtssichere Compliance-Behauptung
- keine Multi-Tenancy-, Plattform- oder White-Label-Erweiterung

Erlaubt:
- kleine UI-/Copy-/Status-Slices in bestehenden Routen `/`, `/angebot`, `/produktion`
- bestehende Services, Stores und Shared-Core-Typen nutzen
- Vertragstests, jsdom-Smokes, lokale Status-/Check-Anker
- minimale Doku-/Runbook-Korrekturen, wenn sie den Beta-Durchlauf reproduzierbarer machen
- Memory-/Snapshot-Fortschreibung bei relevantem Stand

## Arbeitsprinzip fuer den fortlaufenden Runner

- Kein Leerlauf: nach gruenem Cycle naechsten Cycle aus dieser Queue starten.
- Kein blindes Coden: nur diese Queue, keine erfundenen Features.
- Kleine Commits, maximal ein fachlicher Baustein pro Cycle.
- Jeder Cycle braucht messbaren Nutzen fuer interne Nutzbarkeit: klarere Nutzerfuehrung, sichtbarer Zustand, besserer Demo-/Smoke-Pfad oder eindeutigeres Beta-Runbook.
- Wenn CI rot: sofort CI-Fix-Cycle, kein Weiterbau.
- Wenn fachlich blockiert: Stop und Lagebericht, nicht auf Nebenfeatures ausweichen.
- Wenn ein Cycle eine API-/Persistenz-/Security-/Betriebsentscheidung erfordert, stoppt Hans und formuliert die Entscheidung.

## Queue Q — Beta-Durchlauf aus Nutzersicht schaerfen

### P5-B49 — Ist-Durchlauf Start -> Angebot -> Produktion aus Nutzersicht pruefen

Ziel:
Der bestehende interne Beta-Durchlauf wird aus Nutzerperspektive kartiert: Wo ist der Weg klar, wo unklar, was ist schon testbar?

Arbeitsrichtung:
- `README.md`, `TESTING.md`, C8, relevante Backoffice-Smokes und UI-Routen lesen.
- Keine Produktlogik bauen, wenn zuerst eine klare Ist-Karte fehlt.
- Wenn sinnvoll: kleiner Vertragstest oder Doku-Anker, der den fuehrenden Beta-Durchlauf benennt.

Akzeptanz:
- Es gibt einen repo-verankerten, auffindbaren Beta-Durchlaufanker fuer `Start -> Angebot -> Produktion -> Exporte/Audit`.
- Klar getrennt: intern nutzbar, blockiert, nur dokumentiert.

### P5-B50 — Startseite als Beta-Einstieg schaerfen

Ziel:
Die Startseite fuehrt einen internen Nutzer ruhig in den Beta-Durchlauf, statt nur technische Module zu zeigen.

Arbeitsrichtung:
- `backoffice-ui/src/App.tsx` und `tests/backoffice-route-smoke.test.ts` pruefen.
- Minimaler UI-/Copy-Slice, falls der Einstieg nicht klar genug ist.
- Keine neue Dashboard-Welt, keine neue Datenquelle.

Akzeptanz:
- Startseite benennt den internen Beta-Weg und die naechsten Einstiege Angebot/Produktion klar.
- Smoke-Test schuetzt die sichtbaren Marker.

### P5-B51 — `/angebot` Nutzerfuehrung fuer Entwurf und Uebergabe schaerfen

Ziel:
Ein interner Nutzer erkennt in `/angebot`: Anfrage eingeben oder Demo nutzen, Entwurf pruefen, Export sehen, an Produktion uebergeben.

Arbeitsrichtung:
- `backoffice-ui/src/offer-workbench.tsx`, `backoffice-ui/src/App.tsx`, `tests/backoffice-route-smoke.test.ts` lesen.
- Nur vorhandene Daten/Actions nutzen.
- Minimaler UI-/Copy-/Status-Fix plus Smoke-Test, wenn der naechste Schritt unklar ist.

Akzeptanz:
- `/angebot` zeigt den naechsten Schritt und den Uebergabe-/Exportstatus klarer.
- Keine neue Angebotslogik, keine automatische Spec-Korrektur.

### P5-B52 — `/produktion` Nutzerfuehrung fuer naechsten Schritt schaerfen

Ziel:
Ein interner Nutzer erkennt in `/produktion`: Rueckfragenstatus, Produktionsobjekte, Einkauf/Downloads, Herkunft/Audit und was als naechstes zu tun ist.

Arbeitsrichtung:
- `backoffice-ui/src/production-workbench.tsx`, `backoffice-ui/src/App.tsx`, `tests/backoffice-production-acceptance-smoke.test.ts` lesen.
- Nur vorhandene Projektion/Props/Objekte nutzen.
- Minimaler UI-/Copy-/Status-Fix plus Smoke-Test, wenn der naechste Schritt unklar ist.

Akzeptanz:
- `/produktion` fuehrt sichtbar durch Rueckfragen -> Ergebnisobjekte -> Exporte/Audit.
- Keine neue Produktflaeche ausser vorhandener Workbench, keine LLM-/Rezept-/Allergenautomatik.

### P5-B53 — Export-/Download-/Audit-Endpunkt des Beta-Durchlaufs schaerfen

Ziel:
Der interne Beta-Durchlauf hat ein klares Ende: welche Exporte/Auditanker sind vorhanden, welche nicht, und welche Grenzen gelten?

Arbeitsrichtung:
- Exportlinks, Audit-Zonen, `print-export`, PA8-/C8-/TESTING-Anker pruefen.
- Minimaler UI-/Doku-/Test-Slice, wenn der Endpunkt nicht klar genug ist.

Akzeptanz:
- Exporte und Auditanker sind als interne Arbeitsbelege sichtbar/auffindbar.
- Keine externe Freigabe, keine Signatur-/Compliance-Behauptung.

### P5-B54 — Manuelle Beta-Test-Checkliste fuer Alexander

Ziel:
Alexander kann die App selbst lokal/previewartig durchgehen und Reibungspunkte notieren.

Arbeitsrichtung:
- C8/B12/TESTING lesen.
- Eine knappe Checkliste fuer manuelle Beta-Pruefung ergaenzen, wenn noch nicht ausreichend vorhanden.
- Keine neue QA-Plattform.

Akzeptanz:
- Checkliste nennt URLs, Reihenfolge, erwartete sichtbare Marker, Stop-Gates und Nicht-Freigaben.
- Vertragstest schuetzt Auffindbarkeit.

### P5-B55 — Full Gates und Nutzbarkeits-Lage

Ziel:
Plan-5-Stand wird sauber verifiziert und als Management-Lage zusammengefasst: Was ist jetzt intern nutzbar, was bleibt offen, was ist der naechste Hebel zur 7,5/10?

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
- Lagebericht trennt: umgesetzt / intern nutzbar / offen / blockiert / Risiko / naechster Schritt
- Kein weiterer Plan entsteht ohne klaren Nutzwert innerhalb der Guardrails

## Cycle-Prompt-Format fuer Hans

Jeder Plan-5-Cycle bekommt einen eigenen Prompt unter:

`/Users/alexandersmyslowski/.hermes/coordination/prompts/hans-24h-plan5-20260522-p5-bXX.md`

Der Prompt muss enthalten:
- aktueller HEAD und CI-Stand
- genau ein Cycle aus Plan 5
- harte Guardrails
- Pflichtkontext: `memory.md`, `HANDOFF_PROMPT.md`, `README.md`, dieser Plan, relevante Dateien
- Pflichtchecks und Reportpfad

Reportpfad je Cycle:

`/Users/alexandersmyslowski/.hermes/coordination/agent-reports/inbox/hans-24h-plan5-20260522-p5-bXX.md`

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
- kein messbarer Nutzwert mehr aus der Queue ableitbar ist
- Plan 5 abgeschlossen ist

Dann schreibt Hans einen finalen Lagebericht und wartet auf Frau Mueller/Supervisor.
