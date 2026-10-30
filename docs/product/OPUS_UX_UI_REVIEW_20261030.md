# Opus 5.5: UX/UI-Ausgangsreview CateringOS – 30.10.2026

Tatsächlich verwendetes Modell laut CLI-Ergebnis: `claude-opus-5-5`; normaler angemeldeter First-Party-Zugang. Reiner Lesereview vor Produktänderungen, auf Basis von Main `23e7e7119257945daabc6549062449b7a4e36fe8`, einem tatsächlichen Nürnberger Desktopausschnitt, ausgewählten aktuellen Komponenten und der gemeinsamen AgenturOS-Referenz. Kein eigener Live-, Mobil- oder Laientest; die im Ergebnis benannten Materialgrenzen bleiben bestehen. Die Rohmetadaten und bereinigte Vorlage liegen geschützt in `tmp/opus-uiux-20261030-7046/`.

Der nachfolgende Bericht ist das Urteil des unabhängigen Reviewers. Konkrete Korrekturen werden gegen den tatsächlichen Code geprüft; insbesondere sind historisch bestätigte Küchenannahmen keine neue Fachfreigabe und ein nur vorgeschlagener Revisionsweg keine implementierte Funktion.

# CateringOS: Kritischer UX/UI-Review vor dem Block „Ernährungsfragen → Bedienweg → Pilotauftrag“

## Entscheidung: heute **nicht bereit** für Menschen ohne Computerkenntnisse

**Begründung:** Die fachlichen Schutzregeln sind sorgfältig umgesetzt. Die Freigabe ist gesperrt, solange eine Sonderkost-Rückfrage offen ist (`production-draft-review-panel.tsx:179`, `:779`). Die Hinweise sagen ausdrücklich „noch nicht freigegeben“, und offene Allergen- und Hygieneprüfungen werden im Auftragskopf genannt (`App.tsx:1452`).

Genau an der beauftragten Stelle endet der Bedienweg aber in einer Sackgasse. Die Seite zeigt „offen 4 · beantwortet 0“ und sagt, Änderungen gingen „nur in einer offenen Prüffassung“. Laut dem gelesenen Code bietet sie dafür aber keine Schaltfläche. Unerfahrene Personen brauchen hier technische Hilfe. Unabhängig davon fehlen weiterhin alle echten Fachfreigaben.

**Muss vor dem Block ein anderer Blocker behoben werden?** Nein, kein separater Block. Der Block braucht aber einen **Schritt 0**: den sichtbaren Weg vom übernommenen Stand zu einer offenen Prüffassung (Befund 1). Ohne ihn lässt sich Schritt 1 nur mit technischem Wissen bedienen.

## Befunde (max. 5)

**P0-1 · Kein Weg vom übernommenen Stand zur Prüffassung; zwei verschiedene „nächste Schritte“**
- **Stelle:**
  - `backoffice-ui/src/production-question-panel.tsx:195`: Bei schreibgeschütztem Stand wird keine einzige Aktion angezeigt.
  - `:295`: Der Bereich für Klärfassungen (`ProductionClarificationDraftPanel`) erscheint nur, wenn Antworten bearbeitbar sind. Er fehlt also genau in dem Zustand, in dem er gebraucht wird.
  - `production-draft-review-panel.tsx:564`: Ohne offenen Entwurf wird gar nichts angezeigt.
  - `App.tsx:1191`: Der nächste Schritt ist ein bloßer Text ohne Aktion.
  - `App.tsx:360`: Der allgemeine nächste Schritt „inspect_result“ führt zu den Unterlagen, nicht zu den vier offenen Fragen.
- **Auswirkung:** Das Büro sieht vier offene Fragen und kann nichts tun. Der einzige sichtbare Umweg ist „Optionale Korrektur → Korrektur auswerten“ (`production-input-panel.tsx:497`). Damit würden Antworten zur Ernährungskennzeichnung über eine erneute KI-Auswertung laufen. Das ist fachlich der falsche Kanal.
- **Kleinste Korrektur:** Im schreibgeschützten Zustand genau eine Hauptaktion anzeigen:
  - wenn noch keine offene Fassung existiert: „Rückfragen in neuer Prüffassung beantworten“, mit dem Satz „Der übernommene Stand bleibt unverändert“;
  - wenn eine offene Prüffassung existiert: „Offene Prüffassung öffnen“.

  Den allgemeinen nächsten Schritt angleichen, solange Ernährungsfragen offen sind.
- **Prüfbarer Erfolg:** Vom Stand im Screenshot aus erreicht man mit höchstens 2 Klicks das Antwortfeld der ersten Frage. Revision 3 ist danach nachweislich unverändert. Allgemeiner Hinweis und Rückfragenbereich nennen denselben Schritt.

**P1-2 · Technik- und Chat-Sprache im Hauptlesefluss**
- **Stelle:**
  - Screenshot: „SESSION-GRUNDLAGE … Kein freier LLM-Chat“, „AGENT FRAGT · OFFEN“, Kreise „S“ und „A“, „Herkunft: SYNTHETISCHER-REZEPTMODELL-REVIEW“, „Quellrevision 2“, „Quellenbindung“, „2026-11-13“, „Teilnehmer“ statt „Gäste“.
  - Code: `production-question-thread.tsx:126`, `:136`; `production-draft-review-panel.tsx:93–106` („Agenten-Entwurf“, „lokaler Provider“); `production-input-panel.tsx:282` („Drag & Drop“).
- **Auswirkung:** Die Küche versteht nicht, wer fragt und was „S“ oder „A“ bedeutet. Eine Ernährungsfrage wirkt wie ein Chat-Beitrag statt wie ein Prüfpunkt.
- **Kleinste Korrektur:**
  - Systemhinweise und Kennungen in einen Aufklapper „Technische Referenzen“ verschieben.
  - Fragen beschriften als „Offene Frage 1 von 4 · Hähnchenragout · Ernährungskennzeichnung“.
  - Kreise entfernen.
  - Datum als „13.11.2026“ anzeigen.
- **Prüfbarer Erfolg:** Eine Textprüfung der Standardansicht findet weder „LLM“, „Session“, „Agent“ noch „Provider“ und keine Kennungen in Großbuchstaben.

**P1-3 · Folgenreiche Entscheidungen ohne Gewichtung und ohne Rückfrage**
- **Stelle:**
  - `production-draft-review-panel.tsx:772–797`: „Entwurf freigeben“, „Entwurf verwerfen“ und „Entwurf übernehmen“ stehen nebeneinander, alle im gleichen Nebenstil. „Verwerfen“ wird sofort ohne Bestätigung ausgeführt. Ist „Freigeben“ gesperrt, wird der Grund nur bei Sonderkost genannt.
  - `:718`: Vier gleichrangige Schaltflächen je Prüfpunkt.
  - `styles.css:2050`: Der Schaltflächenrand #d8dce1 auf Weiß hat rechnerisch etwa 1,4:1 Kontrast; Ziel sind mindestens 3:1.
- **Auswirkung:** Ein Fehlklick verwirft die frisch beantwortete Prüffassung. Schaltflächen sind kaum als solche erkennbar.
- **Kleinste Korrektur:**
  - „Freigeben“ als einzige Hauptaktion gestalten.
  - „Verwerfen“ im Warnstil und mit Bestätigung, die die Folge nennt.
  - Gesperrte Freigabe mit Grundliste, z. B. „Noch offen: …“.
  - Ränder mindestens 3:1.
- **Prüfbarer Erfolg:** Verwerfen ist ohne zweiten Schritt nicht möglich. Jede gesperrte Freigabe nennt ihren Grund.

**P1-4 · Verschachtelung, doppelte Sätze, Reihenfolge**
- **Stelle:**
  - Screenshot: vier ineinanderliegende Rahmen (Bereich → Karte → gestrichelter Rahmen → Aufklapper → Sprechblasen).
  - Derselbe Satz zum schreibgeschützten Stand steht zweimal: `App.tsx:1191` und `production-question-panel.tsx:181`.
  - Die Auftragshistorie steht vor dem nächsten Schritt: `App.tsx:1477` vor `:1497`.
- **Auswirkung:** Die eigentliche Aufgabe rutscht nach unten. Auf dem iPhone kosten die verschachtelten Innenabstände viel Breite. Das ist aus dem CSS abgeleitet, nicht gemessen.
- **Kleinste Korrektur:**
  - Offene Fragen als eine einfache Liste mit je einer Zeile pro Frage und Status.
  - Gestrichelten Rahmen entfernen.
  - Den Satz nur einmal zeigen.
  - Nächsten Schritt vor die Historie setzen.
- **Prüfbarer Erfolg:** Bei 390 px Breite sind die erste offene Frage und ihre Aktion ohne Suchen erreichbar. Das muss im Browser nachgewiesen werden.

**P2-5 · Formulare und Fehlermeldungen**
- **Stelle:**
  - Felder nur mit Platzhalter statt Beschriftung: `production-question-panel.tsx:346–370`, `production-input-panel.tsx:567–605`. Dort wird außerdem ein ISO-Datum verlangt.
  - Kleine Überschriften in Großbuchstaben mit rechnerisch etwa 3,2:1 Kontrast: `styles.css:605`.
  - Fehlertexte werden roh durchgereicht: `production-draft-review-panel.tsx:457`, `:518`; `App.tsx:1500`. Es fehlt die Unterscheidung „Ausgang unklar – Stand neu laden, nicht erneut senden“.
- **Kleinste Korrektur:**
  - Sichtbare `label`-Beschriftungen.
  - Kontrast mindestens 4,5:1.
  - Fehlermeldungen zuerst in verständlichem Deutsch; technische Details in einen Aufklapper. Abgebrochene Anfragen als „Ausgang unklar“ behandeln.
- **Prüfbarer Erfolg:**
  - Jedes Feld hat einen zugänglichen Namen.
  - Eine abgebrochene Freigabe zeigt nie „nicht gespeichert“.

## Apple-like-Zielbild im bestehenden Stil

- **Anfrage:** Eine Fläche „Anfrage einfügen oder Datei wählen“ mit genau einer Aktion. Das Ergebnis ist eine kurze Eigenschaftenliste (Datum, Gäste, Ort, Menü) mit dem Kennzeichen „Vorläufig“.
- **Angebot:** Kopfzeile „Kunde · Datum · Gäste“, darunter „Nächster Schritt“ in einem Satz. Positionen und Prüfpunkte erscheinen als Liste mit Status. „Angebot freigeben“ ist erst aktiv, wenn alles geprüft ist; vorher steht dort, was noch offen ist.
- **Produktion:** Kopfzeile, „Nächster Schritt“, dann die Gruppe „Offene Fragen (4)“ mit einzeln beantwortbaren Zeilen. Vorschläge sind auswählbar, aber nie vorausgewählt, und es gibt die Option „Bleibt offen / an Küche“. Danach die Gruppe „Unterlagen“ (Plan, Arbeitsblätter, Einkauf), deutlich als „vorläufig – fachliche Freigaben fehlen“ gekennzeichnet. Grundlagen, Historie und technische Referenzen sind eingeklappt.

## Umsetzungsreihenfolge für genau diesen Block

**Funktion**
1. Im Code klären, welcher bestehende Weg aus dem übernommenen Stand eine offene Prüffassung erzeugt. Das ist entweder die Klärfassung (`ProductionClarificationDraftPanel`) oder die Überarbeitung (`reviseProductionDraft`); dazu gehört auch die Bearbeitungsregel `canEditProductionAnswers`. Ich konnte diese Teile nicht lesen.
2. Diesen Weg im schreibgeschützten Zustand anbieten (P0-1). Die Antworten werden an die neue Fassung gebunden; Revision 3 bleibt unverändert.
3. Jede Frage einzeln speichern. „Beantwortet“ erst anzeigen, wenn der Server es bestätigt hat, zusammen mit Zeitpunkt und Fassung.
4. Die Freigabe bleibt manuell. Die Freigabebedingungen ändern sich nicht, und Allergen-Angaben werden nicht automatisch abgeleitet.

**UX**
5. Ein einheitlicher nächster Schritt im allgemeinen Hinweis und im Rückfragenbereich.
6. Bestätigung beim Verwerfen und Gründe bei gesperrter Freigabe (P1-3).

**UI**
7. Technik-Sprache entfernen und Verschachtelung reduzieren (P1-2, P1-4).
8. Kontraste und Beschriftungen nachziehen (P2-5).

**Danach (Auftrag 2 und 3)**
- Den normalen Bedienweg mit einer echten unerfahrenen Person beobachten, am Desktop und auf dem iPhone.
- Erst danach den Pilotauftrag vorbereiten. Dabei die Doppelung zwischen separater Mengensteuerung und Rückfragen-Editor prüfen; diese Teile konnte ich nicht lesen.

**Spätere Fachfreigaben (nicht Teil der UX-Arbeit)**
- Echte Küchen-, Allergen-, Lieferanten- und Pilotfreigaben.
- Reale Ausbeute und Temperaturführung.
- Klären, ob ein Planungsnachweis aus „Quellrevision 2“ für die übernommene Revision 3 gilt. Falls nicht, muss er sichtbar als frühere Fassung gekennzeichnet werden.

## Prüfgrenzen

- **Gelesen:** beide Gestaltungsdokumente, beide PNGs, `App.tsx` (vollständig), `production-route-main-layout.tsx`, `production-question-panel.tsx`, `production-question-thread.tsx`, `production-input-panel.tsx`, `production-draft-review-panel.tsx` und `styles.css` ab Zeile 1300 sowie die Zeilen 1–620.
- **Nicht gefunden:** Die DOM- und Scope-Check-Dateien. Ich habe mehrere naheliegende Dateinamen versucht; ohne Verzeichnisliste blieben sie unauffindbar. Sie sind in dieses Urteil nicht eingeflossen.
- **Nicht im bereitgestellten Material:**
  - die Komponente für Klärfassungen, der Antwort-Editor und die Bearbeitungsregel;
  - die Logik des allgemeinen nächsten Schritts, die Historie, die Angebotsoberfläche, die Ergebnis-, Einkaufs- und Mengenbereiche sowie die Startseite.

  **Den Angebotsweg habe ich deshalb nur über `App.tsx` beurteilt.** Ob P0-1 an anderer, nicht gelesener Stelle schon einen Einstieg hat, ist offen. Das ist der erste Prüfpunkt von Schritt 1.
- **Nicht durchgeführt:** kein Browser-, Mobil-, Tastatur- oder Laientest und keine Exporte. Kontrastwerte sind aus den CSS-Werten berechnet, nicht gemessen. Gesehen habe ich nur den einen Desktop-Ausschnitt. Es gibt keine Gesamtfreigabe für das Produkt.


## Umsetzungsstand nach dem Ausgangsreview (Codex/Terra, 30.10.2026)

Der Bericht oben bleibt die ursprüngliche Einschätzung von Opus5.5. Die danach lokal umgesetzte Fortsetzung, Einzelantworten und historische Unterlagen wurden risikobezogen unabhängig mit Terra6.1 geprüft. Die Benutzeroberfläche wurde im echten isolierten lokalen App-/HTTP-Stack bedient: vier synthetische Fragen einzeln bestätigt, nach vollständigem Reload weiterhin0offen/4beantwortet, übrige Freigabepflichten weiterhin gesperrt. SichtprüfungDesktop und390pxMobil; keine horizontale Überbreite. Keine Behauptung eines neuen Opus-Gesamturteils oder Nürnberger100-Gäste-Passes.

Behoben: Revisionssackgasse, Chatrollen im Hauptlesefluss, Fragenreihenfolge, Einzelantwort-/Speicherstatus, Doppelabzug im Fragezähler, getrennte historische Unterlagen, explizites Vorbereiten, Sperrgründe und Bestätigung vor Verwerfen. Weitere Verbesserungen des gesamten Angebots-/Produktionsarbeitsplatzes und ein tatsächlicher Laientest bleiben Teil der Pilotabnahme. Unabhängige Rezept-, Allergen- und Küchenfreigaben bleiben offen.
