# P30 Minimaler interner Abgrenzungsrahmen Stabilisierung vs Funktionsausbau im MVP – Mini-Spezifikation

Status: Mini-Spezifikation v0.1 auf Basis des aktuellen Repo-Iststands
Stand: 2026-04-19

## 1. Zweck und Abgrenzung

Diese Mini-Spezifikation begrenzt den minimalen internen Abgrenzungsrahmen zwischen Stabilisierung/Nachziehen und echtem neuem Funktionsausbau im MVP der `AlexanderSmyslowski/catering-agents-platform`.

Sie erfindet kein Scope-Board, kein formales Produktmanagement-System, kein Scoring-/Freigabemodell und keine neue Produkt- oder Prozessfamilie. Ziel ist ausschliesslich, den kleinsten Rahmen festzuhalten, unter dem weitere interne Schritte knapp als Stabilisierung, Nachziehen oder echter neuer Ausbau eingeordnet werden koennen.

## 2. Bezug auf Pflichtenheft, MVP-Arbeitspakete, P26, P27, P29 und Memory

Grundlagen dieses Dokuments sind:
- `docs/product/PFLICHTENHEFT.md`
- `docs/product/MVP_ARBEITSPAKETE.md`
- `docs/product/P26_MINIMALER_INTERNER_STABILISIERUNGSRAHMEN_IN_LAUFENDER_NUTZUNG_MVP_MINISPEZ.md`
- `docs/product/P27_MINIMALER_INTERNER_REAKTIONSRAHMEN_BEI_INSTABILITAET_IN_LAUFENDER_NUTZUNG_MVP_MINISPEZ.md`
- die P29-Dokumentationslinie zur Ausbaupriorisierung nach Bereinigung im MVP
- `memory.md`
- der aktuelle Repo-Iststand in den Test-/Build-/Smoke-Pfaden, dem Stabilisierungsrahmen, dem Reaktionsrahmen bei Instabilitaet, der Ausbaupriorisierung nach Bereinigung sowie den vorhandenen Export-/Audit-/Fallback-Bezuegen

Wesentliche Ableitung:
- Das Pflichtenheft beschreibt eine interne, nachvollziehbare Betriebsplattform mit operativen Artefakten.
- Die MVP-Arbeitspakete ordnen die naechsten kleinen Schritte konservativ.
- P26 ordnet den stabilen Grundzustand der laufenden internen Nutzung ein.
- P27 ordnet den Umgang mit ersten Instabilitaetssignalen ein.
- P29 ordnet die knappe Priorisierung weiterer kleiner Ausbauschritte nach Bereinigung ein.
- P30 begrenzt nun den kleinsten Abgrenzungsrahmen, damit Stabilisierung und echter Ausbau nicht vermischt werden.
- `memory.md` bleibt der Kurzanker fuer die konsolidierten Repo-Fakten und die laufende Projektfortschreibung.

## 3. Aktueller repo-gebundener Kontext

### 3.1 Bereits vorhanden

Im Repo sind bereits folgende Bausteine sichtbar:
- gruener automatisierter Vitest-Korridor
- reproduzierbarer `npm run build`-Pfad
- schmale UI-/Smoke-Grundlage fuer die Kernrouten
- Stabilisierungsrahmen in laufender Nutzung ueber P26
- Reaktionsrahmen bei Instabilitaet ueber P27
- Ausbaupriorisierung nach Bereinigung ueber P29
- read-only Exportpfade fuer Angebot, Produktionsblatt und Einkaufsliste
- Review-/Audit-Sicht fuer interne Betriebs- und Kontrollnachweise
- manuelle Fallbacks und Datenkorrekturen als gesondert begrenzte Rahmen
- PR-/Commit-/Dokument-/memory-Fortschreibung als laufende repo-nahe Entscheidungs- und Aenderungsspur

### 3.2 Fuer den MVP ausreichend und verbindlich

Fuer die knappe Abgrenzung zwischen Stabilisierung und echtem Ausbau ist im MVP verbindlich anzunehmen:
- die technische Basis ist ueber Test, Build und Smoke belastbar genug, um kleine Folgeentscheidungen nicht blind zu treffen
- die Einordnung aus P26 bis P29 steht nicht im Widerspruch zu einer weiteren kleinen Abgrenzungsentscheidung
- die Dokumentationslage ist so weit konsistent, dass echte Ausbauschritte von Stabilisierung und Nachziehen trennbar sind
- der Stand kann intern weiterentwickelt werden, ohne dass dafuer ein formales Produktfreigabe-, Scope- oder Governance-Modell erforderlich wird
- PR, Doku und memory bleiben die kleinste tragende Dokumentationsspur fuer diese Abgrenzungsbewertung

### 3.3 Welche wenigen Merkmale einen Schritt noch als Stabilisierung oder Nachziehen erscheinen lassen sollen

Ein Schritt soll im MVP noch als Stabilisierung oder Nachziehen gelten, wenn er mindestens eines dieser Merkmale klar erfuellt:
- er macht einen bereits vorhandenen Kernpfad robuster oder ruhiger
- er schliesst einen bekannten Restpunkt oder eine dokumentarische Luecke
- er behebt eine Inkonsistenz zwischen Doku, memory und Repo-Iststand
- er veraendert keine neue fachliche oder betriebliche Oberflaeche, sondern schaerft nur den vorhandenen Stand
- er stuetzt Test, Build, Smoke, Export, Audit oder Fallback, statt eine neue Nutzungslogik zu oeffnen

### 3.4 Wann ein Schritt eher als echter neuer Funktionsausbau einzuordnen ist

Ein Schritt ist eher als echter neuer Funktionsausbau einzuordnen, wenn er:
- eine neue fachliche Faehigkeit oder einen neuen Nutzerzweck sichtbar macht
- einen neuen Ablauf benoetigt, der nicht mehr nur bestehende Bausteine stabilisiert
- ueber den bisherigen README-/Pflichtenheft-/MVP-Rahmen hinaus eine neue, kleine Produktflaeche oeffnet
- eine neue operative Erwartung erzeugt, die nicht mehr bloesse Bereinigung oder Absicherung ist
- inhaltlich mehr ist als Doku-, memory- oder Konsistenzpflege

### 3.5 Wie mit Grenzfaellen knapp umgegangen werden soll

Grenzfaelle sollen im MVP bewusst klein und konservativ behandelt werden:
1. zuerst pruefen, ob der Schritt nur eine bestehende Funktion absichert, statt eine neue zu schaffen
2. dann pruefen, ob der Schritt in Wahrheit nur Nachziehbedarf oder Dokumentationskonsistenz beseitigt
3. erst wenn ein eigenstaendiger neuer Nutzen oder eine neue fachliche Faehigkeit klar erkennbar ist, als echter Funktionsausbau einordnen
4. im Zweifel eher Stabilisierung/Nachziehen als stillen Funktionsausbau annehmen

Wenn ein Schritt nur dann sinnvoll wirkt, weil Dokumentation oder memory noch nicht sauber sind, soll er nicht als neuer Funktionsausbau gerahmt werden.

### 3.6 Welche Arten von Schritten im aktuellen MVP eher zurueckhaltend behandelt werden sollen

Eher zurueckhaltend behandelt werden sollen:
- Schritte, die neue Produktflaechen oeffnen statt den vorhandenen Kern zu stabilisieren
- Schritte, die nur einen formalen Rahmen erzeugen, aber keinen direkten Nutzwert fuer die laufende interne Nutzung haben
- Schritte, die neue Endpunkte, neue Persistenz oder neue Prozessfamilien verlangen wuerden
- Schritte, die eigentlichen Nachziehbedarf als scheinbar neue Initiative tarnen
- Schritte, die ein formales Produktfreigabe-, Scope- oder Governance-Modell voraussetzen wuerden

### 3.7 Rolle von PR, Dokumenten und memory

Im bestehenden MVP-Rahmen gilt:
- PRs halten die konkrete Aenderung und die sichtbare Abgrenzungsentscheidung fest
- Doku haelt die fachliche Einordnung fest, ob ein Schritt Stabilisierung, Nachziehen oder echter Ausbau ist
- `memory.md` haelt den konsolidierten, dauerhaften Repo-Stand fest
- zusammen bilden sie die kleine Abgrenzungs- und Begrenzungsspur, ohne ein formales Produktfreigabe-, Scope- oder Governance-System zu ersetzen

## 4. Kleinste MVP-Festlegung

### 4.1 Wann ein Schritt im MVP noch als Stabilisierung oder Nachziehen gelten soll

Ein Schritt soll im MVP noch als Stabilisierung oder Nachziehen gelten, wenn:
1. er den vorhandenen internen Nutzungsstand direkt entlastet oder absichert
2. er einen echten Nachzieh- oder Konsistenzbedarf im Repo beseitigt
3. er keine neue fachliche Faehigkeit sichtbar macht
4. er Test, Build, Smoke, Export, Audit oder Fallback nicht verschlechtert
5. PR, Doku und memory die Abgrenzungsentscheidung knapp und konsistent abbilden

### 4.2 Wann ein Schritt eher als echter neuer Funktionsausbau gilt

Ein Schritt ist eher neuer Funktionsausbau, wenn:
- er eine neue fachliche Aussage, Rolle oder Oberflaeche einfuehrt
- er ueber das Absichern und Bereinigen des Vorhandenen hinausgeht
- er eine neue kleine Produktflaeche oder einen neuen Bedienzweck schafft
- er ohne die bisherige Abgrenzung nicht mehr als blosse Stabilisierung begruendet werden kann

### 4.3 Wie Grenzfaelle knapp behandelt werden sollen

Grenzfaelle sollen im MVP knapp so behandelt werden:
- wenn die Wirkung vor allem Absicherung, Beruhigung oder Bereinigung ist, eher Stabilisierung/Nachziehen
- wenn die Wirkung vor allem eine neue fachliche Faehigkeit oder Oberflaeche ist, eher echter Ausbau
- wenn die Wirkung unklar bleibt, sichtbar offen halten statt vorschnell in Ausbau umzudeuten

### 4.4 Welche Schritte eher zurueckhaltend behandelt werden sollen

Zurueckhaltend behandelt werden sollen insbesondere:
- neue Produktflaechen ohne unmittelbaren internen Nutzen
- neue Endpunkte oder neue Persistenz, die den jetzigen Kern nicht nur schaerfen, sondern erweitern
- neue Prozessfamilien oder Freigabemodelle
- Schritte, die nur deshalb gross wirken, weil die Dokumentation noch nicht sauber ist

### 4.5 Wie PR, Dokumente und memory fuer die knappe Abgrenzungsentscheidung genutzt werden

- PR dient als Ort fuer die sichtbare Aenderung oder Abgrenzungsentscheidung
- Doku dient als Ort fuer die knappe fachliche Einordnung des Schritts
- `memory.md` dient als dauerhafte Verdichtung des beschlossenen Abgrenzungsrahmens

Wenn ein Schritt nicht sauber einordenbar ist, soll er lieber sichtbar offen bleiben, statt in ein neues formales System verschoben zu werden.

### 4.6 Was im MVP bewusst noch kein formales Produktfreigabe-, Scope- oder Governance-Modell ist

Der minimale interne Abgrenzungsrahmen ist ausdruecklich noch kein formales Modell:
- kein Scope-Board
- kein formales Produktmanagement-System
- kein Scoring-/Freigabemodell
- kein Release- oder Rollout-System
- keine neuen Endpunkte
- keine neue Persistenzlogik
- keine neue Produktfamilie

## 5. Klare Abgrenzung

Diese Mini-Spezifikation fuehrt ausdruecklich nicht ein:
- kein Scope-Board
- kein formales Produktmanagement-System
- kein Scoring-/Freigabemodell
- keine neuen Endpunkte
- keine neue Persistenzlogik
- keine neue Produktfamilie

Der Abgrenzungsrahmen bleibt damit bewusst klein und an den vorhandenen Repo-Bausteinen orientiert.

## 6. Offene Punkte

Bewusst offen bleibt:
- ob spaeter zwischen Stabilisierung, Nachziehen und echtem Funktionsausbau strenger getrennt werden muss
- wie weit ein spaeterer Betrieb formale Rollen fuer Beobachtung, Rueckfrage und Entscheidung braucht
- ob einzelne Abgrenzungskriterien spaeter in ein staerker strukturiertes Produktfreigabe-, Scope- oder Governance-Modell ueberfuehrt werden sollen
- welche Teile der heutigen PR-/Doku-/memory-Fortschreibung spaeter formalisiert werden muessen
- ob ein spaeterer Produkt- oder Betriebsausbau mehr Detailtiefe, mehr Automatisierung oder mehr Koordination verlangt

Diese Punkte sind noch nicht durch ein echtes Produktfreigabe-, Scope- oder Governance-Modell geklaert und sollen deshalb hier nicht vorweggenommen werden.

## 7. Empfohlener kleinster naechster Schritt

Der naechste Schritt sollte weiterhin nur Klärung und Begrenzung sein, nicht Implementierung:
1. die hier genannten Minimalregeln als internen Referenzrahmen festhalten
2. die Grenze zwischen Stabilisierung/Nachziehen und echtem Funktionsausbau klar benennen
3. weitere Produktfreigabe-, Scope- oder Governance-Strukturen erst spaeter explizit beauftragen

## 8. Einordnung

Diese Mini-Spezifikation ist absichtlich konservativ.
Sie soll den minimalen internen Abgrenzungsrahmen zwischen Stabilisierung und echtem Funktionsausbau fachlich begrenzen, ohne ein formales Produktfreigabe-, Scope- oder Governance-Modell zu erfinden.

Alles darueber hinaus bleibt spaeteren, explizit beauftragten Schritten vorbehalten.
