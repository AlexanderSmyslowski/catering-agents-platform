# Pflichtenheft – Catering Agents Platform

Status: Entwurf v0.1 auf Basis des aktuellen Repo-Iststands

Stand: 2026-04-17

## 1. Zweck des Dokuments

Dieses Dokument beschreibt den aktuellen fachlichen und technischen Ziel- und Arbeitsrahmen der Repository-basierten Catering Agents Platform. Es ist bewusst repo-gebunden, lebt vom realen Ist-Stand und ersetzt kein abstraktes generisches Projektpapier.

Zweck ist:
- den aktuellen Produktumfang nachvollziehbar zu ordnen
- bereits umgesetzte und dokumentierte Bausteine sauber von offenen Punkten zu trennen
- einen belastbaren Planungsanker für weitere Konkretisierung bereitzustellen
- Scope-Ausweitung ohne expliziten Auftrag zu verhindern

## 2. Projektkontext

### 2.1 Repository und Produkt

- Repository: `AlexanderSmyslowski/catering-agents-platform`
- Produkt: Catering Agents Platform
- Repositoriumstyp: Monorepo mit spezialisierten Catering-Agenten und interner Backoffice-UI

### 2.2 Führende Dokumente

Die aktuelle Planung ist nicht in einem separaten klassischen Pflichtenheft verankert, sondern faktisch in folgenden Dokumenten geführt:

- `memory.md`
- `docs/architecture/MEMORY_ARCHITECTURE.md`
- `README.md`
- ergänzend: `docs/deployment-and-versioning.md`

Dieses Pflichtenheft bündelt den daraus ableitbaren, repo-konsistenten Rahmen.

### 2.3 Aktueller Arbeitskontext laut Repo-Dokumentation

Aus den Führungsdokumenten ergibt sich:
- Governance-Pfad bis einschließlich Stufe 6c ist umgesetzt und fachlich grün / abnahmefähig.
- M1 Owned Memory Foundation ist im aktuellen Ausbaustand vorerst konsolidiert und abgeschlossen.
- Die aktuelle Phase ist ausdrücklich eine Konsolidierungsphase ohne neue Fachlogik.
- Neue Persistenzwelt, Prisma, Hard-Approve und größere Governance-Ausweitungen sind nicht Teil des aktuellen Scopes.

## 3. aktueller Ist-Stand des Produkts

### 3.1 Bereits umgesetzt im Repo / in der Produktbeschreibung verankert

Im aktuellen Repo-Stand sind laut README und zugehörigen Implementierungsbereichen folgende Produktbausteine vorhanden:

- `offer-service` als Angebots-CoPilot
- `intake-service` für Intake, Parsing und Normalisierung
- `production-service` als Produktions-/Küchen-CoPilot
- `shared-core` mit kanonischen Schemata, Regeln und Taxonomien
- `print-export` für HTML-/CSV-Exporte
- `backoffice-ui` als interne Web-App
- lokaler Stack-Start über `npm run local:start`
- Service-Status und Demo-Seeding über Admin-Pfade
- Audit-Log / Audit-Feed übergreifend über Intake, Offer und Production
- Rezept-Upload und Rezept-Review mit Freigabe, Verifizierung oder Ablehnung
- Produktionsansichten mit Suchspur je Gericht
- persistierte Intake-Anfragen können gezielt über `GET /v1/intake/requests/:requestId` gelesen werden
- der Request-Detailpfad liefert zusätzlich die verknüpften `AcceptedEventSpec`-IDs zur Herkunftsnachverfolgung

### 3.2 Dokumentiert, aber nicht als neue Produktbehauptung weiter ausgebaut

Folgende Punkte sind im Repo dokumentiert und werden als bestehender Rahmen verstanden:

- Deployment über Hetzner-VM als interne Plattform
- Reverse-Proxy mit HTTPS vor UI und APIs
- Datenhaltung dateibasiert unter `CATERING_DATA_ROOT` oder alternativ PostgreSQL über `CATERING_DATABASE_URL`
- interne Rollen für Angebots-Ersteller und Produktionsplanung
- Audit-Nachvollziehbarkeit für mutierende Aktionen
- M1-Memory-Strang als modellagnostische Architekturgrundlage

### 3.3 Offen / noch nicht belastbar als vollständige Produktgarantie abgesichert

Offen bleibt insbesondere:
- exakte Permission-Matrix zwischen den Rollen
- formale Authentifizierungs- und Autorisierungsdetails
- Produktionsreife im vollständigen Deployment unter allen Zielumgebungen
- Backoffice-UI-Abdeckung über alle Fachpfade im Browserbetrieb
- weitere Governance-Erweiterungen jenseits des dokumentierten Stands

## 4. Zielbild

Die Catering Agents Platform soll eine interne, nachvollziehbare und stabile Betriebsplattform für Catering-/Event-/Hospitality-Prozesse sein.

Zielbild ist:
- Intake aus realen Quellen verlässlich in strukturierte operative Daten zu überführen
- Angebote und Produktionsplanung aus denselben Grunddaten konsistent abzuleiten
- Rezeptwissen zentral nutzbar zu machen
- operative Entscheidungen über Export, Audit und Review nachvollziehbar zu halten
- die Plattform intern und nicht als offene Multi-Tenant- oder White-Label-Lösung zu betreiben

## 5. fachliche Kernprozesse

### 5.1 Intake und Normalisierung

- Eingang von Text, Dokumenten und anderen unterstützten Quellen
- Normalisierung zu `AcceptedEventSpec`
- Nachbearbeitung unvollständiger Spezifikationen im Backoffice
- Herkunft eines normalisierten Vorgangs bleibt über die persistierte Intake-Anfrage und verknüpfte Spec-IDs nachvollziehbar

### 5.2 Angebotsprozess

- Erzeugung von Angebotsentwürfen aus strukturierten Event-Daten
- Varianten- und Entwurfsverwaltung innerhalb des bestehenden Produktkerns

### 5.3 Produktionsplanung

- Ableitung von Produktionskontexten aus Spezifikationen und Angeboten
- Sichtbarkeit von Rezeptsuche, internen Kandidaten und Verwerfungsgründen
- operative Planung für Küche / Produktionsplanung

### 5.4 Rezeptbibliothek und Review

- Upload von Rezepten aus mehreren Eingangswegen
- Text- und PDF-basierte Verarbeitung
- Review-Entscheidungen: Freigabe, Verifizierung, Ablehnung

### 5.5 Exporte und operative Nachweise

- HTML-/CSV-Export für Angebot, Produktionsblatt und Einkaufsliste
- nachvollziehbare operative Artefakte für interne Verwendung

### 5.6 Governance und Änderungsspur

- read-first Governance-Sichtbarkeit
- Finalize-Funktion als separate Aktion
- klare Unterscheidung zwischen finalisiert und freigegeben

## 6. zentrale Produktbausteine

### 6.1 Backoffice-UI

- zentrale Web-Oberfläche
- Startseite mit Agentenwahl
- getrennte Bereiche für Angebot, Produktion und weitere operative Bereiche

### 6.2 Intake-Service

- Normalisierung von Eingaben
- Verarbeitung verschiedener Dokumenttypen
- Ableitung strukturierter Veranstaltungsdaten
- Detailzugriff auf persistierte Intake-Anfragen mit Herkunftsbezug zu verknüpften Spezifikationen

### 6.3 Offer-Service

- Angebotsentwürfe
- Angebotsvarianten
- operative Angebotsableitung

### 6.4 Production-Service

- Produktionsplanung
- Rezeptsuche und Suchspur
- operative Produktionsdaten

### 6.5 Print-Export

- HTML- und CSV-Exports
- getrennte Exportoberfläche für operative Artefakte

### 6.6 Shared Core

- kanonische Schemata
- Taxonomien
- Regeln
- Datenmodelle als gemeinsame fachliche Basis

## 7. Muss-Anforderungen

Diese Anforderungen sind aus dem aktuellen Repo-Stand und den führenden Dokumenten ableitbar und für den MVP-Kern verbindlich.

1. Das System muss Eingänge aus unterstützten Quellen in strukturierte Veranstaltungsdaten normalisieren können.
2. Das System muss Angebots- und Produktionspfade aus denselben Grunddaten bedienen können.
3. Das System muss eine interne Backoffice-UI für operative Arbeit bereitstellen.
4. Das System muss Rezeptdaten zentral und wiederverwendbar nutzbar machen.
5. Das System muss Exporte für operative Artefakte bereitstellen.
6. Das System muss mutierende Fachaktionen auditierbar halten.
7. Das System muss zwischen finalisiert und freigegeben fachlich unterscheiden.
8. Das System muss den Konsolidierungsstand ohne neue Fachlogik respektieren.
9. Das System muss ohne neue Persistenzwelt oder Prisma weiter betreibbar bleiben.
10. Das System muss die Herkunft normalisierter Spezifikationen über den Intake-Kontext nachvollziehbar halten.

## 8. Soll-Anforderungen

1. Die Rollen im UI sollen fachlich klar getrennt und verständlich benannt sein.
2. Status- und Änderungsspur sollen im bestehenden Produktkontext lesbar sein.
3. Der lokale Stack soll reproduzierbar und für interne Entwicklung einfach startbar bleiben.
4. Der Deploy-Pfad soll in der Dokumentation eindeutig und wartbar beschrieben sein.
5. Audit- und Review-Kontexte sollen im UI nachvollziehbar sichtbar bleiben.
6. Die Produktlogik soll deterministisch und gut testbar bleiben.

## 9. Kann-Anforderungen

1. Zusätzliche read-only Transparenz in bestehenden Detailansichten.
2. Weitere sprachliche Präzisierung bestehender Fachzustände.
3. Zusätzliche kleine Hilfen zur Bedienbarkeit innerhalb bestehender UI-Flows.
4. Weitere Härtung von lokalen Entwickler- und Demo-Pfaden, sofern ohne Scope-Ausweitung möglich.

## 10. Nicht-Ziele / Out of Scope

Folgende Punkte sind aktuell ausdrücklich nicht Ziel dieses Pflichtenhefts:

- neue Multi-Tenancy
- White-Label- oder Plattformvermarktung
- neue API-Endpunkte ohne expliziten Auftrag
- neue Persistenzsysteme
- Prisma als neuer Kern ohne bewussten Großschnitt
- Hard-Approve-Logik
- Snapshots / `lastHardApproved`
- Point-of-no-return-Ausbau
- ChangeItem-Persistenz
- ChangeItem-Anzeige
- zusätzliche Governance-Workflows
- neue Produktfläche außerhalb des bestehenden Monorepos und der internen Backoffice-UI
- ungebundene Roadmap-Erfindung

## 11. technische Leitplanken

### 11.1 Grundsätze

- deterministischer, prüfbarer Produktkern
- kleine echte Bausteine vor großen Architekturverschiebungen
- Governance additiv, nicht als zweiter Kern
- keine neue Persistenzwelt ohne ausdrückliche Entscheidung
- keine stillen Erweiterungen

### 11.2 Architekturbezug

Die Memory- und Harness-Grundlage ist in `docs/architecture/MEMORY_ARCHITECTURE.md` beschrieben. Daraus folgt für dieses Pflichtenheft:
- M1 ist architektonisch konsolidiert
- das Dokument ist führend für die Memory-Strang-Definition
- Implementierungserweiterungen dürfen diesen Rahmen nicht ohne bewussten Großschnitt verschieben

### 11.3 Betriebsprinzip

- lokal reproduzierbarer Stack
- interne Nutzung vor externer Plattformisierung
- klare Trennung zwischen UI, Services und Export

## 12. Datenobjekte / zentrale Domänenobjekte

### 12.1 Reale bzw. kanonisch geführte Domänenobjekte

- `AcceptedEventSpec`
- `SpecRecord`
- `OpenIssueRecord`
- `ProductionPlanRecord`
- Angebotsentwurf / Angebotsvariante im Offer-Kontext
- Rezeptdatensatz / Rezeptkandidat
- Audit-Event / Audit-Eintrag
- persistierte Intake-Anfrage (`EventRequest`) als nachvollziehbarer Eingangsanker

### 12.2 Einordnung

- `AcceptedEventSpec` ist der operative, normalisierte Eingangszustand für Veranstaltungsdaten.
- `SpecRecord` und `OpenIssueRecord` sind im Memory-Strang als kanonische Objektanker geführt.
- `ProductionPlanRecord` ist der planungsbezogene interne Anker.
- Audit-Events dienen der Nachvollziehbarkeit mutierender Aktionen.
- persistierte Intake-Anfragen bilden den dokumentierten Eingangsanker, aus dem normalisierte Spezifikationen hervorgehen.

### 12.3 Offen

- genaue Persistenzform aller Domänenobjekte in jeder Laufzeitkonfiguration
- endgültige Rechte- und Ownership-Zuordnung auf Feldebene
- mögliche spätere Auslagerung weiterer Objektdefinitionen in eigene Architekturdokumente

## 13. Rollen / Rechte / Sicherheit / Datenschutz

### 13.1 Rollen

Aus den Dokumenten ableitbar sind derzeit vor allem folgende Nutzungsrollen:
- Angebots-Ersteller
- Produktionsplanung / Küche
- interne Operatoren mit Audit-relevanten Aktionen

### 13.2 Rechte und Sicherheit

- Rollen und Rechte werden in App und vor dem Reverse Proxy geregelt.
- `x-actor-name` dient der Zuordnung mutierender Aktionen zu einem Operator.
- HTTPS / Reverse Proxy sind als Betriebsleitplanke dokumentiert.

### 13.3 Offen

- konkrete AuthN-/AuthZ-Mechanik
- Session- oder Token-Strategie
- fein granulare Rollenmatrix
- Aufbewahrungsfristen und Löschkonzept

### 13.4 Datenschutz

Der aktuelle Dokumentationsstand legt eine interne, kontrollierte Nutzung nahe. Konkrete Datenschutz- und Compliance-Details müssen separat und projektspezifisch finalisiert werden.

## 14. Betriebs- und Deployment-Rahmen

### 14.1 Lokal

- `npm install`
- `npm test`
- `npm run local:start`
- `npm run local:status`
- `npm run local:stop`

### 14.2 Zielumgebung

Dokumentiert ist ein Hetzner-MVP mit:
- Caddy als Reverse Proxy
- HTTPS-Terminierung
- `backoffice-ui` als zentrale Web-Oberfläche
- interne HTTP-Services für Intake, Offer, Production und Export
- PostgreSQL oder dateibasierter Betrieb je nach Konfiguration

### 14.3 Audit und Nachvollziehbarkeit

- gemeinsame Audit-Spur über die Services hinweg
- nachvollziehbare Operator-Zuordnung
- sichtbare Änderungen in der Web-App
- nachvollziehbare Zuordnung zwischen persistierter Intake-Anfrage und daraus abgeleiteter Spezifikation

## 15. MVP-Abgrenzung

Der aktuelle MVP umfasst den bestehenden internen Kern aus:
- Intake
- Angebot
- Produktion
- Exporte
- Rezeptbibliothek / Review
- Backoffice-UI
- lokaler und Hetzner-orientierter Betriebsrahmen

Nicht Bestandteil des MVP sind aktuell insbesondere:
- Plattformisierung
- Multi-Tenancy
- neue Produktlinien
- allgemeine Roadmap-Erweiterung
- zusätzliche Governance-Fachblöcke

## 16. Risiken / Annahmen / offene Fragen

### 16.0 Kurzüberblick bisherige Implementierungsherausforderungen

Die bisher wichtigsten Implementierungsherausforderungen lagen in der kontrollierten Reifung des Produkts, nicht in einer einzelnen schweren Kernfunktion.

Konkret haben sich bisher vor allem diese Punkte gezeigt:
- Repo- und Arbeitskontext mussten stabilisiert werden, damit Änderungen im richtigen Repository und ohne alte Nebenstränge erfolgen.
- Führungsdokumente und realer Repo-Stand mussten wiederholt synchronisiert werden, damit Planung, Architektur und Umsetzung zusammenlaufen.
- Neue Access-Control- und Governance-Schritte brachen ältere Testannahmen; bestehende Tests und Aufrufe mussten an geschützte Pfade angepasst werden.
- Einzelne Zieltests reichten nicht als Qualitätsgate; zusätzlich musste `npm run build` als verpflichtender Prüfschritt vor Commit und Push etabliert werden.
- P2, P3 und P4 mussten bewusst klein gehalten werden, um keine große E2E-, Infrastruktur- oder Compliance-Baustelle zu eröffnen.
- Spätere Produktideen wie Onboarding mussten architektonisch vorgemerkt, aber aus dem aktiven MVP-Block herausgehalten werden.

### 16.1 Risiken

- Dokumentierte Prozesse können größer wirken als aktuell technisch abgesichert.
- Rollen- und Rechtefragen sind bislang eher beschrieben als vollständig formalisiert.
- Ein zu breiter Ausbau würde die derzeitige Konsolidierungsphase verlassen.

### 16.2 Annahmen

- Die in README und Architektur dokumentierten Services bilden den belastbaren Produktkern.
- Der lokale Stack bleibt der primäre Reproduktionsanker.
- Die bestehende Governance-Linie bleibt additiv und ohne neue Kernpersistenz.

### 16.3 Offene Fragen

- Welche Rolle ist im UI genau wofür verantwortlich?
- Welche Daten müssen rechtlich oder operativ wie lange aufbewahrt werden?
- Welche Teile des aktuellen Betriebs sollen später formal abgenommen werden?
- Welche weiteren Detaillierungen gehören in separate Fach- oder Architekturpläne?

## 17. empfohlene nächste Konkretisierung

Der nächste sinnvolle Schritt ist keine neue Produktfläche, sondern eine fachliche Präzisierung der bestehenden Kernprozesse und ihrer Abgrenzung, insbesondere:

1. Rollen- und Rechte-Matrix präzisieren
2. Produktkern gegen nicht beabsichtigte Ausweitungen schärfen
3. MVP-Abgrenzung pro Service und UI-Bereich separat verifizieren
4. offene Fragen zu Audit, Aufbewahrung und Betriebsfreigabe systematisch ergänzen

---

Dieses Pflichtenheft ist bewusst als lebendes Arbeitsdokument angelegt. Es soll mit dem realen Repo-Stand mitwachsen, aber nur nach nachweisbarer Änderung des Ist-Stands.
