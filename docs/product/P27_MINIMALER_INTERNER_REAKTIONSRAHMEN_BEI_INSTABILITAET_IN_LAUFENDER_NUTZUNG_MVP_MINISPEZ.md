# P27 Minimaler interner Reaktionsrahmen bei Instabilitaet in laufender Nutzung im MVP – Mini-Spezifikation

Status: Mini-Spezifikation v0.1 auf Basis des aktuellen Repo-Iststands
Stand: 2026-04-19

## 1. Zweck und Abgrenzung

Diese Mini-Spezifikation begrenzt den minimalen internen Reaktionsrahmen bei ersten Instabilitaetssignalen in laufender Nutzung fuer den MVP der `AlexanderSmyslowski/catering-agents-platform`.

Sie erfindet kein Incident-Board, kein Support-/Eskalationssystem als Vollmodell, kein formales Betriebsunterbrechungs- oder Recovery-Modell und keine neue Produkt- oder Prozessfamilie. Ziel ist ausschliesslich, den kleinsten Rahmen festzuhalten, unter dem erste Instabilitaetssignale in der laufenden internen Nutzung knapp eingeordnet werden koennen.

## 2. Bezug auf Pflichtenheft, MVP-Arbeitspakete, P23, P24, P25, P26 und Memory

Grundlagen dieses Dokuments sind:
- `docs/product/PFLICHTENHEFT.md`
- `docs/product/MVP_ARBEITSPAKETE.md`
- `docs/product/P23_MINIMALER_INTERNER_BETA_ABSCHLUSS_UND_DOKUMENTATIONSSTAND_MVP_MINISPEZ.md`
- `docs/product/P24_MINIMALER_UEBERGABESTAND_VON_BETA_ZU_LAUFENDER_INTERNER_NUTZUNG_MVP_MINISPEZ.md`
- `docs/product/P25_MINIMALER_INTERNER_NUTZUNGSRAHMEN_NACH_BETA_UEBERGABE_MVP_MINISPEZ.md`
- `docs/product/P26_MINIMALER_INTERNER_STABILISIERUNGSRAHMEN_IN_LAUFENDER_NUTZUNG_MVP_MINISPEZ.md`
- `memory.md`
- der aktuelle Repo-Iststand in den Test-/Build-/Smoke-Pfaden, dem Beta-Abschluss- und Dokumentationsstand, dem Uebergabestand von Beta zu laufender interner Nutzung, dem Nutzungsrahmen nach Beta-Uebergabe, dem Stabilisierungsrahmen in laufender Nutzung sowie den vorhandenen Export-/Audit-/Fallback-Bezuegen

Wesentliche Ableitung:
- Das Pflichtenheft beschreibt eine interne, nachvollziehbare Betriebsplattform mit operativen Artefakten.
- Die MVP-Arbeitspakete ordnen die naechsten kleinen Schritte konservativ.
- P23 ordnet die kleine Abschlusssicht und den dokumentarisch sauberen Beta-Abschluss ein.
- P24 ordnet den Uebergabestand von dokumentarisch abgeschlossenem Beta-Stand zu laufender interner Nutzung ein.
- P25 ordnet den dauerhaften Nutzungsrahmen nach Beta-Uebergabe ein.
- P26 ordnet den kleinsten Stabilisierungsrahmen fuer die laufende interne Nutzung ein.
- P27 begrenzt nun den kleinsten Reaktionsrahmen fuer erste Instabilitaetssignale in dieser laufenden Nutzung.
- `memory.md` bleibt der Kurzanker fuer die konsolidierten Repo-Fakten und die laufende Projektfortschreibung.

## 3. Aktueller repo-gebundener Kontext

### 3.1 Bereits vorhanden

Im Repo sind bereits folgende Bausteine sichtbar:
- gruener automatisierter Vitest-Korridor
- reproduzierbarer `npm run build`-Pfad
- schmale UI-/Smoke-Grundlage fuer die Kernrouten
- Beta-Abschluss- und Dokumentationsstand ueber P23
- Uebergabestand zu laufender interner Nutzung ueber P24
- Nutzungsrahmen nach Beta-Uebergabe ueber P25
- Stabilisierungsrahmen in laufender Nutzung ueber P26
- read-only Exportpfade fuer Angebot, Produktionsblatt und Einkaufsliste
- Review-/Audit-Sicht fuer interne Betriebs- und Kontrollnachweise
- manuelle Fallbacks und Datenkorrekturen als gesondert begrenzte Rahmen
- PR-/Commit-/Dokument-/memory-Fortschreibung als laufende repo-nahe Entscheidungs- und Aenderungsspur

### 3.2 Fuer den MVP ausreichend und verbindlich

Fuer die knappe Reaktion auf erste Instabilitaetssignale in laufender interner Nutzung ist im MVP verbindlich anzunehmen:
- die technische Basis ist ueber Test, Build und Smoke bereits belastbar genug, um Auffaelligkeiten nicht blind zu behandeln
- die Einordnung aus P23 bis P26 steht nicht im Widerspruch zu einer knappen Reaktion auf erste Instabilitaetssignale
- die Restpunkt-Einordnung aus P22 bleibt implizit so weit geklaert, dass nur noch bewusst tolerierte Punkte offen bleiben
- der Stand kann intern weiter genutzt werden, ohne dass dafuer ein formales Incident-, Support- oder Betriebsmodell erforderlich wird
- PR, Doku und memory bleiben die kleinste tragende Dokumentationsspur fuer diese Reaktionsbewertung

### 3.3 Wie erste technische, fachliche und betriebliche Instabilitaetssignale knapp eingeordnet werden sollen

Erste Instabilitaetssignale sollen im MVP knapp in drei Ebenen eingeordnet werden:
- technische Instabilitaetssignale: Test-, Build-, Smoke- oder Stabilitaetsfragen
- fachliche Instabilitaetssignale: Export-, Artefakt- oder Plausibilitaetsfragen
- betriebliche Instabilitaetssignale: Fallbacks, Verantwortung, Lage oder dokumentarische Luecken

Die Einordnung soll bewusst klein bleiben:
1. zuerst das Instabilitaetssignal sichtbar machen
2. dann grob einer der drei Ebenen zuordnen
3. dann entscheiden, ob vorsichtige Weiternutzung, Nachziehen/Klaerung oder vorlaeufiges Aussetzen naheliegt

### 3.4 Wann eher vorsichtige Weiternutzung noch vertretbar ist

Vorsichtige Weiternutzung kann im MVP noch vertretbar sein, wenn:
- das Signal leicht, klar begrenzt und nicht wiederkehrend ist
- der Kernpfad technisch, fachlich und betrieblich weiter plausibel bleibt
- die Nutzung mit minimaler Vorsicht fortgesetzt werden kann, ohne einen Grundblocker zu verdecken
- eine kleine dokumentarische Klarstellung ausreicht, um das Signal einzuordnen

### 3.5 Wann eher Nachziehen oder Klaerung vor weiterer Nutzung angezeigt ist

Eher Nachziehen oder Klaerung vor weiterer Nutzung ist angezeigt, wenn:
- das Signal den Kernpfad zwar nicht bricht, aber die Plausibilitaet sichtbar schwächt
- ein wiederkehrender Zweifel denselben Punkt betrifft
- eine kleine Korrektur an Doku, Fallback oder Einordnung die naechste Nutzung deutlich sicherer machen wuerde
- der Zustand noch nicht nach Aussetzen verlangt, aber nicht mehr als ruhig genug gelten sollte

### 3.6 Wann eher ein vorlaeufiges Zuruecknehmen oder Aussetzen laufender Nutzung naheliegt

Ein vorlaeufiges Zuruecknehmen oder Aussetzen ist im MVP eher naheliegend, wenn:
- ein Grundblocker sichtbar wird oder sich verfestigt
- technische, fachliche und betriebliche Signale nicht mehr knapp zusammengefuehrt werden koennen
- der Lauf nur durch wiederholte Sonderwege stabil bleibt
- die dokumentarische oder operative Lage ohne klares Nachziehbild unsauber geworden ist

### 3.7 Welche kleineren Restpunkte dabei noch tolerierbar sein koennen

Tolerierbar koennen im MVP noch sein:
- knappe Dokumentationsluecken, sofern der Kernkontext nachvollziehbar bleibt
- sprachliche oder begriffliche Nachschaerfungen ohne technische Wirkung
- nicht-kritische offene Fragen, die die Nutzung intern nicht unsicher machen
- kleine Fallback-/Hinweisanpassungen, sofern sie den Lauf nicht blockieren

### 3.8 Rolle von PR, Doku und memory

Im bestehenden MVP-Rahmen gilt:
- PRs halten die konkrete Aenderung und die sichtbare Reaktionsentscheidung fest
- Doku hält die fachliche Einordnung des Instabilitaetssignals fest
- `memory.md` hält den konsolidierten, dauerhaften Repo-Stand fest
- zusammen bilden sie die kleine Reaktions-, Begrenzungs- und Bewertungsspur, ohne ein formales Incident-, Support- oder Betriebsreaktionssystem zu ersetzen

## 4. Kleinste MVP-Festlegung

### 4.1 Wie erste Instabilitaetssignale in laufender Nutzung knapp eingeordnet werden sollen

Ein Signal soll im MVP knapp eingeordnet werden koennen, wenn:
1. der laufende Nutzungsstand nach P24 und P25 bereits als intern tragfaehig gilt
2. der Stabilisierungsrahmen nach P26 nicht bereits einen klaren Dauerblocker beschreibt
3. das Signal fachlich, technisch oder betrieblich minimal zuordenbar ist
4. die Einordnung in vorsichtige Weiternutzung, Klaerung oder Aussetzen mit den vorhandenen Repo-Bausteinen nachvollziehbar bleibt
5. PR, Doku und memory die Reaktionsentscheidung knapp abbilden

### 4.2 Welche kleineren Restpunkte dabei noch tolerierbar sein koennen

Im MVP sind noch tolerierbar:
- offene Detailfragen, die den produktiven Kern nicht blockieren
- kleine Nachschaerfungen an Begriffen, Markierungen oder Dokumentation
- vereinzelte Rueckfragen, sofern sie den Nutzungsstand nicht grundsaetzlich infrage stellen
- kleine Doku-Anpassungen, solange die interne Nutzung nicht unsicher wird

### 4.3 Welche Auffaelligkeiten eher fuer erneuten Nachziehbedarf oder gegen Stabilitaet sprechen

Eher fuer Nachziehbedarf oder gegen weitere ruhige Nutzung sprechen:
- offene Punkte mit Grundblocker-Charakter
- wiederkehrende Widersprueche zwischen Technik, Fachlichkeit und Betrieb
- unklare oder gebrochene Nachvollziehbarkeit bei zentralen Artefakten
- eine Lage, in der man fuer die weitere Nutzung bereits ein formales Incident-, Support- oder Betriebsmodell braeuchte

### 4.4 Wie PR, Dokumente und memory fuer die knappe Reaktions- und Einordnungsentscheidung genutzt werden

- PR dient als Ort fuer die sichtbare Aenderung oder Reaktionsentscheidung
- Doku dient als Ort fuer die knappe fachliche Einordnung des Signals und der gewaehlten Reaktion
- `memory.md` dient als dauerhafte Verdichtung des beschlossenen Reaktionsstatus

Wenn ein Instabilitaetssignal nicht sauber einordenbar ist, soll es lieber sichtbar offen bleiben, statt in ein neues formales System verschoben zu werden.

### 4.5 Was im MVP bewusst noch kein formales Incident-, Support- oder Betriebsreaktionsmodell ist

Der minimale Reaktionsrahmen bei Instabilitaet in laufender Nutzung ist ausdruecklich noch kein formales Modell:
- kein Incident-Board
- kein Support-/Eskaltionssystem als Vollmodell
- kein formales Betriebsunterbrechungs- oder Recovery-Modell
- kein Produktionsfreigabe-Board
- kein Release- oder Rollout-System
- keine neuen Endpunkte
- keine neue Persistenzlogik
- keine neue Produktfamilie

## 5. Klare Abgrenzung

Diese Mini-Spezifikation fuehrt ausdruecklich nicht ein:
- kein Incident-Board
- kein Support-/Eskaltionssystem als Vollmodell
- kein formales Betriebsunterbrechungs- oder Recovery-Modell
- keine neuen Endpunkte
- keine neue Persistenzlogik
- keine neue Produktfamilie

Der Reaktionsrahmen bleibt damit bewusst klein und an den vorhandenen Repo-Bausteinen orientiert.

## 6. Offene Punkte

Bewusst offen bleibt:
- ob spaeter zwischen Instabilitaet, Fehlerfall und formaler Unterbrechung strenger getrennt werden muss
- wie weit ein spaeterer Betrieb formale Rollen fuer Beobachtung, Rueckfrage und Entscheidung braucht
- ob einzelne Reaktionskriterien spaeter in ein staerker strukturiertes Betriebs-, Incident- oder Support-Modell ueberfuehrt werden sollen
- welche Teile der heutigen PR-/Doku-/memory-Fortschreibung spaeter formalisiert werden muessen
- ob ein spaeterer Produkt- oder Betriebsausbau mehr Detailtiefe, mehr Automatisierung oder mehr Koordination verlangt

Diese Punkte sind noch nicht durch ein echtes Incident-, Support- oder Betriebsmodell geklaert und sollen deshalb hier nicht vorweggenommen werden.

## 7. Empfohlener kleinster naechster Schritt

Der naechste Schritt sollte weiterhin nur Klärung und Begrenzung sein, nicht Implementierung:
1. die hier genannten Minimalregeln als internen Referenzrahmen festhalten
2. die Grenze zwischen vorsichtiger Weiternutzung, Klaerung und Aussetzen klar benennen
3. weitere Incident-, Support- oder Betriebsstrukturen erst spaeter explizit beauftragen

## 8. Einordnung

Diese Mini-Spezifikation ist absichtlich konservativ.
Sie soll den minimalen internen Reaktionsrahmen bei Instabilitaet in laufender Nutzung fachlich begrenzen, ohne ein formales Incident-, Support- oder Betriebsreaktionsmodell zu erfinden.

Alles darueber hinaus bleibt spaeteren, explizit beauftragten Schritten vorbehalten.
