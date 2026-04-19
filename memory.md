# memory.md

version: 5.81
date: 2026-04-19
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
- P4 Traceability wurde zusätzlich als kleiner Regressionstest `tests/p4-audit-traceability.test.ts` codiert und grün verifiziert; die Traceability umfasst Produktionsseed, Produktionsreview, Angebotsreview und Intake-Finalize
- P2 Browser-/Smoke-Absicherung ist jetzt real belegt: der lokale Smoke-Korridor prueft die drei UI-Routen, die vier Health-Endpunkte und die drei read-only Exportpfade; ergaenzend existiert ein minimaler repo-verankerter UI-Route-Smoke-Test fuer `/`, `/angebot` und `/produktion`, dessen Angebots- und Produktions-Assertions auf route-eindeutige Marker geschaerft sind
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
|- P22 minimaler Restpunkt- und Nachziehrahmen vor Beta-Abschluss im MVP ist als schmale Mini-Spezifikation ergänzt worden; er begrenzt den Umgang mit kleinen Restpunkten vor einem sauberen Beta-Abschluss ohne ein formales Defect-, QA- oder Release-Management zu konstruieren
|- P23 minimaler interner Beta-Abschluss- und Dokumentationsstand im MVP ist als schmale Mini-Spezifikation ergänzt worden; er begrenzt die kleine Abschlusssicht auf konsistente Dokumente, PR und memory ohne ein formales Abschluss-, QA- oder Governance-System einzuführen
- P25 minimaler interner Nutzungsrahmen nach Beta-Uebergabe im MVP ist als schmale Mini-Spezifikation ergänzt worden; er begrenzt den laufenden internen Nutzungsstand nach der Beta-Uebergabe ohne ein formales Betriebs-, Support- oder Governance-Modell einzuführen
|- P26 minimaler interner Stabilisierungsrahmen in laufender Nutzung im MVP ist als schmale Mini-Spezifikation ergänzt worden; er begrenzt den laufend ruhigen internen Nutzungsstand ohne ein formales Betriebs-, Monitoring- oder Support-Modell einzuführen
|- P27 minimaler interner Reaktionsrahmen bei Instabilitaet in laufender Nutzung im MVP ist als schmale Mini-Spezifikation ergänzt worden; er begrenzt die erste Reaktion auf Instabilitaetssignale ohne ein formales Incident-, Support- oder Betriebsreaktionsmodell einzuführen
|- P21 minimaler Uebergang von Beta zu intern nutzbarem Produktstatus im MVP ist als schmale Mini-Spezifikation ergänzt worden; er begrenzt die Einordnung eines Beta-Standes in einen intern tragfaehigen Nutzungsstand ohne ein formales Release-, Betriebs- oder Steuerungsmodell einzuführen
- Im Backoffice sind mehrere kleine Status-/Orientierungskarten in Start-, Angebots- und Produktionsansicht real umgesetzt; der UI-Orientierungsstrang ist bewusst klein und soll nicht weiter in Mikro-Karten ausfransen
- Onboarding ist als spaeterer Architektur-/Produktstrang vorgemerkt; aktuell noch nicht Teil des aktiven MVP-Umsetzungsblocks
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
