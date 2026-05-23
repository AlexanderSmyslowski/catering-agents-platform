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
  - C6 bestaetigt den bestehenden Upload-Haertungskorridor zusammen mit Workbench-Smokes: zu grosse/unerlaubte Dateien bleiben service-seitig abgewehrt, erlaubte Demo-Dateien werden weiter angenommen, und vorhandene Servermeldungen werden in der UI nicht verschluckt.
  - P3-B37 Upload-Grenzen als Beta-Risiko: Intake-Dokumentuploads: maximal 8 MiB pro Datei und bis zu 3 Dateien pro Multipart-Request; Rezeptuploads in Angebot und Produktion: maximal 5 MiB und genau eine Datei pro Upload. Erlaubt bleibt nur der vorhandene Dokumentkorridor PDF/TXT/MD/EML/Pages mit passender MIME-/Extension-Kombination. Produktionsnahe Verarbeitung echter oder beliebiger Uploads bleibt ohne Sandbox/Worker/AV-Gate `blocked`; Warnungen bleiben sichere Status-/Warnkey-Marker ohne Rohtext- oder Vollhash-Spiegelung.
  - P3-B38 Echte-Daten-Stop-Gate: Demo-/Seed-/synthetische Daten bleiben der erlaubte interne Beta-Korridor; echte Personen-/Kunden-/Einsatzdaten bleiben `blocked`, solange PII/Retention/Backup-Gate und Sandbox/Worker/AV-Gate nicht bewusst entschieden sind. Lokale Demo-, Upload-, Health- oder Export-Gruensignale sind kein Compliance-Freibrief und keine Freigabe fuer echte Daten.
- `tests/production-language.test.ts`
- `tests/production-conversation-projection.test.ts`
- `tests/pa5-traceability-corridor.test.ts`
- `tests/pa6-beta-readiness-summary.test.ts`
- `tests/pa7-auth-read-path-decision-adr.test.ts`
- `tests/pa8-read-path-auth.test.ts`
  - C5/B6 ergaenzt und benennt hier die explizite read-only Exportlink-Regression fuer die vorhandenen internen read-only Arbeitsbelege unter Trusted-Actor-Kontext: Angebots-HTML, Produktionsblatt-/Produktionsplan-HTML und Einkaufslisten-CSV. Diese Exporte bleiben Arbeitsbelege, keine externe Freigabe, keine Produktionsfreigabe, keine rechtssichere Audit-/Compliance-Behauptung und kein OIDC/Login.
- `tests/pa9-proxy-deployment-readiness-adr.test.ts`
- `tests/b8-auth-gate-decision-boundary.test.ts`
- `tests/b9-proxy-iap-authn-preflight-contract.test.ts`
- `tests/b10-pilot-preflight-runbook-contract.test.ts`
- `tests/b13-pii-retention-backup-gate-contract.test.ts`
- `tests/b14-sandbox-worker-av-gate-contract.test.ts`
- `tests/b24-pilot-corridor-decision-contract.test.ts`
- `tests/b25-hetzner-deployment-preflight-contract.test.ts`
- `tests/b26-hetzner-preflight-evidence-checklist-contract.test.ts`
- `tests/b27-hetzner-preflight-status-template-contract.test.ts`
- `tests/b28-hetzner-preflight-decision-packet-contract.test.ts`
- `tests/b29-hetzner-preflight-operator-questions-contract.test.ts`
- `tests/b30-hetzner-preflight-answer-handoff-contract.test.ts`
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
- `tests/pa22-clarification-answer-storage-display-gate-adr.test.ts`
- `tests/pa23-clarification-answer-runtime-minimal.test.ts`
- `tests/pa24-clarification-answer-session-spec-binding.test.ts`
- `tests/pa25-clarification-answered-status-anchor.test.ts`
- `tests/p5-b49-beta-flow-map-contract.test.ts`
- `tests/p5-b54-manual-beta-checklist-contract.test.ts`
- `tests/p6-b61-beta-management-decision-brief-contract.test.ts`

Diese Tests pruefen den Kernpfad von Intake/AcceptedEventSpec ueber Produktionsplanung, Rezept-/Kitchen-Sheet-Erzeugung, Einkaufsliste, Fallbacks, produktionsnahe Sprache, die read-only Conversation-Projection, den PA5-Nachvollziehbarkeitskorridor Upload-Provenance -> Conversation-Quellenanker -> Produktionsoutput/Exportdarstellung, die PA6-Doku-Grenze fuer interne Beta-/Abnahme-Readiness, die PA7-Entscheidungs-ADR fuer AuthN/AuthZ + read-path Auth, den PA8-Guard-Korridor fuer sensible read-only Detail-/Listen-/Exportpfade, den PA9-Proxy-/Deployment-Readiness-Anker fuer Header-Stripping/Trusted-Header-Injektion/Health-Grenzen, die B8 AuthN/AuthZ/read-path Auth Entscheidungsgrenze fuer den naechsten minimalen produktionsnahen Auth-Korridor, den B9 Proxy/IAP-AuthN-Preflight-Vertrag fuer Header-Stripping am Proxy-/IAP-Rand, kontrollierte Trusted-Header-Injektion, serverseitiges Trusted Secret, nicht direkt exponierte Services, nicht-sensitive Health-Endpunkte und interne read-only Arbeitsbelege hinter Trusted-Actor-/Proxy-Kontext, das B10 Pilot-Preflight-Runbook als ausfuellbaren Vor-Pilot-Korridor mit Zielumgebung, Betreiber, Proxy-/IAP-Rahmen, Ergebniszustaenden `go`/`blocked`/`not assessed` und separaten PII-/Retention-/Backup-/Sandbox-/AV-Gates, den schmalen Upload-/PDF-Haertungskorridor fuer Groessenlimits und MIME-/Extension-Allowlist inklusive C6-Workbench-Sichtbarkeit kontrollierter Upload-Fehler und sicherer Ingestion-Warnungen, den PA10-PA14 DocumentIngestion-Korridor, die PA15-Entscheidungsvorlage fuer die naechste ProductionAgent-v1-Faehigkeit sowie das PA16/PA17-Rueckfragenmodell als engen Clarification-Slice inklusive Priorisierung, Deduplizierung und sicherer Labels, das PA18-Antwortverarbeitungs-Gate als Doku-/Security-Anker ohne Runtime-Antwortannahme, den PA19-Typanker fuer spaetere Clarification-Antworten ohne Runtime-, API- oder Persistenzannahme, die PA20-Entscheidungsvorlage fuer ein spaeteres Answer-Datenmodell-/Migrationsgate, den PA21-Modellanker fuer `ProductionClarificationAnswer` ohne Runtime-/Persistenz-/API-Ausweitung, das PA22-Speicher-/Anzeige-Gate fuer spaetere kurze Freitextantworten ohne PA22-Runtime-Implementierung, PA23 als ersten engen Runtime-Speicher-/Anzeige-Slice fuer `submitted`-`shortText`-Antworten in bestehender Persistenz-/Projection-Grenze, PA24 als Spec-/Session-Bindungsanker fuer Clarification-Antworten auf Basis bestehender `specId`/`production-session-${specId}`-Kontexte und PA25 als read-only Statusanker fuer beantwortete Rueckfragen in derselben Projection.

B8 AuthN/AuthZ/read-path Auth Entscheidungsgrenze ist als Doku-/Vertragsanker codiert: `docs/architecture/B8_AUTH_GATE_DECISION_BOUNDARY.md` trennt vorhandene PA8-/Trusted-Actor-Read-Path-Schutzpunkte, interne read-only Detail-/Export-/Auditpfade, nicht produktionsnah nutzbare Pfade ohne naechste Auth-Entscheidung, Alexanders Minimalentscheidung fuer B9 und die Out-of-Scope-Grenzen. Der Marker-Test schuetzt, dass B8 keinen OIDC-/Login-Bau, keine neue API, Persistenz, Migration, Exportlogik, externe Rollen-/Mandantenlogik, produktionsnahe Freigabe oder rechtssichere Audit-/Compliance-Behauptung einfuehrt.

B9 Proxy/IAP-AuthN-Preflight-Vertrag ist als Doku-/Vertragsanker codiert: `docs/architecture/B9_PROXY_IAP_AUTHN_PREFLIGHT_CONTRACT.md` konkretisiert den minimalen Preflight-Korridor vor produktionsnahem Pilot. Der Vertrag verlangt Header-Stripping am Proxy-/IAP-Rand, kontrollierte Trusted-Header-Injektion nur durch Proxy/IAP, serverseitig gesetztes `CATERING_TRUSTED_ACTOR_SECRET`, keine direkte Service-Exposition, nicht-sensitive Health-Endpunkte sowie Exporte/read-only Arbeitsbelege hinter Trusted-Actor-/Proxy-Kontext; er bleibt ohne Login-/Session-/OIDC-Implementierung, Proxy-Deployment-Code, neue API, Persistenz, Migration, Exportlogik, produktionsreife Auth, externe Freigabe oder rechtssichere Compliance.

B10 Pilot-Preflight-Runbook ist als Doku-/Vertragsanker codiert: `docs/architecture/B10_PILOT_PREFLIGHT_RUNBOOK.md` macht die B9-Mussbedingungen fuer eine konkrete Zielumgebung abfragbar. Der Marker-Test schuetzt Zielumgebung, Betreiber, Proxy-/IAP-Rahmen, direkte Service-Exposition, Header-Stripping, Trusted-Header-Injektion, serverseitiges Secret, Health-Grenzen, Export-/Read-Kontext, Ergebniszustaende `go`/`blocked`/`not assessed`, separate PII-/Retention-/Backup-/Sandbox-/AV-Gates und die Grenze: keine produktionsnahe Freigabe ohne ausgefuellten und erfuellten Preflight.

B11 Lokaler Demo-/Pilotdaten-Abnahmedurchlauf ist als Doku-/Vertragsanker codiert: `docs/product/B11_LOCAL_DEMO_PILOT_ACCEPTANCE_RUN.md` strukturiert den vorhandenen lokalen Demo-/Pilotdaten-Durchlauf ueber `npm run local:status`, `npm run local:check`, bestehende Backoffice-/Export-/Ingestion-Smokes und die Standard-Gates. `tests/b11-local-demo-pilot-acceptance-contract.test.ts` schuetzt die Ergebniszustaende `go`/`blocked`/`not assessed`, die Grenze eines lokalen Gruen-Signals auf interne Demo-/Abnahmefaehigkeit und die Blockade produktionsnaher Pilotnutzung ohne B10-Preflight, PII-/Retention-/Backup- sowie Sandbox-/AV-Gates.

B12 Lokaler Demo-Ergebnisvermerk ist als Doku-/Vertragsanker codiert: `docs/product/B12_LOCAL_DEMO_RESULT_NOTE.md` strukturiert fuer einen konkreten lokalen Demo-Durchlauf Datum/Scope, tatsaechliche Nachweise aus `local:status`, `local:check`, Backoffice-/Export-/Ingestion-Smokes, `npm test`, Build, Audit und `git diff --check`, zulaessige Artefaktquellen ohne Secrets/PII/echte Kunden- oder Pilotdaten, Ergebniszustand `go`/`blocked`/`not assessed`, klare Nicht-Behauptungen und offene Gates. `tests/b12-local-demo-result-note-contract.test.ts` schuetzt, dass aus lokalen Gruen-Signalen kein produktionsnaher Pilot, keine externe Freigabe und keine rechtssichere Compliance-/Audit-Aussage abgeleitet wird; konkrete Zielumgebung, B10-Preflight-Ausfuellung, PII/Retention/Backup sowie Sandbox/Worker/AV bleiben `blocked` oder `not assessed`.

B13 PII/Retention/Backup-Gate ist als Doku-/Vertragsanker codiert: `docs/architecture/B13_PII_RETENTION_BACKUP_GATE.md` trennt erlaubte Demo-/Seed-/synthetische Daten und interne Arbeitsbelege von echten Mitarbeiter-, Kunden-, Einsatz-/Schicht-/Abrechnungs- und produktionsnahen Pilotdaten. `tests/b13-pii-retention-backup-gate-contract.test.ts` schuetzt die Mindestentscheidungen Datenkategorien/PII-Scope, Speicherort/Systemgrenze, Aufbewahrungsfrist/Loeschkonzept, Backup-/Restore-Verantwortung, Zugriff/Verantwortliche, Export-/Audit-Artefaktklassifikation und Incident-/Loeschpfad sowie die Ergebniszustaende `go`/`blocked`/`not assessed`; lokaler Demo-Go bleibt intern und produktionsnaher Pilot bleibt ohne PII-/Retention-/Backup-Gate `blocked`.

B14 Sandbox/Worker/AV-Gate ist als Doku-/Vertragsanker codiert: `docs/architecture/B14_SANDBOX_WORKER_AV_GATE.md` trennt den aktuellen internen Demo-/Ingestion-/Upload-Korridor von produktionsnaher Verarbeitung beliebiger Dateien. `tests/b14-sandbox-worker-av-gate-contract.test.ts` schuetzt die Mindestentscheidungen erlaubte Dateitypen, Groessenlimits, Quarantaene-/Reject-Verhalten, Scan-/Sandbox-Verantwortung, Worker-Isolation, Timeout-/Ressourcenlimit, Fehler-/Warnpfad und Betreiber-/Betriebsverantwortung; Health-/Demo-/Read-only-Export-Gruensignale ersetzen keine Sandbox/AV-Freigabe, B13 PII/Retention/Backup bleibt separat und produktionsnahe echte Uploads bleiben ohne B14 `blocked`.

B24 Pilot-Korridor-Entscheidungsanker ist als Doku-/Vertragsanker codiert: `docs/product/B24_PILOT_KORRIDOR_ENTSCHEIDUNGSANKER.md` verankert Alexanders konservative Entscheidung: interner Demo-Modus ist `go`, ein begrenzter interner Pilot mit anonymisierten Daten bleibt bis zu konkreter Zielumgebung, Personen und Datenumfang `not assessed`, produktionsnaher Pilot mit echten Daten, öffentlicher Direktzugriff und beliebige echte Uploads bleiben `blocked`. `tests/b24-pilot-corridor-decision-contract.test.ts` schuetzt erlaubte Demo-/synthetische/anonymisierte Daten, Stop-Kriterien, B10/B13/B14-Gate-Bezug und klare Nicht-Ableitungen: kein Produktivbetrieb, keine externe Freigabe, keine echten Daten, keine neue API/Persistenz/Login-/Proxy-/Sandbox-/Retention-/Backup-Implementierung und keine rechtssichere Compliance-/DSGVO-Freigabe.

B25 Hetzner-Deployment-Preflight ist als Doku-/Vertragsanker codiert: `docs/deployment/B25_HETZNER_DEPLOYMENT_PREFLIGHT.md` benennt Alexanders Hetzner-Server als Zielumgebung, haelt den Deploymentstatus auf `not deployed` und den Produktiv-/Pilotstatus bis zum ausgefuellten Preflight auf `blocked`. `tests/b25-hetzner-deployment-preflight-contract.test.ts` schuetzt Reverse Proxy / IAP oder vergleichbare Zugriffsschicht, blockierte direkte Service-Exposition, serverseitige Secrets/ENV ausserhalb des Repos, keine Secrets in Git/Reports/Logs/Telegram, HTTPS/TLS-, Prozessmodell- und Rollback-/Stop-Klaerung, nicht-sensitive Healthchecks sowie die B10/B13/B14/B24-Gate-Bezuege. B25 fuehrt kein Deployment, keine Serveraenderung, keine SSH-Verbindung, keine Secret-Erstellung, keine ENV-Datei mit echten Werten, keine Docker-/systemd-/nginx-Konfiguration, keine neue API, Persistenz, Migration, Produktlogik, echten Daten oder rechtssichere Compliance-/DSGVO-Freigabe ein.

B26 Hetzner-Preflight-Nachweischeckliste ist als Doku-/Vertragsanker codiert: `docs/deployment/B26_HETZNER_PREFLIGHT_EVIDENCE_CHECKLIST.md` konkretisiert B25 in sichere, nicht-sensitive Nachweiszeilen fuer Alexanders Hetzner-Zielumgebung: Zielumgebung/Hostrahmen, Betreiber, Proxy/IAP, Ausschluss direkter Service-Exposition, Header-Stripping, Trusted-Header-Injektion, serverseitiges Trusted Secret ohne Wert, HTTPS/TLS, nicht-sensitive Healthchecks, Rollback-/Stop-Pfad sowie B13-/B14-Gate-Bezug. `tests/b26-hetzner-preflight-evidence-checklist-contract.test.ts` schuetzt die Ergebniszustaende `go`, `blocked` und `not assessed`, die Secret-/PII-Dokumentationsgrenzen und die Blockade ohne vollstaendig gruene Mussnachweise. B26 fuehrt kein Deployment, keine Serveraenderung, keine SSH-Verbindung, keine Secret-Erstellung, keine produktive Config, keine neue API/Persistenz/Migration, keine Produktlogik und keine echten Daten ein.

B27 Hetzner-Preflight-Statusvorlage ist als Doku-/Vertragsanker codiert: `docs/deployment/B27_HETZNER_PREFLIGHT_STATUS_TEMPLATE.md` macht die B26-Nachweiszeilen als ausfuellbare, nicht-sensitive Statusvorlage sichtbar: Status `go`/`blocked`/`not assessed`, nicht-sensitive Begruendung und naechster sicherer Schritt je Zeile. `tests/b27-hetzner-preflight-status-template-contract.test.ts` schuetzt Bezug zu B25/B26, blockierte Defaults, Secret-/PII-/IP-Dokumentationsgrenzen und die klare Grenze: kein Deployment, keine Serveraenderung, keine SSH-Verbindung, keine Secret-Erstellung, keine produktive Config, keine neue API/Persistenz/Migration, keine Produktlogik und keine echten Daten.

B28 Hetzner-Preflight-Entscheidungspaket ist als Doku-/Vertragsanker codiert: `docs/deployment/B28_HETZNER_PREFLIGHT_DECISION_PACKET.md` verdichtet B25/B26/B27 zu Mussgruppen, die vor einem spaeteren Hetzner-Schritt explizit auf `go` oder `blocked` gesetzt werden muessten. `tests/b28-hetzner-preflight-decision-packet-contract.test.ts` schuetzt die konservative Default-Blockade, die Secret-/PII-/IP-Dokumentationsgrenzen, die Teil-Go-Grenze und die klare Grenze: kein Deployment, keine Serveraenderung, keine SSH-Verbindung, keine Secret-Erstellung, keine produktive Config, keine neue API/Persistenz/Migration, keine Produktlogik und keine echten Daten.

B29 Hetzner-Preflight-Operatorfragen ist als Doku-/Vertragsanker codiert: `docs/deployment/B29_HETZNER_PREFLIGHT_OPERATOR_QUESTIONS.md` uebersetzt das B28-Entscheidungspaket in nicht-sensitive Operatorfragen zu Zielumgebung/Verantwortlichen, Zugriffsschicht, Trusted-Headern, TLS/Health, Rollback/Stop, Daten-/PII-/Retention-/Backup-Gate und Sandbox-/Worker-/AV-Gate. `tests/b29-hetzner-preflight-operator-questions-contract.test.ts` schuetzt die konservative Default-Blockade, die Secret-/PII-/IP-Dokumentationsgrenzen, die Teilantwort-Grenze und die klare Grenze: kein Deployment, keine Serveraenderung, keine SSH-Verbindung, keine Secret-Erstellung, keine produktive Config, keine neue API/Persistenz/Migration, keine Produktlogik und keine echten Daten.

B30 Hetzner-Preflight-Antwortübergabe ist als Doku-/Vertragsanker codiert: `docs/deployment/B30_HETZNER_PREFLIGHT_ANSWER_HANDOFF.md` macht die B29-Operatorfragen als sichere Antwortübergabe mit Antwortstatus `go`/`blocked`/`not assessed`, nicht-sensitiver Antwortnotiz und naechstem sicherem Schritt nutzbar. `tests/b30-hetzner-preflight-answer-handoff-contract.test.ts` schuetzt die konservative Default-Blockade, die Secret-/PII-/IP-Dokumentationsgrenzen, die Teilantwort-Grenze und die klare Grenze: kein Deployment, keine Serveraenderung, keine SSH-Verbindung, keine Secret-Erstellung, keine produktive Config, keine neue API/Persistenz/Migration, keine Produktlogik und keine echten Daten.

B31 Hetzner-Management-Entscheidungsliste ist als Doku-/Vertragsanker codiert: `docs/deployment/B31_HETZNER_MANAGEMENT_DECISION_LIST.md` verdichtet B25-B29 in eine kurze, nicht-sensitive Management-Liste mit Status `go`/`blocked`/`not assessed` fuer Betreiber/Verantwortliche, Zugriffsschicht, Trusted-Header/Secret, TLS/Health, Stop/Rollback, Daten/PII/Retention/Backup und Sandbox/Worker/AV. `tests/b31-hetzner-management-decision-list-contract.test.ts` schuetzt die konservative Gesamtblockade bei offenen Mussgruppen, die Secret-/PII-/IP-/Serverdetail-Dokumentationsgrenzen, die Teil-Go-Grenze und die klare Grenze: kein Deployment, keine Serveraenderung, keine SSH-Verbindung, keine Secret-Erstellung, keine produktive Config, keine neue API/Persistenz/Migration, keine Produktlogik und keine echten Daten.

PA14 DocumentIngestion-Korridor ist als interner read-only Abnahmeanker codiert: Quelle vorhanden -> Ingestion-Status sichtbar -> Warnungen sichtbar -> Exportanker sicher. Der Anker bestaetigt dabei nur vorhandene sichere Metadaten-/Warnmarker und die Grenze: keine Rohtextspiegelung in Conversation-/Output-/Exportankern; er ist kein neues Dashboard, kein Monitoring, keine neue API und keine Parser-, OCR-, LLM-, Rezept- oder Allergen-Implementierung. Backoffice-Demo-Marker: `Ingestion-Warnung: Status fallback · Warnkey document_text_extraction_fallback`; Quellenmetadaten (gekürzt) zeigen nur Dateiname, MIME, Groesse, Hash-Kurzanker und Kontext, keine vollen SHA-256-Hashes.

PA15 ProductionAgent-v1 Next Capability ADR ist als Doku-/Entscheidungsanker codiert: Optionen A Rueckfragenmodell, B RecipeCandidate-Grenze, C read-only Download-/Output-Einordnung und D Tool-/LLM-Gate werden verglichen; empfohlen wird Option A als naechste echte, aber eng begrenzte Agentenfaehigkeit. Der Marker-Test schuetzt die Grenze: keine Runtime-Implementierung, keine neue API, keine Persistenz, kein LLM-/Tool-Use, keine Rezept-/Allergenlogik und keine Rohtextspiegelung.

PA16 Clarification Model Slice 1 ist als `shared-core`-/Projection-Test codiert: Rueckfragen entstehen nur aus `missingFields`, `readiness.reasons`, `documentIngestion.status` und `documentIngestion.warnings`; extracted/ok bleibt ruhig, sichere Quellenanker enthalten keine Rohtexte, und die bestehende `ProductionConversationProjection` transportiert die Fragen nur read-only ohne Nutzerantwortlogik, neue API, Persistenz, LLM-/Tool-Use-, Parser-, Rezept-, Mengen- oder Allergenlogik.

PA17 Clarification Question Quality Slice ist im selben Testkorridor codiert: doppelte Ursachen werden je sicherem Quellenanker dedupliziert, die Reihenfolge ist deterministisch mit blockierenden Fragen vor Warnungen, bekannte sichere Feld-/Warnkeys erhalten neutrale deutsche Kurzlabels, unbekannte Keys bleiben technische Fallbacks und Roh-/Extraktionstexte werden nicht gespiegelt.

PA18 Clarification Answer Processing Gate ist als Doku-/Security-Anker codiert: spaetere Antworten muessen an `questionId`/Question-Key gebunden, typisiert, sanitizet und reviewfaehig bleiben; der Marker-Test schuetzt die Grenze, dass PA18 keine Runtime-Antwortannahme, keine Antwortspeicherung, keine Antwortverarbeitung, keine neue API, keine neue Persistenz und keine Rezept-/Mengen-/Allergenentscheidung einfuehrt.

PA19 Clarification Answer Type Anchor ist als reiner `shared-core` Typ-/Testanker codiert: `shortText` ist der einzige aktiv erlaubte erste Runtime-Antworttyp; Auswahl/Bestaetigung, Ja/Nein und Datei-/Quellenhinweise bleiben nur spaetere Konzeptgrenzen. `ProductionClarificationAnswerDraft` verlangt `questionId` und stabilen Question-Key, traegt aber keinen Antwortinhalt und erzeugt keine Runtime-, API-, Persistenz- oder fachliche Verarbeitungsannahme.

PA20 Clarification Answer Data Model / Migration Decision ADR ist als reine Entscheidungsvorlage codiert: empfohlen wird Option B als spaeteres kleines explizites `ProductionClarificationAnswer`-Datenmodell innerhalb der bestehenden Domain-/Persistenzgrenzen. Der Marker-Test schuetzt die Grenze, dass PA20 keine Antwortannahme, keine Antwortspeicherung, keine Antwortverarbeitung, keine neue API, keine Migration und keine neue Persistenzwelt einfuehrt.

PA21 Clarification Answer Model Anchor ist als enger `shared-core` Modell-/Testanker codiert: `ProductionClarificationAnswer` bindet an `questionId` und stabilen Question-Key, erlaubt aktiv nur `shortText`, nutzt exakt `draft/submitted/reviewed` als minimale Statusmenge und verankert eine Textlaengengrenze sowie Sicherheitsgrenzen gegen Rohtext-/HTML-/Script-Spiegelung, automatische Fachableitung und automatische Spec-Korrekturueberfuehrung. Der Slice bleibt ohne Antwortannahme, Antwortspeicherung, Antwortverarbeitung, neue API, Migration, neue Persistenzwelt oder UI-/Projection-Erweiterung.

PA22 Clarification Answer Storage/Display Gate ist als Doku-/Marker-Anker codiert: spaetere kurze Freitextantworten duerfen nur innerhalb des `ProductionClarificationAnswer`-Modells und der bestehenden Domain-/Persistenzgrenze gespeichert und read-only in bestehenden `/produktion`-Projection-/Detailankern angezeigt werden. Der Marker-Test schuetzt die Grenze, dass PA22 keine Runtime-Antwortannahme, keine Antwortspeicherung, keine neue API, keine Migration, keine UI-Erweiterung, keine fachliche Ableitung und keine Rohtext-/PDF-Extrakt-Spiegelung einfuehrt.

PA23 Clarification Answer Runtime Minimal Slice ist als enger Runtime-Test codiert: eine `shortText`-Antwort auf eine bestehende `ProductionClarificationQuestion` wird an `questionId` plus stabilen Question-Key gebunden, leere/zu lange/falsch typisierte/unbekannte Antworten werden abgelehnt, HTML/Script-Inhalte werden fuer die read-only Anzeige escaped, und die Antwort wird als `submitted` ueber die bestehende `ProductionStore`-/`PersistentCollection`-Grenze gespeichert sowie in der bestehenden `ProductionConversationProjection` angezeigt. Der Slice fuehrt keine Antwortbearbeitung, kein `draft`/`reviewed`-Runtime-Erzeugen, keine automatische Spec-Korrektur, keine neue HTTP-API, keine Migration, keine neue Persistenzwelt und keine Rezept-/Mengen-/Allergenlogik ein.

PA24 Clarification Answer Session/Spec Binding Anchor ist als enger shared-core-/Runtime-Grenztest codiert: Rueckfragen und Antworten tragen eine explizite Kontextbindung aus bestehender `specId` und bestehender `ProductionConversationProjection.sessionId`; Antworterzeugung, Store-Grenze und Projection akzeptieren nur eindeutig passende Spec-/Session-Kontexte. Fehlende oder falsche Bindungen werden abgelehnt beziehungsweise nicht angezeigt. Der Slice fuehrt keine neue ID-Welt, keine neue API, UI, Migration, Persistenzwelt, Antwortbearbeitung, automatische Spec-Korrektur oder fachliche Antwortinterpretation ein.

PA25 Clarification Answered Status Anchor ist als enger Projection-Test codiert: strukturierte Clarification-Fragen tragen read-only `clarificationAnswerStatus: answered | unanswered`. Als `answered` zaehlt nur eine passende `submitted`-`shortText`-Antwort mit gleicher `questionId`, passendem stabilem Question-Key und gleicher Spec-/Session-Bindung. Falscher Kontext, falscher Typ, `draft`, `reviewed` und malformed Answers bleiben `unanswered`; Antworttext bleibt escaped und der Status loest keine Spec-Korrektur, Fachableitung, Frage-Schliessung, neue API, UI-Welt oder Persistenz aus.

P5-B49 Beta-Durchlauf Ist-Karte ist als Doku-/Vertragstestanker codiert: `docs/product/P5_BETA_DURCHLAUF_IST_KARTE.md` kartiert den vorhandenen internen Nutzerweg `Start -> Angebot -> Produktion -> Exporte/Audit` und trennt intern nutzbar, nur dokumentiert / nur intern abnahmefaehig, blockiert und schon testbar. `tests/p5-b49-beta-flow-map-contract.test.ts` schuetzt die Auffindbarkeit aus README, TESTING und C8 sowie die Grenzen: kein Deployment, keine SSH-Verbindung, keine echten Daten, keine neue Persistenz, kein OAuth/Login/OIDC, keine automatische Spec-Korrektur und keine Rezept-/Allergenautomatik.

P5-B54 Manuelle Beta-Test-Checkliste ist als Doku-/Vertragstestanker codiert: `docs/product/P5_B54_MANUELLE_BETA_TEST_CHECKLISTE.md` fuehrt Alexander lokal durch `Start -> Angebot -> Produktion -> Rueckfragen -> Exporte/Audit`, nennt die URLs `http://127.0.0.1:3200/`, `http://127.0.0.1:3200/angebot` und `http://127.0.0.1:3200/produktion`, erwartete sichtbare Marker, Stop-Gates, Reibungspunkt-Notizen und den B12-Ergebnisvermerk. `tests/p5-b54-manual-beta-checklist-contract.test.ts` schuetzt die Auffindbarkeit aus README, TESTING, C8 und B12 sowie die Grenzen: keine echten Daten, keine Produktionsfreigabe, keine externe Freigabe, keine rechtssichere Audit-/Compliance-Aussage, kein OAuth/Login/OIDC, keine automatische Spec-Korrektur und keine Rezept-/Allergenautomatik.

P6-B56 Beta-Onboarding-Iststand und Lueckenkarte ist als Doku-/Vertragstestanker codiert: `docs/product/P6_B56_BETA_ONBOARDING_ISTSTAND_LUECKENKARTE.md` buendelt Starten -> Durchlaufen -> Reibung notieren -> Stop-Gates, trennt intern testbar, nur synthetisch, blockiert und verboten, und benennt die naechsten sicheren Plan-6-Luecken ohne Produktlogik, API, Persistenz, Deployment oder echte Daten. `tests/p6-b56-beta-onboarding-gap-map-contract.test.ts` schuetzt die Auffindbarkeit aus README, TESTING, C8 und P5-B54 sowie die Grenzen: keine echten Daten, kein Deployment, keine SSH-Verbindung, keine Secrets, keine neue Persistenz, kein OAuth/Login/OIDC, keine automatische Spec-Korrektur und keine Rezept-/Allergenautomatik.

P6-B57 Lokaler Start-/Status-Korridor ist als Doku-/Vertragstestanker codiert: `docs/product/P6_B57_LOKALER_START_STATUS_KORRIDOR.md` buendelt Starten -> Status pruefen -> Betriebscheck -> UI-Routen oeffnen -> kontrolliert stoppen, relevante lokale UI- und Health-URLs, die Rollen von `npm run local:start`, `npm run local:status`, `npm run local:check` und `npm run local:stop` sowie die sichere Reaktion auf rote Status-/Check-Signale. `tests/p6-b57-local-start-status-corridor-contract.test.ts` schuetzt die Auffindbarkeit aus README, TESTING, C8 und P6-B56 sowie die Grenzen: keine echten Daten, kein Deployment, keine SSH-Verbindung, keine Secrets, keine Produktionsfreigabe und keine rechtssichere Audit-/Compliance-Aussage.

P6-B58 Reibungslog fuer manuellen Beta-Durchlauf ist als Doku-/Vertragstestanker codiert: `docs/product/P6_B58_BETA_REIBUNGSLOG_VORLAGE.md` strukturiert sichere Beta-Reibungsnotizen ohne echte Daten mit Beobachtung, Route, erwartetem Verhalten, tatsaechlichem Verhalten, Schweregrad, Screenshot-Hinweis ohne personenbezogene Daten und naechster Entscheidung. `tests/p6-b58-beta-friction-log-template-contract.test.ts` schuetzt die Auffindbarkeit aus README, TESTING, C8, P5-B54, P6-B56 und P6-B57 sowie die Grenzen: keine echten Daten, keine externe QA-Plattform, keine neue Speicherung echter Nutzerdaten, keine Produktionsfreigabe, keine externe Freigabe und keine rechtssichere Audit-/Compliance-Aussage.

P6-B61 Beta-Durchlauf als Management-Entscheidungsvorlage ist als Doku-/Vertragstestanker codiert: `docs/product/P6_B61_BETA_MANAGEMENT_ENTSCHEIDUNGSVORLAGE.md` verdichtet Plan-6-Ergebnisse aus P6-B56 bis P6-B60 in sofort testbar, Stop-Gates, No-go, Entscheidung fuer Alexander und naechster enger Produktwertblock nach Feedback. `tests/p6-b61-beta-management-decision-brief-contract.test.ts` schuetzt die Auffindbarkeit aus README, TESTING, C8, P5-B54, P6-B56, P6-B57 und P6-B58 sowie die Grenze: kein weiterer Mikroausbau ohne beobachtete Reibung, keine Produktlogik, keine UI-Aenderung, keine neue API/Persistenz, kein Deployment, keine echten Daten, keine Auth/OIDC, keine automatische Spec-Korrektur und keine Rezept-/Allergenautomatik.

P7-B63 Reviewer-Rehearsal-Startkarte ist als Doku-/Vertragstestanker codiert: `docs/product/P7_B63_REVIEWER_REHEARSAL_STARTKARTE.md` buendelt fiktive Testrolle, synthetisches Ziel, erlaubte Daten, Stop-Gates und den fuehrenden Pfad Start -> Angebot -> Produktion -> Rueckfragen -> Exporte/Audit fuer den ersten manuellen internen Beta-Rehearsal-Start. `tests/p7-b63-reviewer-rehearsal-start-card-contract.test.ts` schuetzt Auffindbarkeit aus README, TESTING, P5-B54 und P6-B61 sowie die Grenze: keine echten Daten, kein Deployment, keine SSH-Verbindung, keine Secrets, keine neue Persistenz, kein OAuth/Login/OIDC, keine automatische Spec-Korrektur, keine Rezept-/Allergenautomatik und keine Produktionsfreigabe.

P7-B64 Synthetische Szenario- und Datenkarte ist als Doku-/Vertragstestanker codiert: `docs/product/P7_B64_SYNTHETISCHE_SZENARIO_UND_DATENKARTE.md` gibt dem manuellen Beta-Rehearsal ein klar fiktives Szenario mit Beispielkunde, Kontaktperson, Ort, Termin, Anlass, fiktiver Gaestezahl und synthetischem Testdokument. `tests/p7-b64-synthetic-scenario-data-card-contract.test.ts` schuetzt Auffindbarkeit aus README, TESTING, P7-B63 und P6-B58 sowie die Grenze: keine echten Kunden-, Personen- oder Einsatzdaten, keine neue Seed-Daten-Quelle, keine Persistenz- oder Datenmodell-Aenderung, keine Produktlogik und keine UI-Aenderung.

P7-B65 Evidenzpaket fuer Export/Audit/Route ist als Doku-/Vertragstestanker codiert: `docs/product/P7_B65_EXPORT_AUDIT_ROUTE_EVIDENZPAKET.md` strukturiert den manuellen Beta-Rehearsal-Abschluss mit Route, Erwartung, Beobachtung, Beleg, Reibung, Export-/Auditbeleg, Screenshot-Hinweis ohne PII und naechster Entscheidung. `tests/p7-b65-export-audit-route-evidence-pack-contract.test.ts` schuetzt Auffindbarkeit aus README, TESTING, P7-B63 und P6-B58 sowie die Grenze: read-only Export/Audit, keine externe Ablage, kein Upload, keine echten Dateien mit personenbezogenen Daten und keine neue Betriebsintegration.

P7-B67 Reibung-zu-Backlog-Triage ist als Doku-/Vertragstestanker codiert: `docs/product/P7_B67_REIBUNG_ZU_BACKLOG_TRIAGE.md` verbindet P6-B58-Reibungslog, P6-B61-Managementregel und P7-B65-Evidenzpaket zu einer kleinen Triage-Matrix fuer beobachtete Reibung. `tests/p7-b67-friction-to-backlog-triage-contract.test.ts` schuetzt Auffindbarkeit aus README, TESTING, P6-B58, P6-B61 und P7-B65 sowie die Grenze: keine Produktlogik, keine neue API/Persistenz, kein Deployment, keine echten Daten, kein OAuth/Login/OIDC, keine automatische Spec-Korrektur und keine Rezept-/Allergenautomatik.

P9-N3 Rehearsal-Reibung-zu-Entscheidung ist als Doku-/Vertragstestanker codiert: Die Triage-/Management-Vorlagen verdichten den Abschluss nach lokalem synthetischem Rehearsal auf go/fix/blocked/decision needed. `tests/p9-n3-rehearsal-friction-decision-contract.test.ts` schuetzt die vier Copy-Anker, die Trennung zwischen kleinem Fix, Stop-Gate und Alexander-Entscheidung sowie die Grenze: keine Produktentscheidung, kein neuer Workflow und keine automatische Ticket-/Backlog-/QA-Plattform.

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
- `/angebot` schuetzt zusaetzlich einen internen Angebots-Happy-Path: zentrale Anfrage absenden, neuen Entwurf fokussieren, Status-/Uebergabe-/Exportanker sichtbar halten.
- `/angebot` und `/produktion` schuetzen zusaetzlich einen schmalen Uebergabeanker: vorhandene Draft-, Spec-, Request- und Exportmarker bleiben im Angebotskontext und Produktionskontext nachvollziehbar sichtbar.
- `/produktion` rendert den Produktionsbereich mit route-eindeutigem Marker.
- der Produktionsbereich zeigt fuer vorhandene Daten sowohl nutzbare Plaene als auch blockierte/Fallback-Zustaende ehrlich an.
- die Production Workbench zeigt Rueckfragenstatus, naechsten sinnvollen Schritt, interne Produktionsobjekte/Downloads, Rezeptpruefstatus sowie Herkunft/Uebergabe als ruhige read-only Zonen aus bestehenden Daten.
- C7 schuetzt den Empty-State klare Spezifikation ohne Produktionsplan/Einkaufsliste: Der naechste Schritt `Berechnung starten`, die fehlende Einkaufsliste und noch fehlende Exportlinks muessen im bestehenden `/produktion`-Kontext verstaendlich sichtbar bleiben.
- ein interner Nutzpfad von manueller Anfrage bis nutzbarem Produktionsplan ist im jsdom/Vitest-Kontext abgesichert.

## 4. Lokaler Smoke-Korridor

Dokumentierte Grundlage:

- `docs/product/P2_BROWSER_SMOKE_MINISPEZ.md`
- `docs/product/C8_INTERNER_DEMO_DURCHLAUF_ABNAHMEWEG.md`
- `docs/product/P9_N1_LOKALER_REHEARSAL_NACHWEISRAHMEN.md`
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

Abgrenzung der lokalen Befehle:

- `npm run local:start` startet den lokalen Stack mit Demo-Seeding in den bestehenden `screen`-Sitzungen. Der Befehl nutzt die vorhandenen Services und Demo-Fixtures; er ist kein Deployment und keine Produktionsfreigabe.
- `npm run local:status` ist eine lokale Prozess- und Erreichbarkeitsuebersicht fuer die erwarteten `screen`-Sitzungen und Service-Ports. Der Befehl zeigt, ob der lokale Stack gerade plausibel laeuft; er belegt noch keinen vollstaendigen Betriebsweg.
- `npm run local:check` ist der lokale Betriebs-/Seed-/Export-/Auditbeleg gegen einen bereits laufenden lokalen Stack. Der Check prueft Startweg, Status, UI-Routen, Health-Endpunkte, read-only Exportpfade und einen vorhandenen Demo-Start-/Auditbeleg.
- `npm run local:stop` beendet die lokalen `screen`-Sitzungen und zugehoerigen Repo-Prozesse wieder. Der Befehl ist der Abschluss des lokalen Demo-Durchlaufs und kein Server- oder Deployment-Eingriff.

Demo-Seed ist eine interne Verifikationshilfe fuer den lokalen MVP-Korridor und kein Produktionsdatenmodell. Der Auditbeleg ist ein interner Betriebs-/Kontrollnachweis fuer den Demo-Startweg und keine rechtssichere Audit-/Compliance-Aussage.

Option-A-Zeitfenster-Grenze im lokalen Smoke-Korridor: lokale Gruensignale aus `npm run local:status` und `npm run local:check` belegen keine strukturierte Zeitfensterloesung; die `Zeitfenster-Rehearsal-Notiz` bleibt eine manuelle Copy-/Anleitungsnotiz; es gibt keine automatische `event.schedule`-Uebernahme und kein Schedule-/Zeitfenster-Datenmodell.

Der bestehende Repo-Befehl `npm run local:check` fuehrt genau diesen schmalen lokalen Betriebscheck gegen einen laufenden lokalen Stack aus und prueft zusaetzlich den Demo-Start-/Audit-Beleg. Er startet keine neue Infrastruktur; wenn der lokale Stack fehlt oder lokale Demo-/Audit-Laufzeitdaten nicht zum erwarteten Seed-Stand passen, ist das als lokaler Betriebsstatus zu melden und nicht durch Featurebau oder Infrastrukturbehauptungen zu ueberdecken.

P9-N2 Gate-Bindung gegen Scheingruenheit: `npm run local:status` allein ist kein Rehearsal-Go. `npm run local:check` allein ist kein Rehearsal-Go. UI-/Smoke-Anker allein sind kein Rehearsal-Go. Rehearsal-Go darf nur vergeben werden, wenn Status, Check, manuelle UI-Routen, Evidence-Paket und Reibungslog gemeinsam widerspruchsfrei sind. Rote lokale Gates, fehlende Export-/Auditanker oder offene Stop-Gates sind als `blocked` oder `decision needed` zu dokumentieren.

Die erwarteten sichtbaren Demo-Anker bleiben testbar: Der lokale Check prueft Start-, Intake-/Request-, Angebots-, Produktions- und Exportanker aus den vorhandenen Demo-Fixtures, insbesondere `demo-intake-conference-lunch`, `spec-demo-intake-conference-lunch`, `demo-offer-conference-buffet`, `draft-demo-offer-conference-buffet`, `demo-production-coffee`, `plan-spec-demo-production-coffee` und `purchase-spec-demo-production-coffee`.

Der synthetische Rueckfragen-Demoanker fuer Plan 4 ist ebenfalls auffindbar: `spec-demo-production-answered-clarification` / `demo-production-answered-clarification` zeigt ohne echte Daten eine beantwortete Rueckfrage mit `Synthetische Demo-Antwort`. Im bestehenden Conversation-Fluss bleiben Rueckfragen als `Agent fragt · offen` oder `Agent fragt · beantwortet` lesbar; passende Antworten erscheinen read-only als `user_structured_answer`. Produktionsobjekte/Downloads bleiben read-only Ergebnis-/Exportanker; dieser Korridor fuehrt keine automatische Spec-Korrektur, keine Fachableitung, keine neue API, keine neue Persistenz, keine Rezept-/Allergenautomatik und keinen LLM-/Tool-Use-Ausbau ein.

Die Auditpruefung fragt bewusst das lokale Production-Auditfenster mit `limit=200` ab und erwartet einen `production.seed_demo`-Beleg des lokalen `Betriebs-/Audit-Operator`. Fehlt dieser Beleg oder ist er inhaltlich ungueltig, muss der Check deterministisch rot werden und auf kontrolliertes Neu-Seeden via `npm run local:start` verweisen.

Dieser Smoke-Korridor ist kein neues Deployment-, Browser-Matrix- oder E2E-Framework. Er ist keine CI-Pflicht, keine Produktionsfreigabe und keine rechtssichere Audit-Aussage.

### 4.1 Interner Demo-/Abnahmeweg C8

Der C8-Demo-/Abnahmeweg ist unter `docs/product/C8_INTERNER_DEMO_DURCHLAUF_ABNAHMEWEG.md` dokumentiert. Er verknuepft die bestehenden lokalen Befehle `npm run local:status` und `npm run local:check` mit den UI-Routen `/angebot` und `/produktion`, dem vorhandenen Angebot-Happy-Path, dem Angebot-zu-Produktion-Handoff-Anker, sicheren Upload-/Import-Warnankern, read-only Exportlinks unter Trusted-Actor-Kontext und den Full Gates `npm test`, `npm run build`, `npm audit --omit=dev` und `git diff --check`.

Der P9-N1-Rehearsal-Nachweisrahmen ist unter `docs/product/P9_N1_LOKALER_REHEARSAL_NACHWEISRAHMEN.md` dokumentiert. Er konsolidiert C8, P6-B57, P6-B58, P7-B63/B64/B65/B67 und die Plan-8-Option-A-Grenze zu einem lokalen Nachweisindex: lokal/synthetisch gruene Signale bleiben eng auf Demo-/Seed-/read-only Arbeitsbelege begrenzt; echte Daten, Produktionsfreigabe und Compliance bleiben blocked.

B6 ordnet diese Exportlinks ausdruecklich als interne read-only Arbeitsbelege unter Trusted-Actor-Kontext ein: Angebots-HTML, Produktionsblatt-/Produktionsplan-HTML und Einkaufslisten-CSV. Der Korridor bleibt ohne externe Freigabe, ohne Produktionsfreigabe, ohne rechtssichere Audit-/Compliance-Behauptung und ohne OIDC/Login.

Der C8-Weg ist Doku-only und bleibt ein interner MVP-/Demo-Korridor. Er ist ein interner Demo-/Abnahmeweg, keine Produktionsfreigabe, keine externe Freigabe, keine externe Compliance-Abnahme und keine rechtssichere Auditbehauptung.

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
