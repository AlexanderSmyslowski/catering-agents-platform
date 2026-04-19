# P33 Minimaler interner Entscheidungsrahmen fuer Konsistenzfix-Vorrang vor weiterem Ausbau im MVP – Mini-Spezifikation

Status: Mini-Spezifikation v0.1 auf Basis des aktuellen Repo-Iststands
Stand: 2026-04-19

## 1. Zweck und Abgrenzung

Diese Mini-Spezifikation begrenzt den minimalen internen Entscheidungsrahmen dafuer, wann dokumentarische Konsistenzfixes im MVP der `AlexanderSmyslowski/catering-agents-platform` Vorrang vor weiterem Ausbau haben sollen.

Sie erfindet kein Review-Board, kein formales QA-System, kein Scoring- oder Freigabemodell und keine neue Produkt- oder Prozessfamilie. Ziel ist ausschliesslich, den kleinsten Rahmen festzuhalten, unter dem fehlerhafte Referenzen, unklare Repo-Bezüge oder inkonsistente memory-Fortschreibung zuerst bereinigt werden sollen, bevor weiter ausgebaut wird.

## 2. Bezug auf Pflichtenheft, MVP-Arbeitspakete, P29, P31 und memory

Grundlagen dieses Dokuments sind:
- `docs/product/PFLICHTENHEFT.md`
- `docs/product/MVP_ARBEITSPAKETE.md`
- `docs/product/P29_MINIMALER_INTERNE_ENTSCHEIDUNGSRAHMEN_AUSBAUPRIORISIERUNG_NACH_BEREINIGUNG_MVP_MINISPEZ.md`
- `docs/product/P31_MINIMALER_INTERNE_ENTSCHEIDUNGSRAHMEN_ZURUECKSTELLUNG_FUNKTIONSAUSBAU_ZUGUNSTEN_STABILISIERUNG_MVP_MINISPEZ.md`
- `memory.md`
- der aktuelle Repo-Iststand in den Test-/Build-/Smoke-Pfaden, in der Ausbaupriorisierung nach Bereinigung, in der Zurueckstellung von Funktionsausbau zugunsten von Stabilisierung sowie in den vorhandenen Export-/Audit-/Fallback-Bezuegen

Wesentliche Ableitung:
- Das Pflichtenheft beschreibt eine interne, nachvollziehbare Betriebsplattform mit operativen Artefakten.
- Die MVP-Arbeitspakete ordnen die naechsten kleinen Schritte konservativ.
- P29 ordnet die knappe Priorisierung kleiner Ausbauschritte nach Bereinigung ein.
- P31 ordnet die Zurueckstellung von Ausbau zugunsten von Stabilisierung ein.
- P33 begrenzt nun den kleinsten Entscheidungsrahmen dafuer, dass Konsistenzfixes vor weiterem Ausbau Vorrang erhalten koennen.
- `memory.md` bleibt der Kurzanker fuer konsolidierte Repo-Fakten und die laufende Projektfortschreibung.

## 3. Aktueller repo-gebundener Kontext

### 3.1 Bereits vorhanden

Im Repo sind bereits folgende Bausteine sichtbar:
- gruener automatisierter Vitest-Korridor
- reproduzierbarer `npm run build`-Pfad
- schmale UI-/Smoke-Grundlage fuer die Kernrouten
- Ausbaupriorisierung nach Bereinigung ueber P29
- Zurueckstellung von Funktionsausbau zugunsten von Stabilisierung ueber P31
- read-only Exportpfade fuer Angebot, Produktionsblatt und Einkaufsliste
- Review-/Audit-Sicht fuer interne Betriebs- und Kontrollnachweise
- manuelle Fallbacks und Datenkorrekturen als gesondert begrenzte Rahmen
- PR-/Commit-/Dokument-/memory-Fortschreibung als laufende repo-nahe Entscheidungs- und Aenderungsspur

### 3.2 Fuer den MVP ausreichend und verbindlich

Fuer den knappen Vorrang von Konsistenzfixes vor weiterem Ausbau ist im MVP verbindlich anzunehmen:
- die technische Basis ist ueber Test, Build und Smoke belastbar genug, um Ausbau nicht blind vorzuziehen
- die Doku- und memory-Lage ist so weit konsistent, dass echte Ausbaufragen von blosser Nachpflege trennbar sind
- die Einordnung aus P29 und P31 steht nicht im Widerspruch zu einer weiteren kleinen Konsistenzentscheidung
- der Stand kann intern weiterentwickelt werden, ohne dass dafuer ein formales Governance-, QA- oder Produktmanagement-Modell erforderlich wird
- PR, Doku und memory bleiben die kleinste tragende Dokumentationsspur fuer diese Vorrangentscheidung

### 3.3 Nach welchen wenigen Signalen Konsistenzfixes Vorrang vor weiterem Ausbau haben sollen

Konsistenzfixes sollen im MVP Vorrang haben, wenn mindestens eines dieser Signale klar vorliegt:
- eine Referenz im Repo oder in den Dokumenten zeigt auf einen falschen, fehlenden oder missverstaendlichen Bezug
- memory.md benoetigt eine knappe Korrektur, damit der Repo-Stand nicht falsch verdichtet wird
- eine Mini-Spezifikation stuetzt sich auf eine unklare oder nicht mehr passende Dokumentationsbasis
- der naechste Ausbau wuerde auf einer noch inkonsistenten Dokumentationslage aufbauen
- die naechste sachlich richtige Aenderung ist primaer Bereinigung und nicht neuer fachlicher Ausbau

### 3.4 Wann fehlerhafte Referenzen, unklare Repo-Bezüge oder inkonsistente memory-Fortschreibung zuerst bereinigt werden sollen

Vorrangige Bereinigung ist im MVP naheliegend, wenn:
- eine falsche oder fehlende Datei-Referenz den Repo-Stand unklar macht
- eine Dokumentstelle mehrdeutig wirkt, obwohl der eigentliche Fachrahmen bereits existiert
- memory den dokumentierten Stand nicht sauber genug zusammenfasst
- eine kleine Korrektur den anschliessenden Ausbau ehrlicher, lesbarer und belastbarer macht
- der Korrekturbedarf selbst keine neue Produktflaeche oeffnet

### 3.5 Wann kleiner weiterer Ausbau trotzdem noch vertretbar sein kann

Kleiner weiterer Ausbau kann trotz Konsistenzfix-Vorrang noch vertretbar sein, wenn:
- die Referenzen bereits sauber und eindeutig sind
- die verbleibende Aenderung klar fachlicher Ausbau und nicht blosse Bereinigung ist
- der Ausbau die laufende interne Nutzung direkt entlastet
- der Ausbau keine neue Produktfamilie, keine neuen Endpunkte und keine neue Persistenz erfordert
- PR, Doku und memory den Schritt ohne Widerspruch abbilden koennen

### 3.6 Wie mit Grenzfaellen knapp umgegangen werden soll

Grenzfaelle sollen im MVP bewusst klein und konservativ behandelt werden:
1. zuerst pruefen, ob der Schritt nur eine Referenz, Benennung oder memory-Konsistenz bereinigt
2. dann pruefen, ob die Dokumentationslage dadurch erst verlasslich genug fuer weiteren Ausbau wird
3. erst wenn ein eigenstaendiger kleiner Nutzwert klar erkennbar ist, kann der Punkt als Ausbau weiterverfolgt werden
4. im Zweifel eher Konsistenzfix als Ausbau annehmen

Wenn ein Schritt nur deshalb attraktiv wirkt, weil Doku oder memory noch nicht sauber sind, soll zuerst bereinigt werden.

### 3.7 Wie PR, Dokumente und memory fuer die knappe Vorrangentscheidung genutzt werden

Im bestehenden MVP-Rahmen gilt:
- PR dient als Ort fuer die sichtbare Aenderung oder Vorrangentscheidung
- Doku dient als Ort fuer die knappe fachliche Einordnung, warum Konsistenzfixe Vorrang haben
- `memory.md` dient als dauerhafte Verdichtung des beschlossenen Repo-Standes
- zusammen bilden sie die kleine Dokumentations- und Begrenzungsspur, ohne ein formales Governance-, QA- oder Freigabemodell zu ersetzen

### 3.8 Was im MVP bewusst noch kein formales Governance-, QA- oder Freigabemodell ist

Der minimale interne Entscheidungsrahmen fuer Konsistenzfix-Vorrang ist ausdruecklich noch kein formales Modell:
- kein Review-Board
- kein formales QA-System
- kein Scoring-/Freigabemodell
- kein Produktmanagement- oder Portfolio-System
- kein Release- oder Rollout-System
- keine neuen Endpunkte
- keine neue Persistenzlogik
- keine neue Produktfamilie

## 4. Kleinste MVP-Festlegung

### 4.1 Wann dokumentarische Konsistenzfixes im MVP eher priorisiert werden sollen

Dokumentarische Konsistenzfixes sollen im MVP eher priorisiert werden, wenn:
1. ein falscher, fehlender oder unklarer Repo-Bezug sichtbar ist
2. memory den vorhandenen Stand nicht sauber genug verdichtet
3. die naechste Aenderung den Dokumentationsrahmen erst belastbar macht, bevor neuer Ausbau sinnvoll ist
4. PR, Doku und memory den Schritt knapp und konsistent abbilden muessen
5. Test, Build, Smoke, Export, Audit oder Fallback dadurch nicht verschlechtert werden

### 4.2 Welche technischen, fachlichen und betrieblichen Signale zusammen ausreichend stark sein sollten

Ein Konsistenzfix ist fuer den MVP ausreichend stark, wenn:
- technische Signale zeigen, dass der Kernpfad weiterhin belastbar bleibt
- fachliche Signale zeigen, dass der dokumentierte Stand ehrlicher und eindeutiger wird
- betriebliche Signale zeigen, dass der Schritt klein und beherrschbar bleibt
- dokumentarische Signale zeigen, dass Referenz, Repo-Bezug und memory zusammenpassen
- der Schritt kein formales Governance-, QA- oder Freigabesystem braucht

### 4.3 Welche Restpunkte dabei noch tolerierbar sein koennen

Im MVP sind noch tolerierbar:
- kleine offene Fragen, sofern sie die Vorrangentscheidung nicht unklar machen
- kleine Doku- oder memory-Nachschliffe, wenn sie keine neue Produktflaeche oeffnen
- vereinzelte Rueckfragen zur Einordnung, solange sie die interne Priorisierung nicht blockieren
- kleine Nachschaerfungen an Begriffen oder Markierungen

### 4.4 Welche Auffaelligkeiten eher gegen einen Konsistenzfix-Vorrang sprechen

Eher gegen den Vorrang von Konsistenzfixes sprechen:
- offene Punkte mit echtem Blocker-Charakter fuer die laufende interne Nutzung
- eine bereits klare, belastbare und unstrittige Dokumentationslage
- ein Schritt, der nur formal sauber wirkt, aber keinen echten Referenz- oder Repo-Nutzen bringt
- ein Punkt, der als Bereinigung verkauft wird, aber faktisch neuer Ausbau ist
- Ausbau, der ohne Klarheit auf der Dokumentationsbasis einfach weiterlaufen wuerde

### 4.5 Wie PR, Dokumente und memory fuer die knappe Vorrangentscheidung genutzt werden

- PR dient als Ort fuer die sichtbare Aenderung oder Vorrangentscheidung
- Doku dient als Ort fuer die knappe fachliche Einordnung, warum zunaechst bereinigt wird
- `memory.md` dient als dauerhafte Verdichtung des beschlossenen Konsistenzstands

Wenn ein Schritt nicht sauber einordenbar ist, soll er lieber sichtbar offen bleiben, statt in ein neues formales System verschoben zu werden.

### 4.6 Was im MVP bewusst noch kein formales Regelwerk ist

Der minimale interne Vorrangrahmen ist ausdruecklich noch kein formales Regelwerk:
- kein Review-Board
- kein formales QA-System
- kein Scoring-/Freigabemodell
- kein Produktmanagement- oder Portfolio-System
- kein Release- oder Rollout-System
- keine neuen Endpunkte
- keine neue Persistenzlogik
- keine neue Produktfamilie

## 5. Klare Abgrenzung

Diese Mini-Spezifikation fuehrt ausdruecklich nicht ein:
- kein Review-Board
- kein formales QA-System
- kein Scoring-/Freigabemodell
- keine neuen Endpunkte
- keine neue Persistenzlogik
- keine neue Produktfamilie

Der Rahmen bleibt damit bewusst klein und an den vorhandenen Repo-Bausteinen orientiert.

## 6. Offene Punkte

Bewusst offen bleibt:
- ob spaeter zwischen Stabilisierung, Konsistenzfix, Nachziehen und echtem Produktausbau strenger getrennt werden muss
- wie weit ein spaeterer Betrieb formale Rollen fuer Beobachtung, Rueckfrage und Entscheidung braucht
- ob einzelne Vorrangkriterien spaeter in ein staerker strukturiertes Governance-, QA- oder Freigabemodell ueberfuehrt werden sollen
- welche Teile der heutigen PR-/Doku-/memory-Fortschreibung spaeter formalisiert werden muessen
- ob ein spaeterer Produkt- oder Betriebsausbau mehr Detailtiefe, mehr Automatisierung oder mehr Koordination verlangt

Diese Punkte sind noch nicht durch ein echtes Governance-, QA- oder Freigabemodell geklaert und sollen deshalb hier nicht vorweggenommen werden.

## 7. Empfohlener kleinster naechster Schritt

Der naechste Schritt sollte weiterhin nur Klaerung und Begrenzung sein, nicht Implementierung:
1. die hier genannten Minimalregeln als internen Referenzrahmen festhalten
2. die Grenze zwischen Konsistenzfix und weiterem Ausbau klar benennen
3. weitere Governance-, QA- oder Freigabestrukturen erst spaeter explizit beauftragen

## 8. Einordnung

Diese Mini-Spezifikation ist absichtlich konservativ.
Sie soll den minimalen internen Entscheidungsrahmen dafuer begrenzen, wann dokumentarische Konsistenzfixes vor weiterem Ausbau Vorrang haben, ohne ein formales Governance-, QA- oder Freigabemodell zu erfinden.

Alles darueber hinaus bleibt spaeteren, explizit beauftragten Schritten vorbehalten.
