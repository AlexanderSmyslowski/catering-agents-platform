# Pflichtenheft-Zielarchitektur: BYO-AI Catering Harness

Status: verbindlicher Zielanker fuer die naechsten Architektur- und Code-Slices

Stand: 2026-07-01

## 1. Kernentscheidung

Die Catering-Plattform wird nicht als monolithische "KI-App" weitergebaut.
Sie wird ein schlankes, provider-neutrales Catering Harness mit eigener
Wissensschicht.

KI-Modelle, Agenten-CLIs und Frameworks sind austauschbare Inferenzwerkzeuge.
Das fachliche Wissen, die Freigaben, die Auditspur und die Produktartefakte
liegen im Harness und damit bei uns bzw. beim Kunden, der die App betreibt.

Die App darf nicht versuchen, gestaltete Catering-Angebote dauerhaft ueber immer
mehr Regex-/Parser-Sonderfaelle zu verstehen. Solche Parser duerfen nur noch
fallback- oder migrationsnah eingesetzt werden. Fuehrend wird:

```text
Quelle -> KI-Entwurf -> Harness-Validierung -> einfache menschliche Review
-> freigegebene Produktartefakte -> Produktionsfeedback -> geprueftes Wissen
```

### Belegter Anlass

Der unmittelbare Anlass ist die Operator-Sichtung vom 2026-07-01 im
Produktionsfluss: Ein echtes PDF-Angebot mit klar sichtbaren Buffet- und
Welcome-Drink-Positionen wurde nach dem Upload als abgeschlossen analysiert,
die Hauptflaeche zeigte aber nur fuenf gemischte Komponenten, darunter
Infrastruktur-/Dekopositionen wie Glaeser und Menueschilder, waehrend mehrere
fachliche Buffetgerichte nicht sichtbar als Produktionsdaten erschienen. Dieser
Befund belegt nicht, dass alle Parser unbrauchbar sind; er belegt, dass
gestaltete Angebots-PDFs nicht weiter durch immer neue Regex-Sonderfaelle zum
fuehrenden Produktionsinput gemacht werden duerfen.

### Vorrang gegenueber aelteren Roadmaps

Dieses Pflichtenheft ersetzt keine bestehenden Sicherheits-, Daten-,
Auth- oder Betriebs-Gates. Es setzt aber fuer die naechsten Umsetzungsslices
den Vorrang: ProductionDraft-Vertrag, draft-only Import, einfache Review und
Freigabegrenze gehen vor weiterer Parser-Haertung fuer gestaltete Angebote.
Fruehere Analysepfade wie Batch-Klassifikation oder Intake-Schattenlaeufe
bleiben moegliche Belege, sind aber nicht mehr die fuehrende Reihenfolge fuer
den naechsten Produktwert.

## 2. Produktzuschnitt

Angebot und Produktion werden fachlich als zwei Produkte behandelt.

Sie duerfen im selben Monorepo bleiben, aber sie sollen nicht mehr als eine
gemeinsame Backoffice-App mit vermischtem Arbeitsfluss gedacht werden.
Ein gemeinsames Portal darf beide Produkte einbetten; es darf keine
produktuebergreifenden Freigabe- oder Produktionsfluesse besitzen, die diese
fachliche Trennung umgehen.

### Angebotsprodukt

Zweck:

- Kundenanfragen und Angebotsunterlagen aufnehmen.
- Angebotsentwuerfe, Varianten, Preis-/Leistungsrahmen und Kundentext erzeugen.
- Ein freigegebenes Angebot als Produktionsuebergabe bereitstellen.

Fuehrendes Artefakt:

```text
OfferDraft -> ApprovedOffer -> ProductionHandoff
```

### Produktionsprodukt

Zweck:

- Produktionsuebergaben, direkte Produktionsunterlagen und Produktionsfeedback
  in pruefbare Produktionsentwuerfe ueberfuehren.
- Rezepte, Mengen, Einkauf, Mise en Place, Zeitplan und Produktionsmappe
  erzeugen.
- Aenderungen und Rueckfragen der Produktion verarbeiten.

Fuehrendes Artefakt:

```text
ProductionHandoff | ProductionSource -> ProductionDraft -> ApprovedProductionSpec
```

### Gemeinsames Harness

Angebot und Produktion greifen auf dieselbe Wissensschicht zu:

- gepruefte Rezepte
- freigegebene Angebotsmuster
- Produktionsfeedback
- Lieferanten-/Ersatzproduktwissen
- Mengen- und Verlustfaktoren
- Geraete- und Garhinweise
- Warengruppen, Taxonomien und Kalkulationsregeln

Ein gemeinsames Portal ist erlaubt. Der fachliche Kern bleibt getrennt.

## 3. KI-Anbindung

Das Harness muss mehrere KI-Anschlussarten unter demselben Adaptervertrag
unterstuetzen.

### OAuth / Nutzerkonto

Muss moeglich sein fuer lokale oder operatornahe Nutzung:

- Codex CLI
- Claude Code oder vergleichbare Agenten-CLIs
- OpenAI-/Anthropic-/andere Nutzerkonten, sofern technisch verfuegbar

Regel:

- Nutzerautorisierung ist widerrufbar.
- OAuth-/CLI-Zugang bleibt Transport, nicht fachliche Wahrheit.
- Keine KI darf ohne Harness-Freigabe Produktobjekte schreiben.

### API / Unternehmensschluessel

Muss moeglich sein fuer kontrollierten Server- oder Batchbetrieb:

- Provider-Key ueber sichere Umgebung oder Secret Store.
- Kein Key im Repo, Log, Audit oder Export.
- Provider ist austauschbar.
- Gleicher Output-Vertrag wie OAuth/CLI.

### Lokale und eigene Provider

Muss langfristig moeglich bleiben:

- lokaler HTTP-Provider
- lokal gehostetes Modell
- kundeneigener Gateway
- spaeter optional Open-Source-Framework-Adapter

Regel:

```text
Provider austauschbar, Harness fuehrend.
```

## 4. Open-Source- und Vendor-Regel

Das Projekt darf nicht von einer einzelnen Modellfirma, Agenten-IDE,
Cloud-Plattform oder IT-Bude abhaengig werden.

Erlaubte Frameworks muessen vor Aufnahme erneut gegen diese Regeln geprueft
werden:

- permissive Open-Source-Lizenz wie MIT oder Apache-2.0
- kein Pflicht-Cloud-Service
- keine proprietaeren Kernmodelle fuer Audit, Memory oder Artefakte
- lokal testbar
- ersetzbar durch eigenen Adapter

Aktuelle unverbindliche Kandidaten:

- Vercel AI SDK: guter TypeScript-Kandidat fuer strukturierte Outputs, nur als
  duenne Transportschicht, keine Vercel-Cloud-Annahme.
- PydanticAI: starker Kandidat fuer strikte strukturierte Outputs, aber nur
  wenn ein Python-Sidecar die Komplexitaet rechtfertigt.
- LangGraph: fuer spaetere mehrstufige Workflows moeglich, fuer den ersten
  Harness-Slice zu schwer.

## 5. Wissensschicht

Die Wissensschicht liegt im Harness bzw. beim Kunden.

KI-Ausgaben sind nicht Wissen. Sie sind Entwuerfe.

Geprueftes Wissen entsteht erst durch Review, Freigabe oder Produktionsfeedback.

Moegliche spaetere Zieltypen der Wissensschicht, erst nach echtem
Implementierungsbeleg verbindlich:

- `verified_recipe`
- `approved_offer_pattern`
- `production_feedback`
- `supplier_note`
- `substitution_rule`
- `portioning_rule`
- `loss_factor_rule`
- `equipment_cooking_note`
- `rejected_ai_extraction`
- `open_operational_question`

Das Central Agent Data Hub dient als Architekturvorbild:

- Fakten, Entscheidungen, Risiken und offene Fragen getrennt halten.
- Ungepruefte Signale nicht als Memory behandeln.
- Nur kuratierte, nicht-sensitive Writebacks speichern.
- Keine Secrets, privaten Rohdaten oder ungeprueften Behauptungen speichern.

Fuer das Produkt entsteht daraus spaeter eine kundengebundene
`Company Catering Knowledge Base`, nicht ein globales Modelltraining.

## 6. Review- und Aenderungsschleife

Review muss fuer Produktion und Angebot kinderleicht sein.

Jede KI-Ausgabe wird in Karten zerlegt:

- Eventdaten
- Angebotsteile
- Menuekomponenten
- Rezepte
- Mengen
- Einkaufsliste
- Mise en Place
- Zeitplan
- Risiken
- offene Fragen
- Quellen- und Vertrauenshinweise

Jede Karte braucht einfache Entscheidungen:

```text
Passt
Aendern
Unklar
Blockiert
```

Optionaler Kommentar der Produktion:

```text
Statt 100 kommen 120 Gaeste.
Kalbsnuss fehlt, Roastbeef ist verfuegbar.
Bitte Kerntemperatur und Konvektomat-Einstellung vorschlagen.
```

Die KI darf daraus nur einen neuen Aenderungsentwurf erzeugen.

```text
ProductionDraft v1 -> ReviewComment -> ProductionDraft v2
```

Erst menschliche Freigabe macht daraus ein Produktobjekt.

## 7. Produktionsrueckfragen

Die Produktion muss jederzeit Rueckfragen stellen koennen, bezogen auf:

- Rezept
- konkrete Zutat
- Geraet
- verfuegbare Ersatzprodukte
- Menge/PAX
- Zeitfenster
- Produktionsort

Beispiele:

- Welche Kerntemperatur fuer dieses Fleischstueck?
- Welche Dampf-/Temperaturbalance im Konvektomaten?
- Was ist ein sicherer Ersatz fuer Riesenkapern?
- Wie skaliert die Hollandaise von 45 auf 120 Personen?

Antworten der KI muessen kontextgebunden, als Entwurf markiert und bei
Unsicherheit blockierend sein.

## 8. Harte Sicherheitsregeln

Muss gelten:

- KI schreibt nie direkt kanonische Produktobjekte.
- KI schreibt nie direkt geprueftes Wissen.
- Raw Prompts und Raw Responses werden nicht in Audit, Memory, PRs oder Exporte
  geschrieben.
- Menschliche Freigabe ist Pflicht an fachlich riskanten Stellen.
- Allergene, Preise, Margen, Garparameter und Produktsicherheit duerfen nicht
  automatisch freigegeben werden.
- Echte Kundendaten bleiben gate-pflichtig.

Bestehende BYO-LLM-Boundary-Regeln bleiben bis zur bewussten Erweiterung
fuehrend:

- default disabled
- draft-only
- no product writes
- human approval required
- no raw logging

## 9. Ballast-Abbau

Eleganter Code ist Ziel, nicht maximale Bestandserhaltung.

Jeder kuenftige Slice muss pruefen, ob bestehender Code noch zum Harness-Ziel
passt.

Loeschkandidaten:

- deterministische Parser-Heuristiken, die gestaltete Angebote nur scheinbar
  verstehen
- UI-Flaechen, die alte technische IDs oder interne Zwischenstaende als
  Hauptinhalt zeigen
- doppelte Demo-/Readiness-/Governance-Schichten ohne Produktwert
- Tests, die nur alte Doku- oder Prozessartefakte schuetzen
- nicht genutzte Importpfade oder Spezialfaelle ohne aktuellen Nutzerwert

Loeschregel:

```text
Nur loeschen, wenn ein aktueller Test, ein aktueller Flow oder ein klares
Ersatzartefakt beweist, dass der Code nicht mehr gebraucht wird.
```

Kein "grosses Aufraeumen" ohne vorherige Inventur.

## 10. Zielarchitektur

```text
Offer Product
  -> Offer AI Draft Adapter
  -> Offer Review
  -> ApprovedOffer
  -> ProductionHandoff

Production Product
  -> Production AI Draft Adapter
  -> Production Review
  -> ApprovedProductionSpec
  -> Plan / Recipes / Purchase List / Folder

Shared Catering Harness
  -> Adapter Interface
  -> Schema Validation
  -> Review / Diff / Approval
  -> Company Catering Knowledge Base
  -> Audit / Source / Risk Boundaries
```

## 11. Naechste erlaubte Umsetzungsslices

1. `ProductionDraft`-Schema und Validator ohne Provider-Call.
2. Import eines KI-Entwurfs als Draft-only Objekt ohne Produktwrite.
3. Review-Karten fuer `Passt`, `Aendern`, `Unklar`, `Blockiert`.
4. Adapter-Interface fuer OAuth/API/CLI ohne neue Provider-Pflicht.
5. Freigabe uebernimmt Draft in `AcceptedEventSpec` bzw.
   `ApprovedProductionSpec`.
6. Feedback-Objekt nach Produktion als geprueftes oder ungeprueftes Wissen.
7. Ballast-Inventur: Parser-, UI- und Governance-Code gegen dieses Zielbild
   klassifizieren.

Nicht als naechster Slice erlaubt:

- ein weiterer grosser Regex-Parser fuer gestaltete Angebote
- automatische Produktionsfreigabe
- direkte Providerwrites
- neue Persistenzwelt ohne eigene Entscheidung
- LangGraph-/Sidecar-Einfuehrung ohne schmalen Adapter-Beweis

## 12. Abnahmekriterien fuer dieses Pflichtenheft

Ein kuenftiger Code-Slice gilt nur als zielkonform, wenn er mindestens eines
dieser Ziele messbar staerkt:

- bessere KI-Entwurfsaufnahme
- einfachere menschliche Review
- klarere Trennung Angebot/Produktion
- belastbarere Wissensschicht
- weniger Ballast
- bessere Provider-Austauschbarkeit
- haertere Freigabegrenzen

Wenn ein Slice keines dieser Ziele staerkt, wird er nicht gebaut.
