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
- Governance-Pfad bis Stufe 6c konsolidiert
- Stufe 6c als kleiner read-only UI-/Transparenzschritt umgesetzt
- keine neue Fachlogik, keine neue API, keine neue Persistenz, keine neue Freigabelogik
- aktuelle Detailhistorie liegt unter `docs/agent-memory/`
- `memory_current.md` bleibt als Referenzdatei erhalten

## Hinweis fuer neue Agenten
Beginne mit dem Central-Agent-Data-Hub-Startbefehl und danach mit `memory.md`.
