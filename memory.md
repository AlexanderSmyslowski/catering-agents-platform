# memory.md

version: 5.361
date: 2026-08-15
status: active
repo: AlexanderSmyslowski/catering-agents-platform

## Zweck
Diese Datei ist die fuehrende Kurzreferenz fuer neue Chatfenster, Hermes Agent, Codex 5.4 mini und andere Arbeitskontexte.
Sie soll den aktuellen Projektstand, den Governance-Bauplan, die Leitplanken und den naechsten explizit beauftragten Schritt knapp und belastbar festhalten.
Sie ist wieder die fuehrende Root-Memory-Datei des Repos.

## Repo-Kontext
- **Stage-A-Kontrollpunkt (2026-08-11):** Aufgaben 1 bis 7 sind im Codeanker `51f6cbc36f9f3ec93f5b7fd7d5d7cdb170e15e3b` abgeschlossen. PR 596 wurde als `c6f530c7bae70bf52c3767b68620368060fd00cf` und die eng begrenzte Nachbesserung PR 597 als `51f6cbc36f9f3ec93f5b7fd7d5d7cdb170e15e3b` zusammengeführt; die geprüfte Übergabe wurde anschließend durch PR 598 als `5b879d5de22bf276d8e1a3d56e8e203303ece809` in `main` aufgenommen.
- PR 596 verankert die serverseitige BYO-LLM-Datengrenze: externe Aufrufe von OpenAI und Codex CLI werden vor Fetch oder Subprozess ohne exakt passende Freigabe abgewiesen; Fixture-Betrieb bleibt lokal. Die Freigabe vergleicht Geschäft, Datenklasse, Zweck, Anbieter, Modell, Fähigkeit, Region, Endpunkt, Kosten, Aufbewahrung, Trainingsnutzung und Gültigkeit. Prompts, Antworten, Zugangsdaten und geschützte Provider-Kennungen gelangen nicht in Protokolle.
- PR 597 redigiert zusätzlich Provider- und Request-Kennungen sowie Fixture-IDs aus fehlerhaften externen Antworten. Es entsteht keine zweite fachliche Freigabewahrheit: `ApprovalRequestRecord` bleibt die Produktwahrheit; die Providerfreigabe ist nur die technische Betriebsgrenze.
- Der Stage-A-Kontrollpunkt ist fachlich bestanden: Datei- und PostgreSQL-Speicherung bleiben getrennt und geschäftsbezogen, Angebote und Produktionsartefakte sind unveränderlich, Fälle/Quellen/Verläufe persistent, Produktgrenzen über Ports explizit und direkte Freigabe-/Handoff-Umgehungen ausgeschlossen.
- Verifiziert: `npm test -- --maxWorkers=1` mit 305 bestandenen und 1 übersprungenen Testdateien sowie 1.744 bestandenen und 14 übersprungenen Tests; `npx tsc --noEmit`, `npm run build`, `npm audit --omit=dev`, `npm audit`, interne Beta-Gates und die GitHub-CI von PR 596 und PR 597 sind grün. Die 11 PostgreSQL-Schema-/Konkurrenztests bleiben ohne lokale PostgreSQL-Instanz übersprungen. Es gab keine echte externe KI-Ausführung und keine Verarbeitung realer Unternehmens- oder Kundendaten.
- PR #612 ist mit Merge-Commit `5393363fd5a0d7453461eca9bc141655c232b21a` in `main` aufgenommen; sein Tree `c9fbab19a70426c9c461356b75953304b41e5761` entspricht dem historischen PR-Head `bf255be310aadca56bc0b5cfbff2c7cd1da46097`. Task 12 und die acht unabhängig geprüften Reviewbefunde sind damit im Main-Stand enthalten. Der nächste Stage-A-Schritt braucht weiterhin einen ausdrücklichen Supervisor-Auftrag.
- PA65 ist als kleiner Runtime-/Contract-Anker umgesetzt: `docs/architecture/PA65_SYNTHETIC_LIVE_MINI_PILOT_SUMMARY_SIGNAL.md` gibt dem vorhandenen Mini-Pilot-Check ein lesbares `summary`-Signal mit Status, Grund und naechstem sicheren Schritt. Kein neuer Providerpfad, keine UI, keine Persistenz, kein Deployment und keine Schreibwirkung.
- PA64 ist als kleiner Runtime-/Contract-Anker umgesetzt: `docs/architecture/PA64_SYNTHETIC_LIVE_MINI_PILOT_CHECK_ENTRY.md` buendelt den vorhandenen Preflight und den PA63-guarded Probe-Lauf zu einem einzigen lokalen Mini-Pilot-Check-Einstieg mit gemeinsamem JSON-Ergebnis. Kein neuer Providerpfad, keine UI, keine Persistenz, keine Deployment-Ausweitung und keine Schreibwirkung.
- PA63 ist als kleiner Runtime-/Contract-Anker umgesetzt: `docs/architecture/PA63_SYNTHETIC_LIVE_MINI_PILOT_PROBE_GUARD.md` haengt einen dedizierten lokalen Probe-Entry hart an den vorhandenen PA62-Mini-Pilot-Rahmen. Der neue Entry laeuft nur mit bestaetigtem Mini-Pilot-Preflight, bleibt aber weiter lokal, draft-only und ohne neue Runtime-, Deployment- oder Schreibpfade.
- PA62 ist als kleiner Runtime-/Contract-Anker umgesetzt: `docs/architecture/PA62_SYNTHETIC_LIVE_MINI_PILOT_POLICY.md` codiert den beschlossenen Option-2-Mini-Pilot als zusätzliche Preflight-Policy-Schicht ueber dem vorhandenen `synthetic_live`-Korridor. Empfehlung bleibt eng: nur benannte interne Nutzer, nur `synthetic_demo_or_approved_internal`, nur `draft_only`, Human Approval bleibt `required`, Write-Effects bleiben verboten.
- PA61 ist als naechster 10/10-Gate-Rahmen docs-/contract-only umgesetzt: `docs/architecture/PA61_LLM_DOCUMENT_UPLOAD_SOURCE_SAFETY_DECISION_FRAME.md` zieht oberhalb von `synthetic_live` die Schwesterfrage zu PA54-PA60 nach, naemlich ob ein spaeterer providerfaehiger Draft-Pfad direkte Uploads, Rohdokumente oder Rohtext-nahe Dokumentquellen jemals sehen darf. Empfehlung: keine direkten Upload-Payloads, keine Rohdokumente und keine Rohtext-Extrakte im Providerpfad; wenn ueberhaupt, nur bereits reduzierte, nicht-dateinahe Arbeitsausschnitte, B14 bleibt fuehrendes Upload-/Sandbox-/Worker-/AV-Gate.
- Repository: `AlexanderSmyslowski/catering-agents-platform`
- Produkt: Catering Agents Platform
- Monorepo fuer spezialisierte Catering-Agenten und Backoffice-UI
- Laut `README.md` umfasst der aktuelle MVP insbesondere:
  - `offer-service`
  - `intake-service`
  - `production-service`
  - `shared-core`
  - `print-export`
  - `backoffice-ui`

## Projektkontext der aktuellen Arbeit
- PA60 ist als naechster 10/10-Gate-Rahmen docs-/contract-only umgesetzt: `docs/architecture/PA60_LLM_RUNTIME_CONVERSATION_SESSION_DECISION_FRAME.md` zieht oberhalb von `synthetic_live` die Schwesterfrage zu PA54-PA59 nach, naemlich ob ein spaeterer providerfaehiger Draft-Pfad ueberhaupt eine echte Runtime-`ConversationSession` brauchen darf oder fuer den ersten freigegebenen Korridor bewusst projektionsbasiert bleiben muss. Empfehlung: keine neue Runtime-`ConversationSession`, bestehende Projektionen und vorhandene Objekte bleiben fuehrend, Session-Runtime bleibt ein eigener spaeterer Gate-Schritt.
- PA59 ist als naechster 10/10-Gate-Rahmen docs-/contract-only umgesetzt: `docs/architecture/PA59_LLM_TOOL_WRITE_EFFECT_DECISION_FRAME.md` zieht oberhalb von `synthetic_live` die Schwesterfrage zu PA54-PA58 nach, naemlich welche Tool-Klassen ein spaeterer providerfaehiger Draft-Pfad ueberhaupt sehen darf und wo die harte Grenze gegen Write-Effects und Tool-Orchestrierung mit Produktschreibwirkung bleibt. Empfehlung: strikt read-/draft-only bleiben, `writesProductObject: false` fuehrend halten und Write-Tools als eigenen spaeteren Gate-Schritt behandeln.
- PA58 ist als naechster 10/10-Gate-Rahmen docs-/contract-only umgesetzt: `docs/architecture/PA58_LLM_HUMAN_APPROVAL_OPERATOR_HANDOVER_DECISION_FRAME.md` zieht oberhalb von `synthetic_live` die Schwesterfrage zu PA54-PA57 nach, naemlich wie Human Approval, Operator-Handover und manuelle Draft-Uebernahme fuer spaetere nicht-lokale providerfaehige Draft-Pfade aussehen muessen. Empfehlung: strikt human-in-the-loop bleiben, kein stilles Self-Approval, bestehende `ApprovalRequestRecord`-Wahrheit nicht umgehen und keine neue Approval-Runtime oder Produktschreibwirkung einziehen.
- PA57 ist als naechster 10/10-Gate-Rahmen docs-/contract-only umgesetzt: `docs/architecture/PA57_LLM_DEPLOYMENT_TARGET_ENVIRONMENT_DECISION_FRAME.md` zieht oberhalb von `synthetic_live` die Schwesterfrage zu PA54/PA55/PA56 nach, naemlich unter welchem Deployment-/Zielumgebungs-Kontext ein spaeterer nicht-lokaler providerfaehiger Draft-Pfad ueberhaupt denkbar ist. Empfehlung: nur hinter den bestehenden Zielumgebungs- und Proxy-Gates B25-B37/PA9, keine Ableitung eines Deployment-Go aus lokalen Probe-/Rehearsal-Erfolgen, keine Serveraenderung, keine SSH-/Secret-Arbeit und keine Runtime-Ausweitung.
- PA56 ist als naechster 10/10-Gate-Rahmen docs-/contract-only umgesetzt: `docs/architecture/PA56_LLM_RETENTION_EVIDENCE_DECISION_FRAME.md` zieht oberhalb von `synthetic_live` die Schwesterfrage zu PA54/PA55 nach, naemlich welcher Prompt-/Response-Retention- und Evidence-Rahmen fuer spaetere providerfaehige Draft-Laeufe ueberhaupt denkbar ist. Empfehlung: strukturierte Default-Nachweise (`AgentAudit`, `RunResult`, Eval-Felder) plus hoechstens eng begrenzte lokale redigierte Drift-/Operator-Review-Ausschnitte; keine Raw Prompt-/Response-Sammlungen in Repo, PR, Ticket oder Chat, keine Gleichsetzung mit allgemeiner Backup-Retention und keine Runtime-Ausweitung.
- P1 Rollen-/Rechte-Arbeit ist in einer ersten MVP-Stufe real verankert und gezielt verifiziert: zentrale Konvention im `shared-core` plus Guards fuer die mutierenden Intake-, Offer- und Production-Kernpfade, den Demo-Seed-/Audit-Korridor und die Recipe-Review-/Finalize-Pfade; kleiner Access-Control-Korridor ist gruen
- P3-Betriebscheck ist bewusst konsolidiert und soll nicht weiter in Mikro-Härtungen ausfransen; naechster sinnvoller Block liegt ausserhalb von P3, bevorzugt im Shared-Core-/Access-Control-/Governance-Anker
- P3 Stufe 1 und 2 sind begonnen und mit reproduzierbarem lokalem Betriebscheck gehärtet; der Check bestaetigt Exportpfad und einen read-only Audit-Beleg fuer den Demo-Startweg in gehärteter Form
- P4 zielt auf Audit-/Review-/Nachvollziehbarkeit: vorhandene Nachweise, Operator-Zuordnung und geschuetzte Kernpfade betriebsnah schaerfen, der Traceability-Strang ist inzwischen testseitig belegt und soll stehen bleiben
- P4 Traceability wurde zusätzlich als kleiner Regressionstest `tests/p4-audit-traceability.test.ts` codiert und grün verifiziert; die Traceability umfasst Produktionsseed, Produktionsreview, Angebotsreview und Intake-Finalize, inklusive synchronisiertem `.ts`/`.js`-Runtimepfad fuer den Intake-Finalize-Audit-Eintrag
- P5 MVP-Abgrenzung pro Kernbereich ist als schmale Mini-Spezifikation dokumentiert; sie trennt vorhandenen internen MVP-Kern, bewusste Nicht-Ziele und spaetere Produktisierung ohne neue Featureliste.
- P6 Aufbewahrung, Loeschung und Archivierung ist als schmale Mini-Spezifikation dokumentiert; sie begrenzt den vorsichtigen Umgang mit operativen Daten und Artefakten ohne neue Retention- oder Archivplattform.
- P7 Betriebsfreigabe / MVP-Freigabekriterien ist als schmale Mini-Spezifikation dokumentiert; sie fasst den kleinen repo-gebundenen Go/No-Go-Rahmen fuer interne MVP-/Beta-Nutzung zusammen, ohne neue Release- oder Monitoring-Plattform.
- P2 Browser-/Smoke-Absicherung ist jetzt real belegt: der lokale Smoke-Korridor prueft die drei UI-Routen, die vier Health-Endpunkte und die drei read-only Exportpfade; ergaenzend existiert ein minimaler repo-verankerter UI-Route-Smoke-Test fuer `/`, `/angebot` und `/produktion`, dessen Angebots- und Produktions-Assertions auf route-eindeutige Marker geschaerft sind
- P4 Frontend-Smoke-Navigation ist testseitig erweitert: `tests/backoffice-route-smoke.test.ts` prueft sichtbare Startseiten-Einstiege/Nav-Links und Route-Cards auf `/angebot` und `/produktion` und rendert anschliessend die Zielrouten mit stabilen Markern. Keine App-Logik, API, Persistenz, UI-Neugestaltung oder neue Browser-Test-Infrastruktur.
- P4 Produktions-Export-/Audit-Abschlussanker ist minimal umgesetzt: `/produktion` zeigt in der bestehenden Herkunft-und-Uebergabe-Zone einen read-only `Abschluss-Kontext` mit vorhandener `planId`, `specId` und `purchaseListId`; `tests/backoffice-production-acceptance-smoke.test.ts` schuetzt denselben Plan-/Einkaufslisten-/Audit-Kontext. Keine neue API, Persistenz, Exportlogik, Compliance-Behauptung oder neue Produktflaeche.
- P4 Produktions-Empty-State-Klarheit ist minimal umgesetzt: Die `ProductionConversationalWorkbench` unterscheidet ohne vorhandene Produktionsobjekte klar `Produktionsplan berechnen` von `Produktionsobjekte und Downloads pruefen`; Einkaufsliste und Exportlinks bleiben offen markiert und der Smoke schuetzt gegen Scheingruenheit. Keine automatische Produktionsplan-Erzeugung, Exportlogik, API, Persistenz oder Freigabe-Behauptung.
- P4 Angebots-Empty-State-Klarheit ist minimal umgesetzt: Die `OfferConversationalWorkbench` zeigt ohne fokussierten Entwurf `Export/Freigabe: noch kein Entwurf, kein Exportartefakt und keine Freigabe vorhanden` und schaerft die Beta-Grenze gegen externe, Produktions- oder Compliance-Freigabe; `tests/backoffice-route-smoke.test.ts` schuetzt den leeren `/angebot`-Zustand gegen Scheingruenheit.
- P4 Startseiten-Audit-/Handoff-Grenze ist minimal umgesetzt: Die bestehende Startseiten-Änderungsprotokoll-Zone nennt Audit-/Handoff-Hinweise ausdrücklich als interne Arbeitsbelege fuer Demo-/Beta-Pruefung und grenzt externe Freigabe, Produktionsfreigabe, echte-Daten-Freigabe und rechtssicheren Compliance-Nachweis ab; `tests/backoffice-route-smoke.test.ts` schuetzt diesen Marker gegen Scheingruenheit.
- C6 Upload-/Import-Pfade im Workbench-Kontext ist umgesetzt: `tests/backoffice-route-smoke.test.ts` schuetzt jetzt, dass `/produktion` kontrollierte Servermeldungen aus dem vorhandenen Intake-Dokumentupload sichtbar macht und dass sichere DocumentIngestion-Warnungen plus gekuerzte Quellenmetadaten im Workbench-Kontext angezeigt werden.
- Minimaler UI-/API-Fix: `backoffice-ui/src/api.ts` uebernimmt vorhandene JSON-`message`-Fehler aus Fetch-Antworten fuer JSON- und Multipart-Pfade, damit Limit-/MIME-Abweisungen nicht auf generische HTTP-Statuszeilen reduziert werden. Keine neue API, Persistenz, Parser-/OCR-/LLM-Engine oder Upload-Framework-Erweiterung.
- C7 Leer-/Fehlerzustaende fuer interne Nutzung ist umgesetzt: `/produktion` erklaert beim klaren Spec-ohne-Plan-/Einkaufsliste-Zustand den naechsten Schritt und die noch fehlenden Exportlinks explizit; abgesichert in `tests/backoffice-production-acceptance-smoke.test.ts`. Keine neue Recovery-Plattform, API, Persistenz oder Produktlogik.
- C8 interner Demo-Durchlauf als reproduzierbarer Abnahmeweg ist Doku-only umgesetzt und in B1/B2 als Vertrag pruefbar und narrativ geschaerft: `docs/product/C8_INTERNER_DEMO_DURCHLAUF_ABNAHMEWEG.md` verknuepft lokale Voraussetzungen, `npm run local:status`, `npm run local:check`, `/angebot`, `/produktion`, Angebot-Happy-Path/Handoff, Upload-/Import-Warnanker, Exportlinks mit Trusted-Actor-Kontext und Full Gates; `tests/local-ops-check-contract.test.ts` prueft Auffindbarkeit, reale Scripts/Testanker und die Kernanker in C8/TESTING/README. Klar begrenzt auf interne Demo-/Abnahmesicht: Demo-Seed ist interne Verifikationshilfe, Auditbeleg ist interner Betriebs-/Kontrollnachweis; keine Produktionsdatenwelt, keine Produktionsfreigabe, keine externe Freigabe und keine rechtssichere Audit-/Compliance-Aussage.
- B4 Produktionsobjekt-/Export-Readiness ist minimal gehaertet: `/produktion` benennt bei vorhandenem Produktionsplan, aber fehlender Einkaufsliste den Zustand `Einkaufsliste noch offen` und vermeidet die Aussage, dass alle Exporte schon verfuegbar sind; Regression in `tests/backoffice-production-acceptance-smoke.test.ts`. Keine neue Generierungslogik, API, Persistenz oder Produktlogik.
- B5 Upload-/Warnungszustand im Demo-Weg ist minimal gehaertet: `/produktion` zeigt vorhandene DocumentIngestion-Warnungen im Detailanker als `Ingestion-Warnung: Status ... · Warnkey ...`, Quellenmetadaten als `Quellenmetadaten (gekürzt)` mit Hash-Kurzanker, und der Backoffice-Smoke schuetzt Rohtext- und Vollhash-Nichtspiegelung. Keine Parser-/OCR-/LLM-Erweiterung, keine neue API und keine Persistenz.
- B6 Trusted-Actor-/Export-Grenzen fuer Abnahme ist Doku-/Test-only geschaerft: C8, TESTING und PA9 ordnen Angebots-HTML, Produktionsblatt-/Produktionsplan-HTML und Einkaufslisten-CSV als interne read-only Arbeitsbelege unter Trusted-Actor-Kontext ein; `entfernter Doku-Contract-Test` schuetzt die PA8-Exportpfade und Grenzen. Keine Exportlogik, API, Persistenz, OIDC/Login, externe Freigabe, Produktionsfreigabe oder rechtssichere Audit-/Compliance-Behauptung.
- B7 Management-/Lageuebersicht ist Doku-/Test-only geschaerft: PA6 trennt jetzt hart zwischen tatsaechlich umgesetzt, nur dokumentiert / nur intern abnahmefaehig, offen, Risiko und naechster Entscheidung fuer Alexander; `entfernter Doku-Contract-Test` schuetzt diese Struktur. Keine Produktlogik, UI, API, Persistenz, Migration, OIDC/Login, Produktionsfreigabe, externe Freigabe oder rechtssichere Audit-/Compliance-Behauptung.
- B8 AuthN/AuthZ/read-path Auth Entscheidungsgrenze ist Doku-/Test-only vorbereitet: `docs/architecture/B8_AUTH_GATE_DECISION_BOUNDARY.md` trennt vorhandene PA8-/Trusted-Actor-Read-Path-Schutzpunkte, interne read-only Detail-/Export-/Auditpfade, nicht produktionsnah nutzbare Pfade ohne naechste Auth-Entscheidung, Alexanders Minimalentscheidung fuer B9 und Out-of-Scope-Grenzen; `entfernter Doku-Contract-Test` schuetzt diesen Vertrag. Keine Login-/OIDC-/Session-Welt, API, Persistenz, Migration, Exportlogik, externe Rollen-/Mandantenlogik, produktionsnahe Freigabe oder rechtssichere Audit-/Compliance-Behauptung.
- B9 Proxy/IAP-AuthN-Preflight-Vertrag ist Doku-/Test-only vorbereitet: `docs/architecture/B9_PROXY_IAP_AUTHN_PREFLIGHT_CONTRACT.md` konkretisiert Header-Stripping am Proxy-/IAP-Rand, kontrollierte Trusted-Header-Injektion, serverseitig gesetztes `CATERING_TRUSTED_ACTOR_SECRET`, keine direkte Service-Exposition, nicht-sensitive Health-Endpunkte und Exporte/read-only Arbeitsbelege hinter Trusted-Actor-/Proxy-Kontext; `entfernter Doku-Contract-Test` schuetzt diesen Vertrag. Keine Login-/Session-/OIDC-Implementierung, kein Proxy-/IAP-Deployment-Code, keine neue API, Persistenz, Migration, Exportlogik, produktionsreife Auth, externe Freigabe oder rechtssichere Compliance.
- P8 UI-Rollenverantwortung und Operator-Zuordnung ist als schmale Mini-Spezifikation fuer den Backoffice-UI-Kern ergänzt worden; sie ordnet Home, Angebotsansicht, Produktionsansicht sowie read-only Detail-/Export-/Audit-Kontexte den bestehenden Minimalrollen und Operatornamen zu
- P9 formaler AuthN-/AuthZ-Rahmen im MVP ist als schmale Mini-Spezifikation ergänzt worden; sie fasst die bestehende Rollen-/Guard-Grundlage, die Actor-Zuordnung und den Proxy-Rahmen zu einem konservativen internen AuthN-/AuthZ-Rahmen zusammen
- P10 manuelle Betriebsinterventionen und Fallbacks im MVP sind als schmale Mini-Spezifikation ergänzt worden; sie ordnen nur die manuellen Betriebswege, Fallbacks und Grenzen im bestehenden MVP-Rahmen ein, ohne eine neue Incident- oder Recovery-Plattform einzuführen
- P11 Datenkorrekturen und fachliche Nachpflege im MVP sind als schmale Mini-Spezifikation ergänzt worden; sie begrenzen Direktedit, Neuerzeugung und read-only-Nachpflege im bestehenden Rollen-/Guard-Rahmen, ohne eine neue Diff- oder Governance-Welt einzuführen
- P12 Demo-/Seed-Daten und zulässige Nutzung im MVP sind als schmale Mini-Spezifikation ergänzt worden; sie begrenzen Seed-/Demo-Nutzung als Betriebs- und Verifikationshilfe, ohne eine neue Testdaten- oder Reset-Plattform einzuführen
- P13 Export-Verbindlichkeit und operative Nutzung im MVP sind als schmale Mini-Spezifikation ergänzt worden; sie ordnen operative Exportartefakte als interne Arbeitsbelege ein, ohne eine neue Signatur- oder Freigabewelt einzuführen
- P14 Audit-/Review-Spuren und operative Nutzung im MVP sind als schmale Mini-Spezifikation ergänzt worden; sie begrenzen die Spuren auf interne Betriebs- und Kontrollnachweise, ohne eine neue Compliance- oder Revisionswelt einzuführen
- P15 minimaler interner Abnahmeprozess im MVP ist als schmale Mini-Spezifikation ergänzt worden; er begrenzt die kleinste interne Abnahme auf bestehende Test-, Build-, Rollen-, Export- und Audit-/Review-Kontexte, ohne eine neue QA- oder Release-Welt einzuführen
- P16 minimaler interner Aenderungs- und Entscheidungslog im MVP ist als schmale Mini-Spezifikation ergänzt worden; er begrenzt die knappe Dokumentation von Entscheidungen auf PR-, Commit-, Doku- und memory-Kontexte, ohne ein neues Ticket-, ADR- oder Governance-System einzuführen
- P17 minimaler interner Betriebsstatus- und Lageueberblick im MVP ist als schmale Mini-Spezifikation ergänzt worden; er begrenzt die wenigen internen Statussignale auf Test-, Build-, Smoke-, Export-, Audit-/Review- und Fallback-Sicht ohne eine neue Monitoring- oder Ops-Welt einzuführen
- P18 minimaler interner Eskalations- und Klaerungspfad im MVP ist als schmale Mini-Spezifikation ergänzt worden; er begrenzt die sichtbare Klaerung und Eskalation auf PR-, Doku- und memory-Kontexte ohne ein Incident-, Ticket- oder Governance-System einzuführen
- P19 minimaler interner Beta-Durchfuehrungsrahmen im MVP ist als schmale Mini-Spezifikation ergänzt worden; er begrenzt einen ersten kontrollierten internen Beta-Durchlauf auf bestehende Test-, Build-, Smoke-, Abnahme-, Lage- und Klaerungsrahmen ohne ein Release-, Rollout- oder Support-System einzuführen
- P20 minimaler interner Beta-Auswertungs- und Go/No-Go-Rahmen im MVP ist als schmale Mini-Spezifikation ergänzt worden; er begrenzt die knappe Auswertung eines ersten Beta-Durchlaufs sowie die Einordnung in tragfaehig, nachzuschaerfen oder vorerst zu stoppen ohne ein formales QA-, Release- oder Steering-System einzuführen
- P22 minimaler Restpunkt- und Nachziehrahmen vor Beta-Abschluss im MVP ist als schmale Mini-Spezifikation ergänzt worden; er begrenzt den Umgang mit kleinen Restpunkten vor einem sauberen Beta-Abschluss ohne ein formales Defect-, QA- oder Release-Management zu konstruieren
- P23 minimaler interner Beta-Abschluss- und Dokumentationsstand im MVP ist als schmale Mini-Spezifikation ergänzt worden; er begrenzt die kleine Abschlusssicht auf konsistente Dokumente, PR und memory ohne ein formales Abschluss-, QA- oder Governance-System einzuführen
- P25 minimaler interner Nutzungsrahmen nach Beta-Uebergabe im MVP ist als schmale Mini-Spezifikation ergänzt worden; er begrenzt den laufenden internen Nutzungsstand nach der Beta-Uebergabe ohne ein formales Betriebs-, Support- oder Governance-Modell einzuführen
- P26 minimaler interner Stabilisierungsrahmen in laufender Nutzung im MVP ist als schmale Mini-Spezifikation ergänzt worden; er begrenzt den laufend ruhigen internen Nutzungsstand ohne ein formales Betriebs-, Monitoring- oder Support-Modell einzuführen
- P27 minimaler interner Reaktionsrahmen bei Instabilitaet in laufender Nutzung im MVP ist als schmale Mini-Spezifikation ergänzt worden; er begrenzt die erste Reaktion auf Instabilitaetssignale ohne ein formales Incident-, Support- oder Betriebsreaktionsmodell einzuführen
- P29 minimaler interner Entscheidungsrahmen zur Ausbaupriorisierung nach Bereinigung im MVP ist als schmale Mini-Spezifikation ergänzt worden; er begrenzt die knappe Priorisierung weiterer kleiner Ausbauschritte nach der dokumentarischen Bereinigung ohne ein formales Produktmanagement-, Portfolio- oder Governance-Modell einzuführen
- die zuvor dokumentierte Abgrenzungslogik zwischen Stabilisierung und echtem Funktionsausbau ist als relevanter Referenzpunkt in der Dokumentationslinie verankert
- P31 minimaler interner Entscheidungsrahmen zur Zurueckstellung von Funktionsausbau zugunsten von Stabilisierung im MVP ist als schmale Mini-Spezifikation ergänzt worden; er begrenzt die knappe Zurueckstellung von Ausbau zugunsten von Stabilisierung ohne ein formales Produktmanagement-, Portfolio- oder Governance-Modell einzuführen.
- P33 minimaler interner Entscheidungsrahmen fuer Konsistenzfix-Vorrang vor weiterem Ausbau im MVP ist als schmale Mini-Spezifikation ergänzt worden; er begrenzt die knappe Vorrangentscheidung fuer dokumentarische Konsistenzfixes ohne ein formales Governance-, QA- oder Freigabemodell einzuführen.
- P34 minimaler interner Entscheidungsrahmen fuer ausreichend hergestellte dokumentarische Konsistenz zum wieder kleinen Ausbau im MVP ist als schmale Mini-Spezifikation ergänzt worden; er begrenzt die knappe Rueckkehr zu kleinem Ausbau ohne ein formales Governance-, QA- oder Freigabemodell einzuführen.
- P21 minimaler Uebergang von Beta zu intern nutzbarem Produktstatus im MVP ist als schmale Mini-Spezifikation ergänzt worden; er begrenzt die Einordnung eines Beta-Standes in einen intern tragfaehigen Nutzungsstand ohne ein formales Release-, Betriebs- oder Steuerungsmodell einzuführen.

- Onboarding ist als spaeterer Architektur-/Produktstrang vorgemerkt; aktuell noch nicht Teil des aktiven MVP-Umsetzungsblocks
- Telegram als zusaetzlicher Bedien- und Rueckkanal ist als spaeterer fachlicher Ausbauanker im Pflichtenheft dokumentiert: Angebots-/Veranstaltungsinformationen per Telegram an die App, klaerende Rueckfragen per Telegram und Versand von Rezepten, Produktionshinweisen sowie Einkaufslisten per Telegram an die Produktion; aktuell nur Zielbild, keine Umsetzung und keine Scope-Ausweitung im Konsolidierungsblock.
- Die neue Produkt-/UI-Richtung ist als Discovery- und Zielbildnotiz `docs/product/UI_CHATBOT_GOOGLE_DRIVE_ZIELBILD_DISCOVERY.md` dokumentiert: Apple-like, ruhige Conversational Workbench als Zielbild, Google Drive nur als spaeter bewusst entschiedener Integrationspfad mit OAuth-/Scope-/Rechteklaerung; bestehende Drive-Dateien bleiben grundsaetzlich read-only Importquellen, Schreibzugriff ist nur fuer app-eigene Outputs oder explizit freigegebene Zielartefakte/Zielordner vorgesehen; keine Implementierung, keine neue API, keine Secrets.
- Die vorhandenen UI-Flows `/`, `/angebot` und `/produktion` sind als Ist-Flow-Karte in `docs/product/UI_IST_FLOW_KARTE_CONVERSATIONAL_WORKBENCH.md` dokumentiert; die Karte ordnet Eingaben, Systemantworten, Klaerbedarf, Produktobjekte, Export-/Audit-Bezuege sowie spaetere Workbench- und Drive-Beruehrungen ein, ohne Implementierung oder neue API.
- Das read-only Workbench-Zonenmapping `docs/product/UI_WORKBENCH_ZONE_MAPPING_READONLY.md` ordnet eine spaetere cleane Conversational Workbench den vorhandenen Zonen Quellen/Eingabe, verstandene Daten/Spec, Rueckfragen/Klaerung, Ergebnisobjekte, Export/Drive-Output und Audit/Herkunft/Freigabe zu; Ergebnisobjekte bleiben pruefbar und Drive folgt weiterhin der read-only-Import- bzw. explizit freigegebenen Output-Linie.
- Die `/angebot`-Ansicht ist von der ueberladenen Dashboard-/Card-Projektion auf eine ultra-clean, Apple-like Conversational Workbench reduziert: zentrale Anfrage-/Angebots-Eingabeflaeche, ruhige Zusammenfassung und einklappbare Detailzonen fuer Entwurf, weitere Eingaben sowie operative Uebergabe/Audit; keine neue API, keine Persistenz, kein OAuth/Google/Chat.
- Produktions-UI-Wartbarkeit ist weiter verbessert: Der zuvor grosse `production-question-panel.tsx` ist in kleinere Komponenten fuer strukturierten Antworteditor und Intake-Herkunftskarte aufgeteilt; Texte, Datenfluss und Rueckfragenverhalten bleiben unveraendert.
- Produktions-UI-Wartbarkeit ist mit einem weiteren kleinen Schnitt verbessert: Die read-only Rueckfragen-/ConversationSession-/Ergebnisstatus-Komposition liegt nun in `production-question-thread.tsx`; das Panel bleibt fuer Aktionen und Kontextkarten zustaendig.
- Produktions-UI-Testbarkeit ist weiter verbessert: Die Rezeptvorschlags-Heuristik des strukturierten Antworteditors liegt als pure Helper in `production-recipe-suggestions.ts`.
- Die Rezeptauswahl-Optionen inklusive manuell gewaehltem Override werden ebenfalls im Helper gebaut und fokussiert getestet.
- Backoffice-Browser-Smokes sind konsolenruhiger: Die statische Shell verweist auf `favicon.svg`, damit lokale Browser-Pruefungen nicht mehr durch einen `favicon.ico`-404 rauschen.
- Fuer `/produktion` liegt der enge Strukturplan `docs/plans/production-workbench-structure.md` vor: empfohlen ist Option B, eine eigene `ProductionConversationalWorkbench` nach Angebotsmuster mit dominanter Leitfrage `Was braucht die Produktion als Naechstes?`, ruhiger Kontextzeile und progressiven Zonen fuer Rueckfragen, Produktionsplan, Einkauf, Rezept-/Mengenlogik sowie Audit/Uebergabe; keine neue Fachlogik, API, Persistenz, OAuth/Google oder Chat.
- Die bestehende Rueckfragezone in `/produktion` ist als kleiner Step-3-Slice chataehnlicher: vorhandene `productionQuestions` erscheinen als Assistant-/Agent-Fragen im strukturierten Chatfluss, die bestehenden Antwortfelder erscheinen als Nutzerantwort-Bubble direkt im Chatfluss, und die UI markiert ausdruecklich, dass es kein freier LLM-Chat ist.
- Als Step-4-Slice benennt `/produktion` nach den strukturierten Antworten nun einen klaren naechsten Agent-Schritt fuer Produktionsobjekte und Downloads: Produktionsplan, Rezepte/Objektuebersicht, Einkaufsliste und Downloads werden als vorhandene bzw. entstehende pruefbare Ergebniszone eingeordnet, ohne neue Generierungslogik, API oder Persistenz.
- Security-Hardening Block 1 ist abgeschlossen: `npm audit --omit=dev` ist nach minimalem `npm audit fix` gruen, HTML-Exports escapen datengetriebene Angebots- und Produktionsplan-Texte, und ein fokussierter XSS-Regressionstest schuetzt Script-/Tag-/Event-Attribut-/Quote-Faelle; kein Featurebau, keine neue Persistenzwelt.
- Security-Hardening Block 2 haertet Upload-/PDF-Pfade minimal: zentrale Upload-Limits und MIME-/Extension-Allowlist fuer Intake-, Offer- und Production-Dokumentuploads, streambasierte Groessenpruefung vor Parser-Aufruf sowie Regressionstests fuer zu grosse, unerlaubte und weiterhin erlaubte Dateien; keine neue Parser-Engine, keine OCR, keine neue Persistenzwelt.
- Security-Hardening Block 3 fuehrt einen minimalen Trusted-Identity-Rahmen ein: Bei gesetztem `CATERING_TRUSTED_ACTOR_SECRET` zaehlen Rollen nur noch aus `x-catering-actor-name` plus passendem `x-catering-trusted-secret`; frei setzbares `x-actor-name` bleibt nur lokaler Dev-/Test-Kompatibilitaetsheader und gilt nicht mehr als produktionsnahes Sicherheitsmodell.
- Das Architektur-Gate `docs/architecture/PRODUCTION_AGENT_V1_ARCHITECTURE_GATE.md` sperrt weiteren Produktionsagent-v1-Featurebau, bis Zielbild, Modulgrenzen, Datenfluss, Security-/Qualitaets-Gates und Migrationspfad fuer echte LLM-/PDF-/Rezept-/Allergen-/Persistenzarchitektur bewusst entschieden sind.
- PA1 Slice 1 fuehrt eine minimale read-only `ProductionConversationProjection` im `shared-core` ein und verankert sie sichtbar in `/produktion`: vorhandene Spezifikations-, Rueckfrage-, Antwort- und Outputdaten werden als geordneter Session-/Chat-Verlauf abgebildet, ohne neue API, Persistenz, freie Chat-Eingabe, LLM-, PDF-, Rezept- oder Allergenlogik.
- PA2 zieht minimale Source-/Provenance-Metadaten fuer bestehende Uploadpfade nach: Intake-RawInputs und Rezeptquellen aus Offer-/Production-Uploads koennen Dateiname, normalisierten MIME-Typ, Groesse, SHA-256, Ingestion-Zeitpunkt und Upload-Kontext tragen; keine neue Persistenzwelt, Migration, Parser-Engine, UI oder LLM-/Rezept-/Allergen-Fachlogik.
- PA3 bildet vorhandene `sourceMetadata` in der `ProductionConversationProjection` als read-only `source_provenance_anchor` ab und zeigt den Quellenanker im bestehenden `/produktion`-Chatfluss, ohne neue API, Persistenz, Workflow-, Parser-, LLM-, Rezept- oder Allergenlogik.
- PA4 verbindet diese Quellenanker minimal mit bestehenden Traceability-Sichten: der Produktionsoutput-/Downloadanker traegt dieselben sicheren Hash-Kurzanker testbar mit, die `/produktion`-Detailansicht zeigt Upload-Provenance read-only bei der urspruenglichen Intake-Anfrage, und Produktionsplan-HTML-Exports koennen vorhandene sichere Quellenanker anzeigen; keine rechtssichere Audit-Behauptung, keine neue API, keine neue Persistenzwelt.
- PA5 konsolidiert den Nachvollziehbarkeitskorridor als read-only MVP-Korridor: Upload-Provenance -> Conversation-Quellenanker -> Produktionsoutput/Exportdarstellung. Er ist intern nachvollziehbar, aber kein rechtssicherer Audit und keine Vollständigkeitsgarantie für spätere LLM-/Rezept-/Allergen-Outputs.
- PA6 fasst die interne Beta-/Abnahme-Readiness als Doku-only-Sicht in `docs/product/PA6_INTERNAL_BETA_READINESS_SUMMARY.md` zusammen: interner MVP-Korridor ist ueber bestehende Status-, Test-, Export-, Audit- und Gate-Signale lesbar; externe Nutzung und echte Produktionsagent-v1-Features bleiben ohne OIDC/SSO, read-path Auth, Sandbox/AV, Retention/PII, Human Approval und Architekturentscheidungen nicht freigegeben.
- PA7 AuthN/AuthZ + read-path Auth ist als Entscheidungs-ADR in `docs/architecture/PA7_AUTH_READ_PATH_DECISION_ADR.md` dokumentiert: empfohlen ist Option D als Stufenmodell, zuerst read-only Detail-/Export-/Audit-Pfade auf bestehender Trusted-Actor-/Rollenbasis haerten, externe oder produktionsnahe Nutzung aber weiter an Reverse Proxy/OIDC/SSO bzw. gleichwertigen Identity-Aware Proxy koppeln; keine Login-, Session-, Persistenz- oder OIDC-Implementierung in diesem ADR-Slice.
- PA8 Read-path Auth Hardening Slice 1 ist umgesetzt: sensible read-only Intake-Requests/-Specs, Offer-Drafts/-Recipes, Production-Plans/-Purchase-Lists/-Recipes sowie Print-Export-Pfade fuer Angebot, Produktionsplan und Einkaufsliste verlangen bei gesetztem Trusted-Secret den passenden Trusted-Actor-/Rollen-Kontext; Health bleibt offen, externe Nutzung bleibt ohne Reverse Proxy/OIDC/SSO oder gleichwertigen Identity-Aware Proxy gesperrt.
- PA9 Proxy-/Deployment-Readiness ist als ADR `docs/architecture/PA9_PROXY_DEPLOYMENT_READINESS_ADR.md` dokumentiert und mit `entfernter Doku-Contract-Test` abgesichert: Edge muss clientseitige Trusted-/Actor-Header entfernen, Proxy/IAP setzt `x-catering-actor-name` plus `x-catering-trusted-secret` kontrolliert, `CATERING_TRUSTED_ACTOR_SECRET` ist produktionsnah Pflicht, Secret bleibt serverseitig, Services duerfen nicht direkt oeffentlich erreichbar sein; keine OIDC-/Login-/Session-Implementierung.
- PA10 DocumentIngestion-v1 Boundary ist als kleiner `shared-core`-Baustein umgesetzt: `DocumentIngestionResult` kapselt vorhandene Upload-`sourceMetadata`, Kontext, Status, Warnungen, Ingestion-Zeitpunkt und optional extrahierten Text, ohne neue Parser-Engine, API, Persistenz, Angebotssemantik, LLM-, OCR-, Rezept- oder Allergenlogik.
- PA11 Intake DocumentIngestion Bridge ist umgesetzt: bestehende Intake-Dokumentnormalisierung fuer JSON/Base64 und Multipart nutzt intern `ingestDocument(...)`; Antworten und Audit-Details transportieren nur sichere Ingestion-Status-/Warnungsmarker und vorhandene `sourceMetadata`, waehrend Conversation-/Export-Provenance-Anker weiterhin keine Rohtexte spiegeln.
- PA12 Read-only Ingestion-Warnungen sind sichtbar: bestehende Intake-Detail- und `/produktion`-Conversation-Kontexte zeigen sichere `documentIngestion`-Marker fuer fallback/failed Quellen als knappe Warnhinweise, extracted/ok bleibt ruhig. Keine neue API-Welt, Persistenz, Migration, Parser-Engine, OCR, LLM-/Tool-Use-, Rezept-, Allergen- oder neue Produktlogik.
- PA13 Ingestion-Warnungen in Exportankern ist umgesetzt: sichere fallback/failed `documentIngestion`-Marker werden ueber vorhandene `sourceAnchors` in Produktionsoutput-/Downloadanker und Produktionsplan-HTML-Exports weitergereicht; extracted/ok bleibt ruhig, Rohtexte/extractedText werden nicht gespiegelt.
- PA14 DocumentIngestion-Korridor ist als read-only Abnahmeanker in `tests/pa14-document-ingestion-corridor-readiness.test.ts` und `TESTING.md` abgesichert: Quelle vorhanden -> Ingestion-Status sichtbar -> Warnungen sichtbar -> Exportanker sicher; Rohtexte werden nicht gespiegelt und es wurde keine neue API, UI, Persistenz, Parser-, OCR-, LLM-, Rezept- oder Allergenlogik eingefuehrt.
- B14 Sandbox/Worker/AV-Gate ist als Doku-/Vertragstest-only Anker in `docs/architecture/B14_SANDBOX_WORKER_AV_GATE.md` und `entfernter Doku-Contract-Test` vorbereitet: aktueller Demo-/Ingestion-/Upload-Korridor bleibt intern/testbezogen; produktionsnahe Verarbeitung echter Uploads bleibt ohne Entscheidungen zu erlaubten Dateitypen, Groessenlimits, Quarantaene-/Reject-Verhalten, Scan-/Sandbox-Verantwortung, Worker-Isolation, Fehler-/Warnpfad und Betriebsverantwortung `blocked`.
- B15 Produktions-Demo-Lesbarkeit ist als kleiner UI-/Smoke-Baustein umgesetzt: Die kompakte `/produktion`-Zusammenfassung nennt neben Klarheit, Rueckfragen, Plan- und Einkaufstatus nun auch den vorhandenen Produktionsobjektstatus (`Ergebnisobjekte: ...`); abgesichert in `tests/backoffice-production-acceptance-smoke.test.ts`. Keine neue Fachlogik, API, Persistenz oder Produktflaeche.
- B17 Angebots-/Export-Lesbarkeit ist als kleiner UI-/Smoke-Baustein umgesetzt: Die kompakte `/angebot`-Zusammenfassung nennt bei fokussiertem Entwurf jetzt den vorhandenen Angebots-HTML-Exportstatus (`Export: Angebots-HTML fuer ... bereit`); abgesichert in `tests/backoffice-route-smoke.test.ts`. Keine neue Angebotslogik, Exportlogik, API, Persistenz oder neue Produktflaeche.
- B18 Audit-/Handoff-Lesbarkeit ist als kleiner UI-/Smoke-Baustein umgesetzt: Die bestehende `/produktion`-Herkunft-und-Uebergabe-Zone nennt beim neuesten Audit-Ereignis nicht mehr nur die Summary, sondern auch vorhandenen Actor, Action-Key und Zeitstempel; abgesichert in `tests/backoffice-production-acceptance-smoke.test.ts`. Keine neue Auditlogik, Operatorlogik, API, Persistenz, Exportlogik oder Produktflaeche.
- B19 Angebotsdetail-Kontext ist als kleiner UI-/Smoke-Baustein umgesetzt: Die bestehende `/angebot`-Detailzone `Ausgewählter Entwurf` nennt aus vorhandenen `proposedEventSpec`-Daten frueh Entwurfs-Spec, Readiness und ersten Source-Lineage-Anker; abgesichert in `tests/backoffice-route-smoke.test.ts`. Keine neue Angebotslogik, Intake-Logik, API, Persistenz, Migration oder Produktflaeche.
- B20 Start-/Audit-Lesbarkeit ist als kleiner UI-/Smoke-Baustein umgesetzt: Die bestehende Startseiten-Änderungsprotokoll-Zusammenfassung nennt beim neuesten Audit-Eintrag neben Summary nun vorhandenen Actor, Action-Key und Zeitstempel; abgesichert in `tests/backoffice-route-smoke.test.ts`. Keine neue Auditlogik, Operatorlogik, API, Persistenz, Migration oder Produktflaeche.
- B21 Intake-Status-Lesbarkeit ist als kleiner UI-/Smoke-Baustein umgesetzt: Die bestehende Startseiten-Erfassungsstatuskarte nennt beim neuesten Intake-Request neben requestId und Kanal nun vorhandenen sicheren Quell-Dateinamen und sichere Ingestion-Warnmarker; abgesichert in `tests/backoffice-route-smoke.test.ts`. Keine neue Intake-Logik, API, Persistenz, Migration, Parser-/OCR-/LLM-Engine oder Produktflaeche.
- B23 Produktionsplan-Detailkontext ist als kleiner UI-/Smoke-Baustein umgesetzt: Der bestehende `/produktion`-Downloadbereich nennt beim ausgewählten Produktionsplan nun vorhandene `planId` und `eventSpecId` als `Plan-Kontext`, abgesichert in `tests/backoffice-route-smoke.test.ts`. Keine neue Produktflaeche, Fachlogik, API, Persistenz, Migration oder Exportlogik.
- B24 Pilot-Korridor-Entscheidungsanker ist Doku-/Vertragstest-only umgesetzt: `docs/product/B24_PILOT_KORRIDOR_ENTSCHEIDUNGSANKER.md` verankert Alexanders konservative Entscheidung: interner Demo-Modus `go`, begrenzter interner Pilot mit anonymisierten Daten `not assessed`, produktionsnaher Pilot mit echten Daten, öffentlicher Direktzugriff und beliebige echte Uploads `blocked`; abgesichert in `entfernter Doku-Contract-Test`. Keine neue Produktlogik, Produktfläche, API, Persistenz, Migration, Login/OIDC, Proxy/IAP-Code, Sandbox-/AV-/Worker-, Retention-/Backup-Implementierung, echte Daten oder rechtssichere Compliance-/DSGVO-Freigabe.
- P11-N3 Interner Nutzerkreis und Zugriffskontext ist Doku-/Vertragstest-only umgesetzt: `docs/product/P11_N3_INTERNER_PILOT_PREFLIGHT_RUNBOOK.md` macht Nutzerkreis, fachlichen/technischen Betreiber, Trusted-Actor-Kontext und Zugriffskontrollfragen als nicht-sensitive Entscheidungspunkte sichtbar; `entfernter Doku-Contract-Test` schuetzt die Grenzen aus B24, PA7/PA8/PA9 und B8/B9. Lokales Rehearsal-Go bleibt kein Pilot-/Auth-/Deployment-Go; Auth/OIDC/Login/Session, Proxy/IAP-Code, Deployment, Secrets, neue Rollenplattform, API/Persistenz, echte Daten und Compliance-Freigabe bleiben blockiert.
- B25 Hetzner-Deployment-Preflight ist Doku-/Vertragstest-only umgesetzt: `docs/deployment/B25_HETZNER_DEPLOYMENT_PREFLIGHT.md` benennt Alexanders Hetzner-Server als Zielumgebung, haelt den Deploymentstatus auf `not deployed` und den Produktiv-/Pilotstatus bis zum ausgefuellten Preflight auf `blocked`; abgesichert in `entfernter Doku-Contract-Test`. Kein Deployment, keine Serveraenderung, keine SSH-Verbindung, keine Secret-Erstellung, keine ENV-Datei mit echten Werten, keine Docker-/systemd-/nginx-Konfiguration, keine neue API, Persistenz, Migration, Produktlogik, echte Daten oder rechtssichere Compliance-/DSGVO-Freigabe.
- B26 Hetzner-Preflight-Nachweischeckliste ist Doku-/Vertragstest-only umgesetzt: `docs/deployment/B26_HETZNER_PREFLIGHT_EVIDENCE_CHECKLIST.md` konkretisiert B25 in nicht-sensitive Nachweiszeilen fuer Alexanders Hetzner-Zielumgebung; abgesichert in `entfernter Doku-Contract-Test`. Ohne vollstaendig gruene Mussnachweise bleibt der Produktiv-/Pilotstatus `blocked`; keine Secrets, Tokens, privaten SSH-Keys, ENV-Dumps, PII oder Kunden-/Mitarbeiterdaten werden dokumentiert. Kein Deployment, keine Serveraenderung, keine SSH-Verbindung, keine Secret-Erstellung, keine produktive Config, keine neue API/Persistenz/Migration, keine Produktlogik und keine echten Daten.
- B27 Hetzner-Preflight-Statusvorlage ist Doku-/Vertragstest-only umgesetzt: `docs/deployment/B27_HETZNER_PREFLIGHT_STATUS_TEMPLATE.md` macht die B26-Nachweiszeilen als ausfuellbare, nicht-sensitive Statusvorlage mit Status, Begruendung und naechstem sicheren Schritt sichtbar; abgesichert in `entfernter Doku-Contract-Test`. Defaults bleiben konservativ `not assessed`/`blocked`; Secret-/PII-/IP-Dokumentation bleibt ausgeschlossen. Kein Deployment, keine Serveraenderung, keine SSH-Verbindung, keine Secret-Erstellung, keine produktive Config, keine neue API/Persistenz/Migration, keine Produktlogik und keine echten Daten.
- B28 Hetzner-Preflight-Entscheidungspaket ist Doku-/Vertragstest-only umgesetzt: `docs/deployment/B28_HETZNER_PREFLIGHT_DECISION_PACKET.md` verdichtet B25/B26/B27 in Mussgruppen, die vor einem spaeteren Hetzner-Schritt explizit auf `go` oder `blocked` gesetzt werden muessten; abgesichert in `entfernter Doku-Contract-Test`. Defaults bleiben konservativ `blocked`; Teil-`go` ersetzt keinen Gesamt-Go; Secret-/PII-/IP-Dokumentation bleibt ausgeschlossen. Kein Deployment, keine Serveraenderung, keine SSH-Verbindung, keine Secret-Erstellung, keine produktive Config, keine neue API/Persistenz/Migration, keine Produktlogik und keine echten Daten.
- B29 Hetzner-Preflight-Operatorfragen ist Doku-/Vertragstest-only umgesetzt: `docs/deployment/B29_HETZNER_PREFLIGHT_OPERATOR_QUESTIONS.md` uebersetzt das B28-Entscheidungspaket in nicht-sensitive Operatorfragen fuer Verantwortliche, Zugriffsschicht, Trusted-Header, TLS/Health, Rollback/Stop, Daten-/PII-/Retention-/Backup-Gate und Sandbox-/Worker-/AV-Gate; abgesichert in `entfernter Doku-Contract-Test`. Defaults bleiben konservativ `blocked`/`not assessed`; Teilantworten ersetzen keinen B28-Gesamt-Go; Secret-/PII-/IP-Dokumentation bleibt ausgeschlossen. Kein Deployment, keine Serveraenderung, keine SSH-Verbindung, keine Secret-Erstellung, keine produktive Config, keine neue API/Persistenz/Migration, keine Produktlogik und keine echten Daten.
- B30 Hetzner-Preflight-Antwortübergabe ist Doku-/Vertragstest-only umgesetzt: `docs/deployment/B30_HETZNER_PREFLIGHT_ANSWER_HANDOFF.md` macht die B29-Operatorfragen als sichere Antwortübergabe mit Antwortstatus `go`/`blocked`/`not assessed`, nicht-sensitiver Antwortnotiz und naechstem sicherem Schritt nutzbar; abgesichert in `entfernter Doku-Contract-Test`. Defaults bleiben konservativ `blocked`/`not assessed`; Teilantworten ersetzen keinen B28-Gesamt-Go; Secret-/PII-/IP-Dokumentation bleibt ausgeschlossen. Kein Deployment, keine Serveraenderung, keine SSH-Verbindung, keine Secret-Erstellung, keine produktive Config, keine neue API/Persistenz/Migration, keine Produktlogik und keine echten Daten.
- B31 Hetzner-Management-Entscheidungsliste ist Doku-/Vertragstest-only umgesetzt: `docs/deployment/B31_HETZNER_MANAGEMENT_DECISION_LIST.md` verdichtet B25-B29 in eine kurze nicht-sensitive Management-Liste fuer Betreiber/Verantwortliche, Zugriffsschicht, Trusted-Header/Secret, TLS/Health, Stop/Rollback, Daten/PII/Retention/Backup und Sandbox/Worker/AV; abgesichert in `entfernter Doku-Contract-Test`. Produktiv-/Pilotstatus bleibt `blocked`, solange eine Mussgruppe offen, `not assessed` oder `blocked` ist; keine Secrets, Serverdetails, echten Daten, Deployment-, SSH-, API-, Persistenz- oder Produktlogik-Aenderung.
- B34 Option-B Pilot-Gate-Entscheidungen ist Doku-/Vertragstest-only umgesetzt: `docs/deployment/B34_OPTION_B_PILOT_GATE_DECISIONS.md` haelt Alexanders Entscheidungen mit Risikobegrenzung fest: Tailscale/VPN-only, keine direkte Service-Exposition, zunaechst Einzelzugriff Alexander, spaeter serverseitiger Trusted-Kontext, echte Kunden-/Event-/Angebots-/Produktionsdaten nur innerhalb der Hetzner-App-Systemgrenze, 90 Tage Retention, begrenztes Backup mit noch offener konkreter Retention, eingeschraenkte Logs/Audit-Regel und echte Uploads erst nach B14-Sicherheitsgate. `entfernter Doku-Contract-Test` schuetzt, dass daraus nur ein `preparation decision go` entsteht und kein Deployment-Go, echte-Daten-Start-Go, SSH-Go, echte-Upload-Go oder Compliance-/DSGVO-Freigabe.
- B35 Option-B Vorbereitungskorridor ohne sensible Werte ist Doku-/Vertragstest-only umgesetzt: `docs/deployment/B35_OPTION_B_PREPARATION_BOUNDARY.md` uebersetzt B34 in den kleinsten erlaubten Vorbereitungskorridor: Gate-Konsistenz, Tailscale/VPN-only als nicht-sensitiver Zieltyp, Ausschluss direkter Service-Exposition, Trusted-Header-Grenze, Evidence-Regeln, offene Backup-Retention und Upload-Blockade bis B14. `entfernter Doku-Contract-Test` schuetzt, dass daraus kein Serverlauf, Deployment-Go, SSH-Go, keine Serveraenderung, keine Secret-/produktive-ENV-Erstellung, keine echten Daten, keine echten Uploads und keine Compliance-/DSGVO-Freigabe entsteht.
- B36 Backup-Retention-Entscheidungsanker fuer Option-B-Pilot ist Doku-/Vertragstest-only umgesetzt: `docs/deployment/B36_BACKUP_RETENTION_DECISION.md` vergleicht 7, 14 und 30 Tage und empfiehlt 14 Tage als Pilot-Default, sofern Alexander nichts anderes entscheidet. `entfernter Doku-Contract-Test` schuetzt, dass B36 nur eine Managemententscheidung dokumentierbar macht und keine Backup-Aktivierung, kein Restore-Test, kein Serverlauf, kein Deployment-Go, kein Echtdaten-Go, keine echten Uploads, keine Secrets, keine produktive ENV, keine IPs/Hostnames, keine produktiven Logs, keine neue API/Persistenz/Migration und keine Compliance-/DSGVO-Freigabe entsteht.
- B37 Nicht-sensitiver technischer Vorbereitungsplan fuer Option-B-Pilot ist Doku-/Vertragstest-only umgesetzt: `docs/deployment/B37_NONSENSITIVE_TECHNICAL_PREPARATION_PLAN.md` bringt den spaeteren technischen Vorbereitungslauf in eine reine nicht-sensitive Arbeitsreihenfolge: Gate-Konsistenz B25-B37/B13/B14/PA9/B9/TESTING, Tailscale/VPN-only nur als Zugriffsschutz-Typ, Nicht-Exposition von App/API/Serviceports, serverseitige Trusted-Header-Grenze mit Header-Stripping, Evidence nur als Status-/Existenz-/Testsignal, 14 Tage Pilot-Default aus B36 nur als Entscheidungsanker, Uploads weiter `blocked until B14 go` und nicht-sensitive Stop-/Rollback-/Incident-Notizen. `entfernter Doku-Contract-Test` schuetzt, dass daraus kein Deployment-Go, SSH-Go, Serveraenderung, Secret-/ENV-Erstellung, Echtdatenstart, Backup-Aktivierung, echte Uploads, neue API/Persistenz/Migration oder Compliance-/DSGVO-/AVV-Freigabe entsteht.
- PA15 ProductionAgent-v1 Next Capability ADR ist als Entscheidungsvorlage in `docs/architecture/PA15_PRODUCTION_AGENT_NEXT_CAPABILITY_ADR.md` dokumentiert und mit `entfernter Doku-Contract-Test` abgesichert: Empfohlen wird Option A Rueckfragenmodell / Clarification Model als naechste echte, eng begrenzte Agentenfaehigkeit; keine Runtime-Implementierung, API, Persistenz, LLM-/Tool-Use-, Rezept- oder Allergenlogik.
- PA16 Clarification Model Slice 1 ist umgesetzt: `shared-core` definiert `ProductionClarificationQuestion` und leitet read-only Rueckfragen nur aus `missingFields`, `readiness.reasons`, `documentIngestion.status` und `documentIngestion.warnings` ab; die bestehende `ProductionConversationProjection` transportiert diese Fragen als strukturierte Agent-Fragen mit sicheren Quellenankern, ohne Nutzerantwortlogik, neue API, Persistenz, LLM-/Tool-Use-, Parser-, Rezept-, Mengen- oder Allergenlogik.
- PA17 Clarification Question Quality Slice ist umgesetzt: Rueckfragen werden deterministisch nach Schwere/Ursache sortiert, identische Ursachen je sicherem Quellenanker dedupliziert und bekannte sichere Feld-/Warnkeys mit neutralen deutschen Kurzlabels angezeigt; unbekannte Keys bleiben technische Fallbacks, sensible Roh-/Extraktionstexte werden nicht gespiegelt.
- PA18 Clarification Answer Processing Gate ist als ADR-/Security-Grenze dokumentiert: spaetere Antworten muessen an `questionId`/Question-Key gebunden, typisiert, sanitizet und reviewfaehig bleiben; PA18 fuehrt keine Antwortannahme, Speicherung, Verarbeitung, API, Persistenz oder Rezept-/Mengen-/Allergenentscheidung ein.
- PA19 Clarification Answer Type Anchor ist als reiner shared-core Typ-/Testanker umgesetzt: `shortText` ist der einzige aktiv erlaubte erste Runtime-Antworttyp; `ProductionClarificationAnswerDraft` bindet nur an `questionId` und Question-Key und traegt keinen Antwortinhalt, keine API-, Persistenz- oder Runtime-Annahme.
- PA20 Clarification Answer Data Model / Migration Decision ADR ist als reine Entscheidungsvorlage dokumentiert: empfohlen wird Option B als spaeteres kleines explizites `ProductionClarificationAnswer`-Datenmodell innerhalb der bestehenden Domain-/Persistenzgrenzen, aber ohne PA20-Runtime, Antwortspeicherung, Antwortverarbeitung, API, Migration oder neue Persistenzwelt.
- PA21 ProductionClarificationAnswer Modellanker ist als reiner shared-core Typ-/Testanker umgesetzt: Option B ist als Zielrichtung bestaetigt, `ProductionClarificationAnswer` bindet an `questionId` plus Question-Key, erlaubt aktiv nur `shortText`, nutzt exakt `draft/submitted/reviewed` und verankert Textlaengen-/Sicherheitsgrenzen; keine Runtime, Persistenz, API, Migration, UI-/Projection-Erweiterung oder automatische Spec-Korrekturueberfuehrung.
- PA22 Clarification Answer Storage/Display Gate ist als ADR-/Marker-Slice dokumentiert: spaetere kurze Freitextantworten duerfen nur im `ProductionClarificationAnswer`-Modell innerhalb bestehender Domain-/Persistenzgrenzen gespeichert und read-only in bestehenden `/produktion`-Projection-/Detailankern angezeigt werden; PA22 selbst fuehrt keine Runtime, Antwortannahme, Antwortspeicherung, API, UI-Erweiterung, Migration, neue Persistenzwelt, Fachableitung oder Rohtext-/PDF-Extrakt-Spiegelung ein.
- PA23 Clarification Answer Runtime Minimal Slice ist umgesetzt: bestehende `ProductionClarificationQuestion` wird validiert, `shortText` bis 500 Zeichen als `submitted` erzeugt, HTML/Script fuer read-only Anzeige escaped, ueber die bestehende `ProductionStore`-/`PersistentCollection`-Grenze gespeichert und in der bestehenden `ProductionConversationProjection` angezeigt; keine neue HTTP-API, Migration, neue Persistenzwelt, Antwortbearbeitung, aktive `draft`-/`reviewed`-Runtime, automatische Spec-Korrektur, Fachableitung oder Rezept-/Mengen-/Allergenlogik.
- PA24 Clarification Answer Session/Spec Binding Anchor ist umgesetzt: bestehende `specId` und daraus bereits vorhandene `production-session-${specId}`-Conversation-Session bilden die explizite Kontextbindung fuer Rueckfragen und Antworten; Antworten ohne eindeutige Spec-/Session-Bindung oder mit falscher Bindung werden nicht erzeugt bzw. nicht projiziert. Keine neue ID-Welt, keine neue Persistenzwelt, keine API-/UI-Erweiterung.
- PA25 Clarification Answered Status Anchor ist umgesetzt: `ProductionConversationProjection` markiert bestehende Clarification-Fragen read-only als `answered` oder `unanswered`, wobei nur passende `submitted`-`shortText`-Antworten mit gleicher `questionId`, stabilem Question-Key und gleicher Spec-/Session-Bindung zaehlen; keine Antwortbearbeitung, kein automatisches Schliessen/Entfernen von Fragen, keine Spec-Korrektur und keine Fachableitung.
- Hans Day Build 2026-05-22 PA26-PA31 ist als nutzbarer Tagesstand umgesetzt und nach CI-Fix gruen verifiziert: `/produktion` zeigt Rueckfragenstatus, naechsten Arbeitsschritt, interne Produktionsobjekte/Downloads, Rezeptpruefstatus sowie Herkunft/Uebergabe ruhiger aus vorhandenen Daten. Der Abschluss bleibt bewusst kein weiterer Featurebau, sondern Betriebscheck- und Dokumentationsstand; offen bleibt produktionsnahe Nutzung ohne die bestehenden Architektur-/Security-Gates, out of scope bleiben neue API, Persistenz/Migration/Prisma, LLM-/Tool-/OCR-/Parser-Ausbau, automatische Spec-Korrektur, Rezept-/Allergenautomatik, OAuth/Google/Login/OIDC und `/angebot`-Umbau.
- C2 dokumentiert `npm run local:check` als CI-unabhaengigen lokalen Betriebs-/Seed-/Export-/Auditbeleg und grenzt ihn von `npm run local:status`, Produktionsfreigabe und rechtssicherer Audit-Aussage ab; ein fokussierter Vertragstest schuetzt das C1-Auditfenster `limit=200` plus deterministische Fehlermeldungen.
- C3 Angebot-Happy-Path ist als interner jsdom-Smoke abgesichert: `/angebot` prueft zentrale Anfrageeingabe, neu erzeugten fokussierten Angebotsentwurf, Status-/Uebergabe-/Exportanker und den bestehenden Link zur Produktion; Code-Fix nur fuer den echten Fokus-Marker nach Entwurfserzeugung, keine Angebotslogik/API/Persistenz.
- C4 Angebot-zu-Produktion-Uebergabeanker ist als interner jsdom-Smoke abgesichert: derselbe vorhandene Draft-/Spec-/Request-Kontext bleibt zwischen `/angebot` und `/produktion` ueber sichtbare `draftId`-, `specId`-, `requestId`- und Exportanker pruefbar; minimaler UI-/Read-Fix nur fuer sichtbare Marker und vorhandenes `requestId`-Detailloading, keine neue API, Persistenz oder Uebergabelogik.
- C5 Exportlinks mit Trusted-Actor-Kontext ist als read-only Regression in `tests/pa8-read-path-auth.test.ts` ergänzt: Angebot-, Produktionsplan-/Produktionsblatt- und Einkaufslisten-Exports verlangen bei gesetztem Trusted-Secret passende Trusted-Actor-Rollen, frei gesetztes `x-actor-name` bleibt wirkungslos und Health bleibt offen.
- P3-B34 Startseite als Beta-Kontrollzentrum ist minimal gehaertet: Die Startseite benennt nun explizit den internen Beta-Kontrollzentrum-Kontext fuer Demo, Erfassung, Angebot, Produktion, Export und Audit aus vorhandenen Daten; `tests/backoffice-route-smoke.test.ts` schuetzt diesen Marker. Keine neue Dashboard-Welt, keine neue Datenquelle, keine API, Persistenz, Deployment, Login/OIDC oder echte Datenverarbeitung.
- P5-B50 Startseite als Beta-Einstieg ist minimal geschaerft: Die bestehende Startseite nennt jetzt den expliziten Beta-Weg `Start -> Angebot -> Produktion -> Rueckfragen -> Exporte/Audit` und den naechsten Einstieg Angebot/Produktion/Rueckfragen; abgesichert in `tests/backoffice-route-smoke.test.ts`. Keine neue Dashboard-Welt, Datenquelle, API, Persistenz, Deployment, Login/OIDC oder echte Datenverarbeitung.
- P5-B51 `/angebot` Nutzerfuehrung fuer Entwurf und Uebergabe ist minimal geschaerft: Die bestehende Angebotszusammenfassung nennt jetzt den naechsten Angebotsschritt Entwurf pruefen, Variante uebernehmen, Angebots-HTML exportieren und zur Produktion wechseln; abgesichert in `tests/backoffice-route-smoke.test.ts`. Keine neue Angebotslogik, automatische Spec-Korrektur, API, Persistenz, Deployment, Login/OIDC oder echte Datenverarbeitung.
- P5-B52 `/produktion` Nutzerfuehrung fuer den naechsten Schritt ist minimal geschaerft: Die bestehende Produktionszusammenfassung nennt jetzt den Beta-Pfad `Rueckfragen -> Ergebnisobjekte -> Exporte/Audit`; abgesichert in `tests/backoffice-production-acceptance-smoke.test.ts`. Keine neue Produktionslogik, Produktflaeche, API, Persistenz, Deployment, Login/OIDC, LLM-/Tool-Use-, Rezept-/Allergenautomatik oder echte Datenverarbeitung.
- P5-B53 Export-/Download-/Audit-Endpunkt des Beta-Durchlaufs ist minimal geschaerft: Die bestehende `/produktion`-Abschlusszone benennt Produktionsblatt, Einkaufsliste und Audit-Spur als interne Arbeitsbelege, markiert fehlende Artefakte weiter als offen und grenzt externe Freigabe, Signatur- und Compliance-Behauptung ab; abgesichert in `tests/backoffice-production-acceptance-smoke.test.ts`. Keine Exportlogik, Auditlogik, API, Persistenz, Deployment, Login/OIDC, Signatur-/Compliance-Welt oder echte Datenverarbeitung.
- P5-B54 Manuelle Beta-Test-Checkliste fuer Alexander ist Doku-/Vertragstest-only umgesetzt: `docs/product/P5_B54_MANUELLE_BETA_TEST_CHECKLISTE.md` fuehrt lokal durch `Start -> Angebot -> Produktion -> Rueckfragen -> Exporte/Audit`, nennt URLs, sichtbare Marker, Stop-Gates, Nicht-Freigaben und den B12-Ergebnisvermerk; abgesichert in `entfernter Doku-Contract-Test`. Keine neue QA-Plattform, Produktlogik, API, Persistenz, Deployment, echten Daten, Login/OIDC, automatische Spec-Korrektur oder Rezept-/Allergenautomatik.
- P5-B55 Full Gates und Nutzbarkeits-Lage ist als No-Product-Change abgeschlossen: Plan 5 wurde ueber fokussierte Beta-Smokes/Vertragstests, `npm test`, `npm run build`, `npm audit --omit=dev`, `git diff --check`, `npm run local:status` und `npm run local:check` verifiziert; Snapshot `docs/agent-memory/memory_v5.186_2026-05-23.md` haelt den Stand fest. Intern nutzbar ist der lokale Beta-Korridor `Start -> Angebot -> Produktion -> Rueckfragen -> Exporte/Audit` mit Demo-/Seed-/synthetischen Daten, sichtbaren UI-Leitplanken, read-only Export-/Auditbelegen und manueller Checkliste; offen/blockiert bleiben echte Daten, produktionsnahe Nutzung, Deployment, Auth/OIDC, PII/Retention/Backup, Sandbox/Worker/AV, neue Persistenz/API, automatische Spec-Korrektur sowie Rezept-/Allergenautomatik.
- P6-B56 Beta-Onboarding-Iststand und Lueckenkarte ist Doku-/Vertragstest-only umgesetzt: `docs/product/P6_B56_BETA_ONBOARDING_ISTSTAND_LUECKENKARTE.md` buendelt Starten -> Durchlaufen -> Reibung notieren -> Stop-Gates, trennt intern testbar, nur synthetisch, blockiert und verboten, und benennt die naechsten Plan-6-Luecken Start-/Status-Korridor, Friction-Log, synthetische UI-Grenze, Rueckfragen-/Produktions-Weiterpunkt und Management-Entscheidung nach Beta-Feedback; abgesichert in `entfernter Doku-Contract-Test`. Keine Produktlogik, UI-Aenderung, API, Persistenz, Deployment, SSH, Secrets, echten Daten, Login/OIDC, automatische Spec-Korrektur oder Rezept-/Allergenautomatik.
- P6-B57 Lokaler Start-/Status-Korridor ist Doku-/Vertragstest-only umgesetzt: `docs/product/P6_B57_LOKALER_START_STATUS_KORRIDOR.md` buendelt Starten -> Status pruefen -> Betriebscheck -> UI-Routen oeffnen -> kontrolliert stoppen mit bestehenden Scripts, lokalen UI-/Health-URLs und sicherer Reaktion auf rote Status-/Check-Signale; abgesichert in `entfernter Doku-Contract-Test`. Keine Produktlogik, API, Persistenz, Betriebsplattform, Deployment, SSH, Secrets, echten Daten, Login/OIDC, Produktionsfreigabe oder rechtssichere Audit-/Compliance-Aussage.
- P6-B58 Reibungslog fuer manuellen Beta-Durchlauf ist Doku-/Vertragstest-only umgesetzt: `docs/product/P6_B58_BETA_REIBUNGSLOG_VORLAGE.md` strukturiert sichere Reibungsnotizen fuer Start -> Angebot -> Produktion -> Rueckfragen -> Exporte/Audit mit Beobachtung, Route, Erwartung, tatsaechlichem Verhalten, Schweregrad, Screenshot-Hinweis ohne personenbezogene Daten und naechster Entscheidung; abgesichert in `entfernter Doku-Contract-Test`. Keine externe QA-Plattform, neue Produktlogik, API, Persistenz, Speicherung echter Nutzerdaten, echten Daten, Deployment, Auth/OIDC, automatische Spec-Korrektur oder Rezept-/Allergenautomatik.
- P6-B59 UI-Grenzen fuer synthetischen Beta-Durchlauf ist als kleiner UI-/Smoke-Baustein umgesetzt: Startseite, `/angebot` und `/produktion` nennen sichtbar, dass der Durchlauf nur synthetisch/intern ist und keine echten Daten bzw. keine Produktionsfreigabe erlaubt; abgesichert in `tests/backoffice-route-smoke.test.ts` und `tests/backoffice-production-acceptance-smoke.test.ts`. Keine neue Auth-, Daten-, Freigabe-, API-, Persistenz-, Deployment-, LLM-/Tool-Use-, Parser-/OCR-, automatische Spec-Korrektur- oder Rezept-/Allergenfunktion.
- P6-B60 Rueckfragen-/Produktions-Reibung ist als kleiner UI-/Smoke-Baustein geschaerft: `/produktion` nennt nun einen Beta-Pruefpunkt, wonach Rueckfragenstatus, Produktionsobjekte und Export-/Auditanker sichtbar sein muessen und offene Stop-Punkte Stop statt Freigabe bedeuten; abgesichert in `tests/backoffice-production-acceptance-smoke.test.ts`. Keine automatische Spec-Korrektur, keine Rezept-/Allergenautomatik, keine neue API, Persistenz, Deployment, Auth/OIDC, LLM-/Tool-Use- oder echte Datenverarbeitung.
- P6-B61 Beta-Durchlauf als Management-Entscheidungsvorlage ist Doku-/Vertragstest-only umgesetzt: `docs/product/P6_B61_BETA_MANAGEMENT_ENTSCHEIDUNGSVORLAGE.md` verdichtet P6-B56 bis P6-B60 in sofort testbar, Stop-Gates, No-go, Alexanders Entscheidung und den naechsten engen Produktwertblock nur nach beobachteter Reibung; abgesichert in `entfernter Doku-Contract-Test`. Keine Produktlogik, UI-Aenderung, API, Persistenz, Deployment, echten Daten, Auth/OIDC, automatische Spec-Korrektur oder Rezept-/Allergenautomatik.
- P6-B62 Full Gates und Plan-6-Lage ist als No-Product-Change abgeschlossen: Plan 6 wurde mit fokussierten P6-Smokes/Vertragstests, `npm test`, `npm run build`, `npm audit --omit=dev`, `git diff --check`, `npm run local:status` und `npm run local:check` verifiziert; Snapshot `docs/agent-memory/memory_v5.193_2026-05-23.md` haelt den Stand fest. Lokal beta-testbar bleibt der synthetische interne Korridor `Start -> Angebot -> Produktion -> Rueckfragen -> Exporte/Audit` inklusive Start-/Status-Korridor, Reibungslog und Management-Entscheidungsvorlage; offen bleiben echte Reibungsdaten aus einem manuellen Beta-Durchlauf sowie alle blockierten Gates fuer echte Daten, produktionsnahe Nutzung, Deployment, Auth/OIDC, PII/Retention/Backup, Sandbox/Worker/AV, neue Persistenz/API, automatische Spec-Korrektur und Rezept-/Allergenautomatik.
- P7-B67 Reibung-zu-Backlog-Triage ist Doku-/Vertragstest-only umgesetzt: `docs/product/P7_B67_REIBUNG_ZU_BACKLOG_TRIAGE.md` verbindet P6-B58-Reibungslog, P6-B61-Managementregel und P7-B65-Evidenzpaket zu einer kleinen Triage-Matrix fuer beobachtete Reibung: sofort kleiner Fix, spaeter, Entscheidung noetig oder out of scope/verboten. Keine Produktlogik, UI-Aenderung, API, Persistenz, Deployment, echte Daten, Auth/OIDC, automatische Spec-Korrektur oder Rezept-/Allergenautomatik.
- P7-B68 Full Gates und Plan-7-Lage ist als No-Product-Change abgeschlossen: Plan 7 wurde mit fokussierten P7-Vertragstests, `npm test`, `npm run build`, `npm audit --omit=dev`, `git diff --check`, `npm run local:status` und `npm run local:check` verifiziert; Snapshot `docs/agent-memory/memory_v5.195_2026-05-23.md` haelt den Stand fest. Manuell rehearsable ist jetzt der synthetische interne Korridor mit Startkarte, Szenariokarte, Evidenzpaket, UI-Orientierungsmarkern und Reibung-zu-Backlog-Triage. Naechster Produktbau darf nur anhand beobachteter manueller Reibung erfolgen; echte Daten, produktionsnahe Nutzung, Deployment, Auth/OIDC, PII/Retention/Backup, Sandbox/Worker/AV, neue Persistenz/API, automatische Spec-Korrektur und Rezept-/Allergenautomatik bleiben blockiert.
- R2 synthetischer Beta-Rehearsal-Microfix ist umgesetzt: Nach strukturierten Antworten im `/produktion`-Korridor erzeugt `buildProductionClarificationQuestions` aus `readiness.status === "complete"` mit positivem Readiness-Hinweis keine scheinbar offene Rueckfrage mehr; Regression in `tests/pa16-production-clarification-model.test.ts`. Im lokalen Rehearsal bleiben Ergebnisobjekte, Produktionsblatt-/Einkaufslisten-Exportanker und Audit-/Herkunftsanker sichtbar. Offen als echter naechster Befund bleibt die nicht beantwortbare Zeitfenster-Rueckfrage aus bestehender `event.schedule`-Uncertainty, weil deren Loesung eine bewusste Produkt-/Datenmodellentscheidung erfordert.
- P8-N1 Option-A Copy-Anker im Produktions-Rehearsal ist als kleiner UI-/Smoke-Baustein umgesetzt: Die bestehende `/produktion`-Zusammenfassung nennt nun explizit, dass das verbindliche Zeitfenster manuell zu klaeren und nur als Rehearsal-Notiz festzuhalten ist; eine automatische `event.schedule`-Uebernahme findet nicht statt. Abgesichert in `tests/backoffice-production-acceptance-smoke.test.ts`. Keine Runtime-Schedule-Logik, neue API, Persistenz/Migration, automatische Spec-Korrektur, echten Daten, Deployment, Login/OIDC oder Rezept-/Allergenautomatik.
- P8-N2 Rehearsal-Checkliste fuer interne Testperson ist Doku-/Vertragstest-only geschaerft: P7-B63, P7-B64 und P7-B65 erklaeren jetzt, dass das fiktive verbindliche Zeitfenster nur manuell als `Zeitfenster-Rehearsal-Notiz` im Evidenzpaket festgehalten wird, nicht automatisch in `event.schedule` uebernommen wird und keine Runtime-Loesung/Spec-Korrektur darstellt; abgesichert in `entfernter Doku-Contract-Test`. Keine UI-Feature-Umsetzung, Runtime-Logik, API, Persistenz/Migration, echten Daten, Deployment/Login/OIDC oder Rezept-/Allergenautomatik.
- P8-N3 Export-/Audit-Evidenz fuer Option A ist Doku-/Vertragstest-only geschaerft: P7-B65 stellt klar, dass Export-/Auditbelege keine strukturierte Zeitfensterloesung beweisen und die `Zeitfenster-Rehearsal-Notiz` nur manuelle Copy-/Anleitungsnotiz bleibt; abgesichert in `entfernter Doku-Contract-Test`. Keine Exportlogik, API, Persistenz/Migration, Runtime-Schedule-Logik, automatische/halbautomatische Spec-Korrektur oder echten Daten.
- P8-N4 Local Ops / Smoke Robustheit nach Option A ist Doku-/Vertragstest-only geschaerft: C8, TESTING und P6-B57 benennen jetzt explizit, dass `npm run local:status` und `npm run local:check` keine strukturierte Zeitfensterloesung belegen; `entfernter Doku-Contract-Test` schuetzt zudem, dass `scripts/check-local-ops.sh` auf bestehende Smoke-/Seed-/Export-/Auditanker begrenzt bleibt und keine Schedule-Verarbeitung enthaelt. Keine Infra-/Deployment-Arbeit, API, Persistenz/Migration, automatische Spec-Korrektur oder echten Daten.
- P8-N5 Abschlussgate / Memory Snapshot / Management-Lage ist als No-Product-Change abgeschlossen: Plan 8 wurde ueber die vorhandenen P8-Vertragstests/Smokes, `npm test`, `npm run build`, `npm audit --omit=dev`, `git diff --check`, `npm run local:status`, `npm run local:check` und CI fuer den letzten Push verifiziert; Snapshot `docs/agent-memory/memory_v5.202_2026-05-23.md` haelt den Stand fest. Option A bleibt fuer den internen Beta-MVP die bewusste Copy-/Anleitungsloesung ohne Datenmodell-, API-, Persistenz-, Runtime-Schedule- oder automatische Spec-Korrektur.
- P9-N1 Rehearsal-Nachweisrahmen ist Doku-/Vertragstest-only konsolidiert: `docs/product/P9_N1_LOKALER_REHEARSAL_NACHWEISRAHMEN.md` verlinkt C8, P6-B57, P6-B58, P7-B63/B64/B65/B67 und die Plan-8-Option-A-Grenze als lokalen Nachweisindex; `entfernter Doku-Contract-Test` schuetzt Auffindbarkeit und klare Trennung von lokal/synthetisch gruen gegen echte Daten, Produktionsfreigabe und Compliance blocked. Keine Produktlogik, UI, API, Persistenz, Deployment oder echte Daten.
- P3-B35 Angebot-Route fuer Beta-Durchlauf ist minimal gehaertet: Die bestehende `/angebot`-Zusammenfassung benennt den internen Beta-Schritt fuer Anfrage, Entwurf, Export und Uebergabe aus vorhandenen Daten; `tests/backoffice-route-smoke.test.ts` schuetzt den Marker zusammen mit Anfrage-/Spec-Bezug, Entwurfsstatus, Exportanker und Produktionsuebergabe. Keine neue Angebotslogik, API, automatische Spec-Korrektur, Persistenz, Deployment, Login/OIDC oder echte Datenverarbeitung.
- P3-B36 Produktion-Route fuer Beta-Durchlauf ist minimal gehaertet: Die bestehende `/produktion`-Zusammenfassung benennt den internen Beta-Schritt fuer Produktion, Einkaufsliste, Exporte, Herkunft und offene Rueckfragen aus vorhandenen Daten; `tests/backoffice-production-acceptance-smoke.test.ts` schuetzt den Marker neben Plan-/Einkauf-/Export-/Herkunftsankern. Keine neue Produktionslogik, kein neuer Workflow, keine Rezept-/Allergenautomatik, keine API, Persistenz, Deployment, Login/OIDC oder echte Datenverarbeitung.
- P3-B37 Upload-Grenzen als Beta-Risiko ist Doku-/Test-only sichtbar gemacht: TESTING und C8 benennen Intake-Limit 8 MiB/bis zu 3 Multipart-Dateien, Rezeptupload-Limit 5 MiB/genau eine Datei, erlaubten Dokumentkorridor PDF/TXT/MD/EML/Pages, kontrollierte Abweisung zu grosser/unerlaubter Dateien und die Blockade produktionsnaher echter/beliebiger Uploads ohne Sandbox/Worker/AV-Gate; `tests/pa14-document-ingestion-corridor-readiness.test.ts` schuetzt diese Marker ohne Rohtext-/Vollhash-Leaks. Keine Parser-/OCR-/LLM-Engine, keine API, Persistenz, Deployment, Login/OIDC oder echte Datenverarbeitung.
- P3-B38 Echte-Daten-Stop-Gate ist Doku-/Test-only im Beta-Runbook verankert: C8 und TESTING trennen Demo-/Seed-/synthetische Daten als erlaubten internen Beta-Korridor von echten Personen-/Kunden-/Einsatzdaten, die ohne entschiedenes PII/Retention/Backup-Gate und Sandbox/Worker/AV-Gate `blocked` bleiben; lokale Demo-/Upload-/Health-/Export-Gruensignale sind kein Compliance-Freibrief. Keine echte Datenverarbeitung, keine API, Persistenz, Deployment, SSH, Secrets, Login/OIDC oder Compliance-/DSGVO-Freigabe.
- P3-B39 Full Gates und Status-Snapshot ist No-Product-Change abgeschlossen: Plan-3-Zwischenstand wurde ueber fokussierte P3-Smokes, `npm test`, `npm run build`, `npm audit --omit=dev`, `git diff --check` und `npm run local:status` verifiziert; Snapshot liegt unter `docs/agent-memory/memory_v5.174_2026-05-22.md`. Keine Produktlogik, API, Persistenz, Deployment, SSH, Secrets, Login/OIDC oder echte Datenverarbeitung.
- P4-B44 Read-only Status in `/produktion` ist minimal geschaerft: die bestehende Production Conversation Projection wird in der UI nun auch fuer optionale vorhandene `clarificationAnswers` genutzt, zeigt beantwortete Rueckfragen als read-only Nutzerantworten und fasst offene/beantwortete Rueckfragen in der ruhigen Zusammenfassung zusammen; abgesichert in `tests/backoffice-production-acceptance-smoke.test.ts`. Keine neue API, Persistenz, Migration, Antwortbearbeitung, automatische Spec-Korrektur, Fachableitung, LLM-/Tool-Use-, Rezept-/Allergenlogik oder echte Daten.
- P4-B45 synthetischer beantworteter Rueckfragen-Demoanker ist als Testfixture umgesetzt: `shared-core/src/fixtures/demo-scenarios.ts` stellt einen nicht-sensitiven beantworteten Clarification-Anker bereit, und `tests/local-ops-check-contract.test.ts` schuetzt dessen Projektion als beantwortete Rueckfrage. Keine echte Datenverarbeitung, keine neue API, Persistenz/Migration, Antwortbearbeitung, automatische Spec-Korrektur, LLM-/Tool-Use-, Rezept-/Allergenlogik, Deployment, SSH, Secrets oder Login/OIDC.
- P4-B46 Antwort-Fortsetzung im Conversation-Fluss ist minimal gehaertet: `ProductionConversationProjection` labelt strukturierte Rueckfragen nun als `Agent fragt · beantwortet` bzw. `Agent fragt · offen`, und ein fokussierter Projection-Test schuetzt die deterministische Reihenfolge offene/beantwortete Rueckfrage, Antwort-Bubble und Produktionsoutput-/Downloadanker. Keine neue Chat-/Agent-Runtime, Produktflaeche, API, Persistenz/Migration, automatische Spec-Korrektur, Fachableitung, LLM-/Tool-Use-, Rezept-/Allergenlogik, Deployment, SSH, Secrets, Login/OIDC oder echte Datenverarbeitung.
- P4-B47 interner synthetischer Beta-Durchlauf fuer Rueckfragen ist Doku-/Test-only auffindbar gemacht: C8 und TESTING benennen den synthetischen Answer-Anker `spec-demo-production-answered-clarification`, die Labels `Agent fragt · offen`/`Agent fragt · beantwortet`, die `user_structured_answer`-Antwort-Bubble und die read-only Ergebnis-/Exportanker; der lokale Ops-Vertrag schuetzt diese Auffindbarkeit. Keine neue Runtime, API, Persistenz/Migration, automatische Spec-Korrektur, Fachableitung, LLM-/Tool-Use-, Rezept-/Allergenlogik, Deployment, SSH, Secrets, Login/OIDC oder echte Datenverarbeitung.
- P4-B48 Full Gates, Memory-Snapshot und naechster Nutzwertentscheid ist als No-Product-Change abgeschlossen: Plan 4 wurde ueber fokussierte Clarification-/Production-/Local-Ops-Tests, `npm test`, `npm run build`, `npm audit --omit=dev`, `git diff --check` und kontrolliertes `npm run local:status` verifiziert; Snapshot `docs/agent-memory/memory_v5.179_2026-05-22.md` haelt den Stand fest. Naechster Nutzwert liegt nicht in weiterem Clarification-Mikroausbau, sondern in einer bewussten Entscheidung fuer den naechsten kleinsten Produktwertblock ausserhalb des abgeschlossenen Plan-4-Strangs. Keine Produktlogik, API, Persistenz/Migration, automatische Spec-Korrektur, Fachableitung, LLM-/Tool-Use-, Rezept-/Allergenlogik, Deployment, SSH, Secrets, Login/OIDC oder echte Datenverarbeitung.
- Leitlinien bleiben bindend:

  - keine neue Persistenzwelt / kein Prisma ohne bewussten Grossschnitt
  - kleine echte Bausteine
  - bestehende Approval-Request-Mechanik bleibt fuehrende Freigabewahrheit
  - Governance additiv, nicht als zweiter Kern
  - keine Vermischung von Stufen
  - keine Out-of-Scope-Themen still mitziehen

- P9-N2 Rehearsal-Gate-Bindung ist docs-/script-contract-only geschaerft: P9-N1, C8 und TESTING stellen klar, dass `npm run local:status`, `npm run local:check` oder UI-/Smoke-Anker isoliert kein Rehearsal-Go sind; ein Go ist nur bei widerspruchsfreier Kette aus Status, Check, manuellen UI-Routen, Evidence-Paket und Reibungslog zulaessig.
- `scripts/check-local-ops.sh` gibt nach erfolgreichem lokalen Check eine explizite Rehearsal-Grenze aus; `entfernter Doku-Contract-Test` schuetzt diese Anker und Grenzen. Keine neue Runtime-Service-Welt, keine API, Persistenz, Deployment, echten Daten, Produktionsfreigabe oder rechtssichere Audit-/Compliance-Aussage.
- P9-N3 Rehearsal-Reibung-zu-Entscheidung ist Doku-/Vertragstest-only geschaerft: P7-B67, P6-B61, P6-B58 und TESTING verdichten Reibung nach lokalem synthetischem Rehearsal auf die vier kopierbaren Ergebnisanker `go`, `fix`, `blocked` und `decision needed`; `entfernter Doku-Contract-Test` schuetzt die Trennung zwischen kleinem Fix, Stop-Gate und bewusster Alexander-Entscheidung. Keine Produktentscheidung, kein neuer Workflow, keine automatische Ticket-/Backlog-/QA-Plattform, keine API/Persistenz/Deployment/echten Daten.
- P9-N4 UI-Lesbarkeit ist als kleiner Copy-/Smoke-Fix umgesetzt: Die Startseite benennt jetzt direkt, dass ein Rehearsal-Go erst nach gruenem Status, lokalem Check, manueller UI-Evidenz und Reibungslog gilt; `tests/backoffice-route-smoke.test.ts` schuetzt den Marker. Keine neue Produktflaeche, kein UI-Neubau, keine API/Persistenz, keine echten Daten und keine Produktionsfreigabe.
- P9-N5 Abschlussgate / Memory Snapshot / Management-Lage ist als No-Product-Change abgeschlossen: Plan 9 wurde ueber fokussierte P9-Vertragstests/Smokes, `npm test`, `npm run build`, `npm audit --omit=dev`, `git diff --check`, `npm run local:status` und `npm run local:check` verifiziert; CI konnte lokal nicht geprueft werden, weil `gh` nicht authentifiziert ist. Snapshot `docs/agent-memory/memory_v5.207_2026-05-23.md` haelt den Stand fest. Der lokale synthetische Rehearsal-Nachweis ist klarer an Start-/Status-/Check-Signale, manuelle UI-Evidenz, Export-/Auditbelege und Reibungslog gebunden; echte Daten, produktionsnahe Nutzung, Deployment, Auth/OIDC, PII/Retention/Backup, Sandbox/Worker/AV, neue Persistenz/API, automatische Spec-Korrektur, strukturierte Schedule-Loesung und Rezept-/Allergenautomatik bleiben blockiert.
- P10-N5 Abschlussgate / Evidence-Paket / Management-Lage ist als No-Product-Change abgeschlossen: Plan 10 wurde als realer synthetischer Beta-Rehearsal-Durchlauf entlang `Start -> Angebot -> Produktion -> Rueckfragen -> Exporte/Audit` ueber `npm run local:status`, `npm run local:check`, manuelle Browser-/DOM-Evidenz der drei UI-Routen, read-only Export-/Auditbelege, `npm test`, `npm run build`, `npm audit --omit=dev` und `git diff --check` verifiziert. Kein Produktfix wurde umgesetzt, weil keine neue enge scope-sichere Reibung beobachtet wurde; einziger Entscheidungsanker bleibt die bekannte strukturierte Zeitfenster-/Schedule-Loesung jenseits von Option A. Snapshot `docs/agent-memory/memory_v5.208_2026-05-23.md` haelt den Abschlussstand fest; echte Daten, produktionsnahe Nutzung, Deployment, Auth/OIDC, PII/Retention/Backup, Sandbox/Worker/AV, neue Persistenz/API, automatische Spec-Korrektur und Rezept-/Allergenautomatik bleiben blockiert.
- P11-N3 Interner Nutzerkreis und Zugriffskontext ist Doku-/Vertragstest-only umgesetzt: `docs/product/P11_N3_INTERNER_PILOT_PREFLIGHT_RUNBOOK.md` macht Nutzerkreis, fachlichen/technischen Betreiber, Trusted-Actor-Kontext und Zugriffskontrollfragen als nicht-sensitive Entscheidungspunkte sichtbar; `entfernter Doku-Contract-Test` schuetzt die Grenzen aus B24, PA7/PA8/PA9 und B8/B9. Lokales Rehearsal-Go bleibt kein Pilot-/Auth-/Deployment-Go; Auth/OIDC/Login/Session, Proxy/IAP-Code, Deployment, Secrets, neue Rollenplattform, API/Persistenz, echte Daten und Compliance-Freigabe bleiben blockiert.
- P11-N5 Abschlussgate / Memory Snapshot / 10/10-Lage ist als No-Product-Change abgeschlossen: Plan 11 wurde ueber den fokussierten P11-/UI-Korridor, `npm test`, `npm run build`, `npm audit --omit=dev`, `git diff --check`, `npm run local:status` und `npm run local:check` verifiziert; Snapshot `docs/agent-memory/memory_v5.212_2026-05-24.md` haelt den Plan-11-Abschlussstand fest. Der lokale Pilot-Preflight fuer Demo-/synthetische oder nachweisbar anonymisierte Daten ist besser pruefbar; ein echter begrenzter interner Pilot bleibt ohne Management-Go zu Nutzerkreis, Betreiber-/Zugriffskontext, Datenrahmen und Nachweisen `not assessed`, produktionsnahe Nutzung mit echten Daten bleibt `blocked`.
- P11-N6 Plan-12-Ableitung ist Doku-/Vertragstest-only vorbereitet: `docs/plans/hans-night-build-plan-12-internal-pilot-go-no-go-decision-2026-05-24.md` macht das naechste echte Bottleneck als nicht-sensitives Management-Go/No-Go-Entscheidungspaket sichtbar; `entfernter Doku-Contract-Test` schuetzt, dass Plan 12 startbereit bleibt, aber keinen Pilot startet und keine Deployment-/Auth-/API-/Persistenz-/Daten-/Schedule-Gates ueberschreitet.
- P12-N2 Management-Go/No-Go-Entscheidungspaket ist Doku-/Vertragstest-only umgesetzt: `docs/product/P12_N2_MANAGEMENT_GO_NO_GO_ENTSCHEIDUNGSPAKET.md` verdichtet P11-N1/N2/N3, B24, PA7/PA8/PA9, B8/B9, P6/P7/P9/C8 und R4 in nicht-sensitive Entscheidungsfelder fuer Nutzerkreis, fachlichen/technischen Betreiber, Zugriffskontext, Datenrahmen, Anonymisierungs-/Synthetiknachweis, Nachweis, Stop-Verantwortung und finale Bewertung; `entfernter Doku-Contract-Test` schuetzt Default `not assessed` fuer echten begrenzten Pilot und `blocked` fuer echte/produktive Daten. Kein Pilotstart, Deployment, Auth, echte Daten, neue API/Persistenz, produktive Config oder Rechts-/Compliance-Freigabe.

## Aktueller Gesamtstand
- Der Governance-Pfad ist bis einschliesslich **Stufe 6c** umgesetzt und fachlich gruen / abnahmefaehig.
- Die Umsetzung baut sauber sequenziell aufeinander auf.
- Der Produktkern bleibt fuehrend; es wurde kein Prisma eingefuehrt.
- Die aktuelle Phase ist ausdruecklich eine **Konsolidierungsphase** und nicht ein neuer Fachblock.
- In dieser Phase gilt: keine neue Fachlogik, keine Vorgriffe auf spaetere Stufen, keine stillen Erweiterungen.
- Stufe 6c ist der bereits umgesetzte read-only UX-/Transparenzschritt im bestehenden Governance-Kontext.

## Governance-Stand im Detail

### Stufe 3a - ApprovalTrigger & Governance-State
- Status: fachlich gruen / abnahmefaehig
- Minimaler `ApprovalTrigger` vorhanden
- Minimaler `SpecGovernanceStateRecord` vorhanden
- `pending_reapproval` wird fuer relevante Faelle gesetzt
- Bestehende `ApprovalRequestRecord`-Mechanik bleibt fuehrende Wahrheit
- Keine UI-Ausweitung, keine Snapshots, keine neue Persistenzwelt

### Stufe 3b - ChangeSet & Finalize (minimal)
- Status: fachlich gruen / abnahmefaehig
- Minimales `SpecChangeSetRecord` vorhanden
- Genau ein offenes ChangeSet pro Spec
- `finalizeChangeSet(...)` als kleine Backend-Funktion vorhanden
- Finalisierung ist ausdruecklich **nicht** gleich Freigabe
- Keine ChangeItem-Persistenz, keine Snapshots

### Stufe 3c - erste ChangeSet-Sichtbarkeit (read-first)
- Status: fachlich gruen / abnahmefaehig
- Read-only Sichtbarkeit des Governance-Status und des sichtbaren ChangeSets im bestehenden UI-Kontext
- Sichtbares ChangeSet = offenes ChangeSet oder zuletzt finalisiertes ChangeSet
- Keine neue Schreiblogik

### Stufe 4a - minimale Finalize-Aktion im UI-Pfad
- Status: fachlich gruen / abnahmefaehig
- Kleiner Finalize-Endpunkt vorhanden:
  - `POST /v1/intake/spec-governance/finalize`
- Im bestehenden Governance-Callout gibt es eine kleine Finalize-Aktion
- Nach erfolgreicher Finalisierung wird der bestehende Read-Pfad neu geladen
- Keine neue Freigabelogik, kein Hard-Approve

### Stufe 4b - Bedienhaertung des Finalize-Pfads
- Status: fachlich gruen / abnahmefaehig
- Button-Text sprachlich geschaerft:
  - `Aenderungen finalisieren`
- Offene `L3`-ChangeSets verlangen vor Finalisierung eine kleine UI-Bestaetigung
- Bekannte Fehlerfaelle werden im UI verstaendlicher gemappt
- Keine neue Persistenz, keine neue Approval-Logik

### Stufe 5a - serverseitige Guard-Logik fuer Finalize
- Status: fachlich gruen / abnahmefaehig
- Finalize-Endpunkt verlangt fuer offene `L3`-ChangeSets serverseitig ein explizites Confirm-Flag:
  - `confirmCriticalFinalize?: boolean`
- Ohne Confirm-Flag wird ein offenes `L3`-ChangeSet nicht finalisiert
- Mit Confirm-Flag bleibt Finalisierung moeglich
- `L1/L2` bleiben ohne Zusatzflag direkt finalisierbar

### Stufe 5b - sichtbare L3-Hinweishaertung im Governance-Callout
- Status: fachlich gruen / abnahmefaehig
- Offene `L3`-ChangeSets sind im bestehenden Governance-Callout sichtbar als kritisch markiert
- Sichtbare Begriffe:
  - `Kritische Aenderung`
  - kurze Hinweiszeile zur bewussten Pruefung und Finalisierung
- Keine neue API- oder Persistenzlogik

### Stufe 6a - serverseitige echte Kritikalitaetsquelle fuer ChangeSets
- Status: fachlich gruen / abnahmefaehig
- `highestImpactLevel` und `activeRuleKeys` stammen serverseitig aus echter Klassifikation realer Spec-Aenderungen
- `summary` wird ebenfalls aus derselben serverseitigen Klassifikationsquelle abgeleitet
- Finalize und Guard nutzen weiterhin die gespeicherten ChangeSet-Daten

### Stufe 6b - fachlich lesbarere Kurzsprache fuer Governance-Regeln
- Status: fachlich gruen / abnahmefaehig
- `activeRuleKeys` bleiben technisch unveraendert
- Im bestehenden Governance-Callout werden Rule Keys in lesbarere Kurzsprache uebersetzt
- Beispiele:
  - `guest_count` -> `Mengen`
  - `event_timing` -> `Zeitfenster`
  - `allergens` -> `Allergene`
  - `recipe_swap` -> `Gerichte/Rezeptur`
  - `notes` -> `Hinweise/Texte`
  - `yield` -> `Ausbeute`
  - `procurement_units_equivalent` -> `Gebinde`
  - `unit_conversion_with_qty_effect` -> `Mengenumrechnung`
- `summary` bleibt unveraendert

### Stufe 6c - read-only Transparenz im bestehenden Governance-Callout
- Status: fachlich gruen / abnahmefaehig
- Kleine sichtbare Einordnung der vorhandenen Zustaende `open`, `finalized`, `approved` und `pending_reapproval`
- Sichtbare Begriffe:
  - `Offene Änderung`
  - `Finalisierte Änderung`
  - `Freigegeben`
  - `Erneute Freigabe erforderlich`
- Klarstellung im UI:
  - `Finalisiert ist nicht gleich freigegeben.`
- Keine neue Fachlogik, keine neue Freigabelogik, keine neue Persistenz, keine neuen API-Endpunkte

## Konsolidierungsstand
- Der aktuelle Governance-Pfad ist bis einschliesslich Stufe 6c korrekt umgesetzt und fachlich gruen beziehungsweise abnahmefaehig.
- Die Umsetzung bleibt additiv zum bestehenden Produktkern und fuehrt keine neue Persistenzwelt oder Prisma ein.
- `ApprovalRequestRecord` bleibt die einzige Freigabewahrheit.
- `SpecGovernanceStateRecord` bildet die Statusspur, `SpecChangeSetRecord` bleibt die Aenderungseinheit.
- Der Finalize-Pfad ist vorhanden und gehaertet, aber Finalize ist ausdruecklich nicht mit Freigabe gleichzusetzen.
- Im sichtbaren Produktkontext ist das Wording auf den konsolidierten Stand gebracht.
- Die aktuelle Phase ist ausdruecklich eine Konsolidierungsphase ohne neue Fachlogik.

## Verbindlicher Mini-Referenzblock - Was aktuell gilt
- Der Governance-Stand ist bis Stufe 6c abgeschlossen und fachlich gruen / abnahmefaehig.
- `ApprovalRequestRecord` bleibt die fuehrende und einzige Freigabewahrheit.
- `SpecGovernanceStateRecord` bleibt die Statusspur.
- `SpecChangeSetRecord` bleibt die Aenderungseinheit.
- Finalize ist nicht gleich Freigabe.
- Der Produktkern bleibt fuehrend, deterministisch, pruefbar und auditierbar.
- Governance bleibt additiv und wird nicht als zweiter Kern aufgebaut.
- Im sichtbaren Produkt-Wording gilt aktuell:
  - `Freigabe- und Aenderungsspur`
  - `Aenderungsspur`
  - `Aenderungen finalisieren`
  - `Kritische Aenderung`
  - `approved`
  - `pending_reapproval`
  - `open`
  - `finalized`

## Was ausdruecklich weiter out of scope bleibt
- Snapshots / `lastHardApproved`
- Hard-Approve-Logik
- Point-of-no-return-Mechanik ueber den kleinen Finalize-Guard hinaus
- ChangeItem-Anzeige oder ChangeItem-Persistenz
- weitere Governance-Workflows
- Aktivierung zusaetzlicher `prepared`-Regeln ohne direkte reale Feldanbindung
- groessere Export-/UI-Ausweitung
- neue Persistenzsysteme oder Prisma

## Memory-Strang-Hinweis
- Die kanonische Architektur- und Objektdefinition fuer `SpecRecord` und `OpenIssueRecord` liegt in `docs/architecture/MEMORY_ARCHITECTURE.md`.
- `memory.md` bleibt kompakter Status-, Verweis- und Handoff-Anker.

## Aktueller umgesetzter Bauplan-Schritt - Stufe 6c
- Status: umgesetzt / fachlich gruen / abnahmefaehig
- Typ: kleiner UX-/Transparenzschritt im bestehenden Governance-Callout
- Ziel: bereits vorhandene Zustaende fachlich klarer sichtbar machen, ohne neue Fachlogik
- Sichtbar einzuordnen:
  - `open`
  - `finalized`
  - `approved`
  - `pending_reapproval`
- Explizite Klarstellung im UI:
  - `finalized` ist nicht gleich `approved`
- Nutzung ausschliesslich bestehender Daten und bestehender UI-Kontexte
- Keine neue Freigabelogik, keine neue Persistenz, keine neuen API-Endpunkte

### Stufe 6c - ausformulierter Bauplanrahmen
1. Fachliche Einordnung
- Stufe 6c setzt auf dem fachlich gruenen Stand 3a bis 6b auf.
- Sie bleibt bewusst unterhalb eines neuen Fachblocks und fuehrt keine neue Governance-Mechanik ein.
- Ziel ist ausschliesslich, die bereits vorhandenen Zustaende im bestehenden Governance-Callout lesbarer und fachlich sauberer einzuordnen.
- Der Kernsatz bleibt unveraendert: Finalize ist nicht gleich Freigabe.
- `ApprovalRequestRecord` bleibt die fuehrende Freigabewahrheit; `SpecGovernanceStateRecord` bleibt die Statusspur; `SpecChangeSetRecord` bleibt die Aenderungseinheit.

2. Im UI sichtbar werden soll
- Eine kleine read-only Status-Einordnung im bestehenden Governance-Callout.
- Sichtbar benannt werden die bestehenden Zustaende `open`, `finalized`, `approved` und `pending_reapproval`.
- `finalized` erhaelt eine klare sichtbare Einordnung als Abschluss eines ChangeSet-Schritts, nicht als Freigabe.
- `approved` bleibt sprachlich erkennbar der Freigabezustand.
- `pending_reapproval` bleibt erkennbar als Zustand erneuter Freigabeerforderlichkeit.
- `open` bleibt erkennbar als noch offener Aenderungszustand.

3. Unveraenderte Fachlogik
- Keine neue Freigabelogik.
- Kein Hard-Approve.
- Kein Snapshot und kein `lastHardApproved`.
- Kein Point-of-no-return-Ausbau.
- Keine ChangeItem-Persistenz und keine ChangeItem-Anzeige.
- Keine zusaetzlichen Governance-Workflows.
- Keine neuen API-Endpunkte und keine neue Persistenz.

4. Kompakter Umsetzungsrahmen
- Backend: nur Nutzung bereits vorhandener, lesbarer Zustaende; keine neue Fach- oder Persistenzlogik.
- UI: sprachliche und visuelle Praezisierung ausschliesslich im bestehenden Governance-Callout.
- Test: kleine Absicherung, dass die vorhandenen Status korrekt lesbar eingeordnet werden und dass `finalized` sichtbar nicht als `approved` erscheint.

## Arbeitsmodus fuer neue Chats / Agenten
- Immer zuerst `memory.md`, `AGENTS.md`, `HANDOFF_PROMPT.md` und `README.md` lesen.
- Den Repo-Iststand pruefen, bevor neue Annahmen getroffen werden.
- Zwischen umgesetzt, beschrieben, offen und bewusst out of scope sauber trennen.
- Keine neuen Features ohne expliziten Auftrag.
- Keine grossen Refactorings ohne klaren Phasenbezug.
- `memory.md` bei jeder relevanten Neuerung versioniert fortschreiben.
- Neue Eintraege unten in der Versionshistorie anhaengen, bestehende Inhalte nicht still ueberschreiben.

## Neuer paralleler Architekturstrang

### Owned Memory & Harness Foundation

Zusätzlich zum laufenden Produkt- und Flow-Ausbau wird ein eigener Architekturstrang fuer modellagnostische Memory- und Harness-Grundlagen eingefuehrt.

Ziel ist, Wissen, Kontext und wiederverwendbare Arbeitslogik in eigener Kontrolle zu halten, statt sie primaer an externe Modellanbieter, proprietaere Harnesses oder API-seitigen State zu binden.

Dieser Strang baut nichts Bestehendes zurueck, sondern ergaenzt den bisherigen Produktpfad strategisch.

### Phase M1 - Architekturdefinition

Phase M1 ist bewusst noch keine Implementierungsphase, sondern eine saubere Architekturdefinition.

Festgelegt werden:
- die Trennung von Session Context, Operational Memory und Long-Term Memory
- die fuehrenden Memory-Objekte
- die Trennung zwischen deterministischer Speicherung und verdichteten Ableitungen
- Ownership und Portabilitaet der Wissensbasis
- ein erster Resolver-Rahmen fuer gezieltes Kontextladen
- ein erster Skill-Rahmen fuer offene, versionierbare Prozesskapseln

### Abschlussstand M1 - Owned Memory Foundation

Der aktuelle M1-Stand gilt als vorerst konsolidiert und stabil.

#### Real verankerte interne Owned-Memory-Anker

##### SpecRecord
- als erster interner Owned-Memory-Anker im bestehenden Intake-/Spec-Kontext verankert
- mit kleinem deterministischem Adapter
- mit internem Guard
- mit kleinem internem Nutzwert
- ohne API-, Persistenz- oder UI-Ausweitung

##### OpenIssueRecord
- als zweiter interner Owned-Memory-Anker im bestehenden Intake-/Spec-Kontext verankert
- mit kleinem internem Adapter
- mit zwei realen internen Nutzungsorten
- Signal-, Audit- und Mapping-Konsistenz zwischen den bestehenden Pfaden hergestellt
- ohne Produktfläche nach außen

##### ProductionPlanRecord
- als dritter interner Owned-Memory-Anker im aktuellen Python-/Agent-Repo verankert
- mit deterministischem Ableitungs-Helper
- mit internem Call-Site-Punkt am Laufabschluss
- mit kleiner Testabsicherung inklusive Fallback
- mit lokaler interner TypedDict-Definition
- weiterhin rein intern und ohne Außenwirkung

#### Architektonische Einordnung

Damit ist M1 nicht mehr nur Architekturdefinition, sondern ein realer interner Produktunterbau:
- modellagnostisch
- intern kontrolliert
- nicht providergeführt
- ohne neue Produktfläche
- ohne neue Persistenzwelt
- ohne neue öffentliche API

#### Was bewusst noch nicht Teil von M1 ist
- keine produktöffentliche Memory-Oberfläche
- keine neue API für Memory-Records
- keine Persistenzmigration
- keine UI-Erweiterung
- kein vollständiges Issue-System
- kein vollständiges Produktionssystem
- keine Workflow-Automation über diese Records
- keine Provider-Abhängigkeit als Primärquelle

#### Statusbewertung

M1 kann im aktuellen Ausbaustand als vorerst erfolgreich stabilisiert und abgeschlossen gelten.

Weitere Ausbauschritte sollten erst wieder erfolgen, wenn ein neuer realer Produktmoment einen zusätzlichen Owned-Memory-Anker oder eine klar begrenzte interne Vertiefung tatsächlich trägt.

### Leitlinien

- Session Context bleibt fluechtig und zustandsbezogen.
- Operational Memory bleibt eng an konkrete Produktobjekte und Vorgaenge gebunden.
- Long-Term Memory wird als verdichtete, wiederverwendbare Wissensschicht mit Quellenbezug gedacht.
- Die eigentliche Wahrheit liegt in eigenen deterministischen Datenstrukturen, nicht im Provider.
- Skills sollen als offene Prozesskapseln funktionieren, nicht als modellinterne Spezialtricks.
- Resolver sollen Kontext gezielt laden, nicht Fachlogik ersetzen.
- SkillDefinition und ResolverDefinition werden konzeptionell bereits als offene, versionierbare Artefakte gedacht.

### Scope-Grenzen fuer Phase M1

- keine neue API
- keine neue Persistenzmigration
- kein neuer Screen
- keine Plattform-Ausweitung
- keine Multi-Tenancy-Erweiterung
- keine grossen Refactorings
- keine Implementierung von Memory-Harness-Features ueber Definitionsniveau hinaus
- nur Architekturgrenzen, Objektklassen, Ownership und Prioritaeten definieren
- nur deterministische vs. verdichtete Speicherung sauber trennen
- nur Resolver-/Skill-Rahmen beschreiben, nicht ausbauen

## Versionshistorie
### 5.77 - 2026-04-16
- P23 Minimaler interner Beta-Abschluss- und Dokumentationsstand im MVP ist im Repo als neue Mini-Spezifikation dokumentiert und wurde in memory.md als relevanter neuer Stand ergänzt.
- Der Rahmen bleibt bewusst konservativ: der Beta-Abschnitt wird nur ueber konsistente Dokumente, PR und memory als dokumentarisch sauber abgeschlossen eingeordnet, ohne ein formales Abschluss-, QA- oder Governance-System einzuführen.

### 5.76 - 2026-04-16
- P22 Minimaler Restpunkt- und Nachziehrahmen vor Beta-Abschluss im MVP ist im Repo als neue Mini-Spezifikation dokumentiert und wurde in memory.md als relevanter neuer Stand ergänzt.
- Der Rahmen bleibt bewusst konservativ: kleine Restpunkte werden nur ueber technische, fachliche, betriebliche und dokumentarische Einordnung vor Beta-Abschluss behandelt, ohne ein formales Defect-, QA- oder Release-Management zu konstruieren.

### 5.75 - 2026-04-16
- P21 Minimaler Uebergang von Beta zu intern nutzbarem Produktstatus im MVP ist im Repo als neue Mini-Spezifikation dokumentiert und wurde in memory.md als relevanter neuer Stand ergänzt.
- Der Rahmen bleibt bewusst konservativ: ein Beta-Stand wird nur ueber technische, fachliche, betriebliche und dokumentarische Mindestsignale in einen intern nutzbaren Produktstatus eingeordnet, ohne ein formales Release-, Betriebs- oder Steuerungsmodell einzuführen.

### 5.74 - 2026-04-16
- P20 Minimaler interner Beta-Auswertungs- und Go/No-Go-Rahmen im MVP ist im Repo als neue Mini-Spezifikation dokumentiert und wurde in memory.md als relevanter neuer Stand ergänzt.
- Der Rahmen bleibt bewusst konservativ: ein erster Beta-Durchlauf wird nur ueber Beobachtung, knappe Zusammenfuehrung der Auffaelligkeiten und die Einordnung in tragfaehig, nachzuschaerfen oder vorerst zu stoppen eingeordnet, ohne ein formales QA-, Release- oder Steering-System einzuführen.

### 5.73 - 2026-04-16
- P19 Minimaler interner Beta-Durchfuehrungsrahmen im MVP ist im Repo als neue Mini-Spezifikation dokumentiert und wurde in memory.md als relevanter neuer Stand ergänzt.
- Der Rahmen bleibt bewusst konservativ: ein erster kontrollierter interner Beta-Durchlauf wird nur ueber Test-, Build-, Smoke-, Abnahme-, Lage- und Klaerungsrahmen eingeordnet, ohne ein Release-, Rollout- oder Support-System einzuführen.

### 5.72 - 2026-04-16
- P18 Minimaler interner Eskalations- und Klaerungspfad im MVP ist im Repo als neue Mini-Spezifikation dokumentiert und wurde in memory.md als relevanter neuer Stand ergänzt.
- Der Rahmen bleibt bewusst konservativ: sichtbare Klaerung und Eskalation werden nur ueber PR-, Doku- und memory-Kontexte eingeordnet, ohne ein Incident-, Ticket- oder Governance-System einzuführen.

### 5.71 - 2026-04-16
- P17 Minimaler interner Betriebsstatus- und Lageueberblick im MVP ist im Repo als neue Mini-Spezifikation dokumentiert und wurde in memory.md als relevanter neuer Stand ergänzt.
- Der Rahmen bleibt bewusst konservativ: Statussignale werden nur ueber Tests, Build, Smoke, Export, Audit/Review und manuelle Fallbacks eingeordnet, ohne eine neue Monitoring- oder Ops-Welt einzuführen.

### 5.70 - 2026-04-16
- P16 Minimaler interner Aenderungs- und Entscheidungslog im MVP ist im Repo als neue Mini-Spezifikation dokumentiert und wurde in memory.md als relevanter neuer Stand ergänzt.
- Der Rahmen bleibt bewusst konservativ: Entscheidungen werden nur knapp ueber PR-, Commit-, Doku- und memory-Kontexte eingeordnet, ohne ein neues Ticket-, ADR- oder Governance-System einzuführen.

### 5.69 - 2026-04-16
- P15 Minimaler interner Abnahmeprozess im MVP ist im Repo als neue Mini-Spezifikation dokumentiert und wurde in memory.md als relevanter neuer Stand ergänzt.
- Der Rahmen bleibt bewusst konservativ: die kleinste interne Abnahme wird nur ueber bestehende Test-, Build-, Rollen-, Export- und Audit-/Review-Kontexte begrenzt, ohne eine neue QA- oder Release-Welt einzuführen.

### 5.68 - 2026-04-16
- P14 Audit-/Review-Spuren und operative Nutzung im MVP sind im Repo als neue Mini-Spezifikation dokumentiert und wurden in memory.md als relevanter neuer Stand ergänzt.
- Der Rahmen bleibt bewusst konservativ: Audit-/Review-Spuren werden nur als interne Betriebs- und Kontrollnachweise eingeordnet, ohne eine neue Compliance-, Revisions- oder Monitoring-Welt einzuführen.

### 5.67 - 2026-04-16
- P13 Export-Verbindlichkeit und operative Nutzung im MVP sind im Repo als neue Mini-Spezifikation dokumentiert und wurden in memory.md als relevanter neuer Stand ergänzt.
- Der Rahmen bleibt bewusst konservativ: operative Exportartefakte werden nur als interne Arbeitsbelege eingeordnet, ohne eine neue Signatur-, Freigabe- oder Dokumentengenerierungswelt einzuführen.

### 5.66 - 2026-04-16
- P12 Demo-/Seed-Daten und zulässige Nutzung im MVP sind im Repo als neue Mini-Spezifikation dokumentiert und wurden in memory.md als relevanter neuer Stand ergänzt.
- Der Rahmen bleibt bewusst konservativ: Seed-/Demo-Nutzung wird nur als Betriebs- und Verifikationshilfe eingeordnet, ohne eine neue Testdaten-, Reset- oder Datenmanagement-Welt einzuführen.

### 5.65 - 2026-04-16
- P11 Datenkorrekturen und fachliche Nachpflege im MVP sind im Repo als neue Mini-Spezifikation dokumentiert und wurden in memory.md als relevanter neuer Stand ergänzt.
- Der Rahmen bleibt bewusst konservativ: Direktedit, Neuerzeugung und read-only-Nachpflege werden nur fachlich eingeordnet, ohne eine neue Diff-, Governance- oder Bearbeitungswelt einzuführen.

### 5.64 - 2026-04-16
- P10 manuelle Betriebsinterventionen und Fallbacks im MVP sind im Repo als neue Mini-Spezifikation dokumentiert und wurden in memory.md als relevanter neuer Stand ergänzt.
- Der Rahmen bleibt bewusst konservativ: manuelle Betriebswege, Fallbacks und Grenzen werden nur eingeordnet, ohne eine neue Incident-, Recovery- oder Admin-Welt einzuführen.

### 5.63 - 2026-04-16
- P9 formaler AuthN-/AuthZ-Rahmen im MVP ist im Repo als neue Mini-Spezifikation dokumentiert und wurde in memory.md als relevanter neuer Stand ergänzt.
- Der Rahmen bleibt bewusst konservativ: Rollen-/Guard-Grundlage, Actor-Zuordnung und Proxy-Rahmen werden nur fachlich eingeordnet, ohne Login-, Session- oder IdP-Welt einzufuehren.

### 5.62 - 2026-04-16
- P8 UI-Rollenverantwortung und Operator-Zuordnung ist im Repo als neue Mini-Spezifikation dokumentiert und wurde in memory.md als relevanter neuer Stand ergänzt.
- Die Backoffice-UI wurde dabei nur fachlich den bereits vorhandenen Minimalrollen und Operatornamen zugeordnet; keine neue Rollenwelt wurde eingeführt.

### 5.61 - 2026-04-16
- P2 Browser-/Smoke-Absicherung ist im Repo jetzt auch dokumentarisch aktualisiert: der lokale Smoke-Korridor umfasst die drei UI-Routen, die vier Health-Endpunkte und drei read-only Exportpfade; zusätzlich existiert der repo-verankerte UI-Route-Smoke-Test mit route-eindeutigen Assertions fuer `/angebot` und `/produktion`.
- Die Mini-Spezifikation `docs/product/P2_BROWSER_SMOKE_MINISPEZ.md` wurde auf den realen P2-Stand nachgezogen.

### 5.50 - 2026-04-16
- P2 Stufe 1 nun auch inhaltlich nachgezogen: die drei UI-Kernrouten und die vier Health-Endpunkte wurden erfolgreich mit HTTP 200 verifiziert.
- Gerenderte UI-Marker fuer Startseite, Angebotsagent und Produktionsagent im Browser-Tool bestaetigt.
- Dokumentiert, dass fuer diese Smoke-Stufe keine grosse Browser-/E2E-Infrastruktur notwendig war.

### 5.49 - 2026-04-16
- P2 als kleinster Browser-/Smoke-Korridor fuer die Kernpfade vorbereitet.
- Verankert, dass die erste Smoke-Stufe auf Backoffice-UI-Routen (`/`, `/angebot`, `/produktion`) plus lokale Health-Endpunkte aufbaut.
- Festgehalten, dass keine grosse Browser-E2E-Infrastruktur vorhanden ist und der erste Check bewusst klein bleiben soll.

### 5.48 - 2026-04-16
- P1 als erste MVP-Stufe real verankert und gezielt verifiziert dokumentiert.
- Minimale zentrale Access-Control-Konvention plus geschuetzte Pfade fuer Production-Audit, Production-Seed, Intake-Finalize und beide Recipe-Review-Wege festgehalten.
- P5 als naechster Spezifikationsanker fuer die MVP-Abgrenzung pro Kernbereich vermerkt.
- Root-Memory auf den konsolidierten P1- und P5-Stand nachgezogen.

### 5.47 - 2026-04-11
- M1 Owned Memory Foundation als vorerst konsolidiert und stabil abgeschlossen.
- SpecRecord als erster interner Owned-Memory-Anker im Intake-/Spec-Kontext real verankert.
- OpenIssueRecord als zweiter interner Owned-Memory-Anker mit zwei internen Nutzungsorten sowie Signal-, Audit- und Mapping-Konsistenz real verankert.
- ProductionPlanRecord als dritter interner Owned-Memory-Anker im Python-/Agent-Repo mit deterministischem Helper, interner Call-Site, kleiner Testabsicherung und lokaler TypedDict-Definition real verankert.
- Bestaetigt, dass alle drei Records weiterhin rein intern, modellagnostisch und ohne neue API-, Persistenz- oder UI-Fläche geführt werden.

### 5.32 - 2026-04-11
- Neuer paralleler Architekturstrang Owned Memory & Harness Foundation aufgenommen.
- Phase M1 als Architekturdefinition fuer modellagnostische Memory- und Harness-Grundlagen festgelegt.
- Trennung von Session Context, Operational Memory und Long-Term Memory sowie Ownership-, Resolver- und Skill-Leitlinien dokumentiert.
- Verweis auf die kanonische Architekturdatei docs/architecture/MEMORY_ARCHITECTURE.md.

### 5.23 - 2026-04-11
- Root-Memory-Datei wieder als fuehrende Kurzreferenz festgelegt.
- Governance-/Konsolidierungsstand bis einschliesslich Stufe 6c aktualisiert.
- Stufe 6c als umgesetzter read-only UX-/Transparenzschritt dokumentiert.
- Arbeitsregeln, Leitplanken und Handoff-Referenzen auf den konsolidierten Stand gebracht.

### 5.78 - 2026-04-19
- P24 Minimaler Uebergabestand von Beta zu laufender interner Nutzung im MVP bleibt als inhaltlicher Referenzpunkt der Dokumentationslinie fuer den Uebergang von Beta zu laufender interner Nutzung erhalten.
- Der Rahmen bleibt bewusst konservativ: ein dokumentarisch abgeschlossener Beta-Stand wird nur als Uebergang zu laufender interner Nutzung eingeordnet, ohne ein formales Betriebs-, Support- oder Release-Modell einzuführen.

### 5.79 - 2026-04-19
- P25 Minimaler interner Nutzungsrahmen nach Beta-Uebergabe im MVP ist im Repo als neue Mini-Spezifikation dokumentiert und wurde in memory.md als relevanter neuer Stand ergänzt.
- Der Rahmen bleibt bewusst konservativ: die laufende interne Nutzung nach Beta-Uebergabe wird nur als knapper Nutzungsrahmen eingeordnet, ohne ein formales Betriebs-, Support- oder Governance-Modell einzuführen.

### 5.80 - 2026-04-19
- P26 Minimaler interner Stabilisierungsrahmen in laufender Nutzung im MVP ist im Repo als neue Mini-Spezifikation dokumentiert und wurde in memory.md als relevanter neuer Stand ergänzt.
- Der Rahmen bleibt bewusst konservativ: die laufende interne Nutzung wird nur ueber ruhige technische, fachliche und betriebliche Signale stabilisiert eingeordnet, ohne ein formales Betriebs-, Monitoring- oder Support-Modell einzuführen.

### 5.81 - 2026-04-19
- P27 Minimaler interner Reaktionsrahmen bei Instabilitaet in laufender Nutzung im MVP ist im Repo als neue Mini-Spezifikation dokumentiert und wurde in memory.md als relevanter neuer Stand ergänzt.
- Der Rahmen bleibt bewusst konservativ: erste Instabilitaetssignale werden nur knapp eingeordnet und begrenzen vorsichtige Weiternutzung, Klaerung oder Aussetzen, ohne ein formales Incident-, Support- oder Betriebsreaktionsmodell einzuführen.

### 5.82 - 2026-04-19
- P29 Minimaler interner Entscheidungsrahmen zur Ausbaupriorisierung nach Bereinigung im MVP ist im Repo als neue Mini-Spezifikation dokumentiert und wurde in memory.md als relevanter neuer Stand ergänzt.
- Der Rahmen bleibt bewusst konservativ: weitere kleine Ausbauschritte werden nur knapp gegen Stabilisierung, Nachziehbedarf und Dokumentationskonsistenz abgegrenzt, ohne ein formales Produktmanagement-, Portfolio- oder Governance-Modell einzuführen.

### 5.83 - 2026-04-19
- P31 Minimaler interner Entscheidungsrahmen zur Zurueckstellung von Funktionsausbau zugunsten von Stabilisierung im MVP ist im Repo als neue Mini-Spezifikation dokumentiert und wurde in memory.md als relevanter neuer Stand ergänzt.
- Der Rahmen bleibt bewusst konservativ: geplanter Ausbau wird bei offenen Stabilitaets-, Nachzieh- oder Konsistenzpunkten zugunsten von Stabilisierung zurueckgestellt, ohne ein formales Produktmanagement-, Portfolio- oder Governance-Modell einzuführen.

### 5.85 - 2026-04-19
- P34 Minimaler interner Entscheidungsrahmen fuer ausreichend hergestellte dokumentarische Konsistenz zum wieder kleinen Ausbau im MVP ist im Repo als neue Mini-Spezifikation dokumentiert und wurde in memory.md als relevanter neuer Stand ergänzt.
- Der Rahmen bleibt bewusst konservativ: kleiner Ausbau wird erst wieder vertretbar, wenn Referenzen, Repo-Bezüge und memory-Fortschreibung wieder konsistent genug sind, ohne ein formales Governance-, QA- oder Freigabemodell einzuführen.

### 5.86 - 2026-05-19
- Telegram als zusaetzlicher Bedien- und Rueckkanal wurde im Pflichtenheft als spaeterer fachlicher Ausbauanker dokumentiert.
- Der Rahmen bleibt bewusst konservativ: Telegram ist als Zielbild fuer Angebotsuebergabe, klaerende Rueckfragen und Versand von Rezepten, Produktionshinweisen sowie Einkaufslisten an die Produktion festgehalten, aber noch keine Implementierung, kein neuer Bot und keine Scope-Ausweitung im aktuellen Konsolidierungsblock.

### 5.87 - 2026-05-19
- README-Links auf `platform-infra/README.md` und `docs/deployment-and-versioning.md` wurden von lokalen absoluten iCloud-Pfaden auf repo-relative Pfade umgestellt.
- Der Schritt ist reine dokumentarische Projektklarheit und fuehrt keine neue Produktlogik, API, Persistenz oder Local-Ops-Erweiterung ein.

### 5.88 - 2026-05-19
- Die neue Produkt-/UI-Richtung wurde als Discovery- und Zielbildnotiz `docs/product/UI_CHATBOT_GOOGLE_DRIVE_ZIELBILD_DISCOVERY.md` dokumentiert.
- Der Rahmen bleibt bewusst konservativ: Apple-like Conversational Workbench und Google Drive sind als Zielbild und Entscheidungsbedarf festgehalten, aber ohne UI-Redesign, ohne neue API, ohne OAuth-/Google-Implementierung und ohne neue Secrets.

### 5.89 - 2026-05-19
- Alexanders Drive-Berechtigungslinie wurde in der Zielbildnotiz ergänzt: bestehende Drive-Dateien sind read-only Importquellen; Schreiben ist nur fuer app-eigene Outputs oder explizit freigegebene Zielartefakte/Zielordner vorgesehen.
- Offen bleibt die spaetere OAuth-/Scope-Strategie, insbesondere Picker/read-only fuer bestehende Dateien plus separater create/write-Scope fuer app-eigene Outputs oder ein anderes bewusst begruendetes Modell.

### 5.90 - 2026-05-19
- Die Ist-Flow-Karte `docs/product/UI_IST_FLOW_KARTE_CONVERSATIONAL_WORKBENCH.md` dokumentiert die vorhandenen UI-Flows `/`, `/angebot` und `/produktion` als naechsten kleinen Schritt in Richtung Apple-like Conversational Workbench.
- Der Schritt bleibt rein dokumentarisch: keine UI-/Google-/API-Implementierung, Drive-Beruehrung nur als spaetere read-only Import- bzw. explizit freigegebene Output-Linie eingeordnet.

### 5.91 - 2026-05-19
- Das read-only Workbench-Zonenmapping `docs/product/UI_WORKBENCH_ZONE_MAPPING_READONLY.md` dokumentiert die spaetere Apple-like Conversational Workbench als reine Zuordnung vorhandener Produktobjekte und Flows zu Quellen-/Eingabe-, Spec-, Klaer-, Ergebnis-, Export-/Drive- und Audit-/Herkunftszonen.
- Der Schritt bleibt rein dokumentarisch: keine UI-/API-/Google-/OAuth-Implementierung; strukturierte Ergebnisobjekte duerfen nicht in generischem Chattext verschwinden, und Drive bleibt auf read-only Importquellen bzw. explizit freigegebene app-eigene Outputs begrenzt.

### 5.92 - 2026-05-19
- Die Root-Memory wurde formal bereinigt: fehlerhafte Listenmarker im Projektkontext wurden ohne inhaltliche Scope-Aenderung korrigiert.
- Der Schritt bleibt reine Dokumentationskonsistenz: keine Produktlogik, keine UI-/API-/Persistenz-/Google-/Deployment-Aenderung.

### 5.93 - 2026-05-19
- Die Backoffice-API-Testspur wurde um eine kleine read-only Export-Link-Absicherung erweitert: Angebot, Produktionsplan und Einkaufsliste bleiben auf den bestehenden Exportservice-Pfaden verankert.
- Der Schritt ist reine Test-/Smoke-Konsolidierung und fuehrt keine neue Produktlogik, API, Persistenz oder Deployment-Aenderung ein.

### 5.94 - 2026-05-19
- Die P4-Audit-Traceability ist fuer den Intake-Finalize-Pfad runtime-seitig geschlossen: der bestehende TypeScript-Audit-Write wurde im gecheckten `.js`-Sibling nachgezogen und mit einem fokussierten Regressionstest belegt.
- Der Schritt bleibt eine kleine Konsistenz-/Traceability-Korrektur im bestehenden Finalize-/Audit-Pfad; keine neue API, Persistenzwelt oder Governance-Logik.

### 5.95 - 2026-05-20
- Die Root-Memory verdichtet nun auch die bereits vorhandenen Mini-Spezifikationen P5, P6 und P7 im oberen Projektkontext.
- Der Schritt bleibt reine Dokumentationskonsistenz: keine Produktlogik, keine UI-/API-/Persistenz-/Deployment-Aenderung.

### 5.96 - 2026-05-21
- Die Angebotsansicht `/angebot` hat eine read-only Angebots-Workbench-Projektion erhalten, die vorhandene Dashboard-Daten in Quellen-/Eingabe-, Verstandene-Daten-, Rueckfragen-, Ergebnisobjekt- und Export/Audit-Zonen zusammenzieht.
- Der Schritt ist der erste groessere, aber scope-sichere UI-Ausbau nach der Doku-Konsolidierung: keine neue API, keine neue Persistenz, keine OAuth-/Google-/Upload-/Chat-Erweiterung; abgesichert durch Backoffice-Praesentations-Smoke, `npm test` und `npm run build`.

### 5.97 - 2026-05-21
- `/angebot` wurde visuell und strukturell auf eine ruhige Conversational Workbench reduziert: keine sichtbare Card-Wand, keine prominenten Health-/Demo-/Zaehlerbloecke, eine dominante Anfrage-/Angebotsflaeche und progressive Detailzonen fuer Entwurf, weitere Eingaben sowie operative Uebergabe/Audit.
- Der Schritt ordnet nur bestehende Daten und UI-Aktionen neu; keine neue Fachlogik, keine API-, Persistenz-, OAuth-/Google- oder Deployment-Aenderung; abgesichert durch aktualisierte Backoffice-Smokes, `npm test`, `npm run build`, `npm run local:check` und einen lokalen Browser-Screenshot.

### 5.98 - 2026-05-21
- Fuer `/produktion` wurde der enge Strukturplan `docs/plans/production-workbench-structure.md` erstellt: empfohlen ist eine eigene `ProductionConversationalWorkbench` nach Angebotsmuster statt weiterer Mikro-Polishes oder generischem Grossrefactoring.
- Der Plan bleibt umsetzungsorientiert, aber ohne Code-Umsetzung: dominante Leitfrage, ruhige Kontextzeile und progressive Produktionsobjektzonen; keine neue Fachlogik, API, Persistenz, OAuth-/Google-/Chat-Erweiterung oder Deployment-Aenderung.

### 5.99 - 2026-05-21
- Alexanders Produktionsagent-Nordstern ist im bestehenden `/produktion`-Strukturplan ergaenzt: langfristig chatzentrierte weisse Flaeche mit Angebots-Upload, Rueckfragen, Rezept-/Mengen-/Einkaufslisten-Erzeugung, Downloads und spaeter Allergenlisten Deutsch/Englisch.
- Der erste echte UI-Slice richtet `/produktion` enger auf diesen Chat-first-Anker aus: sichtbarer `+ Angebot hinzufügen`-/Drag-&-Drop-Eingang, ehrlich formulierte bestehende Intake-/Spezifikationspfade, Rueckfrage-/Statuszonen und Downloadbereich-Anker; keine neue API, keine echte LLM-/PDF-/Internet-/Allergenautomatik und keine neue Persistenz.

### 5.100 - 2026-05-21
- Die bestehende Rueckfragezone in `/produktion` wurde chataehnlicher, aber weiterhin strukturiert gemacht: `productionQuestions` erscheinen als Agent-Fragen im Chatfluss, bestehende Antwortfelder bleiben direkt im vorhandenen Spezifikations-/Antwortpfad nutzbar.
- Der Schritt ist bewusst nur UI-/Smoke-Absicherung: keine neue Backend-, LLM-, Persistenz-, PDF-, Internet-, Rezeptgenerierungs- oder Allergenlogik; bestehende Produktionsobjekte, Einkaufsliste und Downloadanker bleiben unveraendert angebunden.

### 5.101 - 2026-05-21
- Die Antwortbearbeitung in `/produktion` ist enger an die Agent-Frage gerueckt: bestehende Antwortfelder erscheinen nun als Nutzerantwort im strukturierten Chatfluss direkt nach den Agent-Fragen, statt als abgesetzter Formularblock.
- Der Schritt bleibt reine UI-/Smoke-Absicherung ohne neue Backend-, LLM-, Persistenz-, PDF-, Internet-, Rezeptgenerierungs- oder Allergenlogik; Produktionsobjekte, Einkaufsliste, Downloadanker und Uploadanker bleiben auf den bestehenden Pfaden.

### 5.102 - 2026-05-21
- `/produktion` zeigt nach den strukturierten Antworten einen kleinen naechsten Agent-Schritt fuer Produktionsobjekte und Downloads: Produktionsplan, Rezepte/Objektuebersicht, Einkaufsliste und Downloads werden als pruefbare vorhandene bzw. entstehende Ergebniszone benannt.
- Der Schritt bleibt UI-/Smoke-Absicherung ohne neue Backend-, LLM-, Persistenz-, PDF-, Internet-, Rezeptgenerierungs- oder Allergenlogik; bestehende Produktionsplaene, Einkaufslisten und Exportlinks bleiben fuehrend.

### 5.103 - 2026-05-21
- Security-Hardening Block 1 ist umgesetzt: `npm audit --omit=dev` meldet nach minimalem Dependency-Fix keine Vulnerabilities mehr, und `print-export` escaped datengetriebene HTML-Textausgaben fuer Angebots- und Produktionsplan-Exports.
- Der Block ist mit fokussierten XSS-Regressionen fuer `<script>`, HTML-Tags, `onerror=` und Quotes abgesichert; CSV-Verhalten, Fachfeatures, Persistenz, PDF-/Upload-Logik und LLM-/Rezept-/Allergenlogik bleiben unveraendert.

### 5.104 - 2026-05-21
- Security-Hardening Block 2 ist umgesetzt: Intake-, Angebots- und Produktions-Dokumentuploads nutzen zentrale Datei-/Part-/Field-Grenzen, MIME-/Extension-Allowlist und streambasierte Groessenpruefung vor Textgewinnung/PDF-Parsing.
- Der Block ist mit fokussierten Upload-Security-Regressionen fuer zu grosse Intake-Dateien, unerlaubte Intake-/Offer-Dateien und weiterhin erlaubte Intake-/Production-Textuploads abgesichert; keine neue Parser-Engine, OCR, Persistenzwelt oder Fake-LLM-/Rezept-/Allergenlogik.

### 5.105 - 2026-05-21
- Security-Hardening Block 3 ist umgesetzt: Services koennen per `CATERING_TRUSTED_ACTOR_SECRET` oder Testoption `trustedActorSecret` erzwingen, dass Rollen nur aus `x-catering-actor-name` mit passendem `x-catering-trusted-secret` stammen.
- Frei setzbares `x-actor-name` bleibt nur fuer expliziten lokalen Dev-/Testbetrieb kompatibel; Spoofing- und Trusted-Kontext-Regressionen schuetzen mutierende Produktions-/Seed-Pfade und den read-only Audit-Feed, waehrend Export-/Detail-Read-Pfade bewusst als interne, nicht oeffentlich zu exponierende Datenpfade dokumentiert bleiben.

### 5.106 - 2026-05-21
- Das Produktionsagent-v1-Zielbild ist als Architektur-Gate in `docs/architecture/PRODUCTION_AGENT_V1_ARCHITECTURE_GATE.md` dokumentiert: ConversationSession, DocumentIngestion, LLM Orchestrator, RecipeGeneration, Allergen Engine DE/EN, Quantity/Purchase Aggregation, Export/Download, Audit/Provenance, Persistence/Migrations und Security/Permissions sind als Modulgrenzen und Gates beschrieben.
- Der Schritt bleibt reine Architektur-/ADR-Arbeit: kein Featurebau, keine LLM-/PDF-/Rezept-/Allergen-Implementierung, keine neue API, keine neue Persistenzwelt und kein Prisma; naechste Slices muessen erst als kleine ADR-/Sicherheits-/Provenance-Schritte entschieden werden.

### 5.107 - 2026-05-21
- PA1 Slice 1 ist als minimale `ProductionConversationProjection` umgesetzt: `shared-core` erzeugt aus vorhandener Spezifikation, Rueckfragen, strukturierter Antwortzusammenfassung, Produktionsplaenen und Einkaufslisten einen geordneten read-only Session-Verlauf mit Systemhinweis, Agent-Frage, Nutzerantwort und Output-/Downloadanker.
- `/produktion` verankert diese Projection sichtbar als `ConversationSession-Projektion`; der Schritt bleibt ohne neue API, ohne neue Datenbankmigration, ohne Conversation-Persistenz, ohne freie Chat-Eingabe und ohne LLM-/PDF-/Rezept-/Allergen-Fake-Magie; dokumentiert in `docs/architecture/PA1_CONVERSATION_PROJECTION_SLICE1.md`.

### 5.108 - 2026-05-21
- PA2 Source-/Provenance-Slice ist umgesetzt: `shared-core` erzeugt deterministische Upload-Metadaten mit Dateiname, normalisiertem MIME-Typ, Groesse, SHA-256, Ingestion-Zeitpunkt und Upload-Kontext.
- Bestehende Intake-Multipart-Uploads speichern diese Metadaten im vorhandenen `EventRequest.rawInputs[].sourceMetadata`; Offer- und Production-Rezeptuploads geben sie in `Recipe.source.sourceMetadata` weiter. Der Schritt bleibt ohne neue Persistenzwelt, Migration, neue UI, Parser-Engine, LLM-, Rezeptgenerierungs- oder Allergenlogik.

### 5.109 - 2026-05-21
- PA3 Provenance-Anker ist umgesetzt: `ProductionConversationProjection` erzeugt aus vorhandenen `sourceInputs[].sourceMetadata` einen read-only `source_provenance_anchor` mit Dateiname, MIME-Typ, Groesse, SHA-256-Kurzform, Upload-Kontext und Ingestion-Zeitpunkt.
- `/produktion` gibt die bereits geladene urspruengliche Intake-Anfrage an die Projection weiter und zeigt den Quellenanker im bestehenden strukturierten Chatfluss; dokumentiert in `docs/architecture/PA3_PROVENANCE_CONVERSATION_ANCHOR.md`. Keine neue API, Persistenzwelt, UI-Workflow-, Parser-, LLM-, Rezept- oder Allergenlogik.

### 5.110 - 2026-05-21
- PA4 Audit-/Traceability-Abgleich ist als read-only Minimal-Slice umgesetzt: `ProductionConversationProjection` haengt vorhandene sichere Quellenanker auch an den Produktionsoutput-/Downloadanker, die `/produktion`-Detailansicht zeigt Upload-Provenance bei der urspruenglichen Intake-Anfrage, und `print-export` kann vorhandene Quellenanker in Produktionsplan-HTML-Exports darstellen.
- Der Slice behauptet keine rechtssichere Audit-Verbindlichkeit und fuehrt keine neue API, Migration, Persistenzwelt, LLM-/Tool-Use-/PDF-Parser-/OCR-/Rezept-/Allergenlogik ein; Fallback ohne `sourceMetadata` bleibt stabil.

### 5.111 - 2026-05-21
- PA5 Read-only Konsolidierungs-/Abnahmeslice ist umgesetzt: `tests/pa5-traceability-corridor.test.ts` sichert die Kette Upload-Metadaten -> Conversation-Quellenanker -> Produktionsoutput-/Exportanker und das Architektur-Gate benennt den Korridor ausdruecklich als intern nachvollziehbar.
- Der Korridor ist kein rechtssicherer Audit und keine Vollständigkeitsgarantie für spaetere LLM-/Rezept-/Allergen-Outputs; keine neue Runtime-Funktion, API, Persistenz, LLM-/Tool-Use-/PDF-Parser-/OCR-/Rezept-/Allergenlogik wurde eingefuehrt.

### 5.112 - 2026-05-21
- PA6 Interne Beta-/Abnahme-Readiness ist als Doku-only-Slice in `docs/product/PA6_INTERNAL_BETA_READINESS_SUMMARY.md` umgesetzt und mit `entfernter Doku-Contract-Test` gegen die zentralen Readiness-/Gate-Aussagen abgesichert.
- Der Slice fuehrt keine neue Runtime-Funktion, UI, API, Persistenz, Monitoring-Engine, LLM-/Tool-Use-/PDF-Parser-/OCR-/Rezept-/Allergenlogik ein; externe oder echte produktive Nutzung bleibt ohne OIDC/SSO, read-path Auth, Sandbox/AV, Retention/PII und Human-Approval-/Architekturentscheidungen nicht freigegeben.

### 5.113 - 2026-05-21
- PA7 AuthN/AuthZ + read-path Auth ist als Doku-only-Entscheidungs-ADR in `docs/architecture/PA7_AUTH_READ_PATH_DECISION_ADR.md` umgesetzt und mit `entfernter Doku-Contract-Test` gegen Optionen, Empfehlung und Scope-Grenzen abgesichert.
- Empfohlen ist Option D als Stufenmodell: naechster Runtime-Slice nur read-only Detail-/Export-/Audit-Pfade auf bestehender Trusted-Actor-/Rollenbasis haerten; externe oder produktionsnahe Nutzung bleibt bis zur Reverse-Proxy/OIDC/SSO- bzw. Identity-Aware-Proxy-Entscheidung gesperrt, ohne Login-, Session-, Persistenz- oder OIDC-Implementierung in diesem ADR-Slice.

### 5.114 - 2026-05-21
- PA8 Read-path Auth Hardening Slice 1 ist umgesetzt und mit `tests/pa8-read-path-auth.test.ts` abgesichert: bei gesetztem Trusted-Secret reichen freie `x-actor-name`-Header fuer sensible read-only Detail-/Listen-/Exportpfade nicht mehr aus; passende Trusted-Actor-Header erlauben die rollenbezogenen Read-Zugriffe.
- Geschuetzt sind Intake-Requests/-Specs, Offer-Drafts/-Recipes, Production-Plans/-Purchase-Lists/-Recipes, der bestehende Production-Audit-Feed sowie Print-Exports fuer Angebot, Produktionsplan und Einkaufsliste; Health-Endpunkte bleiben unauthentifiziert, und externe Nutzung bleibt weiterhin ohne Reverse Proxy/OIDC/SSO bzw. Identity-Aware Proxy gesperrt.

### 5.115 - 2026-05-21
- PA9 Proxy-/Deployment-Readiness ist als Doku-/Konfigurationsanker `docs/architecture/PA9_PROXY_DEPLOYMENT_READINESS_ADR.md` umgesetzt und mit `entfernter Doku-Contract-Test` gegen Muss-Anforderungen, Health-Grenzen, Preflight und Nicht-Ziele abgesichert.
- Verbindlich dokumentiert ist: clientseitige Trusted-/Actor-Header muessen am Edge entfernt werden, Proxy/IAP setzt Trusted-Header kontrolliert, `CATERING_TRUSTED_ACTOR_SECRET` ist produktionsnah Pflicht, das Secret bleibt ausschliesslich serverseitig, Services duerfen nicht direkt oeffentlich erreichbar sein; kein OIDC-/Login-/Session-/Persistenz-Ausbau.

### 5.116 - 2026-05-21
- PA10 DocumentIngestion-v1 Boundary ist umgesetzt: `shared-core` stellt `ingestDocument(...)` und ein kleines `DocumentIngestionResult`-Modell bereit, das bestehende Textgewinnung typisiert umhuellt und `sourceMetadata`, Kontext, Status, Warnungen, Ingestion-Zeitpunkt sowie optional extrahierten Text ausdrueckt.
- Abgesichert ist der erlaubte Textpfad, ein PDF-Fallback-/Problemfall mit Warnung und die Grenze, dass Conversation-/Export-Provenance-Anker weiterhin keine sensiblen Rohinhalte spiegeln. Keine neue API, Migration, Persistenzwelt, Parser-Engine, OCR, LLM-/Tool-Use-, Angebotsanalyse-, Rezept- oder Allergenlogik.

### 5.117 - 2026-05-21
- PA11 Intake DocumentIngestion Bridge ist umgesetzt: die bestehende Intake-Dokumentnormalisierung fuer JSON/Base64 und Multipart verwendet intern `ingestDocument(...)` und fuehrt eine rueckwaertskompatible `documentIngestion`-Antwort mit `ingestionStatus`, `warnings` und vorhandener `sourceMetadata` ein.
- PDF-/Fallbackfaelle werden als Warnung/Status sichtbar statt als extrahierter Erfolg behauptet; Conversation-/Export-Provenance-Anker bleiben auf sichere Metadaten/Hash-Kurzanker begrenzt. Keine neue Persistenz, Migration, Parser-Engine, OCR, LLM-/Tool-Use-, Rezept-, Allergen- oder neue Produktlogik.

### 5.118 - 2026-05-21
- PA12 Read-only Ingestion-Warnungen sind umgesetzt: Intake-Dokumentnormalisierung speichert zusaetzlich sichere `rawInputs[].documentIngestion`-Marker, und bestehende Intake-Detail-/`/produktion`-Conversation-Kontexte zeigen fallback/failed Quellen als knappen System-/Warnhinweis.
- Abgesichert ist: fallback erzeugt sichtbaren sicheren Warnanker, extracted bleibt ohne Warnspur, und die neuen Warn-/Conversation-Marker spiegeln keine Rohtexte. Keine neue API-Welt, Persistenz, Migration, Parser-Engine, OCR, LLM-/Tool-Use-, Angebotsanalyse-, Rezept- oder Allergenlogik.

### 5.119 - 2026-05-21
- PA13 Ingestion-Warnungen in Produktionsoutput-/Exportankern ist umgesetzt: `ProductionConversationProjection` haengt sichere `ingestionStatus`-/`ingestionWarnings`-Marker nur bei fallback/failed bzw. vorhandenen Warnungen an bestehende `sourceAnchors`; der Produktionsoutput-/Downloadanker benennt diese Warnung knapp.
- `print-export` zeigt dieselben sicheren Warnmarker im Produktionsplan-HTML-Export als read-only `Ingestion-Warnungen`; extracted/ok bleibt ohne Warnspur und Rohtexte/extractedText werden nicht in Conversation-/Exportanker gespiegelt. Keine neue API, Persistenz, Parser-Engine, OCR, LLM-/Tool-Use-, Angebotsanalyse-, Rezept- oder Allergenlogik.

### 5.120 - 2026-05-21
- PA14 Read-only Abnahmeanker fuer den PA10-PA13 DocumentIngestion-Korridor ist umgesetzt: `tests/pa14-document-ingestion-corridor-readiness.test.ts` prueft Quelle, Ingestion-Status, Warnhinweis, Produktionsoutput-/Exportanker und die Sicherheitsgrenze ohne Rohtextspiegelung.
- `TESTING.md` benennt den Korridor als internen Abnahmeanker: Quelle vorhanden -> Ingestion-Status sichtbar -> Warnungen sichtbar -> Exportanker sicher. Keine neue UI, API, Persistenz, Migration, Parser-Engine, OCR, LLM-/Tool-Use-, Rezept-, Allergen-, Dashboard- oder Monitoring-Logik.


### 5.121 - 2026-05-21
- PA15 ProductionAgent-v1 Next Capability ADR ist als Doku-/Entscheidungsslice umgesetzt: `docs/architecture/PA15_PRODUCTION_AGENT_NEXT_CAPABILITY_ADR.md` vergleicht Rueckfragenmodell, RecipeCandidate-Grenze, read-only Output-Einordnung und Tool-/LLM-Gate und empfiehlt das Rueckfragenmodell als naechste echte, verantwortbare Agentenfaehigkeit.
- Der Slice bleibt ohne Runtime-Implementierung, neue API, Persistenz, Migration, LLM-/Tool-Use, OCR-/Parser-, Rezept-/Mengen-/Allergen- oder Downloadlogik; der naechste enge Slice waere PA16 Clarification Model Slice 1 als Modell-/Projection-Grenze aus vorhandenen Ingestion-Warnungen, Spec-Luecken und Quellenankern.

### 5.122 - 2026-05-21
- PA16 Clarification Model Slice 1 ist umgesetzt: `ProductionClarificationQuestion` im `shared-core` modelliert Rueckfragen mit `questionId`, Ursache, Schwere/blockierendem Status, neutralem Prompt, sicheren `sourceAnchors` und optionalem Antworttyp.
- Erlaubte Ursachen bleiben eng begrenzt auf `missingFields`, `readiness.reasons`, `documentIngestion.status` und `documentIngestion.warnings`; die bestehende `ProductionConversationProjection` zeigt diese Hinweise read-only als strukturierte Agent-Fragen. Keine Nutzerantwortspeicherung/-verarbeitung, neue API, Persistenz, LLM-/Tool-Use-, Parser-, Rezept-, Mengen-, Allergen- oder UI-Workflow-Logik.

### 5.123 - 2026-05-21
- PA17 Clarification Question Quality Slice ist umgesetzt: `buildProductionClarificationQuestions(...)` sortiert Rueckfragen deterministisch nach Schwere und Ursache, dedupliziert identische Ursache-/Quellenanker-Kombinationen und nutzt neutrale Labels fuer bekannte sichere Feld-/Warnkeys.
- Die Projection bleibt read-only; unbekannte Keys bleiben als technische Fallbacks sichtbar, sensible Roh-/Extraktionstexte werden nicht gespiegelt. Keine Antwortspeicherung, neue API, Persistenz, LLM-/Tool-Use-, Parser-, Rezept-, Mengen-, Allergen- oder UI-Workflow-Logik.

### 5.124 - 2026-05-21
- PA18 Clarification Answer Processing Gate ist als Doku-/Security-Slice umgesetzt: `docs/architecture/PA18_CLARIFICATION_ANSWER_PROCESSING_GATE_ADR.md` definiert erlaubte spaetere Antworttypen, Fragebindung, Sanitizing-/XSS-/Prompt-Injection-Pflichttests, Human-Review-Grenze und Persistenzentscheidungsbedarf.
- Der Slice bleibt bewusst ohne Runtime-Antwortannahme, Antwortspeicherung, Antwortverarbeitung, neue API, Persistenz, LLM-/Tool-Use, Parser-, Rezept-, Mengen- oder Allergenlogik; naechster Schritt ist Stop bis Entscheidung oder hoechstens ein reiner Typ-/Testanker `AllowedAnswerType`/`ProductionClarificationAnswerDraft`.

### 5.125 - 2026-05-21
- PA19 Clarification Answer Type Anchor ist umgesetzt: `shared-core` exportiert `allowedProductionClarificationAnswerTypes` mit ausschliesslich `shortText`, dokumentiert Auswahl/Bestaetigung, Ja/Nein und Datei-/Quellenhinweis nur als spaetere Konzeptgrenzen und definiert `ProductionClarificationAnswerDraft` mit `questionId`, Question-Key und Antworttyp ohne Antwortinhalt.
- Der Slice konserviert Alexanders Entscheidungen nach PA18 im ADR/Testanker: weiterarbeiten nur als Typanker, Antwortspeicherung erst nach bewusstem Datenmodell-/Migrationsschnitt, erster Runtime-Antworttyp nur kurze Freitext-Klaerung. Keine Antwortannahme, Antwortspeicherung, Antwortverarbeitung, neue API, Persistenz, Runtime-, Rezept-, Mengen-, Allergen- oder Rohtextspiegelungslogik.

### 5.126 - 2026-05-21
- PA20 Clarification Answer Data Model / Migration Decision ADR ist als reine Entscheidungsvorlage umgesetzt: `docs/architecture/PA20_CLARIFICATION_ANSWER_DATA_MODEL_MIGRATION_ADR.md` bewertet A dateibasierte Ablage, B explizites Answer-Datenmodell in bestehender Domain-/Persistenzgrenze, C vollstaendigen Persistenz-/Migrationsschnitt und D Stop.
- Empfehlung ist Option B als naechstes Gate, aber ohne PA20-Runtime: keine Antwortannahme, Antwortspeicherung, Antwortverarbeitung, neue API, Migration, neue Persistenzwelt, Rezept-/Mengen-/Allergenlogik oder Rohtextspiegelung.

### 5.127 - 2026-05-21
- PA21 Clarification Answer Model Anchor ist umgesetzt: `shared-core` definiert `ProductionClarificationAnswer` als spaeteren Modellanker mit `answerId`, `questionId`, stabilem Question-Key, `answerType: shortText`, `status: draft/submitted/reviewed`, typisiertem kurzem `answerText`, optionalem Actor und Zeitstempeln.
- Abgesichert sind Option B als Zielrichtung nach PA20, die exakte Statusmenge, die aktive Beschraenkung auf `shortText`, eine Textlaengengrenze und Sicherheitsgrenzen gegen Rohtext-/HTML-/Script-Spiegelung, automatische Fachableitung und automatische Spec-Korrekturueberfuehrung. Keine Antwortannahme, Speicherung, Verarbeitung, neue API, Migration, neue Persistenzwelt, UI-/Projection-Erweiterung oder LLM-/Tool-/Rezept-/Mengen-/Allergenlogik.

### 5.128 - 2026-05-21
- PA22 Clarification Answer Storage/Display Gate ist als Doku-/Marker-Slice umgesetzt: `docs/architecture/PA22_CLARIFICATION_ANSWER_STORAGE_DISPLAY_GATE_ADR.md` legt fest, dass spaetere kurze Freitextantworten nur innerhalb des `ProductionClarificationAnswer`-Modells und der bestehenden Domain-/Persistenzgrenze gespeichert werden duerfen.
- Empfehlung: ein spaeterer PA23-Minimalslice kann `shortText`-Antworten auf bestehende Fragen validieren, als `submitted` speichern und read-only in bestehenden `/produktion`-Projection-/Detailankern anzeigen; weiter gesperrt bleiben Antwortbearbeitung, automatische Spec-Korrektur, Fachableitung, neue API/Migration/Persistenzwelt, LLM-/Tool-Use sowie Rezept-/Mengen-/Allergenlogik.

### 5.129 - 2026-05-21
- PA23 Clarification Answer Runtime Minimal Slice ist als erster enger Runtime-Speicher-/Anzeige-Slice umgesetzt: `createSubmittedProductionClarificationAnswer(...)` validiert bekannte Rueckfrage, stabilen Question-Key, `answerType: shortText`, leere/zu lange Antworten und escaped HTML/Script vor Speicherung/Anzeige.
- `ProductionStore` speichert `ProductionClarificationAnswer` in der bestehenden `PersistentCollection`-Grenze `production/clarification-answers`; `ProductionConversationProjection` zeigt passende `submitted`-Antworten read-only direkt unter der zugehoerigen Agent-Frage. Bewusst nicht umgesetzt: neue HTTP-API, Migration/Prisma/neue Persistenzwelt, Antwortbearbeitung, aktives `draft`/`reviewed`, automatische Spec-Korrektur/Fachableitung, LLM-/Tool-Use sowie Rezept-/Mengen-/Allergenlogik.

### 5.130 - 2026-05-22
- PA24 Clarification Answer Session/Spec Binding Anchor ist umgesetzt: `ProductionClarificationQuestion`, `ProductionClarificationAnswerDraft` und `ProductionClarificationAnswer` tragen eine explizite `context`-Bindung aus bestehender `specId` und bestehender `ProductionConversationProjection.sessionId` (`production-session-${specId}`).
- Antworterzeugung, Store-Grenze und Projection verlangen diese eindeutige Bindung; falsche oder fehlende Spec-/Session-Kontexte werden abgelehnt beziehungsweise nicht angezeigt. Keine neue ID-Welt, keine neue Persistenz, Migration, Prisma, API-/UI-Erweiterung, Antwortbearbeitung, automatische Spec-Korrektur oder fachliche Antwortinterpretation.

### 5.131 - 2026-05-22
- PA25 Read-only Statusanker fuer beantwortete Rueckfragen ist umgesetzt: bestehende strukturierte Agent-Fragen in der `ProductionConversationProjection` tragen nun `clarificationAnswerStatus: answered | unanswered`.
- Als beantwortet zaehlt nur eine passende `submitted`-`shortText`-Antwort mit gleicher `questionId`, passendem stabilen Question-Key und gleicher `specId`/`production-session-${specId}`-Bindung; falscher Kontext, falscher Typ, `draft`, `reviewed` und malformed Answers bleiben `unanswered`. Keine automatische Spec-Korrektur, Fachableitung, Frage-Schliessung, neue API, UI-Welt, Migration oder neue Persistenz.

### 5.132 - 2026-05-22
- Hans Day Build PA26-PA31 plus CI-Fix ist als nutzbarer Tagesstand dokumentiert: Production Workbench zeigt Rueckfragenstatus, naechsten Schritt, Produktionsobjekte/Downloads, Rezeptpruefstatus und Herkunft/Uebergabe aus vorhandenen Daten; der abschliessende PA32-Schritt ist Betriebscheck und Dokumentationsnachzug ohne neuen Featurebau.
- Umgesetzt sind nur UI-/Smoke-/Doku-Konsolidierung und der CI-Testcopy-Fix. Offen bleiben produktionsnahe Freigabe-/Security-/Architekturgates; out of scope bleiben neue API, Persistenz/Migration/Prisma, LLM-/Tool-/OCR-/Parser-Ausbau, automatische Spec-Korrektur, Rezept-/Allergenautomatik, OAuth/Google/Login/OIDC und `/angebot`-Umbau.
### 5.133 - 2026-05-22
- C2 local:check-Dokumentation ist umgesetzt: `TESTING.md` trennt `local:status` als Prozess-/Erreichbarkeitsuebersicht von `local:check` als lokalem Betriebs-/Seed-/Export-/Auditbeleg und grenzt den Check explizit von CI-Pflicht, Produktionsfreigabe und rechtssicherer Audit-Aussage ab.
- Ergaenzt ist ein fokussierter Vertragstest `tests/local-ops-check-contract.test.ts`, der die C1-Annahme `limit=200` im Auditfenster sowie deterministische Fehlermeldungen fuer fehlende/ungueltige Seed-Belege schuetzt, ohne neue Produktlogik, API, Persistenz oder Audit-/Compliance-Welt einzufuehren.

### 5.134 - 2026-05-22
- C3 Angebot-Happy-Path ist umgesetzt: `tests/backoffice-route-smoke.test.ts` enthaelt einen fokussierten jsdom-Smoke, der eine zentrale Angebotsanfrage absendet, den neu erzeugten Angebotsentwurf als aktiven Fokus erwartet und bestehende Status-, Uebergabe-, Export- und Produktionsanker schuetzt.
- Minimaler UI-Fix: Nach erfolgreichem `createOfferFromText(...)` setzt `/angebot` den zurueckgegebenen `draftId` als ausgewaehlten Entwurf, damit Nutzer nach dem Erzeugen nicht auf einem alten Entwurf stehen bleiben. Keine neue Angebotslogik, API, Persistenz, Migration, LLM-/Parser-/OCR- oder OAuth-/Google-Arbeit.

### 5.135 - 2026-05-22
- C4 Angebot-zu-Produktion-Uebergabeanker ist umgesetzt: `tests/backoffice-route-smoke.test.ts` prueft denselben vorhandenen `draftId`-/`specId`-/`requestId`-/Export-Kontext zwischen `/angebot` und `/produktion`.
- Minimaler UI-/Read-Fix: Die Angebots-Uebergabeliste zeigt vorhandene `specId` und `requestId` sichtbar; `/produktion` zeigt die aktive `specId` in den Spezifikationsdetails und nutzt eine vorhandene `requestId` auf der Spec als Detailanker. Keine neue API, Persistenz, Migration, automatische Spec-Korrektur, neue Uebergabelogik oder Angebots-/Produktionsmodell-Erweiterung.

### 5.136 - 2026-05-22
- C5 Exportlinks mit Trusted-Actor-Kontext ist umgesetzt: `tests/pa8-read-path-auth.test.ts` schuetzt nun auch den vorhandenen Angebot-HTML-Exportpfad unter gesetztem `CATERING_TRUSTED_ACTOR_SECRET` gegen frei gesetztes `x-actor-name` und falsche Trusted-Rolle; der passende Angebots-Trusted-Actor bleibt erfolgreich.
- Produktionsplan-/Produktionsblatt- und Einkaufslisten-Export waren im bestehenden PA8-Testkorridor bereits abgesichert; Health bleibt offen. Es war kein Code-Fix noetig und es wurde keine neue Exportlogik, API, Persistenz, OIDC-/Login-/Session-Mechanik oder rechtssichere Audit-Behauptung eingefuehrt.

### 5.137 - 2026-05-22
- C6 Upload-/Import-Pfade im Workbench-Kontext ist umgesetzt: Der neue fokussierte Backoffice-Smoke schuetzt, dass eine vorhandene Intake-Upload-Abweisung mit kontrollierter Servermeldung in `/produktion` sichtbar bleibt und nicht nur als generische HTTP-Statuszeile erscheint.
- Die bestehende C4-Handoff-Regression schuetzt zusaetzlich sichere DocumentIngestion-Warnungen und gekuerzte Quellenmetadaten im Produktions-Workbench-Kontext; `backoffice-ui/src/api.ts` nutzt dafuer vorhandene JSON-`message`-Fehler aus Fetch-Antworten. Keine neue API, Persistenz, Migration, Parser-/OCR-/LLM-Engine oder neues Upload-Framework.

### 5.138 - 2026-05-22
- C7 Leer-/Fehlerzustaende fuer interne Nutzung ist umgesetzt: `tests/backoffice-production-acceptance-smoke.test.ts` schuetzt jetzt den Zustand klare Spezifikation, aber noch kein Produktionsplan, keine Einkaufsliste und keine Exportlinks.
- Minimaler UI-/Copy-Fix: `/produktion` benennt in den bestehenden Produktionsobjekt-/Einkaufslisten-Zonen den naechsten Schritt `Berechnung starten` und erklaert, dass Einkaufsliste und Exportlinks erst mit vorhandenen Produktionsobjekten erscheinen. Keine neue Recovery-Plattform, kein neuer Workflow, keine neue API, Persistenz, Migration oder Produktlogik.

### 5.139 - 2026-05-22
- C8 interner Demo-Durchlauf als reproduzierbarer Abnahmeweg ist Doku-only umgesetzt: `docs/product/C8_INTERNER_DEMO_DURCHLAUF_ABNAHMEWEG.md` beschreibt lokale Voraussetzungen, `npm run local:status`, `npm run local:check`, UI-Routen `/angebot` und `/produktion`, Angebot-Happy-Path/Handoff, Upload-/Import-Warnanker, Exportlinks unter Trusted-Actor-Kontext und Full Gates.
- README und TESTING verweisen auf den C8-Abnahmeweg; der Rahmen bleibt intern und behauptet keine Produktionsfreigabe, keine rechtssichere Audit-/Compliance-Abnahme, keine neue API, Persistenz, Tests oder Produktlogik.

### 5.140 - 2026-05-22
- B1 macht den C8-Abnahmeweg als schmalen Doku-Vertrag pruefbar: `tests/local-ops-check-contract.test.ts` schuetzt, dass C8 in README/TESTING auffindbar bleibt, die genannten `local:status`-/`local:check`-Scripts und relevante Backoffice-/Upload-/Export-Testanker existieren und die Kernanker `npm run local:status`, `npm run local:check`, `/angebot`, `/produktion`, Angebot-Happy-Path, Handoff-Anker, Upload-/Import-Warnanker, Trusted-Actor-Kontext und Full Gates in C8/TESTING enthalten sind.
- Kleine Doku-Schaerfung in C8 und TESTING; keine Produktlogik, keine neue API, keine Persistenz/Migration, kein OAuth/Google/Login/OIDC und keine rechtssichere Audit-/Compliance-Behauptung.

### 5.141 - 2026-05-22
- B2 schaerft den Demo-Start-/Seed-/Audit-Korridor narrativ in README, TESTING und C8: `local:status` ist nur Prozess-/Erreichbarkeitsuebersicht, `local:check` ist lokaler Betriebs-/Seed-/Export-/Auditbeleg gegen einen laufenden Stack.
- Demo-Seed ist als interne Verifikationshilfe und nicht als Produktionsdatenmodell beschrieben; Auditbeleg als interner Betriebs-/Kontrollnachweis und nicht als rechtssichere Audit-/Compliance-Aussage; C8 bleibt interner Demo-/Abnahmeweg ohne Produktionsfreigabe oder externe Freigabe. Keine Produktlogik, API, Persistenz, Migration, OAuth/Google/Login/OIDC oder neue Audit-/Compliance-Welt.

### 5.142 - 2026-05-22
- B4 Produktionsobjekt-/Export-Readiness ist minimal umgesetzt: `tests/backoffice-production-acceptance-smoke.test.ts` schuetzt nun den Zustand vorhandener Produktionsplan, aber noch fehlende Einkaufsliste/fehlender Einkaufslisten-Export.
- Minimaler UI-/Copy-Fix in `/produktion`: Der naechste Schritt lautet in diesem Zustand `Einkaufsliste noch offen` statt pauschal alle Downloads als verfuegbar einzuordnen. Keine neue Generierungslogik, API, Persistenz, Migration oder Produktlogik.

### 5.143 - 2026-05-22
- B5 Upload-/Warnungszustand im Demo-Weg ist minimal umgesetzt: `tests/backoffice-route-smoke.test.ts` schuetzt, dass `/produktion` vorhandene DocumentIngestion-Warnungen fuer die Demo-Abnahme als Warnstatus plus Warnkey sichtbar macht und dabei Rohtexte sowie volle SHA-256-Hashes nicht spiegelt.
- Kleine UI-/Copy- und Doku-Schaerfung in `/produktion`, TESTING und C8: Quellenmetadaten sind als gekuerzt benannt; Hashes bleiben Kurzanker. Keine Produktlogik, Parser-/OCR-/LLM-Erweiterung, neue API, Persistenz oder Migration.

### 5.144 - 2026-05-22
- B6 Trusted-Actor-/Export-Grenzen fuer Abnahme ist Doku-/Test-only umgesetzt: `entfernter Doku-Contract-Test` verankert die drei bestehenden PA8-Exportpfade fuer Angebots-HTML, Produktionsblatt-/Produktionsplan-HTML und Einkaufslisten-CSV und verlangt eine konsistente Einordnung in C8, TESTING und PA9.
- C8, TESTING und PA9 benennen Exporte nun als interne read-only Arbeitsbelege unter Trusted-Actor-Kontext und grenzen sie von externer Freigabe, Produktionsfreigabe, rechtssicherer Audit-/Compliance-Behauptung und OIDC/Login ab. Keine neue Exportlogik, API, Persistenz oder Security-/Login-Welt.

### 5.145 - 2026-05-22
- B7 Management-/Lageuebersicht ist Doku-/Test-only umgesetzt: `docs/product/PA6_INTERNAL_BETA_READINESS_SUMMARY.md` enthaelt jetzt eine harte B7-Lageuebersicht mit den getrennten Bereichen tatsaechlich umgesetzt, nur dokumentiert / nur intern abnahmefaehig, offen, Risiko und naechste Entscheidung fuer Alexander.
- `entfernter Doku-Contract-Test` schuetzt diese Management-Struktur und die Grenze: keine Produktionsfreigabe, keine externe Freigabe und keine rechtssichere Audit-/Compliance-Behauptung. Keine Produktlogik, UI, API, Persistenz, Migration oder OIDC/Login.

### 5.146 - 2026-05-22
- B8 AuthN/AuthZ/read-path Auth Entscheidungsgrenze ist Doku-/Test-only umgesetzt: `docs/architecture/B8_AUTH_GATE_DECISION_BOUNDARY.md` trennt vorhandene PA8-/Trusted-Actor-Read-Path-Schutzpunkte, interne read-only Detail-/Export-/Auditpfade, nicht produktionsnah nutzbare Pfade ohne naechste Auth-Entscheidung, Alexanders Minimalentscheidung fuer B9 und Out-of-Scope-Grenzen.
- `entfernter Doku-Contract-Test` schuetzt diesen Vertrag und die Grenzen: keine Login-/OIDC-/Session-Welt, keine neue API, Persistenz, Migration, Exportlogik, externe Rollen-/Mandantenlogik, produktionsnahe Freigabe oder rechtssichere Audit-/Compliance-Behauptung.

### 5.147 - 2026-05-22
- B9 Proxy/IAP-AuthN-Preflight-Vertrag ist Doku-/Test-only umgesetzt: `docs/architecture/B9_PROXY_IAP_AUTHN_PREFLIGHT_CONTRACT.md` konkretisiert den minimalen Preflight-Korridor fuer einen spaeteren produktionsnahen Pilot: Header-Stripping am Proxy-/IAP-Rand, kontrollierte Trusted-Header-Injektion, serverseitig gesetztes `CATERING_TRUSTED_ACTOR_SECRET`, keine direkte Service-Exposition, nicht-sensitive Health-Endpunkte und Exporte/read-only Arbeitsbelege hinter Trusted-Actor-/Proxy-Kontext.
- `entfernter Doku-Contract-Test` schuetzt diesen Vertrag und die Grenzen: keine Login-/Session-/OIDC-Implementierung in der App, kein echter Proxy-/IAP-Deployment-Code, keine neue API, Persistenz, Migration, Exportlogik, produktionsreife Auth, externe Freigabe oder rechtssichere Compliance.

### 5.148 - 2026-05-22
- B10 Pilot-Preflight-Runbook ist Doku-/Test-only umgesetzt: `docs/architecture/B10_PILOT_PREFLIGHT_RUNBOOK.md` macht die B9-Mussbedingungen fuer eine konkrete Zielumgebung abfragbar: Zielumgebung, Betreiber, Proxy-/IAP-Rahmen, direkte Service-Exposition, Header-Stripping, Trusted-Header-Injektion, serverseitiges Trusted Secret, Health-Grenzen, Export-/Read-Kontext und Ergebniszustaende `go`, `blocked` und `not assessed`.
- `entfernter Doku-Contract-Test` schuetzt den Runbookanker und die Grenzen: PII, Retention, Backup, Sandbox und AV bleiben separate Gates; keine produktionsnahe Freigabe ohne ausgefuellten und erfuellten Preflight; kein Deployment-Code, keine neue Runtime, keine App-Login-/Session-/OIDC-Implementierung, keine neue API, Persistenz, Migration oder rechtssichere Compliance-Behauptung.

### 5.149 - 2026-05-22
- B11 lokaler Demo-/Pilotdaten-Abnahmedurchlauf ist Doku-/Vertragstest-only umgesetzt: `docs/product/B11_LOCAL_DEMO_PILOT_ACCEPTANCE_RUN.md` strukturiert vorhandene lokale Gates, Backoffice-/Export-/Ingestion-Smokes und Ergebniszustaende `go`, `blocked` und `not assessed`.
- `entfernter Doku-Contract-Test` schuetzt, dass ein gruener B11-Lauf nur interne Demo-/Abnahmefaehigkeit bedeutet und ein produktionsnaher Pilot ohne B10-Preflight, PII-/Retention-/Backup- sowie Sandbox-/AV-Gates `blocked` bleibt. Keine neue Produktlogik, API, Persistenz, Exportlogik, Deployment- oder Compliance-/Audit-Freigabe.

### 5.150 - 2026-05-22
- B12 lokaler Demo-Ergebnisvermerk ist Doku-/Vertragstest-only umgesetzt: `docs/product/B12_LOCAL_DEMO_RESULT_NOTE.md` strukturiert Datum/Scope, tatsaechliche lokale Nachweise, zulaessige Artefaktquellen ohne Secrets/PII/echte Kunden- oder Pilotdaten, Ergebniszustaende `go`, `blocked` und `not assessed`, offene Blocker und klare Nicht-Behauptungen.
- `entfernter Doku-Contract-Test` schuetzt, dass lokale Gruen-Signale nur interne Demo-Abnahmefaehigkeit tragen und daraus kein produktionsnaher Pilot, keine externe Freigabe oder rechtssichere Compliance-/Audit-Aussage abgeleitet wird; konkrete Zielumgebung, B10-Preflight-Ausfuellung, PII/Retention/Backup sowie Sandbox/Worker/AV bleiben `blocked` oder `not assessed`. Keine Produktlogik, UI, API, Persistenz, Migration, Exportlogik oder Deployment-Code.

### 5.151 - 2026-05-22
- B13 PII/Retention/Backup-Gate ist Doku-/Vertragstest-only umgesetzt: `docs/architecture/B13_PII_RETENTION_BACKUP_GATE.md` trennt erlaubte Demo-/Seed-/synthetische Daten und interne Arbeitsbelege von echten Mitarbeiter-, Kunden-, Einsatz-/Schicht-/Abrechnungs- und produktionsnahen Pilotdaten.
- `entfernter Doku-Contract-Test` schuetzt die fehlenden Mindestentscheidungen Datenkategorien/PII-Scope, Speicherort/Systemgrenze, Aufbewahrungsfrist/Loeschkonzept, Backup-/Restore-Verantwortung, Zugriff/Verantwortliche, Export-/Audit-Artefaktklassifikation und Incident-/Loeschpfad sowie die Ergebniszustaende `go`, `blocked` und `not assessed`. Keine neue Persistenz, Migration, Backup-Implementierung, Loesch-/Retention-Engine, API, Produktlogik, echte personenbezogene Datenverarbeitung oder rechtssichere Compliance-/DSGVO-Freigabe.

### 5.152 - 2026-05-22
- B14 Sandbox/Worker/AV-Gate ist Doku-/Vertragstest-only umgesetzt: `docs/architecture/B14_SANDBOX_WORKER_AV_GATE.md` trennt den aktuellen internen Demo-/Ingestion-/Upload-Korridor von produktionsnaher Verarbeitung beliebiger Dateien.
- `entfernter Doku-Contract-Test` schuetzt die fehlenden Mindestentscheidungen erlaubte Dateitypen, Groessenlimits, Quarantaene-/Reject-Verhalten, Scan-/Sandbox-Verantwortung, Worker-Isolation, Timeout-/Ressourcenlimit, Fehler-/Warnpfad und Betreiber-/Betriebsverantwortung. Health-/Demo-/Read-only-Export-Gruensignale ersetzen keine Sandbox/AV-Freigabe; B13 PII/Retention/Backup bleibt separat. Keine Sandbox-/Worker-/AV-Implementierung, neue Parser-/OCR-/LLM-Engine, neue Upload-/Ingestion-Produktlogik, API, Persistenz, Migration, Runtime oder produktionsnahe Dateiverarbeitungsfreigabe.

### 5.153 - 2026-05-22
- B15 Produktions-Demo-Lesbarkeit ist als kleiner regressionssicherer UI-/Smoke-Baustein umgesetzt: `tests/backoffice-production-acceptance-smoke.test.ts` schuetzt, dass die kompakte `/produktion`-Zusammenfassung bei vorhandenen Produktionsobjekten den Ergebnisobjektstatus sichtbar macht.
- Minimaler UI-Fix in `backoffice-ui/src/production-workbench.tsx`: Die Calm Summary zeigt `Ergebnisobjekte: ...` aus dem bereits vorhandenen `productionObjectStatusLabel`. Keine neue Produktflaeche, Fachlogik, API, Persistenz, Migration oder neue Demo-/Gate-Doku.

### 5.154 - 2026-05-22
- B17 Angebots-/Export-Lesbarkeit ist als kleiner regressionssicherer UI-/Smoke-Baustein umgesetzt: `tests/backoffice-route-smoke.test.ts` schuetzt, dass die kompakte `/angebot`-Zusammenfassung den vorhandenen Angebots-HTML-Exportstatus fuer den fokussierten Entwurf frueh sichtbar macht.
- Minimaler UI-Fix in `backoffice-ui/src/offer-workbench.tsx`: Die Calm Summary zeigt `Export: Angebots-HTML fuer <draftId> bereit` bzw. ohne Entwurf `Export: noch kein Angebotsentwurf`. Keine neue Angebotslogik, Exportlogik, API, Persistenz, Migration oder neue Produktflaeche.

### 5.155 - 2026-05-22
- B18 Audit-/Handoff-Lesbarkeit ist als kleiner regressionssicherer UI-/Smoke-Baustein umgesetzt: `tests/backoffice-production-acceptance-smoke.test.ts` schuetzt, dass die bestehende `/produktion`-Zone `Herkunft und Übergabe` den neuesten Audit-Eintrag mit Summary, Actor, Action-Key und Zeitstempel sichtbar macht.
- Minimaler UI-Fix in `backoffice-ui/src/App.tsx`: Das bestehende Audit-Spur-Label nutzt vorhandene Audit-Event-Felder (`summary`/`action`/`auditId`, `actor.name`, `action`, `at`) statt nur der Summary. Keine neue Auditlogik, Operatorlogik, Fachlogik, API, Persistenz, Migration, Exportlogik oder neue Produktflaeche.

### 5.156 - 2026-05-22
- B19 Angebotsdetail-Kontext ist als kleiner regressionssicherer UI-/Smoke-Baustein umgesetzt: `tests/backoffice-route-smoke.test.ts` schuetzt, dass der fokussierte Angebotsentwurf im bestehenden `/angebot`-Detailpanel frueh `Entwurfs-Spec` plus Readiness und `Entwurfs-Quelle` aus vorhandenen `proposedEventSpec.sourceLineage`-Daten zeigt.
- Minimaler UI-Fix in `backoffice-ui/src/offer-workbench.tsx`: Die bestehende `Ausgewählter Entwurf`-Zone rendert nur bereits vorhandene Draft-/Spec-/Source-Marker. Keine neue Produktflaeche, Angebotslogik, Intake-Logik, API, Persistenz, Migration, Audit-/Operatorlogik oder Exportlogik.

### 5.157 - 2026-05-22
- B20 Start-/Audit-Lesbarkeit ist als kleiner regressionssicherer UI-/Smoke-Baustein umgesetzt: `tests/backoffice-route-smoke.test.ts` schuetzt, dass die bestehende Startseiten-Zusammenfassung `Änderungsprotokoll` beim neuesten Audit-Eintrag vorhandenen Actor, Action-Key und Zeitstempel nennt.
- Minimaler UI-Fix in `backoffice-ui/src/App.tsx`: Die Startseiten-Zusammenfassung nutzt vorhandene Audit-Event-Felder (`summary`/`action`/`auditId`, `actor.name`, `action`, `at`) statt nur der Summary. Keine neue Auditlogik, Operatorlogik, Fachlogik, API, Persistenz, Migration oder Produktflaeche.

### 5.158 - 2026-05-22
- B21 Intake-Status-Lesbarkeit ist als kleiner regressionssicherer UI-/Smoke-Baustein umgesetzt: `tests/backoffice-route-smoke.test.ts` schuetzt, dass die bestehende Startseiten-Erfassungsstatuskarte vorhandene sichere Source-/Warnmarker des neuesten Intake-Requests frueh sichtbar macht.
- Minimaler UI-Fix in `backoffice-ui/src/App.tsx`: `formatLatestIntakeRequest(...)` ergaenzt nur vorhandene `rawInputs.sourceMetadata.filename` und sichere `documentIngestion`-Status-/Warnkeys; Vollhashes und Rohtexte bleiben verborgen. Keine neue Intake-Logik, API, Persistenz, Migration, Parser-/OCR-/LLM-Engine oder Produktflaeche.

### 5.159 - 2026-05-22
- B23 Produktionsplan-Detailkontext ist als kleiner regressionssicherer UI-/Smoke-Baustein umgesetzt: `tests/backoffice-route-smoke.test.ts` schuetzt, dass der bestehende `/produktion`-Downloadbereich beim ausgewaehlten Produktionsplan vorhandene `planId` und `eventSpecId` vor dem Produktionsblatt-Export sichtbar macht.
- Minimaler UI-Fix in `backoffice-ui/src/App.tsx`: Der vorhandene Downloadbereich rendert `Plan-Kontext: planId ... · specId ...` aus dem bereits geladenen Produktionsplan. Keine neue Produktflaeche, Fachlogik, API, Persistenz, Migration oder Exportlogik.

### 5.160 - 2026-05-22
- B24 Pilot-Korridor-Entscheidungsanker ist Doku-/Vertragstest-only umgesetzt: `docs/product/B24_PILOT_KORRIDOR_ENTSCHEIDUNGSANKER.md` verankert Alexanders konservative Entscheidung als Repo-Vertrag: interner Demo-Modus `go`, begrenzter interner Pilot mit anonymisierten Daten bis zu konkreter Zielumgebung/Personen/Datenumfang `not assessed`, produktionsnaher Pilot mit echten Daten, öffentlicher Direktzugriff und beliebige echte Uploads `blocked`.
- `entfernter Doku-Contract-Test` schuetzt erlaubte Demo-/synthetische/anonymisierte Daten, Stop-Kriterien, B10/B13/B14-Gate-Bezug und klare Nicht-Ableitungen: kein Produktivbetrieb, keine externe Freigabe, keine echten Daten, keine neue API/Persistenz/Login-/Proxy-/Sandbox-/Retention-/Backup-Implementierung und keine rechtssichere Compliance-/DSGVO-Freigabe.

### 5.161 - 2026-05-22
- B25 Hetzner-Deployment-Preflight ist Doku-/Vertragstest-only umgesetzt: `docs/deployment/B25_HETZNER_DEPLOYMENT_PREFLIGHT.md` verankert Alexanders Hetzner-Server als Zielumgebung mit Deploymentstatus `not deployed` und Produktiv-/Pilotstatus `blocked`, bis der Preflight ausgefuellt ist.
- `entfernter Doku-Contract-Test` schuetzt Reverse Proxy / IAP oder vergleichbare Zugriffsschicht, blockierte direkte Service-Exposition, Secrets/ENV ausserhalb des Repos, keine Secrets in Git/Reports/Logs/Telegram, HTTPS/TLS-, Prozessmodell- und Rollback-/Stop-Klaerung, nicht-sensitive Healthchecks sowie B10/B13/B14/B24-Gate-Bezuege. Kein Deployment, keine Serveraenderung, keine SSH-Verbindung, keine Secret-Erstellung, keine produktiven Configs, keine neue API/Persistenz/Migration, keine echten Daten und keine rechtssichere Compliance-/DSGVO-Freigabe.

### 5.162 - 2026-05-22
- B26 Hetzner-Preflight-Nachweischeckliste ist Doku-/Vertragstest-only umgesetzt: `docs/deployment/B26_HETZNER_PREFLIGHT_EVIDENCE_CHECKLIST.md` konkretisiert den B25-Hetzner-Preflight in sichere Nachweiszeilen fuer Zielumgebung/Hostrahmen, Betreiber, Proxy/IAP, direkte Service-Exposition, Header-Stripping, Trusted-Header-Injektion, serverseitiges Trusted Secret ohne Wert, HTTPS/TLS, nicht-sensitive Healthchecks, Rollback-/Stop-Pfad sowie B13-/B14-Gates.
- `entfernter Doku-Contract-Test` schuetzt Ergebniszustaende `go`, `blocked`, `not assessed`, Secret-/PII-Dokumentationsgrenzen und die Blockade ohne vollstaendig gruene Mussnachweise. Kein Deployment, keine Serveraenderung, keine SSH-Verbindung, keine Secret-Erstellung, keine produktiven Configs, keine neue API/Persistenz/Migration, keine Produktlogik und keine echten Daten.

### 5.163 - 2026-05-22
- B27 Hetzner-Preflight-Statusvorlage ist Doku-/Vertragstest-only umgesetzt: `docs/deployment/B27_HETZNER_PREFLIGHT_STATUS_TEMPLATE.md` macht die B26-Nachweiszeilen als ausfuellbare, nicht-sensitive Statusvorlage mit Status `go`/`blocked`/`not assessed`, nicht-sensitiver Begruendung und naechstem sicherem Schritt sichtbar.
- `entfernter Doku-Contract-Test` schuetzt Bezug zu B25/B26, konservative Defaults, Secret-/PII-/IP-Dokumentationsgrenzen und die Blockade ohne vollstaendig gruene Mussnachweise. Kein Deployment, keine Serveraenderung, keine SSH-Verbindung, keine Secret-Erstellung, keine produktiven Configs, keine neue API/Persistenz/Migration, keine Produktlogik und keine echten Daten.

### 5.164 - 2026-05-22
- B28 Hetzner-Preflight-Entscheidungspaket ist Doku-/Vertragstest-only umgesetzt: `docs/deployment/B28_HETZNER_PREFLIGHT_DECISION_PACKET.md` verdichtet B25/B26/B27 zu expliziten Mussgruppenentscheidungen `go` oder `blocked` fuer einen spaeteren Hetzner-Schritt.
- `entfernter Doku-Contract-Test` schuetzt konservative Default-Blockade, Teil-`go`-Grenze, Secret-/PII-/IP-Dokumentationsgrenzen und die Nicht-Ableitung eines Deployment-Go. Kein Deployment, keine Serveraenderung, keine SSH-Verbindung, keine Secret-Erstellung, keine produktiven Configs, keine neue API/Persistenz/Migration, keine Produktlogik und keine echten Daten.

### 5.165 - 2026-05-22
- B29 Hetzner-Preflight-Operatorfragen ist Doku-/Vertragstest-only umgesetzt: `docs/deployment/B29_HETZNER_PREFLIGHT_OPERATOR_QUESTIONS.md` uebersetzt das B28-Entscheidungspaket in nicht-sensitive Operatorfragen fuer die naechste sichere Klaerung ohne Serverzugriff.
- `entfernter Doku-Contract-Test` schuetzt konservative Default-Blockade, Teilantwort-Grenze, Secret-/PII-/IP-Dokumentationsgrenzen und die Nicht-Ableitung eines Deployment-Go. Kein Deployment, keine Serveraenderung, keine SSH-Verbindung, keine Secret-Erstellung, keine produktiven Configs, keine neue API/Persistenz/Migration, keine Produktlogik und keine echten Daten.

### 5.166 - 2026-05-22
- B30 Hetzner-Preflight-Antwortübergabe ist Doku-/Vertragstest-only umgesetzt: `docs/deployment/B30_HETZNER_PREFLIGHT_ANSWER_HANDOFF.md` macht die B29-Operatorfragen als sichere Antwortübergabe mit Status `go`/`blocked`/`not assessed`, nicht-sensitiver Antwortnotiz und naechstem sicherem Schritt nutzbar.
- `entfernter Doku-Contract-Test` schuetzt konservative Default-Blockade, Teilantwort-Grenze, Secret-/PII-/IP-Dokumentationsgrenzen und die Nicht-Ableitung eines Deployment-Go. Kein Deployment, keine Serveraenderung, keine SSH-Verbindung, keine Secret-Erstellung, keine produktiven Configs, keine neue API/Persistenz/Migration, keine Produktlogik und keine echten Daten.

### 5.167 - 2026-05-22
- B31 Hetzner-Management-Entscheidungsliste ist Doku-/Vertragstest-only umgesetzt: `docs/deployment/B31_HETZNER_MANAGEMENT_DECISION_LIST.md` verdichtet B25-B29 in eine kurze, nicht-sensitive Management-Liste mit Status `go`/`blocked`/`not assessed` fuer Betreiber/Verantwortliche, Zugriffsschicht, Trusted-Header/Secret, TLS/Health, Stop/Rollback, Daten/PII/Retention/Backup und Sandbox/Worker/AV.
- `entfernter Doku-Contract-Test` schuetzt konservative Gesamtblockade bei offenen Mussgruppen, Teil-`go`-Grenze, Secret-/PII-/IP-/Serverdetail-Dokumentationsgrenzen und die Nicht-Ableitung eines Deployment-Go. Kein Deployment, keine Serveraenderung, keine SSH-Verbindung, keine Secret-Erstellung, keine produktiven Configs, keine neue API/Persistenz/Migration, keine Produktlogik und keine echten Daten.

### 5.168 - 2026-05-22
- P3-B33 Demo-Fixture-/Seed-Erwartung ist minimal gehaertet: `scripts/check-local-ops.sh` prueft im bestehenden lokalen Check jetzt zusaetzlich erwartete Demo-Anker fuer Intake-Request, Intake-Spec, Angebotsentwurf und Produktionsplan, bevor die vorhandenen read-only Export- und Auditbelege laufen.
- `tests/local-ops-check-contract.test.ts` schuetzt die Auffindbarkeit der vorhandenen Demo-Fixtures und Local-Check-Anker; `TESTING.md` benennt Start-, Intake-/Request-, Angebots-, Produktions- und Exportanker inklusive der relevanten Demo-IDs. Keine neuen Beispieldaten, keine echte Datenverarbeitung, keine neue API, keine Persistenz, kein Deployment und keine rechtssichere Audit-/Compliance-Behauptung.

### 5.169 - 2026-05-22
- P3-B34 Startseite als Beta-Kontrollzentrum ist minimal gehaertet: `backoffice-ui/src/App.tsx` zeigt auf der bestehenden Startseite einen knappen internen Beta-Kontrollzentrum-Hinweis fuer Demo, Erfassung, Angebot, Produktion, Export und Audit aus vorhandenen Daten.
- `tests/backoffice-route-smoke.test.ts` schuetzt den neuen Startseiten-Marker. Keine neue Dashboard-Welt, keine neue Datenquelle, keine API, Persistenz, Deployment, Login/OIDC oder echte Datenverarbeitung.

### 5.170 - 2026-05-22
- P3-B35 Angebot-Route fuer Beta-Durchlauf ist minimal gehaertet: `backoffice-ui/src/offer-workbench.tsx` zeigt in der bestehenden `/angebot`-Zusammenfassung einen knappen internen Beta-Schritt-Hinweis fuer Anfrage, Entwurf, Export und Uebergabe aus vorhandenen Daten.
- `tests/backoffice-route-smoke.test.ts` schuetzt den Marker im bestehenden Offer-Route-Smoke neben Anfrage-/Spec-Bezug, Entwurfsstatus, Exportanker und Produktionsuebergabe. Keine neue Angebotslogik, API, automatische Spec-Korrektur, Persistenz, Deployment, Login/OIDC oder echte Datenverarbeitung.

### 5.171 - 2026-05-22
- P3-B36 Produktion-Route fuer Beta-Durchlauf ist minimal gehaertet: `backoffice-ui/src/production-workbench.tsx` zeigt in der bestehenden `/produktion`-Zusammenfassung einen knappen internen Beta-Schritt-Hinweis fuer Produktion, Einkaufsliste, Exporte, Herkunft und offene Rueckfragen aus vorhandenen Daten.
- `tests/backoffice-production-acceptance-smoke.test.ts` schuetzt den Marker im bestehenden Production-Acceptance-Smoke neben vorhandenen Plan-, Einkauf-, Export-, Herkunfts- und Rueckfragenankern. Keine neue Produktionslogik, kein neuer Workflow, keine Rezept-/Allergenautomatik, keine API, Persistenz, Deployment, Login/OIDC oder echte Datenverarbeitung.

### 5.172 - 2026-05-22
- P3-B37 Upload-Grenzen als Beta-Risiko ist Doku-/Test-only sichtbar gemacht: TESTING und C8 benennen Intake-Limit 8 MiB/bis zu 3 Multipart-Dateien, Rezeptupload-Limit 5 MiB/genau eine Datei, erlaubten Dokumentkorridor PDF/TXT/MD/EML/Pages, kontrollierte Abweisung zu grosser/unerlaubter Dateien und die Blockade produktionsnaher echter/beliebiger Uploads ohne Sandbox/Worker/AV-Gate.
- `tests/pa14-document-ingestion-corridor-readiness.test.ts` schuetzt diese Marker zusammen mit vorhandenen Upload-/Ingestion-Grenzen; Rohtext- und Vollhash-Spiegelung bleiben ausgeschlossen. Keine Parser-/OCR-/LLM-Engine, keine API, Persistenz, Deployment, Login/OIDC oder echte Datenverarbeitung.

### 5.173 - 2026-05-22
- P3-B38 Echte-Daten-Stop-Gate ist Doku-/Test-only im Beta-Runbook verankert: `docs/product/C8_INTERNER_DEMO_DURCHLAUF_ABNAHMEWEG.md` und `TESTING.md` trennen Demo-/Seed-/synthetische Daten als erlaubten internen Beta-Korridor von echten Personen-/Kunden-/Einsatzdaten, die ohne entschiedenes PII/Retention/Backup-Gate und Sandbox/Worker/AV-Gate `blocked` bleiben.
- `tests/pa14-document-ingestion-corridor-readiness.test.ts` schuetzt den P3-B38-Marker und die Nicht-Ableitung lokaler Demo-/Upload-/Health-/Export-Gruensignale als Compliance-Freibrief. Keine echte Datenverarbeitung, keine API, Persistenz, Deployment, SSH, Secrets, Login/OIDC oder Compliance-/DSGVO-Freigabe.

### 5.174 - 2026-05-22
- P3-B39 Full Gates und Status-Snapshot ist No-Product-Change abgeschlossen: Der Plan-3-Zwischenstand wurde mit fokussierten P3-Smokes, `npm test`, `npm run build`, `npm audit --omit=dev`, `git diff --check` und `npm run local:status` verifiziert.
- Snapshot `docs/agent-memory/memory_v5.174_2026-05-22.md` haelt den verifizierten Stand fest. Keine Produktlogik, API, Persistenz, Deployment, SSH, Secrets, Login/OIDC oder echte Datenverarbeitung.

### 5.175 - 2026-05-22
- P4-B44 Read-only Status in `/produktion` ist umgesetzt: vorhandene `clarificationAnswers`, sofern sie im bestehenden Spec-/Projection-Read-Pfad mitgeliefert werden, werden in der bestehenden `ProductionConversationProjection` ausgewertet und in `/produktion` read-only als beantwortete Rueckfragen plus Antwort-Bubble sichtbar.
- Die kompakte Production-Workbench-Zusammenfassung nennt nun offene und beantwortete Rueckfragen getrennt; der Smoke-Test `tests/backoffice-production-acceptance-smoke.test.ts` schuetzt den beantworteten Statusanker. Keine neue API, Persistenz, Migration, Antwortbearbeitung, automatische Spec-Korrektur, Fachableitung, LLM-/Tool-Use-, Rezept-/Allergenlogik, Deployment, SSH, Secrets, Login/OIDC oder echte Datenverarbeitung.

### 5.176 - 2026-05-22
- P4-B45 synthetischer beantworteter Rueckfragen-Demoanker ist umgesetzt: `shared-core/src/fixtures/demo-scenarios.ts` und synchroner Runtime-Pfad `.js` liefern einen nicht-sensitiven Demoanker `spec-demo-production-answered-clarification` mit einer submitted `shortText`-Antwort.
- `tests/local-ops-check-contract.test.ts` schuetzt, dass dieser Anker ohne echte Daten in der bestehenden `ProductionConversationProjection` als beantwortete Rueckfrage plus Nutzerantwort projiziert wird. Keine neue API, Persistenz/Migration, Antwortbearbeitung, automatische Spec-Korrektur, Fachableitung, LLM-/Tool-Use-, Rezept-/Allergenlogik, Deployment, SSH, Secrets, Login/OIDC oder echte Datenverarbeitung.

### 5.177 - 2026-05-22
- P4-B46 Antwort-Fortsetzung im Conversation-Fluss ist umgesetzt: `shared-core/src/conversation-projection.ts` und synchroner Runtime-Pfad `.js` labeln bestehende strukturierte Rueckfragen deterministisch als beantwortet oder offen.
- `tests/pa25-clarification-answered-status-anchor.test.ts` schuetzt die geordnete Projection-Abfolge aus beantworteter Rueckfrage, Antwort-Bubble, offener Rueckfrage und Produktionsoutput-/Downloadanker. Keine neue Chat-/Agent-Runtime, Produktflaeche, API, Persistenz/Migration, automatische Spec-Korrektur, Fachableitung, LLM-/Tool-Use-, Rezept-/Allergenlogik, Deployment, SSH, Secrets, Login/OIDC oder echte Datenverarbeitung.

### 5.178 - 2026-05-22
- P4-B47 interner synthetischer Beta-Durchlauf fuer Rueckfragen ist Doku-/Test-only umgesetzt: `docs/product/C8_INTERNER_DEMO_DURCHLAUF_ABNAHMEWEG.md` und `TESTING.md` machen den synthetischen beantworteten Rueckfragenanker `spec-demo-production-answered-clarification` / `demo-production-answered-clarification` fuer lokale interne Demo-/Beta-Sicht auffindbar.
- `tests/local-ops-check-contract.test.ts` schuetzt die Dokumentationsauffindbarkeit der Labels `Agent fragt · offen` / `Agent fragt · beantwortet`, der read-only `user_structured_answer`-Antwort-Bubble und der Abgrenzung von Produktionsobjekten/Downloads als Ergebnis-/Exportanker. Keine neue Runtime, API, Persistenz/Migration, automatische Spec-Korrektur, Fachableitung, LLM-/Tool-Use-, Rezept-/Allergenlogik, Deployment, SSH, Secrets, Login/OIDC oder echte Datenverarbeitung.

### 5.179 - 2026-05-22
- P4-B48 Full Gates, Memory-Snapshot und naechster Nutzwertentscheid ist als No-Product-Change abgeschlossen: Plan 4 wurde mit fokussierten Clarification-/Production-/Local-Ops-Tests, `npm test`, `npm run build`, `npm audit --omit=dev`, `git diff --check` und kontrolliertem `npm run local:status` verifiziert.
- Snapshot `docs/agent-memory/memory_v5.179_2026-05-22.md` haelt den verifizierten Stand fest. Naechster Nutzwert liegt nicht in weiterem Clarification-Mikroausbau, sondern in einer bewussten Entscheidung fuer den naechsten kleinsten Produktwertblock ausserhalb des abgeschlossenen Plan-4-Strangs. Keine Produktlogik, API, Persistenz/Migration, automatische Spec-Korrektur, Fachableitung, LLM-/Tool-Use-, Rezept-/Allergenlogik, Deployment, SSH, Secrets, Login/OIDC oder echte Datenverarbeitung.

### 5.180 - 2026-05-22
- P5-B49 Beta-Durchlauf Ist-Karte ist Doku-/Vertragstest-only umgesetzt: `docs/product/P5_BETA_DURCHLAUF_IST_KARTE.md` kartiert den vorhandenen Nutzerweg `Start -> Angebot -> Produktion -> Exporte/Audit` und trennt intern nutzbar, nur dokumentiert / nur intern abnahmefaehig, blockiert und schon testbar.
- `entfernter Doku-Contract-Test` schuetzt die Auffindbarkeit aus README, TESTING und C8 sowie die Grenzen: keine Produktlogik, API, Persistenz, Migration, Deployment, SSH, echten Daten, OAuth/Login/OIDC, automatische Spec-Korrektur oder Rezept-/Allergenautomatik.

### 5.181 - 2026-05-22
- P5-B50 Startseite als Beta-Einstieg ist als kleiner UI-/Smoke-Baustein umgesetzt: `backoffice-ui/src/App.tsx` nennt auf der bestehenden Startseite nun explizit den Beta-Weg `Start -> Angebot -> Produktion -> Rueckfragen -> Exporte/Audit` und den naechsten Einstieg ueber Angebot, Produktion und offene Rueckfragen.
- `tests/backoffice-route-smoke.test.ts` schuetzt die sichtbaren Startseiten-Marker. Keine neue Dashboard-Welt, keine neue Datenquelle, keine API, Persistenz, Deployment, SSH, Secrets, echte Daten, Login/OIDC, automatische Spec-Korrektur oder Rezept-/Allergenautomatik.

### 5.182 - 2026-05-22
- P5-B51 `/angebot` Nutzerfuehrung fuer Entwurf und Uebergabe ist als kleiner UI-/Smoke-Baustein umgesetzt: `backoffice-ui/src/offer-workbench.tsx` nennt in der bestehenden Angebotszusammenfassung den naechsten Angebotsschritt Entwurf pruefen, Variante uebernehmen, Angebots-HTML exportieren und zur Produktion wechseln.
- `tests/backoffice-route-smoke.test.ts` schuetzt den sichtbaren Angebotsschritt im bestehenden Offer-Route-Smoke. Keine neue Angebotslogik, keine automatische Spec-Korrektur, keine API, Persistenz, Deployment, SSH, Secrets, echten Daten, Login/OIDC oder Rezept-/Allergenautomatik.

### 5.183 - 2026-05-22
- P5-B52 `/produktion` Nutzerfuehrung fuer den naechsten Schritt ist als kleiner UI-/Smoke-Baustein umgesetzt: `backoffice-ui/src/production-workbench.tsx` nennt in der bestehenden Produktionszusammenfassung den Beta-Pfad `Rueckfragen -> Ergebnisobjekte -> Exporte/Audit`.
- `tests/backoffice-production-acceptance-smoke.test.ts` schuetzt den sichtbaren Pfad im bestehenden Production-Acceptance-Smoke. Keine neue Produktionslogik, Produktflaeche, API, Persistenz, Deployment, SSH, Secrets, echten Daten, Login/OIDC, LLM-/Tool-Use-, Rezept-/Allergenautomatik oder automatische Spec-Korrektur.

### 5.184 - 2026-05-22
- P5-B53 Export-/Download-/Audit-Endpunkt des Beta-Durchlaufs ist als kleiner UI-/Smoke-Baustein umgesetzt: `backoffice-ui/src/App.tsx` nennt in der bestehenden `/produktion`-Abschlusszone Produktionsblatt, Einkaufsliste und Audit-Spur als interne Arbeitsbelege.
- `tests/backoffice-production-acceptance-smoke.test.ts` schuetzt den sichtbaren Beta-Endpunkt und die Grenze: fehlende Artefakte bleiben offen markiert; keine externe Freigabe, Signatur- oder Compliance-Behauptung. Keine Exportlogik, Auditlogik, neue API, Persistenz, Deployment, SSH, Secrets, echte Daten, Login/OIDC oder Signatur-/Compliance-Welt.

### 5.185 - 2026-05-22
- P5-B54 Manuelle Beta-Test-Checkliste fuer Alexander ist Doku-/Vertragstest-only umgesetzt: `docs/product/P5_B54_MANUELLE_BETA_TEST_CHECKLISTE.md` fuehrt lokal durch `Start -> Angebot -> Produktion -> Rueckfragen -> Exporte/Audit`, nennt URLs, sichtbare Marker, Stop-Gates, Nicht-Freigaben und den B12-Ergebnisvermerk.
- `entfernter Doku-Contract-Test` schuetzt die Auffindbarkeit aus README, TESTING, C8 und B12 sowie die Grenzen: keine neue QA-Plattform, Produktlogik, API, Persistenz, Deployment, SSH, Secrets, echte Daten, Login/OIDC, automatische Spec-Korrektur oder Rezept-/Allergenautomatik.

### 5.186 - 2026-05-23
- P5-B55 Full Gates und Nutzbarkeits-Lage ist als No-Product-Change abgeschlossen: Plan 5 wurde ueber fokussierte Beta-Smokes/Vertragstests, `npm test`, `npm run build`, `npm audit --omit=dev`, `git diff --check`, `npm run local:status` und `npm run local:check` verifiziert.
- Snapshot `docs/agent-memory/memory_v5.186_2026-05-23.md` haelt den verifizierten Stand fest. Intern nutzbar ist der lokale Beta-Korridor `Start -> Angebot -> Produktion -> Rueckfragen -> Exporte/Audit` mit Demo-/Seed-/synthetischen Daten, sichtbaren UI-Leitplanken, read-only Export-/Auditbelegen und manueller Checkliste. Offen/blockiert bleiben echte Daten, produktionsnahe Nutzung, Deployment, Auth/OIDC, PII/Retention/Backup, Sandbox/Worker/AV, neue Persistenz/API, automatische Spec-Korrektur sowie Rezept-/Allergenautomatik.

### 5.187 - 2026-05-23
- P6-B56 Beta-Onboarding-Iststand und Lueckenkarte ist Doku-/Vertragstest-only umgesetzt: `docs/product/P6_B56_BETA_ONBOARDING_ISTSTAND_LUECKENKARTE.md` buendelt Starten -> Durchlaufen -> Reibung notieren -> Stop-Gates, trennt intern testbar, nur synthetisch, blockiert und verboten, und benennt die naechsten Plan-6-Luecken.
- `entfernter Doku-Contract-Test` schuetzt die Auffindbarkeit aus README, TESTING, C8 und P5-B54 sowie die Grenzen: keine Produktlogik, UI-Aenderung, API, Persistenz, Deployment, SSH, Secrets, echten Daten, Login/OIDC, automatische Spec-Korrektur oder Rezept-/Allergenautomatik.

### 5.188 - 2026-05-23
- P6-B57 Lokaler Start-/Status-Korridor ist Doku-/Vertragstest-only umgesetzt: `docs/product/P6_B57_LOKALER_START_STATUS_KORRIDOR.md` buendelt Starten -> Status pruefen -> Betriebscheck -> UI-Routen oeffnen -> kontrolliert stoppen mit bestehenden Scripts, lokalen UI-/Health-URLs und sicherer Reaktion auf rote Status-/Check-Signale.
- `entfernter Doku-Contract-Test` schuetzt die Auffindbarkeit aus README, TESTING, C8 und P6-B56 sowie die Grenzen: keine Produktlogik, API, Persistenz, Betriebsplattform, Deployment, SSH, Secrets, echten Daten, Login/OIDC, Produktionsfreigabe oder rechtssichere Audit-/Compliance-Aussage.

### 5.189 - 2026-05-23
- P6-B58 Reibungslog fuer manuellen Beta-Durchlauf ist Doku-/Vertragstest-only umgesetzt: `docs/product/P6_B58_BETA_REIBUNGSLOG_VORLAGE.md` strukturiert sichere Reibungsnotizen fuer Start -> Angebot -> Produktion -> Rueckfragen -> Exporte/Audit mit Beobachtung, Route, Erwartung, tatsaechlichem Verhalten, Schweregrad, Screenshot-Hinweis ohne personenbezogene Daten und naechster Entscheidung.
- `entfernter Doku-Contract-Test` schuetzt die Auffindbarkeit aus README, TESTING, C8, P5-B54, P6-B56 und P6-B57 sowie die Grenzen: keine externe QA-Plattform, neue Produktlogik, API, Persistenz, Speicherung echter Nutzerdaten, echten Daten, Deployment, Auth/OIDC, automatische Spec-Korrektur oder Rezept-/Allergenautomatik.

### 5.190 - 2026-05-23
- P6-B59 UI-Grenzen fuer synthetischen Beta-Durchlauf ist als kleiner UI-/Smoke-Baustein umgesetzt: Startseite, `/angebot` und `/produktion` nennen sichtbar, dass der Durchlauf nur synthetisch/intern ist und keine echten Daten bzw. keine Produktionsfreigabe erlaubt.
- `tests/backoffice-route-smoke.test.ts` und `tests/backoffice-production-acceptance-smoke.test.ts` schuetzen die sichtbaren Grenzen. Keine neue Auth-, Daten-, Freigabe-, API-, Persistenz-, Deployment-, LLM-/Tool-Use-, Parser-/OCR-, automatische Spec-Korrektur- oder Rezept-/Allergenfunktion.

### 5.191 - 2026-05-23
- P6-B60 Rueckfragen-/Produktions-Reibung aus Betasicht ist als kleiner UI-/Smoke-Baustein umgesetzt: `backoffice-ui/src/production-workbench.tsx` nennt in der bestehenden `/produktion`-Zusammenfassung einen Beta-Pruefpunkt fuer Rueckfragenstatus, Produktionsobjekte und Export-/Auditanker.
- `tests/backoffice-production-acceptance-smoke.test.ts` schuetzt, dass offene Stop-Punkte als Stop statt Freigabe sichtbar bleiben. Keine automatische Spec-Korrektur, Rezept-/Allergenautomatik, neue API, Persistenz, Deployment, Auth/OIDC, LLM-/Tool-Use oder echte Datenverarbeitung.

### 5.192 - 2026-05-23
- P6-B61 Beta-Durchlauf als Management-Entscheidungsvorlage ist Doku-/Vertragstest-only umgesetzt: `docs/product/P6_B61_BETA_MANAGEMENT_ENTSCHEIDUNGSVORLAGE.md` verdichtet P6-B56 bis P6-B60 in sofort testbar, Stop-Gates, No-go, Alexanders Entscheidung und den naechsten engen Produktwertblock nur nach beobachteter Reibung.
- `entfernter Doku-Contract-Test` schuetzt die Auffindbarkeit aus README, TESTING, C8, P5-B54, P6-B56, P6-B57 und P6-B58 sowie die Grenze: kein weiterer Mikroausbau ohne beobachtete Reibung. Keine Produktlogik, UI-Aenderung, API, Persistenz, Deployment, echten Daten, Auth/OIDC, automatische Spec-Korrektur oder Rezept-/Allergenautomatik.

### 5.193 - 2026-05-23
- P6-B62 Full Gates und Plan-6-Lage ist als No-Product-Change abgeschlossen: Plan 6 wurde mit fokussierten P6-Smokes/Vertragstests, `npm test`, `npm run build`, `npm audit --omit=dev`, `git diff --check`, `npm run local:status` und `npm run local:check` verifiziert.
- Snapshot `docs/agent-memory/memory_v5.193_2026-05-23.md` haelt den verifizierten Plan-6-Stand fest. Lokal beta-testbar bleibt der synthetische interne Korridor `Start -> Angebot -> Produktion -> Rueckfragen -> Exporte/Audit` inklusive Start-/Status-Korridor, Reibungslog und Management-Entscheidungsvorlage. Offen/blockiert bleiben echte Reibungsdaten aus dem manuellen Beta-Durchlauf, echte Daten, produktionsnahe Nutzung, Deployment, Auth/OIDC, PII/Retention/Backup, Sandbox/Worker/AV, neue Persistenz/API, automatische Spec-Korrektur sowie Rezept-/Allergenautomatik.

### 5.194 - 2026-05-23
- P7-B67 Reibung-zu-Backlog-Triage ist Doku-/Vertragstest-only umgesetzt: `docs/product/P7_B67_REIBUNG_ZU_BACKLOG_TRIAGE.md` verbindet P6-B58-Reibungslog, P6-B61-Managementregel und P7-B65-Evidenzpaket zu einer kleinen Triage-Matrix fuer beobachtete Reibung.
- `entfernter Doku-Contract-Test` schuetzt Auffindbarkeit aus README, TESTING, P6-B58, P6-B61 und P7-B65 sowie die Grenze: keine Produktlogik, keine neue API/Persistenz, kein Deployment, keine echten Daten, keine Auth/OIDC, keine automatische Spec-Korrektur oder Rezept-/Allergenautomatik.
### 5.195 - 2026-05-23
- P7-B68 Full Gates und Plan-7-Lage ist als No-Product-Change abgeschlossen: Plan 7 wurde mit fokussierten P7-Vertragstests, `npm test`, `npm run build`, `npm audit --omit=dev`, `git diff --check`, `npm run local:status` und `npm run local:check` verifiziert.
- Snapshot `docs/agent-memory/memory_v5.195_2026-05-23.md` haelt den verifizierten Plan-7-Stand fest. Manuell rehearsable ist der synthetische interne Korridor `Start -> Angebot -> Produktion -> Rueckfragen -> Exporte/Audit` mit Startkarte, Szenariokarte, Evidenzpaket, UI-Orientierungsmarkern und Reibung-zu-Backlog-Triage. Weiterer Produktbau bleibt ohne beobachtete manuelle Reibung gestoppt; echte Daten, produktionsnahe Nutzung, Deployment, Auth/OIDC, PII/Retention/Backup, Sandbox/Worker/AV, neue Persistenz/API, automatische Spec-Korrektur und Rezept-/Allergenautomatik bleiben blockiert.

### 5.196 - 2026-05-23
- R2 synthetischer Beta-Rehearsal-Microfix ist umgesetzt: Nach strukturierten Antworten im `/produktion`-Korridor erzeugt `buildProductionClarificationQuestions` aus `readiness.status === "complete"` mit positivem Readiness-Hinweis keine scheinbar offene Rueckfrage mehr.
- `tests/pa16-production-clarification-model.test.ts` schuetzt die Regression. Ergebnisobjekte, Produktionsblatt-/Einkaufslisten-Exportanker und Audit-/Herkunftsanker bleiben im lokalen Rehearsal sichtbar. Offen bleibt die nicht beantwortbare Zeitfenster-Rueckfrage aus bestehender `event.schedule`-Uncertainty; deren Loesung benoetigt eine bewusste Produkt-/Datenmodellentscheidung.

### 5.197 - 2026-05-23
- R3 Schedule-/Zeitfenster-Entscheidungsvorlage ist Doku-/Vertragstest-only umgesetzt: `docs/product/R3_SCHEDULE_ZEITFENSTER_ENTSCHEIDUNGSVORLAGE.md` beschreibt fuer die Rueckfrage `Wie lautet das verbindliche Zeitfenster?` aus bestehender `event.schedule`-Uncertainty die Optionen A Copy-/Anleitung ohne Datenmodelländerung, B strukturierte Rueckfrage mit bestehender Spec-Patch-Bindung und C spaeteres eigenes Schedule-/Zeitfenster-Modell.
- `entfernter Doku-Contract-Test` schuetzt Existenz, Empfehlung und Grenzen der Vorlage. Empfohlen ist fuer den internen Beta-MVP konservativ Option A; Option B bleibt naechstes bewusstes Gate, Option C wird zurueckgestellt. Keine Runtime-Logik, API, Persistenz, Migration, UI-Feature-Umsetzung, automatische Spec-Korrektur, echte Datenverarbeitung, OAuth/Login/OIDC oder Deployment.

### 5.198 - 2026-05-23
- P8-N1 Option-A Copy-Anker im Produktions-Rehearsal ist als kleiner UI-/Smoke-Baustein umgesetzt: `backoffice-ui/src/production-workbench.tsx` nennt in der bestehenden `/produktion`-Zusammenfassung, dass das verbindliche Zeitfenster manuell zu klaeren und nur als Rehearsal-Notiz festzuhalten ist.
- `tests/backoffice-production-acceptance-smoke.test.ts` schuetzt den Marker inklusive Grenze `keine automatische event.schedule-Uebernahme`. Keine Runtime-Schedule-Logik, neue API, Persistenz/Migration, automatische Spec-Korrektur, echten Daten, Deployment, Login/OIDC oder Rezept-/Allergenautomatik.

### 5.199 - 2026-05-23
- P8-N2 Rehearsal-Checkliste fuer interne Testperson ist Doku-/Vertragstest-only geschaerft: `docs/product/P7_B63_REVIEWER_REHEARSAL_STARTKARTE.md`, `docs/product/P7_B64_SYNTHETISCHE_SZENARIO_UND_DATENKARTE.md` und `docs/product/P7_B65_EXPORT_AUDIT_ROUTE_EVIDENZPAKET.md` fuehren die interne Testperson jetzt durch die Option-A-Zeitfenstergrenze.
- `entfernter Doku-Contract-Test` schuetzt, dass das fiktive verbindliche Zeitfenster nur manuell als `Zeitfenster-Rehearsal-Notiz` im Evidenzpaket festgehalten wird, nicht automatisch in `event.schedule` uebernommen wird und keine Runtime-Loesung/Spec-Korrektur darstellt. Keine UI-Feature-Umsetzung, Runtime-Logik, API, Persistenz/Migration, echten Daten, Deployment/Login/OIDC oder Rezept-/Allergenautomatik.

### 5.200 - 2026-05-23
- P8-N3 Export-/Audit-Evidenz fuer Option A ist Doku-/Vertragstest-only geschaerft: `docs/product/P7_B65_EXPORT_AUDIT_ROUTE_EVIDENZPAKET.md` stellt klar, dass Export-/Auditbelege keine strukturierte Zeitfensterloesung beweisen und nicht als Nachweis gelesen werden duerfen, dass `event.schedule` fachlich strukturiert geloest ist.
- `entfernter Doku-Contract-Test` schuetzt die Grenze: `Zeitfenster-Rehearsal-Notiz` bleibt manuelle Copy-/Anleitungsnotiz; kein strukturiertes Schedule-/Zeitfenster-Datenmodell, keine Exportlogik, keine API/Persistenz/Migration, keine automatische oder halbautomatische Spec-Korrektur und keine echten Daten.

### 5.201 - 2026-05-23
- P8-N4 Local Ops / Smoke Robustheit nach Option A ist Doku-/Vertragstest-only geschaerft: `docs/product/C8_INTERNER_DEMO_DURCHLAUF_ABNAHMEWEG.md`, `TESTING.md` und `docs/product/P6_B57_LOKALER_START_STATUS_KORRIDOR.md` stellen klar, dass lokale Gruensignale aus `npm run local:status` und `npm run local:check` keine strukturierte Zeitfensterloesung belegen.
- `entfernter Doku-Contract-Test` schuetzt die Grenze: `Zeitfenster-Rehearsal-Notiz` bleibt manuelle Copy-/Anleitungsnotiz, keine automatische `event.schedule`-Uebernahme, kein Schedule-/Zeitfenster-Datenmodell; `scripts/check-local-ops.sh` bleibt auf bestehende Start-/Status-/Health-/Export-/Bootstrap-/Auditanker begrenzt und enthaelt keine Schedule-Verarbeitung. Keine Infra-/Deployment-Arbeit, API, Persistenz/Migration, automatische Spec-Korrektur oder echten Daten.

### 5.202 - 2026-05-23
- P8-N5 Abschlussgate / Memory Snapshot / Management-Lage ist als No-Product-Change abgeschlossen: Plan 8 wurde mit den vorhandenen P8-Vertragstests/Smokes, `npm test`, `npm run build`, `npm audit --omit=dev`, `git diff --check`, `npm run local:status`, `npm run local:check` und CI fuer den letzten Push verifiziert.
- Snapshot `docs/agent-memory/memory_v5.202_2026-05-23.md` haelt den Plan-8-Abschlussstand fest. Umgesetzt/dokumentiert ist die Option-A-Linie: verbindliches Zeitfenster bleibt fuer den internen Beta-MVP eine manuelle Copy-/Anleitungs- und Evidenznotiz. Offen als naechstes echtes Gate bleibt die bewusste Entscheidung, ob spaeter eine strukturierte Zeitfenster-/Schedule-Loesung mit Datenmodell/API/Persistenz/Runtime-Bindung gebaut wird; bis dahin bleiben echte Daten, produktionsnahe Nutzung, Deployment, Auth/OIDC, PII/Retention/Backup, Sandbox/Worker/AV, neue Persistenz/API, automatische Spec-Korrektur und Rezept-/Allergenautomatik blockiert.

### 5.203 - 2026-05-23
- P9-N1 Rehearsal-Nachweisrahmen ist Doku-/Vertragstest-only konsolidiert: `docs/product/P9_N1_LOKALER_REHEARSAL_NACHWEISRAHMEN.md` verlinkt C8, P6-B57, P6-B58, P7-B63/B64/B65/B67 und die Plan-8-Option-A-Grenze als lokalen Nachweisindex.
- `entfernter Doku-Contract-Test` schuetzt Auffindbarkeit aus README, TESTING und C8 sowie die klare Trennung: lokal/synthetisch gruen bleibt eng auf Demo-/Seed-/read-only Arbeitsbelege begrenzt; echte Daten, Produktionsfreigabe und Compliance bleiben blocked. Keine Produktlogik, UI, API, Persistenz, Deployment oder echte Daten.

### 5.204 - 2026-05-23
- P9-N2 Rehearsal-Gate-Bindung ist docs-/script-contract-only geschaerft: `docs/product/P9_N1_LOKALER_REHEARSAL_NACHWEISRAHMEN.md`, C8 und TESTING binden `npm run local:status`, `npm run local:check`, manuelle UI-Routen, Evidence-Paket und Reibungslog zu einer gemeinsamen Nachweiskette gegen Scheingruenheit.
- `scripts/check-local-ops.sh` gibt nach erfolgreichem Check eine explizite Grenze aus; `entfernter Doku-Contract-Test` schuetzt, dass isolierte lokale Gruensignale kein Rehearsal-Go, keine Produktionsfreigabe, keine echten Daten und keine rechtssichere Audit-/Compliance-Aussage bedeuten. Keine neue API, Persistenz, Deployment, Runtime-Services oder Produktlogik.

### 5.205 - 2026-05-23
- P9-N3 Rehearsal-Reibung-zu-Entscheidung ist Doku-/Vertragstest-only geschaerft: `docs/product/P7_B67_REIBUNG_ZU_BACKLOG_TRIAGE.md` ordnet jede Rehearsal-Beobachtung zusaetzlich den vier Ergebnisankern `go`, `fix`, `blocked` oder `decision needed` zu.
- `docs/product/P6_B61_BETA_MANAGEMENT_ENTSCHEIDUNGSVORLAGE.md`, `docs/product/P6_B58_BETA_REIBUNGSLOG_VORLAGE.md` und TESTING sind darauf ausgerichtet; `entfernter Doku-Contract-Test` schuetzt die Copy-Anker, die Unterscheidung zwischen kleinem Fix, Stop-Gate und Alexander-Entscheidung sowie die Grenze: keine Produktentscheidung, kein neuer Workflow, keine automatische Ticket-/Backlog-/QA-Plattform, keine API/Persistenz/Deployment/echten Daten.

### 5.206 - 2026-05-23
- P9-N4 UI-Lesbarkeit ist als kleiner Startseiten-Copy-/Smoke-Fix umgesetzt: `/` zeigt nun `Rehearsal-Go: erst nach grünem Status, lokalem Check, manueller UI-Evidenz und Reibungslog.` direkt im vorhandenen Beta-Kontrollzentrum.
- `tests/backoffice-route-smoke.test.ts` schuetzt den Marker. Der Fix adressiert den aus P9-N1 bis P9-N3 sichtbaren engen Missverstaendnispunkt, dass UI-/Smoke-Anker allein als Rehearsal-Go gelesen werden koennten. Keine neue Produktflaeche, kein UI-Neubau, keine API/Persistenz, keine echten Daten, keine Produktionsfreigabe und keine automatische Rehearsal-Auswertung.
### 5.207 - 2026-05-23
- P9-N5 Abschlussgate / Memory Snapshot / Management-Lage ist als No-Product-Change abgeschlossen: Plan 9 wurde mit fokussierten P9-Vertragstests/Smokes, `npm test`, `npm run build`, `npm audit --omit=dev`, `git diff --check`, `npm run local:status` und `npm run local:check` verifiziert; CI konnte lokal nicht geprueft werden, weil `gh` nicht authentifiziert ist.
- Snapshot `docs/agent-memory/memory_v5.207_2026-05-23.md` haelt den Plan-9-Abschlussstand fest. Besser ist der lokale synthetische Rehearsal-Nachweis: Nachweisrahmen, Gate-Bindung, Reibung-zu-Entscheidung und Startseiten-Copy trennen klarer zwischen lokalem Rehearsal-Go, kleinem Fix, blocked und decision needed. Offen/blockiert bleiben echte Daten, produktionsnahe Nutzung, Deployment, Auth/OIDC, PII/Retention/Backup, Sandbox/Worker/AV, neue Persistenz/API, automatische Spec-Korrektur, strukturierte Schedule-Loesung sowie Rezept-/Allergenautomatik.

### 5.208 - 2026-05-23
- P10-N5 Abschlussgate / Evidence-Paket / Management-Lage ist als No-Product-Change abgeschlossen: Plan 10 wurde als realer synthetischer Beta-Rehearsal-Durchlauf mit vorhandenem lokalen Stack, manueller UI-/DOM-Evidenz fuer `/`, `/angebot` und `/produktion`, read-only Export-/Auditbelegen, `npm run local:status`, `npm run local:check`, `npm test`, `npm run build`, `npm audit --omit=dev` und `git diff --check` verifiziert.
- Kein Produktfix wurde umgesetzt, weil aus P10-N1 bis P10-N4 keine neue enge scope-sichere Reibung uebrig blieb. Rehearsal-Triage: `go` fuer den lokalen synthetischen Korridor; `decision needed` nur, falls Alexander spaeter eine strukturierte Zeitfenster-/Schedule-Loesung jenseits von Option A will. Echte Daten, produktionsnahe Nutzung, Deployment, Auth/OIDC, PII/Retention/Backup, Sandbox/Worker/AV, neue Persistenz/API, automatische Spec-Korrektur und Rezept-/Allergenautomatik bleiben blockiert.
### 5.209 - 2026-05-23
- R4 Schedule-/Zeitfenster-Entscheidungsrecord ist als Management-Entscheidung dokumentiert: `docs/product/R4_SCHEDULE_OPTION_A_DECISION_RECORD.md` bestaetigt Option A fuer den aktuellen internen Beta-MVP. Das verbindliche Zeitfenster bleibt manuelle Klaerungs-/Anleitungslinie; keine strukturierte Schedule-/Zeitfenster-Runtime, keine Spec-Patch-Bindung, kein eigenes Schedule-Datenmodell, keine API/Persistenz/Migration und keine automatische Spec-Korrektur werden jetzt freigegeben.
- Plan 10 bleibt als lokal/synthetisch gruener Rehearsal-Abschluss stehen, aber nicht als Go fuer echte Daten, produktionsnahe Nutzung, externe Nutzung oder Deployment. Der empfohlene naechste Pfad ist Plan 11 als konservativer Preflight-/Entscheidungskorridor fuer einen begrenzten internen Pilot mit anonymisierten/synthetischen Daten gemaess B24, ohne Deployment, Secrets, Auth-Implementierung, neue API oder Persistenz.

### 5.210 - 2026-05-24
- P11-N3 Interner Nutzerkreis und Zugriffskontext ist Doku-/Vertragstest-only umgesetzt: `docs/product/P11_N3_INTERNER_PILOT_PREFLIGHT_RUNBOOK.md` leitet aus B24, PA7/PA8/PA9 und B8/B9 nicht-sensitive Entscheidungspunkte fuer Nutzerkreis, Betreiber, Trusted-Actor-Kontext und Zugriffskontrolle ab.
- `entfernter Doku-Contract-Test` schuetzt die Grenzen: lokales Rehearsal-Go ist kein Pilot-/Auth-/Deployment-Go; Login/OIDC/Session/Auth, Proxy/IAP-Code, Deployment, Secrets, neue Rollenplattform, neue API/Persistenz, echte Daten und Compliance-Freigabe bleiben Stop-Gates.

### 5.211 - 2026-05-24
- P11-N4 UI-/Smoke-Lesbarkeit ist als kleiner Startseiten-Copy-/Smoke-Fix umgesetzt: `/` nennt im bestehenden Beta-Kontrollzentrum nun explizit `Pilot-Preflight: lokal mit Demo-/synthetischen oder nachweisbar anonymisierten Daten pruefen; kein Pilot-Go, kein Deployment und keine echten Daten.`
- `tests/backoffice-route-smoke.test.ts` schuetzt den Marker. Der Fix adressiert die beobachtete Reibung, dass die bestehende UI zwar Beta-/Rehearsal-Grenzen zeigte, den neuen Plan-11-Pilot-Preflight aber nicht sichtbar von Pilot-Go/Deployment/echten Daten trennte. Keine neue Produktflaeche, kein Workflow, keine Fachlogik, API, Persistenz/Migration, Auth/OIDC, Deployment oder echte Daten.

### 5.212 - 2026-05-24
- P11-N5 Abschlussgate / Memory Snapshot / 10/10-Lage ist als No-Product-Change abgeschlossen: Plan 11 wurde ueber den fokussierten P11-/UI-Korridor, `npm test`, `npm run build`, `npm audit --omit=dev`, `git diff --check`, `npm run local:status` und `npm run local:check` verifiziert; CI fuer den letzten Push konnte lokal nicht ueber `gh` geprueft werden, weil GitHub CLI nicht authentifiziert ist.
- Snapshot `docs/agent-memory/memory_v5.212_2026-05-24.md` haelt den Plan-11-Abschlussstand fest. Umgesetzt bzw. dokumentiert sind Pilot-Datenkorridor, Pilot-Preflight-Runbook und sichtbarer Startseiten-Pilot-Preflight-Marker; offen/entscheidungspflichtig bleibt ein echter begrenzter interner Pilot-Go mit nicht-sensitivem Nutzerkreis-, Betreiber-/Zugriffskontext-, Datenrahmen- und Nachweisentscheid. Blockiert bleiben echte Daten, produktionsnahe Nutzung, Deployment, Auth/OIDC, PII/Retention/Backup, Sandbox/Worker/AV, neue API/Persistenz, Runtime-Schedule und Rezept-/Allergenautomatik.

### 5.213 - 2026-05-24
- P11-N6 Plan-12-Ableitung ist Doku-/Vertragstest-only umgesetzt: `docs/plans/hans-night-build-plan-12-internal-pilot-go-no-go-decision-2026-05-24.md` ist startbereit und leitet den naechsten echten Bottleneck aus Plan 11 ab: ein nicht-sensitives Management-Go/No-Go-Entscheidungspaket fuer echten begrenzten internen Pilot vs. bewussten Stop.
- `entfernter Doku-Contract-Test` schuetzt, dass Plan 12 keine Pilotdurchfuehrung startet, die Status-Trennung lokal Preflight `go` / echter begrenzter Pilot `not assessed` / produktionsnah echte Daten `blocked` erhaelt und keine Deployment-, Auth-, API-, Persistenz-, echte-Daten-, Compliance- oder Runtime-Schedule-Gates ueberschreitet.

### 5.214 - 2026-05-24
- P12-N2 Management-Go/No-Go-Entscheidungspaket ist Doku-/Vertragstest-only umgesetzt: `docs/product/P12_N2_MANAGEMENT_GO_NO_GO_ENTSCHEIDUNGSPAKET.md` verdichtet die offenen Plan-11-Pilotentscheidungen in nicht-sensitive Pflichtfelder fuer Nutzerkreis, fachlichen Betreiber, technischen Betreiber, Zugriffskontext, Datenrahmen, Anonymisierungs-/Synthetiknachweis, Nachweis, Stop-Verantwortung und finale Bewertung.
- `entfernter Doku-Contract-Test` schuetzt die Status-Trennung: lokaler Preflight `go`, echter begrenzter interner Pilot bis zur bewussten Managemententscheidung `not assessed`, echte/produktive Daten und produktionsnahe Nutzung `blocked`. Keine Runtime-, UI-, API-, Persistenz-, Deployment-, Auth-, Secret-, Daten-, Schedule- oder Compliance-Aenderung und kein Pilotstart.

### 5.215 - 2026-05-24
- P12-N3 Preflight-Scheingruenheitsgrenze ist als schmaler Vertragstest geschaerft: `entfernter Doku-Contract-Test` prueft ueber P11-N1, P11-N3 und P12-N2 hinweg, dass lokale Gruensignale aus Status, Check, UI, Export oder Audit kein Pilot-Go und kein Management-Go ersetzen.
- Der echte begrenzte interne Pilot bleibt ohne Alexanders bewusste Managemententscheidung `not assessed`; echte Daten, produktionsnahe Nutzung, Deployment/Auth/Secrets, neue API/Persistenz/Migration, Runtime-Schedule und automatische Spec-Korrektur bleiben `blocked` bzw. ausser Scope. Keine Produktflaeche, UI-, API-, Persistenz-, Deployment-, Auth-, Daten-, Schedule- oder Compliance-Aenderung.

### 5.216 - 2026-05-24
- P13 Option-B echter-Daten-Hetzner-Readiness ist als Doku-/Vertragstest-only Plan vorbereitet: `docs/plans/hans-night-build-plan-13-option-b-real-data-hetzner-readiness-2026-05-24.md` nimmt Alexanders Entscheidung fuer Option B auf: Hetzner Server, nur Berechtigte, echte Daten, The ONE e.K. als technischer Betreiber, Dokumentation lieber vollstaendig und Stop-Verantwortung Alexander.
- `entfernter Doku-Contract-Test` schuetzt, dass daraus kein stilles Deployment- oder echte-Daten-Go entsteht: Zugriffsschutz, direkte Service-Exposition, Trusted-Header/Secret-Grenze, B13 PII/Retention/Backup, B14 Sandbox/Worker/AV, Evidence ohne PII/Secrets und Recht/DSGVO bleiben Mussgruppen fuer P13-N1. Kein Deployment, keine SSH-Verbindung, keine Serveraenderung, keine Secrets, keine echte Datenverarbeitung, keine neue API/Persistenz/Migration und keine Compliance-Freigabe.

### 5.217 - 2026-05-24
- P13-N1 / B32 Option-B echter-Daten-Hetzner-Readiness ist Doku-/Vertragstest-only umgesetzt: `docs/deployment/B32_OPTION_B_REAL_DATA_HETZNER_READINESS.md` fuehrt Alexanders Option-B-Entscheidung in eine nicht-sensitive Mussgruppenliste fuer Betreiber, Zugriffsschutz, direkte Service-Exposition, Trusted-Header/Secret-Grenze, Datenkategorien/PII-Scope, Speicherort/Systemgrenze, Retention/Loeschung, Backup/Restore, Export/Audit/Logs, Uploads/Sandbox/AV, Evidence und Recht/DSGVO/AVV ueber.
- `entfernter Doku-Contract-Test` schuetzt die Grenzen: kein Deployment-Go, kein echte-Daten-Go, kein Zugriffsschutz nur durch "kein oeffentlicher Link", Evidence ohne PII/Secrets/IPs/Hostnamen/produktive Logs und vorbereitende Umsetzung nur nach separatem Go. Keine SSH-Verbindung, keine Serveraenderung, keine Secret-Erstellung, keine echte Datenverarbeitung, keine neue API/Persistenz/Migration und keine Compliance-Freigabe.

### 5.218 - 2026-05-24
- P13-N2 / B33 Option-B Abschluss- und Folgeentscheidung ist Doku-/Vertragstest-only umgesetzt: `docs/deployment/B33_OPTION_B_FOLLOWUP_DECISION.md` bewertet den Stand nach B32 als `decision needed`: kein `go fuer vorbereitende Umsetzung`, aber auch kein `blocked` als Produktabbruch, weil Option B als Zielrichtung weiter moeglich bleibt.
- `entfernter Doku-Contract-Test` schuetzt, dass Alexanders "go" nur P13-N2 startet und nicht als Deployment-Go, echte-Daten-Go oder SSH-Go gilt. Offen bleiben Zugriffsschicht, direkte Service-Exposition, Trusted-Header/Secret-Grenze, B13 echte-Daten-Entscheid, B14 Upload-Entscheid, Evidence-Regeln und Recht/DSGVO/AVV. Kein Serverzugriff, keine Secrets, keine echten Daten, keine produktive ENV, keine neue API/Persistenz/Migration und keine Compliance-Freigabe.

### 5.219 - 2026-05-24
- B34 Option-B Pilot-Gate-Entscheidungen ist Doku-/Vertragstest-only umgesetzt: `docs/deployment/B34_OPTION_B_PILOT_GATE_DECISIONS.md` dokumentiert Alexanders Entscheidungen mit Hans' Risikobegrenzungen als `preparation decision go`: Tailscale/VPN-only, keine direkte Service-Exposition, zunaechst Einzelzugriff Alexander, spaeter serverseitiger Trusted-Kontext, echter Kunden-/Event-/Angebots-/Produktionsdaten-Scope, Hetzner-App-Systemgrenze, 90 Tage Retention, begrenztes Backup mit noch offener konkreter Retention, eingeschraenkte Logs/Audit-Regel und echte Uploads erst nach B14-Sicherheitsgate.
- `entfernter Doku-Contract-Test` schuetzt, dass 9B/10C nicht als breite Freigaben gelesen werden: technische Logs ohne unnoetige Rohdaten/PII, keine produktiven Logauszuege in Evidence, echte Uploads `blocked until B14 go`; kein Deployment-Go, echte-Daten-Start-Go, SSH-Go, Serverzugriff, echte-Upload-Go, neue API/Persistenz/Migration oder Compliance-/DSGVO-Freigabe.

### 5.220 - 2026-05-24
- B35 Option-B Vorbereitungskorridor ohne sensible Werte ist Doku-/Vertragstest-only umgesetzt: `docs/deployment/B35_OPTION_B_PREPARATION_BOUNDARY.md` definiert nach B34 nur den nicht-sensitiven Vorbereitungskorridor fuer Gate-Konsistenz, Tailscale/VPN-only als Zieltyp, Ausschluss direkter Service-Exposition, Trusted-Header-Grenze, Evidence-Regeln, offene Backup-Retention und Upload-Blockade bis B14.
- `entfernter Doku-Contract-Test` schuetzt, dass B35 kein Serverlauf, Deployment-Go, SSH-Go, keine Serveraenderung, keine Secret-/produktive-ENV-Erstellung, keine echten Daten, keine echten Uploads und keine Compliance-/DSGVO-Freigabe ist. Der naechste sinnvolle Schritt bleibt entweder Backup-Retention entscheiden oder ein separater technischer Vorbereitungsplan ohne sensible Werte.

### 5.221 - 2026-05-24
- B36 Backup-Retention-Entscheidungsanker fuer Option-B-Pilot ist Doku-/Vertragstest-only umgesetzt: `docs/deployment/B36_BACKUP_RETENTION_DECISION.md` macht die Backup-Retention als Managemententscheidung dokumentierbar, vergleicht 7 Tage, 14 Tage und 30 Tage und empfiehlt 14 Tage als Pilot-Default, sofern Alexander nichts anderes entscheidet.
- `entfernter Doku-Contract-Test` schuetzt die Grenze: keine Backup-Aktivierung, keine Restore-Tests, keine Serverzugriffe, kein Deployment-Go, kein Echtdaten-Go, keine echten Uploads, keine Secrets, keine produktive ENV, keine IPs/Hostnames, keine produktiven Logs, keine neue API/Persistenz/Migration und keine Compliance-/DSGVO-Freigabe.

### 5.222 - 2026-05-24
- B37 Nicht-sensitiver technischer Vorbereitungsplan fuer Option-B-Pilot ist Doku-/Vertragstest-only umgesetzt: `docs/deployment/B37_NONSENSITIVE_TECHNICAL_PREPARATION_PLAN.md` bringt den spaeteren technischen Vorbereitungslauf in eine reine nicht-sensitive Arbeitsreihenfolge fuer Gate-Konsistenz B25-B37/B13/B14/PA9/B9/TESTING, Tailscale/VPN-only als Zugriffsschutz-Typ, Nicht-Exposition, Trusted-Header-Grenze, Evidence-Regeln, Backup-Retention und Upload-Blockade.
- `entfernter Doku-Contract-Test` schuetzt die Grenze: kein Deployment-Go, kein SSH-Go, keine Serveraenderung, keine Secret-/ENV-Erstellung, kein Echtdatenstart, keine Backup-Aktivierung, keine echten Uploads, keine neue API/Persistenz/Migration und keine Compliance-/DSGVO-/AVV-Freigabe.

### 5.223 - 2026-05-24
- P4 Frontend-Smoke-Navigation ist als echter Testcode-Slice umgesetzt: `tests/backoffice-route-smoke.test.ts` prueft sichtbare Startseiten-Einstiege/Nav-Links und Route-Cards auf die erwarteten Ziele `/angebot` und `/produktion`.
- Der Smoke rendert danach die Zielrouten und prueft stabile Angebots- und Produktionsmarker; keine App-Code-Aenderung war noetig, keine neue Produktlogik, API, Persistenz, UI-Neugestaltung oder neue Browser-Test-Infrastruktur.

### 5.224 - 2026-05-24
- P4 Produktions-Export-/Audit-Abschlussanker ist als kleiner UI-/Smoke-Slice umgesetzt: `/produktion` zeigt in der bestehenden Herkunft-und-Uebergabe-Zone einen read-only `Abschluss-Kontext` aus vorhandener `planId`, `specId` und `purchaseListId`.
- `tests/backoffice-production-acceptance-smoke.test.ts` schuetzt mit vorhandenem Produktionsplan, Einkaufsliste und Audit-Ereignis, dass Export-/Downloadanker, Audit-Spur und Abschluss-Kontext aus demselben sichtbaren Plan-/Einkaufskontext nachvollziehbar bleiben. Keine neue API, Persistenz, Exportlogik, Compliance-Behauptung oder Produktflaeche.

### 5.225 - 2026-05-24
- P4 Produktions-Empty-State-Klarheit ist als kleiner UI-/Smoke-Slice umgesetzt: Ohne vorhandene Produktionsobjekte zeigt die `ProductionConversationalWorkbench` im Produktionsobjekt-Anker `Produktionsplan berechnen` und markiert Plan, Einkaufsliste und Exportlinks als noch nicht vorhanden/offen.
- `tests/backoffice-production-acceptance-smoke.test.ts` schuetzt den klaren Spec-ohne-Plan-Zustand gegen Scheingruenheit: keine Download-/Bereit-Aussagen, keine Exportlinks und keine vorhandene Produktionsblatt-/Einkaufsliste-Behauptung. Keine automatische Planerzeugung, Exportlogik, API, Persistenz oder Freigabe-/Compliance-Behauptung.

### 5.226 - 2026-05-24
- P4 Angebots-Empty-State-Klarheit ist als kleiner UI-/Smoke-Slice umgesetzt: Ohne fokussierten Entwurf zeigt die `OfferConversationalWorkbench` `Export/Freigabe: noch kein Entwurf, kein Exportartefakt und keine Freigabe vorhanden`.
- `tests/backoffice-route-smoke.test.ts` schuetzt den leeren `/angebot`-Zustand: Anfrage einfuegen/Entwurf erzeugen bleibt naechster Schritt, keine Angebots-HTML-/Export-/Freigabe-Behauptung, Beta-Grenze gegen echte Kundendaten sowie externe, Produktions- und Compliance-Freigabe bleibt sichtbar. Keine neue Angebots-/Exportlogik, API, Persistenz oder Freigabe.

### 5.227 - 2026-05-24
- P4 Startseiten-Audit-/Handoff-Grenze ist als kleiner UI-/Smoke-Slice umgesetzt: Die bestehende Startseiten-Änderungsprotokoll-Zone nennt Audit-/Handoff-Hinweise nun als interne Arbeitsbelege fuer Demo-/Beta-Pruefung.
- `tests/backoffice-route-smoke.test.ts` schuetzt den Marker mit einem vorhandenen Audit-Fixture gegen Scheingruenheit: keine externe Freigabe, keine Produktionsfreigabe, keine echte-Daten-Freigabe und kein rechtssicherer Compliance-Nachweis. Keine neue Auditlogik, API, Persistenz, Exportlogik, UI-Neugestaltung oder Compliance-Behauptung.

### 5.228 - 2026-05-25
- Produktziel-Anker ist als Repo-Vertrag nachgezogen: `docs/product/PRODUKTZIEL_CATERING_AGENTS_PLATFORM.md` ist in README und TESTING auffindbar und benennt die interne Catering-Arbeitsplattform, den Zielpfad `Intake -> Angebot -> Produktion -> Rueckfragen -> Exporte/Audit`, den kontrollierten MVP-/Beta-Korridor und die Blockaden fuer externe Nutzung, echte Multi-Tenant-Plattform, produktionsnahe echte Daten, Auth/OIDC, neue Persistenz/API und Deployment ohne gesonderte Gates.
- `entfernter Doku-Contract-Test` schuetzt Zielanker, Arbeitsmodus, Reifegrade und Auffindbarkeit aus README, TESTING und memory.md. Keine Produktlogik, UI, API, Persistenz, Deployment, Auth/OIDC, echte Daten, LLM-/Tool-Use-Ausbau, automatische Spec-Korrektur oder Rezept-/Allergenautomatik.

### 5.229 - 2026-05-25
- Browser-Rehearsal gegen den lokalen Stack hat den Pfad Start -> Angebot -> Produktion -> Rueckfragen -> Exporte/Audit mit Demo-/synthetischen Daten sichtbar bestaetigt; belegte Reibung war ein aufgefuellter lokaler Datenbestand durch wiederholte Rehearsal-/Demo-Nutzung, nicht ein fehlender UI-Kernanker.
- `scripts/check-local-ops.sh` gibt nun einen nicht-destruktiven Rehearsal-Datenhinweis aus, wenn Specs/Entwuerfe/Plaene deutlich ueber dem kleinen Demo-Korridor liegen; `tests/local-ops-check-contract.test.ts`, README, TESTING und C8 schuetzen, dass dies kein rotes Gate, kein sauberer Frischlauf und keine automatische Loeschung/Archivierung ist. Keine Produktlogik, API, Persistenz, Migration, UI-Neubau, Deployment, Auth/OIDC, echte Daten oder Datenbereinigung.

### 5.230 - 2026-05-25
- Startseiten-Ladezustand ist als kleiner UI-/Smoke-Fix gegen Scheingruenheit gehaertet: Die Home-Kennzahlen zeigen beim initial leeren Laden nun Lade-/Noch-nicht-bewertet-Texte statt `0`/`unbekannt` als scheinbaren Datenbefund.
- `tests/backoffice-route-smoke.test.ts` schuetzt den initialen Pending-Fetch-Zustand und den geladenen Home-Ueberblick getrennt. Keine Datenlogik, API, Persistenz, Seed-/Loeschpfad, neue Produktflaeche, Deployment, Auth/OIDC oder echte Daten.

### 5.231 - 2026-05-25
- Produktions-Zusammenfassung ist als kleiner UI-/Smoke-Fix gegen widerspruechlichen Vorgangskontext gehaertet: Wenn Produktionsplaene sichtbar sind, aber noch keine Spezifikation aktiv fokussiert ist, zeigt `/produktion` nun `Plan-Kontext geladen: ... · Spezifikation noch nicht im Fokus` statt `Noch kein aktiver Vorgang`.
- `tests/backoffice-production-acceptance-smoke.test.ts` schuetzt diesen Plan-ohne-Spec-Fokus-Fallback. Keine Planungslogik, Antwortverarbeitung, API, Persistenz, Datenmodell-, Rezept-/Allergenlogik, Deployment, Auth/OIDC oder echte Daten.

### 5.232 - 2026-05-25
- Produktions-Eingangsaktion ist als kleiner UI-/Smoke-Fix entschaerft: Der bisher generische `Löschen`-Button heisst nun `Arbeitsbereich leeren` und ist nur aktiv, wenn ein lokaler Upload-/Analyse-, Spezifikations- oder Plan-Kontext im Produktionsarbeitsbereich vorhanden ist.
- `tests/backoffice-production-acceptance-smoke.test.ts` schuetzt, dass der Button im leeren Produktionskontext deaktiviert bleibt. Keine Backend-Loeschung, keine Archivierung, keine Upload-Verarbeitung, API, Persistenz, Migration, Datenmodell-, Rezept-/Allergenlogik, Deployment, Auth/OIDC oder echte Daten.

### 5.233 - 2026-05-25
- Produktions-Rueckfragenaktion ist als kleiner UI-/Smoke-Fix entschaerft: Wenn der Antworteditor fuer den fokussierten Produktionsvorgang bereits automatisch offen ist, bleibt `Antworten bearbeiten` sichtbar, wird aber deaktiviert, statt denselben Editor erneut zu oeffnen.
- `tests/backoffice-production-acceptance-smoke.test.ts` schuetzt den Auto-Open-Zustand mit sichtbarer strukturierter Antwort und deaktivierter Reopen-Aktion. Keine Aenderung an Readiness, Rueckfragenlogik, Planerzeugung, API, Persistenz, Datenmodell-, Rezept-/Allergenlogik, Deployment, Auth/OIDC oder echte Daten.

### 5.234 - 2026-05-25
- Produktions-Antwortspeichern ist als kleiner UI-/Smoke-Fix gegen Scheinspeichern gehaertet: Der fokussierte Antworteditor vergleicht seine Felder mit der geladenen Spezifikation und deaktiviert `Antworten speichern`, solange keine echte Aenderung vorliegt.
- `tests/backoffice-production-acceptance-smoke.test.ts` schuetzt den unveraenderten Auto-Open-Zustand mit deaktivierter Reopen- und Speichern-Aktion; `Speichern und Berechnung starten` bleibt als Produktionsnaechstschritt unveraendert. Keine Aenderung an Auto-Open, Readiness, Rueckfragenmodell, Planerzeugung, API, Persistenz, Datenmodell-, Rezept-/Allergenlogik, Deployment, Auth/OIDC oder echte Daten.

### 5.235 - 2026-05-25
- Produktionsplanung behandelt eindeutig Brot/Baguette/Brot/Baguette-/Brotkorb-/Broetchen-Komponenten ohne manuelle Herstellungsentscheidung nun als klaren Baecker-Zukauf und fuehrt sie direkt als Beschaffung statt als Rezeptsuche oder Herstellungs-Klaerung.
- `tests/production-plan-fallbacks.test.ts` schuetzt den engen Pfad gegen Rezeptsuche und gegen falsches Gruen bei `gluten_free`: Glutenfrei+Brot-Baguette bleibt blockierend und erzeugt keine Einkaufsposition. Keine Aenderung an Focaccia/Hybridfaellen, kreativem Rezept-Matching, Normalisierung, API, Persistenz, Datenmodell, Deployment, Auth/OIDC oder echten Daten.

### 5.236 - 2026-05-25
- C9 Fehlupload-Archiv-/Loeschentscheidung ist als Doku-/Vertragstest-only Entscheidungsvorlage umgesetzt: `docs/product/C9_FEHLUPLOAD_ARCHIV_LOESCH_ENTSCHEIDUNG.md` trennt UI-Fokus leeren von backend-seitiger Archivierung/Loeschung und bereitet die Alexander-Entscheidung fuer Option B Soft-Archiv aus aktivem Arbeitsfokus vor.
- `entfernter Doku-Contract-Test` schuetzte zunaechst Option A Status quo als sicheren Default, Option B Soft-Archiv als empfohlene naechste Implementierungsentscheidung nach explizitem Go und Option C Hard-Delete als nicht naechsten MVP-Slice. Dieser Stand ist durch 5.263 als umgesetzt fortgeschrieben.

### 5.237 - 2026-05-25
- Rezept-Matching fuer haeufige Buffet-Sprache ist als kleiner Kernfluss-Fix gehaertet: `NUDELSALAT | FRISCHGEDÖNS` kann jetzt ein internes `Pasta-Salat`-Rezept als denselben Catering-Rezeptanker finden, ohne in Web-/Fallback-Rezeptsuche zu fallen.
- `tests/platform.test.ts` schuetzt den Fall mit intern hochgeladenem `Pasta-Salat mit frischem Gemuese`; `shared-core/src/recipe-library.*` und `production-service/src/recipe-discovery/service.ts` ergaenzen nur enge Nudelsalat/Pasta-Salat- und Kartoffelsalat/Potato-Salad-Synonym-/Compound-Tokens. Keine neue Rezeptengine, keine LLM-/Tool-Orchestrierung, keine API, Persistenz, Migration, Allergenautomatik, Deployment, Auth/OIDC oder echte Daten.

### 5.238 - 2026-05-25
- Der Quick-Lunch-Rezeptanker fuer `KARTOFFELSALAT | DE LUX` ist als weiterer kleiner Matching-Smoke abgesichert: Ein internes `Potato Salad with Herbs`-Rezept wird als passender interner Rezeptanker gefunden und bleibt ohne Web-/Fallback-Rezeptsuche.
- `tests/platform.test.ts` schuetzt diesen zweiten haeufigen Buffetfall auf derselben engen Synonym-/Compound-Grenze. Keine neue Rezeptengine, keine LLM-/Tool-Orchestrierung, keine API, Persistenz, Migration, Allergenautomatik, Deployment, Auth/OIDC, Google-Drive-Echtdaten oder echte Daten.

### 5.239 - 2026-05-25
- Der Quick-Lunch-Rezeptanker fuer `KALBSBULETTEN | SCHMORZWIEBELN` und `KALBSFRIKADELLEN | SCHMORZWIEBELN` ist als weiterer kleiner Matching-Smoke abgesichert: Ein internes `Veal Meatballs with Braised Onions`-Rezept wird als passender interner Rezeptanker gefunden und bleibt ohne Web-/Fallback-Rezeptsuche.
- `tests/platform.test.ts` schuetzt beide deutschen Angebotsformulierungen gegen ein englisches internes Meatballs-Rezept; `shared-core/src/recipe-library.*` und `production-service/src/recipe-discovery/service.ts` ergaenzen nur enge Kalbsbuletten/Kalbsfrikadellen/Buletten/Frikadellen/Meatballs-Synonym-Tokens. Keine neue Rezeptengine, keine LLM-/Tool-Orchestrierung, keine API, Persistenz, Migration, Allergenautomatik, Deployment, Auth/OIDC, Google-Drive-Echtdaten oder echte Daten.

### 5.240 - 2026-05-25
- Der synthetische Quick-Lunch-Gesamt-Smoke ist ergaenzt: Das vorhandene strukturierte Lunch-Angebot laeuft mit internen Rezeptankern fuer Kalbsbuletten, Kartoffelsalat, Nudelsalat, Kraut-Karottensalat, Mandel-Curry, Zucchini/Pilze/Zuckerschoten/Baby-Pak-Choi, Wildkraeutersalat und veganen Schokoladenkuchen sowie implizitem Baecker-Zukauf fuer `BROT & BAGUETTE` durch den Produktionsplan.
- `tests/platform.test.ts` schuetzt damit erstmals die zuvor einzeln gehaerteten Quick-Lunch-Anker als zusammenhaengenden synthetischen Buffet-Durchlauf. Der Test wurde ohne weitere Runtime-Logikänderung gruen. Keine echten Angebote, kein Google Drive, keine neue Rezeptengine, keine LLM-/Tool-Orchestrierung, keine API, Persistenz, Migration, Allergenautomatik, Deployment, Auth/OIDC oder echte Daten.

### 5.241 - 2026-05-25
- Die Produktions-UI ist gegen den synthetischen Quick-Lunch-Mischplan abgesichert: `tests/backoffice-production-acceptance-smoke.test.ts` zeigt interne Rezepttreffer, `BROT & BAGUETTE` als Baecker-Zukauf, Einkaufsliste, Exportanker und Abschlusskontext als einen aktuellen Vorgang.
- Beim UI-Smoke wurde eine falsche Rueckfrage-Reibung gefunden und klein behoben: `backoffice-ui/src/production-language.ts` behandelt klare Brot/Baguette/Brotkorb/Broetchen-Faelle ohne `gluten_free` wie die Planung als impliziten Baecker-Zukauf; `tests/production-language.test.ts` schuetzt, dass `gluten_free` weiterhin klaerungspflichtig bleibt. Keine API, Persistenz, Migration, Backend-Planungslogik, neue Rezeptengine, LLM-/Tool-Orchestrierung, Deployment, Auth/OIDC, Google-Drive-Echtdaten oder echte Daten.

### 5.242 - 2026-05-25
- Browser-Rehearsal gegen den lokalen Quick-Lunch-Mischplan bestaetigt: `/produktion` fokussiert den synthetischen Vorgang `spec-zzzz-browser-rehearsal-quick-lunch-1779713127572`, zeigt Plan-/Einkaufskontext, interne Rezeptanker, `BROT & BAGUETTE` ohne Herstellungs-/Kategorie-Fehlfrage, `Offene Punkte: keine` im Plan und sichtbare Exportanker.
- Exportpfade sind fuer diesen Vorgang erreichbar: Produktionsplan-HTML und Einkaufsliste-CSV liefern HTTP 200. Reibungen bleiben bewusst offen: `local:check` meldet aufgefuellten lokalen Datenbestand statt Frischlauf, und die CSV enthaelt aus synthetischen Rezeptimporten faelschlich Arbeitsschritt-Zeilen wie `Mix veal, breadcrumbs and eggs.` als Einkaufspositionen. Keine echte Kundendatenprobe, keine Google-Drive-Nutzung, keine neue API/Persistenz, keine Schedule-Runtime, keine Deployment-/Auth-/Compliance-Freigabe.

### 5.243 - 2026-05-25
- Rezeptimport-/Einkaufslistenqualitaet ist als kleiner Shared-Core-Fix gehaertet: `Preparation`/`Directions` werden als Zubereitungsabschnitt erkannt, Rezeptabschnitts-Ueberschriften und offensichtlich durchgerutschte Schrittzeilen werden nicht mehr als Zutaten geparst.
- `tests/platform.test.ts` schuetzt direkt, dass ein Quick-Lunch-artiger englischer Rezeptimport nur echte Zutaten enthaelt, und im synthetischen Quick-Lunch-Gesamt-Smoke, dass Einkaufslisten keine Schrittpositionen wie `Mix veal, breadcrumbs and eggs.` oder `Boil potatoes.` enthalten. Keine neue Rezeptengine, keine LLM-/Tool-Orchestrierung, keine API/Persistenz/Migration, keine echten Daten, keine Schedule-Runtime, kein Deployment/Auth/Compliance-Go.

### 5.244 - 2026-05-25
- Produktions-UI-Wartbarkeit ist mit einem verhaltensgleichen Mini-Refactor verbessert: Die read-only Karte `Spezifikationsdetails` wurde aus `backoffice-ui/src/App.tsx` in `backoffice-ui/src/production-spec-details.tsx` extrahiert.
- `tests/backoffice-production-acceptance-smoke.test.ts` und `npm run build` bleiben gruen; Texte, DOM-Marker, Datenfluss und vorhandene Smoke-Erwartungen bleiben unveraendert. Keine UI-Neugestaltung, keine Produktlogik, keine API/Persistenz/Migration, keine Rezeptlogik, keine echten Daten, kein Deployment/Auth/Compliance-Go.

### 5.245 - 2026-05-25
- Guardrail-Check fuer etwas groessere autonome Codebloecke bestaetigt: Mehr zusammenhaengender Code ist innerhalb des vorhandenen internen MVP-Korridors vertretbar, wenn er UI-/Kernfluss-Stabilitaet, Wartbarkeit oder Testbarkeit direkt staerkt und ohne neue API, Persistenz, echte Daten, Deployment, Auth, Compliance-Behauptung, LLM-/Tool-Orchestrierung oder automatische Spec-/Schedule-Korrektur bleibt.
- Produktions-UI-Wartbarkeit ist mit einem zweiten verhaltensgleichen Refactor-Schnitt verbessert: Die aktuelle Plan-Download-/Offene-Punkte-Zusammenfassung wurde aus `backoffice-ui/src/App.tsx` in `backoffice-ui/src/production-plan-download-card.tsx` extrahiert; sekundäre Details und Auswahlzustand bleiben bewusst noch in `App.tsx`. `tests/backoffice-production-acceptance-smoke.test.ts`, `tests/backoffice-route-smoke.test.ts` und `npm run build` bleiben gruen.

### 5.246 - 2026-05-25
- Produktions-UI-Wartbarkeit ist mit einem dritten verhaltensgleichen Refactor-Schnitt verbessert: Die Einkaufslisten-/Downloadzone inklusive kompakter Positionsvorschau und älterer Einkaufslisten wurde aus `backoffice-ui/src/App.tsx` in `backoffice-ui/src/production-purchase-list-panel.tsx` extrahiert.
- `tests/backoffice-production-acceptance-smoke.test.ts`, `tests/backoffice-route-smoke.test.ts` und `npm run build` bleiben gruen; Exportlinks, `purchaseListId`-/`specId`-Marker, Leerzustand und Preview-Texte bleiben unveraendert. Keine Einkaufslistenlogik, Exportlogik, API/Persistenz/Migration, UI-Neugestaltung, echten Daten oder Deployment/Auth/Compliance-Aenderung.

### 5.247 - 2026-05-25
- Produktions-UI-Wartbarkeit ist mit einem vierten verhaltensgleichen Refactor-Schnitt verbessert: Die wiederverwendbare Produktionsplanliste liegt in `backoffice-ui/src/production-plan-list.tsx`, und die sekundären Plan-Details `Ältere Läufe, Rezeptauswahl und Arbeitsblätter` liegen in `backoffice-ui/src/production-plan-secondary-details.tsx`.
- `backoffice-ui/src/App.tsx` behält nur Auswahlzustand und Datenübergabe; aktuelle Planliste, ältere Läufe, Suchspur, Qualitäts-/Passungsanzeige und Arbeitsblattliste bleiben textlich und strukturell unverändert. `tests/backoffice-production-acceptance-smoke.test.ts`, `tests/backoffice-route-smoke.test.ts` und `npm run build` bleiben gruen. Keine neue UI, keine Exportlogik, keine API/Persistenz/Migration, keine Planungs-/Rezeptlogik, keine echten Daten oder Deployment/Auth/Compliance-Aenderung.

### 5.248 - 2026-05-25
- Produktions-UI-Wartbarkeit ist mit einem fünften verhaltensgleichen Refactor-Schnitt verbessert: Der Produktions-Eingabe-/Upload-/Text-/Manuellbereich wurde aus `backoffice-ui/src/App.tsx` in `backoffice-ui/src/production-input-panel.tsx` extrahiert.
- `App.tsx` behält Upload-, Drag-and-drop-, Submit- und State-Handler; die neue Komponente rendert nur bestehende Controls, Fortschrittsanzeige und Texte. `App.tsx` liegt danach bei ca. 2940 Zeilen. `tests/backoffice-production-acceptance-smoke.test.ts`, `tests/backoffice-route-smoke.test.ts` und `npm run build` bleiben gruen. Keine Upload-/Backend-Logik, keine API/Persistenz/Migration, keine echte Datenverarbeitung, keine neue UI-Flaeche und kein Deployment/Auth/Compliance-Go.

### 5.249 - 2026-05-25
- Nach den Quick-Lunch-Fixes und Produktions-UI-Refactor-Schnitten ist die komplette Testmatrix erneut gruen: `npm test` meldet 96 Testdateien und 445 Tests bestanden.
- Relevante laengere Tests liefen mit: `tests/platform.test.ts`, `tests/document-text.test.ts`, `tests/backoffice-production-acceptance-smoke.test.ts`, `tests/backoffice-route-smoke.test.ts`, `tests/backoffice-internal-usage-smoke.test.ts` und alle Architektur-/Gate-Vertragstests. Kein Commit, kein Deploy, keine echten Daten und keine Gate-Entscheidung dadurch ersetzt.

### 5.250 - 2026-05-25
- C10 Current Worktree PR Slices und ProductionAgent 10/10 Coding Architecture sind als Fokusanker fuer den weiteren Baupfad ergaenzt: `docs/product/C10_CURRENT_WORKTREE_PR_SLICES.md` sortiert den uncommitted Arbeitsbaum in vier reviewbare Slices, und `docs/architecture/PRODUCTION_AGENT_10_10_CODING_ARCHITECTURE.md` beschreibt den Pfad von deterministischem Produktionskern ueber LLM-Readiness ohne LLM bis zu spaeterem kontrollierten internen LLM-Einsatz.
- `entfernter Doku-Contract-Test` schuetzt Auffindbarkeit, Level 7/8/8.5/9/9.5/10, Modulgrenzen, ProviderAdapter, Prompt-/Schema-Registry, Tool-Registry, Eval-Harness, ConversationSession-Gate und sichere Defaults. Keine Runtime-Implementierung, kein LLM-Provider-Call, keine echten Daten, keine neue API, keine Persistenz/Migration, kein Deployment und keine Gate-Entscheidung dadurch ersetzt.

### 5.251 - 2026-05-25
- Produktions-UI-Wartbarkeit ist mit einem weiteren verhaltensgleichen Refactor-Schnitt verbessert: Der Rueckfragen-/Antwortbereich inklusive read-only ConversationSession-Projektion, strukturiertem Antworteditor, Intake-Quellenanker und Vorgangswechsel liegt nun in `backoffice-ui/src/production-question-panel.tsx`.
- `backoffice-ui/src/App.tsx` behaelt weiterhin Auswahlzustand, Editor-State und bestehende Handler; die neue Komponente rendert nur vorhandene Controls, Texte und Marker. `App.tsx` liegt danach bei 2374 Zeilen. `tests/backoffice-production-acceptance-smoke.test.ts`, `tests/backoffice-route-smoke.test.ts` und `npm run build` bleiben gruen. Keine Rueckfragenmodell-, Antwortspeicher-, Planungs-, Rezept-, API-, Persistenz-/Migrations-, LLM-, Echtdaten-, Deployment-, Auth- oder Compliance-Aenderung.

### 5.252 - 2026-05-25
- Produktions-UI-Wartbarkeit ist mit einem weiteren verhaltensgleichen Refactor-Schnitt verbessert: Die Produktionsobjekte-/Planungszone mit Planfortschritt, aktuellem Vorgang, Planliste, Downloadkarte und sekundären Plan-Details liegt nun in `backoffice-ui/src/production-objects-panel.tsx`.
- `backoffice-ui/src/App.tsx` behaelt weiterhin Planerzeugung, Auswahlzustand, Fortschritts-State und bestehende Handler; die neue Komponente rendert nur vorhandene Controls, Texte und Marker. `App.tsx` liegt danach bei 2292 Zeilen. `tests/backoffice-production-acceptance-smoke.test.ts`, `tests/backoffice-route-smoke.test.ts` und `npm run build` bleiben gruen. Keine Planungs-, Rezept-, Einkaufslisten-, Export-, API-, Persistenz-/Migrations-, LLM-, Echtdaten-, Deployment-, Auth- oder Compliance-Aenderung.

### 5.253 - 2026-05-25
- Produktions-UI-Wartbarkeit ist mit zwei weiteren verhaltensgleichen Refactor-Schnitten verbessert: Die Abschluss-/Handoff-Zone liegt nun in `backoffice-ui/src/production-handoff-panel.tsx`, und Rezeptpruefung/Rezeptbibliothek liegen nun in `backoffice-ui/src/production-recipe-library-panel.tsx`.
- `backoffice-ui/src/App.tsx` behaelt weiterhin Handoff-Label-Berechnung, Rezeptupload-/Review-Handler, Auswahl- und Eingabe-State; die neuen Komponenten rendern nur vorhandene Controls, Texte und Marker. `App.tsx` liegt danach bei 2163 Zeilen. `tests/backoffice-production-acceptance-smoke.test.ts`, `tests/backoffice-route-smoke.test.ts` und `npm run build` bleiben gruen. Keine Rezeptimport-, Rezeptmatching-, Review-, Export-, API-, Persistenz-/Migrations-, LLM-, Echtdaten-, Deployment-, Auth- oder Compliance-Aenderung.

### 5.254 - 2026-05-25
- C10 Worktree-Sortierung ist fuer den aktuellen uncommitted Stand reviewfaehiger gemacht: `docs/product/C10_CURRENT_WORKTREE_PR_SLICES.md` enthaelt nun den Git-Status-Snapshot, Cross-Slice-Dateien, Nicht-stagen-Grenze fuer `tmp/`, Staging-Hinweise fuer `README.md`/`TESTING.md`/`memory.md` und `App.tsx`, aktuelle Testzahlen 97/453 sowie die `App.tsx`-Wartbarkeitsmarke 2163 Zeilen.
- `entfernter Doku-Contract-Test` schuetzt die aktualisierte C10-Sortierung inklusive vollstaendigem Produktions-UI-Refactor-Slice und sicherer Nicht-Freigabe. Kein Commit, kein PR, kein Deploy, keine neue Runtime, keine API/Persistenz/Migration, kein LLM und keine echten Daten.

### 5.255 - 2026-05-25
- Zweiter synthetischer Catering-Durchlauf ist als Produktionskern-Regression ergaenzt: `tests/platform.test.ts` prueft nun einen Empfang/Flying-Bites-Plan fuer 75 Personen mit Mini-Quiche, Hummus-Gemuese-Cups, Tomaten-Mozzarella-Spiesse und Brownie-Bites gegen interne Rezeptanker.
- Der Test schuetzt `reception`/`standing_reception`, strukturierte Kategoriezuordnung fuer vegane/vegetarische Komponenten, interne Rezepttreffer ohne Internet-Fallback, keine offenen Punkte, Plan-/Kitchen-Sheet-Erzeugung und Einkaufslisten ohne durchgerutschte Zubereitungsschritte. Die globale Intake-Constraint-Logik fuer Woerter wie `vegan` wurde bewusst nicht veraendert; der synthetische Test setzt Kategorien strukturiert. Keine UI-, API-, Persistenz-/Migrations-, LLM-, Echtdaten-, Deployment-, Auth- oder Compliance-Aenderung.

### 5.256 - 2026-05-25
- Blockweise Diät-/Kategorie-Scope ist als kleiner Produktionskern-Fix gehaertet: vegane/vegetarische Speisenlabels wie `Hummus-Gemuese-Cups vegan`, `Tomaten-Mozzarella-Spiesse vegetarisch`, `SCHOKOLADENKUCHEN | vegan` und Angebotsanteile wie `VEGAN | 20%` werden nicht mehr automatisch als Event-weite harte `productionConstraints` gelesen.
- `shared-core/src/intake-signals.*` unterscheidet request-level Formulierungen wie `Bitte vegan`, `veganes Buffet` oder Allergie-/Ohne-Hinweise weiterhin von komponentenlokalen Diätlabels. `tests/intake-normalization-robustness.test.ts` und `tests/platform.test.ts` schuetzen den gemischten Quick-Lunch- und Flying-Bites-Pfad gegen globale Vegan-Leaks. Keine neue Rezeptengine, keine Allergenautomatik, keine Datenmodell-/API-/Persistenz-/Migrationsaenderung, keine echten Daten, kein LLM, Deployment, Auth/OIDC oder Compliance-Go.

### 5.257 - 2026-05-25
- Produktions-UI-Wartbarkeit ist mit einem weiteren verhaltensgleichen Refactor-Schnitt verbessert: Der Produktionsroute-Filter-/Bestandsblock `Suche und Bestand` liegt nun in `backoffice-ui/src/production-route-filter-panel.tsx`.
- `backoffice-ui/src/App.tsx` behaelt Suchzustand, Statusberechnung und Datenquellen; die neue Komponente rendert nur vorhandene Texte, Counts, Statuskarten und Suchfeld. `App.tsx` liegt danach bei 2134 Zeilen. Keine Suchlogik-, Daten-, API-, Persistenz-/Migrations-, Rezept-, LLM-, Echtdaten-, Deployment-, Auth- oder Compliance-Aenderung.

### 5.258 - 2026-05-25
- Produktions-UI-Stale-Fokus ist als kleiner Rehearsal-Friction-Fix gehaertet: Aktueller Vorgang, sekundäre ältere Produktionsläufe und ältere Einkaufslisten sagen nun explizit, dass ältere geladene Läufe getrennt bleiben und nicht als aktueller Vorgang gelesen werden dürfen.
- `tests/backoffice-production-acceptance-smoke.test.ts` schuetzt den Fall mit aktuellem Plan plus älterem Plan/Einkaufsliste gegen stille Kontextvermischung. Keine API-, Persistenz-/Migrations-, Upload-Loesch-/Archivierungs-, Rezept-, LLM-, Echtdaten-, Deployment-, Auth- oder Compliance-Aenderung.

### 5.259 - 2026-05-25
- Produktions-UI-Wartbarkeit ist mit einem weiteren verhaltensgleichen Layout-Schnitt verbessert: Die verschachtelte Produktions-Workbench-Komposition liegt nun in `backoffice-ui/src/production-route-main-layout.tsx`.
- `backoffice-ui/src/App.tsx` stellt weiterhin alle vorhandenen Panel-Props und Handler bereit; die neue Komponente ordnet nur die bestehenden Produktionsspalten in derselben Reihenfolge. Keine UI-Text-, Fachlogik-, API-, Persistenz-/Migrations-, Upload-, Rezept-, LLM-, Echtdaten-, Deployment-, Auth- oder Compliance-Aenderung.

### 5.260 - 2026-05-25
- Rezept-Matching ist um einen engen Catering-Anker gehaertet: `Auberginenröllchen mit Ricotta` findet ein internes englisches `Eggplant Ricotta Rolls`-Rezept ueber schmale Aubergine/Eggplant- und Röllchen/Rolls-Synonyme.
- `tests/platform.test.ts` schuetzt den vegetarischen Einzelspeisenfall ohne Internet-Fallback und ohne offene Produktionspunkte. Keine neue Matching-Engine, keine API-, Persistenz-/Migrations-, LLM-, Echtdaten-, Deployment-, Auth- oder Compliance-Aenderung.

### 5.261 - 2026-05-25
- Die Autonomiegrenze ist im Produktziel und in der ProductionAgent-10/10-Coding-Architektur praezisiert: Codex/Hans darf kleine, lokale, reviewbare, testbare und reversible Slices autonom bauen, wenn sie den internen MVP-/Rehearsal-Korridor staerken und keine harte Gate-Grenze beruehren.
- Weiter entscheidungspflichtig bleiben echte Daten/Google-Drive-Angebote, produktionsnahe Uploads, Auth/OIDC/IAP/Proxy, PII/Retention/Backup/Restore, Sandbox/Worker/AV, Deployment, neue API/Persistenz/Migration, echte ConversationSession-Runtime, LLM-Provider/Secrets/Kosten/Logging/Datenuebertragung und Write-Tools mit produktionsrelevanter Wirkung. Keine Runtime-Implementierung, kein LLM, keine echten Daten und keine Gate-Freigabe.

### 5.262 - 2026-05-25
- Dritter synthetischer Produktionskern-Durchlauf ist als Kaffeepausen-Smoke ergaenzt: `tests/platform.test.ts` prueft Meeting/Kaffeepause fuer 48 Personen mit Filterkaffee Station, Mini-Muffins Blaubeere, Obstspiesse vegan und Croissants.
- Der Test schuetzt `coffee_break`, interne Rezeptanker fuer Kaffee/Muffins/Obstspiesse, Fertigprodukt-Zukauf fuer Croissants, keine Internet-Fallbacks, keine offenen Produktionspunkte, drei Produktionsbatches plus vier Kitchen-Sheets und Einkaufslisten ohne durchgerutschte Zubereitungsschritte. Rezept-Matching wurde nur um enge Blaubeere/Blueberry- und Obstspiesse/Fruit-Skewers-Aliase gehaertet, inklusive Shared-Core-JS-Paritaet. Keine neue Matching-Engine, keine API/Persistenz/Migration, kein LLM, keine echten Daten, kein Deployment/Auth/Compliance-Go.

### 5.263 - 2026-05-26
- C9 Option B ist nach explizitem Go als enger Soft-Archiv-Slice umgesetzt: `POST /v1/intake/requests/:requestId/archive` markiert falsche interne/synthetische Intake-Kontexte als `operationalArchive`, nimmt sie aus aktiven `requests`-/`specs`-Listen und haelt Detailpfade plus `includeArchived=true` fuer interne Nachvollziehbarkeit offen.
- Der Pfad markiert den `EventRequest` und die per `sourceLineage.reference` verbundenen `AcceptedEventSpec`, protokolliert `intake.request_soft_archived`, erlaubt nur kontrollierte Reason-Codes und gibt `hardDeleted: false` zurueck. `tests/intake-soft-archive.test.ts`, `tests/access-control.test.ts`, `tests/p1-role-guards.test.ts` und C9/README/TESTING sind aktualisiert. Kein Hard-Delete, keine neue Persistenzwelt/Migration, keine echten Daten/Uploads, keine Retention-/Backup-/Restore-, Sandbox-/AV-, Deployment-, Auth- oder Compliance-Freigabe.

### 5.264 - 2026-05-26
- C9 Soft-Archiv ist in `/produktion` als enger UI-Pfad bedienbar: Der fokussierte verknuepfte Intake-Kontext kann ueber `Fehlupload archivieren` an den bestehenden `POST /v1/intake/requests/:requestId/archive`-Endpunkt uebergeben und aus dem aktiven Arbeitsfokus genommen werden.
- `tests/backoffice-production-acceptance-smoke.test.ts` schuetzt die aktive Archiv-Aktion, den deaktivierten Zustand ohne verknuepften Intake-Kontext, den `wrong_upload`-Reason-Code, das sichtbare Soft-Archiv-Feedback und die Grenze gegen `Loeschen`. C9/README/TESTING sind fortgeschrieben. Keine neue API, keine neue Persistenz/Migration, kein Hard-Delete, keine echten Daten/Uploads, kein Deployment, kein Auth/OIDC und keine Retention-/Compliance-Freigabe.

### 5.265 - 2026-05-26
- Produktionssuche und aktiver Vorgang sind als kleiner UI-Fokusfix gehaertet: In `/produktion` bevorzugt der aktive Produktionskontext bei aktiver Suche nur noch Spezifikationen aus dem gefilterten Trefferraum, statt einen zuvor fokussierten, nicht mehr passenden Vorgang weiter vorzuziehen.
- Der echte lokale Browser-Rehearsal bestaetigte nach Stack-Neustart: gefilterter synthetischer Fehlupload wird aktiv, `Fehlupload archivieren` ruft den C9-Soft-Archiv-Endpunkt mit HTTP 200 auf, der Vorgang verschwindet aus aktiven Listen/Fokus und bleibt ueber Detailpfad/`includeArchived=true` nachvollziehbar. `tests/backoffice-production-acceptance-smoke.test.ts` schuetzt den Fokuswechsel vor Archivierung. Keine API-/Persistenz-/Migrations-, Fachlogik-, Hard-Delete-, Echtdaten-, Deployment-, Auth/OIDC- oder Compliance-Aenderung.

### 5.266 - 2026-05-26
- Produktions-Empty-Focus ist als kleiner UI-Konsistenzfix gehaertet: Wenn `/produktion` keinen fokussierten Produktionsvorgang hat, werden keine scheinbar offenen Rueckfragen mehr an die Workbench gegeben.
- `tests/backoffice-production-acceptance-smoke.test.ts` schuetzt den leeren Zustand nach Soft-Archiv und den Zustand ohne Upload/Produktionskontext mit `Rueckfragen: keine offenen Rueckfragen` und `offen 0 · beantwortet 0`. Keine Aenderung an Fragegenerierung fuer echte Spezifikationen, API, Persistenz, Planung, Rezeptlogik, echte Daten, Deployment, Auth/OIDC oder Compliance.

### 5.267 - 2026-05-26
- Produktionsplanung schuetzt Focaccia ohne Herstellungsentscheidung als Human-in-the-loop-Hybridfall: Der Plan bleibt blockierend, erzeugt keine Einkaufsposition, startet keine Rezeptsuche und nennt explizit, dass Eigenproduktion, Baecker-Zukauf, Convenience-Zukauf oder Fertigprodukt bewusst entschieden werden muessen.
- `tests/production-plan-fallbacks.test.ts` ergaenzt den Focaccia-Regressionsfall neben Brot/Baguette und gluten_free. Keine Aenderung an UI, Rezept-Matching allgemein, API, Persistenz, Datenmodell, echten Daten, Deployment, Auth/OIDC, LLM oder Compliance-Gates.

### 5.268 - 2026-05-26
- Produktions-Workbench-Sprache ist an den Focaccia-HITL-Guard angeglichen: Focaccia ohne Herstellungsentscheidung erzeugt eine spezifische Hybridfall-Rueckfrage statt der generischen Herstellungsentscheidung.
- `tests/production-language.test.ts` schuetzt diese UI-Sprachregel. Keine Backend-Planungs-, Rezept-, API-, Persistenz-, Datenmodell-, Echtdaten-, Deployment-, Auth/OIDC-, LLM- oder Compliance-Aenderung.

### 5.269 - 2026-05-26
- Produktions-UI-Wartbarkeit ist mit einem kleinen verhaltensgleichen Refactor verbessert: Die Fokuswahl der Produktionsroute wurde aus `App.tsx` in `backoffice-ui/src/production-route-state.ts` als pure Funktion extrahiert.
- `tests/production-route-state.test.ts` schuetzt geloeschten Arbeitsbereich, suchgebundenen Fokus auf gefilterte Specs und den bisherigen Fallback ohne aktive Suche. Keine UI-Text-, Suchverhaltens-, Archivierungs-, API-, Persistenz-, Planungs-, Rezept-, Echtdaten-, Deployment-, Auth/OIDC-, LLM- oder Compliance-Aenderung.

### 5.270 - 2026-05-26
- Produktions-UI-Wartbarkeit ist mit einem weiteren verhaltensgleichen Selector-Refactor verbessert: aktuelle und archivierte Produktionsplaene/Einkaufslisten werden ueber `selectCurrentProductionItems` und `selectArchivedProductionItems` getrennt statt direkt in `App.tsx`.
- `tests/production-route-state.test.ts` schuetzt fokussierte Spec-Splits, geleerten Arbeitsbereich und den bisherigen unscoped Fallback ohne fokussierte Spezifikation. Keine Rendering-, Text-, Such-, Archivierungs-, API-, Persistenz-, Planungs-, Rezept-, Echtdaten-, Deployment-, Auth/OIDC-, LLM- oder Compliance-Aenderung.

### 5.271 - 2026-05-26
- Produktions-UI-Wartbarkeit ist mit einem weiteren verhaltensgleichen Route-State-Refactor verbessert: naechster Produktionsschritt, aktives Kontextlabel und `Arbeitsbereich leeren`-Aktivierbarkeit werden in `production-route-state.ts` als pure Helper berechnet statt direkt in `App.tsx`.
- `tests/production-route-state.test.ts` schuetzt die bestehende Next-Step-Reihenfolge, Kontextlabel fuer aktive Spec/Plan/Leerzustand und alle bisherigen Clear-Workspace-Bedingungen. Keine Rendering-, Text-, Such-, Archivierungs-, API-, Persistenz-, Planungs-, Rezept-, Echtdaten-, Deployment-, Auth/OIDC-, LLM- oder Compliance-Aenderung.

### 5.272 - 2026-05-26
- Produktions-UI-Wartbarkeit ist mit einem weiteren verhaltensgleichen Label-Refactor verbessert: Einkaufslistenpositionszaehlung, Einkaufslistenstatus, Intake-Ursprung, Handoff-Exportstatus und Handoff-Kontext werden als pure Helper in `production-route-state.ts` berechnet.
- `tests/production-route-state.test.ts` schuetzt Totals-/Items-Zaehllogik, Singular/Plural-Labels, Intake-Fallbacks und Plan-/Spec-/Purchase-Kontextanker. Keine Rendering-, Text-, API-, Persistenz-, Planungs-, Rezept-, Echtdaten-, Deployment-, Auth/OIDC-, LLM- oder Compliance-Aenderung.

### 5.273 - 2026-05-26
- Produktions-UI-Wartbarkeit ist mit einem weiteren verhaltensgleichen Workbench-Fakten-Refactor verbessert: Status-, Zeitfenster-, Gaeste-, Serviceform- und Menueumfang-Fakten werden ueber `buildWorkbenchSpecFacts` in `production-route-state.ts` berechnet statt direkt in `App.tsx`.
- `tests/production-route-state.test.ts` schuetzt Readiness-Uebersetzung, Terminfensterformatierung und die Facts fuer einen fokussierten Produktions-Spec. Keine Rendering-, Text-, API-, Persistenz-, Planungs-, Rezept-, Echtdaten-, Deployment-, Auth/OIDC-, LLM- oder Compliance-Aenderung.

### 5.274 - 2026-05-26
- Produktions-UI-Wartbarkeit ist mit einem weiteren verhaltensgleichen Rueckfragenstatus-Refactor verbessert: beantwortete und offene Conversation-Messages werden ueber `countClarificationAnswerStatuses` in `production-route-state.ts` gezaehlt statt direkt in `App.tsx`.
- `tests/production-route-state.test.ts` schuetzt answered-/unanswered-Zaehllogik inklusive irrelevanter Messages. Keine Rendering-, Text-, ConversationProjection-, API-, Persistenz-, Planungs-, Rezept-, Echtdaten-, Deployment-, Auth/OIDC-, LLM- oder Compliance-Aenderung.

### 5.275 - 2026-05-26
- Produktions-UI-Wartbarkeit ist mit einem weiteren verhaltensgleichen Planfokus-Refactor verbessert: die aktive Produktionsplan-Auswahl wird ueber `selectProductionWorkbenchPlan` in `production-route-state.ts` bestimmt statt direkt in `App.tsx`.
- `tests/production-route-state.test.ts` schuetzt geleerten Arbeitsbereich, explizite aktuelle Planwahl, explizite andere Planwahl, aktuellen Spec-Fallback und unscoped Fallback. Keine Rendering-, Text-, Sortier-, Archivierungs-, API-, Persistenz-, Planungs-, Rezept-, Echtdaten-, Deployment-, Auth/OIDC-, LLM- oder Compliance-Aenderung.

### 5.276 - 2026-05-26
- Produktions-UI-Wartbarkeit ist mit einem weiteren verhaltensgleichen Plan-Kontext-Refactor verbessert: Plan-zu-Spec-Lookup und Komponenten-Map werden ueber `selectProductionPlanSpec` und `buildProductionPlanComponentMap` in `production-route-state.ts` berechnet statt direkt in `App.tsx`.
- `tests/production-route-state.test.ts` schuetzt fehlende Planwahl, Spec-Lookup, fehlende Specs, Menuplan-Map, numerische Komponenten-IDs, leere IDs und ungueltige Menuplan-Fallbacks. Keine Rendering-, Text-, Datenmodell-, API-, Persistenz-, Planungs-, Rezept-, Echtdaten-, Deployment-, Auth/OIDC-, LLM- oder Compliance-Aenderung.

### 5.277 - 2026-05-26
- Produktions-UI-Wartbarkeit ist mit einem weiteren verhaltensgleichen Readiness-Label-Refactor verbessert: Spec-/Planstatus und Ergebnisobjektstatus werden ueber `formatProductionReadinessLabel`, `formatProductionPlanStatusLabel` und `formatProductionObjectStatusLabel` in `production-route-state.ts` gebaut statt direkt in `App.tsx`.
- `tests/production-route-state.test.ts` schuetzt Readiness-Fallbacks, offenen Planstatus, Plananzahl mit ausgewaehltem Plan, Plananzahl ohne ausgewaehlten Plan und den leeren Ergebnisobjekt-Fallback. Keine Rendering-, Text-, Datenmodell-, API-, Persistenz-, Planungs-, Rezept-, Echtdaten-, Deployment-, Auth/OIDC-, LLM- oder Compliance-Aenderung.

### 5.278 - 2026-05-26
- Produktions-UI-Wartbarkeit ist mit einem weiteren verhaltensgleichen Summary-/Intake-ID-Refactor verbessert: `formatStructuredProductionAnswerSummary` und `selectProductionIntakeRequestId` liegen in `production-route-state.ts` statt direkt in `App.tsx`.
- `tests/production-route-state.test.ts` schuetzt strukturierte Antwortsummary, direkte `requestId`, PDF-/Mail-/Manual-Source-Lineage und leere Fallbacks. Keine Rendering-, Textaenderung, ConversationProjection-, API-, Archivierungs-, Persistenz-, Planungs-, Rezept-, Echtdaten-, Deployment-, Auth/OIDC-, LLM- oder Compliance-Aenderung.

### 5.279 - 2026-05-26
- Lokaler Rehearsal-Check ist nicht-destruktiv gegen Stale-Daten klarer: `npm run local:check` warnt nun, wenn ignorierte lokale Einkaufslisten moegliche Rezept-Arbeitsschritte als Einkaufspositionen enthalten.
- Der Hinweis ist bewusst kein rotes Gate und keine automatische Bereinigung; UI-Evidenz und Reibungslog muessen den lokalen Stale-Datenbefund markieren oder einen kontrollierten Frischlauf/Soft-Archiv-Pfad bewusst dokumentieren. Keine Parser-, Planungs-, Rezeptmatching-, API-, Persistenz-, Loesch-, Echtdaten-, Deployment-, Auth/OIDC-, LLM- oder Compliance-Aenderung.

### 5.280 - 2026-05-26
- Produktionsroute ist im sauberen lokalen Frischlauf fokussicherer: Wenn geladene Produktionsplaene/Einkaufslisten zu keiner sichtbaren Intake-Spezifikation gehoeren, zeigt `/produktion` den vorhandenen Plan-Kontext statt einen fachlich unverknuepften Intake-Vorgang als aktuellen Produktionsfall zu markieren.
- `tests/production-route-state.test.ts` und `tests/backoffice-production-acceptance-smoke.test.ts` schuetzen diese plan-only-Artefaktgrenze sowie den naechsten Schritt fuer vorhandene Plan-/Einkaufslistenartefakte ohne fokussierte Spec. Keine API-, Persistenz-, Planungs-, Rezept-, Archivierungs-, Echtdaten-, Deployment-, Auth/OIDC-, LLM- oder Compliance-Aenderung.

### 5.281 - 2026-05-26
- Lokale Stack-Scripts sind fuer isolierte Frischlaeufe konsistenter: `local:start` zeichnet die wirksame `CATERING_DATA_ROOT` auf, `local:status` zeigt sie, `local:check` nutzt sie fuer Artefaktdiagnosen und blockiert abweichende Check-Env gegen einen laufenden Stack.
- Damit bewertet `local:check` einen temp-Datenwurzel-Frischlauf nicht versehentlich gegen ignorierte Repo-Altlasten. `local:stop` entfernt die Aufzeichnung. Keine Service-API-, Persistenzmodell-, Datenmigrations-, Produktlogik-, Echtdaten-, Deployment-, Auth/OIDC-, LLM- oder Compliance-Aenderung.

### 5.282 - 2026-05-26
- Produktions-UI-Wartbarkeit ist mit einem weiteren verhaltensgleichen Route-State-Refactor verbessert: `selectProductionArtifactSpecIds` sammelt die Spec-IDs vorhandener Produktionsartefakte aus Plaenen/Einkaufslisten statt diese Logik direkt in `App.tsx` zu halten.
- `tests/production-route-state.test.ts` schuetzt Deduplizierung und leere Fallbacks. Keine Rendering-, Text-, Fokusverhaltens-, API-, Persistenz-, Planungs-, Rezept-, Echtdaten-, Deployment-, Auth/OIDC-, LLM- oder Compliance-Aenderung.

### 5.283 - 2026-05-26
- Angebotsroute ist im sauberen Browser-Rehearsal konsistenter: Wenn ein fokussierter Angebotsentwurf eine `proposedEventSpec` enthaelt, zeigt die kompakte Angebotszusammenfassung diese Entwurfs-Quelle und Entwurfs-Spec statt einer unverknuepften neuesten Intake-Spezifikation.
- `tests/backoffice-route-smoke.test.ts` schuetzt Quelle und aktive Spezifikation fuer einen Entwurf mit eigener proposed Spec. Keine Angebotslogik-, API-, Persistenz-, Produktions-, Echtdaten-, Deployment-, Auth/OIDC-, LLM- oder Compliance-Aenderung.

### 5.284 - 2026-05-26
- Produktions-UI-Wartbarkeit ist mit einem verhaltensgleichen Rueckfragen-Panel-Schnitt verbessert: Der strukturierte Antworteditor liegt nun in `backoffice-ui/src/production-structured-answer-editor.tsx`, die Intake-Herkunftskarte mit gekuerzten Quellen-/Ingestion-Ankern in `backoffice-ui/src/production-intake-origin-card.tsx`.
- `backoffice-ui/src/production-question-panel.tsx` bleibt als Komposition fuer Rueckfragen, ConversationSession-Projektion, Spezifikationsdetails und Vorgangswechsel bestehen und ist von 715 auf 369 Zeilen reduziert. `tests/backoffice-production-acceptance-smoke.test.ts`, `tests/backoffice-route-smoke.test.ts` und `npm run build` bleiben gruen. Keine Text-, Verhalten-, Rueckfragenmodell-, Antwortspeicher-, Planungs-, Rezept-, API-, Persistenz-/Migrations-, LLM-, Echtdaten-, Deployment-, Auth- oder Compliance-Aenderung.

### 5.285 - 2026-05-26
- Backoffice-Browser-Smokes sind konsolenruhiger: `backoffice-ui/index.html` verweist auf ein statisches `favicon.svg`, damit der Browser nicht mehr mit `favicon.ico` 404 rauscht.
- `entfernter Doku-Contract-Test` schuetzt den statischen Shell-Anker. Keine Route-, Produktlogik-, API-, Persistenz-, Echtdaten-, Deployment-, Auth/OIDC-, LLM- oder Compliance-Aenderung.

### 5.286 - 2026-05-26
- Produktions-UI-Wartbarkeit ist mit einem weiteren verhaltensgleichen Rueckfragen-Panel-Schnitt verbessert: Die read-only Workbench-Projektion, ConversationSession-Karte, Ergebnisstatusleiste und strukturierte Chat-Message-Liste liegen nun in `backoffice-ui/src/production-question-thread.tsx`.
- `backoffice-ui/src/production-question-panel.tsx` bleibt fuer Panel-Rahmen, Aktionen, Annahmen, Spezifikationsdetails, Intake-Herkunft und Vorgangswechsel zustaendig und ist weiter reduziert. Keine Text-, Verhalten-, Rueckfragenmodell-, Antwortspeicher-, Planungs-, Rezept-, API-, Persistenz-/Migrations-, LLM-, Echtdaten-, Deployment-, Auth- oder Compliance-Aenderung.

### 5.287 - 2026-05-26
- Produktions-UI-Testbarkeit ist mit einem verhaltensgleichen Helper-Schnitt verbessert: Die Rezeptvorschlagslogik aus dem strukturierten Antworteditor liegt nun in `backoffice-ui/src/production-recipe-suggestions.ts`.
- `tests/production-recipe-suggestions.test.ts` schuetzt Tokenfilter, Score-Sortierung, Normalisierung und Rezeptnamen-Fallbacks. Keine Aenderung an Rezeptbibliothek, Rezeptmatching-Fachlogik, Planung, Einkaufsliste, API, Persistenz, LLM, Echtdaten, Deployment, Auth oder Compliance.

### 5.288 - 2026-05-26
- Produktions-UI-Testbarkeit ist mit einem zweiten verhaltensgleichen Rezeptauswahl-Helper-Schnitt verbessert: `buildRecipeOptionsForComponent` baut Vorschlaege plus manuell gewaehltes Rezept-Override ausserhalb des JSX.
- `tests/production-recipe-suggestions.test.ts` schuetzt, dass ausgewaehlte Overrides sichtbar bleiben, unbekannte Overrides mit `Rezept ...` gelabelt werden und passende Overrides nicht doppelt erscheinen. Keine Aenderung an Rezeptbibliothek, Rezeptmatching-Fachlogik, Planung, Einkaufsliste, API, Persistenz, LLM, Echtdaten, Deployment, Auth oder Compliance.

### 5.289 - 2026-05-26
- Produktions-UI-Wartbarkeit ist mit einem verhaltensgleichen Komponenten-Karten-Schnitt verbessert: `backoffice-ui/src/production-component-answer-card.tsx` rendert die einzelne Gericht-/Komponenten-Antwortkarte, waehrend `production-structured-answer-editor.tsx` nur noch den strukturierten Antwortfluss orchestriert.
- `ComponentEditState` liegt als UI-Typ in `backoffice-ui/src/production-answer-types.ts` und wird von App, Route-Layout, Rueckfragen-Panel, strukturiertem Editor und Komponentenkarte gemeinsam genutzt. Keine Text-, Verhalten-, Antwortspeicher-, Planungs-, Rezeptfachlogik-, API-, Persistenz-/Migrations-, LLM-, Echtdaten-, Deployment-, Auth- oder Compliance-Aenderung.

### 5.290 - 2026-05-26
- Produktions-UI-Wartbarkeit ist mit einem weiteren verhaltensgleichen Editor-Schnitt verbessert: `backoffice-ui/src/production-event-answer-fields.tsx` rendert die Basisdatenfelder fuer Veranstaltung, Datum, Pax, Serviceform und Komponenten-Textarea.
- `backoffice-ui/src/production-structured-answer-editor.tsx` bleibt fuer Chat-Bubble, Komponentenlisten-Orchestrierung und Zusammensetzung der Antwortteile zustaendig. Keine Text-, Verhalten-, Antwortspeicher-, Planungs-, Rezeptlogik-, API-, Persistenz-/Migrations-, LLM-, Echtdaten-, Deployment-, Auth- oder Compliance-Aenderung.

### 5.291 - 2026-05-26
- Produktions-UI-Wartbarkeit ist mit einem weiteren verhaltensgleichen Editor-Schnitt verbessert: `backoffice-ui/src/production-component-answer-list.tsx` rendert die Komponentenliste inklusive vorhandenem `menuPlan`-Guard und delegiert jede Karte weiter an `ProductionComponentAnswerCard`.
- `backoffice-ui/src/production-structured-answer-editor.tsx` ist damit auf die Chat-Bubble und die Zusammensetzung von Basisdaten- und Komponenten-Antwortteilen reduziert. Keine Text-, Verhalten-, Antwortspeicher-, Planungs-, Rezeptlogik-, API-, Persistenz-/Migrations-, LLM-, Echtdaten-, Deployment-, Auth- oder Compliance-Aenderung.

### 5.292 - 2026-05-26
- Produktions-UI-Rezeptauswahl ist mit einem kleinen Alias-Korridor konsistenter zum bestehenden Backend-Matching: Die UI-Vorschlagsliste fuer manuelle Rezeptzuweisung kennt nun konservative Catering-Aliase fuer `Kartoffelsalat -> Potato`, `Nudelsalat -> Pasta` sowie `Kalbsbuletten`/`Kalbsfrikadellen -> Veal Meatballs`.
- `tests/production-recipe-suggestions.test.ts` schuetzt diese German-English-Aliasfaelle und verhindert, dass ein reines `Salad`-Signal als generischer Treffer reicht. Keine Aenderung an Backend-Planung, Rezeptbibliothek, Datenmodell, API, Persistenz/Migration, LLM, Echtdaten, Deployment, Auth oder Compliance.

### 5.293 - 2026-05-26
- Produktions-UI-Rezeptauswahl ist im Komponenten-Kontext abgesichert: `tests/production-component-answer-card.test.ts` rendert `ProductionComponentAnswerCard` mit `KARTOFFELSALAT | DE LUX` und prueft, dass der Alias-Vorschlag `Potato Salad with Herbs` als gezielte Rezeptoption sichtbar und auswaehlbar ist.
- Der Test schuetzt zugleich, dass ein generischer `Caesar Salad`-Treffer aus dem reinen `Salad`-Signal nicht in den Override-Select rutscht und die Auswahl als `recipeOverrideId` an den bestehenden Editor-State weitergegeben wird. Keine Produktcode-, Backend-Planungs-, Rezeptbibliotheks-, Datenmodell-, API-, Persistenz-/Migrations-, LLM-, Echtdaten-, Deployment-, Auth- oder Compliance-Aenderung.

### 5.294 - 2026-05-26
- Produktions-UI-Wartbarkeit ist mit einem weiteren verhaltensgleichen Karten-Schnitt verbessert: `backoffice-ui/src/production-recipe-override-select.tsx` rendert den gezielten Rezept-Override-Select inklusive vorhandener Vorschlags-/Fallback-Hilfetexte.
- `ProductionComponentAnswerCard` delegiert die Rezeptauswahl nun an diese Komponente und bleibt fuer Kategorie, Herstellungsart, Zukauf und Notiz zustaendig. Keine Aenderung an Vorschlagslogik, Antwortspeicherung, Backend-Planung, Rezeptbibliothek, Datenmodell, API, Persistenz/Migration, LLM, Echtdaten, Deployment, Auth oder Compliance.

### 5.295 - 2026-05-26
- Produktions-UI-Wartbarkeit ist mit einem weiteren verhaltensgleichen Karten-Schnitt verbessert: `backoffice-ui/src/production-component-classification-fields.tsx` rendert Kategorie- und Herstellungsart-Selects getrennt von der Komponentenkarte.
- `tests/production-component-classification-fields.test.ts` schuetzt, dass Kategorie und Herstellungsart weiterhin als getrennte Editor-State-Patches weitergegeben werden. Keine Aenderung an Rezeptvorschlaegen, Antwortspeicherung, Backend-Planung, Rezeptbibliothek, Datenmodell, API, Persistenz/Migration, LLM, Echtdaten, Deployment, Auth oder Compliance.

### 5.296 - 2026-05-26
- Produktions-UI-Wartbarkeit ist mit einem weiteren verhaltensgleichen Karten-Schnitt verbessert: `backoffice-ui/src/production-component-detail-fields.tsx` rendert die Zukauf- und Notiz-Eingaben getrennt von der Komponentenkarte.
- `tests/production-component-detail-fields.test.ts` schuetzt, dass `purchasedElements` und `notes` weiterhin als getrennte Editor-State-Patches weitergegeben werden. Keine Aenderung an Rezeptvorschlaegen, Antwortspeicherung, Backend-Planung, Rezeptbibliothek, Datenmodell, API, Persistenz/Migration, LLM, Echtdaten, Deployment, Auth oder Compliance.

### 5.297 - 2026-05-26
- Produktionskern-Smokes sind gegen Einkaufslisten-Scheingruenheit gehaertet: `tests/platform.test.ts` prueft fuer Quick Lunch, Flying-Bites-Empfang und Kaffeepause, dass Einkaufslistenpositionen positive Mengen, Einheiten, Gruppen, Quellenanker und Mapping-Confidence tragen.
- Der neue Test-Helfer schuetzt zugleich, dass typische Rezeptschritt-/Zubereitungswoerter nicht als Einkaufspositionen in die operativen Listen rutschen. Keine Aenderung an Planungslogik, Rezeptmatching, API, Persistenz/Migration, Datenmodell, UI, LLM, Echtdaten, Deployment, Auth oder Compliance.

### 5.298 - 2026-05-26
- Einkaufslisten-Smokes sind um fachliche Gruppierungsanker fuer klare Beschaffungsteile ergaenzt: `tests/platform.test.ts` prueft, dass `Kaffeefilter` als `beverages` und klare Baeckerei-/Fertigproduktpositionen wie `Baguette`, `Brot` und `Croissants` als `bakery` laufen.
- Der Slice aendert keine Gruppierungslogik, sondern macht vorhandenes Verhalten fuer operative Einkaufslisten reproduzierbarer. Keine Aenderung an Planung, Rezeptmatching, API, Persistenz/Migration, Datenmodell, UI, LLM, Echtdaten, Deployment, Auth oder Compliance.

### 5.299 - 2026-05-26
- Produktions-Rezeptmatching ist fuer die haeufige Schreibvariante `Hummus`/`Humus` gehaertet: `tests/platform.test.ts` prueft, dass ein Angebotsbaustein `Hummus` ein internes Rezept `Humus Tahini Dip vegan` statt eines ungeklaerten oder externen Treffers waehlt.
- Der Slice ergaenzt nur den bestehenden Alias-Korridor in Repository-Kandidatensuche und Recipe-Discovery und aendert keine Planungslogik, Rezeptdatenmodelle, API, Persistenz/Migration, UI, LLM, Echtdaten, Deployment, Auth oder Compliance.

### 5.300 - 2026-05-26
- Produktions-UI-Rezeptvorschlaege sind konsistent zum Backend fuer `Hummus`/`Humus`: `tests/production-recipe-suggestions.test.ts` prueft, dass ein Angebotslabel `Hummus vegan` ein internes Rezept `Humus Tahini Dip vegan` im manuellen Override anbietet.
- Der Slice ergaenzt nur die vorhandene Vorschlags-Aliasliste und aendert keine UI-Struktur, Antwortspeicherung, Backend-Planung, Rezeptdatenmodelle, API, Persistenz/Migration, LLM, Echtdaten, Deployment, Auth oder Compliance.

### 5.301 - 2026-05-26
- Produktions-Rezeptmatching ist fuer den konkreten Umlaut-/ASCII-Fall `Gemuesepfanne`/`Gemüsepfanne` gehaertet: `tests/platform.test.ts` prueft, dass ein Angebotsbaustein `Gemuesepfanne` ein internes Rezept `Gemüsepfanne Zucchini Pilze Pak Choi vegan` waehlt.
- Der Slice ergaenzt nur den bestehenden Alias-Korridor fuer diesen Compound-Dish in Repository-Kandidatensuche und Recipe-Discovery. Keine Aenderung an allgemeiner Gemueselogik, Planung, Rezeptdatenmodellen, API, Persistenz/Migration, UI, LLM, Echtdaten, Deployment, Auth oder Compliance.

### 5.302 - 2026-05-26
- Produktions-Rezeptalias-Paritaet ist als Drift-Guard verankert: `tests/production-recipe-alias-parity.test.ts` prueft fuer `Hummus`/`Humus` und `Gemuesepfanne`/`Gemüsepfanne`, dass Backend-Discovery und UI-Rezeptvorschlaege denselben internen Rezeptanker liefern.
- Der Test hat den fehlenden UI-Vorschlagsalias fuer `Gemuesepfanne`/`Gemüsepfanne` sichtbar gemacht; `production-recipe-suggestions.ts` kennt nun denselben engen Compound-Dish-Korridor. Keine Aenderung an Backend-Matchinglogik, UI-Struktur, Planung, Rezeptdatenmodellen, API, Persistenz/Migration, LLM, Echtdaten, Deployment, Auth oder Compliance.

### 5.303 - 2026-05-26
- Der interne Produktions-UI-Smoke geht nun vom Start-Entry `Produktionsagent öffnen` in die Produktionsroute und prueft danach weiter den synthetischen Kernfluss: manuelle Spezifikation, Klassifikation/Rezeptzuordnung, Planerzeugung, Einkaufsliste und Exportanker.
- Der Slice erweitert nur `tests/backoffice-internal-usage-smoke.test.ts` als Browser-/UI-Pfadschutz. Keine Aenderung an UI-Texten, APIs, Planung, Rezeptmatching, Datenmodellen, Persistenz/Migration, LLM, Echtdaten, Deployment, Auth oder Compliance.

### 5.304 - 2026-05-26
- Produktions-UI-Wartbarkeit ist mit einem verhaltensgleichen Fortschritts-Hook verbessert: `backoffice-ui/src/use-production-plan-progress.ts` kapselt Planphase, Prozent-/ETA-Timer, Start-, Done-, Fail- und Reset-Zustand fuer die Planerzeugung.
- `App.tsx` orchestriert weiter Speichern, Planung und Dashboard-Refresh, enthaelt aber nicht mehr die interne Plan-Fortschritts-Timerlogik. Keine Aenderung an UI-Texten, APIs, Planung, Rezeptmatching, Datenmodellen, Persistenz/Migration, LLM, Echtdaten, Deployment, Auth oder Compliance.

### 5.305 - 2026-05-26
- Produktions-UI-Wartbarkeit ist analog fuer Dokumentanalyse verbessert: `backoffice-ui/src/use-production-document-progress.ts` kapselt aktiven Dokumentnamen, Analysephase, Prozent-/ETA-Timer, Start-, Done-, Fail- und Reset-Zustand.
- `App.tsx` verarbeitet Uploads und Spezifikationsanlage weiter selbst, enthaelt aber nicht mehr die interne Dokument-Fortschritts-Timerlogik. Keine Aenderung an UI-Texten, APIs, Dokumentnormalisierung, Planung, Rezeptmatching, Datenmodellen, Persistenz/Migration, LLM, Echtdaten, Deployment, Auth oder Compliance.

### 5.306 - 2026-05-26
- Produktions-Spec-Edit-Snapshots sind aus `App.tsx` nach `backoffice-ui/src/production-spec-edit-snapshot.ts` extrahiert und gezielt mit `tests/production-spec-edit-snapshot.test.ts` abgesichert.
- Der Schnitt bleibt verhaltensgleich: keine Aenderung an UI-Texten, Speichern, APIs, Planung, Rezeptmatching, Datenmodellen, Persistenz/Migration, LLM, Echtdaten, Deployment, Auth oder Compliance.

### 5.307 - 2026-05-26
- Produktions-Spec-Edit-Update-Payloads sind als reine Funktion in `backoffice-ui/src/production-spec-edit-update.ts` gekapselt und mit `tests/production-spec-edit-update.test.ts` gegen Trimming, Listenaufteilung, erlaubte Select-Werte und leere Recipe-Overrides abgesichert.
- `App.tsx` bleibt fuer Speichern, Refresh und Nutzerfeedback verantwortlich. Keine Aenderung an UI-Texten, API-Endpunkten, Backend-Validierung, Planung, Rezeptmatching, Datenmodellen, Persistenz/Migration, LLM, Echtdaten, Deployment, Auth oder Compliance.

### 5.308 - 2026-05-26
- Manuelle Produktionsspezifikations-Payloads sind als reine Funktion in `backoffice-ui/src/production-manual-spec-input.ts` gekapselt und mit `tests/production-manual-spec-input.test.ts` gegen Trimming, Listenaufteilung und leere optionale Felder abgesichert.
- `App.tsx` behaelt Formularzustand, Anlage, Fokusauswahl und Nutzerfeedback. Keine Aenderung an UI-Texten, Formularfeldern, API-Endpunkten, Backend-Validierung, Planung, Rezeptmatching, Datenmodellen, Persistenz/Migration, LLM, Echtdaten, Deployment, Auth oder Compliance.

### 5.309 - 2026-05-26
- Produktions-Dokumentkanal-Erkennung ist aus `App.tsx` nach `backoffice-ui/src/production-document-channel.ts` extrahiert und mit `tests/production-document-channel.test.ts` fuer PDF, E-Mail und Text-Fallback abgesichert.
- Der Upload-Flow selbst bleibt unveraendert. Keine Aenderung an Normalisierung, Fehlupload-Archivierung, APIs, Planung, Rezeptmatching, Datenmodellen, Persistenz/Migration, LLM, Echtdaten, Deployment, Auth oder Compliance.

### 5.310 - 2026-05-26
- Produktions-Spec-Editor-State ist in `backoffice-ui/src/use-production-spec-editor.ts` gekapselt: Laden, Reset/Dismissal, Feldsetter, Komponentenpatches, Change-Erkennung und Update-Payload-Bau liegen nicht mehr direkt in `App.tsx`.
- `tests/use-production-spec-editor.test.ts` prueft Laden unveraenderter Spezifikationen, Change-Erkennung, Payload-Bau und Dismissal-Reset. `App.tsx` behaelt Fokuswechsel, Speichern, Refresh und Nutzerfeedback. Keine Aenderung an UI-Texten, APIs, Planung, Rezeptmatching, Datenmodellen, Persistenz/Migration, LLM, Echtdaten, Deployment, Auth oder Compliance.

### 5.311 - 2026-05-26
- Manueller Produktionsspezifikations-Formularzustand ist in `backoffice-ui/src/use-production-manual-spec-form.ts` gekapselt: Defaults, Setter, Payload-Bau und Erfolgs-Reset liegen nicht mehr direkt in `App.tsx`.
- `tests/use-production-manual-spec-form.test.ts` prueft Defaults, normalisierten Payload-Bau und Reset-Verhalten. `App.tsx` behaelt Submit, Fokusauswahl, Refresh und Nutzerfeedback. Keine Aenderung an UI-Texten, Formularfeldern, API-Endpunkten, Backend-Validierung, Planung, Rezeptmatching, Datenmodellen, Persistenz/Migration, LLM, Echtdaten, Deployment, Auth oder Compliance.

### 5.312 - 2026-05-26
- Produktions-Intake-Request-Detail-Laden ist in `backoffice-ui/src/use-production-intake-request-detail.ts` gekapselt; der Hook liefert Detail und Fehlerzustand fuer die aktive Intake-Request-ID.
- `tests/use-production-intake-request-detail.test.ts` prueft erfolgreichen Read, Fehleranzeige und Reset bei fehlender aktiver Request-ID. Keine Aenderung an UI-Texten, API-Endpunkten, Detailformat, Upload, Planung, Rezeptmatching, Datenmodellen, Persistenz/Migration, LLM, Echtdaten, Deployment, Auth oder Compliance.

### 5.313 - 2026-05-26
- Produktions-Intake-Draft-State fuer Text, Datei, Dokumentkanal und Drag-Zustand ist in `backoffice-ui/src/use-production-intake-draft.ts` gekapselt.
- `tests/use-production-intake-draft.test.ts` prueft bestehende Defaults, Datei-Start/Complete/Fail und Reset-Grenze. `App.tsx` behaelt Submit-Flows, Dokumentanalyse und API-Aufrufe. Keine Aenderung an UI-Texten, Upload-API, Normalisierung, Fehlupload-Archivierung, Planung, Rezeptmatching, Datenmodellen, Persistenz/Migration, LLM, Echtdaten, Deployment, Auth oder Compliance.

### 5.314 - 2026-05-26
- ID-Extraktion aus Intake- und Produktionsplan-Antworten ist in `backoffice-ui/src/production-api-response-ids.ts` gekapselt und mit `tests/production-api-response-ids.test.ts` abgesichert.
- `App.tsx` nutzt die Helfer weiter nur fuer Fokus-/Auswahlwechsel nach bestehenden API-Antworten. Keine Aenderung an UI-Texten, API-Endpunkten, Speichern, Upload, Planung, Rezeptmatching, Datenmodellen, Persistenz/Migration, LLM, Echtdaten, Deployment, Auth oder Compliance.

### 5.315 - 2026-05-26
- `ProductionRouteMainLayout` reicht Source- und Manual-Input jetzt als gebuendelte `ProductionInputPanel`-Objektprops durch, statt einzelne Eingabefelder und Setter erneut aufzusplitten.
- Die Aenderung ist reine Prop-Struktur innerhalb der UI. Keine Aenderung an UI-Texten, Upload, Normalisierung, manueller Anlage, API-Endpunkten, Planung, Rezeptmatching, Datenmodellen, Persistenz/Migration, LLM, Echtdaten, Deployment, Auth oder Compliance.

### 5.316 - 2026-05-26
- Editor-State und Editor-Aktionen des Produktions-Rueckfragenpanels sind als `editorState` und `editorActions` gebuendelt und werden von `App.tsx` ueber `ProductionRouteMainLayout` an `ProductionQuestionPanel` weitergereicht.
- Die Aenderung ist reine Prop-Struktur innerhalb der UI. Keine Aenderung an UI-Texten, Antwortbearbeitung, Speichern, Berechnung, API-Endpunkten, Planung, Rezeptmatching, Datenmodellen, Persistenz/Migration, LLM, Echtdaten, Deployment, Auth oder Compliance.

### 5.317 - 2026-05-26
- Fortschritt, Zustand und Aktionen des Produktionsobjekte-Panels sind als `objectPanelProgress`, `objectPanelState` und `objectPanelActions` gebuendelt und werden von `App.tsx` ueber `ProductionRouteMainLayout` an `ProductionObjectsPanel` weitergereicht.
- Die Aenderung ist reine Prop-Struktur innerhalb der UI. Keine Aenderung an UI-Texten, Planerzeugung, Ergebnisanzeige, Einkaufslisten, API-Endpunkten, Planung, Rezeptmatching, Datenmodellen, Persistenz/Migration, LLM, Echtdaten, Deployment, Auth oder Compliance.

### 5.318 - 2026-05-26
- Status, Upload-Formular, Rezeptbestand und Aktionen des Produktions-Rezeptbibliothek-Panels sind als `recipeStatus`, `recipeUpload`, `recipeLibrary` und `recipeActions` gebuendelt.
- Die Aenderung ist reine Prop-Struktur innerhalb der UI. Keine Aenderung an UI-Texten, Rezeptupload, Review-Entscheidungen, Rezeptmatching, API-Endpunkten, Planung, Datenmodellen, Persistenz/Migration, LLM, Echtdaten, Deployment, Auth oder Compliance.

### 5.319 - 2026-05-26
- Einkaufslisten-Zustand des Produktions-Downloadbereichs ist als `purchaseListState` gebuendelt und wird von `App.tsx` ueber `ProductionRouteMainLayout` an `ProductionPurchaseListPanel` weitergereicht.
- Die Aenderung ist reine Prop-Struktur innerhalb der UI. Keine Aenderung an UI-Texten, Einkaufslistenberechnung, Exportlinks, API-Endpunkten, Planung, Rezeptmatching, Datenmodellen, Persistenz/Migration, LLM, Echtdaten, Deployment, Auth oder Compliance.

### 5.320 - 2026-05-26
- Herkunfts-, Audit-, Export- und Abschlusskontext-Labels der Produktions-Handoff-Zone sind als `handoffState` gebuendelt und werden von `App.tsx` ueber `ProductionRouteMainLayout` an `ProductionHandoffPanel` weitergereicht.
- Die Aenderung ist reine Prop-Struktur innerhalb der UI. Keine Aenderung an UI-Texten, Exportartefakten, Audit-Aussagen, API-Endpunkten, Planung, Rezeptmatching, Datenmodellen, Persistenz/Migration, LLM, Echtdaten, Deployment, Auth oder Compliance.

### 5.321 - 2026-05-26
- Kopf-/Zusammenfassungsdaten des Produktions-Workbench-Layouts sind als `workbenchSummary` und `workbenchNextStep` gebuendelt und ersetzen die lange Einzelprop-Liste von `ProductionConversationalWorkbench`.
- Die Aenderung ist reine Prop-Struktur innerhalb der UI. Keine Aenderung an UI-Texten, naechster-Schritt-Berechnung, Statuslogik, API-Endpunkten, Planung, Rezeptmatching, Datenmodellen, Persistenz/Migration, LLM, Echtdaten, Deployment, Auth oder Compliance.

### 5.322 - 2026-05-26
- Rueckfragenpanel-Kontext und Vorgangswechsel-Aktion sind als `questionState` und `questionActions` gebuendelt; Editor-State und Editor-Aktionen bleiben separat.
- Die Aenderung ist reine Prop-Struktur innerhalb der UI. Keine Aenderung an UI-Texten, Rueckfragenlogik, Antwortspeicherung, Finalitaets-/Readiness-Bewertung, API-Endpunkten, Planung, Rezeptmatching, Datenmodellen, Persistenz/Migration, LLM, Echtdaten, Deployment, Auth oder Compliance.

### 5.323 - 2026-05-27
- Produktionsroute-View-State wird in `backoffice-ui/src/production-route-view-state.ts` als reine Assembly-Funktion gebaut; `App.tsx` uebergibt die gebuendelten View-State-Objekte per Spread an `ProductionRouteMainLayout`.
- `tests/production-route-view-state.test.ts` schuetzt die reine Feldzuordnung fuer Workbench, Rueckfragen, Objekte, Einkauf, Handoff und Rezeptbibliothek. Keine Aenderung an UI-Texten, Rueckfragenlogik, Antwortspeicherung, Planung, Rezeptmatching, API-Endpunkten, Datenmodellen, Persistenz/Migration, LLM, Echtdaten, Deployment, Auth oder Compliance.

### 5.324 - 2026-06-01
- Browser-Rehearsal-Harness ist verhaltensgleich entlastet: gemeinsame Shell-/Browser-Helfer liegen in `scripts/browser-rehearsal-shell.sh`, waehrend `scripts/check-browser-rehearsal.sh` die Szenario- und Markerlogik behaelt.
- Belegt mit `npm run browser:rehearsal:full-fresh`, `npm test` und `npm run build`. Keine Aenderung an UI-Texten, Produktlogik, API-Endpunkten, Datenmodellen, Persistenz/Migration, LLM, Echtdaten, Deployment, Auth oder Compliance.

### 5.325 - 2026-06-01
- Statische Start-/Angebot-/Navigations-Browser-Rehearsal-Scripts sind nach `scripts/browser-rehearsal/*.js` ausgelagert; `scripts/check-browser-rehearsal.sh` laedt sie ueber `load_rehearsal_script` und behaelt die komplexeren Produktionspfad-Szenarien.
- Belegt mit `npm run browser:rehearsal:full-fresh` und dem Browser-Rehearsal-Contract-Test. Keine Aenderung an UI-Texten, Produktlogik, API-Endpunkten, Datenmodellen, Persistenz/Migration, LLM, Echtdaten, Deployment, Auth oder Compliance.

### 5.326 - 2026-06-01
- App-Dashboard-/Route-Ableitungen sind aus `App.tsx` nach `backoffice-ui/src/app-dashboard-route-state.ts` extrahiert: Suchfilter, Offer-Fallbacks, Loading-Flags, Rezeptstatus und Produktionslisten werden in einem getesteten Selector-Cluster gebaut.
- `tests/app-dashboard-route-state.test.ts` schuetzt die bestehende Ableitung ohne UI-Text-, Produktlogik-, API-, Datenmodell-, Persistenz/Migrations-, LLM-, Echtdaten-, Deployment- oder Auth-Aenderung.

### 5.327 - 2026-06-01
- RecipeDiscovery-Labeluebersetzungen sind aus `production-service/src/recipe-discovery/recipe-query-builder.ts` nach `production-service/src/recipe-discovery/recipe-query-translations.ts` extrahiert; der Query-Builder re-exportiert die bestehende Funktion weiter.
- `tests/recipe-query-translations.test.ts` schuetzt deutsche No-Op-Labels, etablierte englische Catering-Labeluebersetzungen und Whitespace-Normalisierung. Keine Aenderung an Rezeptlogik, Matching-Strategie, UI, API-Endpunkten, Datenmodellen, Persistenz/Migration, LLM, Echtdaten, Deployment oder Auth.

### 5.328 - 2026-06-01
- RecipeDiscovery-Suchquery-Normalisierung ist aus `recipe-query-builder.ts` nach `recipe-search-query-normalization.ts` extrahiert; der Query-Builder re-exportiert `normalizeSearchQuery` und `uniqueNormalizedSearchQueries` fuer bestehende Imports weiter.
- `tests/recipe-search-query-normalization.test.ts` prueft Whitespace-/Duplikat-Normalisierung und Deduplikation ohne Token-Reordering. Keine Aenderung an Query-Korridoren, Rezeptlogik, Matching-Strategie, UI, API-Endpunkten, Datenmodellen, Persistenz/Migration, LLM, Echtdaten, Deployment oder Auth.

### 5.329 - 2026-06-01
- RecipeDiscovery-Search-Label-Cleaning ist aus `recipe-query-builder.ts` nach `recipe-search-labels.ts` extrahiert; der Query-Builder re-exportiert `cleanedSearchLabel` und `primarySearchSegment` fuer bestehende Imports weiter.
- `tests/recipe-search-labels.test.ts` prueft Suffix-Filter, Separator-/Whitespace-Normalisierung und primaere Label-Segmente. Keine Aenderung an Query-Korridoren, Rezeptlogik, Matching-Strategie, UI, API-Endpunkten, Datenmodellen, Persistenz/Migration, LLM, Echtdaten, Deployment oder Auth.

### 5.330 - 2026-06-01
- RecipeDiscovery-Dish-Archetype-Erkennung ist aus `recipe-query-builder.ts` nach `recipe-dish-archetypes.ts` extrahiert; der Query-Builder re-exportiert `dishArchetypeForComponent` fuer bestehende Imports weiter.
- `tests/recipe-dish-archetypes.test.ts` prueft lokalisierte Archetypes, gemeinsam genutzte Archetype-Labels und unbekannte Labels ohne neue Matches. Keine Aenderung an Query-Korridoren, Scoring, Matching-Strategie, UI, API-Endpunkten, Datenmodellen, Persistenz/Migration, LLM, Echtdaten, Deployment oder Auth.

### 5.331 - 2026-06-01
- RecipeDiscovery-Generic-Search-Seeds sind aus `recipe-query-builder.ts` nach `recipe-generic-search-seeds.ts` extrahiert; der Query-Builder re-exportiert `genericSearchSeeds` fuer bestehende Imports weiter.
- `tests/recipe-generic-search-seeds.test.ts` prueft lokalisierte Cake-/Buffet-Seeds, etablierte Side-Dish-/Curry-Seeds und unbekannte Labels ohne Seed-Erfindung. Keine Aenderung an Query-Korridoren, Scoring, Matching-Strategie, UI, API-Endpunkten, Datenmodellen, Persistenz/Migration, LLM, Echtdaten, Deployment oder Auth.

### 5.332 - 2026-06-01
- Browser-Rehearsal-Reload-Szenarien fuer Answer-Submit und Soft-Archiv sind aus `scripts/check-browser-rehearsal.sh` nach `scripts/browser-rehearsal/submitted-reload-markers.js` und `scripts/browser-rehearsal/archive-reload-markers.js` extrahiert.
- Belegt mit Shell-Syntaxcheck, `entfernter Doku-Contract-Test`, `npm run build`, vollem `npm test` und `npm run browser:rehearsal:full-fresh`. Keine Aenderung an UI-Texten, Produktlogik, API-Endpunkten, Datenmodellen, Persistenz/Migration, LLM, Echtdaten, Deployment, Auth oder Compliance.

### 5.333 - 2026-06-01
- Browser-Rehearsal-Ergebnis-Reload-Pruefungen sind aus `scripts/check-browser-rehearsal.sh` nach `scripts/browser-rehearsal/production-result-reload-pre-markers.js` und `scripts/browser-rehearsal/production-result-reload-markers.js` extrahiert.
- Belegt mit Shell-Syntaxcheck, `entfernter Doku-Contract-Test`, `npm run build`, vollem `npm test` und `npm run browser:rehearsal:full-fresh`. Keine Aenderung an UI-Texten, Produktlogik, API-Endpunkten, Datenmodellen, Persistenz/Migration, LLM, Echtdaten, Deployment, Auth oder Compliance.

### 5.334 - 2026-06-01
- Browser-Rehearsal-Clear-Workspace-Pruefungen sind aus `scripts/check-browser-rehearsal.sh` nach `scripts/browser-rehearsal/clear-workspace-markers.js` und `scripts/browser-rehearsal/clear-workspace-reload-markers.js` extrahiert.
- Belegt mit Shell-Syntaxcheck, `entfernter Doku-Contract-Test`, `npm run build`, vollem `npm test` und `npm run browser:rehearsal:full-fresh`. Keine Aenderung an UI-Texten, Produktlogik, API-Endpunkten, Datenmodellen, Persistenz/Migration, LLM, Echtdaten, Deployment, Auth oder Compliance.

### 5.335 - 2026-06-01
- Browser-Rehearsal-Produktionsmarker sind aus `scripts/check-browser-rehearsal.sh` nach `scripts/browser-rehearsal/production-markers.js` extrahiert; der Shell-Harness laedt den Baustein weiter an derselben Stelle im Start -> Angebot -> Produktion-Pfad.
- Belegt mit Shell-Syntaxcheck, `entfernter Doku-Contract-Test`, `npm run build`, vollem `npm test` und `npm run browser:rehearsal:full-fresh`. Keine Aenderung an UI-Texten, Produktlogik, API-Endpunkten, Datenmodellen, Persistenz/Migration, LLM, Echtdaten, Deployment, Auth oder Compliance.

### 5.336 - 2026-06-01
- Browser-Rehearsal-Open-Question-Pfad ist aus `scripts/check-browser-rehearsal.sh` nach `scripts/browser-rehearsal/open-question-markers.js` extrahiert; der Shell-Harness ersetzt nur die bestehenden Submit-/Archiv-Modus-Platzhalter.
- Belegt mit Shell-Syntaxcheck, `entfernter Doku-Contract-Test`, `npm run build`, vollem `npm test` und `npm run browser:rehearsal:full-fresh`. Keine Aenderung an UI-Texten, Produktlogik, API-Endpunkten, Datenmodellen, Persistenz/Migration, LLM, Echtdaten, Deployment, Auth oder Compliance.

### 5.337 - 2026-06-01
- Angebotsrouten-App-Boundary ist aus `App.tsx` nach `backoffice-ui/src/app-offer-route-app-boundary.ts` extrahiert; Offer-Submit, Draft-Promotion und `buildAppOfferRouteState` werden dort als ein Offer-Route-Cluster gebaut.
- `tests/app-offer-route-app-boundary.test.ts` schuetzt die Verdrahtung fuer Angebotsentwurf-Erstellung, Draft-Promotion und Workbench-State-Referenzen. Keine Aenderung an UI-Texten, Produktlogik, API-Endpunkten, Datenmodellen, Persistenz/Migration, LLM, Echtdaten, Deployment, Auth oder Compliance.

### 5.338 - 2026-06-01
- C11 10/10-Gap-Audit ist als Doku-/Vertragstestanker ergaenzt: `docs/product/C11_10_10_GAP_AUDIT.md` trennt den belegten internen 9/10-Rehearsal-Kern von echter 10/10-Produktreife, markiert reale Gates als blockiert oder entscheidungspflichtig und benennt `LLM-Readiness-Vertrag ohne LLM-Provider` als naechsten autonomen Vorbereitungsschritt.
- `entfernter Doku-Contract-Test` schuetzt Statuskategorien, Rehearsal-Belege, Gate-Grenzen, Verbote und Auffindbarkeit aus README, TESTING und memory.md. Keine Runtime, UI, API, Persistenz/Migration, LLM-Provider, Modellaufrufe, echte Daten, Deployment, Auth oder Compliance.

### 5.339 - 2026-06-01
- PA26 LLM-Readiness-Vertrag ohne Provider ist additiv in `shared-core/src/llm-readiness.ts` und `docs/architecture/PA26_LLM_READINESS_CONTRACT.md` verankert: Model-Input-/Output-Draftgrenzen, Tool-Effektklassen `read`/`draft`/`write`, `decision_required` fuer Write-Tools, Human-Approval-Pflicht und `writesProductObject: false`.
- `tests/pa26-llm-readiness-contract.test.ts` schuetzt, dass PA26 keinen Provider, keine Secrets, keine Modellaufrufe, keine echten Daten, keine API, keine Persistenz/Migration, keine Runtime-ConversationSession und keine Tool-Orchestrierung mit Schreibwirkung einfuehrt.

### 5.340 - 2026-06-01
- PA27 LLM-Readiness Eval-Fixtures ist additiv in `shared-core/src/fixtures/llm-readiness-eval-fixtures.ts` und `docs/architecture/PA27_LLM_READINESS_EVAL_FIXTURES.md` verankert: synthetische Erwartungsfaelle fuer Clarification-Draft und Operator-Summary-Draft auf Basis des PA26-Vertrags.
- PA28 LLM-Readiness Draft-Registry ist additiv in `shared-core/src/llm-readiness-draft-registry.ts` und `docs/architecture/PA28_LLM_READINESS_DRAFT_REGISTRY.md` verankert: schema-only Draft-Kontrakte verbinden PA26-Input-/Output-Kinds mit PA27-Fixtures ohne Prompttext, Provider, Modellaufrufe, API, Persistenz, echte Daten oder Schreibwirkung.
- PA29 LLM-Readiness Input-Validation ist additiv in `shared-core/src/llm-readiness.ts` und `docs/architecture/PA29_LLM_READINESS_INPUT_VALIDATION.md` verankert: `validateLlmReadinessModelInputCandidate(...)` lehnt Provider-, Echtdaten-, Write-Tool- und Rohpayload-Model-Input-Kandidaten ab, ohne Runtime, API, Persistenz, echte Daten oder LLM-Aufrufe einzufuehren.
- PA30 LLM-Readiness Eval-Fixture-Validation ist additiv in `shared-core/src/fixtures/llm-readiness-eval-fixtures.ts` und `docs/architecture/PA30_LLM_READINESS_EVAL_FIXTURE_VALIDATION.md` verankert: `validateLlmReadinessEvalFixture(...)` validiert komplette synthetische Fixtures gegen PA26-Output-, PA29-Input- und PA28-Registry-Grenzen ohne Prompttext, Provider, Modellaufrufe, API, Persistenz, echte Daten oder Schreibwirkung.
- PA31 LLM-Readiness SourceRef-Validation ist additiv in `shared-core/src/llm-readiness.ts` und `docs/architecture/PA31_LLM_READINESS_SOURCE_REF_VALIDATION.md` verankert: `llmReadinessSourceObjectTypes` begrenzt SourceRefs runtime-seitig auf bekannte sichere Arbeitsbelegtypen und laesst unbekannte Quelltypen in Input-/Output-Kandidaten nicht mehr durch.
- `tests/pa27-llm-readiness-eval-fixtures.test.ts` schuetzt synthetische IDs/Labels, deaktivierte Provider-Calls, `synthetic_or_demo_only`, Human-Approval-Pflicht, `writesProductObject: false` und das Verbot von Rohtext-, Prompt-, Provider-, Secret- oder Toolcall-Payloads.

### 5.341 - 2026-06-01
- PA32 LLM-Readiness StructuredCandidate-Validation ist additiv in `shared-core/src/llm-readiness.ts` und `docs/architecture/PA32_LLM_READINESS_STRUCTURED_CANDIDATE_VALIDATION.md` verankert: `validateLlmReadinessModelOutputCandidate(...)` begrenzt strukturierte Draft-Outputs auf flache Scalar-Maps und lehnt verschachtelte Objekte, Arrays, nicht-endliche Zahlen sowie verbotene Payload-Schluessel in `structuredCandidate` ab, ohne Runtime, API, Persistenz, echte Daten oder LLM-Aufrufe einzufuehren.

### 5.342 - 2026-06-01
- PA33 LLM-Readiness Output SourceRef-Validation ist additiv in `shared-core/src/fixtures/llm-readiness-eval-fixtures.ts` und `docs/architecture/PA33_LLM_READINESS_OUTPUT_SOURCE_REF_VALIDATION.md` verankert: `validateLlmReadinessEvalFixture(...)` verlangt, dass auch `expectedOutput.sourceRefs` die vom Draft-Kontrakt geforderten Quellobjekttypen enthalten, und meldet Input-/Output-SourceRef-Luecken getrennt, ohne Runtime, API, Persistenz, echte Daten oder LLM-Aufrufe einzufuehren.

### 5.343 - 2026-06-01
- PA34 LLM-Readiness SourceRef-Identity-Parity ist additiv in `shared-core/src/fixtures/llm-readiness-eval-fixtures.ts` und `docs/architecture/PA34_LLM_READINESS_SOURCE_REF_IDENTITY_PARITY.md` verankert: `validateLlmReadinessEvalFixture(...)` verlangt fuer Required-SourceRefs dieselben `objectId`s in Input und erwartetem Output, damit synthetische Eval-Drafts nicht auf gleichartige, aber andere Arbeitsbelege driften, ohne Runtime, API, Persistenz, echte Daten oder LLM-Aufrufe einzufuehren.

### 5.344 - 2026-06-04

- PA35 LLM-Readiness Draft-Registry-Coverage ist additiv in `shared-core/src/fixtures/llm-readiness-eval-fixtures.ts` und `docs/architecture/PA35_LLM_READINESS_DRAFT_REGISTRY_COVERAGE.md` verankert: `validateLlmReadinessEvalFixtureCoverage(...)` verlangt, dass jeder registrierte Draft-Kontrakt mindestens eine gueltige synthetische Eval-Fixture hat, und zaehlt ungueltige Fixtures nicht als Coverage, ohne Runtime, API, Persistenz, echte Daten oder LLM-Aufrufe einzufuehren.

### 5.345 - 2026-06-04

- PA36 LLM-Readiness Eval-Harness ist additiv in `shared-core/src/llm-readiness-eval-harness.ts` und `docs/architecture/PA36_LLM_READINESS_EVAL_HARNESS.md` verankert: `validateLlmReadinessEvalOutputCandidateMatch(...)` vergleicht synthetische Output-Kandidaten providerlos gegen gueltige Fixture-Erwartungen, inklusive `kind`, `sourceRefs`, Approval-/Write-Flags, `structuredCandidate` und normalisiertem Draft-Text, ohne Runtime, API, Persistenz, echte Daten oder LLM-Aufrufe einzufuehren.

### 5.346 - 2026-06-04

- PA37 LLM-Readiness Prompt-/Schema-Registry ist additiv in `shared-core/src/llm-readiness-prompt-schema-registry.ts` und `docs/architecture/PA37_LLM_READINESS_PROMPT_SCHEMA_REGISTRY.md` verankert: `llmReadinessPromptSchemaRegistry` registriert versionierte Prompt-, Policy- und Output-Schema-Artefakte pro Draft-Kontrakt, bleibt aber bewusst schema-only ohne Prompttext, Provider-Ausfuehrung, Runtime, API, Persistenz, echte Daten oder LLM-Aufrufe.

### 5.347 - 2026-06-05

- PA38 LLM-Readiness Fixture-ProviderAdapter ist additiv in `shared-core/src/llm-readiness-provider-adapter.ts` und `docs/architecture/PA38_LLM_READINESS_FIXTURE_PROVIDER_ADAPTER.md` verankert: `FixtureOnlyLlmReadinessProviderAdapter` nimmt nur gueltige synthetische Inputs an und gibt ausschliesslich passende Fixture-Erwartungsoutputs zurueck, ohne Prompt-Ausfuehrung, echten Provider, Runtime, API, Persistenz, echte Daten oder LLM-Aufrufe einzufuehren.

### 5.348 - 2026-06-05

- PA39 LLM-Readiness AgentAudit ist additiv in `shared-core/src/llm-readiness-agent-audit.ts` und `docs/architecture/PA39_LLM_READINESS_AGENT_AUDIT.md` verankert: `createLlmReadinessAgentAuditRecord(...)` verdichtet einen providerlosen Request-/PromptSchema-/FixtureAdapter-Lauf in einen kleinen Audit-Datensatz mit Prompt-/Policy-/Schema-Metadaten, Adapter-Modus, Approval-Grenze und Fehlerstatus, ohne Runtime, API, Persistenz, echte Daten oder LLM-Aufrufe einzufuehren.

### 5.349 - 2026-06-05

- PA40 LLM-Readiness Run-Result ist additiv in `shared-core/src/llm-readiness-run-result.ts` und `docs/architecture/PA40_LLM_READINESS_RUN_RESULT.md` verankert: `createLlmReadinessRunResult(...)` fasst einen providerlosen Request, die fixture-only Adapter-Response und den PA39-AgentAudit-Datensatz in ein validiertes synthetic-only Ergebnisartefakt mit Outcome, Prompt-/Policy-/Schema-Metadaten, Approval-Grenze und optionalem `outputCandidate` zusammen, ohne Runtime, API, Persistenz, echte Daten oder LLM-Aufrufe einzufuehren.

### 5.350 - 2026-06-05

- PA41 LLM Provider-/Daten-/Runtime-Entscheidungsrahmen ist additiv in `docs/architecture/PA41_LLM_PROVIDER_DATA_RUNTIME_DECISION_FRAME.md` verankert: Die providerlose PA26-PA40-Kette wird als abgeschlossen festgehalten, und der naechste echte Gate-Schritt fuer Alexander wird als Entscheidungsvorlage mit Optionen A/B/C, Empfehlung fuer einen minimalen synthetic-only Provider-Slice und sicherem Default ohne Provider formuliert.
- PA51 LLM Operator-/Kosten-/Approval-Entscheidungsrahmen ist additiv in `docs/architecture/PA51_LLM_OPERATOR_COST_APPROVAL_DECISION_FRAME.md` verankert: PA42-PA50 gelten als vorhandener lokaler synthetic-live Korridor, und die naechste Entscheidung fuer Alexander wird als lokaler Operator-, Kosten-, Modell- und Human-Approval-Rahmen formuliert, ohne Deployment-, Echte-Daten- oder Write-Gates zu oeffnen.
- PA52 Synthetic-Live Local Operator Runbook ist additiv in `docs/architecture/PA52_SYNTHETIC_LIVE_LOCAL_OPERATOR_RUNBOOK.md` verankert: Der kleinste lokale Bedienrahmen fuer PA51 Option B ist jetzt explizit dokumentiert mit benannten internen Operatoren, lokalen Secrets ausserhalb des Repos, synthetischen Fixtures, Kostenrahmen, Verbot von Raw Prompt-/Response-Logging und Human Approval vor jeder manuellen Uebernahme.
- PA53 Synthetic-Live Preflight Policy Hints ist additiv in `docs/architecture/PA53_SYNTHETIC_LIVE_PREFLIGHT_POLICY_HINTS.md` verankert: Der bestehende PA49-Preflight gibt jetzt zusaetzliche weiche Policy-Hinweise fuer lokalen Operatornamen und Budgetnotiz aus und markiert den Lauf als `policyReady`, ohne daraus ein neues hartes Runtime- oder Deployment-Gate zu machen.
- PA54 LLM Daten-/PII-Entscheidungsrahmen ist additiv in `docs/architecture/PA54_LLM_DATA_PII_DECISION_FRAME.md` verankert: Nach PA53 ist die naechste offene LLM-Grenze jetzt explizit als Datenrahmen-Vorlage beschrieben: synthetic/demo only oder hoechstens nachweisbar anonymisierte, reduzierte Draft-Inputs; pseudonymisierte oder echte Daten bleiben weiter blockiert.
- PA55 LLM Trusted-Operator-/Auth-Entscheidungsrahmen ist additiv in `docs/architecture/PA55_LLM_TRUSTED_OPERATOR_AUTH_DECISION_FRAME.md` verankert: Die naechste LLM-Betreibergrenze oberhalb von `synthetic_live` ist jetzt explizit beschrieben: lokal-only oder spaeter nur hinter Trusted-Proxy/IAP-Kontext; freie Client-Header und lokales `x-actor-name` werden nicht zu belastbarer LLM-Auth hochgestuft.

### 5.351 - 2026-07-01

- BYO-AI Catering Harness erster ausfuehrbarer Vertrag ist additiv in `shared-core` verankert: `ProductionDraft` buendelt KI-/CLI-/manuell importierte Produktionsentwuerfe als draft-only Artefakt mit Source-Metadaten, harten Guardrails, Review-Karten und bestehenden Spec-/Plan-/Rezept-/Einkaufslisten-Bausteinen.
- `tests/production-draft-contract.test.ts` schuetzt gueltige Produktionsentwuerfe, mindestens ein Draft-Artefakt, Raw-Payload-Leak-Verbot, `writesProductObjects: false` und die einfachen Review-Entscheidungen `pending`/`fits`/`change_requested`/`unclear`/`blocked`. Keine neue API, UI, Persistenz, Provider-Abhaengigkeit, Produktwrite-Logik, echte Daten oder automatische Freigabe.

### 5.352 - 2026-07-12

- Der gemeinsame Caddy-Proxy importiert zusaetzliche serverseitige `*.caddy`-Site-Dateien aus einem nur lesbar eingebundenen, deploygeschuetzten Verzeichnis. `platform-infra/sites` bleibt ausserhalb von Git und wird durch den Hetzner-Rsync nicht geloescht; dadurch koennen anwendungseigene Hostbloecke einen Plattform-Neubau ueberleben. Der Vertrag ist in `tests/hetzner-deploy-script.test.ts` abgesichert und mit einer leeren sowie einer EventOS-belegten Site-Ablage gegen Caddy 2.10 validiert. Keine Aenderung an Produktlogik, API, Persistenz, Auth oder fachlichen Workflows.

### 5.353 - 2026-08-11

- Stage A wurde bis zum Kontrollpunkt fortgesetzt. Die Aufgaben 1 bis 7 sind auf `origin/main` durch die zusammengeführten PRs 590 bis 596 belegt; PR 596 erhielt mit PR 597 noch eine eng begrenzte Redigierung fehlerhafter Provider-Kennungen. Der endgültige `main`-SHA ist `51f6cbc36f9f3ec93f5b7fd7d5d7cdb170e15e3b`.
- Der externe Provider-Gate ist vor Fetch und Subprozess geschlossen, wenn die serverseitige Freigabe nicht exakt passt. OpenAI und Codex CLI teilen dieselbe Grenze; Fixture-Betrieb bleibt lokal. `ApprovalRequestRecord` bleibt die einzige fachliche Freigabewahrheit.
- Vollständige serielle Suite, Typprüfung, Build, beide Audits, internes Beta-Gate und die CI-Läufe von PR 596/597 waren grün. PostgreSQL-spezifische Konkurrenztests blieben wegen fehlender lokaler PostgreSQL-Instanz übersprungen. Keine echte externe KI-Ausführung, keine realen Unternehmens- oder Kundendaten und keine Infrastrukturänderung.
- Aufgabe 8 bis 12 bleiben bis zu einer ausdrücklichen Supervisor-Entscheidung offen; dieser Eintrag ist eine geprüfte Übergabe und keine neue Roadmap.

### 5.354 - 2026-08-11

- Der Codeanker des Stage-A-Kontrollpunkts bleibt `51f6cbc36f9f3ec93f5b7fd7d5d7cdb170e15e3b`; die dazugehörige geprüfte Übergabe wurde mit PR 598 als `5b879d5de22bf276d8e1a3d56e8e203303ece809` in `main` aufgenommen. Es gab keine Runtime-, API-, Persistenz- oder Infrastrukturänderung.

### 5.355 - 2026-08-12

- SB-02 ist an beiden Schreibgrenzen geschlossen: Die Produktionstexteingabe deaktiviert die Aktion bei leerem oder nur aus Leerraum bestehendem Text; die Submit-Aktion und `POST /v1/intake/normalize` weisen solche Eingaben mit `Bitte Beschreibung eingeben` vor jeder Speicherung ab. Gezielte Tests sichern Schreibwirkungsfreiheit, verständliche Fehlermeldung und den unveränderten gefüllten Pfad. Keine neue API, Persistenz oder Architektur.

### 5.356 - 2026-08-12

- SB-01 ist im bestehenden Angebotsweg geschlossen: Die Aktion `Entwurf aus Text erstellen` bleibt bei leerem oder nur aus Leerraum bestehendem Text deaktiviert; der Submit-Guard weist einen programmgesteuerten Leertext mit `Bitte Beschreibung eingeben` vor Fall- und API-Aufruf ab. Der gefüllte Angebotsweg bleibt unverändert; keine neue API, Persistenz oder Architektur.

### 5.357 - 2026-08-15

- PR 611 repariert die dokumentierten Produktionsreferenz-CLI-Flags: `--source`, `--expectation`, `--provider` und `--report` werden explizit auf `sourcePath`, `expectationPath`, `provider` und `reportPath` abgebildet; unbekannte, doppelte, fehlende oder wertlose Argumente bleiben fail-closed. Der korrigierte Runner ist mit 4/4 fokussierten P1-Regressionsfällen sowie TypeScript, Build und Shell-Syntax geprüft.
- PDF-Produktionsreferenzen laufen über den bestehenden `validateUploadedDocument`-/`ingestDocument`-Pfad; der Provider erhält extrahierten Text statt PDF-Rohbytes, während der SHA-256-Bezug den unveränderten Originalbytes gilt. Der lokale Test prüft die Extraktion mit injiziertem Offline-Transport; ein echter externer Provideraufruf ist nicht Bestandteil des Nachweises.
- Der Scope bleibt auf die bereits geprüften zwei Reparaturdateien plus diese Memory-Historie begrenzt. Keine neue API, Persistenz, Migration, Deploymentlogik oder Produktdaten; unterstützte Dateityp-, Größen-, Lesbarkeits-, Autorisierungs- und Providerfehler bleiben fail-closed. Die bekannten lokalen Critical-Section-Ausnahmen sind gegenüber der Basis unverändert und werden nicht als grüner Vollsuite-Nachweis ausgegeben; PR-CI 31864109063 (build-and-test 94962287506, browser-rehearsal 94962287484) war am unveränderten Reparatur-Head terminal grün.

### 5.358 - 2026-08-15

- Der Produktionsreferenz-Runner prüft nach Pfad- und Autorisierungsprüfung den SHA-256 der gelesenen Originalbytes vor Dokumentvalidierung und Textextraktion. Bei einer Abweichung wird deterministisch `source_contract_failed` berichtet, ohne PDF-/Dokumentparser oder Providertransport aufzurufen; bei identischem Hash bleibt der bestehende Validierungs-, Extraktions- und PDF-Erfolgspfad erhalten.
- Der P2-Regressionsvertrag belegt diesen Reihenfolgeanker, den unveränderten Originalbyte-Hash im Report, den einmaligen Extraktions- und Provideraufruf bei Übereinstimmung sowie die bisherigen fail-closed Quellenfehler. Es gibt keine neue API, Persistenz, Migration oder externe Providerausführung.

### 5.359 - 2026-08-15

- Der vorgezogene `source_contract_failed`-Report löst das registrierte Produktionsreferenz-Promptschema nun vor der Hash-Fehlerantwort auf und führt `promptSchemaId`, `promptArtifactId` und `promptVersion` vollständig mit. Die Hash-Prüfung bleibt vor jeder Dokument-/PDF-Extraktion; bei Abweichung bleiben Extraktor und Providertransport unaufgerufen.
- Der Regressionstest prüft die vollständigen Reportmetadaten im Hash-Mismatch- und PDF-Erfolgspfad sowie weiterhin null Aufrufe bei Abweichung und genau einen Extraktions-/Provideraufruf bei Übereinstimmung. CLI-Flag-Mapping, Offline-Transport und bestehende fail-closed Quellenverträge bleiben unverändert; keine API, Persistenz, Migration, echte Providerausführung oder Produktionsdaten.

### 5.360 - 2026-08-15

- Stage A Task 12 ist im ungemergten PR-#612-Kandidaten auf `loop/stage-a-complete-chain` umgesetzt: lokale Business-Scope-Migration, die unveränderliche Angebots-zu-Produktionskette, die vollständige Business-Isolationsmatrix, der reale UI-/Reload-/Search-/Revision-/Copy-Fluss sowie die freigegebenen Kompatibilitäts- und Persistence-Boundary-Entfernungen sind durch den Kandidatenscope belegt. `hostedMultiBusinessReady` ist codefest `true`, weil die Matrix aus Route-, Store-, Audit- und HTML-/CSV-Exportverträgen grün geprüft wurde; der Wert bleibt unabhängig von Umgebungsflags.
- Der Kandidat ist noch nicht in `main` übernommen: der geprüfte PR-Head vor diesem Folgefix ist `2b2b05d5a57ab216fe31fbe599f4a114983e5c89`, Basis und `main` bleiben `66f354c7715e766b59d9f6407638c05da5ad3394`. Frühere Einträge mit „Aufgabe 8 nicht begonnen“ beziehungsweise „Aufgaben 8 bis 12 offen“ sind historische Übergabestände und werden für den aktuellen Kandidaten ausdrücklich überholt; sie bleiben als Historie erhalten.
- Der P2-Fix für sandboxiertes macOS behandelt einen verweigerten `ps`-Aufruf jetzt strikt als unverifizierbare Prozessidentität. Eine instanzlokale `Date.now() - process.uptime()`-Schätzung wird nicht mehr als Fingerprint persistiert; dadurch kann eine alte Mtime keinen Live-Lock bei unabhängig geladenen Modulinstanzen freigeben. Der Darwin-Regressionstest simuliert zwei Modulinstanzen mit um eine Millisekunde verschobenen Zeitpunkten und prüft die unveränderte Sperre; Linux- und `ps`-Erfolgspfade bleiben unberührt.
- Die Dokumentation hält den Stand als Kandidat für eine erneute unabhängige Prüfung fest. Es gibt keine neue API, Persistenzwelt, Migration gegen Produktdaten, externe Providerausführung, Produktionsschreibwirkung, Deployment-, Tag- oder Releaseaktion.

### 5.361 - 2026-08-15

- PR #612 wurde am 2026-08-15 um 17:03:06 UTC als `5393363fd5a0d7453461eca9bc141655c232b21a` nach `main` gemergt. Der Main-Tree ist `c9fbab19a70426c9c461356b75953304b41e5761`; der frühere PR-Head `bf255be310aadca56bc0b5cfbff2c7cd1da46097` bleibt als historischer Vorgänger mit demselben Tree dokumentiert.
- Task 12 und die acht unabhängig geprüften Reviewbefunde sind mit PR #612 in `main` angekommen: entkoppelter History-/Workspace-Filter, read-only Legacy-Reader, fail-closed Darwin-Fingerprint, nachvollziehbarer Stage-A-Abschluss, unabhängiger Workspace-Filter, Hosted-Secret-Gate, Hosted-Business-ID-Gate und US-037-Nachweis. Die GitHub-Reviewthreads sind historische Prüfspur; dieser Eintrag behauptet keine zusätzliche Threadmutation.
- Main-CI Run `31897217407` ist für `5393363…` mit `build-and-test` (Job `95042251327`) und `browser-rehearsal` (Job `95042251392`) terminal erfolgreich. Merge und Main-CI sind belegt; daraus folgen weder eine Deploymentfreigabe noch eine produktive Migration.
- Die früheren Aussagen „PR offen“, „nicht gemergt“ und „wartet auf Merge“ bleiben historische Übergabestände in den älteren Versionen. Für den aktuellen Stand ist PR #612 gemergt; weitere Stage-A-Arbeit bleibt bis zu einem neuen Supervisor-Auftrag out of scope.
