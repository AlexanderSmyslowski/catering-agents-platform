# P31 Minimaler interner Entscheidungsrahmen zur Zurueckstellung von Funktionsausbau zugunsten von Stabilisierung im MVP – Mini-Spezifikation

Status: Mini-Spezifikation v0.1 auf Basis des aktuellen Repo-Iststands
Stand: 2026-04-19

## 1. Zweck und Abgrenzung

Diese Mini-Spezifikation begrenzt den minimalen internen Entscheidungsrahmen dafuer, wann geplanter Funktionsausbau im MVP zugunsten weiterer Stabilisierung zurueckgestellt werden soll, im Repo `AlexanderSmyslowski/catering-agents-platform`.

Sie erfindet kein Priorisierungsboard, kein formales Produktmanagement-System, kein Scoring-/Freigabemodell und keine neue Produkt- oder Prozessfamilie. Ziel ist ausschliesslich, den kleinsten Rahmen festzuhalten, unter dem ein geplanter Ausbau intern bewusst hinter Stabilisierung, Nachziehen oder Konsistenzpflege zuruecktritt.

## 2. Bezug auf Pflichtenheft, MVP-Arbeitspakete, P27, P29, P30 und Memory

Grundlagen dieses Dokuments sind:
- `docs/product/PFLICHTENHEFT.md`
- `docs/product/MVP_ARBEITSPAKETE.md`
- `docs/product/P27_MINIMALER_INTERNER_REAKTIONSRAHMEN_BEI_INSTABILITAET_IN_LAUFENDER_NUTZUNG_MVP_MINISPEZ.md`
- `docs/product/P29_MINIMALER_INTERNE_ENTSCHEIDUNGSRAHMEN_AUSBAUPRIORISIERUNG_NACH_BEREINIGUNG_MVP_MINISPEZ.md`
- `docs/product/P30_MINIMALER_INTERNE_ABGRENZUNGSRAHMEN_STABILISIERUNG_VS_FUNKTIONSAUSBAU_MVP_MINISPEZ.md`
- `memory.md`
- der aktuelle Repo-Iststand in den Test-/Build-/Smoke-Pfaden, dem Reaktionsrahmen bei Instabilitaet, der Ausbaupriorisierung nach Bereinigung, der Abgrenzung zwischen Stabilisierung und echtem Funktionsausbau sowie den vorhandenen Export-/Audit-/Fallback-Bezuegen

Wesentliche Ableitung:
- Das Pflichtenheft beschreibt eine interne, nachvollziehbare Betriebsplattform mit operativen Artefakten.
- Die MVP-Arbeitspakete ordnen die naechsten kleinen Schritte konservativ.
- P27 ordnet den Umgang mit ersten Instabilitaetssignalen ein.
- P29 ordnet die knappe Priorisierung weiterer kleiner Ausbauschritte nach Bereinigung ein.
- P30 trennt Stabilisierung und echten Funktionsausbau fachlich sauber.
- P31 begrenzt nun den kleinsten Entscheidungsrahmen dafuer, dass geplanter Ausbau zugunsten von Stabilisierung bewusst zurueckgestellt wird.
- `memory.md` bleibt der Kurzanker fuer die konsolidierten Repo-Fakten und die laufende Projektfortschreibung.

## 3. Aktueller repo-gebundener Kontext

### 3.1 Bereits vorhanden

Im Repo sind bereits folgende Bausteine sichtbar:
- gruener automatisierter Vitest-Korridor
- reproduzierbarer `npm run build`-Pfad
- schmale UI-/Smoke-Grundlage fuer die Kernrouten
- Reaktionsrahmen bei Instabilitaet ueber P27
- Ausbaupriorisierung nach Bereinigung ueber P29
- Abgrenzungsrahmen Stabilisierung vs. Funktionsausbau ueber P30
- read-only Exportpfade fuer Angebot, Produktionsblatt und Einkaufsliste
- Review-/Audit-Sicht fuer interne Betriebs- und Kontrollnachweise
- manuelle Fallbacks und Datenkorrekturen als gesondert begrenzte Rahmen
- PR-/Commit-/Dokument-/memory-Fortschreibung als laufende repo-nahe Entscheidungs- und Aenderungsspur

### 3.2 Fuer den MVP ausreichend und verbindlich

Fuer die knappe Zurueckstellung von Funktionsausbau zugunsten von Stabilisierung ist im MVP verbindlich anzunehmen:
- die technische Basis ist ueber Test, Build und Smoke belastbar genug, um Ausbau nicht blind vorzuziehen
- die Einordnung aus P27 bis P30 steht nicht im Widerspruch zu einer weiteren kleinen Zurueckstellungsentscheidung
- die Dokumentationslage ist so weit konsistent, dass Ausbaufragen hinter Stabilisierung, Nachziehen und Konsistenzpflege zuruecktreten koennen
- der Stand kann intern weiterentwickelt werden, ohne dass dafuer ein formales Produktmanagement-, Portfolio- oder Governance-Modell erforderlich wird
- PR, Doku und memory bleiben die kleinste tragende Dokumentationsspur fuer diese Zurueckstellungsentscheidung

### 3.3 Nach welchen wenigen Signalen geplanter Funktionsausbau eher zurueckgestellt werden soll

Geplanter Funktionsausbau soll im MVP eher zurueckgestellt werden, wenn mindestens eines dieser Signale klar vorliegt:
- ein vorhandener Kernpfad ist noch nicht ausreichend ruhig oder robust
- ein bekannter Restpunkt oder eine dokumentarische Luecke ist noch offen
- eine Inkonsistenz zwischen Doku, memory und Repo-Iststand ist noch nicht sauber bereinigt
- ein Schritt wirkt nur deshalb attraktiv, weil Stabilisierung oder Nachziehen noch fehlt
- Test, Build, Smoke, Export, Audit oder Fallback sollen vorrangig abgesichert statt erweitert werden

### 3.4 Wann Stabilisierung, Nachziehen oder Dokumentationskonsistenz klar Vorrang haben sollen

Stabilisierung, Nachziehen oder Dokumentationskonsistenz haben im MVP klar Vorrang, wenn:
- der vorhandene Nutzungsstand noch nicht belastbar ruhig ist
- ein Schritt den Kernpfad erst absichert, statt eine neue Faehigkeit zu schaffen
- die Hauptwirkung des Schritts in Bereinigung, Benennung, Referenz oder memory-Abgleich liegt
- der Nutzen des Ausbaus erst nach der Konsistenzbereinigung sinnvoll beurteilbar ist
- eine kleine Nachschaerfung die naechste interne Nutzung deutlich sicherer machen wuerde

### 3.5 Wie mit Grenzfaellen knapp umgegangen werden soll

Grenzfaelle sollen im MVP bewusst klein und konservativ behandelt werden:
1. zuerst pruefen, ob der Ausbau nur eine bestehende Funktion absichert oder bereinigt
2. dann pruefen, ob der Ausbau in Wahrheit nur Nachziehbedarf oder Dokumentationskonsistenz beseitigt
3. erst wenn ein eigenstaendiger neuer Nutzen klar erkennbar ist, kann er als Ausbau weiterverfolgt werden
4. im Zweifel eher Stabilisierung/Nachziehen als Funktionsausbau annehmen

Wenn ein Ausbau nur dann sinnvoll wirkt, weil Dokumentation oder memory noch nicht sauber sind, soll er zurueckgestellt werden.

### 3.6 Welche Arten von Ausbau im aktuellen MVP eher zurueckhaltend behandelt werden sollen

Eher zurueckhaltend behandelt werden sollen:
- Ausbau, der neue Produktflaechen oeffnet statt den vorhandenen Kern zu stabilisieren
- Ausbau, der nur einen formalen Rahmen erzeugt, aber keinen direkten Nutzwert fuer die laufende interne Nutzung hat
- Ausbau, der neue Endpunkte, neue Persistenz oder neue Prozessfamilien verlangen wuerde
- Ausbau, der eigentlichen Nachziehbedarf als scheinbar neue Initiative tarnt
- Ausbau, der ein formales Priorisierungs-, Freigabe- oder Governance-Modell voraussetzen wuerde

### 3.7 Rolle von PR, Dokumenten und memory

Im bestehenden MVP-Rahmen gilt:
- PRs halten die konkrete Aenderung und die sichtbare Zurueckstellungsentscheidung fest
- Doku haelt die fachliche Einordnung fest, warum Ausbau hinter Stabilisierung zuruecktritt
- `memory.md` haelt den konsolidierten, dauerhaften Repo-Stand fest
- zusammen bilden sie die kleine Zurueckstellungs- und Begrenzungsspur, ohne ein formales Produktmanagement-, Portfolio- oder Governance-System zu ersetzen

## 4. Kleinste MVP-Festlegung

### 4.1 Wann geplanter Funktionsausbau im MVP eher zurueckgestellt werden soll

Geplanter Funktionsausbau soll im MVP eher zurueckgestellt werden, wenn:
1. der vorhandene interne Nutzungsstand noch nicht direkt entlastet oder abgesichert ist
2. ein echter Nachzieh- oder Konsistenzbedarf im Repo noch offen ist
3. der Ausbau keine klar priorisierte, unmittelbare Entlastung gegenueber Stabilisierung bietet
4. Test, Build, Smoke, Export, Audit oder Fallback derzeit wichtiger sind als neue Faehigkeit
5. PR, Doku und memory die Zurueckstellungsentscheidung knapp und konsistent abbilden

### 4.2 Wann Stabilisierung, Nachziehen oder Dokumentationskonsistenz Vorrang haben sollen

Stabilisierung, Nachziehen oder Dokumentationskonsistenz haben Vorrang, wenn:
- der Kernpfad erst robuster werden muss
- ein bekannter Restpunkt oder eine Luecke zuerst geschlossen werden sollte
- die naechste Entscheidung erst nach sauberer Bereinigung belastbar ist
- die Einordnung des Schritts ohne konsistente Doku noch nicht stabil genug ist

### 4.3 Wie Grenzfaelle knapp behandelt werden sollen

Grenzfaelle sollen im MVP knapp so behandelt werden:
- wenn die Wirkung vor allem Absicherung, Beruhigung oder Bereinigung ist, eher zurueckstellen
- wenn die Wirkung vor allem eine neue fachliche Faehigkeit ist, eher als Ausbau weiterverfolgen
- wenn die Wirkung unklar bleibt, sichtbar offen halten statt vorschnell als Ausbau einzuplanen

### 4.4 Welche Schritte eher zurueckhaltend behandelt werden sollen

Zurueckhaltend behandelt werden sollen insbesondere:
- neue Produktflaechen ohne unmittelbaren internen Nutzen
- neue Endpunkte oder neue Persistenz, die den jetzigen Kern nicht nur schaerfen, sondern erweitern
- neue Prozessfamilien oder Freigabemodelle
- Schritte, die nur deshalb gross wirken, weil die Dokumentation noch nicht sauber ist

### 4.5 Wie PR, Dokumente und memory fuer die knappe Zurueckstellungsentscheidung genutzt werden

- PR dient als Ort fuer die sichtbare Aenderung oder Zurueckstellungsentscheidung
- Doku dient als Ort fuer die knappe fachliche Einordnung, warum Ausbau zurueckgestellt wird
- `memory.md` dient als dauerhafte Verdichtung des beschlossenen Zurueckstellungsrahmens

Wenn ein Schritt nicht sauber einordenbar ist, soll er lieber sichtbar offen bleiben, statt in ein neues formales System verschoben zu werden.

### 4.6 Was im MVP bewusst noch kein formales Roadmap-, Freigabe- oder Governance-Modell ist

Der minimale interne Zurueckstellungsrahmen ist ausdruecklich noch kein formales Modell:
- kein Priorisierungsboard
- kein formales Produktmanagement-System
- kein Scoring-/Freigabemodell
- kein Release- oder Rollout-System
- keine neuen Endpunkte
- keine neue Persistenzlogik
- keine neue Produktfamilie

## 5. Klare Abgrenzung

Diese Mini-Spezifikation fuehrt ausdruecklich nicht ein:
- kein Priorisierungsboard
- kein formales Produktmanagement-System
- kein Scoring-/Freigabemodell
- keine neuen Endpunkte
- keine neue Persistenzlogik
- keine neue Produktfamilie

Der Zurueckstellungsrahmen bleibt damit bewusst klein und an den vorhandenen Repo-Bausteinen orientiert.

## 6. Offene Punkte

Bewusst offen bleibt:
- ob spaeter zwischen Stabilisierung, Nachziehen, Zurueckstellung und echtem Produktausbau strenger getrennt werden muss
- wie weit ein spaeterer Betrieb formale Rollen fuer Beobachtung, Rueckfrage und Entscheidung braucht
- ob einzelne Zurueckstellungskriterien spaeter in ein staerker strukturiertes Produktfreigabe-, Scope- oder Governance-Modell ueberfuehrt werden sollen
- welche Teile der heutigen PR-/Doku-/memory-Fortschreibung spaeter formalisiert werden muessen
- ob ein spaeterer Produkt- oder Betriebsausbau mehr Detailtiefe, mehr Automatisierung oder mehr Koordination verlangt

Diese Punkte sind noch nicht durch ein echtes Produktfreigabe-, Scope- oder Governance-Modell geklaert und sollen deshalb hier nicht vorweggenommen werden.

## 7. Empfohlener kleinster naechster Schritt

Der naechste Schritt sollte weiterhin nur Klärung und Begrenzung sein, nicht Implementierung:
1. die hier genannten Minimalregeln als internen Referenzrahmen festhalten
2. die Grenze zwischen Stabilisierung/Nachziehen und zurueckgestelltem Funktionsausbau klar benennen
3. weitere Produktfreigabe-, Scope- oder Governance-Strukturen erst spaeter explizit beauftragen

## 8. Einordnung

Diese Mini-Spezifikation ist absichtlich konservativ.
Sie soll den minimalen internen Entscheidungsrahmen dafuer begrenzen, wann geplanter Funktionsausbau zugunsten von Stabilisierung zurueckgestellt wird, ohne ein formales Produktfreigabe-, Scope- oder Governance-Modell zu erfinden.

Alles darueber hinaus bleibt spaeteren, explizit beauftragten Schritten vorbehalten.
