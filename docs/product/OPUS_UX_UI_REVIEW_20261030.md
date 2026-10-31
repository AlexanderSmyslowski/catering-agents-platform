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


## Tatsächlicher Opus-5.5-Nachreview des geänderten UI-Stands

Ein erster Bereitstellungsversuch enthielt versehentlich keine explizite Dateiliste und konnte deshalb weder neuen Code noch Bilder beurteilen. Dieser unvollständige Versuch ist keine Abnahme. Danach erhielt Opus eine vollständige Liste mit sieben geänderten Komponenten, UI-Diff, gemeinsamer Gestaltungsleitlinie und tatsächlichen lokalen Desktop-/Mobilbildern. Das folgende Urteil stammt tatsächlich von `claude-opus-5-5` (success, Modellmetadaten geprüft); es ist kein Livebrowserreview.

Ich habe alle Dateien aus dem Brief gelesen. Hier der Nachreview.

# UX/UI-Nachreview a5c6b37 + DOM-Fix: Fortsetzung, Einzelantworten, Freigabe

**Empfehlung für diese Auslieferung: HOLD_UI_INCREMENT.** Das Halten ist eng begrenzt. Befund 1 und 2 sind jeweils kleine Korrekturen. Danach spricht aus dem gelesenen Material nichts gegen ACCEPT. Befund 3 kann nachgezogen werden.

**Grundlage:** Das Urteil beruht nur auf Code, Diff und den zwei Bildern. Ich habe nichts selbst bedient. Die Liste „Behoben“ am Ende von `original-review-and-implementation.txt` stammt von Codex/Terra und ist kein Urteil von Opus. Ich habe sie gegen den Code geprüft und nicht einfach übernommen.

## Befunde

**1 · Der Button „Offene Rückfragen klären“ führt an der einzigen nutzbaren Aktion vorbei**
- **Stelle:**
  - Im übernommenen Stand fokussiert der allgemeine Schritt `#production-question-panel` und scrollt mit `block: "start"` dorthin (`changed-ui.diff.txt:46-48`, `:43`).
  - Die eigentliche Aktion „Rückfragen in neuer Prüffassung beantworten“ liegt aber *vor* diesem Panel (`production-route-main-layout.tsx.reviewed.txt:156` vor `:159`).
  - Am Ziel steht nur: „…kann hier nicht geändert werden. Änderungen sind nur in einer offenen Prüffassung möglich“ (`production-question-panel.tsx.reviewed.txt:186`). Dort gibt es keinen Hinweis auf die Aktion darüber.
- **Folge für Nutzende:** Wer dem Hinweis „Nächster Schritt“ folgt, landet auf einem Text, der sagt, dass hier nichts geht. Die Schaltfläche liegt oberhalb des sichtbaren Bereichs, auf dem iPhone deutlich weiter oben. Für unerfahrene Personen fühlt sich das wieder wie die ursprüngliche Sackgasse aus P0-1 an, obwohl der Weg technisch existiert.
- **Kleinste Korrektur:**
  - Der Section in `production-clarification-continuation.tsx.reviewed.txt:86` ein `id` und `tabIndex={-1}` geben.
  - In `App.tsx` im übernommenen Stand diese Section ansteuern statt des Panels.
- **Beleggrad:** Aus dem Code abgeleitet. Die Bilder zeigen diesen Zustand nicht. Ob eine `scroll-margin` oder eine fixierte Kopfzeile das abmildert, ist im Material nicht sichtbar.

**2 · „Bleibt offen“ speichert, ohne dass man es irgendwo sieht**
- **Stelle:**
  - `decide("unclear")` setzt die Entscheidung der Prüfkarte (`production-dietary-question-actions.tsx.reviewed.txt:50`).
  - Der Fragestatus kennt aber nur `pending` und `confirmed` (`changed-ui.diff.txt:112`). Das Abzeichen bleibt deshalb „Rückfrage offen“ (`production-question-thread.tsx.reviewed.txt:98`).
  - Die Schaltflächen sind danach wieder aktiv, und bei Erfolg erscheint keine Rückmeldung.
  - Die Karte selbst wird in der Entwurfsprüfung herausgefiltert (`production-draft-review-panel.tsx.reviewed.txt:689`). Die Entscheidung „unklar“ ist damit nirgends sichtbar. Sie zählt nur still in „n erforderliche Prüfpunkte offen“ mit.
- **Folge für Nutzende:** Nach dem Klick passiert sichtbar nichts. Man klickt erneut oder wählt aus Verlegenheit „… bestätigen“. Gerade bei einer Kennzeichnungsentscheidung ist das unerwünscht. Wenn die vorgeschlagene Kategorie falsch ist, wird auch kein Weg zur Korrektur gezeigt.
- **Kleinste Korrektur:** In `ProductionDietaryQuestionActions` bei `card.decision === "unclear"` eine Zeile anzeigen: „Als offen markiert – Kennzeichnung über ‚Angaben oder Kennzeichnung ändern' korrigieren oder später bestätigen.“ Dazu nach jeder Entscheidung eine kurze Meldung mit `role="status"`.
- **Beleggrad:** Aus dem Code abgeleitet. Laut Brief wurden live nur die Bestätigungen 0/4 → 4/0 bedient, „Bleibt offen“ nicht.

**3 · Nach der letzten Antwort fehlt der Hinweis auf den nächsten Schritt**
- **Stelle:**
  - Sobald `productionQuestions.length === 0` ist, entfällt der geführte nächste Schritt (`changed-ui.diff.txt:58`).
  - Das Panel heißt dann „Erkannte Angaben prüfen“ (`production-question-panel.tsx.reviewed.txt:181`). Darunter steht weiter „Beantworte die Rückfragen einzeln…“ (`:187-188`).
  - Den Sprung gibt es nur in eine Richtung: von der Entwurfsprüfung zu den Fragen („Ernährungsfragen öffnen“, `production-draft-review-panel.tsx.reviewed.txt:682-686`). Von den Fragen zu den übrigen 6 Prüfpunkten und zur Freigabe führt nichts.
- **Folge für Nutzende:** Bei 4/0 sagt der Bereich weiterhin „beantworten“, obwohl nichts mehr zu beantworten ist. Wo es weitergeht, muss man selbst suchen.
- **Kleinste Korrektur:** Bei `hasDietaryReview && productionQuestions.length === 0` den Text ersetzen durch: „Alle Ernährungsfragen sind beantwortet. Nächster Schritt: die übrigen Prüfpunkte im Entwurf prüfen.“ Dazu eine Schaltfläche „Zu den Prüfpunkten“, die spiegelbildlich zu `:682` arbeitet und das Element mit `productionDraftEntryId(draftId)` fokussiert.
- **Grenze:** Was der allgemeine `nextAction` in diesem Zustand anzeigt und wo die Entwurfsprüfung im Layout steht, ist im Material nicht enthalten. Möglicherweise mildert das den Befund.

## Schwerpunkte des Briefs

- **Bestätigung beim Verwerfen:** Erfüllt.
  - Es braucht einen zweiten Schritt, und die Folge wird genannt.
  - Der Fokus springt auf „Entwurf behalten“, und es gibt den Warnstil `destructive-button` (`production-draft-review-panel.tsx.reviewed.txt:827-838`). Das CSS für `destructive-button` liegt nicht im Diff.
  - Kleinigkeit: Der Satz „Der zuletzt übernommene Stand bleibt erhalten“ erscheint auch, wenn es noch gar keinen übernommenen Stand gibt.
- **Gesperrte Freigabe:** Weitgehend erfüllt.
  - Gründe werden immer angezeigt und sind über `aria-describedby` verknüpft (`:187-196`, `:800-808`).
  - Die erforderlichen Prüfpunkte werden aber nur gezählt, nicht benannt. Das Original verlangte eine Liste nach dem Muster „Noch offen: …“.
- **Status je Einzelantwort:** Bestätigt wird erst nach Neuladen vom Server (`changed-ui.diff.txt:349-353`). Für „Bleibt offen“ siehe Befund 2.
- **Mobil:**
  - Das 390-px-Bild zeigt eine saubere, einspaltige Liste. Das Abzeichen steht unter der Überschrift, und es gibt keinen sichtbaren Überlauf.
  - Ob die *erste offene* Frage früh erreichbar ist, belegen die Bilder nicht, denn sie zeigen nur den bereits beantworteten Bereich.
  - Zusätzlich: Der Link „Rezeptgrundlage und Mengen prüfen“ springt in die Planungszone, die per CSS an Position 5 weit unten liegt (`changed-ui.diff.txt:304`, `:980`). Einen Rückweg zu „Prüffassung vorbereiten“ gibt es nicht. Auf dem iPhone heißt das: lange zurückscrollen.

## Kriterien aus dem Ausgangsreview (Opus)

| Kriterium | Stand |
|---|---|
| P0-1 Weg zur Prüffassung | **Erfüllt**, mit dem bewusst eingefügten Schritt „Vorbereiten“. Dass allgemeiner Hinweis und Rückfragenbereich denselben Schritt nennen, ist nur **teilweise** erfüllt (Befund 1, 3). Die Klickzahl bis zum ersten Antwortfeld ist nicht belegt. |
| P1-2 Chat-Rollen, Kreise S/A, Fragen nummerieren | **Erfüllt** (`thread:90-112`); technische Hinweise sind eingeklappt |
| P1-2 Standardansicht ohne „Agent“/„Provider“ | **Nicht erfüllt**: „Annahmen des Agenten“ steht sichtbar im Bild (`question-panel:282`), „Agenten-Entwurf“ und „lokaler Provider“ bleiben (`draft-review-panel:93-106`). „Teilnehmer“ und ISO-Datum sind als bekannte Grenze ausgenommen. |
| P1-3 Freigabe als Hauptaktion, Verwerfen mit Bestätigung, Sperrgründe | **Erfüllt**; Sperrgründe nur als Anzahl |
| P1-3 Randkontrast | **Erfüllt** für die Produktionsroute: `#8e8e93` ergibt rechnerisch etwa 3,3:1 (`diff:969`) |
| P1-3 Vier gleichrangige Schaltflächen je Prüfpunkt | **Nicht erfüllt**, unverändert (`draft-review-panel:745-762`) |
| P1-4 Verschachtelung, Reihenfolge Fragen vor Eingabe | **Erfüllt** (CSS `diff:930-990`) |
| P1-4 doppelter Satz, Historie vor nächstem Schritt | **Nicht belegt**: die Stellen in `App.tsx` liegen nicht im Diff |
| P2-5 Fehlertexte | In den neuen Komponenten **erfüllt** („nicht sicher bestätigt… erneut laden“). Freigabe und Verwerfen geben weiter Rohtexte aus (`draft-review-panel:538`): **nicht erfüllt** |
| P2-5 Beschriftungen nur als Platzhalter | **Nicht erfüllt** (`question-panel:359-383`) |
| Umsetzungsschritt 3: Zeitpunkt und Fassung bei „beantwortet“ | **Nicht erfüllt**: „Gespeicherte Antwort“ ohne Zeitpunkt und Fassung (`thread:102-104`, Bild) |

## Grenzen

- **Nicht im Material:** der vollständige Fokus-Helfer und der `nextAction`-Text in `App.tsx`, die Stelle, an der die Entwurfsprüfung eingebunden ist, die Eingabe- und Planungskomponenten sowie das CSS außerhalb des Diffs.
- **Bilder:** Sie stammen aus der Zeit vor dem DOM-Fix und zeigen nur den beantworteten Bereich. Den übernommenen Stand, die Vorbereitung, „Bleibt offen“ und die gesperrte Freigabe zeigen sie nicht.
- **Nicht durchgeführt:** kein eigener Live-, Tastatur- oder Laientest.
- **Bezugsrahmen:** Das Urteil gilt nur für diesen UI-Schritt. Es ist kein Urteil über das Gesamtprodukt und keine Grundlage für eine Küchen- oder Pilotfreigabe.

## Behandlung der drei neuen Befunde (Codex/Terra, getrennt vom Opus-Urteil)

Alle drei beschriebenen Punkte wurden danach gezielt korrigiert. Die globale Aktion fokussiert die tatsächlich gerenderte Fortsetzung beziehungsweise Vorbereitung und ansonsten das bearbeitbare Fragepanel. „Bleibt offen“ ist aus der aktuellen geladenen Prüfkarte dauerhaft sichtbar; bestätigte Antworten stammen weiterhin ausschließlich aus der Serverprojektion. Nach vier Antworten führt ein eigener Button zur aktuellen Entwurfsprüfung, öffnet nötige Aufklapper und erhält die übrigen Freigabesperren. Der Satz zu noch offenen Ernährungsfragen erscheint nach vollständiger Beantwortung nicht mehr widersprüchlich.

Unabhängiger fokussierter Terra-6.1-Review: ACCEPT dieser Korrekturen, keine nachträglich behauptete Opus-Annahme. 51 betroffene UI-/Fokus-/Statusprüfungen und nach kleiner Textkorrektur 28 Entwurfsprüfungen bestanden; abschließender Build bestanden. Im echten isolierten lokalen App-/HTTP-Stack den zentralen Sprung zur Vorbereitung bedient, über die normale Schaltfläche vorbereitet, „Bleibt offen“ gespeichert und nach vollständigem Reload wiedergefunden; dann vier Antworten einzeln bestätigt, deren Servermeldungen abgewartet und den Button zu den übrigen Prüfpunkten bedient. Exakte aktuelle Draft-ID fokussiert, sechs übrige Pflichtprüfungen blockieren weiter die Freigabe. Nach Reload0offen/4beantwortet. 390pxMobil: Seitenbreite390px, Fragepanel333,61px, Abschlussbutton sichtbar.

Grenzen: synthetische35Gäste-Fixture; offene Folgefassung und frische Planungsnachweise wurden über echte lokale HTTP-Schnittstellen vorbereitet. Die ursprünglich angewendete Fixture hatte bereits beantwortete Fragen, daher deren Fortsetzungsfokus nur durch den tatsächlichen App-DOM-Regressionstest, nicht als neuer Browserklick aus einem offenen Legacy-Applyzustand belegt. Die historische Unterlage blieb beim Erstellen der Folgefassung identisch. Kein neuer Nürnberger100-Gäste-, Hardwaretastatur-, Laien-, Küchen- oder Gesamtpilottest. Sichtbelege unter tmp/product-usability-preview-7046/final-*. Der Desktopausschnitt zeigt einen unteren Bereich; das Mobilbild zeigt den tatsächlichen Abschluss und den nächsten Schritt. Bekannte übrige P2-/Fachthemen bleiben offen.


## Unabhängige Produktarbeit während des Ziel-Zeitgates (5.676)

Die zuvor offenen Formular-/Sprachbefunde sind lokal weiter behandelt: dauerhafte Labels, nativer manueller Datepicker, deutsche Vorschläge bei erhaltenen Schlüsseln und freie Eingaben, CateringOS/Fachbereichsnamen. Gebündelte echte Desktop-/390px-Prüfung und tatsächlicher lokaler35Gäste-HTTP-Speicherweg. Dabei belegte manuelle Namens-/Neuladefehler gezielt mit vorhandenen Case-/URLkomponenten korrigiert; nach unabhängigemTerra-Kalenderbefund eng nachgeprüft. Nach vollständigemReload bleibt genau der neue offeneFall mit Kunde/Veranstaltungsdatum/Gästen. Dies ist Codex/Terra-Umsetzungsevidenz, kein nachträglich behauptetes Opus-Gesamturteil und kein neuer Nürnberg100Gäste-/Laien-/Pilotpass. Details/Grenzenmemory5.676.


## 31.10.2026 — begrenzter Kundenentwurf-Inkrementreview

Tatsächlicher Opus5.5/firstParty-Aufruf, Sessionabec3a44-7c9c-4991-9f1a-52fd8be3481f,
subtype success, canonicalModelclaude-opus-5-5: **ACCEPT** für neue Kundenentwurf-
Vorschau, Fassungs-/Zugriffs-/Kostenfilter und Verständlichkeit. Bereinigte neue
Quellen/Diff und echte lokaleDesktop-/390pxScreenshots gelesen; kein eigener
Livebrowser-/Testlauf, kein gesamtes Produkt-/Laien-/Küchen-/PilotGO.

Kleine Hinweise gebündelt präzisiert: Benennung Kundenentwurf, ehrlicher Status bei
offenerSteuer, Berechnungsdetails nurintern, klareBruttosumme. Bestehende
Varianten-/Preisbindung wurde an vorhandener Preisrevision und ihren gültigen Tests
bestätigt. Kein destruktiver Cleanupvorschlag übernommen; macOS-Papierkorb bleibt
lokal, LinuxCI räumt seinen temporärenWorkspace regulär selbst auf.

HistorischerMehrrezeptfall separatHOLD:8Angebotspositionen sind noch nicht sicher
11Produktionsrezepten zugeordnet. Kein Apply und kein Review dieses nichtimplementierten
Splits behauptet. Quellen/Originalurteil E/tmp/customer-offer-28042.


## 31.10.2026 — Produktionsaufteilung und enger Konsequenznachreview (5.690)

Tatsächlicher Opus5.5/firstParty-Review akzeptierte Funktion/Lineage/Autorisierung der
neuen Aufteilung, verlangte aber zwei UX-Texte und ein Default-Off-Schreibgate vor
Release. Terra korrigierte diese Punkte samt vorhandener UI-Server-Fähigkeitsbindung
und dem konkret gefundenen Risiko unauflösbarer Quellrückfragen. Kein erneuter
Gesamtarchitekturreview oder unveränderter Volltest.

Tatsächlicher Nachreview Session49d8bfea-d517-4a85-b8df-1f9af4c55073,
canonicalModelclaude-opus-5-5, providerfirstParty, success: ACCEPT für893570e→df4427b.
Reviewer las exaktes Diff und neue Desktop-/390px-/Konfliktbilder, führte selbst keine
Tests und keinen Browser aus. Root hat neuen Bedienweg/Fehlermeldung/Verwerfen und
Default-Off-HTTP tatsächlich geprüft. Voller historischer Normal-UI-Ablauf ist lokal
PASS mit11Rezeptblättern,122Beiträgen,61Druck-/CSVpositionen einschließlich2gZimt;
kein Nürnberger Update oder echter Küchen-/Pilotnachweis.

Releasegrenze bleibt explizit: Ziel-Split erst nach kompatiblem installiertem/geprüftem
Rückfallvorgänger einschalten. PR770 könnte die neuen JSON-Datensätze sonst nicht
lesen. Standard off und unsichtbare Splitaktion erhalten den bestehenden Rückfall.
Kleine nicht blockierende Hinweise: doppelte bestehende Fehleranzeige; genaue Ursache
bei fremden indexgebundenen Fragen könnte noch verständlicher sein. Aktuell erzeugte
Fragepfade und einziger normaler Split-Schreibweg sind an tatsächlichen Quellen geprüft;
interne vertrauenswürdige Service-Vollspec-Endpunkte sind kein globaler Datenfilter.
Quellen/Urteile und tatsächliche Screenshots unter E/tmp/customer-offer-28042.
