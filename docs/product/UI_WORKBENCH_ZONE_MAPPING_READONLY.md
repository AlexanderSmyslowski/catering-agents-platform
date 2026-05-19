# Read-only Workbench-Mapping: UI-Zonen fuer Conversational Workbench

Status: Mapping-Dokument auf Basis des Repo-Iststands vom 2026-05-19
Scope: Produkt-/UI-Mapping vorhandener Objekte und Flows; keine UI-, API-, OAuth- oder Google-Drive-Implementierung

## 1. Zweck

Dieses Dokument definiert die Zonen einer spaeteren cleanen, Apple-like Conversational Workbench ausschliesslich als Mapping auf vorhandene Produktobjekte und bestehende Flows.

Es baut auf folgenden Dokumenten auf:

- `memory.md`
- `HANDOFF_PROMPT.md`
- `README.md`
- `TESTING.md`
- `docs/product/UI_CHATBOT_GOOGLE_DRIVE_ZIELBILD_DISCOVERY.md`
- `docs/product/UI_IST_FLOW_KARTE_CONVERSATIONAL_WORKBENCH.md`

Die Workbench ist hier keine neue Produktflaeche, sondern ein Ordnungsmodell fuer spaetere UI-Arbeit. Sie beschreibt, welche heute vorhandenen Eingaben, Klaerungen, Ergebnisobjekte, Exporte und Audit-Bezuege spaeter sichtbar getrennt bleiben muessen.

## 2. Leitplanken

### 2.1 Design-/Produktleitplanken

- Apple-like: ruhig, klare Hierarchie, viel Weissraum, hohe Lesbarkeit.
- Keine Neon-/AI-Purple-/Emoji-UI.
- Conversational Workbench bedeutet gefuehrte Arbeitsschritte, nicht freier Chat als Datenablage.
- Ergebnisobjekte bleiben sichtbar, pruefbar und getrennt vom Verlauf.
- Chatartige Formulierungen duerfen nur erklaeren, nicht die fuehrende Wahrheit ersetzen.

### 2.2 Technische Grenzen dieses Schritts

Nicht Teil dieses Dokuments und nicht umgesetzt:

- kein UI-Redesign
- keine neue Chat-Komponente
- keine neue Conversation-Persistenz
- keine neuen API-Endpunkte
- keine Google-Drive- oder OAuth-Implementierung
- keine produktiven Google-Zugriffe
- keine Secrets
- keine Aenderung an bestehenden Upload-, Export-, Rollen- oder Audit-Pfaden

## 3. Zonenmodell

Die spaetere Workbench kann als ruhige Arbeitsflaeche mit sechs logisch getrennten Zonen gedacht werden. Jede Zone ist hier nur ein Mapping auf vorhandene Produktobjekte und Flows.

### 3.1 Quellen-/Eingabezone

Zweck:

- Nutzer bringt Kundenanfrage, Datei, E-Mail-/Textinhalt, Angebotsdaten oder Produktionskontext ein.
- Die Zone ist der Startpunkt fuer bestehende Intake-, Angebots- und Produktionspfade.

Heute vorhandene Flow-Bezuege:

- `/angebot`: Freitext-Kundenanfrage, PDF-/E-Mail-/Textdatei, strukturierte Veranstaltungsdaten, Angebotsentwurf aus Freitext.
- `/produktion`: Drag-&-Drop oder Dateiauswahl, Freitext, Fallback-Veranstaltungsdaten, erneute Verarbeitung mit Dateityp.
- `/`: Einstieg und Arbeitswahl, aber keine fachliche Quelle.

Zugeordnete vorhandene Produktobjekte:

- `AcceptedEventSpec`: entsteht aus normalisierten Anfragen, Dokumenten oder manueller Eingabe.
- `OfferDraft`: entsteht aus Angebotsfreitext und Angebotskontext.
- `Recipe`: entsteht oder wird beruehrt bei Rezeptdatei-Uploads bzw. Rezeptimporten.
- Audit-/Aenderungsspur: dokumentiert mutierende Aufnahme-, Upload-, Import- und Bearbeitungsschritte im bestehenden Operator-Kontext.

Was sichtbar bleiben muss:

- Quelle und Kanal der Eingabe.
- Rohinput-Vorschau oder belastbarer Herkunftsverweis, soweit heute vorhanden.
- Bearbeiter-/Operator-Kontext fuer mutierende Aktionen.
- Ob die Quelle Freitext, Upload, strukturierte Eingabe oder spaeter eine read-only Drive-Quelle war.

### 3.2 Verstandene-Daten-/Spec-Zone

Zweck:

- Die App zeigt ruhig und strukturiert, was aus der Quelle verstanden wurde.
- Die Zone macht aus Eingaben pruefbare Veranstaltungs- und Angebotsdaten, statt sie im Verlauf zu verstecken.

Heute vorhandene Flow-Bezuege:

- `/angebot`: operative Spezifikationen, unvollstaendige oder teilweise vollstaendige Spezifikationen, Angebotsvarianten, Promotion in operative Spezifikation.
- `/produktion`: erkannte Veranstaltungsdaten, Spezifikationsdetails, Komponentenentscheidungen, Rueckfragenantworten.

Zugeordnete vorhandene Produktobjekte:

- `AcceptedEventSpec`: fuehrendes Objekt fuer verstandene operative Veranstaltungsdaten.
- `OfferDraft`: Angebotsvarianten, offene Punkte, kundenorientierter Text und interne Arbeitsnotizen.
- Audit-/Aenderungsspur: dokumentiert Spezifikationserzeugung, Bearbeitung und Promotion.

Was sichtbar bleiben muss:

- Event-Datum, Personenanzahl, Ort, Zeitfenster, Menue-/Komponentenstruktur und sonstige operative Eckdaten, soweit im vorhandenen Objekt enthalten.
- Status der Spezifikation: vollstaendig, unvollstaendig, teilweise vollstaendig oder uebergabereif, soweit heute abgebildet.
- Angebotsvarianten und offene Punkte als strukturierte Teile des `OfferDraft`.
- Promotion oder Bearbeitung als nachvollziehbarer Schritt, nicht als unsichtbarer Chatzustand.

### 3.3 Rueckfragen-/Klaerzone

Zweck:

- Offene Punkte und Rueckfragen werden gefuehrt, aber nicht als beliebiger Chatverlauf zur Datenquelle.
- Antworten muessen in vorhandene Produktobjekte zurueckfuehren.

Heute vorhandene Flow-Bezuege:

- `/angebot`: offene Punkte in Angebotsentwuerfen und unvollstaendige operative Spezifikationen.
- `/produktion`: Rueckfragen aus unvollstaendigen Spezifikationen, Annahmen, Spezifikationsdetails und Gericht-fuer-Gericht-Entscheidungen.

Zugeordnete vorhandene Produktobjekte:

- `AcceptedEventSpec`: Zielobjekt fuer geklaerte Veranstaltungsdaten und Spezifikationsdetails.
- `OfferDraft`: offene Angebotsfragen und Angebotsvarianten.
- `ProductionPlan`: offene Punkte, Annahmen, Suchspur und Planhinweise.
- `Recipe`: Klaerungen zu Rezeptzuweisung, Freigabe, Verifizierung oder Ablehnung.
- Audit-/Aenderungsspur: dokumentiert mutierende Klaerungs-, Review- und Bearbeitungsschritte.

Was sichtbar bleiben muss:

- Welche Frage offen ist.
- Welche Antwort gegeben wurde.
- Welches Produktobjekt dadurch geaendert oder bestaetigt wurde.
- Ob eine Annahme nur Vorschlag, Nutzerantwort, Review-Entscheidung oder operative Festlegung ist.

### 3.4 Ergebnisobjekt-Zone

Zweck:

- Ergebnisobjekte bleiben als eigene, pruefbare Karten oder Detailbereiche sichtbar.
- Die Workbench darf Ergebnisse nicht nur als Assistant-Text ausgeben.

Heute vorhandene Flow-Bezuege:

- `/angebot`: Angebotsentwuerfe, Varianten, operative Spezifikationen, Angebots-HTML-Exportlink.
- `/produktion`: Produktionsplaene, Kitchen Sheets, Rezeptauswahl, Arbeitsblaetter, Einkaufslisten, Produktionsplan-Details.
- `/`: Kennzahlen und Einstiegspunkte zu Angebots- und Produktionsobjekten.

Zugeordnete vorhandene Produktobjekte:

- `AcceptedEventSpec`: operative Veranstaltungsgrundlage.
- `OfferDraft`: Angebotsentwurf mit Varianten und Texten.
- `ProductionPlan`: Produktionsplan mit Planfortschritt, Details, Kitchen Sheets, Suchspur und offenen Punkten.
- `PurchaseList`: Einkaufsliste als aus dem Produktionsplan abgeleitetes Ergebnisobjekt.
- `Recipe`: Rezeptbibliothek, Rezeptauswahl, Herkunfts- und Freigabestatus.
- Audit-/Aenderungsspur: belegt Entstehung, Review und relevante Aenderungen.

Was sichtbar bleiben muss:

- Ergebnisstatus, offene Punkte und blockierende Gruende.
- Inhaltliche Detailansichten fuer Angebotsentwurf und Produktionsplan.
- Rezeptauswahl, Freigabestatus und Such-/Verwerfungsgruende, soweit heute vorhanden.
- Einkaufsliste als eigenes abgeleitetes Objekt, nicht als Chattext.

### 3.5 Export-/Drive-Output-Zone

Zweck:

- Bestehende Exporte werden ruhig und eindeutig als Outputs angezeigt.
- Spaetere Drive-Outputs werden nur entlang der dokumentierten Rechte-Linie gedacht.

Heute vorhandene Flow-Bezuege:

- `/angebot`: Angebots-HTML ueber bestehenden Exportlink.
- `/produktion`: Produktionsblatt-HTML und Einkaufslisten-CSV ueber bestehende Export-/Downloadlinks.
- `/`: Exportdienst-Health und Betriebsueberblick.

Zugeordnete vorhandene Produktobjekte:

- `OfferDraft`: Quelle fuer Angebots-HTML.
- `ProductionPlan`: Quelle fuer Produktionsblatt/Arbeitsunterlagen.
- `PurchaseList`: Quelle fuer Einkaufslisten-CSV.
- `Recipe`: moeglicher spaeterer Output-/Nachweisbezug, aber heute kein Drive-Output.
- Audit-/Aenderungsspur: muss spaeter Quelle, Ziel, Nutzer, Zeitpunkt und Aktionstyp fuer Drive-Importe/-Outputs belegen.

Drive-Rechte-Linie:

- Bestehende Drive-Dateien sind read-only Importquellen.
- Die App darf bestehende Drive-Dateien nicht still ueberschreiben, aendern, umbenennen, verschieben oder loeschen.
- Schreiben ist nur fuer app-eigene Outputs oder explizit freigegebene Zielartefakte/Zielordner vorgesehen.
- App-Outputs duerfen bestehende Drive-Dateien nicht still ersetzen.
- Bei spaeteren Namenskonflikten braucht es ein neues Artefakt, explizite Versionierung oder eine bewusste Nutzerentscheidung.

Was sichtbar bleiben muss:

- Ob ein Output nur lokaler/HTTP-Export oder spaeter Drive-Output ist.
- Welches Produktobjekt den Output erzeugt hat.
- Ziel, Zeitpunkt und ausloesender Operator.
- Bei Drive: explizit freigegebenes Ziel und kein implizites Schreiben in bestehende Dateien.

### 3.6 Audit-/Herkunft-/Freigabe-Zone

Zweck:

- Herkunft, Operator, Review- und Freigabestatus bleiben sichtbar und pruefbar.
- Die Zone trennt Nachvollziehbarkeit von Ergebnisinhalt und Chat-Erklaerung.

Heute vorhandene Flow-Bezuege:

- `/`: letzte Audit-/Aenderungsschritte und Dienststatus.
- `/angebot`: mutierende Intake-, Angebots-, Promotion- und Spezifikationsbearbeitungsschritte mit Actor-/Operator-Kontext.
- `/produktion`: mutierende Intake-, Spezifikations-, Produktionsplan-, Rezept-Upload- und Rezept-Review-Schritte mit Operator-Bezug.
- Produktionsdetails zeigen Quelle, Kanal und ReceivedAt der urspruenglichen Intake-Anfrage.

Zugeordnete vorhandene Produktobjekte:

- `AcceptedEventSpec`: Herkunft, Bearbeitung, Finalisierung/Promotion und operative Uebergabe.
- `OfferDraft`: Angebotsentstehung, Varianten, offene Punkte und moegliche Uebernahme.
- `ProductionPlan`: Planerzeugung, offene Punkte, Suchspur und Ergebnisstatus.
- `PurchaseList`: Ableitung aus dem Produktionsplan und Exportbezug.
- `Recipe`: Herkunft, Upload, Review-Status `approved_internal`, `review_required` oder `rejected` sowie Verifizierung/Ablehnung.
- Audit-/Aenderungsspur: bestehender gemeinsamer Nachweis fuer Operator-Aktionen.

Was sichtbar bleiben muss:

- Quelle/Herkunft der Eingabe oder Datei.
- Operator bzw. ausloesender Nutzer.
- Zeitpunkt.
- Aktionstyp.
- Review-/Freigabestatus, insbesondere bei Rezepten und operativen Uebergaben.
- Bei spaeterem Drive-Bezug: Drive-Quelle oder -Ziel, internes Produktobjekt und optional Hash/Version/Revision.

## 4. Was nicht in generischem Chattext verschwinden darf

Folgende Inhalte duerfen in einer spaeteren Workbench nicht nur als freie Assistant-Nachricht existieren:

- `AcceptedEventSpec` mit operativen Veranstaltungsdaten, Vollstaendigkeitsstatus und Uebergabebezug.
- `OfferDraft` mit Varianten, offenen Punkten, kundenorientiertem Text und internen Arbeitsnotizen.
- `ProductionPlan` mit Planstatus, Gerichten, Kitchen Sheets, Rezeptauswahl, Suchspur und offenen Punkten.
- `PurchaseList` als einkaufsrelevantes Ergebnisobjekt und Exportgrundlage.
- `Recipe` inklusive Herkunft, Freigabe-/Review-Status und Verwendbarkeit.
- Audit-/Aenderungsspur mit Quelle, Operator, Zeitpunkt und Aktionstyp.
- Exportlinks, Downloadziele und spaetere Drive-Ziele.
- Rueckfragenantworten, wenn sie Spezifikationen, Angebotsvarianten, Produktionsentscheidungen oder Rezeptstatus aendern.
- Annahmen, wenn sie operative Planung, Einkauf oder Rezeptauswahl beeinflussen.
- Freigabe- und Review-Entscheidungen.

Chattext darf diese Objekte erklaeren oder durch den naechsten Schritt fuehren. Fuehrende Wahrheit bleiben die strukturierten Produktobjekte und vorhandenen Audit-/Review-Spuren.

## 5. Mapping-Tabelle

| Workbench-Zone | Bestehende Flows | Zugeordnete Produktobjekte | Read-only Mapping-Regel |
| --- | --- | --- | --- |
| Quellen-/Eingabezone | `/angebot`, `/produktion` | `AcceptedEventSpec`, `OfferDraft`, `Recipe`, Audit-/Aenderungsspur | Quelle/Kanal sichtbar halten; keine Drive-Schreibannahme |
| Verstandene-Daten-/Spec-Zone | `/angebot`, `/produktion` | `AcceptedEventSpec`, `OfferDraft`, Audit-/Aenderungsspur | Strukturierte Daten bleiben fuehrend, nicht Chattext |
| Rueckfragen-/Klaerzone | `/angebot`, `/produktion` | `AcceptedEventSpec`, `OfferDraft`, `ProductionPlan`, `Recipe`, Audit-/Aenderungsspur | Rueckfragen fuehren zurueck in vorhandene Objekte |
| Ergebnisobjekt-Zone | `/angebot`, `/produktion`, `/` | `AcceptedEventSpec`, `OfferDraft`, `ProductionPlan`, `PurchaseList`, `Recipe`, Audit-/Aenderungsspur | Ergebnisse bleiben eigene pruefbare Bereiche |
| Export-/Drive-Output-Zone | `/angebot`, `/produktion`, `/` | `OfferDraft`, `ProductionPlan`, `PurchaseList`, `Recipe`, Audit-/Aenderungsspur | Bestehende Exporte abbilden; Drive nur read-only Quelle oder explizit freigegebener Output |
| Audit-/Herkunft-/Freigabe-Zone | `/`, `/angebot`, `/produktion` | alle genannten Objekte plus Audit-/Aenderungsspur | Herkunft, Operator, Zeitpunkt, Aktionstyp und Review-/Freigabestatus sichtbar halten |

## 6. Offene Entscheidungen vor Implementierung

1. Bleibt die Workbench reine UI-Projektion vorhandener Objekte oder braucht es spaeter ein eigenes Conversation-Produktobjekt?
2. Welche Rueckfragen duerfen conversational wirken und welche muessen als strukturierte Pflichtfelder bleiben?
3. Wie prominent soll die Audit-/Herkunftszone im Hauptfluss sichtbar sein: dauerhaft, kompakt oder einklappbar?
4. Welche Ergebnisobjekte brauchen zuerst eine cleanere read-only Darstellung: `AcceptedEventSpec`, `OfferDraft`, `ProductionPlan`, `PurchaseList` oder `Recipe`?
5. Welche Drive-Rolle wird zuerst entschieden: read-only Importquelle, Output-Ablage oder beides strikt getrennt?
6. Wie wird spaeter technisch garantiert, dass bestehende Drive-Dateien read-only bleiben und Schreibzugriff nur auf app-eigene Outputs oder explizit freigegebene Ziele geht?

## 7. Kleinster sinnvoller naechster Schritt

Nach diesem Mapping waere der naechste sichere Schritt weiterhin kein Implementierungsumbau, sondern eine Entscheidung ueber die erste read-only UI-Projektion:

- entweder `AcceptedEventSpec` + Rueckfragen als ruhiger Spec-/Klaerbereich,
- oder `ProductionPlan` + `PurchaseList` als Ergebnisobjekt-Zone,
- oder `OfferDraft` + Angebotsvarianten als pruefbarer Angebotsbereich.

Erst danach sollte ein minimaler UI-Schritt erfolgen, ohne neue API, ohne Google-Integration und ohne neue Persistenz.
