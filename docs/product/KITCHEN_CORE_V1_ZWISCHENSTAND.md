# Kitchen Core v1 – Zwischenstand nach PurchaseCoverageCheck

Status: kurzer fachlich-technischer Zwischenstand auf Basis des aktuellen Repo-Iststands

Stand: 2026-05-18

## 1. Kurzfazit

Der erste harte Kitchen-Core-Sicherheitsmechanismus ist jetzt fachlich und technisch wirksam:

- `PurchaseCoverageCheck` existiert als reine Regel im `shared-core`.
- Die Regel ist in `production-service/src/rules/planning.ts` nach Erzeugung der `PurchaseList` angebunden.
- Fehlende Einkaufsabdeckung erzeugt ein blockierendes Planungsproblem im bestehenden `ProductionPlan.blockingIssues`-Modell.
- Vollstaendige Einkaufsabdeckung laesst den bisherigen erfolgreichen Produktionspfad unveraendert.

Damit kann die Produktionsplanung nicht mehr still als erfolgreich erscheinen, wenn produktionsrelevante Rezeptzutaten in der Einkaufsliste fehlen.

Dieser Zwischenstand fuehrt keine neue UI, API, Persistenz, Export-, Governance-, Audit-, Deployment- oder Provider-Logik ein.

## 2. Tatsaechlich umgesetzt

### 2.1 Kitchen-Core-Spezifikation

Umgesetzt als Dokument:

- `docs/product/KITCHEN_CORE_V1.md`

Einordnung:

- Die Spezifikation beschreibt den fachlichen Kern, die Nicht-Ziele, die Architekturprinzipien und die Kernobjekte.
- Sie trennt bereits vorhandene Repo-Anker von fachlichen Zielregeln.
- Sie ist ein Spezifikationsanker, keine technische Durchimplementierung aller genannten Konzepte.

Hinweis zum aktuellen Stand:

- Die dort noch als naechster technischer Folgeschritt beschriebene `PurchaseCoverageCheck`-Regel wurde inzwischen umgesetzt und integriert.
- Dieser Zwischenstand dokumentiert diese Aktualisierung separat, ohne die Ursprungsspezifikation umzuschreiben.

### 2.2 `checkPurchaseCoverage(...)`

Umgesetzt in:

- `shared-core/src/rules/purchasing.ts`
- `shared-core/src/rules/purchasing.js`

Rueckgabeform:

- `status: "passed" | "blocked"`
- `coveredIngredients`
- `missingIngredients`
- `documentedProcurementExceptions`

Fachliche Wirkung:

- Jede produktionswirksame Zutat aus `ProductionPlan.productionBatches` wird gegen die `PurchaseList.items` geprueft.
- Abdeckung erfolgt aktuell minimal ueber gleiche `ingredientId` oder normalisierten Anzeigenamen.
- Dokumentierte Zukauf-/Convenience-Ausnahmen werden separat ausgewiesen.
- Eine dokumentierte Ausnahme ueberdeckt fehlende Rezeptzutaten nicht automatisch.

### 2.3 Integration in den Produktionsplanungsfluss

Umgesetzt in:

- `production-service/src/rules/planning.ts`

Aktueller Ablauf:

1. Produktionsdaten werden aus `AcceptedEventSpec` und Rezeptentscheidung aufgebaut.
2. `ProductionPlan` wird validiert.
3. `PurchaseList` wird aus den operativen Produktionsbatches und Beschaffungspositionen aggregiert.
4. `checkPurchaseCoverage(productionPlan, purchaseList)` wird ausgefuehrt.
5. Bei `status === "blocked"` wird ein vorhandenes blockierendes Planungsproblem ergaenzt:
   - `ProductionPlan.blockingIssues`
   - `ProductionPlan.unresolvedItems`
   - `ProductionPlan.readiness`
   - `isFallback`
   - `fallbackReason`
6. Bei `status === "passed"` bleibt der bestehende Erfolgsweg unveraendert.

### 2.4 Tests und Build-Status

Ergaenzte Testdateien:

- `tests/purchase-coverage-check.test.ts`
- `tests/production-purchase-coverage-integration.test.ts`

Abgedeckte Aussagen:

- Vollstaendige Einkaufsabdeckung besteht.
- Fehlende Rezeptzutat blockiert die Coverage-Regel.
- Dokumentierte Procurement Exceptions werden ausgewiesen.
- Dokumentierte Exceptions erzeugen keine Scheinfreigabe fuer fehlende Rezeptzutaten.
- Fehlende Einkaufsabdeckung fuehrt im Produktionsplan zu einem blockierenden Issue.
- Vollstaendige Einkaufsabdeckung veraendert den erfolgreichen Planungsweg nicht unnoetig.

Zuletzt verifizierter Stand:

- `npx vitest run tests/production-purchase-coverage-integration.test.ts` bestanden: 2 Tests.
- `npx vitest run tests/purchase-coverage-check.test.ts tests/production-purchase-coverage-integration.test.ts tests/production-plan-fallbacks.test.ts` bestanden: 11 Tests.
- `npm test` bestanden: 22 Testdateien, 98 Tests.
- `npm run build` bestanden: TypeScript und Backoffice-UI-Build erfolgreich.

Bekannte Testausgabe:

- Bestehende React-`act(...)`-Warnings in Backoffice-Smoke-Tests; kein Testfehler.

## 3. Nur dokumentiert, aber noch nicht umgesetzt

### 3.1 ProfessionalRecipe-Tiefe

Nur fachlich beschrieben, noch nicht als eigenes neues Modell umgesetzt.

Aktueller Repo-Anker:

- `Recipe` in `shared-core/src/types.ts`
- `RecipeSource` inklusive Herkunft, Tier, Approval-State und Qualitaetssignalen
- Rezeptbibliothek und Review-Pfade in Offer- und Production-Service

Noch offen als fachliche Tiefe:

- verbindliche Mindestqualitaet fuer echte Profikuechenproduktion
- Equipment, Mise-en-place, Haltbarkeit, Kuehl-/Warmhaltehinweise
- HACCP-nahe Hinweise, falls fuer v1 wirklich erforderlich
- klare Grenze, welche Recipe-Approval-States produktionsfaehig sind

### 3.2 ProductionSheet v1

Nur teilweise vorhanden.

Aktueller Repo-Anker:

- `KitchenSheet` in `shared-core/src/types.ts` mit aktuell nur:
  - `title`
  - `instructions`
- `ProductionPlan.kitchenSheets`
- Erzeugung in `production-service/src/rules/planning.ts`
- einfacher HTML-Export in `print-export/src/index.ts`

Noch nicht umgesetzt als verbindliche `ProductionSheet v1`-Tiefe:

- Pflichtbezug zu Event/Spec/Plan
- sichtbarer Rezeptbezug
- Produktionsmenge und Portionen
- Station
- Vorbereitungsfenster
- GN-/Behaelterplanung
- skalierte Zutaten mit Mengen
- Allergene/Diet-Hinweise
- Zukauf-/Convenience-Hinweise
- Blocker/offene Punkte direkt am Blatt

### 3.3 Feedback nach Event

Nur fachlich beschrieben.

Noch nicht als eigenes Kernobjekt sichtbar umgesetzt:

- keine strukturierte Event-Feedback-Entitaet
- keine Rueckfuehrung in Rezept-, Mengen-, Timing- oder Einkaufsreview
- keine fachliche Lernschleife mit Reviewstatus

### 3.4 AI-Provider-Abstraktion / Bring-your-own-AI

Teilweise vorhanden, aber nicht als allgemeine LLM-Provider-Schicht ausgebaut.

Aktueller Repo-Anker:

- `WebRecipeSearchProvider` in `production-service/src/recipe-discovery/provider.ts`
- `DuckDuckGoRecipeSearchProvider` als konkrete Websuche
- interne Schemas und Validierung im `shared-core`

Noch nicht umgesetzt:

- allgemeine AI-/LLM-Provider-Abstraktion fuer Extraktion, Rezeptvorschlaege oder Textgenerierung
- Anbieterwahl fuer Gemini/OpenAI/Claude/etc.
- formaler Bring-your-own-AI-Konfigurationsrahmen ueber die vorhandene Web-Rezeptsuche hinaus

Fachliche Leitlinie bleibt:

- KI bleibt Unterstuetzungsschicht.
- Der Kern darf nicht von einem bestimmten Provider abhaengen.
- KI-Ausgaben muessen gegen interne Schemas und Review-/Blockerregeln laufen.

## 4. Offene Entscheidungen fuer Alexander

### 4.1 PurchaseCoverage: Diagnoseartefakt vs. leere PurchaseList bei Blocker

Aktueller Stand:

- Bei fehlender Coverage wird der Produktionsplan blockiert.
- Die erzeugte `PurchaseList` bleibt als Diagnoseartefakt erhalten.

Zu entscheiden:

- Soll die unvollstaendige Einkaufsliste bei Blocker sichtbar bleiben, damit fehlende Positionen nachvollziehbar sind?
- Oder soll bei blockierter Produktionsfreigabe eine leere/gesperrte `PurchaseList` zurueckgegeben werden, damit sie operativ nicht versehentlich genutzt wird?

Empfehlung:

- Kurzfristig Diagnoseartefakt beibehalten.
- Spaeter ggf. expliziten Status fuer nicht freigegebene Einkaufsliste modellieren, statt sie still zu leeren.

### 4.2 Mengen-/Einheitenäquivalenz

Aktueller Stand:

- Coverage prueft Existenz einer passenden Einkaufsposition, nicht mathematische Mengen- oder Einheitenaequivalenz.

Zu entscheiden:

- Reicht v1 die Existenzabdeckung?
- Oder muss v1 bereits Mengen, Einheiten, Umrechnungen und Teilabdeckungen hart pruefen?

Empfehlung:

- V1: Existenzabdeckung als harte Mindestbarriere beibehalten.
- V1.1: Mengen-/Einheitenpruefung separat spezifizieren und testen.

### 4.3 `ingredientId` vs. Anzeigenamen-Matching

Aktueller Stand:

- Matching erfolgt ueber gleiche `ingredientId` oder normalisierten Anzeigenamen.

Zu entscheiden:

- Soll langfristig nur `ingredientId` zaehlen?
- Oder bleibt Anzeigenamen-Matching als pragmatische Absicherung fuer importierte/normalisierte Daten erlaubt?

Empfehlung:

- Kurzfristig beibehalten, weil reale Rezeptquellen und importierte Daten nicht immer perfekte IDs liefern.
- Mittelfristig Prioritaet auf stabile `ingredientId`-Normalisierung legen.

### 4.4 Strukturierter Issue-Typ vs. `blockingIssues`-Text

Aktueller Stand:

- Coverage-Blocker wird als Text in bestehende `blockingIssues` integriert.

Zu entscheiden:

- Reicht v1 der bestehende Textpfad?
- Oder braucht die App strukturierte Issue-Typen wie `purchase_coverage_missing_ingredient`?

Empfehlung:

- V1: Textpfad beibehalten, weil er bestehende UI/API/Persistenz nicht erweitert.
- Spaeter strukturierte Issue-Typen nur dann einfuehren, wenn konkrete Folgefunktionen sie brauchen.

### 4.5 Mindestinhalt ProductionSheet v1

Zu entscheiden:

- Was muss ein professionelles Kuechenblatt minimal enthalten, damit es nicht nur Text, sondern echte Produktionsgrundlage ist?

Empfohlene Mindestfelder fuer v1:

- `eventSpecId` / Planbezug
- Komponenten-/Gerichtsname
- `componentId`
- `recipeId`, falls Eigenproduktion oder Hybrid
- Produktionsmenge / Portionen
- Station
- Vorbereitungsfenster
- GN-/Behaelterplanung, soweit vorhanden
- skalierte Zutaten mit Menge und Einheit
- Arbeitsschritte
- Allergene/Diet-Hinweise, soweit im Rezept vorhanden
- Zukauf-/Convenience-Hinweise
- offene Punkte / Blocker, falls kein freigegebenes Blatt entstehen darf

## 5. Empfehlung fuer den naechsten kleinsten Schritt

Der naechste fachlich sinnvolle Mini-Schritt ist aus heutiger Sicht `ProductionSheet v1` fachlich zu haerten.

Warum:

- `PurchaseCoverageCheck` verhindert jetzt falsche Einkaufsvollstaendigkeit.
- Der naechste unmittelbare Kuechenwert liegt im druckbaren Arbeitsdokument.
- Das aktuelle `KitchenSheet` ist mit `title` und `instructions` noch sehr duenn.
- Ein professionelles Catering-Kuechenblatt braucht mindestens Menge, Station, Timing, Zutaten und Blocker sichtbar am Arbeitsdokument.

Empfohlener naechster Schritt ohne Implementierung:

1. Alexander entscheidet den Mindestinhalt von `ProductionSheet v1`.
2. Danach erst ein minimaler technischer Schritt:
   - bestehendes `KitchenSheet`-Modell oder `ProductionPlan`-Ableitung nur so weit schaerfen, dass ein einzelnes Kuechenblatt die Pflichtinformationen tragen kann.
   - keine UI/API/Persistenz/Export-/Governance-Ausweitung ohne separate Freigabe.

Nicht als naechster Schritt empfohlen:

- neue UI-Flaechen
- neue API-Endpunkte
- neue Persistenz
- Export-Umbau
- AI-Provider-Ausbau
- Feedback-/Lernschleife
- Governance- oder Audit-Ausbau

## 6. Bewusst out of scope fuer diesen Zwischenstand

Nicht umgesetzt und nicht geaendert:

- Code
- Tests
- UI
- API
- Persistenz
- Export
- Governance
- Audit
- Deployment
- Plattform-/Providerlogik
- `platform-infra/Caddyfile`

Dieser Bericht ist nur eine repo-verankerte fachlich-technische Einordnung des aktuellen Kitchen-Core-Stands.
