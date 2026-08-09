# Pflichtenheft-Zielarchitektur: Catering-Harness 10/10

Status: verbindlicher Zielanker v2 fuer Produkt, Architektur und Ballast-Abbau

Stand: 2026-08-09

## 1. Vorrang und Zweck

Dieses Dokument beschreibt das zu erreichende Endziel. Es ersetzt die fruehere
Fassung dieses Pflichtenhefts und hat bei Zielkonflikten Vorrang vor
`PFLICHTENHEFT.md`, `PRODUKTZIEL_CATERING_AGENTS_PLATFORM.md` und alten
Roadmaps. Bestehende Sicherheits-, Daten-, Freigabe- und Betriebsgrenzen gelten
weiter, solange sie hier nicht bewusst strenger gefasst werden.

Die Autoritaeten sind damit eindeutig geordnet:

| Frage | Fuehrende Quelle |
| --- | --- |
| Welches Produkt soll entstehen? | dieses Pflichtenheft |
| Was ist heute sicher und erlaubt? | aktuelle Security-, Daten-, Auth-, Freigabe- und Betriebs-Gates |
| Was ist heute wirklich implementiert? | Code, automatisierte Tests, `README.md` und `TESTING.md` |
| Was wird als Naechstes umgesetzt? | ein ausdruecklich freigegebener Ausfuehrungsplan |
| Was belegt fruehere Entscheidungen? | historische Plaene und Zwischenstaende, ohne Zielautoritaet |

Eine Empfehlung, ein Agentenbericht oder ein historischer Stufenplan ist keine
Produktentscheidung. Neue Faehigkeiten dieses Zielbilds sind nicht automatisch
fuer reale Kunden- oder Unternehmensdaten freigegeben.

Das Ziel ist kein groesseres Backoffice und kein moeglichst autonomer Agent.
Ziel sind zwei ruhige, eigenstaendige Catering-Produkte mit einer gemeinsamen,
kundeneigenen Wissensschicht. Die KI bleibt austauschbar. Fachliche Wahrheit,
Freigabe, Versionen, Quellen und Produktartefakte bleiben im Catering-Harness.

10/10 bedeutet nicht optische Perfektion ohne Betriebsbeleg. 10/10 ist erreicht,
wenn ein realer Caterer einen Auftrag ohne Code-Handarbeit von der Quelle bis
zur verwendbaren Angebots- oder Produktionsgrundlage fuehrt, die Ergebnisse
versteht, korrigieren kann und ihnen fachlich vertraut.

## 2. Nicht verhandelbare Leitlinien

1. Angebotsassistent und Produktionsassistent sind eigenstaendige Produkte.
2. Die Uebergabe zwischen beiden ist ein ausdrueckliches, versioniertes
   Produktartefakt und keine verdeckte gemeinsame UI-Zustandsaenderung.
3. KI-Ausgaben sind Entwuerfe, niemals freigegebene Produktobjekte oder Wissen.
4. Kein Gericht, keine Zutat und keine Unsicherheit darf still verschwinden.
5. Bei reiner Extraktion ergaenzt die KI nichts. Bei Rezept- und
   Produktionsentwuerfen darf sie Zutaten und Garparameter nur als klar
   gekennzeichneten, begruendeten Vorschlag ergaenzen. Preise, Quellen,
   Allergene und Freigaben werden niemals erfunden.
6. Unternehmenswissen gehoert dem jeweiligen Betrieb und ist voll exportierbar.
7. KI-Anbieter, Betriebssystem, Hardware und Hosting bleiben austauschbar.
8. Die Hauptoberflaeche ist ruhig, erklaert den naechsten Schritt und zeigt
   technische Details nur auf Wunsch.
9. Produktion bleibt bei Internet- oder KI-Ausfall mit dem letzten geprueften
   Stand arbeitsfaehig.
10. Fehlende optionale Hardware blockiert weder Produkt noch Einrichtung.
11. Sichtbare Produkttexte sind klares, korrektes Deutsch ohne Genderformen.
12. Bestehender Code bleibt nur, wenn ein aktuelles Verhalten ihn benoetigt.

Der fuehrende Ablauf lautet:

```text
Quelle -> KI-Entwurf -> Schema- und Vollstaendigkeitspruefung
-> einfache menschliche Review -> freigegebenes Produktartefakt
-> reale Nutzung -> Produktionsfeedback -> geprueftes Wissen
```

## 3. Produktgrenzen

### 3.1 Angebotsassistent

Der Angebotsassistent nimmt Kundenanfragen und Angebotsunterlagen auf. Er
erzeugt pruefpflichtige Angebotsentwuerfe, Varianten, Preisrahmen und
Kundentexte. Er kennt keine Produktionsfreigabe und veraendert keine laufende
Produktion.

Fuehrender Vertrag:

```text
OfferSource -> OfferDraft -> ApprovedOffer -> ProductionHandoff
```

Langfristig kann eine schmale Kundenansicht aus Datum, Ort, Anlass,
Personenzahl, Budget, Dauer, Speisenpraesentation, Service und Personalbedarf
eine erste unverbindliche Schaetzung erzeugen. Sie verwendet ausschliesslich
freigegebene Pakete, Preisregeln und Kapazitaeten des jeweiligen Betriebs.

### 3.2 Produktionsassistent

Der Produktionsassistent startet wahlweise mit einer freigegebenen Uebergabe
oder einer direkten Produktionsquelle wie PDF, E-Mail, Text oder Bild. Er
erzeugt Rezepte, Mengen, Einkauf, Mise en Place, Zeitplan und Produktionsmappe.
Er verarbeitet Rueckfragen, Aenderungen und Produktionsfeedback.

Fuehrender Vertrag:

```text
ProductionHandoff | ProductionSource
-> ProductionDraft -> ApprovedProductionSpec
-> ProductionPlan / Recipes / PurchaseList / ProductionFolder
```

### 3.3 Gemeinsames Catering-Harness

Beide Produkte verwenden dieselben fachlichen Schnittstellen fuer:

- strukturierte Schemata und Validierung
- Entwurf, Vergleich, Review und Freigabe
- Unternehmensrezepte und kuratiertes Rezeptwissen
- Angebotsmuster und Pakete
- Preise, Lieferanten und Ersatzprodukte
- Geraeteprofile, Garhinweise und Produktionsfeedback
- Taxonomien, Mengenregeln und Einkauf
- Quellen-, Risiko- und Auditspur

Ein gemeinsames Portal darf beide Produkte verlinken. Die Produkte muessen
trotzdem getrennt startbar, nutzbar und spaeter getrennt auslieferbar sein.

### 3.4 Auftragsverlauf

Jedes Produkt besitzt einen eigenen stabilen Vorgang: `OfferCase` und
`ProductionCase`. Er enthaelt Anzeigename, Quellen, chronologischen Dialog,
Entwurfs- und Entscheidungsverweise sowie den aktuellen freigegebenen Stand.
Ein `ProductionHandoff` verknuepft beide Vorgaenge, ohne ihr Eigentum zu
vermischen.

Einen frueheren Auftrag weiterzufuehren erzeugt eine Revision. Ihn fuer eine
neue Veranstaltung zu verwenden erzeugt eine Kopie. Die Historie wird nie
ueberschrieben.

### 3.5 Artefakte, Eigentum und Freigabe

| Artefakt | Fachlicher Eigentuemmer | Veraenderbarkeit | Darf erzeugen |
| --- | --- | --- | --- |
| `OfferDraft` | Angebotsprodukt | versionierter Entwurf | nichts ohne Freigabe |
| `ApprovedOffer` | Angebotsprodukt | unveraenderlicher freigegebener Stand | `ProductionHandoff` |
| `ProductionHandoff` | Angebotsprodukt, lesbar fuer Produktion | unveraenderlicher Snapshot mit Herkunft und Version | `ProductionDraft` |
| `ProductionDraft` | Produktionsprodukt | versionierter Entwurf | nichts ohne Freigabe |
| `ApprovedProductionSpec` | Produktionsprodukt | unveraenderlicher freigegebener Stand | Plan, Rezepte, Einkauf und Mappe |
| Produktionsartefakte | Produktionsprodukt | aus freigegebener Version ableitbar und versioniert | Arbeitsansichten und Exporte |

Eine kanonische `ApprovalDecision` verweist auf Artefakt, Version, Entscheidung,
Zeitpunkt und verantwortliche Person. Review-Markierungen wie `Passt` oder
`Unklar` sind Arbeitsstand, aber keine zweite Freigabeautoritaet. Jede
Materialisierung verweist auf genau eine gueltige Freigabeentscheidung.

`AcceptedEventSpec` bleibt waehrend der Migration ein Legacy-Eingang oder
Payload-Bestandteil. Im Zielbild ist es weder gemeinsam beschreibbares Aggregat
noch verdeckte Uebergabe zwischen den Produkten.

## 4. Zielerlebnis der Oberflaeche

### 4.1 Grundform

Die Oberflaeche fuehlt sich wie ein praeziser Arbeitsdialog an, nicht wie ein
Dashboard voller Statuskarten. Sie verwendet viel Ruhe, klare Typografie,
wenige Farben und pro Zustand eine erkennbare Hauptaktion. Interne IDs,
Providerbegriffe, Schemawoerter und Entwicklertexte bleiben in technischen
Details.

Jede Produktstartseite ist zunaechst leer und bietet genau zwei Wege:

1. neuen Auftrag mit Datei, Text, Bild oder Sprache beginnen
2. frueheren Auftrag chronologisch oder ueber Suche oeffnen

Fruehere Auftraege tragen kurze menschliche Namen aus Kunde, Anlass, Datum und
Personenzahl. Demo- oder Beispieldaten duerfen nie wie echte aktuelle Auftraege
wirken.

### 4.2 Dokument und Dialog

Die Originalquelle bleibt innerhalb der App aufrufbar und scrollbar. Auf
grossen Bildschirmen koennen Quelle und Dialog parallel verglichen werden. Auf
Mobilgeraeten wechseln Quelle, Dialog und Ergebnis ohne Verlust der jeweiligen
Position. Der Dialog bleibt allgemein fuer den Auftrag und kann sich zugleich
auf eine markierte Stelle, ein Gericht oder eine Zutat beziehen.

Der fuehrende Arbeitsbereich ist ein dauerhafter chronologischer
Nachrichtenverlauf, kein Formular- oder Akkordeonstapel. Upload, Rueckfragen,
Aenderungswuensche, KI-Antworten und Freigaben erscheinen dort in ihrem
Zusammenhang. Jede Aktion zeigt sofort Arbeitsstatus, Ergebnis oder Fehler;
kein Klick bleibt ohne sichtbare Wirkung.

Nach dem Upload zeigt die App zuerst:

- was erkannt wurde
- was fehlt oder unsicher ist
- was die KI als Naechstes tun kann
- was der Benutzer jetzt entscheiden muss
- was erst nach Freigabe entsteht

Phasenanzeigen sind entweder echte Navigation oder reine Statusanzeige. Eine
nicht klickbare Anzeige darf nicht wie ein Knopf aussehen. Die App springt nach
einer Verarbeitung nicht mitten in lange Inhalte, sondern zeigt das Ergebnis
am nachvollziehbaren Anfang mit einer klaren naechsten Aktion.

### 4.3 Einfache Review

Review erfolgt in fachlichen Einheiten, nicht in technischen Datenfeldern:

```text
Passt | Aenderung noetig | Unklar | Blockiert
```

Ein Aenderungswunsch erzeugt eine neue sichtbare Entwurfsversion. Die UI zeigt
den Wunsch und das neue Ergebnis direkt beieinander. Erst eine Freigabe macht
aus dem Entwurf einen Produktstand.

Die Standardansicht zeigt genau den naechsten entscheidungsbeduerftigen Punkt,
seine Quelle und den Gesamtfortschritt. Bestaetigte Punkte klappen zusammen.
Quellengetreue, unkritische Positionen duerfen gesammelt bestaetigt werden;
sicherheits-, preis- oder freigaberelevante Punkte bleiben einzeln. Eine
dauerhaft sichtbare Hauptaktion fuehrt zum naechsten Schritt.

`Blockiert` sperrt nur das abhaengige Gericht oder Artefakt. Andere Planung darf
weiterlaufen. Erst die produktionsreife Gesamtfreigabe ist ausgeschlossen,
wenn ein kritischer Punkt sichere Herstellung, eindeutige Zuordnung oder eine
beanspruchte Allergen- oder Preisaussage unmoeglich macht.

### 4.4 Mobil

Mobil ist kein abgespeckter Notfallmodus. Dokument, Dialog, Review, Rezepte,
Einkauf und Rueckfragen bleiben vollstaendig erreichbar. Die Darstellung darf
sich stapeln, aber Inhalte und Entscheidungen nicht verlieren.

## 5. Produktionsdialog und Aenderungen

Die Produktion kann jederzeit fragen oder eine Aenderung anfordern, zum
Beispiel:

- Statt 100 kommen 120 Gaeste.
- Kalbsnuss fehlt, Roastbeef ist verfuegbar.
- Welche Kerntemperatur gilt fuer dieses Stueck?
- Welche Temperatur und welcher Dampf passen zum vorhandenen Konvektomaten?

Die KI erstellt daraus eine Aenderungsvorschau. Vor Uebernahme zeigt die App
betroffene Mengen, Rezepte, Einkauf, Zeiten und Annahmen. Navigation, Fragen
und Arbeitsschritte benoetigen keine Freigabe. Inhaltliche Aenderungen bestaetigt
standardmaessig der Kuechenchef; er kann diese Berechtigung je Auftrag
delegieren.

Bei einer laufenden Produktion zeigt die Vorschau Soll neu, bereits bestellt,
bereits produziert und noch zusaetzlich erforderlich. Abgeschlossene Schritte
und verbrauchte Bestaende werden nie rueckwirkend ueberschrieben. Die Produktion
entscheidet sichtbar ueber Nachproduktion, Ersatz oder bewusste Abweichung.

Antworten erscheinen kurz gesprochen und vollstaendig als Text. Lange Rezepte
werden nur auf Wunsch abschnittsweise vorgelesen. Kritische Werte wie
Kerntemperaturen bleiben sichtbar.

## 6. Rezeptwissensschicht

### 6.1 Drei getrennte Bereiche

1. **Private Unternehmensbibliothek:** eigene Rezepte, Varianten, Preise,
   Geraeteerfahrung und Feedback eines Betriebs.
2. **Kuratiertes Rezeptbuch:** fachredaktionell gepruefte Rezepte, auf Wunsch
   offen mit Autor oder anonymisiert.
3. **Kandidatenbereich:** KI-Entwuerfe, Webquellen, Importe und noch nicht real
   gekochte Rezepte.

Die Bereiche werden nicht automatisch vermischt. Ein Rezept wechselt nur durch
eine bewusste Entscheidung.

### 6.2 Zwei unabhaengige Bewertungen

**Praxiserfahrung:**

- noch nicht gekocht
- fuer einen Auftrag geprueft
- einmal gekocht und bewertet
- mehrfach im Betrieb bestaetigt

**Sichtbarkeit:**

- nur fuer diesen Auftrag
- private Unternehmensbibliothek
- zur redaktionellen Pruefung eingereicht
- im kuratierten Rezeptbuch veroeffentlicht

Ein betriebserprobtes Rezept wird dadurch nicht automatisch oeffentlich. Ein
kuratiertes Rezept ist im konkreten Betrieb nicht automatisch geraeteerprobt.

### 6.3 Einreichung und Redaktion

Rezepte koennen per Text, Sprache, PDF, Bild oder mehreren Fotos eingereicht
werden. Fehlende nichtkritische Details blockieren die Einreichung nicht.
Sicherheitsrelevante Luecken werden deutlich markiert.

Die zentrale Fachredaktion kann Rueckfragen stellen, Anmerkungen ergaenzen,
Darstellung vereinheitlichen, Varianten verbinden und eine Veroeffentlichung
freigeben. Einreicher sehen Stand und Begruendung.

### 6.4 Familien, Varianten und Versionen

Verwandte Rezepte bilden eine Familie. Betriebs-, Geraete- oder
Darreichungsvarianten bleiben eigenstaendige Versionen. Die App fuehrt keine
Varianten automatisch zusammen. Jede Aenderung traegt Quelle, Autor, Zeitpunkt
und Begruendung.

Auftragsbezogene Anpassungen bleiben zunaechst lokal. Erst bewusste Uebernahme
erzeugt eine neue allgemeine Unternehmensversion.

### 6.5 Externe Quellen

Web-, Buch- und Fremdrezepte bleiben Kandidaten. Quelle, Autor, Link,
Erfassungsdatum und Nutzungsrecht werden festgehalten. Fremde Texte oder Bilder
werden nicht still veroeffentlicht. Ein externes Rezept darf fuer einen Auftrag
skaliert und angepasst werden. Erst reales Kochen, Feedback und Freigabe machen
daraus Unternehmenswissen. Oeffentliche Veroeffentlichung verlangt zusaetzlich
geklaerte Rechte.

Ein Buchscan bleibt privat und gelangt ohne nachgewiesene Rechte nie ins
kuratierte Rezeptbuch. Veroeffentlichung verlangt eine ausdrueckliche
Nutzungsfreigabe sowie die Wahl zwischen Namensnennung und Anonymitaet.

### 6.6 Lernkreislauf

Nach jeder Produktion bietet die App eine kurze, freiwillige Rueckmeldung an:

- Mengen passend, zu viel oder zu wenig
- Geschmack und Konsistenz
- Zeit und Ablauf
- Geraeteeinstellung
- Einkauf und Ersatzprodukte
- Foto und freie Notiz

Feedback erzeugt einen Verbesserungskandidaten. Es veraendert nie still ein
Rezept. Private Rueckmeldungen bleiben privat, bis sie ausdruecklich geteilt
werden. Wachstum wird an der Abdeckung realer Angebote und bestaetigter
Produktion gemessen, nicht an der Anzahl gespeicherter Rezepte.

### 6.7 Zustaende und Migration bestehender Rezepte

Auftragsfreigabe und Wissensfreigabe bleiben getrennt. Ein noch ungeprueftes
Rezept kann nach ausdruecklicher Pruefung fuer genau einen Auftrag verwendet
werden, ohne dadurch zum Unternehmensstandard oder veroeffentlichten Rezept zu
werden.

Der fuehrende Uebergang lautet:

```text
Import oder KI-Vorschlag -> Kandidat
-> auftragsbezogen gepruefte Version
-> real gekocht und bewertet
-> bewusst in die Unternehmensbibliothek uebernommen
-> optional redaktionell geprueft und mit geklaerten Rechten veroeffentlicht
```

Die vorhandenen Achsen `RecipeTier` und `RecipeApprovalState` werden nicht
mechanisch in die neuen Praxis- und Sichtbarkeitswerte umgedeutet. Eine kleine
Migrationsentscheidung ordnet jeden alten Zustand zu; unklare Faelle bleiben
Kandidaten. `auto_usable` darf hoechstens operative Eignung ausdruecken und nie
eine Wissens-, Praxis- oder Veroeffentlichungsfreigabe vortaeuschen.

## 7. Professionelle Produktionsgrundlage

Ein Produktionsentwurf muss alle angebotenen Speisen entweder vollstaendig
enthalten oder als konkrete offene Frage fuehren. Vollstaendig bedeutet: Jede
benannte Hauptkomponente, Beilage, Sauce, Garnitur und Zukaufposition ist
einzeln strukturiert und ihrer Angebotsposition zugeordnet. Das Bewahren der
vollstaendigen Textzeile allein gilt nicht als fachliche Erfassung. Fuer jedes
relevante Gericht werden benoetigt:

- Menge pro Person oder Einheit und Gesamtmenge
- vollstaendige Produktionszutaten
- skalierte Produktionsschritte
- Mise en Place, Zeiten, Lagerung und Anrichten
- verwendete Eigenproduktion, Teilzukauf oder Fertigprodukt
- benoetigte Geraete und betriebliche Variante
- konkrete Ofen-, Dampf- und Kerntemperaturen, soweit fachlich erforderlich
- Quelle, Erfahrungsstand und Annahmen

Ungepruefte oder aus oeffentlichen Quellen abgeleitete Rezepte duerfen in der
Anlaufphase nach einer gemeinsamen menschlichen Auftragspruefung verwendet
werden. Kritische Sicherheitsluecken muessen vorher geklaert sein. Es gibt
keine vollstaendige Blockade nur wegen unwesentlicher fehlender Details.

Die Produktionsmappe bleibt ein druckbares A4-Arbeitsdokument. Jede Rezeptkarte
beginnt auf einer neuen Seite. Die Einkaufsliste versucht Seitenumbrueche nach
vollstaendigen Warengruppen zu setzen. Fehlende Daten werden ehrlich
ausgewiesen. Nicht aus der Quelle stammende fachliche Ergaenzungsvorschlaege
stehen getrennt als Annahme mit Herkunft und Unsicherheit.

## 8. Einkauf und Preise

### 8.1 Einkaufsliste

Die Einkaufsliste basiert auf allen produktionswirksamen Rezeptzutaten und
Zukaufskomponenten. Ein Coverage-Check weist jede Zutat einer Einkaufsposition
oder einer bewussten Ausnahme zu. Die Liste ist mobil offline nutzbar und als
PDF druckbar. Sie zeigt Warengruppe, Artikel, Menge, Gebinde, Lieferant,
Verwendung und Pruefstatus.

Der Einkaeufer kann Nichtverfuegbarkeit oder Ersatz per Text, Sprache oder Foto
melden. Die KI zeigt betroffene Rezepte; eine Aenderung wird erst nach Freigabe
durch den Kuechenchef aktiv.

### 8.2 Preisquellen

Lexware, Metro und andere Systeme sind austauschbare Quellen, nicht Teil der
Kernlogik. Ein Preisdatensatz enthaelt mindestens Artikel, Gebinde, Einheit,
Lieferant, Netto-/Bruttobezug, Kaufdatum, Standort, Quelle und Pruefstatus.

Rechnungen, Scans, Bilder und Portalimporte erzeugen pruefpflichtige
Preisvorschlaege. Kalkulation verwendet den juengsten passenden geprueften
Preis. Ein alter Preis bleibt mit Alter und Warnung nutzbar. Ohne belegten Preis
bleibt die Position sichtbar offen; Produktion und Einkauf werden nicht
blockiert, aber ein Angebot darf keine scheinbar vollstaendige Marge zeigen.

### 8.3 Lagerbestand

Das Harness wird nicht nebenbei zur Warenwirtschaft. Bestaetigte vorhandene
Mengen koennen von der Einkaufsliste abgezogen werden. Unklare Bestaende werden
nicht angerechnet. Externe Warenwirtschaft kann spaeter ueber Adapter liefern.

## 9. KI-Anbindung und Wissensgrenze

### 9.1 Anschlussarten

Alle KI-Wege verwenden denselben fachlichen Entwurfsvertrag:

- eigener API-Schluessel
- Nutzerkonto oder Abonnement ueber ein lokal angemeldetes Werkzeug
- lokal betriebenes quelloffenes Modell
- kundeneigener Gateway
- optional von uns verwalteter Zugang

Es gibt keinen stillen Providerwechsel. Kosten- und Anfragelimits sind pro
Betrieb sichtbar. Ohne konfigurierte KI bleiben gepruefte Daten nutzbar.

CLI- und Abonnement-Adapter laufen als reine Inferenz ohne Datei-, Shell-,
Repository- oder eigenstaendige Werkzeugzugriffe. Webrecherche erfolgt nur
ueber Harness-kontrollierte Quellenadapter. Jede Kombination aus Provider,
Modell und Aufgabe besitzt einen belegten Qualitaetsstand. Eine unbekannte
Kombination wird sichtbar als ungeprueft behandelt und verlangt verstaerkte
Review.

### 9.2 Wissensauswahl

Die KI erhaelt nicht pauschal die gesamte Unternehmensdatenbank, sondern nur
den fuer die Aufgabe benoetigten Zusammenhang: Auftrag, passende Rezepte,
Geraeteprofil, relevante Preise, bestaetigtes Feedback und gekennzeichnete
Annahmen. Jede wichtige Aussage besitzt eine dezente aufklappbare
Quellenanzeige.

### 9.3 Harte Grenze

- keine direkten KI-Schreibzugriffe auf kanonische Produktobjekte
- keine direkten KI-Schreibzugriffe auf geprueftes Wissen
- keine Raw-Prompts oder Raw-Antworten in Audit, Logs oder Exporten
- keine automatische Freigabe von Allergenen, Preisen, Margen,
  Garparametern oder Produktsicherheit
- kein Training eines externen Anbieters mit Unternehmensdaten, soweit durch
  Anbieterwahl und Vertrag steuerbar
- Anbieter- und Modellmetadaten ohne Rohinhalt bleiben nachvollziehbar

### 9.4 Datenklassen und Providerfreigabe

- **Synthetisch/Demo:** erfundene oder ausdruecklich fuer Tests freigegebene
  Daten ohne Personenbezug.
- **Nachweisbar anonymisiert:** eine Zuordnung zu Personen oder Unternehmen ist
  mit vertretbarem Aufwand nicht mehr moeglich.
- **Pseudonymisiert:** direkte Kennzeichen wurden ersetzt, eine Rueckzuordnung
  bleibt aber moeglich; diese Daten gelten weiterhin als schutzbeduerftig.
- **Private Unternehmensdaten:** Rezepte, Preise, Angebote und Betriebswissen,
  die nur nach der Providerregel des Betriebs verarbeitet werden duerfen.
- **Personenbezogene oder besonders vertrauliche Daten:** benoetigen eine
  ausdrueckliche Rechts-, Vertrags- und Betriebsfreigabe.

Pseudonymisierung ist keine Anonymisierung und kein automatisches Daten-Go. Der
heutige Modusname `pseudonymized_approved` wird bis zu einer eigenen
Migrationsentscheidung nur als technischer Altname behandelt. Provideradapter
pruefen Datenklasse, Betriebsfreigabe, Faehigkeit, Kostenlimit und Zielregion,
bevor sie einen Auftrag annehmen.

Ein echter Auftrag darf einen externen Provider erst erreichen, wenn der
Betrieb Anbieter, Datenklasse, Verarbeitungszweck, Region, Aufbewahrung,
Trainingsnutzung und Vertragsgrundlage ausdruecklich freigegeben hat. Nicht
benoetigte Personen- und Kontaktdaten werden vorher entfernt. Lokale
Verarbeitung bleibt eine gleichwertige Alternative.

Jeder Adapter muss denselben Vertrag erfuellen: strukturierter Input mit
Quellenbezug, schema-validierter Entwurf, Zeitlimit, Kosten-/Nutzungsmetadaten,
klare Fehlerklasse und kein stiller Fallback. Nicht unterstuetzte Faehigkeiten
werden sichtbar abgelehnt.

Das Central Agent Data Hub ist Architekturvorbild fuer die Trennung von
Signalen, Fakten, Entscheidungen und Risiken. Produktdaten werden jedoch in der
kundengebundenen Catering-Wissensschicht gespeichert, nicht im Agenten-Hub.

## 10. Optionale Kuechenstation

### 10.1 Hardware bleibt optional

Die App funktioniert mit vorhandenen Computern, Tablets, Bildschirmen und
Handys. Zusaetzlich koennen drei Pakete angeboten werden:

1. vorhandener Bildschirm plus kleiner Rechner und Handy-Fernsteuerung
2. einfache Touchstation fuer trockene Kuechen- oder Buerobereiche
3. professionell geschuetzte Station fuer anspruchsvolle Produktionsbereiche

Touch und Sprache sind die Hauptbedienung. Tastatur und Maus bleiben optional.
Ethernet ist der bevorzugte Betriebsweg, WLAN eine vollwertige Option. Der
Bildschirm kann eigene Lautsprecher verwenden; ein Mikrofonmodul darf
abnehmbar sein.

Vorderseitiger IP-Schutz schuetzt keine Rueckseite, Anschluesse oder Netzteile.
In Spritz- oder Reinigungsbereichen braucht die Rueckseite ein professionelles
Metall- oder geprueftes Industriegehaeuse mit Dichtung, Kabelverschraubung,
Zugentlastung und geeignetem Waermekonzept. 3D-Druck ist fuer abnehmbare
Halterungen, Kabelhilfen und Prototypen geeignet, aber nicht als behaupteter
IP-, Brand- oder Elektroschutz.

Drucker, Mikrofon, Thermometer und weitere Peripherie sind ueberspringbare
Optionen. Ohne Drucker bleiben PDF, Bildschirmansicht und Weitergabe an ein
Buerogeraet verfuegbar.

### 10.2 Handy als Begleitung

Ein kurz gueltiger QR-Code koppelt das Handy an Auftrag und Benutzer. Das Handy
kann vollstaendige Rezepte und Einkaufslisten zeigen und dient zugleich als:

- Sprechtaste und Mikrofon
- Fernsteuerung fuer Blaettern und Scrollen
- Eingabe fuer Aenderungen und Rueckfragen
- Kamera fuer Produktionsfeedback
- Empfaenger fuer Timer und Warnungen

Im lokalen Betrieb verbindet es sich mit derselben lokalen Instanz, im
gehosteten Betrieb mit derselben geschuetzten Serverinstanz. Bluetooth ist
keine Voraussetzung fuer die Kopplung. Sprachaufnahmen werden nach der
Umwandlung in bestaetigten Text geloescht. Fotos bleiben beim Auftrag, bis sie
bewusst in Wissen uebernommen werden.

### 10.3 Kuechenansicht

Die Station zeigt keine Verwaltung, sondern den Produktionsmodus:

- Tagesansicht mit Auftraegen und Fortschritt
- ein geoeffnetes Rezept mit Zutaten, Schritt, Zeiten und Temperaturen
- grosse dauerhaft erreichbare Knoepfe fuer Sprechen und Tagesansicht
- kein automatisches Verlassen des Rezepts bei Inaktivitaet
- Wiederherstellung von Rezept, Schritt und Scrollposition nach Neustart
- mehrere Stationen koennen parallel unterschiedliche Rezepte oeffnen

Status verwendet Farbe, Text und Symbol:

- Grau: offen
- Gelb: in Arbeit
- Gruen: fertig
- Rot: blockiert

Daneben stehen Mitarbeiter, Station oder beide. Widerspruechliche Aenderungen
werden nicht automatisch zusammengefuehrt.

### 10.4 Timer, Temperaturen und Geraetewissen

Timer werden bewusst per Touch oder Sprache gestartet, laufen beim Wechsel des
Rezepts weiter und markieren keinen Schritt automatisch als fertig.
Kerntemperaturen koennen per Touch oder Sprache erfasst werden.

Geeignete Bluetooth- oder Funkthermometer werden von Anfang an ueber eine
einheitliche Sensor-Schnittstelle vorgesehen. Direkter Browserzugriff ist nur
ein optionaler Weg. Fuer verlaessliche Dauermessung verbindet ein lokales
Sensor-Gateway oder eine kleine offene Begleit-App das Geraet mit dem Harness.
Manuelle Messung bleibt immer moeglich.

Ein Garprotokoll kann Geraet, Beladung, Produktgroesse, Starttemperatur,
Ofentemperatur, Dampf, Kerntemperaturverlauf, Dauer und Bewertung speichern.
Aus bestaetigten Durchlaeufen entstehen betriebs- und geraetespezifische
Empfehlungen. Das Harness steuert im ersten Zielstand keine Oefen automatisch.

### 10.5 Reinigung, Einrichtung und Wartung

Der Reinigungsmodus sperrt Touch und Mikrofon, laesst Timer weiterlaufen und
kehrt zum selben Rezept zurueck. Die Einrichtung prueft vorhandene Funktionen,
aber erlaubt fuer jede Peripherie `Nicht vorhanden` oder `Spaeter einrichten`.

Aktualisierungen laufen nicht waehrend aktiver Produktion. Vorher wird der
Arbeitsstand gesichert; ein Fehler startet die vorherige funktionierende
Version. Fernhilfe erfordert einen kurz gueltigen Support-Code, bleibt sichtbar
und kann sofort beendet werden. Technische Protokolle enthalten keine Kunden-,
Angebots- oder Rezepttexte.

## 11. Ausfallsicherheit und Synchronisation

Geoeffnete Auftraege, Rezepte, Mengen, Ablauf und Einkaufsliste bleiben lokal
verfuegbar. Abhaken, Notizen, Messwerte und Fotos werden zwischengespeichert.
Lokales Drucken bleibt moeglich. Nicht verfuegbare KI-Funktionen werden ehrlich
zurueckgestellt. Nach Rueckkehr der Verbindung wird synchronisiert.

Mehrere Stationen teilen Fortschritt, springen aber nicht gegenseitig in andere
Ansichten. Bei Konflikten bleibt die letzte freigegebene Version aktiv, bis der
Kuechenchef entscheidet.

## 12. Rollen und einfache Anmeldung

- **Koch:** Rezepte lesen, fragen, Schritte und Messwerte erfassen
- **Kuechenchef:** Aenderungen freigeben, Aufgaben verteilen, abschliessen
- **Einkaeufer:** Einkauf bearbeiten, Verfuegbarkeit und Ersatz melden
- **Redaktion/Verwaltung:** Rezepte kuratieren, Geraete und Benutzer verwalten

Eine Person kann mehrere Rollen besitzen. Die feste Station wird zu
Schichtbeginn entsperrt. Benutzer waehlen ihren Namen oder koppeln ihr Handy.
Kritische Freigaben verlangen persoenliche PIN oder gekoppeltes Geraet, aber
keine langen Passwoerter auf dem Touchbildschirm.

## 13. Datenhoheit und Betriebsformen

Unternehmensrezepte, Preise, Auftraege, Feedback und Geraeteprofile sind je
Betrieb getrennt. Eine lokale Einzelbetriebsinstallation darf diese Grenze
durch die Installation selbst bilden. Ein gehosteter Betrieb braucht eine
ausdrueckliche Mandantengrenze. Globale kuratierte Rezepte bleiben getrennt von
privatem Unternehmenswissen.

Vollstaendiger Export ist jederzeit in offenen Formaten moeglich:

- PDF fuer menschliche Arbeitsdokumente
- JSON fuer strukturierte Vollstaendigkeit
- CSV fuer Tabellen und Weiterverarbeitung
- Originaldateien mit Quellen- und Versionsbezug

Der Export umfasst alle eigenen und abgeleiteten Unternehmensdaten. Gemeinsam
kuratierte Inhalte werden nur im Rahmen ihrer Lizenz exportiert; andernfalls
enthaelt der Export eine stabile Referenz und die eigenen Betriebsvarianten.

Lokale Sicherung, Wiederherstellung und vollstaendige Loeschung sind
verbindlich. Ein Betrieb kann KI, Hosting oder Hardware wechseln, ohne sein
Wissen zu verlieren.

### 13.1 Betriebsprofile

| Profil | Grenze | Speicher und KI |
| --- | --- | --- |
| Entwicklung/Test | nur synthetische oder freigegebene Testdaten | lokale Testwurzel, Fixture oder bewusst gewaehlter Provider |
| Lokal, ein Betrieb | Installation bildet die Betriebsgrenze | Datei oder lokales PostgreSQL; API, lokales Modell oder lokal angemeldetes Werkzeug |
| Gehostet, mehrere Betriebe | verpflichtender Betriebskontext in jeder Anfrage | mandantenfaehiges PostgreSQL; je Betrieb freigegebener Provider |

Der heutige npm-/screen-Stack und Compose sind Implementierungsbelege, aber
noch keine fertigen Produktinstallationen. Offline-Puffer, Konfliktloesung,
QR-Kopplung, Sprache, Sensorik und Mehrbetriebsbetrieb bleiben getrennt zu
testende Zielbausteine. Kein Zieltext darf als bereits verfuegbare
Betriebszusage erscheinen.

## 14. Abgleich mit dem bestehenden Code

### 14.1 Tragfaehige Grundlage

Der aktuelle Monorepo-Zuschnitt kann den Uebergang tragen. Bestehende
Bausteine fuer `ProductionDraft`, Review, Revision, Apply, Rezeptbibliothek,
Purchase Coverage, Produktionsmappe, Provideradapter, PostgreSQL und Audit
werden weiterverwendet. Der Produktionsentwurf bildet bereits die gewuenschte
Entwurfs- und Freigabegrenze am vollstaendigsten ab.

- `intake-service` bleibt Dokumentaufnahme, nicht dauerhafte Heuristikzentrale.
- `offer-service` bleibt fachlicher Angebotskern.
- `production-service` bleibt fachlicher Produktionskern.
- `print-export` bleibt Darstellung freigegebener Artefakte.
- `backoffice-ui` wird schrittweise in zwei eigenstaendige Produktschalen
  getrennt; ein gemeinsamer Einstieg ist nur Navigation.

In Stufe A entsteht kein neuer Laufzeitdienst und keine zweite Persistenzwelt.
Beide Produkte verwenden einen logischen Wissens-Port. Lokal darf sein Adapter
im selben Prozess und auf derselben Datenbank laufen. Bei getrennter
Auslieferung kann derselbe Vertrag ueber eine API bedient werden. Eine spaetere
reine Vertragsbibliothek ist ein Paket, kein eigener Dienst.

### 14.2 Ehrliche Luecken des heutigen Stands

1. Der Angebotsfluss besitzt noch keine gleich starke Freigabegrenze wie der
   Produktionsfluss. Die heutige Promotion kann eine gewaehlte Variante direkt
   in eine akzeptierte Spezifikation ueberfuehren. Ziel ist zwingend
   `OfferDraft -> ApprovedOffer -> unveraenderlicher ProductionHandoff`.
2. Angebots- und Produktionsprodukt sind heute UI-Routen und Prozesse, aber
   noch keine sauberen Anwendungsgrenzen. Dienste importieren Store-Code direkt
   und die UI laedt Daten mehrerer Fachbereiche gemeinsam.
3. Der gehostete Betrieb besitzt noch keine belastbare Betriebs- oder
   Mandantentrennung. Objekte, Audit und Repository-Schluessel sind derzeit
   global. Vor Betrieb fuer mehrere Unternehmen muss der Betriebskontext in
   jedem kanonischen Objekt, Actor, Audit-Eintrag und Speicherzugriff gelten.
4. `shared-core` mischt heute Fachvertraege mit Persistenz, Providertransport,
   Fixtures und Auswertungswerkzeugen. Ziel ist ein browser- und
   providerneutraler Vertragskern; technische Adapter wandern schrittweise an
   die Raender, sobald Tests ihren Ersatz belegen.
5. Die BYO-Laufzeit unterstuetzt real erst Fixture, OpenAI und Codex CLI.
   Lokale HTTP-Modelle, weitere Anbieter, OAuth und kundeneigene Gateways sind
   Zielbild und duerfen bis zur Implementierung nicht als vorhanden gelten.
6. Rezepte und Produktionsfeedback sind wertvolle Anfaenge, bilden aber noch
   keine gemeinsame betriebsgebundene Wissensschicht fuer Angebote, Preise,
   Ersatzprodukte und Geraeteerfahrung.

Diese Luecken sind Migrationsarbeit, keine Gruende fuer einen Neubau. Jeder
Schritt erhaelt bestehendes Verhalten oder ersetzt es mit einem belegten
Vertragstest.

### 14.3 Zielgrenzen fuer Code

- eine Einheit hat einen fachlichen Zweck und einen kleinen oeffentlichen Vertrag
- UI kennt keine Store-Dateien oder Providertransporte
- Provider kennen keine Produktfreigabe
- Exporte erfinden keine Fachdaten
- Wissensuebernahme ist eine eigene bestaetigte Aktion
- Hardwareadapter liefern normalisierte Ereignisse, keine UI-Logik

Die Zielrichtung fuer den Vertragskern lautet:

- Domaintypen, JSON-Schemata, Validatoren und Taxonomien bleiben frei von
  Node-, Speicher- und Providerabhaengigkeiten.
- Kein Produkt importiert Repository- oder Store-Implementierungen des anderen
  Produkts. Eigene interne Stores bleiben erlaubt; Produktgrenzen sprechen
  ueber ausdrueckliche Ports statt Quellpfadimporte.
- Die lokale Einzelbetriebsinstallation bindet einen festen Betriebskontext;
  der gehostete Adapter verlangt ihn bei jeder Anfrage.
- Die Kuechenstation liest freigegebene Produktionsansichten und schreibt nur
  eng begrenzte Arbeitsereignisse, Fragen und Feedback. Sie greift weder direkt
  auf Datenbank noch KI-Transport zu.

## 15. Beweisgestuetzter Ballast-Abbau

Das Ziel ist weniger, klarerer Code. Loeschkandidaten werden zuerst durch
aktuelles Verhalten und Abhaengigkeiten belegt:

1. Parser-Sonderfaelle, sobald der KI-Entwurf dieselbe Fallklasse vollstaendig
   und ueberwachbar abdeckt
2. alte Mini-Pilot-, Demo- und Readiness-Flaechen ohne aktuellen Nutzerpfad
3. technische Arbeitsflaechen, die durch Dokument-Dialog und Review ersetzt sind
4. doppelte UI-Zustandsableitungen und Route-Splitter ohne Fachverantwortung
5. nicht genutzte Import- und Spezialpfade ohne aktuellen Abnehmer
6. Prozessdokumentation, die nur abgeschlossene Zwischenstufen wiederholt

Loeschregel:

```text
Ein alter Pfad wird erst entfernt, wenn ein Verhaltens- oder E2E-Test den
Ersatz fuer die gesamte Fallklasse belegt und eine Rueckfallmoeglichkeit besteht.
```

Jeder Umbau-Slice soll nach Moeglichkeit weniger Produktcode hinterlassen als
vorher. Keine Kompatibilitaetsschicht bleibt ohne benannten Abnehmer und
Entfernungsbedingung bestehen. Kein Grossumbau verbindet UI, Fachmodell,
Persistenz und Provider in einem Schritt.

## 16. Umsetzungsfolge

### Stufe A: Produktschalen und Kernfluss

- Betriebskontext in kanonischen Vertraegen und Speicherports verankern; lokal
  fest binden, gehostet verpflichtend pruefen
- Angebotsfreigabe und unveraenderliche Produktionsuebergabe herstellen
- freigegebenen echten Datenpfad oder vollstaendig lokale Verarbeitung als
  ausdrueckliches Security-, Datenschutz- und Betriebs-Gate definieren
- Angebots- und Produktionsprodukt sichtbar trennen
- leere Starts, Auftragsverlauf, Suche und Dokument-Dialog herstellen
- Review und Revision als einzigen Weg vom KI-Entwurf zum Produkt festigen
- bestehende Produktionsqualitaet gegen reale Vergleichsfaelle sichern

### Stufe B: Wissensschicht

- drei Rezeptbereiche und zwei Bewertungsachsen abbilden
- Familien, Versionen, Quellen, Rechte und redaktionelle Review einfuehren
- Feedback aus realer Produktion als Verbesserungskandidaten nutzbar machen
- Preisquellen und Einkauf in dieselbe Provenienzlogik einordnen

### Stufe C: Alltag und Mobilbetrieb

- vollstaendige mobile Nutzung, Offline-Puffer und Synchronisation
- Tagesansicht, Aufgaben, Timer, Temperaturen und Einkaufsmodus
- QR-Kopplung und einfache Rollen

### Stufe D: Offene Kuechenstation

- vorhandene Hardware zuerst unterstuetzen
- einfache Referenzstation im eigenen Betrieb pilotieren
- Sensor-Gateway und mindestens ein dokumentiert anbindbares Thermometer testen
- geschuetzte Station erst nach realem Reinigungs-, Laerm- und Handschuhtest

### Stufe E: Breitere Produktfaehigkeit

- gehostete Mandantengrenze und Kundenkonfigurator
- weitere Preis-, Lieferanten- und Unternehmensadapter nach realem Bedarf
- kuratiertes Rezeptbuch mit zentraler Fachredaktion

Jede Stufe wird in kleinen Plaenen umgesetzt. Keine spaetere Stufe darf eine
fruehere Vertrauens- oder Datenhoheitsgrenze umgehen.

## 17. Abnahmekriterien fuer 10/10

Das Endziel gilt erst als erreicht, wenn folgende Verhaltensklassen real
belegt sind:

1. Ein neues PDF oder Bild startet in beiden Produkten sichtbar leer und fuehrt
   ohne Suche zum richtigen naechsten Schritt.
2. Jede angebotene Speise erscheint im Entwurf oder als konkrete Rueckfrage.
3. Quelle und erkannte Daten lassen sich in derselben Oberflaeche vergleichen.
4. Aenderungen erzeugen sichtbare Revisionen; ohne Freigabe entstehen keine
   kanonischen Produktobjekte.
5. Eine reale Produktionsmappe ist fachlich mindestens so vollstaendig und
   praktisch nutzbar wie der bisherige GPT-Arbeitsweg.
6. Rezepte, Einkauf, Seitenumbrueche, Temperaturen und Geraetehinweise bestehen
   die Pruefung eines Kuechenchefs in realer Produktion.
7. Einkauf ist mobil offline und als PDF praktisch nutzbar.
8. Ein KI-Anbieter kann gewechselt werden, ohne Produkt- oder Wissensdaten zu
   migrieren.
9. Eine laufende Produktion bleibt bei Internet- und Providerausfall nutzbar.
10. Vorhandener Bildschirm plus Handy sowie eine Referenz-Touchstation bestehen
    denselben Kernablauf.
11. Datenexport und Wiederherstellung werden an einer lokalen und einer
    gehosteten Installation nachgewiesen.
12. Desktop und Mobil zeigen keine technischen IDs, unerklaerten Fachjargon,
    funktionslosen Statusknoepfe oder unkontrollierten Layoutspruenge.
13. Automatisierte Tests sichern Vertraege und Fallklassen; Operatorproben sichern
    Verstaendlichkeit und reale Arbeitsfaehigkeit.
14. Ein realer Angebotsfall verwendet belegte Preise, zeigt fehlende oder alte
    Preise ehrlich, wird freigegeben und erzeugt einen unveraenderlichen
    `ProductionHandoff` ohne scheinpraezise Marge.
15. Ein frueherer Auftrag kann gefunden, fortgesetzt und fuer eine neue
    Veranstaltung kopiert werden, ohne seine Historie zu ueberschreiben.
16. Ein unvollstaendiger Rezeptimport kann auftragsbezogen geprueft genutzt,
    nach der Produktion bewertet und bewusst in Unternehmenswissen uebernommen
    werden.
17. Derselbe Referenzfall funktioniert ueber API und mindestens einen
    abonnementbasierten Inferenzweg ohne Copy-and-paste, freie Agentenwerkzeuge
    oder stille Auslassung.
18. Ein zweiter Betrieb kann ohne Codeaenderung eingerichtet werden; kein
    Objekt, Suchergebnis, Audit-Eintrag oder Export ist betriebsuebergreifend
    sichtbar.

## 18. Bewusste Nicht-Ziele

- kein autonomes Produktionssystem ohne menschliche Verantwortung
- kein eigenes Grundmodell und kein Training auf Kundendaten
- keine Bindung an einen KI-, Hardware-, Hosting- oder Lieferantenanbieter
- keine universelle Warenwirtschaft oder Buchhaltung
- keine automatische Allergen-, Preis-, Margen- oder Lebensmittelfreigabe
- keine direkte Ofensteuerung im ersten Zielstand
- keine eigene Hardwarefertigung vor erfolgreichem Pilot
- keine 3D-gedruckte Sicherheits-, Brand- oder IP-Schutzbehauptung
- keine neue Framework-Schicht ohne belegte Verringerung der Komplexitaet

## 19. Referenzen und historische Einordnung

**Normative fachliche Grundlage in ihrem jeweiligen Geltungsbereich:**

- `docs/product/KITCHEN_CORE_V1.md` fuer deterministische Produktionsregeln
- `docs/architecture/MEMORY_ARCHITECTURE.md` fuer Datenhoheit und die Trennung
  von operativem Zustand, Kandidaten und geprueftem Wissen
- `backoffice-ui/PRODUCT.md` fuer die ruhige, handlungsorientierte
  Produktoberflaeche

**Weiter geltende Schutz- und Betriebsgrenzen:**

- aktuelle Auth-, Upload-, PII-, Approval-, Provider- und Deployment-Gates
- `docs/architecture/PRODUCTION_AGENT_V1_ARCHITECTURE_GATE.md` nur fuer
  Quellen-, Validierungs-, Prompt-Injection- und Human-Approval-Invarianten

**Beleg des heutigen Betriebs, keine Zielarchitektur:**

- `README.md`, `TESTING.md` und `platform-infra/README.md`
- Code und automatisierte Tests

Alte Production-Agent-Stufenplaene, PA-/Readiness-Ketten, Gap-Audits,
User-Story-Snapshots, Workbench-Plaene und fruehere Deployment-Narrative bleiben
historische Nachweise. Ihre Reihenfolge und damaligen Ist-Aussagen sind
ueberholt. `.codex`-Goals und der Ziellauf steuern einzelne Arbeitseinheiten,
sind aber keine dauerhafte Architekturautoritaet. Bei Widerspruch gilt dieses
Dokument fuer das Zielbild und das jeweils strengere aktuelle Schutz-Gate fuer
das heute Erlaubte.

Aktuelle, nicht bindende Hardware- und Schnittstellenreferenzen:

- faytech 24-Zoll-Touchmonitor: IP65 Front, IP40 Rueckseite, VESA und
  integrierte Lautsprecher
  <https://faytech.com/product/24-capacitive-touch-monitor-alu-frame/>
- Shuttle DL40N: luefterlos, Ethernet, optionales WLAN und VESA
  <https://www.shuttle.eu/fileadmin/resources/download/spec/slim/DL40N_e.pdf>
- Chrome Bluetooth: direkter Browserzugriff auf geeignete Geraete ist
  plattformabhaengig
  <https://support.google.com/chrome/answer/6362090>
- Apple Core Bluetooth: Grundlage fuer eine kleine iPhone-Begleit-App
  <https://developer.apple.com/documentation/corebluetooth>

Die Referenzen beschreiben einen moeglichen Pilot, keine Kaufpflicht und keine
Herstellerbindung.
