# P29 Minimaler interner Entscheidungsrahmen zur Ausbaupriorisierung nach Bereinigung im MVP – Mini-Spezifikation

Status: Mini-Spezifikation v0.1 auf Basis des aktuellen Repo-Iststands
Stand: 2026-04-19

## 1. Zweck und Abgrenzung

Diese Mini-Spezifikation begrenzt den minimalen internen Entscheidungsrahmen fuer die weitere Ausbaupriorisierung nach der dokumentarischen Bereinigung im MVP der `AlexanderSmyslowski/catering-agents-platform`.

Sie erfindet kein Priorisierungsboard, kein formales Produktmanagement-System, kein Portfolio-Modell, kein Scoring-/KPI-System und keine neue Produkt- oder Prozessfamilie. Ziel ist ausschliesslich, den kleinsten Rahmen festzuhalten, unter dem weitere kleine Ausbauschritte intern knapp priorisiert werden koennen.

## 2. Bezug auf Pflichtenheft, MVP-Arbeitspakete, P25, P26, P27 und Memory

Grundlagen dieses Dokuments sind:
- `docs/product/PFLICHTENHEFT.md`
- `docs/product/MVP_ARBEITSPAKETE.md`
- `docs/product/P25_MINIMALER_INTERNER_NUTZUNGSRAHMEN_NACH_BETA_UEBERGABE_MVP_MINISPEZ.md`
- `docs/product/P26_MINIMALER_INTERNER_STABILISIERUNGSRAHMEN_IN_LAUFENDER_NUTZUNG_MVP_MINISPEZ.md`
- `docs/product/P27_MINIMALER_INTERNER_REAKTIONSRAHMEN_BEI_INSTABILITAET_IN_LAUFENDER_NUTZUNG_MVP_MINISPEZ.md`
- `memory.md`
- der aktuelle Repo-Iststand in den Test-/Build-/Smoke-Pfaden, der laufenden internen Nutzung nach Beta-UEbergabe, dem Stabilisierungsrahmen, dem Reaktionsrahmen bei Instabilitaet sowie den vorhandenen Export-/Audit-/Fallback-Bezuegen

Wesentliche Ableitung:
- Das Pflichtenheft beschreibt eine interne, nachvollziehbare Betriebsplattform mit operativen Artefakten.
- Die MVP-Arbeitspakete ordnen die naechsten kleinen Schritte konservativ.
- P25 ordnet die laufende interne Nutzung nach Beta-UEbergabe ein.
- P26 ordnet den stabilen Grundzustand dieser laufenden Nutzung ein.
- P27 ordnet den Umgang mit ersten Instabilitaetssignalen ein.
- P29 begrenzt nun den kleinsten Entscheidungsrahmen fuer die weitere Priorisierung kleiner Ausbauschritte nach dieser Bereinigung.
- `memory.md` bleibt der Kurzanker fuer die konsolidierten Repo-Fakten und die laufende Projektfortschreibung.

## 3. Aktueller repo-gebundener Kontext

### 3.1 Bereits vorhanden

Im Repo sind bereits folgende Bausteine sichtbar:
- gruener automatisierter Vitest-Korridor
- reproduzierbarer `npm run build`-Pfad
- schmale UI-/Smoke-Grundlage fuer die Kernrouten
- laufende interne Nutzung ueber P25
- Stabilisierungsrahmen in laufender Nutzung ueber P26
- Reaktionsrahmen bei Instabilitaet ueber P27
- read-only Exportpfade fuer Angebot, Produktionsblatt und Einkaufsliste
- Review-/Audit-Sicht fuer interne Betriebs- und Kontrollnachweise
- manuelle Fallbacks und Datenkorrekturen als gesondert begrenzte Rahmen
- PR-/Commit-/Dokument-/memory-Fortschreibung als laufende repo-nahe Entscheidungs- und Aenderungsspur

### 3.2 Fuer den MVP ausreichend und verbindlich

Fuer die knappe Ausbaupriorisierung im MVP ist verbindlich anzunehmen:
- die technische Basis ist ueber Test, Build und Smoke belastbar genug, um kleine Folgeentscheidungen nicht blind zu treffen
- die Einordnung aus P25 bis P27 steht nicht im Widerspruch zu einer weiteren kleinen Priorisierung
- die Dokumentationsbereinigung ist so weit konsistent, dass echte Ausbaufragen von blosser Nachpflege trennbar sind
- der Stand kann intern weiterentwickelt werden, ohne dass dafuer ein formales Produktmanagement-, Portfolio- oder Governance-Modell erforderlich wird
- PR, Doku und memory bleiben die kleinste tragende Dokumentationsspur fuer diese Priorisierungsbewertung

### 3.3 Welche wenigen Kriterien fuer weitere kleine Ausbauschritte gelten sollen

Weitere kleine Ausbauschritte sollen im MVP nur dann priorisiert werden, wenn sie mindestens eines dieser Kriterien klar erfuellen:
- sie stabilisieren einen bereits vorhandenen Kernpfad oder machen ihn robuster
- sie ziehen einen dokumentarischen oder fachlichen Restpunkt nach, der den Repo-Stand sauberer und belastbarer macht
- sie beseitigen eine erkannte Inkonsistenz zwischen Dokumenten, memory und Repo-Iststand
- sie bringen einen echten, kleinen Zusatznutzen fuer die laufende interne Nutzung, ohne neue Produktflaechen zu oeffnen

### 3.4 Wie zwischen Stabilisierung, Nachziehbedarf, Dokumentationskonsistenz und echtem neuem Ausbau zu unterscheiden ist

Die Priorisierung soll bewusst klein bleiben:
1. zuerst pruefen, ob ein Punkt Stabilisierung betrifft: also Test, Build, Smoke, Export, Audit, Fallback oder Reaktionssicherheit
2. dann pruefen, ob ein Punkt reiner Nachziehbedarf ist: also eine noch offene, aber bekannte Bereinigung oder Begrenzung
3. dann pruefen, ob ein Punkt nur Dokumentationskonsistenz betrifft: also Doku, Referenz, Benennung oder memory-Abgleich
4. erst danach pruefen, ob wirklich neuer Ausbau vorliegt: also ein kleiner echter Zusatznutzen, der noch nicht vorhanden ist und nicht nur nachgezogen wird

Wenn ein Punkt nur Dokumentationskonsistenz oder Nachziehbedarf ist, soll er nicht als neuer Ausbau gerahmt werden.

### 3.5 Welche Arten von Ausbau aktuell eher nachrangig sein sollen

Eher nachrangig sind im MVP:
- Ausbau, der neue Produktflaechen oeffnet statt den vorhandenen Kern zu stabilisieren
- Ausbau, der nur einen formalen Rahmen erzeugt, aber keinen direkten Nutzwert fuer die laufende interne Nutzung hat
- Ausbau, der neue Endpunkte, neue Persistenz oder neue Prozessfamilien verlangen wuerde
- Ausbau, der eigentlichen Nachziehbedarf nur als scheinbar neue Initiative tarnt
- Ausbau, der ein formales Produktmanagement-, Portfolio- oder Governance-System voraussetzen wuerde

### 3.6 Rolle von PR, Dokumenten und memory

Im bestehenden MVP-Rahmen gilt:
- PRs halten die konkrete Aenderung und die sichtbare Priorisierungsentscheidung fest
- Doku haelt die fachliche Einordnung fest, ob ein Punkt Stabilisierung, Nachziehbedarf, Konsistenz oder echter Ausbau ist
- `memory.md` haelt den konsolidierten, dauerhaften Repo-Stand fest
- zusammen bilden sie die kleine Priorisierungs- und Begrenzungsspur, ohne ein formales Produktmanagement- oder Governance-System zu ersetzen

## 4. Kleinste MVP-Festlegung

### 4.1 Wann ein kleiner Punkt im MVP eher priorisiert werden soll

Ein kleiner Punkt soll im MVP eher priorisiert werden, wenn:
1. er den vorhandenen internen Nutzungsstand direkt entlastet oder absichert
2. er einen echten Nachzieh- oder Konsistenzbedarf im Repo beseitigt
3. er nicht nur Dokumentation verdichtet, sondern einen spuerbaren kleinen Nutzen fuer die laufende Nutzung bringt
4. er Test, Build, Smoke, Export, Audit oder Fallback nicht verschlechtert
5. PR, Doku und memory die Priorisierungsentscheidung knapp und konsistent abbilden

### 4.2 Welche technischen, fachlichen und betrieblichen Signale zusammen ausreichend stark sein sollten

Ein Punkt ist fuer den MVP ausreichend stark, wenn:
- technische Signale zeigen, dass der Kernpfad belastbar bleibt
- fachliche Signale zeigen, dass der Nutzen oder die Begrenzung klar ist
- betriebliche Signale zeigen, dass die Auswirkung klein und beherrschbar bleibt
- dokumentarische Signale zeigen, dass die Einordnung sauber und nachvollziehbar ist
- der Punkt keinen formalen Priorisierungs-, Portfolio- oder Steuerungsapparat braucht

### 4.3 Welche Restpunkte dabei noch tolerierbar sein koennen

Im MVP sind noch tolerierbar:
- kleine offene Fragen, sofern sie die Priorisierungsrichtung nicht unklar machen
- kleine Doku- oder memory-Nachschliffe, wenn sie keinen echten Ausbau darstellen
- vereinzelte Rueckfragen zur Einordnung, solange sie die interne Priorisierung nicht blockieren
- kleine Nachschaerfungen an Begriffen oder Markierungen

### 4.4 Welche Auffaelligkeiten eher gegen eine Priorisierung sprechen

Eher gegen eine Priorisierung sprechen:
- offene Punkte mit Grundblocker-Charakter
- unklare oder widerspruechliche Repo-Referenzen
- ein Punkt, der nur deshalb attraktiv wirkt, weil Dokumentation oder memory noch nicht sauber ist
- ein Punkt, der bereits ein formales Produktmanagement-, Portfolio- oder Governance-Modell verlangen wuerde
- Ausbau, der ohne klaren internen Nutzwert neue Flaeche erzeugt

### 4.5 Wie PR, Dokumente und memory fuer die knappe Priorisierungsentscheidung genutzt werden

- PR dient als Ort fuer die sichtbare Aenderung oder Priorisierungsentscheidung
- Doku dient als Ort fuer die knappe fachliche Einordnung des Punktes
- `memory.md` dient als dauerhafte Verdichtung des beschlossenen Priorisierungsrahmens

Wenn ein Punkt nicht sauber einordenbar ist, soll er lieber sichtbar offen bleiben, statt in ein neues formales System verschoben zu werden.

### 4.6 Was im MVP bewusst noch kein formales Produktmanagement-, Portfolio- oder Governance-Modell ist

Der minimale interne Entscheidungsrahmen zur Ausbaupriorisierung ist ausdruecklich noch kein formales Modell:
- kein Priorisierungsboard
- kein formales Produktmanagement-System
- kein Scoring-/KPI-Modell
- kein Portfolio-Modell
- kein Release- oder Rollout-System
- keine neuen Endpunkte
- keine neue Persistenzlogik
- keine neue Produktfamilie

## 5. Klare Abgrenzung

Diese Mini-Spezifikation fuehrt ausdruecklich nicht ein:
- kein Priorisierungsboard
- kein formales Produktmanagement-System
- kein Scoring-/KPI-Modell
- keine neuen Endpunkte
- keine neue Persistenzlogik
- keine neue Produktfamilie

Der Entscheidungsrahmen bleibt damit bewusst klein und an den vorhandenen Repo-Bausteinen orientiert.

## 6. Offene Punkte

Bewusst offen bleibt:
- ob spaeter zwischen Stabilisierung, Nachpflege, Dokumentationspflege und echtem Produktausbau strenger getrennt werden muss
- wie weit ein spaeterer Betrieb formale Rollen fuer Beobachtung, Rueckfrage und Entscheidung braucht
- ob einzelne Priorisierungskriterien spaeter in ein staerker strukturiertes Produktmanagement-, Portfolio- oder Governance-Modell ueberfuehrt werden sollen
- welche Teile der heutigen PR-/Doku-/memory-Fortschreibung spaeter formalisiert werden muessen
- ob ein spaeterer Produkt- oder Betriebsausbau mehr Detailtiefe, mehr Automatisierung oder mehr Koordination verlangt

Diese Punkte sind noch nicht durch ein echtes Produktmanagement-, Portfolio- oder Governance-Modell geklaert und sollen deshalb hier nicht vorweggenommen werden.

## 7. Empfohlener kleinster naechster Schritt

Der naechste Schritt sollte weiterhin nur Klärung und Begrenzung sein, nicht Implementierung:
1. die hier genannten Minimalregeln als internen Referenzrahmen festhalten
2. die Grenze zwischen Stabilisierung, Nachziehbedarf, Dokumentationskonsistenz und echtem Ausbau klar benennen
3. weitere Produktmanagement-, Portfolio- oder Governance-Strukturen erst spaeter explizit beauftragen

## 8. Einordnung

Diese Mini-Spezifikation ist absichtlich konservativ.
Sie soll den minimalen internen Entscheidungsrahmen zur Ausbaupriorisierung nach der Bereinigung fachlich begrenzen, ohne ein formales Produktmanagement-, Portfolio- oder Governance-Modell zu erfinden.

Alles darueber hinaus bleibt spaeteren, explizit beauftragten Schritten vorbehalten.
