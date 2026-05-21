# memory.md

version: 5.121
date: 2026-05-21
status: active
repo: AlexanderSmyslowski/catering-agents-platform

## Zweck
Diese Datei ist die fuehrende Kurzreferenz fuer neue Chatfenster, Hermes Agent, Codex 5.4 mini und andere Arbeitskontexte.
Sie soll den aktuellen Projektstand, den Governance-Bauplan, die Leitplanken und den naechsten explizit beauftragten Schritt knapp und belastbar festhalten.
Sie ist wieder die fuehrende Root-Memory-Datei des Repos.

## Repo-Kontext
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
- P1 Rollen-/Rechte-Arbeit ist in einer ersten MVP-Stufe real verankert und gezielt verifiziert: zentrale Konvention im `shared-core` plus Guards fuer die mutierenden Intake-, Offer- und Production-Kernpfade, den Demo-Seed-/Audit-Korridor und die Recipe-Review-/Finalize-Pfade; kleiner Access-Control-Korridor ist gruen
- P3-Betriebscheck ist bewusst konsolidiert und soll nicht weiter in Mikro-Härtungen ausfransen; naechster sinnvoller Block liegt ausserhalb von P3, bevorzugt im Shared-Core-/Access-Control-/Governance-Anker
- P3 Stufe 1 und 2 sind begonnen und mit reproduzierbarem lokalem Betriebscheck gehärtet; der Check bestaetigt Exportpfad und einen read-only Audit-Beleg fuer den Demo-Startweg in gehärteter Form
- P4 zielt auf Audit-/Review-/Nachvollziehbarkeit: vorhandene Nachweise, Operator-Zuordnung und geschuetzte Kernpfade betriebsnah schaerfen, der Traceability-Strang ist inzwischen testseitig belegt und soll stehen bleiben
- P4 Traceability wurde zusätzlich als kleiner Regressionstest `tests/p4-audit-traceability.test.ts` codiert und grün verifiziert; die Traceability umfasst Produktionsseed, Produktionsreview, Angebotsreview und Intake-Finalize, inklusive synchronisiertem `.ts`/`.js`-Runtimepfad fuer den Intake-Finalize-Audit-Eintrag
- P5 MVP-Abgrenzung pro Kernbereich ist als schmale Mini-Spezifikation dokumentiert; sie trennt vorhandenen internen MVP-Kern, bewusste Nicht-Ziele und spaetere Produktisierung ohne neue Featureliste.
- P6 Aufbewahrung, Loeschung und Archivierung ist als schmale Mini-Spezifikation dokumentiert; sie begrenzt den vorsichtigen Umgang mit operativen Daten und Artefakten ohne neue Retention- oder Archivplattform.
- P7 Betriebsfreigabe / MVP-Freigabekriterien ist als schmale Mini-Spezifikation dokumentiert; sie fasst den kleinen repo-gebundenen Go/No-Go-Rahmen fuer interne MVP-/Beta-Nutzung zusammen, ohne neue Release- oder Monitoring-Plattform.
- P2 Browser-/Smoke-Absicherung ist jetzt real belegt: der lokale Smoke-Korridor prueft die drei UI-Routen, die vier Health-Endpunkte und die drei read-only Exportpfade; ergaenzend existiert ein minimaler repo-verankerter UI-Route-Smoke-Test fuer `/`, `/angebot` und `/produktion`, dessen Angebots- und Produktions-Assertions auf route-eindeutige Marker geschaerft sind
- Die Backoffice-API-Testspur sichert nun auch die zentralen read-only Export-Link-Helper fuer Angebot, Produktionsplan und Einkaufsliste gegen Pfaddrift ab.
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
- PA9 Proxy-/Deployment-Readiness ist als ADR `docs/architecture/PA9_PROXY_DEPLOYMENT_READINESS_ADR.md` dokumentiert und mit `tests/pa9-proxy-deployment-readiness-adr.test.ts` abgesichert: Edge muss clientseitige Trusted-/Actor-Header entfernen, Proxy/IAP setzt `x-catering-actor-name` plus `x-catering-trusted-secret` kontrolliert, `CATERING_TRUSTED_ACTOR_SECRET` ist produktionsnah Pflicht, Secret bleibt serverseitig, Services duerfen nicht direkt oeffentlich erreichbar sein; keine OIDC-/Login-/Session-Implementierung.
- PA10 DocumentIngestion-v1 Boundary ist als kleiner `shared-core`-Baustein umgesetzt: `DocumentIngestionResult` kapselt vorhandene Upload-`sourceMetadata`, Kontext, Status, Warnungen, Ingestion-Zeitpunkt und optional extrahierten Text, ohne neue Parser-Engine, API, Persistenz, Angebotssemantik, LLM-, OCR-, Rezept- oder Allergenlogik.
- PA11 Intake DocumentIngestion Bridge ist umgesetzt: bestehende Intake-Dokumentnormalisierung fuer JSON/Base64 und Multipart nutzt intern `ingestDocument(...)`; Antworten und Audit-Details transportieren nur sichere Ingestion-Status-/Warnungsmarker und vorhandene `sourceMetadata`, waehrend Conversation-/Export-Provenance-Anker weiterhin keine Rohtexte spiegeln.
- PA12 Read-only Ingestion-Warnungen sind sichtbar: bestehende Intake-Detail- und `/produktion`-Conversation-Kontexte zeigen sichere `documentIngestion`-Marker fuer fallback/failed Quellen als knappe Warnhinweise, extracted/ok bleibt ruhig. Keine neue API-Welt, Persistenz, Migration, Parser-Engine, OCR, LLM-/Tool-Use-, Rezept-, Allergen- oder neue Produktlogik.
- PA13 Ingestion-Warnungen in Exportankern ist umgesetzt: sichere fallback/failed `documentIngestion`-Marker werden ueber vorhandene `sourceAnchors` in Produktionsoutput-/Downloadanker und Produktionsplan-HTML-Exports weitergereicht; extracted/ok bleibt ruhig, Rohtexte/extractedText werden nicht gespiegelt.
- PA14 DocumentIngestion-Korridor ist als read-only Abnahmeanker in `tests/pa14-document-ingestion-corridor-readiness.test.ts` und `TESTING.md` abgesichert: Quelle vorhanden -> Ingestion-Status sichtbar -> Warnungen sichtbar -> Exportanker sicher; Rohtexte werden nicht gespiegelt und es wurde keine neue API, UI, Persistenz, Parser-, OCR-, LLM-, Rezept- oder Allergenlogik eingefuehrt.
- PA15 ProductionAgent-v1 Next Capability ADR ist als Entscheidungsvorlage in `docs/architecture/PA15_PRODUCTION_AGENT_NEXT_CAPABILITY_ADR.md` dokumentiert und mit `tests/pa15-productionagent-next-capability-adr.test.ts` abgesichert: Empfohlen wird Option A Rueckfragenmodell / Clarification Model als naechste echte, eng begrenzte Agentenfaehigkeit; keine Runtime-Implementierung, API, Persistenz, LLM-/Tool-Use-, Rezept- oder Allergenlogik.
- Leitlinien bleiben bindend:

  - keine neue Persistenzwelt / kein Prisma ohne bewussten Grossschnitt
  - kleine echte Bausteine
  - bestehende Approval-Request-Mechanik bleibt fuehrende Freigabewahrheit
  - Governance additiv, nicht als zweiter Kern
  - keine Vermischung von Stufen
  - keine Out-of-Scope-Themen still mitziehen

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
- PA6 Interne Beta-/Abnahme-Readiness ist als Doku-only-Slice in `docs/product/PA6_INTERNAL_BETA_READINESS_SUMMARY.md` umgesetzt und mit `tests/pa6-beta-readiness-summary.test.ts` gegen die zentralen Readiness-/Gate-Aussagen abgesichert.
- Der Slice fuehrt keine neue Runtime-Funktion, UI, API, Persistenz, Monitoring-Engine, LLM-/Tool-Use-/PDF-Parser-/OCR-/Rezept-/Allergenlogik ein; externe oder echte produktive Nutzung bleibt ohne OIDC/SSO, read-path Auth, Sandbox/AV, Retention/PII und Human-Approval-/Architekturentscheidungen nicht freigegeben.

### 5.113 - 2026-05-21
- PA7 AuthN/AuthZ + read-path Auth ist als Doku-only-Entscheidungs-ADR in `docs/architecture/PA7_AUTH_READ_PATH_DECISION_ADR.md` umgesetzt und mit `tests/pa7-auth-read-path-decision-adr.test.ts` gegen Optionen, Empfehlung und Scope-Grenzen abgesichert.
- Empfohlen ist Option D als Stufenmodell: naechster Runtime-Slice nur read-only Detail-/Export-/Audit-Pfade auf bestehender Trusted-Actor-/Rollenbasis haerten; externe oder produktionsnahe Nutzung bleibt bis zur Reverse-Proxy/OIDC/SSO- bzw. Identity-Aware-Proxy-Entscheidung gesperrt, ohne Login-, Session-, Persistenz- oder OIDC-Implementierung in diesem ADR-Slice.

### 5.114 - 2026-05-21
- PA8 Read-path Auth Hardening Slice 1 ist umgesetzt und mit `tests/pa8-read-path-auth.test.ts` abgesichert: bei gesetztem Trusted-Secret reichen freie `x-actor-name`-Header fuer sensible read-only Detail-/Listen-/Exportpfade nicht mehr aus; passende Trusted-Actor-Header erlauben die rollenbezogenen Read-Zugriffe.
- Geschuetzt sind Intake-Requests/-Specs, Offer-Drafts/-Recipes, Production-Plans/-Purchase-Lists/-Recipes, der bestehende Production-Audit-Feed sowie Print-Exports fuer Angebot, Produktionsplan und Einkaufsliste; Health-Endpunkte bleiben unauthentifiziert, und externe Nutzung bleibt weiterhin ohne Reverse Proxy/OIDC/SSO bzw. Identity-Aware Proxy gesperrt.

### 5.115 - 2026-05-21
- PA9 Proxy-/Deployment-Readiness ist als Doku-/Konfigurationsanker `docs/architecture/PA9_PROXY_DEPLOYMENT_READINESS_ADR.md` umgesetzt und mit `tests/pa9-proxy-deployment-readiness-adr.test.ts` gegen Muss-Anforderungen, Health-Grenzen, Preflight und Nicht-Ziele abgesichert.
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
