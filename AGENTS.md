# AGENTS.md

## Zweck
Diese Datei richtet die Arbeit fuer ChatGPT, Hermes Agent, Codex 5.4 mini und aehnliche Agenten auf einen konsistenten Repo-Workflow aus.

## Pflicht-Lesereihenfolge
1. `memory.md`
2. `HANDOFF_PROMPT.md`
3. `README.md`
4. danach die fuer den aktuellen Schritt relevanten Dateien

## Verbindliche Arbeitsregeln
- Arbeite am realen Repo-Iststand.
- Keine Halluzinationen.
- Keine neuen Features ohne expliziten Auftrag.
- Keine grossen Refactorings ohne direkten Phasenbezug.
- Trenne strikt zwischen:
  - umgesetzt
  - fachlich beschrieben
  - offen
  - out of scope
- Kleine echte Bausteine vor grossen Architekturverschiebungen.
- Keine neue Persistenzwelt / kein Prisma ohne ausdrueckliche Entscheidung.
- Governance additiv, nicht als zweiter Kern.
- Finalize ist nicht gleich Freigabe.

## Aktueller Governance-Anker
- `ApprovalRequestRecord` bleibt fuehrende Freigabewahrheit.
- `SpecGovernanceStateRecord` bleibt Statusspur.
- `SpecChangeSetRecord` bleibt Aenderungseinheit.
- Aktuell ist der Governance-Pfad bis Stufe 6b fachlich gruen.
- Stufe 6c ist als naechster kleiner UX-/Transparenzschritt beschrieben, aber noch nicht umgesetzt.

## Memory-Disziplin
- `memory.md` ist die fuehrende Kurzreferenz.
- Bei jeder relevanten Neuerung muss `memory.md` versioniert fortgeschrieben werden.
- Bestehende Historie nicht still ueberschreiben.
- Neue Versionen unten in der Versionshistorie anhaengen.
- Fuer markante Zwischenstaende zusaetzlich einen Snapshot unter `docs/agent-memory/` anlegen.

## Handoff-Disziplin
- Ein neues Chatfenster oder ein neuer Agent beginnt immer mit dem Lesen von `memory.md`, `HANDOFF_PROMPT.md` und `README.md`.
- Vor Umsetzung erst den aktuellen Repo-Iststand pruefen.
- Erst danach den kleinsten sinnvollen Schritt ausfuehren.

## Was aktuell out of scope bleibt
- Snapshots / `lastHardApproved` als Fachausbau
- Hard-Approve
- Point-of-no-return-Ausbau
- ChangeItem-Persistenz
- ChangeItem-Anzeige
- zusaetzliche Governance-Workflows
- neue API-Endpunkte ausser bei ausdruecklichem Auftrag
- neue Persistenzsysteme / Prisma
