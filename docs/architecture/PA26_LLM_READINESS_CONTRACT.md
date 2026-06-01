# PA26 LLM-Readiness-Vertrag ohne Provider

Status: shared-core-Vertrag und Vertragstest, keine LLM-Runtime
Stand: 2026-06-01
Scope: erster kleiner 10/10-Vorbereitungsschnitt nach C11; kein Provider, keine Secrets, keine Modellaufrufe, keine neue API, keine Persistenz, keine Migration, keine echten Daten und keine Schreibwirkung

## 1. Zweck

PA26 schafft eine kleine, testbare Grenze fuer spaetere LLM-Readiness, ohne einen LLM anzuschliessen.

Der Vertrag beantwortet nur:

- Welche Tool-Effekte duerfen in der Vorbereitung gedacht werden?
- Welche Model-Input-/Output-Arten sind als reine Draft-Kandidaten zulaessig?
- Welche Gates bleiben vor Runtime, Provider und Schreibwirkung zwingend offen?

Er beantwortet nicht:

- welchen Provider wir nutzen,
- welche Prompts produktiv laufen,
- welche echten Daten an ein Modell gehen,
- welche Tools echte Schreibwirkung bekommen.

## 2. Codeanker

Der Codeanker liegt in:

- `shared-core/src/llm-readiness.ts`
- `shared-core/src/llm-readiness.js`

Er exportiert:

- `llmReadinessContractVersion`
- `llmReadinessForbiddenBoundaries`
- `llmReadinessToolBoundaries`
- `LlmReadinessModelInput`
- `LlmReadinessModelOutputCandidate`
- `validateLlmReadinessModelInputCandidate(...)`
- `validateLlmReadinessModelOutputCandidate(...)`

Dieser Code ist absichtlich klein und additiv. Er wird nicht von Services, UI oder Runtime-Orchestrierung ausgefuehrt.

## 3. Erlaubte Vorbereitung

Erlaubt ohne weitere Gate-Entscheidung:

- read-only Referenzen auf vorhandene Produktobjekte,
- Draft-Kandidaten fuer Rueckfragen oder Operator-Zusammenfassungen,
- synthetische oder Demo-Kontexte,
- Human-Approval-Pflicht als harte Eigenschaft von Draft-Outputs,
- `writesProductObject: false` als harte Eigenschaft von Draft-Outputs.

Die erlaubten Tool-Effektklassen sind:

- `read`: bestehende Objekte nur lesen,
- `draft`: Vorschlag erzeugen, aber nicht schreiben,
- `write`: als Kategorie sichtbar, aber `decision_required`.

## 4. Harte Verbote

PA26 bleibt innerhalb dieser Grenzen:

- `noProvider`
- `noProviderSecrets`
- `noModelCalls`
- `noRealData`
- `noApiEndpoint`
- `noPersistence`
- `noMigration`
- `noRuntimeConversationSession`
- `noProductObjectWrites`
- `noToolOrchestrationWithWriteEffect`

Output-Kandidaten duerfen ausserdem keine Rohpayload-Felder wie `rawText`, `extractedText`, `prompt`, `messages`, `providerResponse`, `toolCalls`, `secret` oder `apiKey` tragen.

## 5. Entscheidungspflichtig

Alexander muss vor jedem naechsten echten LLM-Schritt entscheiden, wenn eines davon noetig wird:

- LLM-Provider, Modell, Kosten, Logging, Secrets oder Datenuebertragung,
- echte Daten oder echte Google-Drive-Angebote,
- neue API-Endpunkte,
- neue Persistenz oder Migration,
- echte `ConversationSession`-Runtime,
- Tool-Orchestrierung mit Schreibwirkung,
- Auth/OIDC/IAP/Proxy fuer produktionsnahe Nutzung,
- PII/Retention/Backup/Restore,
- Sandbox/Worker/AV,
- Deployment oder externe Freigabe.

## 6. Definition of Done

PA26 ist erfuellt, wenn:

- `shared-core/src/llm-readiness.ts` die kleine Vertragsschicht enthaelt,
- read- und draft-Tools ohne Provider sichtbar sind,
- write-Tools nur als `decision_required` klassifiziert sind,
- Model-Output-Kandidaten Human Approval verlangen und keine Produktobjekte schreiben,
- Model-Input-Kandidaten Provider-Aufrufe deaktivieren, synthetische/Demo-Daten deklarieren und keine Write-Tool-Effekte erlauben,
- Rohtext-/Prompt-/Provider-/Secret-/Toolcall-Payloads abgelehnt werden,
- `tests/pa26-llm-readiness-contract.test.ts` gruen ist,
- `npm run build` gruen ist.
