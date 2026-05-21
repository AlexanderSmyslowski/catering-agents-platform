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

Diese Tests pruefen den Kernpfad von Intake/AcceptedEventSpec ueber Produktionsplanung, Rezept-/Kitchen-Sheet-Erzeugung, Einkaufsliste, Fallbacks, produktionsnahe Sprache, die read-only Conversation-Projection, den PA5-Nachvollziehbarkeitskorridor Upload-Provenance -> Conversation-Quellenanker -> Produktionsoutput/Exportdarstellung, die PA6-Doku-Grenze fuer interne Beta-/Abnahme-Readiness, die PA7-Entscheidungs-ADR fuer AuthN/AuthZ + read-path Auth, den PA8-Guard-Korridor fuer sensible read-only Detail-/Listen-/Exportpfade sowie den schmalen Upload-/PDF-Haertungskorridor fuer Groessenlimits und MIME-/Extension-Allowlist.

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
