# PA41 LLM Provider-/Daten-/Runtime-Entscheidungsrahmen

Status: Entscheidungsvorlage und Vertragstest, keine Runtime-Implementierung
Stand: 2026-06-05
Scope: erste bewusste Entscheidung nach PA40 fuer Provider, Datenrahmen, Logging, Secrets, Kosten und Runtime-Scope; kein Provider, keine Modellaufrufe, keine API, keine Persistenz, keine Migration, keine echten Daten und keine Schreibwirkung

## 1. Zweck

PA26 bis PA40 haben den providerlosen LLM-Readiness-Korridor geschlossen:

`Model-Input/Output -> Eval-Fixture -> Draft-Registry -> Input-/Output-Validation -> Prompt-/Schema-Registry -> Fixture-ProviderAdapter -> AgentAudit -> Run-Result`

Damit ist der naechste echte Fortschritt kein weiterer autonomer Vertragscode mehr, sondern eine bewusste Management- und Architekturentscheidung fuer den ersten echten synthetic-only LLM-Schritt.

PA41 macht diese Entscheidung fuer Alexander knapp, belastbar und ohne Architektur-Neuerfindung entscheidungsreif.

## 2. Fuehrende Quellen

- `docs/product/PRODUKTZIEL_CATERING_AGENTS_PLATFORM.md`
- `docs/architecture/PRODUCTION_AGENT_10_10_CODING_ARCHITECTURE.md`
- `docs/product/C11_10_10_GAP_AUDIT.md`
- `docs/architecture/PRODUCTION_AGENT_V1_ARCHITECTURE_GATE.md`
- `docs/architecture/B8_AUTH_GATE_DECISION_BOUNDARY.md`
- `docs/architecture/B13_PII_RETENTION_BACKUP_GATE.md`
- `docs/architecture/B14_SANDBOX_WORKER_AV_GATE.md`

## 3. Aktueller Stand

Bereits vorhanden:

- deterministischer interner Rehearsal-Kern mit browsernahen Smokes,
- providerlose LLM-Readiness-Kette bis `Run-Result`,
- Prompt-/Policy-/Schema-Artefakte als Vertragsanlaufstelle,
- keine Write-Tool-Orchestrierung,
- keine Runtime-`ConversationSession`,
- keine echten Daten, keine Provider-Secrets, keine Modellaufrufe.

Noch nicht vorhanden:

- freigegebener Provider und Account-/Kostenrahmen,
- Logging-/Prompt-/Response-Vorgaben fuer echte Modellaufrufe,
- Secret-Haltung ausserhalb des Repos,
- explizit erlaubter Datenmodus fuer den ersten echten Lauf,
- Entscheidung, ob der erste Schritt nur `clarification_question_draft` oder auch `operator_summary_draft` umfassen darf,
- Freigabe, ob der erste echte LLM-Slice nur lokal oder auch auf einer spaeteren nicht-sensitiven Zielumgebung laufen darf.

## 4. Entscheidung noetig

Kurzer Titel:

Erster echter LLM-Schritt nach PA40.

Warum jetzt?

Die autonome providerlose Vorbereitung ist abgeschlossen. Ohne bewusste Entscheidung zu Provider, Datenrahmen, Logging, Secrets, Kosten und Runtime-Scope wuerde jeder weitere Schritt still in einen Gate-Bereich kippen. PA41 trennt deshalb bewusst zwischen dem fertig vorbereiteten Korridor und dem ersten freizugebenden LLM-Slice.

## 5. Optionen

Option A:

- Beschreibung: Weiter rein providerlos bleiben; keine echten Modellaufrufe, nur deterministischen Kern, UI und dokumentierte Gates weiter haerten.
- Vorteile: Kein neues Sicherheits-, Kosten-, Logging- oder Datenrisiko. Voll staerkerer Fokus auf Rehearsal-Stabilitaet.
- Nachteile / Risiken: Kein praktischer Lerneffekt aus echten modellgestuetzten Draft-Laeufen. 10/10-Agentenfaehigkeit bleibt konzeptionell vorbereitet, aber nicht ausprobiert.
- Aufwand: niedrig.
- Empfehlung ja/nein: nein.

Option B:

- Beschreibung: Ein minimaler synthetic-only LLM-Slice hinter Feature-Flag wird freigegeben. Erlaubt ist genau ein Draft-Use-Case aus dem bestehenden PA26-PA40-Korridor, bevorzugt `clarification_question_draft` oder `operator_summary_draft`, nur mit synthetischen/demo Daten, ohne Runtime-`ConversationSession`, ohne Write-Tools, ohne neue API und ohne Persistenz.
- Vorteile: Erstes echtes Level-9-Lernen mit minimalem Scope. Die bestehende Prompt-/Schema-/Audit-/Run-Result-Kette kann gegen einen echten Provider geprueft werden, ohne Produktobjekt-Schreibwirkung.
- Nachteile / Risiken: Braucht Provider-/Account-Entscheidung, Secrets ausserhalb des Repos, Logging-Regeln, Kostenlimit und einen klaren Kill-Switch. Auch synthetic-only Modellaufrufe erzeugen Betriebs- und Governance-Aufwand.
- Aufwand: mittel.
- Empfehlung ja/nein: ja.

Minimal sichere Bedingungen fuer Option B:

- nur synthetic/demo Daten;
- keine echten Google-Drive-Angebote;
- kein Write-Tool;
- kein automatisches Schreiben in `AcceptedEventSpec`, `ProductionPlan` oder `PurchaseList`;
- kein Prompt-/Response-Logging mit sensiblen Inhalten;
- Secrets nur ausserhalb des Repos;
- explizites Kostenlimit und abschaltbarer Feature-Flag;
- Human Approval bleibt immer erforderlich.

Option C:

- Beschreibung: Breiterer LLM-Slice mit Runtime-`ConversationSession`, mehreren Use Cases, echten oder pilotnahen Daten, Write-Pfaden oder Tool-Orchestrierung.
- Vorteile: Schnellere Naeherung an einen "echten" Agenten.
- Nachteile / Risiken: Beruehrt mehrere harte Gates gleichzeitig: Daten, Runtime, Tool-Orchestrierung, Audit, moegliche Persistenz-/API-Erweiterungen und spaeter Auth/PII/Retention/Sandbox. Hoher Fehlentscheidungs- und Scope-Drift-Risiko.
- Aufwand: hoch.
- Empfehlung ja/nein: nein.

## 6. Empfehlung

Klare Empfehlung:

Option B in der minimalen sicheren Form.

Das ist der kleinste echte Schritt Richtung 10/10-Agentenfaehigkeit, ohne gleich in Runtime-, Daten- oder Write-Tool-Ausweitung zu geraten. Alles Groessere waere derzeit zu frueh; alles Kleinere bringt uns beim LLM-Thema nicht mehr praktisch weiter.

## 7. Konsequenz

Was passiert nach Auswahl?

- Bei Option A: weiter nur deterministischer Kern, UI-Klarheit, Rehearsal und Entscheidungsdokumente; kein echter LLM-Slice.
- Bei Option B: naechster Implementierungsschnitt ist ein enger providerbasierter synthetic-only Draft-Lauf hinter Feature-Flag mit bestehendem PA26-PA40-Vertrag, Audit und Run-Result.
- Bei Option C: vor Implementierung muessen weitere harte Gates neu geschnitten und separat freigegeben werden; kein direkter Bau ohne zusaetzliche Entscheidungen.

## 8. Sicherer Default

Was passiert, wenn Alexander nicht entscheidet?

Der sichere Default bleibt:

- kein Provider,
- keine Modellaufrufe,
- keine echten Daten,
- keine Runtime-`ConversationSession`,
- keine Write-Tool-Orchestrierung,
- weiter nur providerlose Readiness, deterministischer Kern und UI-/Rehearsal-Haertung.
