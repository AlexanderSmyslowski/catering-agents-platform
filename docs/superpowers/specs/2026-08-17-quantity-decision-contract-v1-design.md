# Quantity Decision Contract v1 — Design

## Ziel

Die Anwendung soll vor jeder Rezeptskalierung deterministisch entscheiden können, **welche Zielmenge eines Gerichts oder einer Produktionskomponente für einen konkreten Auftrag benötigt wird**. Diese Mengenentscheidung ist ein eigener fachlicher Schritt und darf nicht mit Rezeptskalierung, Rohwarenausbeute oder Sicherheitszuschlägen vermischt werden.

## Abgrenzung

Der Slice beantwortet ausschließlich die Frage:

> Wie viel von diesem Gericht bzw. dieser Komponente soll für diesen Auftrag ausgegeben oder bereitgestellt werden?

Er beantwortet noch nicht:

- welche Rohwarenmenge aus einem Rezept dafür benötigt wird;
- welche Gar-/Putzausbeute gilt;
- welche Sicherheitsreserve oder welcher Schwund aufzuschlagen ist;
- welche Einkaufsmenge oder Gebindezahl bestellt wird;
- wie die Menge zeitlich oder stationär produziert wird.

`scaleRecipe(...)` bleibt damit nachgelagert und erhält weiterhin eine bereits feststehende Zielgröße.

## Fachlicher Vertrag

Eine `QuantityDecision` bindet eine konkrete Mengenentscheidung an einen Auftrag/Event-Spec-Kontext und ein Gericht bzw. eine Komponente.

Jede Entscheidung enthält mindestens:

- stabile `decisionId`;
- `eventSpecId`;
- `componentId`;
- `guestCount` als positive ganze Zahl;
- `serviceFormat` als expliziten Kontextstring;
- `dishRole` als `main | side | starter | dessert | snack | fingerfood | condiment | beverage_food_component | other`;
- `basis` als eine von vier Mengenlogiken:
  - `per_person_weight`;
  - `pieces_per_person`;
  - `servings_per_person`;
  - `fixed_total`;
- `perUnitAmount` und `perUnitUnit`, wenn die gewählte Basis pro Person rechnet;
- `targetAmount` und `targetUnit` als die daraus resultierende Ziel-Ausgabemenge;
- `rationale` als kurze fachliche Begründung;
- `evidence` als explizite Herkunft der Mengenentscheidung;
- `reviewStatus` als `provisional | kitchen_review_required | approved | rejected`.

## Quellen- und Annahmenmodell

`evidence.kind` ist genau eines von:

- `internal_rule` — dauerhaft intern freigegebene Mengenregel;
- `professional_reference` — externe professionelle Referenz;
- `operator_instruction` — explizite Vorgabe durch Operator/Auftrag;
- `ai_candidate` — KI-gestützter Kandidat;
- `explicit_assumption` — ausdrücklich dokumentierte Annahme.

Keine Mengenentscheidung darf eine stille oder implizite Annahme darstellen. Für `professional_reference`, `ai_candidate` und `explicit_assumption` ist mindestens `kitchen_review_required` erforderlich; sie dürfen nicht automatisch `approved` sein. Eine `operator_instruction` darf `approved` sein, weil sie die explizite Mengen-/Portionsvorgabe des Auftrags repräsentiert. `internal_rule` darf ebenfalls `approved` sein.

## Berechnungslogik

### `per_person_weight`

Beispiel: 55 g Roastbeef pro Person bei 50 Gästen.

`targetAmount = 55 × 50 = 2750`, `targetUnit = g`.

### `pieces_per_person`

Beispiel: 1 Garnele pro Person bei 50 Gästen.

`targetAmount = 1 × 50 = 50`, `targetUnit = pieces`.

### `servings_per_person`

Beispiel: 0,5 Dessertportionen pro Person bei 50 Gästen.

`targetAmount = 0,5 × 50 = 25`, `targetUnit = servings`.

### `fixed_total`

Beispiel: 45 vorbereitete Dessertgläser unabhängig von `guestCount`.

`targetAmount` wird ausdrücklich vorgegeben; `perUnitAmount` und `perUnitUnit` sind unzulässig.

## Validierung

Der Evaluator arbeitet fail-closed:

- `guestCount` muss positiv und ganzzahlig sein;
- alle Mengen müssen endlich und positiv sein;
- bei personenbezogenen Basen müssen `perUnitAmount` und `perUnitUnit` vorhanden sein;
- bei `fixed_total` müssen diese Felder fehlen;
- berechnetes `targetAmount` muss exakt der normalisierten Berechnung entsprechen; widersprüchliche Zielmengen werden abgelehnt;
- `targetUnit` muss bei personenbezogenen Basen zur `perUnitUnit` passen;
- `pieces_per_person` verwendet `pieces`, `servings_per_person` verwendet `servings`;
- `rationale` darf nicht leer sein;
- `evidence.kind` und `reviewStatus` müssen miteinander vereinbar sein;
- `rejected` ist nie produktionsnutzbar.

## Ergebniszustände

`evaluateQuantityDecision(...)` liefert:

- `valid: boolean`;
- `usableForPlanning: boolean`;
- die normalisierte Entscheidung;
- deterministisch sortierte `issues` mit stabilen Codes.

`usableForPlanning` ist nur wahr, wenn die Entscheidung strukturell valide und nicht `rejected` ist. `provisional` und `kitchen_review_required` dürfen für eine vorläufige Planung sichtbar genutzt werden, müssen aber ihren Reviewstatus behalten; sie werden dadurch nicht zu freigegebenen Hausregeln.

## Keine automatischen Zuschläge

Der Contract rechnet ausschließlich die fachliche Soll-Ausgabemenge. Er wendet **keinen** Sicherheits-, Schwund-, Yield-, Überproduktions- oder Pufferfaktor an. Solche Faktoren gehören in getrennte spätere Verträge und müssen explizit aktiviert bzw. begründet werden.

## Integration

Der neue Contract lebt im `shared-core` und wird über den öffentlichen Paketindex exportiert. Bestehendes `rules/scaling.ts` wird in diesem Slice nicht funktional verändert. Der neue Contract kann später als Input für Rezeptauflösung und Rezeptskalierung dienen, ohne diese Logiken zu vermischen.

## Tests / Definition of Done

Mindestens folgende Fälle sind testgetrieben abgedeckt:

1. 55 g × 50 Personen → 2750 g;
2. 1 Stück × 50 Personen → 50 Stück;
3. 0,5 Portionen × 50 Personen → 25 Portionen;
4. fixe Gesamtmenge bleibt unverändert;
5. widersprüchliche berechnete Zielmenge wird abgelehnt;
6. `fixed_total` mit personenbezogenen Feldern wird abgelehnt;
7. fehlende/negative/NaN-Mengen werden abgelehnt;
8. AI-/Referenz-/Annahme-Evidence kann nicht automatisch `approved` sein;
9. `rejected` ist nicht planungsnutzbar;
10. kein automatischer Sicherheits- oder Verlustfaktor wird angewandt.

Kein UI-Redesign, keine Persistenzmigration, keine Provider-/LLM-Aufrufe, kein Deployment und keine echten Kundendaten.