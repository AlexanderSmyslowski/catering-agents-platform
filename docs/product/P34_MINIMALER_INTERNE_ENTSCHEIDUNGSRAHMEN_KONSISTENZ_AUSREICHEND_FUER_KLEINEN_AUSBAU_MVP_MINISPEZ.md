# P34 Minimaler interner Entscheidungsrahmen fuer ausreichend hergestellte dokumentarische Konsistenz zum wieder kleinen Ausbau im MVP – Mini-Spezifikation

Status: Mini-Spezifikation v0.1 auf Basis des aktuellen Repo-Iststands
Stand: 2026-04-19

## 1. Zweck und Abgrenzung

Diese Mini-Spezifikation begrenzt den minimalen internen Entscheidungsrahmen dafuer, wann nach dokumentarischen Konsistenzfixes im MVP der `AlexanderSmyslowski/catering-agents-platform` wieder kleiner Ausbau vertretbar ist.

Sie erfindet kein Review-Board, kein formales QA-System, kein Scoring- oder Freigabemodell und keine neue Produkt- oder Prozessfamilie. Ziel ist ausschliesslich, den kleinsten Rahmen festzuhalten, unter dem dokumentarische Konsistenz als ausreichend hergestellt gelten kann, um wieder einen kleinen, klar begrenzten Ausbau zuzulassen.

## 2. Bezug auf Pflichtenheft, MVP-Arbeitspakete, P31, P33 und memory

Grundlagen dieses Dokuments sind:
- `docs/product/PFLICHTENHEFT.md`
- `docs/product/MVP_ARBEITSPAKETE.md`
- `docs/product/P31_MINIMALER_INTERNE_ENTSCHEIDUNGSRAHMEN_ZURUECKSTELLUNG_FUNKTIONSAUSBAU_ZUGUNSTEN_STABILISIERUNG_MVP_MINISPEZ.md`
- `docs/product/P33_MINIMALER_INTERNE_ENTSCHEIDUNGSRAHMEN_KONSISTENZFIX_VORRANG_VOR_AUSBAU_MVP_MINISPEZ.md`
- `memory.md`
- der aktuelle Repo-Iststand in den Test-/Build-/Smoke-Pfaden, in der Zurueckstellung von Funktionsausbau zugunsten von Stabilisierung, im Vorrang von Konsistenzfixes vor weiterem Ausbau sowie in den vorhandenen Export-/Audit-/Fallback-Bezuegen

Wesentliche Ableitung:
- Das Pflichtenheft beschreibt eine interne, nachvollziehbare Betriebsplattform mit operativen Artefakten.
- Die MVP-Arbeitspakete ordnen die naechsten kleinen Schritte konservativ.
- P31 ordnet die Zurueckstellung von Ausbau zugunsten von Stabilisierung ein.
- P33 ordnet den Vorrang von Konsistenzfixes vor weiterem Ausbau ein.
- P34 begrenzt nun den kleinsten Entscheidungsrahmen dafuer, wann die dokumentarische Konsistenz wieder als ausreichend gelten kann, um einen kleinen Ausbau zuzulassen.
- `memory.md` bleibt der Kurzanker fuer konsolidierte Repo-Fakten und die laufende Projektfortschreibung.

## 3. Aktueller repo-gebundener Kontext

### 3.1 Bereits vorhanden

Im Repo sind bereits folgende Bausteine sichtbar:
- gruener automatisierter Vitest-Korridor
- reproduzierbarer `npm run build`-Pfad
- schmale UI-/Smoke-Grundlage fuer die Kernrouten
- Zurueckstellung von Funktionsausbau zugunsten von Stabilisierung ueber P31
- Vorrang von Konsistenzfixes vor weiterem Ausbau ueber P33
- read-only Exportpfade fuer Angebot, Produktionsblatt und Einkaufsliste
- Review-/Audit-Sicht fuer interne Betriebs- und Kontrollnachweise
- manuelle Fallbacks und Datenkorrekturen als gesondert begrenzte Rahmen
- PR-/Commit-/Dokument-/memory-Fortschreibung als laufende repo-nahe Entscheidungs- und Aenderungsspur

### 3.2 Fuer den MVP ausreichend und verbindlich

Fuer die knappe Rueckkehr zu kleinem Ausbau ist im MVP verbindlich anzunehmen:
- die technische Basis ist ueber Test, Build und Smoke belastbar genug, um kleinen Ausbau nicht blind vorzuziehen
- die Doku- und memory-Lage ist so weit konsistent, dass Bereinigung und echter kleiner Ausbau unterscheidbar sind
- die Einordnung aus P31 und P33 steht nicht im Widerspruch zu einer anschliessenden kleinen Ausbauentscheidung
- der Stand kann intern weiterentwickelt werden, ohne dass dafuer ein formales Governance-, QA- oder Produktmanagement-Modell erforderlich wird
- PR, Doku und memory bleiben die kleinste tragende Dokumentationsspur fuer diese Freigabe zum kleinen Ausbau

### 3.3 Nach welchen wenigen Signalen dokumentarische Konsistenz als ausreichend hergestellt gelten kann

Dokumentarische Konsistenz kann im MVP als ausreichend hergestellt gelten, wenn mindestens eines dieser Signale klar vorliegt:
- die relevanten Referenzen im Repo und in den Dokumenten zeigen wieder auf einen eindeutigen, vorhandenen Bezug
- memory.md ist knapp so fortgeschrieben, dass der Repo-Stand nicht mehr falsch verdichtet wird
- die Mini-Spezifikation baut nicht mehr auf einer unklaren oder fehlenden Referenzbasis auf
- die naechste Aenderung ist fachlich sauber als kleiner Ausbau beschreibbar und nicht mehr als Bereinigung
- die verbleibenden Unklarheiten sind nur noch klein und blockieren die Einordnung nicht mehr

### 3.4 Wann fehlerhafte Referenzen, unklare Repo-Bezüge oder inkonsistente memory-Fortschreibung als ausreichend bereinigt gelten

Als ausreichend bereinigt gelten diese Punkte im MVP, wenn:
- die falsche oder fehlende Datei-Referenz nicht mehr den Repo-Stand unklar macht
- eine Dokumentstelle zwar noch bewusst klein bleibt, aber nicht mehr missverstaendlich auf ein fehlendes Artefakt verweist
- memory den dokumentierten Stand sauber genug zusammenfasst, damit der naechste Schritt nicht auf einer falschen Verdichtung aufbaut
- eine kleine Korrektur den anschliessenden Ausbau nicht mehr als Bereinigung tarnt
- die Restunsicherheit nur noch so klein ist, dass sie den kleinen Ausbau nicht materiell blockiert

### 3.5 Wann kleiner weiterer Ausbau danach wieder vertretbar ist

Kleiner weiterer Ausbau kann im MVP wieder vertretbar sein, wenn:
- Referenzen, Repo-Bezug und memory zusammen wieder eindeutig sind
- die verbleibende Aenderung klar fachlicher Ausbau und nicht mehr Bereinigung ist
- der Ausbau die laufende interne Nutzung direkt entlastet oder verstaerkt
- der Ausbau keine neue Produktfamilie, keine neuen Endpunkte und keine neue Persistenz erfordert
- PR, Doku und memory den Schritt ohne Widerspruch abbilden koennen

### 3.6 Wie mit Grenzfaellen knapp umgegangen werden soll

Grenzfaelle sollen im MVP bewusst klein und konservativ behandelt werden:
1. zuerst pruefen, ob der Schritt noch eine Referenz, Benennung oder memory-Konsistenz bereinigt
2. dann pruefen, ob die Dokumentationslage dadurch bereits belastbar genug fuer kleinen Ausbau ist
3. erst wenn ein eigenstaendiger kleiner Nutzwert klar erkennbar ist, kann der Punkt als Ausbau weiterverfolgt werden
4. im Zweifel lieber noch konsolidieren als zu frueh wieder ausbauen

Wenn ein Schritt nur deshalb attraktiv wirkt, weil Doku oder memory noch unsauber sind, soll zuerst weiter bereinigt werden.

### 3.7 Wie PR, Dokumente und memory fuer die knappe Freigabe zum kleinen Ausbau genutzt werden

Im bestehenden MVP-Rahmen gilt:
- PR dient als Ort fuer die sichtbare Aenderung oder Freigabeentscheidung
- Doku dient als Ort fuer die knappe fachliche Einordnung, warum der naechste kleine Ausbau wieder vertretbar ist
- `memory.md` dient als dauerhafte Verdichtung des beschlossenen Repo-Standes
- zusammen bilden sie die kleine Dokumentations- und Begrenzungsspur, ohne ein formales Governance-, QA- oder Freigabemodell zu ersetzen

### 3.8 Was im MVP bewusst noch kein formales Governance-, QA- oder Freigabemodell ist

Der minimale interne Entscheidungsrahmen fuer die Rueckkehr zu kleinem Ausbau ist ausdruecklich noch kein formales Modell:
- kein Review-Board
- kein formales QA-System
- kein Scoring-/Freigabemodell
- kein Produktmanagement- oder Portfolio-System
- kein Release- oder Rollout-System
- keine neuen Endpunkte
- keine neue Persistenzlogik
- keine neue Produktfamilie

## 4. Kleinste MVP-Festlegung

### 4.1 Wann dokumentarische Konsistenz im MVP eher als ausreichend hergestellt gelten soll

Dokumentarische Konsistenz soll im MVP eher als ausreichend hergestellt gelten, wenn:
1. ein frueher unklarer Repo-Bezug nun eindeutig und vorhanden ist
2. memory den vorhandenen Stand nicht mehr falsch verdichtet
3. die naechste Aenderung den Dokumentationsrahmen nicht mehr erst reparieren muss, bevor kleiner Ausbau sinnvoll ist
4. PR, Doku und memory den Schritt knapp und konsistent abbilden muessen
5. Test, Build, Smoke, Export, Audit oder Fallback dadurch nicht verschlechtert werden

### 4.2 Welche technischen, fachlichen und betrieblichen Signale zusammen ausreichend stark sein sollten

Eine Rueckkehr zu kleinem Ausbau ist fuer den MVP ausreichend stark, wenn:
- technische Signale zeigen, dass der Kernpfad weiterhin belastbar bleibt
- fachliche Signale zeigen, dass der kleine Ausbau den Bestand sinnvoll entlastet oder verstaerkt
- betriebliche Signale zeigen, dass der Schritt klein und beherrschbar bleibt
- dokumentarische Signale zeigen, dass Referenz, Repo-Bezug und memory zusammenpassen
- der Schritt kein formales Governance-, QA- oder Freigabesystem braucht

### 4.3 Welche Restpunkte dabei noch tolerierbar sein koennen

Im MVP sind noch tolerierbar:
- kleine offene Fragen, sofern sie die Einordnung nicht wieder unklar machen
- kleine Doku- oder memory-Nachschliffe, wenn sie keine neue Produktflaeche oeffnen
- vereinzelte Rueckfragen zur Einordnung, solange sie die interne Priorisierung nicht blockieren
- kleine Nachschaerfungen an Begriffen oder Markierungen

### 4.4 Welche Auffaelligkeiten eher gegen eine Rueckkehr zu kleinem Ausbau sprechen

Eher gegen eine Rueckkehr zu kleinem Ausbau sprechen:
- offene Punkte mit echtem Blocker-Charakter fuer die laufende interne Nutzung
- eine noch immer unklare oder widerspruechliche Dokumentationslage
- ein Schritt, der nur formal wie Ausbau wirkt, aber wieder nur Bereinigung ist
- ein Schritt, der ohne Klarheit auf der Dokumentationsbasis einfach weiterlaufen wuerde
- ein Ausbau, der neue Produktflaechen, neue Endpunkte oder neue Persistenz verlangen wuerde

### 4.5 Wie PR, Dokumente und memory fuer die knappe Freigabe genutzt werden

- PR dient als Ort fuer die sichtbare Aenderung oder Freigabeentscheidung
- Doku dient als Ort fuer die knappe fachliche Einordnung, warum der kleine Ausbau wieder vertretbar ist
- `memory.md` dient als dauerhafte Verdichtung des beschlossenen Konsistenz- und Freigabestands

Wenn ein Schritt nicht sauber einordenbar ist, soll er lieber sichtbar offen bleiben, statt in ein neues formales System verschoben zu werden.

### 4.6 Was im MVP bewusst noch kein formales Regelwerk ist

Der minimale interne Freigaberahmen ist ausdruecklich noch kein formales Regelwerk:
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
- ob einzelne Freigabekriterien spaeter in ein staerker strukturiertes Governance-, QA- oder Freigabemodell ueberfuehrt werden sollen
- welche Teile der heutigen PR-/Doku-/memory-Fortschreibung spaeter formalisiert werden muessen
- ob ein spaeterer Produkt- oder Betriebsausbau mehr Detailtiefe, mehr Automatisierung oder mehr Koordination verlangt

Diese Punkte sind noch nicht durch ein echtes Governance-, QA- oder Freigabemodell geklaert und sollen deshalb hier nicht vorweggenommen werden.

## 7. Empfohlener kleinster naechster Schritt

Der naechste Schritt sollte weiterhin nur Klärung und Begrenzung sein, nicht Implementierung:
1. die hier genannten Minimalregeln als internen Referenzrahmen festhalten
2. die Grenze zwischen Konsistenzbereinigung und wieder vertretbarem kleinem Ausbau klar benennen
3. weitere Governance-, QA- oder Freigabestrukturen erst spaeter explizit beauftragen

## 8. Einordnung

Diese Mini-Spezifikation ist absichtlich konservativ.
Sie soll den minimalen internen Entscheidungsrahmen dafuer begrenzen, wann dokumentarische Konsistenz wieder ausreichend hergestellt ist, um kleinen Ausbau zuzulassen, ohne ein formales Governance-, QA- oder Freigabemodell zu erfinden.

Alles darueber hinaus bleibt spaeteren, explizit beauftragten Schritten vorbehalten.
