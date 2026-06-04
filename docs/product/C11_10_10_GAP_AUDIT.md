# C11 10/10-Gap-Audit

Status: Doku-/Vertragstest-only Gap-Audit, keine Runtime-Implementierung
Stand: 2026-06-05
Scope: aktueller Weg von belastbarem internem Rehearsal zu echter 10/10-Produktreife; keine echten Daten, kein Deployment, keine Auth-/LLM-/Persistenz-/API-Umsetzung

## 1. Zweck

Dieses Dokument macht den aktuellen Abstand zur 10/10-Zielreife sichtbar.

Es trennt hart zwischen:

- umgesetzt,
- getestet,
- dokumentiert,
- geplant,
- offen,
- blockiert,
- Entscheidung erforderlich.

10/10 bedeutet hier nicht externe SaaS, Multi-Tenant oder unbeaufsichtigte Vollautomatik. 10/10 bedeutet eine interne, stabile, sehr einfache Catering-Produktions-App mit ruhigem Arbeitsfenster, deterministischem Produktionskern, nachvollziehbaren Export-/Auditankern und kontrolliert vorbereiteter Agentenfaehigkeit.

## 2. Fuehrende Quellen

- `docs/product/PRODUKTZIEL_CATERING_AGENTS_PLATFORM.md`
- `docs/architecture/PRODUCTION_AGENT_10_10_CODING_ARCHITECTURE.md`
- `docs/architecture/PRODUCTION_AGENT_V1_ARCHITECTURE_GATE.md`
- `docs/product/PA6_INTERNAL_BETA_READINESS_SUMMARY.md`
- `docs/product/P12_N2_MANAGEMENT_GO_NO_GO_ENTSCHEIDUNGSPAKET.md`
- `docs/deployment/B37_NONSENSITIVE_TECHNICAL_PREPARATION_PLAN.md`
- `README.md`
- `TESTING.md`
- `memory.md`

## 3. Harte Einordnung

| Bereich | Status | Beleg | 10/10-Gap |
| --- | --- | --- | --- |
| Interner synthetischer Rehearsal-Kern | umgesetzt und getestet | `npm run browser:rehearsal:full-fresh`, `npm test`, `npm run build`, Main-CI | kein echter Daten-, Pilot- oder Produktionsbeleg |
| Start -> Angebot -> Produktion -> Rueckfragen -> Produktionsplan -> Einkaufsliste -> Export | umgesetzt und getestet | Browser-Rehearsal, Route-Smokes, Produktions-Smokes | bleibt synthetisch/lokal; keine externe Freigabe |
| Fehlupload, Soft-Archiv, Reload, Clear, stale Ergebniszonen | umgesetzt und getestet | Browser-Rehearsal-Modi, `tests/backoffice-production-acceptance-smoke.test.ts`, `tests/browser-rehearsal-script-contract.test.ts` | keine Retention-/Backup-/Echtdaten-Aussage |
| Ruhiges Arbeitsfenster / Produktions-UX | umgesetzt fuer internen MVP-Korridor, weiter verbesserbar | UI-Komponenten, Route-Smokes, Workbench-Smokes | echtes chatzentriertes Agentenfenster bleibt Zielbild, keine grosse UI-Neugestaltung ohne Entscheidung |
| Codeklarheit im Produktionskern | fortgeschritten, aber nicht final | extrahierte `App.tsx`-Boundaries, kleine Planning-/RecipeDiscovery-Module, viele fokussierte Tests | weitere kleine Boundaries sind moeglich; kein Big-Bang-Refactor |
| Deterministische Planung, Rezeptsuche, Einkaufsliste | umgesetzt und breit getestet | `production-service/src/rules/*`, `recipe-discovery/*`, Produktions-/Recipe-/Purchase-Tests | weitere synthetische Catering-Faelle und Qualitaetschecks koennen autonom nachziehen |
| Conversation/Rueckfragen | teilweise umgesetzt | `ProductionConversationProjection`, Clarification-Fragen/-Antworten, read-only UI | echte `ConversationSession` als Runtime-Objekt bleibt Entscheidungspflicht |
| LLM-Readiness ohne Provider | als kleiner Vertrag weitgehend bis Level-9-Vorbereitung umgesetzt | 10/10-Coding-Architektur, PA26-PA40 | nicht-leere Prompt-Artefakte und eine entscheidungsreife Provider-/Daten-/Runtime-Vorlage fehlen noch |
| LLM-Provider / Modellaufrufe | blockiert | 10/10-Coding-Architektur, Produktziel | Alexander-Entscheidung zu Provider, Kosten, Logging, Secrets, Datenrahmen erforderlich |
| Tool-Orchestrierung mit Schreibwirkung | blockiert | 10/10-Coding-Architektur, Produktziel | Entscheidung zu Tool-Allowlist, Auth/Rollen, Audit, Human Approval erforderlich |
| Auth/OIDC/IAP/Proxy fuer echte Nutzung | dokumentiert, nicht umgesetzt | B8, B9, B10, PA9 | Alexander-Entscheidung und Umsetzung erforderlich |
| PII/Retention/Backup/Restore | dokumentiert, blockiert | B13, B36, P12-N2 | Alexander-Entscheidung erforderlich |
| Sandbox/Worker/AV fuer echte Uploads | dokumentiert, blockiert | B14, B37 | Alexander-Entscheidung erforderlich |
| Deployment / produktionsnahe echte Daten | dokumentiert, blockiert | B25-B37, P12-N2 | kein Server-/Secret-/ENV-/Echtdaten-Go |

## 4. Was bereits 9/10 traegt

- Der interne synthetische Produktionspfad ist browsernah reproduzierbar.
- Die UI vermeidet bekannte stale Ergebniszonen nach Clear, Reload, Fehlupload und Soft-Archiv.
- Der deterministische Kern bleibt fuehrend; Exporte und Audit sind interne Arbeitsbelege.
- `App.tsx` ist weiter Orchestrator und nicht mehr der Hauptcontainer fuer jeden einzelnen State-/UI-Schnitt.
- Main-CI, Vitest, Build und Browser-Rehearsal bilden eine belastbare interne Rehearsal-Basis.

## 5. Was 10/10 noch blockiert

10/10 als echter interner ProductionAgent ist nicht nur mehr UI-Polish. Blockierend sind vor allem Gates:

- echte Daten und echte Google-Drive-Angebote,
- Auth/OIDC/IAP/Proxy,
- PII/Retention/Backup/Restore,
- Sandbox/Worker/AV,
- Deployment und Betriebsverantwortung,
- echte `ConversationSession`-Runtime,
- LLM-Provider, Kosten, Logging, Secrets und Datenuebertragung,
- Tool-Orchestrierung mit Schreibwirkung,
- Human Approval fuer produktionsrelevante Uebernahmen.

Diese Punkte duerfen nicht autonom in Runtime-Code kippen.

## 6. Naechster autonomer Schritt

Der naechste nicht-gate-pflichtige Fortschritt ist:

`LLM-Readiness-Vertrag ohne LLM-Provider`

Minimaler Scope:

- Model-Input-/Output-Grenze als Doku-/Testvertrag oder kleiner schema-naher Anchor,
- Tool-Allowlist zunaechst nur als Read-/Draft-/Write-Klassifikation,
- synthetische Eval-Fixtures nur als nicht-sensitive Erwartungsanker,
- klare Verbote: kein Provider, keine Secrets, keine Modellaufrufe, keine neue API, keine Persistenz, keine echten Daten, keine Schreibwirkung.

Warum dieser Schritt:

- Er fuehrt Richtung echter Agentenfaehigkeit.
- Er verletzt keine harten Gates.
- Er macht spaetere LLM-Entscheidungen entscheidungsreif statt improvisiert.
- Er haelt den deterministischen Kern fuehrend.

PA26 setzt den ersten Teil dieses Schritts um: einen kleinen `shared-core`-Vertrag fuer Model-Input-/Output-Drafts, Tool-Effektklassen, Human-Approval-Pflicht und harte No-go-Grenzen ohne Provider oder Runtime-Schreibwirkung. PA27 ergaenzt synthetische Eval-Fixtures fuer diese Grenze. PA28 verbindet diese Bausteine ueber schema-only Draft-Kontrakte ohne Prompttext, Provider, Secrets, echte Daten, API, Persistenz oder Schreibwirkung. PA29 macht die Input-Seite des Vertrags validierbar und lehnt Provider-, Echtdaten-, Write-Tool- und Rohpayload-Kandidaten ab. PA30 validiert komplette synthetische Eval-Fixtures zentral gegen Input, Output, Draft-Registry, SourceRefs und Forbidden-Payload-Grenzen. PA31 begrenzt SourceRefs runtime-seitig auf bekannte sichere Arbeitsbelegtypen. PA32 begrenzt strukturierte Draft-Outputs auf flache Scalar-Maps ohne verschachtelte Payloads oder verbotene Schluessel. PA33 bindet auch erwartete Eval-Outputs an die Required-SourceRefs des Draft-Kontrakts. PA34 verhindert SourceRef-ID-Drift zwischen Input und erwartetem Output. PA35 stellt sicher, dass jeder registrierte Draft-Kontrakt mindestens eine gueltige synthetische Eval-Fixture hat. PA36 vergleicht synthetische Output-Kandidaten providerlos gegen gueltige Fixture-Erwartungen. PA37 registriert versionierte Prompt-, Policy- und Output-Schema-Artefakte pro Draft-Kontrakt ohne Prompttext oder Provider-Ausfuehrung. PA38 fuegt einen fixture-only ProviderAdapter hinzu, der nur gueltige synthetische Inputs auf vorhandene Fixture-Erwartungsoutputs mappt. PA39 verdichtet diese Kette in einen providerlosen AgentAudit-Anker fuer Prompt-/Policy-/Schema-Metadaten, Adapter-Modus, Approval-Grenze und Fehlerstatus. PA40 fasst Request, Adapter-Response und AgentAudit in ein synthetic-only Run-Result-Artefakt zusammen. Danach bleibt als naechster autonomer Schritt eine entscheidungsreife Vorlage fuer den LLM-Provider-/Daten-/Runtime-Rahmen.

## 7. Sicherer Default

Wenn keine Alexander-Entscheidung vorliegt:

- weiter synthetisch/lokal testen,
- Produktionskern und UI in kleinen PRs haerten,
- LLM-Readiness nur ohne Provider, Secrets, echte Daten und Runtime-Schreibwirkung vorbereiten,
- echte Daten, Auth, Deployment, Retention/Backup, Sandbox/AV und LLM-Provider blockiert lassen.
