# PA52 Synthetic-Live Local Operator Runbook

Status: Doku-/Vertragstest-only Operator-Runbook, keine neue Runtime-Implementierung
Stand: 2026-06-05
Scope: kleinster lokale Bedienrahmen fuer den bereits vorhandenen
`synthetic_live`-Korridor nach PA42-PA50 und der Entscheidungsvorlage aus PA51;
kein Deployment, keine neuen APIs, keine Persistenz, keine echten Daten und
keine Schreibwirkung

## 1. Zweck

PA51 empfiehlt Option B in der kleinsten lokalen Form: Der vorhandene
`synthetic_live`-Korridor darf bewusst lokal genutzt werden, aber nur unter
engen Operator-, Secret-, Kosten- und Human-Approval-Regeln.

Dieses Runbook operationalisiert genau diesen kleinsten lokalen Rahmen, ohne
den technischen Scope zu erweitern.

## 2. Geltungsbereich

Dieses Runbook gilt nur fuer:

- benannte interne Operatoren,
- lokale Ausfuehrung auf einer eigenen Workstation oder in einem bewusst
  lokalen Dev-Kontext,
- synthetische oder Demo-Fixtures,
- produktfreie Clarification-Drafts,
- den bestehenden Repo-Korridor aus `preflight`, `probe`, `probe:strict` und
  `check`.

Es gilt ausdruecklich nicht fuer:

- echte Kunden-, Personen-, Einsatz- oder Angebotsdaten,
- Deployment, Shared-Umgebungen oder Serverbetrieb,
- neue Write-Tools oder Produktschreibwirkung,
- Runtime-`ConversationSession`,
- neue APIs, Persistenz oder Migrationen,
- Raw Prompt-/Response-Sammlungen in Repo, PR, Ticket oder Chat.

## 3. Lokale Voraussetzungen

Vor jedem echten Probe-Lauf muessen lokal geklaert sein:

- `CATERING_SYNTHETIC_LLM_SLICE=1`,
- `OPENAI_API_KEY` nur lokal ausserhalb des Repos gesetzt,
- `CATERING_SYNTHETIC_LLM_MODEL` bewusst lokal gesetzt,
- ein expliziter `CATERING_OPENAI_RESPONSES_URL`,
- serverseitige Laufzeitfakten fuer Business, Region, Kosten, Retention und
  vertraglich ausgeschlossene Trainingsnutzung,
- eine passende `CATERING_LLM_PROCESSING_APPROVAL_FILE` ausserhalb des Repos,
- nur ein vorab freigegebenes Low-Cost-Modell pro Operatorfenster,
- ein expliziter Test- oder Monatskostenrahmen,
- nur synthetische Fixtures im geplanten Lauf.

Secrets gehoeren nicht in Git, nicht in `memory.md`, nicht in Commit-Messages,
nicht in PR-Beschreibungen und nicht in Build-Logs.

## 4. Empfohlener Ablauf

1. Preflight zuerst:

   ```bash
   npm run llm:synthetic-live:preflight
   ```

   Der Lauf muss Feature-Flag, benoetigte Env-Werte, Prompt-Artefakte und
   vorhandene Clarification-Fixtures lokal gruenerklaeren.

2. Kompakter Evidence-Check:

   ```bash
   npm run llm:synthetic-live:check
   ```

   Das ist der bevorzugte Standardweg fuer einen echten lokalen Probe-Lauf,
   weil er Preflight und Strict-Probe zusammenhaelt.

3. Nur bei bewusstem Bedarf zusaetzlich:

   ```bash
   npm run llm:synthetic-live:probe
   ```

   Dieser Lauf darf fuer lesbares lokales JSON genutzt werden, aber nicht als
   Vorwand fuer freiere Modell-, Daten- oder Logging-Experimente.

## 5. Auswertung und Human Approval

Der Lauf ist nur dann innerhalb des lokalen Korridors erfolgreich, wenn:

- `evaluation` keinen Drift gegen die synthetische Fixture meldet,
- `AgentAudit` den Lauf als lokalen `synthetic_live`-Nachweis erklaert,
- `RunResult` keine Produktschreibwirkung ausweist,
- ein Mensch den Draft bewusst prueft, bevor Inhalte manuell weiterverwendet
  werden.

Human Approval bleibt Pflicht. Ein gelungener Probe-Lauf ist kein
Selbstfreigabe-Signal fuer Produktobjekte, keine automatische Uebernahme und
kein Produktivbetrieb.

## 6. Stop-Kriterien

Sofort abbrechen und nicht weiter eskalieren, wenn:

- der Preflight fehlende oder unsaubere lokale Voraussetzungen meldet,
- `probe:strict` mit Eval-Drift oder Probe-Fehler endet,
- ein echter Datensatz, ein Shared-Kontext oder ein nicht-lokales Zielsystem
  beruehrt waere,
- das Modell frei gewechselt oder der Kostenrahmen unscharf wird,
- jemand Rohprompts, Rohresponses oder Secret-Material persistent festhalten
  will.

Dann gilt wieder der sichere Default aus PA51:

- lokal begrenzt,
- synthetic/demo only,
- keine Produktschreibwirkung,
- keine Runtime-Ausweitung ohne neue Alexander-Entscheidung.
