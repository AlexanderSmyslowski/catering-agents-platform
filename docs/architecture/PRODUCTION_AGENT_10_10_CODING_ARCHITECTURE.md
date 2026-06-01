# ProductionAgent 10/10 Coding Architecture

Status: aktualisierte Coding-Architektur, keine Runtime-Implementierung
Datum: 2026-05-25
Scope: verbleibende technische Schritte bis zu einem intern nutzbaren ProductionAgent, bei dem LLM-Unterstuetzung angeschlossen ist und der Kernfluss einfach laeuft

## 1. Kurzfassung

Das Ziel "LLM anschliessen und es laeuft einfach" darf nicht bedeuten, ein Modell direkt auf Rohdaten und Produktionsentscheidungen loszulassen.

Der robuste Weg zu 10/10 ist:

1. deterministischen Produktionskern stabilisieren
2. Daten-, UI- und Rueckfragepfade reproduzierbar machen
3. LLM-faehige Schnittstellen ohne Provider-Runtime vorbereiten
4. LLM erst hinter klaren Gates, Schemas, Tool-Allowlist, Kostenlimit und Human Approval anschliessen
5. produktionsnahe Nutzung erst nach Auth-, PII-/Retention-/Backup-, Sandbox-/Worker-/AV- und Betriebsentscheidungen

Aktueller realistischer Coding-Stand:

```text
Interner lokaler Rehearsal-/MVP-Korridor: ca. 6.5/10
Deterministischer Produktionskern mit synthetischem Quick-Lunch-Smoke: ca. 7/10
LLM-faehiger ProductionAgent-v1: noch nicht gebaut
Produktionsnahe echte Datennutzung: blocked
```

10/10 bedeutet in diesem Dokument nicht externe SaaS, Multi-Tenant oder unbeaufsichtigte Vollautomatik.

10/10 bedeutet:

- interner Single-Instance-Betrieb ist klar gefuehrt
- Upload/Text -> Normalisierung -> Rueckfragen -> Produktionsplan -> Einkaufsliste -> Export laeuft reproduzierbar
- LLM hilft beim Verstehen, Fragen, Zusammenfassen und Vorschlagen
- deterministische Regeln bleiben fuehrend fuer Produktobjekte
- Mensch gibt produktionsrelevante Ergebnisse frei
- Betrieb, Datenschutz, Sicherheit und Kosten sind bewusst entschieden

## 2. Fuehrende Architekturregeln

Weiterhin verbindlich:

- `AcceptedEventSpec` bleibt operative Spezifikationsgrundlage.
- `ProductionPlan` bleibt pruefbares Produktionsobjekt.
- `PurchaseList` bleibt abgeleitetes Einkaufsobjekt.
- `Recipe` und Rezeptbibliothek bleiben interne fachliche Quelle.
- `ProductionClarificationQuestion` und `ProductionClarificationAnswer` bleiben strukturierte Rueckfrage-/Antwortanker.
- `ProductionConversationProjection` bleibt Projektion aus vorhandenen Objekten, nicht freie Chat-Wahrheit.
- Export- und Auditspuren bleiben interne Arbeitsbelege, keine rechtssichere Compliance.

Der spaetere LLM-Orchestrator darf:

- strukturierte Kandidaten erzeugen
- Rueckfragen vorschlagen
- vorhandene Objekte erklaeren
- Tool-Aufrufe ueber eine Allowlist anstossen
- Zusammenfassungen fuer Operatoren erzeugen

Der spaetere LLM-Orchestrator darf nicht:

- ohne Schema in Produktobjekte schreiben
- ohne Human Approval Produktionsfreigaben erzeugen
- automatisch `event.schedule` oder kritische Spezifikationsdaten korrigieren
- echte Daten ohne freigegebene Gates verarbeiten
- neue Persistenz/API/Migration implizit einfuehren
- Rezept-/Allergen-/Kostenwahrheit allein behaupten

### 2.1 Autonomie-Korridor fuer Codex/Hans

Der fruehere Entscheidungsmodus war bewusst konservativ, ist fuer den aktuellen Baupfad aber zu eng, wenn er jeden kleinen planfolgenden Code-Slice stoppt.

Codex/Hans darf deshalb autonom entscheiden und umsetzen, wenn alle Bedingungen gleichzeitig erfuellt sind:

- der Schritt staerkt den bestehenden internen MVP-/Rehearsal-Korridor;
- der Schritt folgt direkt aus diesem Architekturplan, dem Produktziel, `AGENTS.md`, `memory.md` oder bestehenden Plan-/P-Dokumenten;
- der Schritt ist klein, lokal, reviewbar, testbar und reversibel;
- der Schritt bleibt in vorhandenen Modulen, APIs, Datenmodellen und Persistenzgrenzen;
- der Schritt nutzt nur synthetische, Demo- oder lokale Testdaten;
- der Schritt kann mit vorhandenen Tests, Smokes, Build oder Doku-/Contract-Tests belegt werden;
- der Schritt erzeugt keine neue Freigabe-, Compliance-, Betriebs- oder echte-Daten-Behauptung.

Autonom bevorzugte Arbeit:

- Produktionskern-Smokes fuer synthetische Lunch-, Buffet-, Empfang-, Flying-Bites- und Kaffeepausenfaelle;
- enge Rezept-Matching- und Importqualitaets-Haertungen fuer belegte Catering-Gerichte;
- UI-Wartbarkeit, Stale-Fokus-, Empty-/Loading-State- und Export-/Audit-Lesbarkeit ohne neue Produktflaeche;
- Einkaufslistenqualitaet, Einheiten-/Gruppen-Checks und Schutz gegen Zubereitungsschritte als Einkaufspositionen;
- Doku-/Contract-Klaerungen, die vorhandene Gates schaerfer operationalisieren;
- lokale Rehearsal- und Browser-Smoke-Evidenz mit synthetischen Daten.

Alexander-Entscheidung ist erst noetig, wenn der Schritt eine harte Gate-Grenze beruehrt: echte Daten, echte Google-Drive-Angebote, produktionsnahe Uploads, Auth/OIDC/IAP/Proxy, PII/Retention/Backup/Restore, Sandbox/Worker/AV, Deployment, neue API, neue Persistenz/Migration, neue Runtime-ConversationSession, LLM-Provider/Secrets/Kosten/Logging/Datenuebertragung oder Write-Tools mit produktionsrelevanter Wirkung.

Sicherer Default: Wenn unklar ist, ob ein Schritt autonom erlaubt ist, wird er auf die naechste kleinere Variante reduziert. Wenn auch diese Variante noch eine Gate-Grenze beruehrt, wird eine Entscheidungsvorlage erstellt statt Runtime-Code gebaut.

## 3. Zielarchitektur in Schichten

### 3.1 Backoffice UI

Verantwortung:

- ruhige Arbeitsflaeche fuer Start, Angebot, Produktion, Rueckfragen, Exporte und Audit-/Handoff-Belege
- sichtbare Trennung von aktivem Vorgang, sekundaeren Details, Exporten und offenen Stop-Punkten
- keine Scheingruenheit

Naechste Coding-Arbeit:

- `backoffice-ui/src/App.tsx` weiter in kleine Komponenten schneiden
- Produktionsfrage-/Antworteditor als naechsten Kandidaten isolieren
- Browser-Rehearsal fuer synthetischen Quick-Lunch als wiederholbare Evidenz etablieren

Kein 10/10 ohne:

- echte Browser-Kernpfade fuer Start -> Angebot -> Produktion -> Rueckfragen -> Export
- klare Empty-/Loading-/Stale-Fokus-Zustaende
- keine echte Datenprobe ohne Gate

### 3.2 Intake und DocumentIngestion

Verantwortung:

- sichere Aufnahme von Text, PDF, E-Mail und spaeter optional Drive-Quellen
- Metadaten, Warnungen und Ingestion-Status sichtbar machen
- Rohtext und extrahierten Text nicht unkontrolliert spiegeln

Naechste Coding-Arbeit:

- synthetische Importfixtures fuer haeufige Catering-Angebotsformen
- Fehlupload-Archivpfad nur nach C9-Entscheidung
- Parser-/Importqualitaet anhand klarer synthetischer Faelle haerten

Entscheidungspflichtig:

- echte Google-Drive-Angebote
- echte Uploads mit Personen-/Kundendaten
- Sandbox/Worker/AV fuer produktionsnahe Dateiverarbeitung
- Retention/Backup fuer Rohdateien und Extrakte

### 3.3 Production Core

Verantwortung:

- deterministische Planung aus `AcceptedEventSpec`
- Rezeptauswahl, Mengen, Arbeitsblaetter und Einkaufsliste
- klare `unresolvedItems` statt aggressiver Automatik

Naechste Coding-Arbeit:

- weitere synthetische Buffet-/Lunch-/Fingerfood-Faelle als Regressionen
- Rezept-Matching fuer haeufige interne Speisen schrittweise haerten
- Einkaufsliste auf Zutatenqualitaet, Gruppen und Einheiten pruefen
- Focaccia/Hybridfaelle als Human-in-the-loop statt stiller Zuordnung schuetzen

Kein 10/10 ohne:

- reproduzierbare E2E-Smokes fuer mindestens Lunch, Buffet, Empfang/Flying, Kaffeepause
- klare Stop-Punkte bei kreativen oder zusammengesetzten Angebotszeilen
- interne Rezepttreffer werden bevorzugt, Web-/Fallback bleibt transparent

### 3.4 Conversation und Rueckfragen

Aktueller Stand:

- Es gibt Clarification-Fragen, Antworten und read-only Conversation-Projektion.
- Es gibt noch keine vollwertige `ConversationSession` als fuehrendes Runtime-Produktobjekt.

Naechste Coding-Arbeit vor LLM:

- ADR/Vertrag fuer `ConversationSession` aktualisieren
- klaeren, ob Session zunaechst Projektion bleibt oder Runtime-Objekt wird
- Antwortannahme nur innerhalb bestehender, getesteter Grenzen erweitern
- keine automatische Spec-Korrektur aus Antworten

Entscheidungspflichtig:

- echte `ConversationSession`-Persistenz
- neue API fuer Chat-/Session-Runtime
- automatische Uebertragung von Antworten in `AcceptedEventSpec`
- Schedule-/Zeitfenster-Runtime

### 3.5 LLM-Orchestrator

Ziel:

- Modellaufrufe werden wie ein kontrolliertes Werkzeug behandelt, nicht wie Produktwahrheit.

Mindestarchitektur vor Provider-Anschluss:

- `ModelInput` und `ModelOutput` als versionierte Schemas
- Prompt-/Policy-Versionen als testbare Artefakte
- Tool-Allowlist mit rein lesenden und spaeter mutierenden Tools getrennt
- JSON-/Schema-Validierung vor jeder Uebernahme
- Redaction-/PII-Grenze vor Modellaufruf
- Audit fuer Modell, Prompt-Version, Tool, Ergebnisstatus und Operator
- Kosten-/Timeout-/Retry-Grenzen
- Eval-Fixtures mit synthetischen Angeboten

Nicht vor dem Gate bauen:

- keine Provider-Secrets
- keine echten Modellaufrufe mit echten Daten
- keine automatische Tool-Kette mit Schreibwirkung
- keine Rezept-/Allergen-/Freigabewahrheit aus LLM allein

Hinweis fuer spaetere Implementierung:

- Direkt vor dem echten OpenAI-/LLM-Anschluss muessen die aktuellen offiziellen Provider-Dokumente und Modell-/API-Grenzen neu geprueft werden.
- Dieses Dokument legt keine konkrete Modellversion und keinen aktuellen SDK-Vertrag fest.

### 3.6 Tooling und Actions

Tool-Klassen:

- Read tools: Spezifikation lesen, Rezepte suchen, vorhandene Plaene/Einkaufslisten/Exports lesen
- Draft tools: strukturierte Kandidaten, Rueckfragen, Zusammenfassungen erzeugen
- Write tools: Spec-Aenderung, Planerzeugung, Antwortspeicherung, Archivierung

Regel:

- Read tools koennen zuerst LLM-faehig werden.
- Draft tools brauchen Schema- und Eval-Grenzen.
- Write tools brauchen explizite Alexander-Entscheidung, Rollen-/Auth-Grenze, Audit und Human Approval.

### 3.7 Betrieb, Sicherheit und echte Daten

10/10 intern ist nur erreichbar, wenn diese Gates bewusst entschieden sind:

- B8/B9 Auth/IAP/Proxy
- B10 Pilot-Preflight
- B13 PII/Retention/Backup
- B14 Sandbox/Worker/AV
- LLM Provider, Kosten, Datenuebertragung und Logging
- Betreiber-/Nutzerkreis
- Go/No-Go fuer anonymisierte oder echte Pilotdaten

Ohne diese Gates bleibt Nutzung:

```text
lokal/synthetisch/interner Rehearsal-Korridor
```

## 4. Coding-Stufen bis 10/10

### Stufe 0: Aktuellen Arbeitsbaum reviewbar machen

Zielscore: Stabiler Stand fuer Review

Arbeit:

- Current Worktree nach C10 in Slices sortieren
- keine weiteren Featureaenderungen auf unsortierten Diff-Stapel
- `npm test`, `npm run build`, `git diff --check`

Exit-Kriterium:

- Slices sind reviewbar
- keine unerklaerten Aenderungen ausser `tmp/`

### Stufe 1: Deterministische Produktionsbasis auf 8/10 bringen

Arbeit:

- weitere synthetische Kernfaelle
- Rezeptmatching eng haerten
- Einkaufsliste sauberer machen
- Fehlupload-Soft-Archiv nur nach C9-Go
- UI-Refactor abschliessen, ohne Verhalten zu aendern

Exit-Kriterium:

- mindestens 3 bis 4 synthetische Catering-Durchlaeufe laufen reproduzierbar
- offene Punkte sind fachlich handlungsleitend
- Browser-Rehearsal ist wiederholbar dokumentierbar

### Stufe 2: LLM-Readiness ohne LLM

Arbeit:

- `ConversationSession`-Entscheidungsvorlage oder ADR
- Model-IO-Schemas als shared-core Vertrag
- Tool-Allowlist als Doku-/Testvertrag
- Eval-Fixtures synthetisch
- Prompt-Versionen als Dateien oder testbare Artefakte

Exit-Kriterium:

- man kann einen LLM-Aufruf simulieren, ohne Provider
- alle Outputs muessen Schema-validiert sein
- keine Schreibwirkung ohne Human Approval

### Stufe 3: LLM-Minimalslice mit synthetischen Daten

Voraussetzung:

- Alexander-Go fuer LLM Provider, Kosten, Logging und Datenrahmen

Arbeit:

- ein Provider-Adapter hinter Feature-Flag
- nur synthetische/lokale Daten
- ein enger Use Case: Rueckfragenvorschlag oder Angebotsstruktur-Kandidat
- kein automatisches Schreiben in `AcceptedEventSpec`
- Audit-/Trace-Eintrag fuer Modellschritt

Exit-Kriterium:

- LLM hilft sichtbar, aber deterministische Objekte bleiben fuehrend
- Abschalten des LLM laesst Kernfluss weiter laufen

### Stufe 4: LLM + Tools mit Human Approval

Voraussetzung:

- Tool-Allowlist entschieden
- Rollen-/Auth-/Audit-Grenzen tragfaehig

Arbeit:

- Read tools fuer bestehende Objekte
- Draft tools fuer Spezifikations-/Rueckfragekandidaten
- Write tools nur mit explizitem Review-Schritt
- UI zeigt "Vorschlag", "Quelle", "Unsicherheit", "Annehmen/Verwerfen"

Exit-Kriterium:

- Operator versteht, was vom Modell stammt
- jede Uebernahme ist nachvollziehbar
- Kosten und Fehlerfaelle sind begrenzt

### Stufe 5: Begrenzter interner Pilot

Voraussetzung:

- B8/B9/B10/B13/B14 plus Pilotdaten-Go

Arbeit:

- Auth-/Proxy/IAP-konformer Zugriff
- Backup-/Retention-/Restore-Regeln aktiv
- Upload-/Sandbox-/AV-Korridor aktiv
- Rehearsal mit anonymisierten oder freigegebenen Pilotdaten

Exit-Kriterium:

- Pilot ist kein lokaler Demo-Lauf mehr, aber weiter intern begrenzt
- Go/No-Go ist dokumentiert

### Stufe 6: 10/10 interner ProductionAgent

Voraussetzung:

- LLM-Gate, echte Daten, Auth, Retention, Backup, Sandbox, Betrieb und Human Approval sind entschieden und umgesetzt

Merkmale:

- Nutzer legt Angebot/Text/Datei ab
- Agent erkennt Struktur, Risiken und offene Fragen
- Rueckfragen sind kurz, relevant und speicherbar
- interne Rezepte, Mengen, Einkaufsliste und Produktionsplan entstehen reproduzierbar
- LLM erklaert, verdichtet und schlaegt vor
- deterministische Regeln und Human Approval entscheiden
- Exporte und Audit/Handoff sind nachvollziehbar
- Fehlerfaelle fuehren zu Stop, nicht zu Scheingruen

## 5. Naechste 10 Coding-Bloecke

1. Current Worktree nach C10 reviewbar machen.
2. UI-Refactor nur bis zu klaren Komponentenabschluessen weiterfuehren.
3. Quick-Lunch Browser-Rehearsal als wiederholbares Script oder Runbook schaerfen.
4. Zweiten synthetischen Catering-Fall ergaenzen: Empfang/Flying oder Kaffeepause.
5. Rezeptmatching fuer diesen zweiten Fall nur anhand belegter Luecken haerten.
6. Einkaufslistenqualitaet mit Gruppen/Einheiten/Step-Noise weiter pruefen.
7. C9 Soft-Archiventscheidung einholen oder Status quo behalten.
8. ConversationSession-ADR aktualisieren: Projektion vs Runtime-Objekt.
9. LLM-Readiness-Schemas und Tool-Allowlist als Doku-/Vertragstest vorbereiten.
10. Erst danach LLM-Minimalslice zur Entscheidung vorlegen.

## 6. Was weiterhin nicht autonom gebaut wird

- echte Google-Drive-Angebote als Testdaten
- LLM Provider-Anschluss
- Provider-Secrets oder ENV
- neue Chat-/Session-API
- neue Persistenz/Migration
- echte `ConversationSession`-Runtime
- Auth/OIDC/IAP/Proxy-Setup
- Deployment oder Serveraenderung
- Retention/Backup/Restore
- Sandbox/Worker/AV
- produktionsnahe echte Datennutzung
- Allergen-/Rezept-/Kostenfreigabe durch LLM

Diese Liste blockiert nicht kleine planfolgende Slices innerhalb des Autonomie-Korridors aus Abschnitt 2.1. Sie blockiert nur Runtime-, Betriebs-, Daten-, Sicherheits-, Freigabe- oder LLM-Schritte mit echter Gate-Wirkung.

## 7. Sicherer Default

Wenn keine Entscheidung kommt:

- weiter synthetisch/lokal testen
- deterministischen Produktionskern haerten
- UI wartbar halten
- keine echten Daten
- kein LLM
- kein Deployment
- keine neue Persistenz

## 8. Coding-Architektur: Modulgrenzen

Diese Zielarchitektur beschreibt die naechsten Codegrenzen, nicht automatisch den naechsten Code.

### Bestehende fuehrende Module

- `shared-core`: Domain-Types, Rezeptbibliothek, Regeln, Normalisierung, Projection-Vertraege
- `intake-service`: Aufnahme, Text-/Dokumentextraktion, Ingestion-Metadaten
- `offer-service`: Angebotserzeugung und Angebotsarbeitsflaeche
- `production-service`: Produktionsplanung, Rezeptsuche, Rueckfragen, PurchaseList-Erzeugung
- `print-export`: interne HTML-/CSV-Arbeitsbelege
- `backoffice-ui`: Arbeitsoberflaeche fuer Start, Angebot, Produktion, Rueckfragen, Export
- `tests`: Vertragstests, Smokes, Architektur-/Gate-Anker

### Spaetere LLM-ready Module ohne Provider-Pflicht

Diese Bausteine duerfen erst nach gesonderter Planung als kleine Slices entstehen. Der erste Schritt bleibt ohne echten Modellaufruf.

- `ModelInput` / `ModelOutput`: versionierte shared-core Schemas fuer Kandidaten, Fragen und Zusammenfassungen
- `ProviderAdapter`: schmaler Anschluss fuer spaetere Modellprovider, zunaechst nur Fake-/Fixture-Adapter
- `Prompt-/Schema-Registry`: versionierte Prompts, Policies und JSON-Schema-Vertraege
- `Tool-Registry`: Allowlist fuer Read-, Draft- und Write-Tools mit getrennten Rechten
- `Eval-Harness`: synthetische Angebots- und Produktionsfaelle gegen erwartete strukturierte Outputs
- `ConversationSession`: erst nach Entscheidung Runtime-Objekt; bis dahin bleibt Projection fuehrend
- `AgentAudit`: nachvollziehbarer Modell-/Prompt-/Tool-/Operator-Kontext, keine Compliance-Behauptung

PA26 verankert den ersten kleinen LLM-Readiness-Vertrag ohne Provider: `shared-core/src/llm-readiness.ts` definiert Model-Input-/Output-Draftgrenzen, Tool-Effektklassen, `decision_required` fuer Write-Tools, Human-Approval-Pflicht und harte Verbote fuer Provider, Secrets, Modellaufrufe, echte Daten, API, Persistenz, Migration, Runtime-ConversationSession und Schreibwirkung.

PA27 ergaenzt dazu erste synthetische Eval-Fixtures in `shared-core/src/fixtures/llm-readiness-eval-fixtures.ts`, damit spaetere Prompt-/Provider-Arbeit gegen sichere Erwartungsanker vorbereitet werden kann, ohne Provider, Secrets, echte Daten, API, Persistenz oder Schreibwirkung einzufuehren.

PA28 verbindet PA26 und PA27 ueber `shared-core/src/llm-readiness-draft-registry.ts`: schema-only Draft-Kontrakte ordnen erlaubte Input-/Output-Kinds, Tool-Effekte und Quellobjekttypen zu, bleiben aber ohne Prompttext, Provider, Modellaufrufe, API, Persistenz, echte Daten oder Schreibwirkung.

PA29 ergaenzt dazu `validateLlmReadinessModelInputCandidate(...)` als Input-Validation-Anker: Model-Input-Kandidaten muessen Provider-Aufrufe deaktivieren, synthetische/Demo-Daten deklarieren, sichere SourceRefs tragen und duerfen keine Write-Tool-Effekte oder Roh-/Prompt-/Provider-/Secret-/Toolcall-Payloads enthalten.

PA30 schliesst die reine Readiness-Kette mit `validateLlmReadinessEvalFixture(...)`: synthetische Eval-Fixtures werden zentral gegen Input-Validator, Output-Validator, Draft-Registry, required SourceRefs und Forbidden-Payload-Grenzen validiert, ohne Prompttext, Provider, Modellaufrufe, API, Persistenz, echte Daten oder Schreibwirkung einzufuehren.

PA31 haertet die SourceRef-Grenze: `llmReadinessSourceObjectTypes` macht die erlaubten Quellobjekttypen runtime-sichtbar, und die Input-/Output-Validatoren akzeptieren nur noch bekannte Arbeitsbelegtypen statt beliebiger `objectType`-Strings.

PA32 haertet die strukturierte Output-Grenze: `structuredCandidate` bleibt eine flache Scalar-Map, verschachtelte Objekte, Arrays, nicht-endliche Zahlen und verbotene Payload-Schluessel werden abgelehnt.

### Harte Kopplungsregeln

- LLM-Outputs duerfen nie direkt `AcceptedEventSpec`, `ProductionPlan` oder `PurchaseList` ersetzen.
- Jede Uebernahme in fuehrende Produktobjekte braucht Schema-Validierung, bestehenden Domain-Code und Human Approval.
- Read tools kommen vor Draft tools; Draft tools kommen vor Write tools.
- Write tools sind ohne Alexander-Go, Auth-/Rollenentscheidung, Audit und fachliche Review-UI gesperrt.
- Kein LLM-Provider-Call ohne Alexander-Go zu Provider, Datenrahmen, Kosten, Logging und Secrets.

## 9. Level-Mapping bis 10/10

Level 7: aktueller Arbeitsstand reviewbar und gruen

- C10-Slices klaeren
- Tests und Build gruen halten
- keine weiteren Features auf unsortiertem Diff-Stapel

Level 8: deterministischer Produktionskern beta-tauglich

- mehrere synthetische Catering-Durchlaeufe
- Rezeptmatching und Einkaufslistenqualitaet enger
- Browser-Rehearsal wiederholbar
- UI ohne Scheingruenheit

Level 8.5: LLM-ready ohne LLM

- Model-IO-Schemas
- Prompt-/Schema-Registry
- Tool-Registry
- Eval-Harness mit synthetischen Fixtures
- ConversationSession-ADR, aber keine Runtime ohne Entscheidung

Level 9: LLM synthetic-only

- ProviderAdapter hinter Feature-Flag
- nur synthetische/lokale Daten
- ein enger Use Case, zum Beispiel Rueckfragenvorschlag
- Audit, Kostenlimit, Timeout und Abschaltbarkeit
- kein automatisches Schreiben in fuehrende Produktobjekte

Level 9.5: begrenzter interner Pilot

- B8/B9/B10/B13/B14 bewusst entschieden und umgesetzt
- Pilotdatenrahmen entschieden
- Auth-/Proxy-/Retention-/Backup-/Sandbox-/AV-Grenzen aktiv

Level 10: kontrollierter interner Produktionsagent

- Upload/Text -> Normalisierung -> Rueckfragen -> Produktionsplan -> Einkaufsliste -> Export laeuft einfach
- LLM versteht, verdichtet und schlaegt vor
- deterministische Regeln und Human Approval entscheiden
- Operator sieht Quelle, Unsicherheit, Vorschlag, Annahme und Verwerfung
- Fehlerfaelle stoppen sauber statt Scheingruen zu erzeugen

## 10. Entscheidungspflichtige Gates

- C9 Fehlupload-Soft-Archiv als Runtime
- ConversationSession als Runtime-Objekt
- neue API-Endpunkte
- neue Persistenz oder Migration
- LLM Provider, Modell, Kosten, Logging, Secrets und Datenuebertragung
- echte Google-Drive-Angebote oder andere echte Daten
- Auth/OIDC/IAP/Proxy
- PII, Retention, Backup und Restore
- Sandbox, Worker und AV fuer Dateien
- Deployment, produktionsnahe Nutzung oder externe Freigabe

Nicht entscheidungspflichtig sind enge lokale Slices, die ausschliesslich vorhandene interne MVP-Faehigkeiten haerten und keine dieser Gate-Grenzen beruehren.
