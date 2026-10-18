# Gezielte Weiterarbeit nach Opus — Produktionszustände /18.10.2026

Die falsche Nichtverfügbarkeit nach bestätigter Übernahme und die zweite veraltete Kartenliste sind geschlossen. Exakte Serverprojektion bleibt maßgeblich, späte Antworten nach Fallwechsel entwertet. Bereits vorhandener Plan wird als Neuberechnung behandelt, bestehende Fragen-/Quellenblockaden bleiben erhalten; „keine Berechnungshinweise“ ist keine fachliche Freigabe. Vorbereitete Rezeptplanungen zeigen ursprüngliche Mengenbegründungen/Quellrevisionen rein lesend, keine leeren Prüfbestätigungen oder übertragene Freigabe. Gezielte Code-/UI-Tests, Build, unabhängige Delta-Prüfung und normaler lokaler Apply/Reload/Reopen bestätigt; Details memory.md5.441. Dies ist eine Koordinator-Nachprüfung, kein neuer Opus-Volllauf, kein Nürnberg-/Pilot-GO. Druck-/CSV-/Planungsbefunde bleiben offen. Die folgenden Originalberichte bleiben unverändert.

# Gezielte Weiterarbeit nach Opus — 18.10.2026

Kundenkennungen sind jetzt für neue Textanfragen über Angebot und Handoff bis zur Produktionshistorie erhalten und in beiden Auftragssuchen auffindbar. Altaufträge erhalten unterscheidbare lokale Anlagezeiten, keine erfundenen Namen. Die widersprüchliche innere Auftragszählung ist als fallbezogene Entwurfsliste korrigiert. Der offene Angebotsexport zeigt wieder die angefragten Menüpositionen/Portionen und interne Prüfgrenzen, ohne erfundene Paketpreise/-leistungen. Falsch typisierte Draft-/Approval-/Handoff-Abfragen als Intake-Specs entfallen. Gezielte Tests und normale lokale Browsernachprüfung bestanden, substanzielles Delta unabhängig angenommen. Dies ist eine Koordinator-Nachprüfung, kein neuer Opus-Volllauf und keine Pilot-/Releaseabnahme. Details/Belege: memory.md 5.440. Die datierten Originalberichte bleiben unverändert.

# Aktuelle Einordnung —18.10.2026

Der neue vollständige eigenständige Opus100-Gäste-UI-Ablauf ist belegt. Sein zusätzlicher Quellen-P1 wurde anschließend eng repariert und von Opus gezielt bis in beide Drucke/Reload geschlossen. Noch kein Pilot-/Nürnberg-/Gesamtziel-GO: konkreteP2-Produktbefunde sowie Release-,Betriebs- und echteFachgates bleiben offen. Die folgenden datierten Originalberichte bleiben unverändert als Verlauf erhalten; die jüngsten zwei Abschnitte sind maßgeblich.

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


### Koordinator-Nacharbeit P2 —18.10.2026

## 5.438 — 18.10.2026: ehrlicher Übergabestatus und aktuelle Produktionswiederöffnung

Die lokale UI unterscheidet erfasste Veranstaltungsdaten, tatsächlich revisionsgebundene interne Angebotsfreigabe und erfolgte Produktionsübergabe. Datenvollständigkeit ist kein Handoff und keine Küchenfreigabe. Bereits erledigte Freigabe-/Übergabeaktionen werden nicht erneut angeboten; neue Fassungen bleiben über die vorhandene Bindung wieder freigabefähig. Der irreführende generische Spec→Produktion-Link entfällt; die vorhandene bestätigte Übergabe öffnet den Produktionsauftrag. #history öffnet die eingeklappte Auftragshistorie, Fallstatus sind deutsch.

Die tatsächliche Browsernachprüfung fand zusätzlich einen alten Handoff-Draft-Link: trotz richtigem Fall und vorhandenem Plan erschien „Entwurf nicht verfügbar“, weil der ursprüngliche Entwurf ersetzt war. inspect_handoff öffnet jetzt nach unveränderter serverseitiger Fallauflösung und Staleprüfung die bestätigte case-only URL. Deren bestehende Projektion zeigt den aktuellen Stand; neue Übergaben und explizite Reviewlinks behalten ihre Draftbindung. Kein Backend-/Freigabe-/Datenmodellwechsel.

Gezielte67 Tests/5Dateien, danach29 Tests/4Dateien (überlappend) und finaler Build/gitdiff--check PASS. Ein unabhängiger Reviewer nahm Grunddelta und gezieltes Wiederöffnungsdelta ohne materielle Befunde an. Browser: unfreigegebener20-Gäste-Testfall wahrheitsgemäß ohne Handoff; ursprünglicher100-Gäste-Fall über den echten Angebotsbutton mit korrekter ProductionCase-ID geöffnet, kein veralteter Draftquery, keine falsche Nichtverfügbarkeitswarnung, vorhandener Plan/Einkauf und Sonderkostnotizen sichtbar. Alle13 Originalquellen bytegleich. Belege tmp/product-pilot-20261018/handoff-state-*.log/txt und handoff-reopen-targeted.log.

VollständigerCI39080927362 auf vorigemHead1ea955e läuft regulär weiter; Browser/Compose/macOS PASS, Gesamtstatus noch offen. Nicht abbrechen oder als bestanden ausgeben. Für dieses neue UI-/Navigationsdelta ist die automatische CI am neuen Head separat maßgeblich. Kein Nürnberger Deployment oder Pilot-GO; tatsächlicher vollständiger eigener Opus-End-to-End-Ablauf, reale Fachentscheidungen und Nürnberger Backup→Restore→Cleanup/Monitoring bleiben offen. Nächster Produktpunkt: unterscheidbare Auftragsnamen/Suche, anschließend verbleibende konkret belegte P2-UX-Befunde. Gesamtziel ACTIVE.

Keine zusätzliche Opus-Endabnahme aus dieser Koordinator-/Code-Reviewnachprüfung ableiten.

---

## Tatsächlicher vollständiger Opus-UI-Lauf —18.10.2026, Produkt51ca799

# Bericht: synthetischer E2E-Lauf mit 100 Gästen (Opus 5.5)

**Ergebnis:** Der rein synthetische Ablauf von der Anfrage bis zum Druck lief einmal vollständig über die normale Oberfläche durch, ohne technische Blockade. Mengen und Preise stimmen. Beim Druck gehen aber Informationen verloren: die 4 glutenfreien Fälle und der Detailzeitplan (siehe P1). Für eine reale Küche reicht das so nicht.

**Modell:** `claude-opus-5-5`. Lokaler synthetischer Stack `http://127.0.0.1:43200`, Commit 51ca799, Session `catering-opus-e2e-20261018`. Lauf von 02:10 bis etwa 02:23, rund 13 Minuten. Dies ist kein Nürnberg-Nachweis.

## Was ich bedient und geschrieben habe
Alles lief über die normale Oberfläche. Ich habe keinen eigenen Fetch, keinen API-Aufruf und keine Datei- oder Store-Schreibwege genutzt, keine Rezepte neu importiert und nichts in der Bibliothek freigegeben. Ich habe `run-code` nur benutzt, um UI-Felder zu füllen, Buttons zu klicken, DOM-Texte zu lesen und PDF oder Download zu speichern.

1. **Angebotsagent, Anfrage:** Text aus `full-reference-request.txt`, Kundenkennung geändert auf „SYNTHETISCHER OPUS E2E100 TEST – Testkunde OPUS-E2E100-20261018“. Daraus ein Entwurf (`draft-request-ui-e6bc48db-…`). Die Portionen 100/100/55/25/20/100/100/80/20 wurden korrekt übernommen; der Menüeditor war nicht nötig.
2. **Preisaufstellung:** Variante „Mitte Arbeitsband“, alle Zeilen als „Synthetische Testannahme“ mit 19 % Teststeuer:
   - Speisen 100 × 58 €
   - Lieferung 150 € einschließlich 5 Fahrerstunden
   - Aufbau 120 €
   - Service 24 × 45,55 €
   - Küche 16 × 55 €

   Gespeichert als `draft-pricing-6fe2aa6f…`.
3. **Angebot wiedergeöffnet:** Reload, dann „Frühere Angebotsaufträge“ → Auftrag vom 18.10. Die Werte waren unverändert: **8.043,20 € netto / 1.528,21 € Steuer / 9.571,41 € brutto** (80,43 € netto je Gast), gekennzeichnet „synthetisch – keine Unternehmenspreise“.
4. **Freigabe und Übergabe:** Variante intern freigegeben und an die Produktion übergeben. Das ergab den Fall **`production-case-handoff-a3bd2077…`**, Spec `spec-request-ui-e6bc48db-1595-4df1-8d98-22672739f183`.
5. **Rückfragen im Produktionsagenten:**
   - 14 von 15 Rückfragen strukturiert beantwortet: Zeitfenster 16:30–21:00, Herstellungsart Eigenproduktion. Die Kategorien Hähnchen klassisch, Rosmarinkartoffeln vegan, Ofengemüse vegan und Quarkcreme vegetarisch stammen aus den Rezeptquellen.
   - Die 9 vorhandenen Rezepte habe ich über „Rezept gezielt aus Bibliothek zuweisen“ ausgewählt.
   - Die Sonderkost-Rückfrage habe ich **bewusst offen gelassen**.
6. **Rezeptplanung:** Für alle 9 Gerichte Rolle, Mengenbegründung mit der wörtlichen Kontextnotiz, Herkunft „synthetic-model-human-confirmation-20261017“ und die 4 Prüf-Checkboxen gesetzt. Jeweils bestätigt mit „Planungs-Evidenz kanonisch gespeichert · Revision 2“.
7. **Entwurf und Übernahme:** „Entwurf vorbereiten“ ergab `production-draft-prepared-5a50b4b1…`, Revision 3, mit 13 Prüfkarten. Ich habe den eingefrorenen Inhalt gelesen und alle 13 als Testannahme mit „Passt“ entschieden, dann „Entwurf freigeben“ und „Entwurf übernehmen“ geklickt. Ergebnis: „Interne Produktionsfreigabe: erteilt · übernommen“, ApprovedProductionSpec `approved-production-spec-f40e7492…`.
8. **Exporte über die Oberfläche geöffnet:**
   - Produktionsmappe: als A4-PDF gedruckt, 18 Seiten.
   - Produktionsblatt: als A4-PDF gedruckt.
   - CSV-Einkaufsliste: heruntergeladen.
9. **Reopen Produktion:** neu auf `/produktion` navigiert, „Frühere Produktionsaufträge“ geöffnet, ersten Eintrag gewählt. Es war der richtige Fall (Exportlinks e6bc48db, Plan vollständig, 29 Positionen, Freigabe erteilt).

## Mengen
Ich habe die Mengen zuerst selbst aus den 9 TXT-Rezepten nachgerechnet und erst danach mit `full-reference-independent-arithmetic.json` gegengeprüft. Alles passt:

- **9 Batches, 49 Zutatenbeiträge, 29 konsolidierte Einkaufspositionen.** Die 49 Zeilen im „Zutatenabgleich“ der Mappe sind alle „gedeckt“.
- Portionen 55/25/20 sind über Angebot, Spec, Plan und Druck hinweg erhalten.
- Ausgewählte Summen: Zimt **0,002 kg = 2 g**, Salz 0,5 kg, Olivenöl 1,11 l, Karotte 7,8 kg, Zucchini 7,25 kg, Sahne 2,425 l, Kartoffeln roh 20 kg, Hähnchenbrust 6,6 kg, Zwiebel 1,025 kg.
- Menü, Angebot, Produktion, Einkaufsliste und CSV sind untereinander konsistent.

## Befunde

**P1: Sonderkost und Zeitplan gehen auf dem Weg in den Druck verloren**
- **Schritte:** Anfrage enthält „4 Gäste glutenfreie Sonderkost, 3 Gäste Schalenfruchtvermeidung“ und den Ablauf 16:30 / 17:45 / 18–19 / 19–21 / 21:00 → übergeben → Produktion.
- **Beobachtet:** Die Auftrags- und Küchenhinweise in der UI, in der Produktionsmappe und im Produktionsblatt nennen nur „3 Gäste Schalenfruchtvermeidung“. **„glutenfrei“ fehlt überall.** Der Zeitplan schrumpft auf „Service: 16:30–21:00“. Anlieferung, Aufbau, Empfang, Buffet und Abbau stehen nirgends.
- **Kontextnotiz:** Die gespeicherte Kontextnotiz (in den Mengenbegründungen) taucht weder in einem Druck noch nach dem Reopen auf.
- **Folge:** Die offene Rückfrage zur Sonderkost bleibt zwar sichtbar, aber nur allgemein formuliert. In der Druckfassung für die Küche wird ein sicherheitsrelevanter Sonderkostfall stillschweigend unvollständig.

**P2**
1. **Verlustfaktor im Druck:** Die Produktionsmappe zeigt je Gericht „Verlustfaktor 1,08“. Angewendet wird er nicht (Mengen exakt ×10, und die UI sagt ausdrücklich „keine automatischen Zuschläge“). Das führt in die Irre.
2. **Allergen-Vorbehalt fällt weg:** Der Druck schreibt „Allergene: Keine ausgewiesenen Allergene“, etwa bei Bratlingen, Linsen und Gurken-Canapés. Der Quellvorbehalt „keine Allergenfreiheit zugesichert / Kreuzkontakt ungeprüft“ fehlt. Es bleibt nur die allgemeine Fußzeile.
3. **Auftragsliste nicht unterscheidbar:**
   - Produktion: drei identische Einträge „Empfang - 12.11.2026 - 100 Personen“.
   - Angebot: mehrere Einträge „Neuer Auftrag - 17.10.2026“; nur der neue Auftrag vom 18.10. war am Datum erkennbar.
   - Keine Kunden- oder Testkennung, keine Uhrzeit. Ich habe den neuen Fall nur indirekt über Datum bzw. Exportlink erkannt. Das Risiko, versehentlich den Originalfall zu bearbeiten, ist real.
4. **„OPUS E2E100“-Kennung kommt nicht an:** Sie erscheint in keinem Produktionsartefakt. Die Herkunft lautet „Intake-Anfrage ohne Kennung“, und der Veranstaltungstyp wird nur als „Empfang“ statt Empfang plus Buffet bzw. Wissenschaftsabend geführt. Die Zusammenfassung heißt „Flying Buffet Premium“.
5. **Veraltete und widersprüchliche Zustände nach der Übernahme:**
   - Gleichzeitig „Produktionsentwurf übernommen.“ und „Der angeforderte Produktionsentwurf ist nicht verfügbar“.
   - Ein zweiter Block „Produktionsentwürfe prüfen“ zeigt weiterhin 13 Karten als „offen“.
   - „Berechnung starten“ ist deaktiviert und es heißt „Rückfragen beantworten, bevor Mengen … berechnet werden“, obwohl Plan und Einkauf schon existieren.
   - Der Plan meldet „Offene Punkte: keine“, obwohl die Sonderkost-Rückfrage offen ist.
6. **Planungsnachweis nach Reopen unsichtbar:** Unter Mengensteuerung steht je Gericht „Noch keine belastbare Mengenempfehlung – Küchenentscheidung erforderlich“, obwohl ich die Planungsnachweise gespeichert hatte. Der Abschnitt mit den Rezeptplanungen ist nach dem Reopen nicht mehr sichtbar.
7. **Produktionsblatt-Druck kaum nutzbar:** ohne Styling, ohne Seitenränder, leerer HTML-Titel, kein Kopf mit Datum und Personenzahl.
   - Die Produktionsmappe dagegen ist ordentlich, aber jede Rezeptkarte belegt eine ganze, fast leere Seite.
   - Rezeptschritte erscheinen in der UI doppelt (nummeriert und unnummeriert).
8. **Fachliche Darstellung im Plan:** Station „hot-kitchen“ auch für kalte Canapés und Quarkcreme; alle Gerichte „T-1“; Warengruppe überall „misc“; „Metro Fresh“ auch für Salz und Öl.
9. **CSV fürs Büro schwer nutzbar:** Komma als Trenner, Dezimalpunkt, englische Spaltenköpfe. In deutschem Excel ist das problematisch, und Zimt steht nur als „0.002 kg“, nicht als Gramm.
10. **Angebotsentwurf:** Die Frage „Wie lautet das verbindliche Zeitfenster?“ erscheint doppelt (in der Konsole als doppelter React-Key gemeldet), obwohl die Zeiten in der Anfrage standen. Dazu kommen 404-Fehler in der Konsole auf `/api/intake/v1/intake/specs/draft-…` und der Zähler „6 Aufträge“ oben gegenüber „0 Aufträge“ im Inhaltsbereich.
11. **Begriff „approved_import“:** Die Rezeptkarten zeigen „Herkunft: approved_import“ neben „review_required“. Das ist missverständlich.

**HOLD:** Kein neuer unbestätigter Fachwert nötig. Ich habe ausschließlich die bestätigten Werte der 9 Rezepte und der Anfrage verwendet. Herstellungsart und Kategorien kommen aus den Rezeptquellen.

## Grenzen
- Alle Testdaten bleiben erhalten; ich behaupte keinen Cleanup. Den Originalfall habe ich nicht verändert.
- Bibliotheksrezepte bleiben `review_required`.
- Sonderkost, Lieferanten und Temperaturführung bleiben für eine reale Küche offen.
- Das ist keine Pilot-, Gesamt-, Nürnberg-, Backup-/Restore- oder Küchenfreigabe und keine reale Preis-, Steuer- oder Margenfreigabe.

## Erstellte Dateien
Im Ordner `output/playwright/`:
- `opus-e2e100-produktionsmappe-a4.pdf`
- `opus-e2e100-produktionsblatt-a4.pdf`
- `opus-e2e100-einkaufsliste.csv`
- `opus-e2e100-reopened.png`
- `opus-e2e-after-approve.yml`
- `opus-e2e100-produktionsmappe.pdf` (erster Druck im Letter-Format, nicht maßgeblich)

Meine Browser-Session ist geschlossen.

---

## Gezielte Nachprüfung des neuen Quellen-P1 —18.10.2026

# Nachprüfung P1-Quellenverlust (Opus 5.5)

**Ergebnis:** Der P1-Befund ist für diesen synthetischen Testfall **geschlossen**. Beide Sonderkostgruppen und alle 5 Zeit-/Logistikangaben kommen jetzt in der Produktions-UI, in beiden Drucken und nach Reload an, jeweils als ungeprüft markiert. Es bleibt ein neuer kleiner P2: Ein Satz wird falsch aufgeteilt.

**Rahmen:** Stack `127.0.0.1:43200` mit dem Fix-Delta, Session `catering-opus-source-p1-20261018`, 02:26–02:30 (rund 4 Minuten). Bedient habe ich nur die normale Oberfläche. Der Originalfall mit 100 Gästen und andere Sessions blieben unberührt. Das ist keine Pilot-, Nürnberg- oder Küchenfreigabe.

## Ablauf (ein neuer Testfall)
1. **Anfrage:** Den vorgegebenen Text mit normalen Leerzeichen eingegeben und den Entwurf erstellt. Ergebnis: 1 Gericht, „Vegane Gurken-Canapés · 20 Portionen“, ohne zusätzliche Gerichte.
2. **Preis:** Eine Zeile Speisen 20 × 58 € mit 19 % Teststeuer und Quelle „Synthetische Testannahme“. Ergebnis 1.160,00 € netto, 220,40 € Steuer, 1.380,40 € brutto.
3. **Freigabe und Übergabe:** Variante „Ausgewogen“ intern freigegeben und an die Produktion übergeben. Der neue Fall ist **`production-case-handoff-fd1688584b03…`**, Spec `spec-request-ui-e9dd16d2-d044-496b-ad47-d840bb4821f5`.
4. **Rezept und Planung:**
   - Herstellungsart Eigenproduktion; das vorhandene Rezept „SYNTHETISCH NUERNBERG TEST – Vegane Gurken-Canapés“ (`…-2cb80c82d9`) über die Auswahl zugewiesen.
   - Rolle fingerfood, Mengenbegründung nur „20 Portionen laut synthetischer Anfrage“, Herkunft wie im Lauf mit 100 Gästen, alle 4 Checkboxen gesetzt.
   - Gespeichert mit „Planungs-Evidenz kanonisch gespeichert · Revision 2“.
   - Zeitfenster und Sonderkost habe ich **bewusst offen gelassen**. Es gab keinen Rezeptimport und keine Bibliotheksfreigabe.
5. **Entwurf bis Übernahme:**
   - Entwurf vorbereitet: `production-draft-prepared-0f96c3b7…`, Revision 3.
   - 5 von 5 Prüfkarten als Testannahme mit „Passt“ entschieden.
   - Entwurf freigegeben und übernommen. Danach: „Interne Produktionsfreigabe: erteilt · übernommen“, 1 Liste mit 5 Positionen.
6. **Drucke:** Produktionsmappe und Produktionsblatt über die UI-Links geöffnet und als A4-PDF gespeichert. Ich habe die PDFs selbst angesehen.
7. **Reload:** Neu auf `/produktion` navigiert und über „Frühere Produktionsaufträge“ den Eintrag mit 20 Personen geöffnet. Die Exportlinks gehören zur richtigen Spec (`e9dd16d2`), die Hinweise sind unverändert.

## Befunde

| Kriterium | Status | Beleg |
|---|---|---|
| „4 Gäste benötigen glutenfreie Sonderkost“ | **geschlossen** | In UI, Produktionsmappe, Produktionsblatt und nach Reload jeweils als „Sonderkost angefragt; separat klären: …“ |
| „3 Gäste Schalenfruchtvermeidung“ | **geschlossen** | An allen vier Stellen vorhanden |
| 5 Zeit-/Logistikangaben (Empfang 18:00–19:00, Abendbuffet 19:00–21:00, Anlieferung 16:30, Aufbau 17:45, Abbau 21:00) | **geschlossen** | Alle als „Zeit-/Logistikangabe aus Anfrage (ungeprüft): …“ in UI, beiden Drucken und nach Reload |
| Bleibt ungeprüft, Freigabe offen | **geschlossen** | Hinweis „Keine Sonderkost-, Allergen- oder Hygienefreigabe“ steht da. Rückfragen zu Zeitfenster und Sonderkost bleiben offen, auch im Druck unter „3. Rückfragen“. Die Eventkarte zeigt „Zeitfenster nicht verfügbar“, es wird also nichts automatisch bestätigt. |
| Keine globale Glutenfrei-Zusage | **geschlossen** | „glutenfrei“ kommt in UI und Drucken nur in den beiden Hinweiszeilen vor (2 Treffer im UI-Text). Kein Tag und keine Allergenaussage am Gericht. |
| Kontext bleibt nach Reload erhalten | **geschlossen** | Wiedergeöffneter Fall zeigt dieselben 7 Hinweiszeilen |

## Neuer P2 aus dem Fix (offen)
Die Segmentierung schneidet an der falschen Stelle. Aus „…Abbau 21:00. 4 Gäste benötigen glutenfreie Sonderkost, …“ werden zwei Zeilen:
- „Zeit-/Logistikangabe … (ungeprüft): **Abbau 21:00. 4 Gäste benötigen glutenfreie Sonderkost**“
- „Sonderkost angefragt; separat klären: **Abbau 21:00.** 4 Gäste benötigen glutenfreie Sonderkost“

Inhaltlich fehlt nichts, aber die Satzgrenze nach „21:00.“ wird nicht erkannt. Dadurch steht die Sonderkost doppelt und mit fremdem Text davor. Bei „Abendbuffet 19:00–21:00.“ bleibt außerdem der Schlusspunkt stehen. Der Fehler ist in UI und beiden Drucken gleich.

## Ältere P2, nur zum Verweis
Unverändert gesehen habe ich diese P2 aus dem ersten Bericht:
- „Verlustfaktor 1,08“ wird angezeigt, aber nicht angewendet.
- „Wie lautet das verbindliche Zeitfenster?“ steht doppelt, auch im Druck.
- Das Produktionsblatt ist ungestylt.
- Station „hot-kitchen“ auch für kalte Gerichte.
- Die Mengenbegründung erscheint nicht als Produktionsnotiz. Das hast du bereits als P2 zur Nachverfolgbarkeit eingeordnet.

## Grenzen
- Geprüft habe ich nur diesen einen kleinen Testfall, den Lauf mit 100 Gästen habe ich nicht wiederholt.
- Die Testdaten bleiben erhalten; ich behaupte keinen Cleanup.
- Die PDFs liegen in `output/playwright/`: `source-p1-produktionsmappe-a4.pdf` und `source-p1-produktionsblatt-a4.pdf`.
- Meine Session ist geschlossen.
