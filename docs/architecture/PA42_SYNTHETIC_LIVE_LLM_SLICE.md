# PA42 Synthetic-Live LLM Slice

Status: shared-core-Vertrag, Prompt-Artefakte und Vertragstest; keine neue API, keine Persistenz, keine Runtime-Schreibwirkung
Stand: 2026-06-05
Scope: erster echter providerfaehiger synthetic-only Draft-Lauf hinter Feature-Flag fuer genau einen Use Case; keine echten Daten, keine Google-Drive-Angebote, keine Write-Tools und keine Runtime-`ConversationSession`

## 1. Zweck

PA42 setzt den kleinsten echten Schritt aus PA41 Option B um.

Der Slice bleibt eng:

- nur synthetische bekannte Eval-Fixtures,
- nur `clarification_draft_request`,
- nur menschlich freizugebender Draft,
- nur Feature-Flag `CATERING_SYNTHETIC_LLM_SLICE`,
- keine Produktobjekt-Schreibwirkung,
- keine neue API,
- keine Persistenz,
- keine echten Daten.

## 2. Neue Artefakte

- `shared-core/src/llm-readiness-prompt-artifacts.ts`
- `shared-core/src/llm-readiness-synthetic-live-slice.ts`
- `shared-core/src/llm-readiness-openai-transport.ts`
- `tests/pa42-synthetic-live-llm-slice.test.ts`
- `tests/pa42-openai-synthetic-live-transport.test.ts`

## 3. Was PA42 bewusst tut

- fuehrt erstmals nicht-leere Prompt-Artefakte fuer den Readiness-Korridor ein;
- erlaubt einen transportgestuetzten providerfaehigen Draft-Lauf fuer genau einen synthetischen Klaerungsfall;
- fuehrt einen kleinen OpenAI-Responses-Transport mit Structured Outputs fuer genau dieses Draft-Format ein;
- verlangt weiterhin bekannte sichere SourceRefs, Human Approval und `writesProductObject: false`;
- akzeptiert nur Inputs, die zu vorhandenen synthetischen Eval-Fixtures passen.

## 4. Was PA42 bewusst nicht tut

- kein echter Provider-SDK-Zwang,
- keine Produktobjekt-Updates,
- keine neue Route oder UI,
- keine freie Texteingabe,
- keine operator summary live,
- keine echten Uploads oder echten Angebotsdaten,
- keine Secrets im Repo.

## 4.1 Env-Grenzen

- `CATERING_SYNTHETIC_LLM_SLICE` aktiviert den Slice ueberhaupt.
- `OPENAI_API_KEY` bleibt ausserhalb des Repos.
- `CATERING_SYNTHETIC_LLM_MODEL` legt das konkrete Modell explizit fest.
- `CATERING_OPENAI_RESPONSES_URL` ist optional fuer abweichende Endpunkte.

## 5. Testanker

Gruen ist PA42, wenn:

- die Prompt-Artefakte nicht leer und konsistent zur Prompt-Schema-Registry sind,
- der Live-Slice bei aktivem Flag einen gueltigen synthetischen Klaerungs-Draft aus einem Transportergebnis baut,
- der Slice bei deaktiviertem Flag blockiert,
- der Slice nicht freigegebene Input-Kinds weiter ablehnt,
- SourceRef- oder Structured-Candidate-Drift zurueckgewiesen wird.
