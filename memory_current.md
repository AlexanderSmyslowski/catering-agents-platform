# memory_current.md

version: 5.23
date: 2026-04-11
status: canonical-current-memory
repo: AlexanderSmyslowski/catering-agents-platform

## Zweck
Diese Datei ist die kanonische aktuelle Root-Memory-Datei fuer das Repo, solange die bestehende `memory.md` technisch nicht direkt ueberschrieben werden kann.

## Sofort lesen in neuer Session
1. `memory_current.md`
2. `AGENTS.md`
3. `HANDOFF_PROMPT.md`
4. `docs/agent-memory/README.md`
5. `docs/agent-memory/memory_v5.23_2026-04-11.md`

## Konsolidierter Gesamtstand
- Der Governance-Pfad ist bis **Stufe 6c** sauber abgearbeitet.
- Die Stufen **3a bis 6b** sind fachlich gruen und konsolidiert.
- **Stufe 6c** wurde anschliessend als kleiner, rein read-only UX-/Transparenzschritt im bestehenden UI umgesetzt.

## Fachliche Anker
- `ApprovalRequestRecord` bleibt die fuehrende Freigabewahrheit.
- `SpecGovernanceStateRecord` bleibt die Statusspur.
- `SpecChangeSetRecord` bleibt die Aenderungseinheit.
- Finalize ist nicht gleich Freigabe.

## Was fuer 6c konkret passiert ist
- Zuerst wurde sauber festgestellt, dass die Governance-Zustaende im bestehenden UI noch nicht im Read-Pfad ankamen.
- Danach wurde ein vorgelagerter Mini-Read-Schritt umgesetzt, damit ein optionales `governance`-Feld im bestehenden Spec-Read-Pfad transportiert werden kann.
- Anschliessend wurde **Stufe 6c** im Block `Operative Uebergabe` umgesetzt:
  - zusaetzliche read-only Governance-Anzeige
  - klare sichtbare Bezeichnungen fuer die Zustaende
  - Hinweis: `Finalisiert ist nicht gleich freigegeben.`
- `readiness.status` blieb separat und unveraendert.
- Es gab keine neue Fachlogik, keine neuen API-Endpunkte, keine neue Persistenz und keine neue Freigabelogik.

## Testentscheidung
- Eine kleine Scope-Pruefung wurde durchgefuehrt.
- Ein zusaetzlicher UI-Test wurde bewusst nicht aufgenommen, weil es im `backoffice-ui` aktuell keinen passenden kleinen UI-Testkontext gibt und dafuer neuer Testaufbau noetig waere.
- Fuer den jetzigen Minimal-Scope ist das vertretbar.

## Repo-Handoff
- Fuehrende Arbeitsdateien im Repo:
  - `memory_current.md`
  - `AGENTS.md`
  - `HANDOFF_PROMPT.md`
  - `docs/agent-memory/README.md`
- Versionierte Snapshots liegen unter `docs/agent-memory/`, zuletzt:
  - `memory_v5.23_2026-04-11.md`

## Hinweis zur alten memory.md
- Die bestehende `memory.md` im Repo-Root ist derzeit nicht die aktuellste Fassung.
- Grund ist eine technische Grenze des verfuegbaren GitHub-Connectors beim Ueberschreiben bestehender Dateien.
- Bis zur direkten Behebung gilt **`memory_current.md` als Root-Datei mit aktuellem Stand**.
