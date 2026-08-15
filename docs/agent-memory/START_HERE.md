# START_HERE.md

Dies ist der kanonische Einstiegspunkt fuer neue Chatfenster, Hermes Agent, Codex 5.4 mini und aehnliche Arbeitskontexte.

## Verbindliche Lesereihenfolge
1. Central Agent Data Hub Start:

```bash
/Users/alexandersmyslowski/Projects/central-agent-data-hub/scripts/agent_start.sh \
  --project catering-agents-platform \
  --query "<aktueller arbeitsfokus>"
```

2. `memory.md`
3. `AGENTS.md`
4. `HANDOFF_PROMPT.md`
5. `docs/agent-memory/README.md`
6. `docs/agent-memory/memory_v5.23_2026-04-11.md`

## Warum diese Datei existiert
Damit neue Sessions den konsolidierten Stand ohne Umwege finden. Die fuehrende Root-Memory-Datei ist `memory.md`.

## Aktueller Kurzstand
- Stage-A-Kontrollpunkt bestanden; der Codeanker ist `51f6cbc36f9f3ec93f5b7fd7d5d7cdb170e15e3b`, die geprüfte Übergabe ist über PR 598 in `main` aufgenommen
- Aufgaben 1 bis 7 sind zusammengeführt; PR 596 und PR 597 sind abgeschlossen
- Externe KI-Aufrufe bleiben ohne exakt passende serverseitige Freigabe geschlossen; Fixture-Betrieb bleibt lokal
- PR #612 ist als `5393363fd5a0d7453461eca9bc141655c232b21a` in `main` gemergt; Task 12 und die acht unabhängig geprüften Reviewbefunde sind enthalten. Weitere Stage-A-Arbeit benötigt einen ausdrücklichen Supervisor-Auftrag.
- aktuelle Detailhistorie liegt unter `docs/agent-memory/`
- `memory_current.md` bleibt als historische Referenzdatei erhalten

## Hinweis fuer neue Agenten
Beginne mit dem Central-Agent-Data-Hub-Startbefehl und danach mit `memory.md`.

## Aktueller Stage-A-Handoff – 2026-08-15
- Der gemergte PR #612 auf `loop/stage-a-complete-chain` umfasst im Main-Stand: Migration, unveränderliche Angebots-/Produktionskette, Business-Isolationsmatrix, UI-Reload-/Search-/Revision-/Copy-Fluss und die geprüften Boundary-Entfernungen.
- `hostedMultiBusinessReady` ist im gemergten Stage-A-Stand codefest `true`, weil die vollständige Route-/Store-/Audit-/Export-Matrix geprüft wurde; Umgebungsflags können das Gate nicht umgehen.
- PR #612 wurde aus dem historischen Head `bf255be310aadca56bc0b5cfbff2c7cd1da46097` mit Tree `c9fbab19a70426c9c461356b75953304b41e5761` als `5393363fd5a0d7453461eca9bc141655c232b21a` in `main` aufgenommen. Main-CI Run `31897217407` ist mit `build-and-test` und `browser-rehearsal` terminal erfolgreich. Deployment und produktive Migration sind nicht belegt oder freigegeben; ältere offene-PR-Aussagen bleiben historische Stände.
