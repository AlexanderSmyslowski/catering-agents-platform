# Agent Memory Einstieg

Dieser Ordner enthaelt den versionierten Uebergabe- und Arbeitskontext fuer neue Chatfenster, Hermes Agent, Codex 5.4 mini und aehnliche Arbeitskontexte.

## Schnellstart fuer neue Agenten
Lies in genau dieser Reihenfolge:

1. `../../memory.md`
2. `../../AGENTS.md`
3. `../../HANDOFF_PROMPT.md`
4. `../../README.md`
5. danach die fuer den aktuellen Schritt relevanten Code- und UI-Dateien

## Fuehrende Dateien
- `memory.md` ist die fuehrende Kurzreferenz fuer Projektstand, Bauplan, Leitplanken und naechsten Schritt.
- `AGENTS.md` enthaelt die verbindlichen Arbeitsregeln fuer agentische Zusammenarbeit.
- `HANDOFF_PROMPT.md` ist der direkte Einsatzprompt fuer neue Chatfenster und Agenten.

## Versionssnapshots
Versionierte Zwischenstaende werden in diesem Ordner abgelegt, zum Beispiel:
- `memory_v5.16_2026-04-11.md`

## Aktueller Stand
- Stage-A-Kontrollpunkt bestanden; der Codeanker ist `51f6cbc36f9f3ec93f5b7fd7d5d7cdb170e15e3b`, die geprüfte Übergabe ist über PR 598 in `main` aufgenommen
- Aufgaben 1 bis 7 sind zusammengeführt; PR 596 und die eng begrenzte Nachbesserung PR 597 sind abgeschlossen
- Serielle Gesamtsuite, Typprüfung, Build, Audits, internes Beta-Gate und GitHub-CI sind grün; PostgreSQL-Konkurrenztests bleiben ohne lokale Datenbank übersprungen
- PR #612 ist mit `5393363fd5a0d7453461eca9bc141655c232b21a` in `main` aufgenommen; Task 12 und die acht unabhängig geprüften Reviewbefunde sind enthalten. Weitere Stage-A-Arbeit braucht einen ausdrücklichen Supervisor-Auftrag.

## Arbeitsregel fuer Fortschreibungen
- Bei jeder relevanten Neuerung `memory.md` versioniert aktualisieren.
- Fuer markante Staende zusaetzlich einen neuen Snapshot in diesem Ordner anlegen.
- Keine stillen inhaltlichen Verschiebungen.

## Aktueller Snapshot
- `docs/agent-memory/memory_v5.361_2026-08-15.md` ist der aktuelle versionierte Snapshot für den gemergten Main-Stand `5393363…`.
