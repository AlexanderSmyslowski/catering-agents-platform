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
npm run llm:synthetic-live:probe
```

Optional:

- `--fixture-id=<synthetic clarification fixture id>`
- `--provider-run-id=<custom run id>`

## Akzeptanz

- der Probe-Runner waehlt nur synthetische Clarification-Fixtures
- erfolgreiche Laeufe erzeugen ein `matched_provider`-Audit und ein
  `completed`-Run-Result
- fehlende Env-Werte oder deaktivierte Feature-Flags schlagen klar und lokal
  fehl
