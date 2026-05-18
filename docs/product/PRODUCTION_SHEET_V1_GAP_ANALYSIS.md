# ProductionSheet v1 – Gap-Analyse gegen aktuellen Repo-Stand

Status: fachliche Gap-Analyse, keine Implementierung

Stand: 2026-05-18

## 1. Kurzfazit

Die bestehende Produktionsstruktur enthaelt bereits viele fachliche Daten, die fuer ein professionelles Kuechenarbeitsdokument noetig sind. Sie liegen aber aktuell ueberwiegend in `ProductionPlan.productionBatches`, `recipeSelections`, `unresolvedItems` und `blockingIssues` — nicht im bestehenden `KitchenSheet` selbst.

Der aktuelle `KitchenSheet`-Typ ist fuer `ProductionSheet v1` fachlich zu duenn:

- vorhanden: `title`, `instructions`
- nicht direkt vorhanden: Event-/Spec-Bezug, Komponenten-ID, Rezept-ID, Produktionsmenge, Station, Prep-Fenster, skalierte Zutaten, Allergene/Diet-Tags, strukturierte Zukaufhinweise und Blockerbezug

Damit reicht die bestehende `ProductionPlan`-Struktur als Datenquelle teilweise aus. Die bestehende `KitchenSheet`-Struktur reicht als eigenstaendiges professionelles Kuechenarbeitsdokument v1 noch nicht aus.

Keine UI, API, Persistenz, Export-, Governance-, Audit-, Deployment- oder Provider-Arbeit wurde vorgenommen.

## 2. Gepruefte Repo-Anker

### 2.1 `ProductionPlan.kitchenSheets`

Repo-Anker:

- `shared-core/src/types.ts`
- `shared-core/src/schemas/production-plan.ts`

Aktueller Typ:

- `KitchenSheet.title: string`
- `KitchenSheet.instructions: string[]`
- `ProductionPlan.kitchenSheets: KitchenSheet[]`

Einordnung:

- `kitchenSheets` sind vorhanden und Teil des validierten `ProductionPlan`.
- Die Schema-Validierung verlangt pro Blatt nur `title` und `instructions`.
- Das reicht fuer einfache Arbeitsanweisungen, aber nicht fuer ein belastbares `ProductionSheet v1` als eigenstaendiges Kuechendokument.

### 2.2 `ProductionBatch`

Repo-Anker:

- `shared-core/src/types.ts`
- `shared-core/src/schemas/production-plan.ts`
- `production-service/src/rules/planning.ts`

Bereits vorhandene Felder:

- `batchId`
- `componentId`
- `recipeId`
- `scaledYield`
- `batchCount`
- `lossFactor`
- `gnPlan`
- `station`
- `prepWindow`
- `ingredients`
- `steps`

Einordnung:

- Der `ProductionBatch` enthaelt bereits den groessten Teil dessen, was ein `ProductionSheet v1` braucht.
- Das Problem ist weniger fehlende Datenbasis als fehlende verbindliche Abbildung dieser Daten in `KitchenSheet`.

### 2.3 `production-service/src/rules/planning.ts`

Aktueller Stand:

- Fuer Eigenproduktion/Hybrid werden Produktionsbatches erzeugt.
- `station`, `prepWindow`, `gnPlan`, skalierte Zutaten und Schritte entstehen am Batch.
- `KitchenSheet` fuer Eigenproduktion enthaelt aktuell im Wesentlichen:
  - Titel: Komponentenlabel plus Rezeptname
  - Anweisungen: nummerierte Rezeptschritte
  - bei Hybrid: ein Text-Hinweis auf Zukaufteile
- Fuer Convenience-/externen Bezug gibt es `procurementKitchenSheet(...)` mit Beschaffungsanweisungen.
- Fuer ungeklaerte Komponenten gibt es `unresolvedKitchenSheet(...)` mit Klaerungshinweisen.
- Bei Blockern werden operative `kitchenSheets` derzeit geleert, weil `operationalKitchenSheets = hasBlockingIssues ? [] : kitchenSheets`.

Einordnung:

- Fachliche Daten sind im Planungsfluss vorhanden, aber nicht vollstaendig in `KitchenSheet` konserviert.
- Bei globalen Blockern gibt es keinen eigenen blockierten KitchenSheet-Artefaktbestand; die Blocker liegen am `ProductionPlan`.

### 2.4 `print-export/src/index.ts`

Nur zur Einordnung gelesen, nicht geaendert.

Aktueller Stand:

- `renderProductionPlanHtml(plan)` exportiert aktuell:
  - Plan-ID
  - Readiness-Status
  - Anzahl Rezeptauswahlen
  - offene Punkte aus `unresolvedItems`
  - pro `productionBatch`: `componentId`, Station und Schritte

Einordnung:

- Der Export nutzt aktuell nicht `KitchenSheet` als fuehrende Arbeitsblattstruktur.
- Er zeigt einige Batch-Daten, aber nicht den vollstaendigen ProductionSheet-v1-Mindestinhalt.
- Eine Exportaenderung ist fuer diese Analyse ausdruecklich out of scope.

## 3. Gap-Liste ProductionSheet v1

### 3.1 Event-/Spec-Bezug

Status: teilweise vorhanden

Vorhanden:

- `ProductionPlan.eventSpecId`
- `ProductionPlan.planId`

Fehlt im `KitchenSheet`:

- direkter `eventSpecId`-/`planId`-Bezug pro Blatt
- keine explizite Blatt-zu-Plan-Verknuepfung ausser ueber Einbettung im `ProductionPlan`

Fachliche Bewertung:

- Als eingebettetes Planobjekt ausreichend nachvollziehbar.
- Als eigenstaendiges druckbares Arbeitsblatt noch zu schwach.

### 3.2 Gericht / Komponente

Status: teilweise vorhanden

Vorhanden:

- `KitchenSheet.title` enthaelt Komponentenlabel und ggf. Rezeptname.
- `ProductionBatch.componentId` ist strukturiert vorhanden.
- `recipeSelections.componentId` ist vorhanden.

Fehlt im `KitchenSheet`:

- strukturierte `componentId`
- getrenntes `componentLabel`

Fachliche Bewertung:

- Menschlich lesbar teilweise vorhanden.
- Maschinell/strukturell fuer ProductionSheet v1 nicht ausreichend.

### 3.3 Rezeptbezug

Status: teilweise vorhanden

Vorhanden:

- `ProductionBatch.recipeId`
- `RecipeSelection.recipeId?`
- `KitchenSheet.title` enthaelt bei Eigenproduktion den Rezeptnamen im Text.

Fehlt im `KitchenSheet`:

- strukturierte `recipeId`
- strukturierter Rezeptname
- Rezeptquelle/Reviewzustand am Blatt

Fachliche Bewertung:

- Mindest-v1 braucht mindestens `recipeId` bei Eigenproduktion/Hybrid.
- Quelle/Reviewzustand kann spaeter folgen, falls nicht fuer v1 entschieden.

### 3.4 Produktionsmenge

Status: teilweise vorhanden

Vorhanden:

- `ProductionBatch.scaledYield`
- `ProductionBatch.batchCount`
- Convenience-/Procurement-Sheets enthalten Menge als Freitext: `Menge einplanen: ... Portionen.`

Fehlt im `KitchenSheet`:

- strukturierte Produktionsmenge
- strukturierte Batch-Anzahl

Fachliche Bewertung:

- Datenbasis ist vorhanden.
- Arbeitsblatt selbst muss Menge direkt sichtbar tragen.

### 3.5 Station

Status: vorhanden im Batch, fehlt im KitchenSheet

Vorhanden:

- `ProductionBatch.station`
- Export zeigt Station aus `productionBatches`

Fehlt im `KitchenSheet`:

- `station` als Pflichtfeld

Fachliche Bewertung:

- Fuer ein Kuechenarbeitsdokument ist Station ein Pflichtfeld.
- Kleinste Haertung koennte die Station aus dem Batch ins Blatt uebernehmen.

### 3.6 Vorbereitungs-/Produktionsfenster

Status: vorhanden im Batch, fehlt im KitchenSheet

Vorhanden:

- `ProductionBatch.prepWindow`
- `TimelineEntry.at`
- `prepWindowFor(...)` in der Planung

Fehlt im `KitchenSheet`:

- `prepWindow` als Pflichtfeld oder explizite Anweisung

Fachliche Bewertung:

- Fuer Kuechensteuerung v1 sollte das Vorbereitungsfenster direkt am Blatt sichtbar sein.

### 3.7 Skalierte Zutaten

Status: vorhanden im Batch, fehlt im KitchenSheet

Vorhanden:

- `ProductionBatch.ingredients`
- Zutaten enthalten Mengen, Einheiten und Warengruppen
- `PurchaseCoverageCheck` nutzt diese Zutaten bereits als harte Produktionsbasis

Fehlt im `KitchenSheet`:

- Zutatenliste als strukturierter oder mindestens verbindlich gerenderter Bestandteil

Fachliche Bewertung:

- Das ist die groesste fachliche Luecke fuer `ProductionSheet v1`.
- Ein Kuechenblatt ohne skalierte Zutaten ist nur eine Schritt-/Notizliste, keine vollstaendige Produktionsgrundlage.

### 3.8 Arbeitsschritte

Status: vorhanden

Vorhanden:

- `ProductionBatch.steps`
- `KitchenSheet.instructions` enthaelt bei Eigenproduktion die nummerierten Schritte

Fehlt / schwach:

- Schritte sind im Blatt nur Textliste, aber fuer v1 wahrscheinlich ausreichend.

Fachliche Bewertung:

- Fuer v1 ausreichend, solange Zutaten und Menge ergaenzt werden.

### 3.9 Allergene / Diet-Tags

Status: vorhanden im Rezeptmodell, nicht durchgereicht ins Batch/KitchenSheet

Vorhanden:

- `Recipe.allergens`
- `Recipe.dietTags`
- Constraint-Pruefung liest Rezeptdaten intern aus

Fehlt:

- `ProductionBatch.allergens`
- `ProductionBatch.dietTags`
- `KitchenSheet.allergens`
- `KitchenSheet.dietTags`

Fachliche Bewertung:

- Fuer professionelle Kuechenarbeit sind Allergene/Diet-Hinweise fachlich wichtig.
- Kleinste technische Haertung waere, diese Daten beim Batch oder Blatt aus dem Rezept mitzunehmen.
- Vorher sollte Alexander entscheiden, ob sie v1-Pflicht sind oder v1.1 folgen.

### 3.10 Hybrid-/Convenience-/Zukaufhinweise

Status: teilweise vorhanden

Vorhanden:

- `procurementItemsForComponent(...)` erzeugt Beschaffungspositionen.
- `procurementKitchenSheet(...)` erzeugt Beschaffungshinweise.
- Hybrid-Sheets enthalten Text: `Zukaufteil separat disponieren: ...`
- `PurchaseCoverageCheck` erkennt dokumentierte Procurement Exceptions.

Fehlt im `KitchenSheet`:

- strukturierte Zukauf-/Convenience-Hinweise
- klare Trennung zwischen selbst zu produzierenden und extern zu beschaffenden Bestandteilen

Fachliche Bewertung:

- Fuer v1 kann Text-Hinweis knapp ausreichen.
- Besser waere minimal strukturiert: `procurementNotes: string[]` oder vorhandene `instructions` verbindlich mit Standardzeilen befuellen.

### 3.11 Offene Blocker/Hinweise

Status: teilweise vorhanden am Plan, nicht robust am Blatt

Vorhanden:

- `ProductionPlan.unresolvedItems`
- `ProductionPlan.warnings?`
- `ProductionPlan.blockingIssues?`
- `isFallback` und `fallbackReason`
- `unresolvedKitchenSheet(...)` fuer Komponentenprobleme vor globaler Fallback-Leerung

Fehlt / kritisch:

- Bei globalen Blockern werden operative `kitchenSheets` geleert.
- Kein explizites blockiertes ProductionSheet-Artefakt pro Komponente.
- Kein strukturierter Blattbezug auf konkrete Blocker.

Fachliche Bewertung:

- Fuer v1 kann der Plan-level Blocker ausreichend sein, solange blockierte Plaene nicht als Produktionsblatt ausgegeben werden.
- Wenn blockierte Blätter gedruckt werden sollen, braucht es einen bewusst blockierten Sheet-Typ oder eine klare Nicht-Ausgabe-Regel.

## 4. Zusammenfassung nach Kategorien

### Bereits vorhanden

- `ProductionPlan.eventSpecId`
- `ProductionPlan.planId`
- `ProductionPlan.productionBatches`
- `ProductionBatch.componentId`
- `ProductionBatch.recipeId`
- `ProductionBatch.scaledYield`
- `ProductionBatch.batchCount`
- `ProductionBatch.station`
- `ProductionBatch.prepWindow`
- `ProductionBatch.gnPlan`
- `ProductionBatch.ingredients`
- `ProductionBatch.steps`
- Plan-level `unresolvedItems`, `warnings`, `blockingIssues`, `isFallback`, `fallbackReason`

### Teilweise vorhanden

- Gericht/Komponente im `KitchenSheet.title`
- Rezeptbezug im Titel bzw. in `recipeSelections`
- Produktionsmenge in `ProductionBatch`, bei Procurement auch als Freitext
- Arbeitsschritte in `KitchenSheet.instructions`
- Hybrid-/Zukaufhinweise als Freitext
- offene Punkte am `ProductionPlan`, aber nicht stabil am Blatt

### Fehlt fuer ProductionSheet v1 als belastbares Blatt

- strukturierter Blattbezug zu `eventSpecId` / `planId`
- strukturierte `componentId` / ggf. Komponentenlabel
- strukturierte `recipeId`
- strukturierte Produktionsmenge am Blatt
- Station am Blatt
- Prep-Fenster am Blatt
- skalierte Zutaten am Blatt
- Allergene/Diet-Tags am Batch oder Blatt
- strukturierte Zukauf-/Convenience-Hinweise
- definierte Regel fuer Blocker: kein Blatt vs. blockiertes Blatt

### Fachlich offen / Entscheidung Alexander

- Muss `ProductionSheet v1` ein eigenes strukturiertes Objekt werden oder reicht eine Haertung von `KitchenSheet`?
- Sind Allergene/Diet-Tags v1-Pflicht oder v1.1?
- Soll ein blockierter Plan gar kein ProductionSheet ausgeben oder ein explizites Blocker-Blatt?
- Ist GN-/Behaelterplanung v1-Pflicht oder nur optionale Zusatzinfo?
- Muss Rezeptquelle/Reviewzustand direkt am Blatt sichtbar sein?

## 5. Empfohlener kleinster naechster Schritt

Empfehlung: keine UI, keine API, keine Persistenz, kein Export-Umbau.

Kleinster sinnvoller Folgeschritt nach fachlicher Freigabe:

- Eine minimale shared-core-/planning-Haertung von `KitchenSheet` als `ProductionSheet v1`-Traeger.

Minimaler Zielumfang fuer einen spaeteren technischen Schritt:

- `KitchenSheet` bekommt nur die unbedingt noetigen strukturierten Pflichtfelder:
  - `componentId`
  - `recipeId?`
  - `productionQty`
  - `station`
  - `prepWindow`
  - `ingredients`
  - optional: `allergens`, `dietTags`, `procurementNotes`, `blockingNotes`
- `production-service/src/rules/planning.ts` befuellt diese Felder aus bereits vorhandenen Batch-/Recipe-/Component-Daten.
- Bestehende `instructions` bleiben erhalten.
- Kein Export- oder UI-Pfad wird in demselben Schritt angepasst.
- Ein fokussierter Test prueft nur, dass ein erfolgreicher Produktionsplan ein fachlich vollstaendiges `KitchenSheet` erzeugt.

Noch kleiner, falls Alexander erst dokumentarisch entscheiden moechte:

- Zuerst `docs/product/KITCHEN_CORE_V1.md` oder einen separaten `PRODUCTION_SHEET_V1_SPEC.md` mit den verbindlichen Pflichtfeldern finalisieren.
- Danach erst TDD-Code-Schritt.

## 6. Nicht empfohlen als naechster Schritt

Nicht als unmittelbarer naechster Schritt empfohlen:

- Drucklayout- oder HTML-Export-Umbau
- UI-Anzeigeoptimierung
- neue API-Endpunkte
- Persistenzmigration
- Governance-/Audit-Erweiterung
- Provider-/LLM-Abstraktion
- Equipmentplanung, HACCP-Details, Haltbarkeit oder Personenplanung

Diese Themen koennen spaeter folgen, sobald `ProductionSheet v1` als fachliches Kernobjekt sauber entschieden ist.

## 7. Angelegte/geaenderte Datei

Angelegt:

- `docs/product/PRODUCTION_SHEET_V1_GAP_ANALYSIS.md`

Nicht geaendert:

- `docs/product/KITCHEN_CORE_V1.md`
- `docs/product/KITCHEN_CORE_V1_ZWISCHENSTAND.md`
- `platform-infra/Caddyfile`
- Code, Tests, UI, API, Persistenz, Export, Governance, Audit, Deployment, Provider/LLM
