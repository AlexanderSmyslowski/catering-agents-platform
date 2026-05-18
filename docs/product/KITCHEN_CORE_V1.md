# Kitchen Core v1 – Fachspezifikation

Status: verbindliche Fachspezifikation v1.0 auf Basis des aktuellen Repo-Iststands

Stand: 2026-05-18

## 1. Zweck

Diese Spezifikation legt den fachlichen Kern der Catering-Produktions-App fest.

Ziel ist nicht, neue UI-, API-, Persistenz-, Governance-, Audit-, Deployment- oder Plattformlogik einzufuehren. Ziel ist eine verbindliche fachliche Einordnung der bestehenden und naechstliegenden Kernobjekte, damit die App aus einem real angenommenen Kundenangebot eine professionelle Produktionsgrundlage fuer hochwertige Catering-Kuechen erzeugen kann.

## 2. Zielbild

Kitchen Core v1 beschreibt den eigenen fachlichen Kern der App:

- Ein angenommenes oder manuell verbindlich erfasstes Kundenangebot wird in eine belastbare `AcceptedEventSpec` ueberfuehrt.
- Aus dieser Spezifikation entstehen professionelle Produktionsunterlagen, Rezeptentscheidungen und Einkaufsgrundlagen.
- Kritische Produktionsdaten werden nicht blind aus Vorschlaegen uebernommen, sondern gegen interne Schemas und Fachregeln geprueft.
- Fehlende oder widerspruechliche Angaben fuehren zu Rueckfragen oder blockierenden Punkten, nicht zu scheinbar fertiger Produktionsplanung.
- KI kann Extraktion, Vorschlaege oder Recherche unterstuetzen, bleibt aber austauschbar und fachlich nachgeordnet.

Der fuehrende Kern liegt im Repo in `shared-core` und den darauf aufbauenden Produktionsregeln, insbesondere:

- `shared-core/src/types.ts`
- `shared-core/src/schemas/*`
- `shared-core/src/validation.ts`
- `shared-core/src/rules/readiness.ts`
- `shared-core/src/rules/purchasing.ts`
- `production-service/src/rules/planning.ts`

## 3. Nicht-Ziele

Kitchen Core v1 fuehrt ausdruecklich nicht ein:

- keine neue UI
- keine neuen API-Endpunkte
- keine Persistenzaenderung
- keine neue Governance-, Audit-, Deployment- oder Plattformarbeit
- keine neue Multi-Tenant-, White-Label- oder SaaS-Plattformlogik
- keine feste Bindung an Gemini, OpenAI, Claude oder einen anderen KI-Anbieter
- keine automatische Freigabe von KI-Ausgaben
- kein automatisches Lernen, das Produktionsdaten ohne Review veraendert
- keine neue Rezept-, Einkaufs- oder Produktionswelt ausserhalb des bestehenden Monorepos

## 4. Architekturprinzip

Kitchen Core v1 folgt diesen Regeln:

1. Fachmodell, Regeln und gepruefte Rezept-/Produktionslogik bilden den Kern der App.
2. KI-Provider sind austauschbare Unterstuetzungsschichten.
3. KI-Ausgaben muessen in interne Objekte ueberfuehrt und gegen interne Schemas validiert werden.
4. Kritische Produktionsdaten brauchen Review, Freigabe oder eine klare blockierende Rueckfrage.
5. Die App darf fachlich nicht davon abhaengen, welches LLM oder welcher KI-Provider gerade angebunden ist.
6. Wenn fachliche Mindestdaten fehlen, entsteht kein operativer Produktionsschein, sondern ein expliziter Klaerungsbedarf.

## 5. Kernobjekte

### 5.1 AcceptedEventSpec

`AcceptedEventSpec` ist die verbindliche Angebots-/Produktionsspezifikation.

Bestehende Repo-Anker:

- Typ: `AcceptedEventSpec` in `shared-core/src/types.ts`
- Schema: `shared-core/src/schemas/accepted-event-spec.ts`
- Validierung: `validateAcceptedEventSpec(...)` in `shared-core/src/validation.ts`
- Readiness-Regeln: `shared-core/src/rules/readiness.ts`

Fachliche Rolle:

- fasst ein angenommenes oder manuell verbindlich erfasstes Kundenangebot in strukturierter Form zusammen
- ist der gemeinsame Ausgangspunkt fuer Angebot, Produktionsplanung, Rezeptauswahl, Einkauf und Rueckfragen
- enthaelt Event, Gaeste, Serviceplan, Menueplan, Produktionsentscheidungen, Constraints, Annahmen, fehlende Felder, Unsicherheiten und Evidenz

Mindestverbindlichkeit fuer Produktionsplanung:

- Eventdatum oder Zeitplan ist vorhanden
- erwartete oder garantierte Gaestezahl ist vorhanden
- Menuekomponenten sind vorhanden
- Serviceform ist vorhanden
- pro Menuekomponente ist die fachliche Kategorie bekannt: klassisch, vegetarisch oder vegan
- pro Menuekomponente ist die Herstellungsentscheidung bekannt: Eigenproduktion, Hybrid, Convenience-Zukauf oder externes Fertigprodukt
- bei Hybrid oder Convenience sind zugekaufte Bestandteile konkret benannt
- bei Rezeptbindung ist die Rezeptzuweisung gueltig und fachlich belastbar

Wenn diese Mindestverbindlichkeit nicht erfuellt ist, muss der Produktionspfad klaeren oder blockieren, statt eine scheinbar vollstaendige Produktionsgrundlage zu erzeugen.

### 5.2 ProfessionalRecipe

`ProfessionalRecipe` ist die fachliche Bezeichnung fuer ein professionell nutzbares Kuechenrezept. Im aktuellen Repo entspricht es dem bestehenden `Recipe`-Modell, sofern Qualitaet, Quelle und Review-Zustand ausreichend belastbar sind.

Bestehende Repo-Anker:

- Typ: `Recipe` in `shared-core/src/types.ts`
- Schema: `shared-core/src/schemas/recipe.ts`
- Validierung: `validateRecipe(...)` in `shared-core/src/validation.ts`
- Rezeptbibliothek und Review-Pfade in Offer- und Production-Service

Mindestinhalt:

- eindeutige `recipeId`
- Name
- Quelle mit Herkunft, Tier, Referenz, Review-/Approval-Zustand und Qualitaetssignalen
- Basisausbeute
- Zutaten mit Mengen, Einheiten und Warengruppe
- Arbeitsschritte
- Skalierungsregeln
- Allergene
- Diet-Tags

Fachliche Regel:

- `approved_internal` und `internal_verified` sind bevorzugte Zustaende fuer belastbare Produktionsnutzung.
- `review_required` und `rejected` duerfen nicht still als belastbare Produktionsgrundlage verwendet werden.
- Web- oder KI-gestuetzte Rezeptkandidaten sind Vorschlaege und muessen gegen Schema, Qualitaet und fachliche Constraints geprueft werden.

### 5.3 ProductionSheet

`ProductionSheet` ist das druckbare Kuechenarbeitsdokument fuer die operative Produktion.

Bestehende Repo-Anker:

- Typ: `KitchenSheet` in `shared-core/src/types.ts`
- Teil von `ProductionPlan.kitchenSheets`
- Schema-Anker: `shared-core/src/schemas/production-plan.ts`
- Erzeugung: `production-service/src/rules/planning.ts`
- Export: `print-export/src/index.ts`

Fachliche Rolle:

- macht aus validierten Produktionsdaten ein fuer die Kueche nutzbares Arbeitsdokument
- dient nicht als freie Textausgabe, sondern als Darstellung gepruefter Produktionsdaten
- muss offene Blocker sichtbar machen, wenn keine belastbare Produktion moeglich ist

Mindestinhalt fuer v1:

- Bezug zu Event/Spec und Produktionsplan
- Gericht oder Komponente
- Rezeptbezug, falls Eigenproduktion oder Hybrid
- Produktionsmenge
- Station
- Vorbereitungsfenster
- GN-/Behaelterplanung, soweit vorhanden
- skalierte Zutaten
- Arbeitsschritte
- Hinweise zu Hybrid-, Convenience- oder externen Zukaufbestandteilen
- offene Punkte oder blockierende Klaerungen

### 5.4 PurchaseCoverageCheck

`PurchaseCoverageCheck` ist die harte fachliche Pruefung, dass jede produktionsrelevante Rezeptzutat in der Einkaufsliste enthalten oder bewusst als Zukauf, Convenience oder externes Fertigprodukt markiert ist.

Bestehende Repo-Anker:

- Einkaufsliste: `PurchaseList` in `shared-core/src/types.ts`
- Schema: `shared-core/src/schemas/purchase-list.ts`
- Aggregation: `shared-core/src/rules/purchasing.ts`
- Produktionsableitung: `production-service/src/rules/planning.ts`

Aktueller Iststand:

- Die Einkaufsliste wird aus `ProductionBatch.ingredients` aggregiert.
- Zukauf- und Convenience-Elemente werden in der Produktionsplanung bereits als Beschaffungspositionen beruecksichtigt.
- Eine explizit benannte harte Coverage-Pruefung als eigenes Fachobjekt ist noch nicht implementiert.

Fachliche Zielregel:

- Jede Zutat jedes produktionswirksamen `ProductionBatch` muss in `PurchaseList.items` abgedeckt sein.
- Jede Hybrid-, Convenience- oder extern fertige Komponente muss als Beschaffungsposition oder bewusste Ausnahme dokumentiert sein.
- Fehlende Abdeckung ist ein blockierendes Produktionsproblem.
- Das Pruefergebnis soll spaeter als eigenes, reines Regelresultat modelliert werden, ohne neue UI, API oder Persistenz.

Konzeptionelles Ergebnisobjekt:

- `status`: `passed` oder `blocked`
- `coveredIngredients`
- `missingIngredients`
- `coveredProcurementItems`
- `documentedExceptions`
- betroffene `componentId`, `recipeId`, `purchaseListId` und `planId`

### 5.5 Feedback nach Event

Feedback nach Event ist die strukturierte fachliche Rueckmeldung aus der realen Veranstaltung.

Aktueller Iststand:

- Ein eigenes Feedback-Fachobjekt ist im aktuellen Kern nicht sichtbar implementiert.
- Diese Spezifikation legt deshalb nur den fachlichen Zielrahmen fest.

Fachliche Rolle:

- Rueckmeldungen aus realen Veranstaltungen sollen spaeter Rezept-, Mengen-, Timing- und Einkaufsqualitaet verbessern.
- Feedback darf Produktionsdaten nicht automatisch veraendern.
- Feedback erzeugt Review- oder Verbesserungskandidaten.

Moegliche Feedbackdaten:

- tatsaechliche Gaestezahl
- Ueber- oder Unterproduktion
- fehlende oder ueberschuessige Einkaufspositionen
- Rezeptmengen-Korrekturen
- Timing- oder Arbeitsschrittprobleme
- Bewertung von Convenience-/Zukaufentscheidungen
- Kuechennotizen
- Vorschlaege fuer Rezeptreview oder Rezeptanpassung

Fachliche Regel:

- Kein automatisches Lernen ohne Review.
- Kein automatisches Ueberschreiben von Rezepten, Specs, Produktionsplaenen oder Einkaufsregeln.
- Feedback ist Eingabe fuer spaetere fachliche Pruefung.

### 5.6 Bring-your-own-AI / Provider-Abstraktion

Bring-your-own-AI bedeutet, dass KI austauschbar bleibt und nicht zum fachlichen Kern wird.

Bestehende Repo-Anker:

- Interne Schemas und Validierung liegen in `shared-core`.
- Produktionsplanung arbeitet mit internen Typen und Regeln.
- Fuer Web-Rezeptsuche existiert bereits eine Provider-Schnittstelle: `WebRecipeSearchProvider` in `production-service/src/recipe-discovery/provider.ts`.
- Ein konkreter Websuch-Provider ist `DuckDuckGoRecipeSearchProvider`.

Fachliche Regel:

- KI- oder Provider-Ausgaben sind Vorschlaege, Extraktionen oder Kandidaten.
- Massgeblich sind interne Schemas, Validierung, Review-Zustaende und Fachregeln.
- Provider duerfen austauschbar sein.
- Kein Produktionspfad darf fachlich davon abhaengen, ob ein bestimmter LLM-Anbieter verfuegbar ist.
- Ohne KI muss der Kern deterministisch mit vorhandenen Daten, Rueckfragen und Blockern weiterarbeiten koennen.

## 6. Bereits belegt vs. offen

Bereits im Repo belegt:

- `AcceptedEventSpec` als zentraler strukturierter Spec-Typ
- JSON-Schemas und AJV-Validierung fuer Kernobjekte
- `Recipe` mit Quelle, Review-Zustand und Qualitaetssignalen
- `ProductionPlan` mit Batches, Timeline, KitchenSheets, RecipeSelections und Blockern
- `PurchaseList` und Aggregation aus Produktionsbatches
- Provider-artige Web-Rezeptsuche ohne feste LLM-Bindung

Fachlich festgelegt, aber noch nicht als eigener technischer Baustein umgesetzt:

- `ProfessionalRecipe` als verbindliche fachliche Qualitaetsstufe ueber dem bestehenden `Recipe`-Modell
- `ProductionSheet` als verbindliche fachliche Einordnung der bestehenden `KitchenSheet`-/Export-Grundlage
- `PurchaseCoverageCheck` als harte Coverage-Pruefung
- Feedback nach Event als Review- und Verbesserungsschleife
- allgemeine Bring-your-own-AI-Abstraktion fuer KI-Provider jenseits der vorhandenen Web-Rezeptsuche

## 7. Offene Entscheidungen fuer Alexander

1. Welche Rezeptzustaende sind fuer echte Kuechenproduktion zulaessig?
   - nur `internal_verified`
   - oder auch `approved_internal`
   - oder in Ausnahmefaellen `digitized_cookbook`

2. Soll `PurchaseCoverageCheck` fuer Produktionsfreigabe hart blockieren?
   - Empfehlung dieser Spezifikation: ja, fehlende Einkaufsabdeckung ist blockierend.

3. Welche Mindesttiefe braucht ein `ProfessionalRecipe` v1?
   - nur Zutaten, Mengen, Schritte und Allergene
   - oder zusaetzlich Equipment, Haltbarkeit, Kuehl-/Warmhaltehinweise, HACCP-Hinweise und Mise-en-place

4. Wie detailliert muessen Convenience- und Zukaufbestandteile beschrieben sein?
   - nur Name und Menge
   - oder auch Lieferant, Gebinde, Qualitaetsnotiz und Alternativen

5. Was ist die verbindliche Mindestform eines `ProductionSheet` fuer die Profikueche?
   - bestehende `KitchenSheet`-Struktur ausreichend
   - oder Erweiterung um Zutatenmengen, Allergene, Station, Timing, GN-Plan und Zukaufhinweise als Pflichtanzeige

6. Welche KI-Aufgaben sind erlaubt?
   - Extraktion
   - Rezeptkandidaten-Vorschlaege
   - Mengen-/Textvorschlaege
   - niemals automatische Freigabe

7. Wie soll Feedback nach Event in v1 behandelt werden?
   - nur als Notiz
   - als Review-Aufgabe
   - als strukturierter Verbesserungskandidat fuer Rezept, Einkauf und Produktionsplanung

## 8. Kleinster technischer Folgeschritt nach Freigabe

Der kleinste sinnvolle technische Folgeschritt ist:

`PurchaseCoverageCheck` als reine `shared-core`-Regel mit Tests.

Scope dieses Folgeschritts:

- pure Function im `shared-core`
- Tests fuer vollstaendige Abdeckung, fehlende Rezeptzutat und dokumentierte Zukauf-/Convenience-Abdeckung
- keine UI
- keine API
- keine Persistenzaenderung
- keine Governance-, Audit-, Deployment- oder Plattformarbeit

Dieser technische Folgeschritt ist nicht Bestandteil dieser Spezifikationsablage und muss separat freigegeben werden.
