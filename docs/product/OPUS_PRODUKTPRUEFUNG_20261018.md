# Opus-Produktprüfung CateringOS: b384c19 / Produkt 75d9f46, synthetischer Stack 127.0.0.1:43200

**Ergebnis:** NO-GO für einen echten Pilot, und auch keine abgeschlossene interne Abnahme. Die Rechnungen stimmen durchgängig: Preise, Portionen, Einkaufsliste und 2 g Zimt. Aber drei Probleme betreffen Sicherheit und Wahrheit der Unterlagen: Die Sonderkostfälle verschwinden aus den Küchenunterlagen, der automatische Angebotsentwurf erfindet Leistungen und einen Preis, und die Mengenvorschau zeigt falsche Werte. Diese drei sollten vor jeder weiteren Abnahme behoben und dann erneut im Browser geprüft werden.

**Modell:** claude-opus-5-5 (laut Laufzeitumgebung).

**Werkzeuggrenzen:**
- `--browser chromium` ging nicht, weil „Chrome for Testing“ nicht installiert ist. Laut CLI-Hilfe sind nur chrome/firefox/webkit/msedge erlaubt; ich habe deshalb eine eigene isolierte Session mit `--browser chrome` gestartet.
- `mkdir output/playwright/...` wurde blockiert. Screenshots, PDF und CSV liegen daher im Standardordner der CLI, `.playwright-cli/` im Worktree.

## Was ich selbst in der Oberfläche bedient habe
- **Start → Frühere Aufträge → Referenzauftrag geöffnet:** Menü, Preisaufstellung, Angebotstexte, technische Details und übergebene Veranstaltungen angesehen. Den Angebotsexport (HTML) geöffnet.
- **Produktion:** über „Zur Produktion“, über die Produktionsgeschichte und über die direkte URL mit Fall-ID geöffnet. Plan, sekundäre Details, Mengensteuerung, Einkaufsliste, Herkunft und Rezeptprüfung angesehen. Die Produktionsmappe als HTML geöffnet und als Druck-PDF erzeugt und angesehen. Den CSV-Export heruntergeladen und 12 Sammelsummen von Hand nachgerechnet.
- **Fehlerfälle ohne Speichern:**
  - Mengen: −1, „0,6“ und „0.6“ eingegeben, Vorschau geöffnet, dann „Abbrechen“.
  - Preis-Editor: Komma im Preis, leere Steuer, Gäste = 0, „abc“ als Stunden, dann „Verwerfen“.
- **Desktop 1440 px und mobil 390 px** angesehen und horizontales Überlaufen gemessen.
- **Neuer Testauftrag über die normale Oberfläche:** „SYNTHETISCHER OPUS-TESTAUFTRAG“, 20 Gäste, 2 glutenfrei, Kennung `draft-request-ui-58cf0ec8-…`. Ich habe ihn erstellt und exportiert, aber keine Variante freigegeben. Er liegt jetzt offen im synthetischen Datenbestand und kann später aufgeräumt werden.

**Nur übernommen, nicht selbst bedient:** Rezeptimport und -zuordnung, die 13 Prüfkarten, interne Freigabe, Übernahme in die Produktion und der Neustart des Stacks. Ich habe nur die Ergebnisse gesehen. Bewusst nicht geklickt habe ich „Speichern“, „Änderung übernehmen“, „Variante freigeben“ und „An Produktion übergeben“, um den Referenzstand nicht zu verändern und keine Freigaben zu erzeugen. Eine doppelte Übergabe und die serverseitige Prüfung beim Speichern sind deshalb nicht getestet. **Daraus folgt kein eigenes vollständiges End-to-End-PASS.**

## P1 – betrifft Sicherheit oder Wahrheit der Unterlagen

**1. Sonderkost und Zeitplan gehen auf dem Weg in die Küche verloren.**
- Die Originalanfrage enthält „4 Gäste glutenfrei, 3 Schalenfruchtvermeidung“ sowie Anlieferung 16:30, Empfang 18–19 und Buffet 19–21.
- Nach Wiederöffnen des Produktionsfalls findet sich dazu nichts, weder in Plan, sekundären Details, Produktionsmappe, Druck, CSV noch im Angebotsexport. Die Suche nach „glutenfrei“ oder „Schalenfrucht“ ergibt keinen Treffer.
- Stattdessen steht dort „Offene Punkte: keine“, „Rückfragen: keine“ und in der Mappe „Keine blockierenden Rückfragen“.
- Laut den Belegen des Koordinators stand der Hinweis nur in den eingefrorenen Prüfkarten.
- Beim neuen Testauftrag erzeugt „2 Gäste glutenfrei“ keinen einzigen offenen Punkt.
- **Erwartet:** offene Sonderkostpunkte sichtbar in Mappe und Produktionsansicht, bis ein Mensch sie geklärt hat.
- **Einordnung:** Die vorhandenen Notizen und offenen Punkte in die Mappe zu übernehmen, ist eine kleine Reparatur. Die Sonderkostplanung selbst ist eine fachliche Entscheidung.

**2. Der Angebotsentwurf erfindet Leistungen und einen Preis.**
- Schritte: Testauftrag eingeben → „Entwurf aus Text erstellen“ → „Angebotstexte anzeigen“ und „Angebot exportieren“.
- **Ist:** „Aperitif und Schaumwein“ (nie angefragt), „Flying Bites Auswahl“ anstelle der angefragten Gerichte und „Gesamt: 940.00 EUR“ ohne Quelle und ohne Netto/Steuer/Brutto. In der Oberfläche heißt der Betrag „Bisheriger Arbeitsbetrag“.
- Das widerspricht der Vorgabe „keine Preise erfinden“.
- **Einordnung:** kleine Reparatur. Den vorbelegten Pakettext und -preis nicht ohne erfasste Preisaufstellung exportieren und klar als Arbeitswert ohne Beleg kennzeichnen.

**3. Die Mengenvorschau zeigt falsche Werte.**
- Schritte: Hähnchenragout auf 0.6 setzen → „Änderung prüfen“.
- **Ist:** „Hähnchenbrust roh: 7.1999994 → 7.1999994 kg“. Der Ausgangswert ist falsch (richtig wäre 6,6 → 7,2), dazu Rundungsartefakte wie „Faktor 1.090909“.
- Es gibt keinen Hinweis, dass die erteilte interne Freigabe durch die Änderung ungültig würde.
- Ich habe nicht übernommen. Was bei „Übernehmen“ in der Einkaufsliste landen würde, ist ungeprüft.
- **Einordnung:** kleine Reparatur (Ausgangswert anzeigen, auf sinnvolle Dezimalen runden, Hinweis auf die Freigabe).

## P2 – stört den Alltag spürbar

4. **Küchenzeitplan:**
   - Unter „Vortag“ steht „2026-11-12 T-1“; das Datum ist zweideutig, der Vortag wäre der 11.11.
   - Alle neun Gerichte, auch die Canapés, stehen auf dem Vortag.
   - Zeiten am Veranstaltungstag fehlen.
   - Bei „Chargen: 10“ fehlen die Mengen je Charge.
   - Es ist unklar, ob der „Verlustfaktor 1,08“ in den Mengen schon enthalten ist.
5. **Aufträge sind schwer wiederzufinden:**
   - Im Angebot heißen alle vier Einträge „Neuer Auftrag - 17.10.2026“. Das ist das UTC-Datum; lokal war es der 18.10., 01:37 Uhr.
   - Der Status steht auf Englisch („open“, „completed“).
   - Die Suche findet weder „Wissenschaft“ noch „OPUS“.
   - In der Produktion gibt es zweimal „Empfang - 12.11.2026 - 100 Personen“.
   - Der Name „Wissenschaftsabend“ taucht nirgends auf.
6. **Zeitangaben aus der Anfrage werden ignoriert:**
   - Es wird zweimal gefragt „Wie lautet das verbindliche Zeitfenster?“, obwohl die Zeiten im Text stehen. Das erzeugt auch einen React-Fehler wegen doppelter Schlüssel.
   - Beim Testauftrag (17:00–18:30) passiert dasselbe.
7. **Status- und Freigabeanzeige widersprechen sich:**
   - Im Angebot steht „Auftrag abgeschlossen“ und zugleich „Jetzt: Variante übernehmen“.
   - „Variante freigeben“ und „An Produktion übergeben“ bleiben nach der Übergabe aktiv.
   - Der unfreigegebene Testauftrag zeigt „Produktionsübergabe: 1 vollständig“, obwohl kein echter Produktionsfall entsteht (die Geschichte bleibt bei 2).
   - Der freigegebene aktive Produktionsfall ist als „Bestandsdaten im Hintergrund … Demo, Bestand oder vorheriger Lauf“ beschriftet.
8. **Navigation:**
   - „Zur Produktion“ öffnet eine leere Produktionsseite statt des Falls.
   - Nach „Zurück“ ist der gerade bearbeitete Entwurf nicht mehr aktiv.
   - Der Link „Frühere Aufträge“ (`#history`) klappt die Liste nicht auf.
   - Es gibt zwei Geschichtsblöcke mit unterschiedlichen Zahlen (3 gegenüber 0 bzw. 1).
9. **Zahlen und Einheiten nicht auf Deutsch eingestellt:**
   - In der Mengensteuerung steht „servings“ und „0.55“.
   - „0,6“ wird mit der falschen Meldung „Bitte eine positive Menge eingeben“ abgelehnt; das Preisfeld akzeptiert das Komma dagegen.
   - Im Angebotstext steht „100 guest × 58.00 EUR“, „1 flat“, „24 hour“, an anderer Stelle „1 Pauschalen“.
   - Die CSV hat englische Spaltenköpfe, Dezimalpunkt und Komma als Trenner; ein deutsches Excel liest das schlecht.
   - Die Warengruppe ist überall „misc“, und auch Salz oder Zimt sind „Metro Fresh“ zugeordnet.
10. **Quellenhinweis bei den Preisen:** Jede Preiszeile wiederholt „Küche 16h, Service 24h, Fahrt 5h in Logistikpauschale“, obwohl Küche und Service separat berechnet sind. Das liest sich wie eine Doppelberechnung; auch „historische Arbeitswerte 0.6“ versteht man nicht. Den Text kann ein Mensch im Editor korrigieren.
11. **Exporte:**
    - Der Angebotsexport ist ungestaltetes HTML ohne Datum, Eventnamen und ohne Kopf „Entwurf / synthetisch“.
    - Die Mappe beginnt mit langen technischen Kennungen und läuft bei 390 px horizontal über (474 px).
    - Es steht „Teilnehmerzahl nur näherungsweise“, obwohl die Anfrage ausdrücklich 100 nennt.
    - Bei Rezepten mit Status review_required steht „Qualität 90 % · Passung 100 %“.
12. **Oberfläche und Designsprache:**
    - Nur die Startseite wirkt ruhig im Apple-Stil; die Arbeitsflächen sind flacher und anders gestaltet.
    - Ein geöffneter Fall zeigt oben zuerst den Upload für eine neue Anfrage statt Auftragskopf und Status, auch mobil.
    - Die Produktionsseite ist rund 8.400 px (Desktop) bzw. 10.200 px (mobil) lang.
    - Fehlermeldungen stehen weit weg vom Eingabefeld; „Abbrechen“ und „Übernehmen“ sind gleich gewichtet.
    - Es tauchen technische Begriffe auf (Spec, ApprovedProductionSpec, Beta-Endpunkt).
    - Beim Öffnen jedes Auftrags erscheinen 5 Fehler (HTTP 404) in der Konsole.

## Was gut und selbst belegt ist
- **Angebotsrechnung:** fünf Zeilen, Netto 8.043,20 €, Steuer 1.528,21 €, Brutto 9.571,41 €, 80,43 € je Gast – selbst nachgerechnet. Die Personalstunden passen zur Anfrage (2×8, 4×6, 1×5).
- **Portionen:** 55/25/20, 80/20 und 100/100 stimmen durchgängig in Angebot, Plan und Mappe.
- **Einkauf:** 29 Positionen, Sammelsummen stichprobenartig korrekt. Zimt 0,002 kg steht in Rezeptkarte, Küchenblatt, Einkaufsliste und CSV.
- **Freigabegrenzen sind sichtbar:** review_required, „synthetisch“, „Kosten/Marge nicht erfasst“.
- **Preis-Editor:** fehlende Steuer führt zu „Brutto offen, Freigabe gesperrt“, die Gästezahl ist schreibgeschützt, „Verwerfen“ stellt den Stand sauber wieder her.
- **Mengensteuerung:** Vorschau vor Übernahme; „Abbrechen“ ändert nachweislich nichts.
- **Persistenz:** Der Produktionsfall ist nach Wiederöffnen vollständig da: 9 Batches, 29 Positionen, „erteilt · übernommen“.
- **Mobil:** Die App selbst läuft bei 390 px nicht horizontal über.

## Pilotentscheidung
Für einen echten Pilot fehlen außer den drei P1-Punkten weiterhin:
- echte Küchen-, Allergen-, Temperatur- und Lieferantenfreigaben,
- echte Preise und Steuer sowie Kosten und Marge,
- Ausrüstung, Stationen und Zeiten,
- der Nürnberger Nachweis zu Backup, Restore und Bereinigung.

Dieser Stack ist ausdrücklich kein Nachweis für den Nürnberger Betrieb.

Laufzeitnachweis: modelUsage canonicalModel=claude-opus-5-5, provider=firstParty; Ergebnis success, CLI exit0. Vollständiger privater Lauf im ignorierten tmp/product-pilot-20261018/opus-product-review-stream-resumed.jsonl. Kein eigenes vollständiges Opus-E2E-PASS, keine Nürnberger Betriebsabnahme.


---

## Tatsächliche gezielte Nachprüfung nach Reparatur7c67497

# P1-Nachprüfung CateringOS, Produktcommit 7c67497

**Ergebnis:** Alle drei P1-Befunde sind im Browser geschlossen, mit kleinen Rest-Hinweisen unten. Die Prüfung lief als claude-opus-5-5 in der neuen, inzwischen geschlossenen Session `catering-opus-p1-20261018` (`--browser chrome`, rund 22 Aktionen) auf dem synthetischen Stack 127.0.0.1:43200. Ich habe nichts am Code oder Datenbestand geändert und nichts gespeichert, übernommen oder freigegeben.

## P1-1 Sonderkost und Zeitplan in Produktion und Mappe: **geschlossen**
- **Produktionsfall** über die direkte Fall-URL geöffnet:
  - Der Kopf heißt jetzt „Aktueller Produktionsauftrag“ und nicht mehr „Bestandsdaten im Hintergrund“.
  - Es gibt einen Block „Auftrags- und Küchenhinweise“ mit dem Satz „keine Sonderkost-, Allergen- oder Hygienefreigabe“.
  - Er enthält „4 glutenfreie/3 Schalenfrucht-Sonderkostfälle ungeklärt“, Anlieferung 16:30, Aufbau 17:45, Empfang 18–19, Buffet 19–21 und Abbau 21.
  - Bei den Rückfragen steht „keine strukturierten Rückfragen erfasst; Auftrags- und Küchenhinweise separat prüfen“.
- **Produktionsmappe** über den Link in der Oberfläche geöffnet:
  - „Keine blockierenden Rückfragen“ kommt nicht mehr vor.
  - In Abschnitt 3 stehen dieselben Hinweise, „glutenfrei“ und „Schalenfrucht“ je zweimal.
- **Druck-PDF**, Seiten 1–2 angesehen: Die Hinweise sind vollständig sichtbar.
- **Der freigegebene Stand ist unverändert:** „erteilt · übernommen“, 29 Positionen.
- **Rest-Hinweise:**
  - Im Planbereich steht weiterhin „Offene Punkte: keine“. Das ist kein falsches Rückfrage-Versprechen mehr, kann aber missverstanden werden.
  - Ob die gespeicherte Fassung bytegleich geblieben ist, kann ich im Browser nicht prüfen.

## P1-2 Mengenvorschau: **geschlossen**
- Hähnchenragout mit deutschem Komma „0,6“ eingegeben: wird angenommen.
- Die Vorschau zeigt „Neu: 60 Portionen · Faktor 1,0909“ und „Hähnchenbrust roh: 6,6 kg → 7,2 kg“.
- Die übrigen Zutaten habe ich nachgerechnet, sie stimmen: Fond 1,375 → 1,5 l, Sahne 0,825 → 0,9 l, Zwiebel 0,825 → 0,9 kg, Rapsöl 0,165 → 0,18 l, Salz 0,0825 → 0,09 kg, Pfeffer 0,011 → 0,012 kg.
- Der Hinweis „Die neue Menge benötigt eine neue Küchenfreigabe. Der bisher freigegebene Produktionsstand bleibt bis dahin erhalten.“ wird angezeigt.
- Nach „Abbrechen“ ist die Vorschau weg; es bleibt bei „0,55 Portionen pro Person · Gesamt 55 Portionen“ und „erteilt · übernommen“.
- **Grenzen:** „Übernehmen“ habe ich nicht getestet. Kleinstmengen wie 2 g und die API-Bedeutung der Ausgangsmenge kenne ich nur aus deinen Core-Tests, nicht aus dem Browser.

## P1-3 Kein erfundenes Angebot: **geschlossen**
- Neuer Testauftrag über die normale Oberfläche angelegt: „SYNTHETISCHER OPUS-P1-TEST“, 20 Gäste am 12.11.2026, vegane Gurken-Canapés, 2 Gäste glutenfrei. Kennung `draft-request-ui-c97568b0-…`, offen, nicht freigegeben.
- **Preisaufstellung:** „Preis offen. Katalogrichtwerte sind keine geprüften Angebotspreise.“ Ein Betrag von 940 € erscheint nicht.
- **Angebotstexte:** „Kein Kundentext freigegeben … Automatische Paketvorschläge sind keine bestätigten Leistungen.“
- **Offene Punkte:** „Welche Maßnahmen und Freigaben gelten für die angefragten Sonderkostfälle?“ Eine pauschale Zusage wie „glutenfrei“ oder „frei von“ wird nicht gemacht.
- **Export:** „Angebotsentwurf · Kalkulation offen / Interne Arbeitsunterlage. Keine bestätigten Leistungen oder Angebotspreise.“ Darunter nur Datum, 20 Gäste und der offene Punkt. Kein Schaumwein, kein Paket, kein Gesamtpreis.
- **Grenzen:**
  - Die offene Frage ist allgemein formuliert und nennt die „2 Gäste glutenfrei“ nicht ausdrücklich.
  - Der Export führt das angefragte Gericht nicht auf.
  - Dass früher bereits freigegebene Fassungen weiter über den alten Exportpfad laufen, habe ich nicht geprüft.

## Was das nicht abdeckt
Die bekannten P2-Befunde habe ich nicht erneut geprüft; zum Teil sind sie hier nebenbei wieder aufgefallen, etwa „Produktionsübergabe: 1 vollständig“ beim unfreigegebenen Entwurf. Ein eigener vollständiger Durchlauf von Anfrage bis Druck ist weiter offen, daher gibt es aus dieser Nachprüfung kein Gesamt-PASS und kein Pilot-GO.

Im synthetischen Bestand liegen jetzt zwei offene Opus-Testaufträge (`58cf0ec8-…` aus der ersten Prüfung und `c97568b0-…`), die später aufgeräumt werden können.

Koordinator-Klarstellung: Die neu angelegten synthetischen20-Gäste-Fälle sind reale lokale Testdatenänderungen. „Keine Daten geändert“ im Modelltext ist dafür zu weit; erhalten blieb der freigegebene100-Gäste-Referenzauftrag. Alle13 Originalquellen,9Batches,29Positionen und2gZimt nachgeprüft unverändert. Beide OpusSessions sind beendet. Laufzeitnachweis auch Nachprüfung: canonicalModel=claude-opus-5-5,provider=firstParty,resultsuccess,CLIexit0.
