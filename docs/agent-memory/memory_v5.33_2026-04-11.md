# memory snapshot

source: memory.md
version: 5.33
date: 2026-04-11
repo: AlexanderSmyslowski/catering-agents-platform
status: m1-2-operational-memory-objects-defined

## Snapshot-Zweck
Versionierter Zwischenstand fuer Handoff und Rueckgriff: in Phase M1.2 sind `SpecRecord` und `OpenIssueRecord` als erste konkrete Operational-Memory-Objekte fachlich definiert.

## Kernaussage
- `SpecRecord` und `OpenIssueRecord` bilden den kleinsten stabilen operativen Kern.
- `SpecRecord` beschreibt das aktuelle Objekt.
- `OpenIssueRecord` beschreibt den aktuell offenen Arbeitsbedarf dazu.
- Zusammen ergeben sie direkte, deterministische Arbeitswahrheit fuer Handoff, Rueckfrage und Priorisierung.

## Minimaler Feldvorschlag - SpecRecord
- `id`
- `subjectType` oder `domainType`
- `title`
- `status`
- `sourceRef`
- `version` oder `revision`
- `updatedAt`
- `owner`
- `currentFocus`
- `openIssueIds`
- `lastDecisionId`

### Spaeter moeglich
- `summary`
- `changeSetId`
- `approvalState`
- `relatedPlanId`

## Minimaler Feldvorschlag - OpenIssueRecord
- `id`
- `specId`
- `title`
- `description`
- `severity` oder `priority`
- `status`
- `createdAt`
- `updatedAt`
- `sourceRef`
- `owner`
- `decisionBlocker` boolean
- `nextAction`

### Spaeter moeglich
- `assignee`
- `dueAt`
- `resolutionNote`
- `relatedDecisionId`
- `relatedChangeSetId`

## Strikt deterministisch
- IDs
- Referenzen
- Status
- Owner
- Zeitstempel
- `sourceRef`
- Beziehungen zwischen Spec und Issue
- offene Punkte
- letzte Entscheidung / letzte relevante Aktion
- Prioritaet bzw. Schweregrad, wenn fachlich festgelegt

## Bewusst noch nicht hinein
- modellische Zusammenfassungen
- semantische Kurzprofile
- Vorschlaege mit Interpretationscharakter
- Long-Term-Charakteristika zu Nutzer, Firma, Event oder Praeferenzen
- generische Skill- oder Resolver-Inhalte
- Provider-spezifischer State als Wahrheitsquelle
- grosse Verdichtungsbloecke

## Kanonische Verankerung
- zuerst in `docs/architecture/MEMORY_ARCHITECTURE.md`
- danach spaeter produktnah in der bestehenden Domain-Schicht
- `memory.md` bleibt kompakter Verweis- und Statusanker

## Scope-Grenzen
- nur `SpecRecord` und `OpenIssueRecord` konkretisieren
- nur minimale deterministische Felder definieren
- keine neue Persistenz
- keine neue API
- keine neue UI
- kein neuer Screen
- keine grossen Refactorings
- keine Long-Term-Verdichtung vorziehen
- keine Provider-Abhaengigkeit als Primaerquelle
