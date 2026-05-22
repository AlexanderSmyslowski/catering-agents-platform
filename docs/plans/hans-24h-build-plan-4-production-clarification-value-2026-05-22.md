# Hans 24h Build Plan 4 — Production Clarification Value 2026-05-22

> Zweck: Anschlussplan nach `hans-24h-build-plan-3-controlled-beta-2026-05-22.md`. Plan 3 hat die kontrollierte interne Beta-/Demo-Strecke gruen bis zur Entscheidungsvorlage gebracht. Alexander hat danach ausdruecklich beauftragt, Hans ohne manuellen Go-Loop weiter coden zu lassen und neue Build-Plaene fortlaufend zu erstellen. Plan 4 verschiebt den Fokus von weiterer Beta-Politur zu einem kleinen echten Produktwertblock in `/produktion`: strukturierte Rueckfragen und Antwortfortsetzung sichtbarer, pruefbarer und nutzbarer machen — ohne automatische Spec-Korrektur, ohne neue Persistenzwelt, ohne LLM-/Tool-Use und ohne echte Daten.

## Ausgangspunkt

Verifizierter Stand bei Planerstellung:
- Repo: `/Users/alexandersmyslowski/Projects/catering-agents-platform`
- Branch: `main`
- Letzter Plan-3-HEAD/origin/main: `9c24c0f` (`docs: snapshot plan3 full gates`)
- Letzte verifizierte GitHub Actions CI: gruen, Run `26307942784`
- Arbeitsbaum: sauber bis auf bekanntes untracked `tmp/`; `tmp/` bleibt unberuehrt
- Plan 3 abgeschlossen: P3-B31 bis P3-B40 liegen als Reports in `/Users/alexandersmyslowski/.hermes/coordination/agent-reports/inbox/`
- P3-B40-Empfehlung: naechster sinnvoller Block ist Produktwert in `/produktion`, bevorzugt strukturierte Antwortannahme/Rueckfragen-Fortsetzung auf Basis des bereits angelegten Clarification-Strangs

## Management-Ziel

Plan 4 soll die bestehende Produktions-Rueckfragenstrecke von "technisch modelliert und teilweise sichtbar" in Richtung "intern nutzbarer strukturierter Arbeitsfluss" bringen.

Das bedeutet:
1. Eine interne Person soll in `/produktion` besser erkennen, welche Rueckfrage offen ist, welche beantwortet wurde und was als naechstes passiert.
2. Bestehende Answer-/Question-/Session-/Spec-Bindungen sollen durch Tests stabil bleiben.
3. Wenn bestehende Antwortannahme bereits vorhanden ist, darf sie nur im vorhandenen Rahmen lesbarer und sicherer genutzt werden.
4. Keine automatische fachliche Uebernahme von Antworten in Spezifikation, Produktionsplan, Rezept, Menge oder Einkaufsliste.
5. Wenn ein echter Produkt-/Architekturentscheid noetig wird, stoppt Hans und schreibt BLOCKED plus Entscheidungsvorlage.

## Arbeitsprinzip fuer weitere 24h

- Kein Leerlauf: nach gruenem Cycle naechsten Cycle aus dieser Queue starten.
- Kein blindes Coden: nur diese Queue, keine erfundenen Features.
- Kleine Commits, maximal ein fachlicher Baustein pro Cycle.
- Jeder Cycle braucht echten Nutzwert: UI-Lesbarkeit, Testschutz, sichere Answer-Bindung, klare Stop-Grenze oder reproduzierbarer interner Ablauf.
- Wenn CI rot: sofort CI-Fix-Cycle, kein Weiterbau.
- Wenn fachlich blockiert: Stop und Lagebericht, nicht auf Nebenfeatures ausweichen.
- Wenn Plan 4 abgeschlossen ist und weiter Nutzwert innerhalb der Guardrails besteht, soll Frau Mueller Build Plan 5 erstellen.

## Absolute Guardrails

Nicht bauen:
- kein Deployment, keine SSH-Verbindung, keine Serveraenderung
- keine Secrets, keine produktive `.env`, keine Tokens, keine Connection Strings
- keine neue Persistenzwelt, kein Prisma, keine Migration
- keine neue API ohne ausdruecklichen Minimalnachweis, dass bestehende Pfade nicht reichen
- kein OAuth, Google Drive, Login, OIDC
- kein LLM-/Tool-Use-/OCR-/Parser-Ausbau
- keine automatische Spec-Korrektur aus Rueckfragenantworten
- keine Rezept-/Allergenautomatik
- keine Plattform-/Multi-Tenant-/White-Label-Erweiterung
- keine rechtssichere Audit-, DSGVO- oder Compliance-Behauptung
- keine Nutzung echter Personen-/Kunden-/Einsatzdaten

Erlaubt:
- Tests, Dokumentation, lokale Betriebschecks
- kleine Bugfixes an bestehenden `/produktion`-Pfaden
- kleine read-only UI-/Statusverbesserungen
- Nutzung vorhandener Clarification-Question-/Answer-/Projection-/Store-Bausteine
- sichere Anzeige bestehender Antworten, Statusanker und naechster Schritte
- Memory-/Snapshot-Fortschreibung bei relevanten Aenderungen

## Queue N — Clarification-Arbeitsfluss in `/produktion` nutzbarer machen

### P4-B41 — Bestehenden Clarification-Answer-Pfad inventarisieren und als Plan-4-Anker schuetzen

Ziel:
Plan 4 startet nicht mit Annahmen. Hans prueft, welche Clarification-Question-/Answer-/Projection-/Store-/UI-Pfade real existieren, und verankert den Plan im Repo.

Arbeitsrichtung:
- `shared-core`, `production-service`, `backoffice-ui/src/App.tsx` und vorhandene Clarification-/Production-Smokes lesen
- kein Produktcode, wenn die Bestandsaufnahme reicht
- optional schmaler Vertragstest: Plan 4 muss Guardrails, Queues und Stop-Regel enthalten

Akzeptanz:
- Plan 4 ist auffindbar
- real vorhandene Clarification-Bausteine sind kurz eingeordnet
- kein neuer Runtime-Pfad ohne echte Bestandsluecke

### P4-B42 — `/produktion` Rueckfragenstatus fuer interne Nutzer schaerfen

Ziel:
Offene und beantwortete Rueckfragen sind in `/produktion` leichter unterscheidbar.

Arbeitsrichtung:
- vorhandene Projection- und UI-Daten nutzen
- Smoke-Test fuer sichtbare Marker `offen`, `beantwortet` oder aehnliche vorhandene Statussprache
- minimaler UI-/Copy-Fix nur bei echter Luecke

Akzeptanz:
- keine Antwortbearbeitung
- kein automatisches Schliessen/Entfernen von Fragen
- keine Spec-Korrektur oder Fachableitung

### P4-B43 — Antwortanzeige mit sicherer Bindung an Frage und Spec schuetzen

Ziel:
Angezeigte Antworten bleiben eindeutig an `questionId`, Question-Key und Spec-/Session-Kontext gebunden.

Arbeitsrichtung:
- bestehende Tests fuer `ProductionConversationProjection`, Answer-Modell und Session-/Spec-Bindung lesen
- Regression fuer falsche oder fremde Antwortbindung, falls noch nicht ausreichend vorhanden
- Code-Fix nur bei echter Drift

Akzeptanz:
- falsche Spec-/Session-Antworten erscheinen nicht
- passende submitted shortText-Antworten erscheinen read-only
- keine neue ID-Welt

### P4-B44 — Naechster Agent-Schritt nach Antworten sichtbar machen

Ziel:
Wenn Antworten vorhanden sind, erklaert `/produktion` den naechsten sicheren Arbeitsschritt, ohne ihn automatisch auszufuehren.

Arbeitsrichtung:
- vorhandene Status-/Next-Step-Zone verwenden
- Copy/Marker nur auf bestehende Daten und bestehenden Zustand beziehen
- Testschutz fuer die Grenze: Antwort ist Eingabe fuer Pruefung, nicht automatische Produktionsplan-Korrektur

Akzeptanz:
- keine automatische Spec-, Plan-, Rezept-, Mengen- oder Einkaufslisten-Aenderung
- keine neue API
- naechster Schritt bleibt menschlich/agentisch pruefbar

### P4-B45 — Antwortannahme-Fehlergrenzen minimal absichern

Ziel:
Ungueltige Clarification-Antworten werden kontrolliert abgewiesen bzw. nicht projiziert.

Arbeitsrichtung:
- vorhandene Validierung fuer `shortText`, Laenge, Question-Key und Spec-/Session-Bindung lesen
- fokussierte Tests fuer zu lange, leere, falsch gebundene oder nicht erlaubte Antworttypen, sofern nicht schon vorhanden
- kein neues Antwortformat

Akzeptanz:
- aktiv erlaubt bleibt nur der bestehende erste Antworttyp
- HTML/Script wird fuer Anzeige sicher behandelt
- keine Rohtext-/PDF-Extrakt-Spiegelung

## Queue O — Interner Produktionsarbeitsfluss mit Antworten pruefbarer machen

### P4-B46 — Demo-/Seed-Szenario mit Rueckfragenantworten pruefbar halten

Ziel:
Ein synthetischer Produktions-Demozustand mit Rueckfragen und Antworten bleibt intern reproduzierbar pruefbar.

Arbeitsrichtung:
- vorhandene Demo-/Seed-Daten nur nutzen, nicht mit echten Daten erweitern
- Test/Smoke fuer Frage -> Antwort -> read-only Anzeige -> naechster Schritt
- keine neuen Kundennamen, echten Personen oder realen Einsatzdaten

Akzeptanz:
- synthetisch und intern klar markiert
- keine Produktionsfreigabe
- keine neue Persistenzwelt

### P4-B47 — Export-/Download-Grenze bei beantworteten Rueckfragen sichtbar halten

Ziel:
Beantwortete Rueckfragen duerfen nicht suggerieren, dass Export-/Produktionsartefakte automatisch aktualisiert oder freigegeben sind.

Arbeitsrichtung:
- vorhandene Export-/Downloadanker in `/produktion` lesen
- UI-/Testanker fuer Grenze: Exporte sind interne Arbeitsbelege und bleiben vom Review-/Generierungspfad getrennt

Akzeptanz:
- keine Exportlogik-Aenderung
- keine rechtssichere Audit-/Freigabe-Behauptung
- keine automatische Neuerzeugung

### P4-B48 — Audit-/Herkunftssicht fuer Rueckfragenantworten einordnen

Ziel:
Antworten werden als interne Klaerungsinputs eingeordnet, nicht als rechtssicherer Audit oder Freigabe.

Arbeitsrichtung:
- bestehende Audit-/Herkunftszonen lesen
- nur sichere Status-/Herkunftsmarker verwenden
- Doku/Test-only, falls Produktcode nicht noetig ist

Akzeptanz:
- keine neue Auditlogik
- keine Compliance-Behauptung
- keine Operator-/Freigabelogik-Erweiterung

## Queue P — Abschluss und naechster Produktwertblock

### P4-B49 — Full Gates und Status-Snapshot fuer Plan 4

Ziel:
Plan-4-Zwischenstand wird sauber verifiziert und versioniert.

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

### P4-B50 — Entscheidung: Plan 5 Produktwertblock oder Betriebsvalidierung

Ziel:
Hans erzeugt keine Endlos-Politur. Nach Plan 4 muss ein neuer Plan mit echtem Nutzwert folgen oder ein Blocker klar benannt werden.

Moegliche Folgepfade:
- Plan 5: kontrollierter interner synthetischer End-to-End-Beta-Durchlauf mit Ergebnisvermerk
- Plan 5: Angebots-/Produktionsuebergabe fachlich tiefer machen, aber ohne neue API/Persistenz
- Plan 5: Setup-/Onboarding-Korridor fuer nicht-technische interne Nutzer
- Stop: falls naechster sinnvoller Schritt echte Daten, Deployment, Auth, Persistenz oder Architekturentscheidung braucht

Akzeptanz:
- keine Umsetzung dieser Kandidaten ohne neuen Plan
- harter Lagebericht: umgesetzt / offen / blockiert / Risiko / empfohlener naechster Schritt

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
- eine neue API/Persistenz/Architekturentscheidung notwendig wird
- CI rot ist und nicht in einem engen CI-Fix-Cycle repariert werden kann
- kein echter Nutzwert mehr aus der Queue ableitbar ist
- Plan 4 abgeschlossen ist

Dann schreibt Hans einen finalen Lagebericht. Frau Mueller erstellt danach — falls innerhalb der Guardrails weiter Nutzwert besteht — Build Plan 5 und startet den naechsten Runner ohne manuelles Go von Alexander.
