# PA44 Synthetic-Live Probe Runner

## Ziel

Ueber dem PA42/PA43-Korridor gibt es jetzt einen kleinen Probe-Runner, der einen
synthetischen `clarification_draft_request` gegen den env-gated Live-Slice
ausfuehrt und das daraus entstehende `AgentAudit` und `RunResult` direkt
sichtbar macht.

## Umfang

- pure Orchestrierung in `shared-core`
- duenner `tsx`-Script-Einstieg im Repo
- nur synthetische Clarification-Fixtures
- keine UI
- keine API
- keine Persistenz
- keine Runtime-Conversation
- keine Schreibwirkung

## Warum dieser Schritt

PA42 und PA43 hatten den Live-Slice und seine Vertraege bereits gebaut. PA44
macht daraus einen bewusst ausfuehrbaren Probe-Pfad, ohne den Produktraum zu
beruehren. So laesst sich der erste echte Providerlauf lokal und transparent
pruefen.

## Aufruf

```bash
CATERING_SYNTHETIC_LLM_SLICE=1 \
OPENAI_API_KEY=... \
CATERING_SYNTHETIC_LLM_MODEL=... \
CATERING_OPENAI_RESPONSES_URL=... \
CATERING_LLM_PROCESSING_REGION=... \
CATERING_LLM_MAX_ESTIMATED_COST_EUR=... \
CATERING_LLM_RETENTION_POLICY=... \
CATERING_LLM_TRAINING_USE=contractually_excluded \
CATERING_DEFAULT_BUSINESS_ID=... \
CATERING_LLM_PROCESSING_APPROVAL_FILE=/secure/path/approval.json \
npm run llm:synthetic-live:probe
```

Der Default-OpenAI-Transport wird erst nach einem exakten serverseitigen
Abgleich dieser Laufzeitdaten mit der Approval-Datei ausgefuehrt. Die Datei
liegt ausserhalb des Repos, ist nicht schreibbar fuer Gruppe oder Welt und
enthaelt keine Rohtexte. Fehlt eine Angabe oder stimmt ein Feld nicht, bleibt
der Lauf geschlossen; ein Feature-Flag allein ist keine Freigabe.

Optional:

- `--fixture-id=<synthetic clarification fixture id>`
- `--provider-run-id=<custom run id>`

## Akzeptanz

- der Probe-Runner waehlt nur synthetische Clarification-Fixtures
- erfolgreiche Laeufe erzeugen ein `matched_provider`-Audit und ein
  `completed`-Run-Result
- fehlende Env-Werte oder deaktivierte Feature-Flags schlagen klar und lokal
  fehl
