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
- Aufgabe 8 ist nicht begonnen; Aufgaben 8 bis 12 benötigen einen ausdrücklichen Supervisor-Auftrag
- aktuelle Detailhistorie liegt unter `docs/agent-memory/`
- `memory_current.md` bleibt als historische Referenzdatei erhalten

## Hinweis fuer neue Agenten
Beginne mit dem Central-Agent-Data-Hub-Startbefehl und danach mit `memory.md`.

## Aktueller Stage-A-Handoff – 2026-08-15
- PR #612 auf `loop/stage-a-complete-chain` enthält den ungemergten Task-12-Kandidaten: Migration, unveränderliche Angebots-/Produktionskette, Business-Isolationsmatrix, UI-Reload-/Search-/Revision-/Copy-Fluss und die geprüften Boundary-Entfernungen.
- `hostedMultiBusinessReady` ist im Kandidaten codefest `true`, weil die vollständige Route-/Store-/Audit-/Export-Matrix geprüft wurde; Umgebungsflags können das Gate nicht umgehen.
- Der Kandidat steht vor dem Merge auf Basis `66f354c7715e766b59d9f6407638c05da5ad3394`; der Folgefix für den sandboxierten macOS-Fingerprint ist uncommittet und braucht eine neue unabhängige Prüfung. Die alten Aussagen „Aufgabe 8 nicht begonnen“ und „Aufgaben 8 bis 12 offen“ sind historische Stände, keine aktuelle Freigabe.
