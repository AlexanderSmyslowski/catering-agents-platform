# Teststrategie und Frontend-Smoke – MVP Phase 4

Status: minimale Phase-4-Teststrategie auf Basis des aktuellen Repo-Stands
Scope: bestehender MVP-Kern, keine neuen Produktfeatures

## 1. Ziel

Die Tests sollen reproduzierbar belegen, dass der aktuelle MVP-Kern der Catering-App technisch und fachlich nicht unbeabsichtigt bricht.

Phase 4 fuehrt keine neue Produktlogik ein. Sie beschreibt und schuetzt nur den vorhandenen Test- und Smoke-Korridor.

## 2. Repo-Standard

Standardbefehle:

```bash
npm test
npm run build
```

`npm test` ist der primaere Regressionslauf fuer den aktuellen MVP-Kern.  
`npm run build` ist der Build-/TypeScript-/Frontend-Build-Gate, besonders nach Aenderungen an TypeScript, UI oder Package-Konfiguration.

## 3. Bestehende Testebenen

### 3.1 Fachkern und Produktionslogik

Relevante bestehende Tests:

- `tests/intake-to-production-e2e.test.ts`
- `tests/intake-normalization-robustness.test.ts`
- `tests/shared-core-conflicts.test.ts`
- `tests/production-sheet-v1-kitchen-sheet.test.ts`
- `tests/production-purchase-coverage-integration.test.ts`
- `tests/purchase-coverage-check.test.ts`
- `tests/production-plan-fallbacks.test.ts`
- `tests/document-text.test.ts`
- `tests/upload-security.test.ts`
- `tests/production-language.test.ts`
- `tests/production-conversation-projection.test.ts`
- `tests/pa5-traceability-corridor.test.ts`
- `tests/pa6-beta-readiness-summary.test.ts`
- `tests/pa7-auth-read-path-decision-adr.test.ts`
- `tests/pa8-read-path-auth.test.ts`
- `tests/pa9-proxy-deployment-readiness-adr.test.ts`
- `tests/document-ingestion-boundary.test.ts`
- `tests/pa11-intake-document-ingestion-bridge.test.ts`
- `tests/pa13-ingestion-warnings-export-anchors.test.ts`
- `tests/pa14-document-ingestion-corridor-readiness.test.ts`
- `tests/pa15-productionagent-next-capability-adr.test.ts`
- `tests/pa16-production-clarification-model.test.ts`
- `tests/pa18-clarification-answer-processing-gate-adr.test.ts`
- `tests/pa19-clarification-answer-type-anchor.test.ts`
- `tests/pa20-clarification-answer-data-model-adr.test.ts`
- `tests/pa21-clarification-answer-model-anchor.test.ts`

Diese Tests pruefen den Kernpfad von Intake/AcceptedEventSpec ueber Produktionsplanung, Rezept-/Kitchen-Sheet-Erzeugung, Einkaufsliste, Fallbacks, produktionsnahe Sprache, die read-only Conversation-Projection, den PA5-Nachvollziehbarkeitskorridor Upload-Provenance -> Conversation-Quellenanker -> Produktionsoutput/Exportdarstellung, die PA6-Doku-Grenze fuer interne Beta-/Abnahme-Readiness, die PA7-Entscheidungs-ADR fuer AuthN/AuthZ + read-path Auth, den PA8-Guard-Korridor fuer sensible read-only Detail-/Listen-/Exportpfade, den PA9-Proxy-/Deployment-Readiness-Anker fuer Header-Stripping/Trusted-Header-Injektion/Health-Grenzen, den schmalen Upload-/PDF-Haertungskorridor fuer Groessenlimits und MIME-/Extension-Allowlist, den PA10-PA14 DocumentIngestion-Korridor, die PA15-Entscheidungsvorlage fuer die naechste ProductionAgent-v1-Faehigkeit sowie das PA16/PA17-Rueckfragenmodell als engen Clarification-Slice inklusive Priorisierung, Deduplizierung und sicherer Labels, das PA18-Antwortverarbeitungs-Gate als Doku-/Security-Anker ohne Runtime-Antwortannahme, den PA19-Typanker fuer spaetere Clarification-Antworten ohne Runtime-, API- oder Persistenzannahme, die PA20-Entscheidungsvorlage fuer ein spaeteres Answer-Datenmodell-/Migrationsgate und den PA21-Modellanker fuer `ProductionClarificationAnswer` ohne Runtime-/Persistenz-/API-Ausweitung.

PA14 DocumentIngestion-Korridor ist als interner read-only Abnahmeanker codiert: Quelle vorhanden -> Ingestion-Status sichtbar -> Warnungen sichtbar -> Exportanker sicher. Der Anker bestaetigt dabei nur vorhandene sichere Metadaten-/Warnmarker und die Grenze: keine Rohtextspiegelung in Conversation-/Output-/Exportankern; er ist kein neues Dashboard, kein Monitoring, keine neue API und keine Parser-, OCR-, LLM-, Rezept- oder Allergen-Implementierung.

PA15 ProductionAgent-v1 Next Capability ADR ist als Doku-/Entscheidungsanker codiert: Optionen A Rueckfragenmodell, B RecipeCandidate-Grenze, C read-only Download-/Output-Einordnung und D Tool-/LLM-Gate werden verglichen; empfohlen wird Option A als naechste echte, aber eng begrenzte Agentenfaehigkeit. Der Marker-Test schuetzt die Grenze: keine Runtime-Implementierung, keine neue API, keine Persistenz, kein LLM-/Tool-Use, keine Rezept-/Allergenlogik und keine Rohtextspiegelung.

PA16 Clarification Model Slice 1 ist als `shared-core`-/Projection-Test codiert: Rueckfragen entstehen nur aus `missingFields`, `readiness.reasons`, `documentIngestion.status` und `documentIngestion.warnings`; extracted/ok bleibt ruhig, sichere Quellenanker enthalten keine Rohtexte, und die bestehende `ProductionConversationProjection` transportiert die Fragen nur read-only ohne Nutzerantwortlogik, neue API, Persistenz, LLM-/Tool-Use-, Parser-, Rezept-, Mengen- oder Allergenlogik.

PA17 Clarification Question Quality Slice ist im selben Testkorridor codiert: doppelte Ursachen werden je sicherem Quellenanker dedupliziert, die Reihenfolge ist deterministisch mit blockierenden Fragen vor Warnungen, bekannte sichere Feld-/Warnkeys erhalten neutrale deutsche Kurzlabels, unbekannte Keys bleiben technische Fallbacks und Roh-/Extraktionstexte werden nicht gespiegelt.

PA18 Clarification Answer Processing Gate ist als Doku-/Security-Anker codiert: spaetere Antworten muessen an `questionId`/Question-Key gebunden, typisiert, sanitizet und reviewfaehig bleiben; der Marker-Test schuetzt die Grenze, dass PA18 keine Runtime-Antwortannahme, keine Antwortspeicherung, keine Antwortverarbeitung, keine neue API, keine neue Persistenz und keine Rezept-/Mengen-/Allergenentscheidung einfuehrt.

PA19 Clarification Answer Type Anchor ist als reiner `shared-core` Typ-/Testanker codiert: `shortText` ist der einzige aktiv erlaubte erste Runtime-Antworttyp; Auswahl/Bestaetigung, Ja/Nein und Datei-/Quellenhinweise bleiben nur spaetere Konzeptgrenzen. `ProductionClarificationAnswerDraft` verlangt `questionId` und stabilen Question-Key, traegt aber keinen Antwortinhalt und erzeugt keine Runtime-, API-, Persistenz- oder fachliche Verarbeitungsannahme.

PA20 Clarification Answer Data Model / Migration Decision ADR ist als reine Entscheidungsvorlage codiert: empfohlen wird Option B als spaeteres kleines explizites `ProductionClarificationAnswer`-Datenmodell innerhalb der bestehenden Domain-/Persistenzgrenzen. Der Marker-Test schuetzt die Grenze, dass PA20 keine Antwortannahme, keine Antwortspeicherung, keine Antwortverarbeitung, keine neue API, keine Migration und keine neue Persistenzwelt einfuehrt.

PA21 Clarification Answer Model Anchor ist als enger `shared-core` Modell-/Testanker codiert: `ProductionClarificationAnswer` bindet an `questionId` und stabilen Question-Key, erlaubt aktiv nur `shortText`, nutzt exakt `draft/submitted/reviewed` als minimale Statusmenge und verankert eine Textlaengengrenze sowie Sicherheitsgrenzen gegen Rohtext-/HTML-/Script-Spiegelung, automatische Fachableitung und automatische Spec-Korrekturueberfuehrung. Der Slice bleibt ohne Antwortannahme, Antwortspeicherung, Antwortverarbeitung, neue API, Migration, neue Persistenzwelt oder UI-/Projection-Erweiterung.

### 3.2 API-, Rollen- und Audit-Regressionen

Relevante bestehende Tests:

- `tests/platform.test.ts`
- `tests/backoffice-api.test.ts`
- `tests/access-control.test.ts`
- `tests/p1-role-guards.test.ts`
- `tests/p4-audit-traceability.test.ts`
- `tests/intake-finalize-access.test.ts`
- `tests/recipe-review-access.test.ts`
- `tests/production-audit-access.test.ts`
- `tests/trusted-identity-access.test.ts`

Diese Tests bleiben Rueckversicherung fuer bestehende geschuetzte Pfade. Der Trusted-Identity-Test belegt zusaetzlich, dass ein frei gesetzter `x-actor-name` bei konfiguriertem `CATERING_TRUSTED_ACTOR_SECRET` keinen mutierenden oder Audit-read-only Zugriff mehr erteilt, waehrend der explizite Trusted-Proxy-Kontext funktioniert. Phase 4 erweitert hier nichts fachlich.

### 3.3 Frontend-/Backoffice-Smoke

Relevante bestehende Tests:

- `tests/backoffice-route-smoke.test.ts`
- `tests/backoffice-production-acceptance-smoke.test.ts`
- `tests/backoffice-internal-usage-smoke.test.ts`
- `tests/backoffice-output-praesentation-smoke.test.ts`
- `tests/backoffice-intake-request-detail.test.ts`
- `tests/intake-request-detail.test.ts`
- `tests/react-act-environment.test.ts`

Der Frontend-Smoke bleibt bewusst schmal:

- `/` rendert die Startseite mit Agentenwahl und gemeinsamem Regelkern.
- `/angebot` rendert den Angebotsbereich mit route-eindeutigem Marker.
- `/produktion` rendert den Produktionsbereich mit route-eindeutigem Marker.
- der Produktionsbereich zeigt fuer vorhandene Daten sowohl nutzbare Plaene als auch blockierte/Fallback-Zustaende ehrlich an.
- ein interner Nutzpfad von manueller Anfrage bis nutzbarem Produktionsplan ist im jsdom/Vitest-Kontext abgesichert.

## 4. Lokaler Smoke-Korridor

Dokumentierte Grundlage:

- `docs/product/P2_BROWSER_SMOKE_MINISPEZ.md`
- `README.md`

Bestehender lokaler Stack:

```bash
npm run local:start
npm run local:status
npm run local:check
npm run local:stop
```

Der minimale lokale Smoke-Korridor umfasst:

- UI: `http://127.0.0.1:3200/`
- UI: `http://127.0.0.1:3200/angebot`
- UI: `http://127.0.0.1:3200/produktion`
- Health: `http://127.0.0.1:3101/health`
- Health: `http://127.0.0.1:3102/health`
- Health: `http://127.0.0.1:3103/health`
- Health: `http://127.0.0.1:3104/health`
- read-only Exportpfade fuer Angebot, Produktionsblatt und Einkaufsliste, soweit Demo-Daten vorhanden sind

Der bestehende Repo-Befehl `npm run local:check` fuehrt genau diesen schmalen lokalen Betriebscheck gegen einen laufenden lokalen Stack aus und prueft zusaetzlich den Demo-Start-/Audit-Beleg.

Dieser Smoke-Korridor ist kein neues Deployment-, Browser-Matrix- oder E2E-Framework.

## 5. Was Phase 4 bewusst nicht tut

Nicht Teil dieser Teststrategie:

- neue Fachfeatures
- Kitchen-Core-Erweiterungen
- neue UI-Flows oder UI-Neugestaltung
- neue APIs
- Persistenzmigrationen
- Provider-/LLM-Arbeit
- Deployment-, Docker-, Caddy- oder Plattforminfra-Aenderungen
- breite Playwright-/Cypress-/Browser-Matrix
- Refactoring ohne direkten Testbezug

Wenn eine Smoke-Luecke nur durch ein neues Feature schliessbar waere, ist sie als fachlicher Entscheidungsbedarf zu melden und nicht in Phase 4 zu bauen.

## 6. Minimale Umsetzungsregel fuer weitere Phase-4-Arbeit

Bei zukuenftigen Testluecken gilt:

1. erst bestehenden Test suchen,
2. dann kleinsten passenden Testfall ergaenzen,
3. nur bei belegtem bestehendem Bug die kleinste notwendige Codekorrektur vornehmen,
4. fokussierten Test ausfuehren,
5. anschliessend `npm test`,
6. `npm run build` nur dann ausfuehren, wenn Code, Typen, UI oder Package-Konfiguration betroffen sind oder ein Release-Gate verlangt wird.

## 7. Aktuelle Einordnung

Der Repo-Iststand enthaelt bereits eine belastbare minimale Basis fuer Phase 4:

- fachliche Vitest-Abdeckung fuer Intake, AcceptedEventSpec, Produktion, Rezept-/Kitchen-Sheet-Logik, Purchase-Coverage, Normalisierungsrobustheit und Shared-Core-Konfliktregeln
- schmale jsdom-basierte Frontend-Smoke-Absicherung fuer die Kernrouten, den internen Produktionsnutzpfad, Detail-Read-Pfade und die React-Testumgebung
- dokumentierten lokalen Stack- und Smoke-Korridor

Die kleinste sinnvolle Phase-4-Umsteuerung ist daher keine neue Funktion und keine neue Testinfrastruktur, sondern diese zentrale, repo-nahe Teststrategie als verbindlicher Einstiegspunkt.
