# /produktion Strukturplan: Ultra-clean Conversational Workbench

Status: Plan mit begonnenen UI-Slices, keine neue Fachlogik
Datum: 2026-05-21
Scope: Backoffice-UI-Route `/produktion`, Layout-/Strukturumbau mit bestehenden Daten, bestehenden Aktionen und bestehenden API-Pfaden.

## Produkt-Nordstern 2026-05-21

Alexander hat das langfristige Zielbild fuer den Produktionsagenten geschaerft:

- Im Ideal ist `/produktion` eine weisse, chatzentrierte Arbeitsflaeche.
- Der Nutzer gibt ein von Ronak erstelltes Angebot per Drag & Drop oder `+`-Auswahl in den Chatbereich.
- Der Agent stellt Rueckfragen, bis die Produktionsarbeit belastbar moeglich ist.
- Ergebnisobjekte bleiben pruefbar: Rezepte je Speise, Mengen je Personenanzahl, Rezept-Lebensmittelmengen, kumulierte Einkaufsliste, druckbare Dateien/Downloads und spaeter Allergenlisten Deutsch/Englisch.
- Quellen koennen spaeter Angebot, Antworten, Internet-Recherche, hinterlegte Rezepte und fruehere gute Catering-Rezepte sein.

Verbindliche Grenze fuer kleine Schritte:

- Keine simulierte Magie: keine echte PDF-Extraktion, Internet-Recherche, Rezeptgenerierung, LLM-Konversation oder Allergenautomatik behaupten, solange diese Pfade nicht real implementiert sind.
- Keine neue API, Persistenz, Multi-Tenancy, Plattform- oder White-Label-Schiene fuer diesen UI-Schritt.
- Bestehende progressive Produktionsobjekte, Einkaufslisten, Rezeptbibliothek und Exportlinks bleiben Quelle der Wahrheit und werden nur chatzentrierter eingeordnet.

Erste daraus abgeleitete Umsetzung: sichtbare Chat-/Upload-Affordance in `/produktion`, klare Rueckfrage-/Status-/Download-Zonen und Tests auf diese Anker. Danach wurde die Rueckfragezone in zwei kleinen UI-Slices enger an den Chatfluss gerueckt: Agent-Fragen erscheinen als strukturierte Assistant-Bubbles, und die bestehenden Antwortfelder erscheinen nun als Nutzerantwort-Bubble direkt im selben Chatfluss.

## Ziel

`/produktion` soll nicht weiter als Dashboard-/Admin-Cockpit wachsen, sondern als ruhige, Apple-like Conversational Workbench funktionieren.

Dominante Leitfrage:

> Was braucht die Produktion als Naechstes?

Strukturierte Produktionsobjekte bleiben Quelle der Wahrheit. Sie werden aber progressiv sichtbar:

1. Rueckfragen
2. Produktionsplan
3. Einkaufsliste
4. Rezept-/Mengenlogik
5. Audit/Uebergabe

Keine neue Fachlogik, keine neue API, keine Persistenz, kein OAuth/Google/Chat.

---

## Ist-Zustand

Gelesene Anker:

- `AGENTS.md`
- `memory.md`
- `HANDOFF_PROMPT.md`
- `README.md`
- `backoffice-ui/src/App.tsx`
- `backoffice-ui/src/production-language.ts`
- `backoffice-ui/src/offer-workbench.tsx`
- `backoffice-ui/src/styles.css`
- `package.json`

Aktueller Stand in `/produktion`:

- Route ist bereits beruhigt: einspaltiger `production-layout`, Hauptfokus liegt vor Input und Ergebnissen auf der Rueckfragenkarte.
- Suche/Bestand ist bereits in `details.production-filter-details` eingeklappt.
- Hero ist visuell reduziert, Pills sind fuer die Produktionsroute ausgeblendet.
- Produktionsobjekte sind real vorhanden und UI-seitig verknuepft:
  - operative Spezifikation / Rueckfragen
  - Planberechnung
  - Produktionsplaene
  - Einkaufslisten
  - Rezeptbibliothek und Review-Aktionen
  - Exportlinks
  - Intake-Ursprung / Audit-nahe Herkunftsinformationen
- `/angebot` hat bereits ein klareres Pattern in `offer-workbench.tsx`: zentrale Composer-Flaeche, kompakte Zusammenfassung, progressive Details.

Was noch zu laut oder unklar ist:

1. Die erste sichtbare Produktionskarte startet noch als Prozess-/Schrittlogik (`Schritt 2`, `Schritt 3`) statt als eine einzige naechste Produktionsfrage.
2. Eingabe, Rueckfragen, Ergebnis, Rezeptverwaltung und Einkauf sind technisch zwar geordnet, wirken aber weiterhin wie mehrere Panels untereinander statt wie eine gefuehrte Workbench.
3. Die dominante Frage `Was braucht die Produktion als Naechstes?` ist noch nicht die semantische Leitstruktur der Route.
4. `Berechnete Ergebnisse`, `Einkaufslisten` und `Rezeptbibliothek` erscheinen noch als getrennte Arbeitsbloecke; fuer den ersten Screen ist das zu nah an einer Card-Wand.
5. Statusinformationen sind reduziert, aber noch objektzaehlerlastig: Plaene, Listen, Rezepte, Dienststatus, Arbeitsblaetter, Rezeptblaetter, Rezeptauswahl, offene Punkte.
6. Die Quelle der Wahrheit ist korrekt strukturiert, aber die Priorisierung ist nicht klar genug: erst klaeren, dann berechnen, dann operative Objekte aufklappen.
7. Audit/Uebergabe existiert in den Daten-/Export-/Herkunftsspuren, ist aber als ruhige Endzone nicht explizit geordnet.

---

## Ziel-Zustand

Der erste Screen soll wie eine fruehe ChatGPT-App wirken: eine zentrale Arbeitsflaeche mit einem klaren Prompt, leiser Zusammenfassung und progressiven Ergebniszonen.

### Zone 1: Dominante Hauptflaeche

Name: `production-composer` / `production-next-step`

Zweck:

- Erste sichtbare Flaeche beantwortet: `Was braucht die Produktion als Naechstes?`
- Zeigt genau eine priorisierte Handlung:
  - Auftrag einfuegen / Datei ablegen, wenn kein aktiver Vorgang vorhanden ist
  - offene Rueckfrage beantworten, wenn Spezifikation unvollstaendig ist
  - Berechnung starten, wenn genug Produktionsdaten vorliegen
  - Plan/Einkauf pruefen, wenn Ergebnis vorhanden ist
- Nutzt bestehende Actions:
  - `handleIntakeDocumentSubmit`
  - `handleIntakeSubmit`
  - `handleManualSpecSubmit`
  - `beginSpecEdit`
  - `handleSaveSpecEdit`
  - `handleCreatePlan`

Keine neue Entscheidungsmatrix im Backend. Die UI darf den naechsten Schritt nur aus bereits vorhandenen Daten ableiten.

### Zone 2: Leise Kontextzeile

Name: `production-calm-summary`

Zweck:

- Eine kompakte Zeile neben/unter der Hauptflaeche.
- Inhalt maximal:
  - aktiver Vorgang: Eventtyp, Teilnehmerzahl, Datum/offen
  - Klarheit: vollstaendig / teilweise / unzureichend
  - Ergebnisstatus: Plan offen/vorhanden, Einkauf offen/vorhanden
- Keine langen Statuslisten, keine Service-Health im ersten Blick.

### Zone 3: Progressive Rueckfragen

Name: `production-progressive-zone` mit `details`.

Zweck:

- Standardmaessig offen, wenn Rueckfragen vorhanden sind.
- Enthält bestehende `productionQuestions`, Annahmen und das bestehende Antwortformular.
- Umgesetzter kleiner UI-Slice: Das bestehende Antwortformular bleibt fachlich unveraendert, wird aber als Nutzerantwort direkt nach den Agent-Fragen im strukturierten Chatfluss angezeigt.
- Die Detaildaten der Spezifikation bleiben pruefbar, aber nicht als zweite Hauptflaeche.

### Zone 4: Progressive Produktionsobjekte

Name: `production-objects-zone`.

Zweck:

- Standardmaessig offen, wenn ein Plan fuer den aktuellen Vorgang vorhanden ist.
- Enthält:
  - Produktionsplan-Kurzfassung
  - Exportlink Produktionsblatt
  - offene Punkte
  - Arbeitsblaetter / Rezeptauswahl in verschachtelten Details
- Keine neue Planlogik; nur bestehende `selectedPlan`, `currentSpecPlans`, `renderPlanList`, `kitchenSheets`, `recipeSelections` neu gewichtet darstellen.

### Zone 5: Einkaufsliste

Name: `production-purchase-zone`.

Zweck:

- Standardmaessig offen nur, wenn Einkaufslisten fuer aktuellen Vorgang vorhanden sind.
- Sonst eingeklappter Hinweis.
- Zeigt Download und kurze Vorschau, keine langen Listen im ersten Screen.

### Zone 6: Rezept-/Mengenlogik

Name: `production-recipe-zone`.

Zweck:

- Rezeptverwaltung bleibt vorhanden, aber hinter einem ruhigen `details`.
- Rueckt nur dann nach oben, wenn Rezeptpruefung oder Rezeptzuweisung die naechste Arbeit blockiert.
- Keine neue Upload- oder Review-Logik.

### Zone 7: Audit/Uebergabe

Name: `production-handoff-zone`.

Zweck:

- Ruhige Abschlusszone fuer Export, Herkunft, Intake-Ursprung und Uebergabehinweis.
- Bestehende Herkunftsdetails (`intakeRequestDetail`) und Exportlinks werden hier fachlich gebuendelt.
- Kein neuer Audit-Endpunkt, keine neue Freigabelogik.

---

## Optionen

### Option A: Kleine Umbenennung und CSS-Beruhigung im bestehenden Layout

Beschreibung:

- Bestehendes `production-layout` bleibt weitgehend erhalten.
- Texte werden auf Workbench-Sprache gedreht.
- Panels werden visuell noch ruhiger gemacht.

Vorteile:

- Sehr kleiner Eingriff.
- Wenig Risiko fuer bestehende Tests.
- Schnell umsetzbar.

Nachteile:

- Grundproblem bleibt: mehrere Panels untereinander fuehlen sich weiter wie Admin-/Dashboard-Workflow an.
- Die dominante Leitfrage entsteht nur sprachlich, nicht strukturell.
- `/produktion` zieht nicht zum `/angebot`-Workbench-Pattern gleich.

Eignung:

- Gut fuer sehr vorsichtige Mikro-Korrektur.
- Nicht ausreichend fuer das jetzt beauftragte Zielbild.

### Option B: Eigene `ProductionConversationalWorkbench` nach Angebotsmuster

Beschreibung:

- Neue UI-Komponente, z. B. `backoffice-ui/src/production-workbench.tsx`.
- `App.tsx` uebergibt bestehende Daten und Handler wie bei `OfferConversationalWorkbench`.
- Die Komponente ordnet vorhandene Produktionsobjekte in Composer, Calm Summary und progressive Zonen.
- Keine API-, Service- oder Datenmodell-Aenderung.

Vorteile:

- Klare strukturelle Trennung: `App.tsx` bleibt Daten-/Handler-Orchestrierung, Workbench-Komponente bleibt Darstellung.
- Konsistent mit dem bereits erfolgreichen `/angebot`-Pattern.
- Erlaubt echten Apple-like ersten Screen ohne neue Fachlogik.
- Bestehende Funktionen koennen schrittweise in die neue Komponente wandern.
- Tests koennen auf route-eindeutige Marker und vorhandene Texte fokussieren.

Nachteile:

- Etwas groesserer Umbau als reine Text-/CSS-Aenderung.
- Props muessen sauber begrenzt werden, sonst entsteht eine uebergrosse Komponente.
- Bestehende JSX-Bloecke muessen vorsichtig verschoben werden.

Eignung:

- Beste Balance aus Zielbild, Wartbarkeit und Minimal-Scope.

### Option C: Vollstaendige Shell-Neuordnung mit generischem Workbench-System

Beschreibung:

- Gemeinsame Workbench-Abstraktion fuer `/angebot` und `/produktion`.
- Gemeinsame Composer-, Summary-, ProgressivePanel-Komponenten.

Vorteile:

- Langfristig elegant.
- Reduziert spaeter Duplikation.
- Einheitliche UI-Sprache fuer beide Routen.

Nachteile:

- Zu gross fuer den aktuellen Auftrag.
- Refactoring-Risiko ohne direkten Produktwert.
- Gefahr, `/angebot` wieder anzufassen, obwohl es gerade beruhigt wurde.
- Hoeheres Test- und Regressionserfordernis.

Eignung:

- Spaeter eventuell sinnvoll, jetzt nicht.

---

## Empfehlung

Empfohlen wird Option B: eigene `ProductionConversationalWorkbench` nach Angebotsmuster.

Begruendung:

- Sie erreicht das Zielbild wirklich strukturell, nicht nur kosmetisch.
- Sie bleibt innerhalb der Guardrails: keine neue API, keine neue Persistenz, keine neue Fachlogik, keine OAuth-/Google-/Chat-Integration.
- Sie nutzt das repo-interne Muster aus `/angebot`, ohne daraus ein generisches Framework zu bauen.
- Sie erlaubt einen sicheren ersten Umsetzungsschritt: nur den ersten Screen neu rahmen, die tieferen Ergebnis-/Rezept-/Einkaufsdetails zunaechst weitgehend wiederverwenden.
- Sie passt zum Nutzerprinzip: keine weiteren Mikro-Polishes, sondern ein enger Strukturplan mit klarer Entscheidung.

Keine echte Fach-/Architekturentscheidung mit hohem Risiko offen. Es ist eine UI-Strukturentscheidung innerhalb bestehender Daten- und Aktionspfade.

---

## Erster sicherer Umsetzungsschritt im Minimal-Scope

Ziel des ersten Umsetzungsschritts:

Nur den oberen Produktionsbereich in eine echte Workbench-Fuehrung drehen. Bestehende Objekte und Actions bleiben unveraendert.

Konkreter Schritt:

1. Datei `backoffice-ui/src/production-workbench.tsx` anlegen.
2. Eine kleine `ProductionConversationalWorkbench`-Komponente einfuehren.
3. Zunaechst nur drei Zonen dort abbilden:
   - `production-composer`: Headline `Was braucht die Produktion als Nächstes?`, bestehende Text-/Datei-/Manuelleingabe kompakt gefuehrt.
   - `production-calm-summary`: aktiver Vorgang, Klarheit, Planstatus, Einkaufstatus.
   - `production-progressive-zone`: bestehende Rueckfragen und Antwortaktionen.
4. In `App.tsx` fuer `route === "production"` nur den bisherigen oberen Produktionsblock durch die neue Komponente ersetzen bzw. einbinden.
5. Ergebnis-, Rezept- und Einkaufsbereiche im ersten Schritt noch nicht fachlich umbauen; nur bei Bedarf in Details unterhalb belassen.

Wichtig: Der erste Schritt soll nicht gleichzeitig Rezeptverwaltung, Einkaufslisten und Audit neu strukturieren. Erst Hauptflaeche sauber machen, dann zweiter kleiner Schritt fuer Objektzonen.

---

## Nicht-Ziele / Guardrails

Nicht umsetzen:

- keine neue Fachlogik fuer Produktionsentscheidungen
- keine neue API
- keine neue Persistenz
- kein Prisma / keine Datenmigration
- kein OAuth
- keine Google-Drive-Anbindung
- kein echter Chat / keine LLM-Streaming-UI
- keine neue Audit- oder Freigabelogik
- keine Aenderung an Rollen-/Access-Control-Guards
- keine neue Rezeptbewertungslogik
- keine neue Exportlogik
- keine generische Workbench-Abstraktion fuer alle Routen im ersten Schritt
- keine erneute Politur von `/angebot`, ausser Build-/Import-Anpassung zwingt minimal dazu

Bewahren:

- strukturierte Produktionsobjekte bleiben Quelle der Wahrheit
- bestehende Handler und API-Pfade bleiben fuehrend
- vorhandene Exportlinks bleiben nutzbar
- vorhandene Tests duerfen nicht entwertet werden
- Route `/produktion` muss weiterhin smoke-faehig bleiben

---

## Akzeptanzkriterien

Fuer den ersten Umsetzungsschritt gilt:

1. `/produktion` zeigt im ersten Screen sichtbar die Leitfrage `Was braucht die Produktion als Nächstes?`.
2. Es gibt eine dominante Hauptflaeche statt mehrerer gleich gewichteter Panels.
3. Rueckfragen bleiben direkt bearbeitbar.
4. Berechnung kann weiterhin aus dem aktiven Vorgang gestartet werden.
5. Produktionsplan- und Einkaufslisten-Exports bleiben erreichbar.
6. Rezeptverwaltung bleibt vorhanden, aber nicht als laute erste Card-Wand.
7. Keine neuen Netzwerkpfade/API-Endpunkte werden eingefuehrt.
8. Keine neuen Persistenzfelder oder Datenmodelle werden eingefuehrt.
9. `/angebot` bleibt unveraendert funktionsfaehig.
10. Der lokale UI-Route-Smoke fuer `/produktion` findet weiterhin einen route-eindeutigen Produktionsmarker.

---

## Tests / Smokes

Empfohlene minimale Validierung nach Umsetzung:

1. TypeScript/Build:

```bash
npm run build
```

2. Bestehender Route-Smoke:

```bash
npx vitest run tests/backoffice-route-smoke.test.ts
```

3. Produktions-UI-/Akzeptanz-Smoke:

```bash
npx vitest run tests/backoffice-production-acceptance-smoke.test.ts
```

4. Produktionssprach-/Rueckfragenlogik, falls Rueckfragenprojektion beruehrt wird:

```bash
npx vitest run tests/production-language.test.ts
```

5. Optionaler lokaler Betriebscheck nur wenn der lokale Stack bewusst laeuft oder gestartet wird:

```bash
npm run local:check
```

Nicht als erster Pflichtcheck:

- kein kompletter E2E-Ausbau
- keine Browser-Automation neu einfuehren
- kein Deployment-Smoke

---

## Umsetzungshinweise fuer den naechsten Agenten

- Startpunkt: `backoffice-ui/src/App.tsx` Zeilenbereich der aktuellen Produktionsroute.
- Vergleichsmuster: `backoffice-ui/src/offer-workbench.tsx`.
- Styling Startpunkt: vorhandene Klassen in `backoffice-ui/src/styles.css`, insbesondere `offer-*`, `production-*`, `progressive-panel`, `secondary-workspace`.
- Nicht zuerst CSS perfektionieren. Erst semantische Struktur und Marker setzen.
- Den ersten Commit nach Umsetzung klein halten: neue Produktions-Workbench-Komponente plus minimaler Import/Render-Switch plus notwendiges CSS.
