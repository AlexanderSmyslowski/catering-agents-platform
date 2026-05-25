# C10 Current Worktree PR Slices

Status: Arbeitsbaum-Sortierung, keine Commits, keine PR-Erstellung
Datum: 2026-05-25
Scope: aktuelle uncommitted Aenderungen nach Quick-Lunch-Fixes, lokaler Rehearsal-Evidenz und Produktions-UI-Refactor

## Zweck

Dieses Dokument sortiert den aktuellen Arbeitsbaum in sinnvolle Review-/Commit-/PR-Slices, ohne selbst zu committen oder zu deployen.

Ziel ist, den inzwischen groesseren Arbeitsstand reviewbar zu halten und nicht weitere Produktarbeit auf einen unscharfen Diff-Stapel zu setzen.

## Harte Grenze

Diese Sortierung ist kein Commit-Go und keine PR-Erstellung.

Sie fuehrt nicht ein:

- keine neuen Features
- keine neue API
- keine neue Persistenz
- keine Migration
- keine echten Daten
- keine Google-Drive-Angebotsnutzung
- keine LLM-/Tool-Orchestrierung
- keine Auth-/OIDC-/IAP-Aenderung
- kein Deployment
- keine Produktionsfreigabe

`tmp/` bleibt untracked/unrelated und gehoert in keinen Slice.

## Aktueller Git-Status-Snapshot

Git-relevante Aenderungen im Arbeitsbaum:

- `README.md`
- `TESTING.md`
- `backoffice-ui/src/App.tsx`
- `backoffice-ui/src/production-language.ts`
- `docs/product/C8_INTERNER_DEMO_DURCHLAUF_ABNAHMEWEG.md`
- `memory.md`
- `production-service/src/recipe-discovery/service.ts`
- `production-service/src/rules/planning.ts`
- `scripts/check-local-ops.sh`
- `shared-core/src/recipe-library.js`
- `shared-core/src/recipe-library.ts`
- `tests/backoffice-production-acceptance-smoke.test.ts`
- `tests/backoffice-route-smoke.test.ts`
- `tests/local-ops-check-contract.test.ts`
- `tests/platform.test.ts`
- `tests/production-language.test.ts`
- `tests/production-plan-fallbacks.test.ts`
- `backoffice-ui/src/production-handoff-panel.tsx`
- `backoffice-ui/src/production-input-panel.tsx`
- `backoffice-ui/src/production-objects-panel.tsx`
- `backoffice-ui/src/production-plan-download-card.tsx`
- `backoffice-ui/src/production-plan-list.tsx`
- `backoffice-ui/src/production-plan-secondary-details.tsx`
- `backoffice-ui/src/production-purchase-list-panel.tsx`
- `backoffice-ui/src/production-question-panel.tsx`
- `backoffice-ui/src/production-recipe-library-panel.tsx`
- `backoffice-ui/src/production-spec-details.tsx`
- `docs/architecture/PRODUCTION_AGENT_10_10_CODING_ARCHITECTURE.md`
- `docs/product/C10_CURRENT_WORKTREE_PR_SLICES.md`
- `docs/product/C9_FEHLUPLOAD_ARCHIV_LOESCH_ENTSCHEIDUNG.md`
- `tests/c9-fehlupload-archive-delete-decision-contract.test.ts`
- `tests/product-goal-anchor-contract.test.ts`
- `tests/production-agent-10-10-coding-architecture-contract.test.ts`

Nicht stagen:

- `tmp/`

Hinweis zu Cross-Slice-Dateien:

- `README.md`, `TESTING.md` und `memory.md` enthalten Anker fuer mehrere Slices und sollten bei echter Commit-Aufteilung per Hunk-Review oder als eigener Dokumentations-/Handoff-Slice behandelt werden.
- `backoffice-ui/src/App.tsx` enthaelt sowohl Slice-3-Verhaltensaenderungen als auch Slice-4-Refactor-Importe/-JSX-Reduktionen; bei echter Commit-Aufteilung braucht diese Datei Hunk-Review.
- `docs/product/PRODUKTZIEL_CATERING_AGENTS_PLATFORM.md` ist der fuehrende Zielanker, aber nach aktuellem Status kein neu zu stagender Arbeitsbaum-Diff.

## Reviewfaehige Commit-Schnittlogik

Empfohlene Review-Reihenfolge:

1. Slice 1 pruefen: Ziel-/Gate-/Local-Rehearsal- und C9-Entscheidungsanker.
2. Slice 2 pruefen: Produktionskern, Quick-Lunch, Rezeptmatching, Baecker-Zukauf und Einkaufslistenqualitaet.
3. Slice 3 pruefen: Produktions-UI-Verhalten und Quick-Lunch-Smokes.
4. Slice 4 pruefen: Produktions-UI-Refactor ohne Verhaltensaenderung.
5. Cross-Slice-Dokuanker pruefen: README, TESTING, memory, C10 und 10/10-Architektur.

Diese Reihenfolge ist ein Review-/Commit-Vorschlag, kein automatisches Commit-Go.

## Empfohlene Slice-Reihenfolge

### Slice 1: Produktziel, lokale Rehearsal-Grenzen und Fehlupload-Entscheidung

Enthaelt:

- `docs/product/PRODUKTZIEL_CATERING_AGENTS_PLATFORM.md`
- `tests/product-goal-anchor-contract.test.ts`
- `scripts/check-local-ops.sh`
- `tests/local-ops-check-contract.test.ts`
- `docs/product/C8_INTERNER_DEMO_DURCHLAUF_ABNAHMEWEG.md`
- `docs/product/C9_FEHLUPLOAD_ARCHIV_LOESCH_ENTSCHEIDUNG.md`
- `tests/c9-fehlupload-archive-delete-decision-contract.test.ts`
- passende README-/TESTING-/memory-Anker

Staging-Hinweis:

- Wenn `docs/product/PRODUKTZIEL_CATERING_AGENTS_PLATFORM.md` bereits auf `main` liegt, wird hier nur darauf referenziert.
- `README.md`, `TESTING.md` und `memory.md` nur mit den passenden Slice-1-Hunks oder im Cross-Slice-Dokuanker stagen.

Warum eigener Slice:

- schraubt die Leitplanken fest, bevor fachliche oder UI-Aenderungen reviewed werden
- trennt lokale Rehearsal-Evidenz von Backend-Archiv-/Loeschruntime
- enthaelt bewusst keine Runtime-Implementierung

Review-Fokus:

- Stimmen Zielanker, Gates und sichere Defaults?
- Bleibt C9 entscheidungspflichtig und ohne Runtime?
- Ist der lokale Datenbestand-Hinweis nicht-destruktiv?

### Slice 2: Produktionskern Quick-Lunch und Rezept-/Einkaufslistenqualitaet

Enthaelt:

- `production-service/src/rules/planning.ts`
- `production-service/src/recipe-discovery/service.ts`
- `shared-core/src/recipe-library.ts`
- `shared-core/src/recipe-library.js`
- `tests/production-plan-fallbacks.test.ts`
- `tests/platform.test.ts`

Warum eigener Slice:

- haertet den operativen Produktionskern fuer haeufige Catering-Faelle
- verbindet Brot/Baguette als klaren Baecker-Zukauf, Quick-Lunch-Rezeptmatching und Rezeptimport-Parserqualitaet
- bleibt ohne neue API, Persistenz, LLM oder echte Daten

Review-Fokus:

- Ist Brot/Baguette eng genug und bleibt `gluten_free` klaerungspflichtig?
- Sind Synonyme fuer Nudelsalat, Kartoffelsalat und Kalbsbuletten eng genug?
- Entfernt der Rezeptimport Arbeitsschritte aus Einkaufsposten, ohne echte Zutaten zu verlieren?

### Slice 3: Produktions-UI-Verhalten und Quick-Lunch-Smokes

Enthaelt:

- `backoffice-ui/src/App.tsx`
- `backoffice-ui/src/production-language.ts`
- `tests/backoffice-production-acceptance-smoke.test.ts`
- `tests/backoffice-route-smoke.test.ts`
- `tests/production-language.test.ts`

Staging-Hinweis:

- `backoffice-ui/src/App.tsx` fuer diesen Slice nur mit den Verhaltens-Hunks stagen, nicht mit den spaeteren reinen Refactor-Hunks.
- Wenn Hunk-Splitting zu riskant wird, Slice 3 und Slice 4 als zusammenhaengenden UI-PR reviewen.

Warum eigener Slice:

- haertet sichtbare Beta-/Produktionsarbeitsflaeche gegen Scheingruenheit
- enthaelt Arbeitsbereich-leeren-Klarheit, Antworteditor-/Speicherzustand und Quick-Lunch-UI-Smoke
- trennt UI-Verhalten von spaeterem reinem Refactor

Review-Fokus:

- Bleiben alte/laengere Laeufe als sekundae Details statt aktueller Vorgang?
- Sind Reopen-/Save-Aktionen verstaendlich und blockieren Scheinspeichern?
- Bleibt Brot/Baguette im UI ohne falsche Rueckfrage, aber `gluten_free` weiter offen?

### Slice 4: Produktions-UI-Refactor ohne Verhaltensaenderung

Enthaelt:

- `backoffice-ui/src/production-input-panel.tsx`
- `backoffice-ui/src/production-handoff-panel.tsx`
- `backoffice-ui/src/production-objects-panel.tsx`
- `backoffice-ui/src/production-plan-download-card.tsx`
- `backoffice-ui/src/production-plan-list.tsx`
- `backoffice-ui/src/production-plan-secondary-details.tsx`
- `backoffice-ui/src/production-purchase-list-panel.tsx`
- `backoffice-ui/src/production-question-panel.tsx`
- `backoffice-ui/src/production-recipe-library-panel.tsx`
- `backoffice-ui/src/production-spec-details.tsx`
- die zugehoerigen `App.tsx`-Import-/JSX-Reduktionen
- passende memory-Anker

Staging-Hinweis:

- Dieser Slice sollte fachlich als "move/render-only" reviewt werden.
- `App.tsx`-Hunks gehoeren hier nur dazu, wenn sie JSX/Helper in die genannten Komponenten verschieben und keine sichtbare Logik aendern.

Warum eigener Slice:

- macht `backoffice-ui/src/App.tsx` kleiner und reviewbarer
- sollte fachlich nur Umzug von JSX/Hilfslogik sein
- laesst Datenfluss, Texte, Marker, Handler und Tests unveraendert

Review-Fokus:

- Sind alle Props read-only oder klar als bestehende Handler durchgereicht?
- Sind sichtbare Texte, aria-labels und Exportlinks unveraendert?
- Sind Produktions- und Route-Smokes ausreichend fuer diesen Refactor?

## Aktueller Verifikationsstand

Letzter bekannter kompletter Stand:

```text
npm test
97 Testdateien bestanden
453 Tests bestanden
```

Weitere gruene Checks:

- `npm run build`
- `git diff --check`
- `npm test -- tests/backoffice-production-acceptance-smoke.test.ts tests/backoffice-route-smoke.test.ts`
- `npm test -- tests/backoffice-production-acceptance-smoke.test.ts tests/backoffice-route-smoke.test.ts tests/production-agent-10-10-coding-architecture-contract.test.ts`

Aktuelle App.tsx-Wartbarkeitsmarke:

```text
backoffice-ui/src/App.tsx: 2163 Zeilen
```

## Nicht in diese Slices aufnehmen

- `tmp/`
- lokale `.runtime`-Screenshots oder temporaere Browser-/Curl-Dateien
- echte Google-Drive-Angebote
- lokale Datenordner aus Rehearsal-Runs
- neue Secrets oder ENV-Werte

## Sicherer naechster Arbeitsmodus

1. Slices in obiger Reihenfolge reviewen.
2. Cross-Slice-Dateien vor dem ersten Commit gezielt per Hunk-Review pruefen.
3. Jeden Slice einzeln committen oder als PR-Stack fuehren, erst nach explizitem Commit-/PR-Go.
4. Nach jedem Slice mindestens passende fokussierte Tests laufen lassen.
5. Vor Merge oder groesserem Weiterbau wieder `npm test`, `npm run build` und `git diff --check`.
