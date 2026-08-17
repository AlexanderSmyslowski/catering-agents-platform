# Production Prompt Replacement Contract

Status: verbindlicher fachlicher Referenzvertrag für die Ablösung des bisherigen manuellen ChatGPT-Produktionsworkflows.

## Ausgangspunkt

Der bisherige Produktionsworkflow wird manuell über einen umfangreichen ChatGPT-Prompt gesteuert. Dieser Prompt übernimmt heute gleichzeitig Rollenklärung, Pflichtfeldprüfung, Rückfragen, Mengenberechnung, Produktionsrezepte, Einkauf, Mise-en-Place und eine abschließende Konsistenzprüfung.

Die Anwendung soll diesen Workflow **ersetzen**, nicht bloß denselben Prompt hinter einer Oberfläche verstecken.

Das Zielbild ist deshalb eine strukturierte, persistente und prüfbare Kette, in der jeder fachliche Schritt als Produktzustand oder deterministisch validierbares Artefakt vorliegt.

## Referenzworkflow

```text
Input / Angebot / PDF / Text
→ Pflichtangaben prüfen
→ nur zwingende Rückfragen stellen
→ Annahmen explizit erfassen
→ Angebots-/Eventverständnis bestätigen
→ wirtschaftlichen Rahmen einordnen
→ Mengen je Gericht bestimmen
→ Produktionsrezept je Gericht bereitstellen
→ Convenience-/Eigenproduktionspfad je Komponente festlegen
→ jede Rezeptzutat in Einkauf überführen
→ Mise-en-Place und Produktionsreihenfolge erzeugen
→ Vollständigkeits-/Konsistenzprüfung
→ menschliche Küchenfreigabe
→ Produktionsunterlagen
```

## 1. Pflichtangaben-Gate

Vor einer vollständigen Produktionsausarbeitung muss das System mindestens prüfen und strukturiert abbilden:

1. Personenzahl;
2. Anlass / Veranstaltungsformat;
3. Gesamtverkaufspreis, sofern für die wirtschaftliche Plausibilisierung erforderlich/verfügbar;
4. Speisenpreisanteil, sofern vorhanden;
5. vollständig fertig zugekaufte Komponenten;
6. teilweise vorbereitet zugekaufte Komponenten;
7. vollständig in Eigenproduktion herzustellende Komponenten;
8. Vollständigkeit/Lesbarkeit der Quelle;
9. besondere Mengen-, Portions- oder Darreichungslogik;
10. ob Getränke Bestandteil der Speisenproduktion/Kalkulation sind.

Nicht jede fehlende Information ist automatisch ein Blocker. Das System muss zwischen `required_for_calculation`, `required_for_production`, `optional_context` und `explicit_assumption_allowed` unterscheiden.

## 2. Rückfragenvertrag

Rückfragen sind strukturierte Objekte, keine freie Chatkonversation.

Jede Frage muss tragen:

- stabile ID;
- fachlichen Grund;
- betroffenen Datenpfad/Komponente;
- Blockierungsgrad;
- präzisen deutschen Fragetext;
- erlaubten Antworttyp;
- Quellenanker, sofern vorhanden.

Das System stellt nur Fragen, deren Antwort den nächsten Produktionsschritt tatsächlich verändert. Bereits bekannte Informationen dürfen nicht erneut abgefragt werden.

## 3. Annahmenvertrag

Wenn mit Annahmen weitergearbeitet wird, muss jede Annahme separat persistiert werden mit:

- Code/ID;
- Inhalt;
- betroffener Komponente;
- Auswirkung auf Menge/Preis/Produktion;
- Operator-/Systemherkunft;
- Status `provisional | accepted | rejected | replaced`.

Stille Annahmen sind unzulässig.

## 4. Mengenvertrag

Für jedes Gericht bzw. jede Produktionskomponente muss eine nachvollziehbare Mengenentscheidung existieren:

- Zielportion / Menge pro Person oder Ausgabeeinheit;
- Gesamtmenge;
- Einheit;
- zugrunde liegende Personenzahl;
- Mengenlogik (z. B. Buffet, Flying Fingerfood, Beilage, Dessert, Stück pro Person);
- Quelle oder Annahme;
- keine automatischen Schwund-/Sicherheitszuschläge, solange nicht ausdrücklich aktiviert.

Die Mengenentscheidung ist von der späteren Rezeptskalierung zu unterscheiden.

## 5. Rezeptvertrag

Für jede eigenproduzierte oder teilweise eigenproduzierte Komponente muss eine Produktionsgrundlage vorhanden sein.

Das System darf mit **null vorab vorhandenen internen geprüften Rezepten** starten.

Zulässiger Bootstrap:

```text
kein internes Rezept
→ professionelle Referenz / Herstellerwissen / später AI-gestützter Kandidat
→ strukturierter Rezeptkandidat
→ explizite Unsicherheiten
→ event-spezifische Küchenprüfung
→ für diesen Auftrag nutzbar
```

Ein Produktionsrezept soll, soweit fachlich relevant, enthalten:

- Gerichts-/Komponentenname;
- Zielmenge;
- Zutaten mit exakten Mengen;
- Arbeitsschritte;
- Mise-en-Place;
- Vorbereitungszeit;
- Zubereitungs-/Garzeit;
- Stand-/Kühlzeit;
- Haltbarkeit/Lagerhinweise;
- Anrichte-/Endmontagehinweise;
- Geräte-/kritische Prozessparameter;
- Quellen-/Ableitungsstatus;
- Review-/Verifikationsstatus.

Fehlende Informationen bleiben explizit fehlend; sie werden nicht erfunden.

## 6. Convenience-Vertrag

Jede Speisenkomponente muss eine eindeutige Produktionsentscheidung tragen:

- `scratch` — vollständig Eigenproduktion;
- `hybrid` — teilweise vorbereitet/zugekauft;
- `convenience_purchase` — fertige Komponente/Zukauf;
- `external_finished` — extern fertig produziert.

Bei `hybrid` müssen gekaufte und selbst hergestellte Unterkomponenten getrennt erkennbar sein.

Für fertig zugekaufte Komponenten darf kein erfundenes Eigenproduktionsrezept erzeugt werden.

## 7. Einkaufsvertrag

Für jede verwendete Rezeptzutat und jede definierte zugekaufte Lebensmittelkomponente muss eine Einkaufsposition oder ein belegter vorhandener Bestandspfad existieren.

Die Einkaufsliste muss:

- Mengen aus skalierten Rezepten aggregieren;
- Zutaten nicht doppelt verlieren oder zählen;
- Convenience-Komponenten separat führen;
- nur Lebensmittel-/Rohwaren enthalten, sofern Non-Food nicht ausdrücklich Teil eines späteren Moduls ist;
- nach einer stabilen Metro-/Warengruppenlogik gruppierbar sein.

Es gilt die bidirektionale Prüfung:

```text
jede relevante Rezeptzutat → Einkauf/Bestand
jede Einkaufsposition → Rezept/Zukauf-Komponente
```

## 8. Mise-en-Place-/Produktionsvertrag

Das System muss aus den Produktionskomponenten eine ausführbare Arbeitsstruktur erzeugen können:

- Vorproduktion;
- Komponenten-/Stationenlogik;
- Kühl-/Stand-/Garzeiten;
- Servicevorbereitung;
- Endmontage/Anrichten;
- zeitliche Abhängigkeiten;
- Geräte-/GN-/Batch-Bezug, soweit vorhanden.

## 9. Abschlussprüfung

Vor einer event-spezifischen Küchenfreigabe muss die Anwendung deterministisch prüfen:

1. jedes Gericht berücksichtigt;
2. Mengenentscheidung für jedes Gericht vorhanden;
3. Produktionsweg für jede Komponente vorhanden;
4. für Eigen-/Teilproduktion ein nutzbares Rezept oder expliziter Blocker vorhanden;
5. Rezeptmenge passt zu Produktionsbatch/Küchenblatt;
6. jede relevante Rezeptzutat ist in Einkauf/Bestand gedeckt;
7. Convenience-/Zukaufstatus ist konsistent;
8. Allergene/Diet-Tags widersprechen nicht dem freigegebenen Rezeptstand;
9. alle Annahmen und Unsicherheiten sind sichtbar;
10. keine offene blocking clarification;
11. menschliche Küchenprüfung ist bei nicht dauerhaft freigegebenen Rezeptkandidaten erfolgt;
12. kein paralleler Rettungs-Chat ist nötig, um die Produktionsunterlagen ausführbar zu machen.

## 10. Wirtschaftliche Plausibilisierung

Der Verkaufspreis und Speisenpreisanteil dienen zunächst als Plausibilitätsrahmen, nicht als erfundene Vollkostenrechnung.

Bis Zutatenpreise, Personal, Logistik, Equipment und Zielmargen vollständig integriert sind, muss das System zwischen `price_context`, `module_catalog_estimate` und später `full_cost_model` unterscheiden.

Eine unvollständige Kostenbasis darf niemals als vollständige Deckungsbeitrags-/Margenkalkulation ausgegeben werden.

## 11. Produktprinzipien

- Deutsch ist die primäre Operatorsprache.
- Quellen, Annahmen, Modellkandidaten und menschliche Freigaben bleiben getrennte Konzepte.
- Das System fragt gezielt statt still zu raten.
- Fehlende interne Rezepte sind ein Bootstrap-Fall, kein Sackgassenfehler.
- Ein professioneller Quellenbeleg ist wertvoll, aber keine automatische Küchenfreigabe.
- Ein einmal für ein Event akzeptierter Rezeptkandidat wird nicht automatisch zum Hausrezept.
- Jede Produktionsausgabe muss aus strukturierten Produktobjekten ableitbar sein; Chattext allein ist keine Produktionswahrheit.

## Definition of Done für die Ablösung des bisherigen ChatGPT-Workflows

Der bisherige manuelle Prompt gilt erst dann als vollständig ersetzt, wenn ein interner Operator einen neuen Cateringfall ohne parallelen generischen ChatGPT-Produktionschat vom Input bis zu folgenden Artefakten führen kann:

- geklärte Event-/Angebotsgrundlage;
- transparente Annahmen;
- Mengen je Gericht;
- Produktionsweg je Komponente;
- vollständige Produktionsrezepte/Kandidaten;
- konsistente Einkaufsliste;
- Mise-en-Place-/Produktionsstruktur;
- sichtbare Blocker/Unsicherheiten;
- event-spezifische Küchenabnahme;
- druck-/exportfähige Produktionsunterlagen.

Dabei darf kein Gericht, keine relevante Zutat und keine erforderliche Produktionsentscheidung still verloren gehen.
