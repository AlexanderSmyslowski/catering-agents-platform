# Ist-Flow-Karte: UI-Flows fuer spaetere Conversational Workbench

Status: Ist-Flow-Karte auf Basis des Repo-Stands vom 2026-05-19
Scope: Dokumentation der vorhandenen UI-Flows `/`, `/angebot`, `/produktion`; keine UI-, API- oder Google-Drive-Implementierung

## 1. Zweck

Dieses Dokument kartiert die vorhandenen Backoffice-UI-Flows gegen Alexanders Zielbild einer ruhigen, Apple-like Conversational Workbench.

Die Karte ist bewusst vorbereitend:

- Sie beschreibt den heutigen Flow-Iststand.
- Sie benennt Produktobjekte, Klärbedarf, Export- und Audit-Bezug.
- Sie skizziert nur eine spaetere Abbildung in einer gefuehrten Conversational Workbench.
- Sie skizziert nur eine spaetere Google-Drive-Beruehrung nach der dokumentierten Rechte-Linie.

Nicht Teil dieses Schritts sind:

- kein UI-Redesign
- keine Chat-Komponente
- keine neue Conversation-Persistenz
- keine neuen API-Endpunkte
- keine Google-Drive- oder OAuth-Implementierung
- keine produktiven Google-Zugriffe oder Secrets

## 2. Fuehrende Repo-Belege

Belegt durch:

- `README.md`
- `TESTING.md`
- `docs/product/UI_CHATBOT_GOOGLE_DRIVE_ZIELBILD_DISCOVERY.md`
- `backoffice-ui/src/App.tsx`
- `backoffice-ui/src/api.ts`
- `tests/backoffice-route-smoke.test.ts`

## 3. Uebergreifende Ist-Struktur

Die Backoffice-UI hat drei Kernrouten:

- `/` als Startseite mit Agentenwahl, Systemstatus und Aenderungsprotokoll
- `/angebot` als Angebotsagent fuer Kundenanfrage, Angebotsentwurf und operative Uebergabe
- `/produktion` als Produktionsagent fuer Datei-/Texterfassung, Rueckfragen, Produktionsplanung, Rezeptbibliothek und Einkaufslisten

Uebergreifend vorhanden:

- Bearbeitername im lokalen UI-Kontext, der als `x-actor-name` fuer mutierende Aktionen mitgegeben wird
- Demo-Daten-Ladeaktion
- Aktualisieren-Aktion fuer Dashboard-/Health-Daten
- gemeinsame Dashboard-Daten aus Intake, Offer, Production, Export und Audit
- read-only Anzeige von Health-, Export- und Audit-Bezuegen

## 4. Flow-Karte `/` - Startseite / Betriebsueberblick

### Nutzer-Eingabe

- Oeffnet `/`.
- Kann Bearbeitername setzen.
- Kann Demo-Daten laden.
- Kann Dashboard-Daten aktualisieren.
- Kann in `/angebot` oder `/produktion` wechseln.

### Systemantwort

- Zeigt Agentenwahl fuer Angebotsagent und Produktionsagent.
- Zeigt operative Kennzahlen:
  - operative Spezifikationen
  - Uebergabereife an Produktion
  - Angebotsentwuerfe
  - Produktionsplaene
  - Rezeptbibliothek mit Freigabe-/Pruefstatus
- Zeigt Dienststatus fuer Erfassung, Angebot, Produktion und Export.
- Zeigt letzte Audit-/Aenderungsschritte.

### Klärbedarf / Rückfragen

- Heute keine dialogische Rueckfrage auf der Startseite.
- Die Startseite zeigt nur Status, Zaehlungen und Einstiegspunkte.
- Spaeter zu klaeren: ob die Startseite eine kurze gefuehrte Einstiegsempfehlung geben soll oder rein als ruhiger Betriebsueberblick bleibt.

### Erzeugtes oder berührtes Produktobjekt

- Kein fachliches Produktobjekt bei reinem Oeffnen.
- Bei Demo-Daten-Laden werden bestehende Seed-/Demo-Pfade beruehrt.
- Bearbeitername beeinflusst spaetere Actor-/Operator-Zuordnung mutierender Aktionen.

### Export-/Audit-Bezug

- Exportdienst-Health wird angezeigt.
- Audit-/Aenderungsprotokoll wird read-only angezeigt.
- Demo-Daten-Laden ist eine mutierende Betriebsaktion und gehoert in den bestehenden Audit-/Operator-Kontext.

### Spaetere Abbildung in einer cleanen Conversational Workbench

- Als ruhiges Start-Dashboard mit zwei klaren Arbeitsvorschlaegen:
  - Anfrage/Angebot klaeren
  - Produktion/Einkauf vorbereiten
- Kein generischer Chat; eher eine kurze gefuehrte Arbeitsauswahl mit Statuszeile und naechstem sinnvollen Schritt.
- Apple-like Leitlinie: klare Hierarchie, viel Weissraum, keine Kartenwüste, keine Neon- oder Emoji-Aesthetik.

### Spaetere Drive-Berührung nach Rechte-Linie

- Die Startseite selbst braucht voraussichtlich keinen direkten Drive-Dateizugriff.
- Moeglich waere spaeter nur eine read-only Anzeige zuletzt importierter Drive-Quellen oder freigegebener Output-Ziele.
- Kein stiller Schreibzugriff auf bestehende Drive-Dateien.
- Falls ein Drive-Zielordner fuer App-Outputs angezeigt wird, muss dieser explizit freigegeben sein.

## 5. Flow-Karte `/angebot` - Angebotsagent

### Nutzer-Eingabe

Vorhandene Eingaben:

- Freitext-Kundenanfrage normalisieren.
- PDF-, E-Mail- oder Textdatei auswaehlen und normalisieren.
- Angebotsentwurf aus Freitext erzeugen.
- Veranstaltungsdaten strukturiert direkt erfassen.
- Angebotsentwurf ansehen.
- Angebotsvariante in operative Spezifikation uebernehmen.
- Operative Spezifikation bearbeiten.
- Zur Produktionsansicht wechseln.

### Systemantwort

- Erzeugt aus Freitext oder Dokument eine operative Spezifikation.
- Erzeugt aus Freitext einen Angebotsentwurf mit Varianten und offenen Punkten.
- Zeigt Angebotsentwuerfe, Varianten, offene Punkte, kundenorientierten Text und interne Arbeitsnotizen.
- Zeigt operative Spezifikationen mit Uebergabestatus.
- Bietet Exportlink fuer Angebots-HTML.
- Bietet Uebergabe in die Produktionsansicht.

### Klärbedarf / Rückfragen

- Angebotsentwuerfe koennen offene Punkte enthalten.
- Operative Spezifikationen koennen unvollstaendig oder teilweise vollstaendig sein.
- Heute werden offene Punkte listenartig angezeigt; sie sind noch keine echte dialogische Rueckfrage-Timeline.
- Spaeter zu klaeren: welche Angebotsfragen direkt im Workbench-Verlauf beantwortet werden sollen und welche als strukturierte Felder bleiben muessen.

### Erzeugtes oder berührtes Produktobjekt

- `IntakeRequest` bei Dokument-/Texterfassung.
- `AcceptedEventSpec` als operative Spezifikation.
- `OfferDraft` mit Varianten, offenen Punkten und Angebots-/Arbeits_texten.
- Bei Promotion einer Variante wird ein operativer Datensatz fuer die Produktion beruehrt oder erzeugt.
- Bearbeitete Spezifikationen aktualisieren bestehende operative Veranstaltungsdaten.

### Export-/Audit-Bezug

- Angebotsentwuerfe koennen ueber bestehenden Exportlink als Angebots-HTML exportiert werden.
- Mutierende Aktionen laufen mit Actor-/Operator-Kontext:
  - Intake-Normalisierung
  - Dokument-Upload
  - manuelle Spezifikation
  - Angebotsentwurf-Erzeugung
  - Promotion einer Angebotsvariante
  - Spezifikationsbearbeitung
- Audit-Bezug ist im bestehenden Plattform-/Audit-Kontext verankert, wird in `/angebot` aber nicht als eigener Audit-Feed prominent gefuehrt.

### Spaetere Abbildung in einer cleanen Conversational Workbench

- Der heutige Angebotsflow kann als gefuehrte Arbeitssequenz abgebildet werden:
  1. Anfrage einbringen
  2. Verstandene Eckdaten anzeigen
  3. Rueckfragen/offene Punkte praezise stellen
  4. Angebotsvarianten als Ergebnisblock zeigen
  5. ausgewaehlte Variante kontrolliert in operative Spezifikation uebernehmen
- Die Workbench sollte Ergebnisobjekte sichtbar halten, statt sie in Chattext zu verstecken.
- Offene Punkte koennen wie Assistant-Rueckfragen erscheinen, muessen aber in `AcceptedEventSpec` / `OfferDraft` nachvollziehbar bleiben.

### Spaetere Drive-Berührung nach Rechte-Linie

- Bestehende Drive-Dateien koennten spaeter read-only als Anfragequelle ausgewaehlt/importiert werden, analog zum heutigen Datei-Upload.
- Erlaubte Quelle: bewusst vom berechtigten Nutzer ausgewaehlte Drive-Datei.
- Verbotene Aktion ohne Sonderberechtigung: bestehende Drive-Datei ueberschreiben, verschieben, loeschen oder still veraendern.
- Angebots-HTML oder Angebotsunterlagen duerften spaeter nur als app-eigene Outputs in explizit freigegebene Drive-Ziele geschrieben werden.
- Audit muss Quelle, Ziel, Nutzer, Zeitpunkt und Aktionstyp dokumentieren.

## 6. Flow-Karte `/produktion` - Produktionsagent

### Nutzer-Eingabe

Vorhandene Eingaben:

- Angebot, E-Mail oder Textdatei per Drag & Drop oder Dateiauswahl hochladen.
- Datei mit ausgewaehltem Typ erneut verarbeiten.
- Freitext direkt einfügen und normalisieren.
- Veranstaltungsdaten als Fallback direkt eingeben.
- Rueckfragen beantworten und Spezifikationsdetails ergaenzen.
- Gericht fuer Gericht Kategorie, Herstellungsart, Rezeptzuweisung, Zukaufbestandteile und Notizen erfassen.
- Berechnung starten bzw. Speichern und Berechnung starten.
- Zwischen erkannten Eingaengen wechseln.
- Produktionsplan-Details anzeigen.
- Rezeptdatei in die gemeinsame Bibliothek uebernehmen.
- Rezepte freigeben, verifizieren oder ablehnen.
- Einkaufslisten herunterladen.

### Systemantwort

- Analysiert hochgeladene oder eingegebene Daten und erzeugt operative Veranstaltungsdaten.
- Zeigt Analysefortschritt und Ergebnisstatus.
- Zeigt Rueckfragen, Annahmen und Spezifikationsdetails.
- Zeigt urspruengliche Intake-Anfrage mit Quelle, Kanal und Rohinput-Vorschau.
- Aktualisiert Spezifikation nach direkten Antworten.
- Erzeugt Produktionsplan, Rezeptauswahl, Arbeitsblaetter und Einkaufsliste.
- Zeigt Planfortschritt, Plandetails, offene Punkte und sekundäre Details wie Suchspur, Rezeptauswahl und Arbeitsblaetter.
- Zeigt Rezeptbestand mit Herkunfts-/Freigabestatus.
- Bietet Download fuer Einkaufslisten-CSV.

### Klärbedarf / Rückfragen

- Rueckfragen entstehen aus unvollstaendigen oder teilweise vollstaendigen Spezifikationen.
- Annahmen des Agenten werden sichtbar gemacht.
- Offene Punkte im Produktionsplan werden separat angezeigt.
- Heute werden Rueckfragen als Formular-/Listenbereich beantwortet, nicht als durchgehender Chatverlauf.
- Spaeter zu klaeren: welche Rueckfragen als natuerliche Workbench-Fragen erscheinen und welche weiterhin strukturierte Pflichtfelder bleiben.

### Erzeugtes oder berührtes Produktobjekt

- `IntakeRequest` bei Datei-/Textannahme.
- `AcceptedEventSpec` als operative Veranstaltungsdaten.
- Aktualisierte Spezifikationsdetails inklusive Komponentenentscheidungen.
- `ProductionPlan` mit Kitchen Sheets, Rezeptauswahl, Suchspur und offenen Punkten.
- `PurchaseList` als Einkaufslistenobjekt.
- `Recipe` in der gemeinsamen Rezeptbibliothek.
- Rezept-Review-/Freigabestatus.

### Export-/Audit-Bezug

- Produktionsblatt-HTML wird ueber bestehenden Exportlink im Plan-Kontext angeboten.
- Einkaufslisten-CSV wird ueber bestehenden Downloadlink angeboten.
- Audit-/Operator-Bezug besteht fuer mutierende Aktionen:
  - Intake-Normalisierung und Dokument-Upload
  - Spezifikationsbearbeitung
  - Produktionsplan-Erzeugung
  - Rezept-Upload
  - Rezept-Review
- Die UI zeigt in Produktionsdetails Quelle/Kanal/ReceivedAt der urspruenglichen Intake-Anfrage; dies ist ein wichtiger Anker fuer spaetere Drive-Herkunftsnachweise.

### Spaetere Abbildung in einer cleanen Conversational Workbench

- Der heutige Produktionsflow passt am ehesten zu einer gefuehrten Workbench-Sequenz:
  1. Quelle einbringen
  2. erkannte Veranstaltungsdaten bestaetigen
  3. Rueckfragen beantworten
  4. Rezept-/Herstellungsentscheidungen treffen
  5. Berechnung starten
  6. Produktionsplan, Arbeitsblaetter und Einkaufsliste als Ergebnisobjekte ausgeben
- Der Verlauf sollte ruhig und linear wirken, aber Ergebnisobjekte und Freigabestatus getrennt sichtbar halten.
- Sekundaere Details wie Suchspur und aeltere Laeufe bleiben einklappbar und stoeren nicht den Hauptfluss.

### Spaetere Drive-Berührung nach Rechte-Linie

- Bestehende Drive-Dateien koennten spaeter read-only als Angebots-/E-Mail-/Textquelle ausgewaehlt und importiert werden.
- Rezeptdateien aus Drive duerften nur read-only importiert werden, solange keine gesonderte Bearbeitungsberechtigung definiert ist.
- Produktionsplan, Arbeitsblaetter, Einkaufslisten und ggf. Rezept-Outputs duerften spaeter nur als app-eigene Outputs oder in explizit freigegebene Zielordner geschrieben werden.
- Keine bestehende Drive-Datei darf still durch eine neue Einkaufsliste, ein Produktionsblatt oder ein Rezept ersetzt werden.
- Spaeterer Audit-Mindestdatensatz: Drive-Quelle oder Ziel, internes Produktobjekt, Nutzer, Zeitpunkt, Aktionstyp und optional Hash/Version/Revision.

## 7. Kleine Ableitung fuer den naechsten Produkt-/Designschritt

Die vorhandenen Flows enthalten bereits conversational-nahe Elemente:

- Eingabe durch Freitext oder Dokument
- Systemanalyse
- Rueckfragen und Annahmen
- strukturierte Antworten
- erzeugte Ergebnisse
- Export- und Audit-Bezug

Der kleinste naechste Schritt nach dieser Ist-Karte waere weiterhin nicht Implementierung, sondern ein read-only Workbench-Mapping:

- ein Zielbild-Skelett fuer die Workbench-Zonen definieren
- je Zone nur vorhandene Produktobjekte zuordnen
- keine neuen API-Endpunkte und keine Google-Integration ableiten

## 8. Offene Entscheidungen

Vor Implementierung offen:

1. Soll die Startseite in der Workbench ein eigener conversational Einstieg sein oder nur ruhiger Betriebsueberblick bleiben?
2. Welche Rueckfragen gehoeren in einen gefuehrten Verlauf, welche bleiben strukturierte Pflichtfelder?
3. Wird eine spaetere Conversation als eigenes Produktobjekt benoetigt oder reicht eine UI-Projektion vorhandener Objekte?
4. Welche Drive-Rolle wird zuerst verfolgt: read-only Importquelle, Output-Ablage oder beides getrennt?
5. Welche OAuth-/Scope-Strategie bildet read-only Auswahl bestehender Dateien plus write fuer app-eigene Outputs sicher ab?
6. Wie werden Drive-Quelle, Ziel, Nutzer, Zeitpunkt, Aktionstyp und Version/Hash im bestehenden Audit-Kontext abgebildet?
