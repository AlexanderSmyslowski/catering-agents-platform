# P1 MVP-Rollen- und Rechte-Matrix – Mini-Spezifikation

Status: Mini-Spezifikation v0.1 auf Basis des aktuellen Repo-Iststands
Stand: 2026-04-16
Einordnung: Bindender MVP-Anker fuer Rollen, Rechte und geschuetzte Kernpfade im bereits real verankerten P1-Korridor

## 1. Zweck des Dokuments

Diese Mini-Spezifikation zieht aus der bestehenden P1-Mini-Spezifikation, dem Pflichtenheft und der P5-Abgrenzung eine konkretere MVP-Rollen-/Rechte-Matrix ab.

Sie soll nicht eine neue AuthN-/AuthZ-Architektur einfuehren, sondern den bereits realen Guard-Stand so explizit machen, dass klar bleibt:
- welche Minimalrollen im MVP ueberhaupt sinnvoll sind
- welche Kernaktionen ihnen fachlich zugeordnet sind
- welche Pfade im Repo bereits real geschuetzt sind
- welche Pfade nur dokumentiert oder noch offen sind
- was bewusst nicht Teil dieser Minimal-Matrix ist

## 2. Bezug auf P1, Pflichtenheft und P5

Grundlagen dieses Dokuments sind:
- `docs/product/P1_ROLLEN_RECHTE_MINISPEZ.md`
- `docs/product/PFLICHTENHEFT.md`
- `docs/product/P5_MVP_ABGRENZUNG_MINISPEZ.md`
- `memory.md`
- `README.md`
- die zentrale Rollen-/Rechte-Konvention in `shared-core/src/access-control.ts`
- die realen Guards in den Services

Ableitung daraus:
- P1 ist bereits in einer ersten MVP-Stufe real verankert.
- P5 priorisiert weiterhin Shared Core / Access-Control / Governance und Betrieb vor weiterer Scope-Ausweitung.
- Diese Matrix ist deshalb ein Klarheitsanker innerhalb des bereits geschlossenen P1-Korridors, keine neue Produktlinie.

## 3. minimale MVP-Rollen

Die kleinste belastbare MVP-Rollenmenge bleibt:

1. Intake-Operator
2. Angebots-Operator
3. Produktions-Operator
4. Betriebs-/Audit-Operator

Diese Rollen sind im Repo bereits als minimale zentrale Konvention angelegt und werden ueber die Standard-Akteurnamen in den Services gespiegelt.

### 3.1 Reale Rollenanbindung im Code

- Intake-Operator -> `Intake-Mitarbeiter`
- Angebots-Operator -> `Angebots-Mitarbeiter`
- Produktions-Operator -> `Produktions-Mitarbeiter`
- Betriebs-/Audit-Operator -> `Betriebs-/Audit-Operator`

## 4. Rollen-Matrix: erlaubte Kernaktionen und zugeordnete Pfade

### 4.1 Intake-Operator

Erlaubte Kernaktionen:
- Intake-Daten aufnehmen und normalisieren
- unvollstaendige Spezifikationen im Intake-Kontext nachbearbeiten
- Intake als fachlichen Eingangspfad nutzen

Aktuell real geschuetzte Kernpfade:
- `POST /v1/intake/normalize`
- `POST /v1/intake/documents`
- `POST /v1/intake/documents/upload`
- `POST /v1/intake/specs/manual`
- `PATCH /v1/intake/specs/:specId`

Implizit / dokumentiert:
- `Intake-Mitarbeiter` ist der Service-Standardname fuer Intake-Aktionen
- Intake-Facharbeit bleibt fachlich dem Intake-Kontext zugeordnet

### 4.2 Angebots-Operator

Erlaubte Kernaktionen:
- Angebotsentwuerfe erzeugen und pflegen
- Angebotsvarianten bearbeiten
- Angebots-Review ausfuehren

Aktuell real geschuetzte Kernpfade:
- `POST /v1/offers/drafts` -> Angebots-Operator
- `POST /v1/offers/from-text` -> Angebots-Operator
- `POST /v1/offers/recipes/import-text` -> Angebots-Operator
- `POST /v1/offers/recipes/upload` -> Angebots-Operator
- `PATCH /v1/offers/recipes/:recipeId/review` -> Angebots-Operator
- `POST /v1/offers/seed-demo` -> Betriebs-/Audit-Operator

Implizit / dokumentiert:
- `Angebots-Mitarbeiter` ist der Service-Standardname fuer Angebotsaktionen
- Angebots-Seeding ist als Betriebs-/Demo-Weg dokumentiert und jetzt mit dem Betriebs-/Audit-Operator real abgesichert

### 4.3 Produktions-Operator

Erlaubte Kernaktionen:
- Produktionsplanung nutzen
- Rezeptsuche und Suchspur im Produktionskontext nutzen
- Produktions-Review ausfuehren

Aktuell real geschuetzte Kernpfade:
- `POST /v1/production/plans` -> Produktions-Operator
- `POST /v1/production/recipes/import-text` -> Produktions-Operator
- `POST /v1/production/recipes/upload` -> Produktions-Operator
- `PATCH /v1/production/recipes/:recipeId/review` -> Produktions-Operator

Implizit / dokumentiert:
- `Produktions-Mitarbeiter` ist der Service-Standardname fuer Produktionsaktionen
- produktive Produktionsarbeit bleibt fachlich vom Betriebs-/Audit-Korridor getrennt

### 4.4 Betriebs-/Audit-Operator

Erlaubte Kernaktionen:
- Audit- und Statuskontexte einsehen
- Betriebsaktionen ausfuehren
- Demo-Seeding bzw. operative Stabilisierungsaktionen nutzen
- Governance-Finalize bewusst ausfuehren

Aktuell real geschuetzte Kernpfade:
- `GET /v1/production/audit/events` -> Betriebs-/Audit-Operator
- `POST /v1/production/seed-demo` -> Betriebs-/Audit-Operator
- `POST /v1/intake/spec-governance/finalize` -> Betriebs-/Audit-Operator

Implizit / dokumentiert:
- `Betriebs-/Audit-Operator` ist der Service-Standardname fuer Audit- und Betriebsaktionen
- dieser Rollentyp ist die aktuelle gemeinsame Klammer fuer geschuetzte Betriebs- und Governance-Pfade

## 5. Pfad-Matrix: erwartete Rolle je geschuetztem Pfad

### 5.1 Real verankert und im Guard-Korridor belegt

| Pfad | Erwartete Rolle | Status |
|---|---|---|
| `POST /v1/intake/normalize` | Intake-Operator | real verankert |
| `POST /v1/intake/documents` | Intake-Operator | real verankert |
| `POST /v1/intake/documents/upload` | Intake-Operator | real verankert |
| `POST /v1/intake/specs/manual` | Intake-Operator | real verankert |
| `PATCH /v1/intake/specs/:specId` | Intake-Operator | real verankert |
| `POST /v1/offers/drafts` | Angebots-Operator | real verankert |
| `POST /v1/offers/from-text` | Angebots-Operator | real verankert |
| `POST /v1/offers/recipes/import-text` | Angebots-Operator | real verankert |
| `POST /v1/offers/recipes/upload` | Angebots-Operator | real verankert |
| `POST /v1/offers/seed-demo` | Betriebs-/Audit-Operator | real verankert |
| `POST /v1/production/plans` | Produktions-Operator | real verankert |
| `POST /v1/production/recipes/import-text` | Produktions-Operator | real verankert |
| `POST /v1/production/recipes/upload` | Produktions-Operator | real verankert |
| `GET /v1/production/audit/events` | Betriebs-/Audit-Operator | real verankert |
| `POST /v1/production/seed-demo` | Betriebs-/Audit-Operator | real verankert |
| `POST /v1/intake/spec-governance/finalize` | Betriebs-/Audit-Operator | real verankert |
| `PATCH /v1/offers/recipes/:recipeId/review` | Angebots-Operator | real verankert |
| `PATCH /v1/production/recipes/:recipeId/review` | Produktions-Operator | real verankert |

### 5.2 Dokumentiert, aber im aktuell verifizierten Minimal-Guard-Korridor noch nicht als harte Rolle belegt

| Pfad | Vorlaeufige Einordnung | Status |
|---|---|---|
| keine verbleibenden dokumentierten Kernpfade im aktuellen Mini-Korridor | die zuvor offenen Seed-Pfade sind jetzt in den realen Guard-Korridor aufgenommen | konsolidiert |

### 5.3 Warum diese Trennung wichtig ist

Die zentrale Rollen-/Rechte-Konvention in `shared-core` markiert mehrere Pfade als sensitiv. Der real verifizierte Guard-Korridor in den Services ist jedoch kleiner und muss deshalb nicht groesser behauptet werden als er ist.

Diese Mini-Spezifikation trennt deshalb bewusst zwischen:
- real geschuetztem Minimal-Korridor
- dokumentierten, aber noch nicht hart belegten Betriebswegen
- spaeteren moeglichen Erweiterungen

## 6. Bereits real verankert

Folgende Punkte sind im Repo bereits real verankert:
- zentrale Rollen-/Rechte-Konvention in `shared-core/src/access-control.ts`
- Rollennamen und Default-Akteursnamen
- geschuetzte Kernpfade fuer Intake-, Angebots-, Produktions-, Audit-, Seed-, Finalize- und Recipe-Review-Pfade
- gruen verifizierter kleiner Access-Control-Korridor
- klare Trennung zwischen Fachrollen und Betriebs-/Audit-Rolle
- Default-Akteursnamen werden im Code normalisiert (trim + lowercase) auf die Minimalrollen gemappt; das macht die Betriebs-/Audit-Zuordnung im Repo explizit und reproduzierbar

## 7. Noch nur dokumentiert / noch offen

Offen bleibt aktuell insbesondere:
- ob es fuer den MVP neben den vier Minimalrollen noch eine echte Admin-Rolle braucht
- ob Rollen nur fachlich benannt oder technisch weiter differenziert werden sollen
- ob weitere Endpunkte jenseits des aktuellen Minimal-Korridors ebenfalls als geschuetzt gelten muessen
- welche Authentifizierungsform im MVP endgueltig verbindlich ist

## 8. Bewusst nicht Teil der aktuellen MVP-Matrix

Diese Mini-Matrix ist absichtlich klein. Sie schliesst explizit aus:
- eine vollstaendige Enterprise-RBAC-Architektur
- neue AuthN-/AuthZ-Engine
- neue Rollenfamilien ohne konkreten Repo-Anker
- neue API-Endpunkte
- neue Persistenz
- Multi-Tenant- oder Plattformlogik
- UI-Ausweitung als Folge der Rollenmatrix
- generische Sonderrollen jenseits der vier Minimalrollen

## 9. Empfohlener kleinster naechster Folgeschritt, falls ueberhaupt noetig

Der naechste Schritt ist nicht ein Ausbau der Rechtearchitektur, sondern nur die Pflege des bereits realen Korridors.

Falls spaeter konkrete neue Guards belegt werden, ist der kleinste sinnvolle Folgeschritt:
1. den betroffenen Pfad in die Matrix aufnehmen
2. die kleine Verifikationssuite minimal nachziehen
3. die bestehenden Fuehrungsdokumente nur bei echtem Drift nachschreiben

Solange kein solcher konkreter Bedarf vorliegt, bleibt diese Matrix der verbindliche Minimalanker fuer P1.