# P24 Minimaler Uebergabestand von Beta zu laufender interner Nutzung im MVP – Mini-Spezifikation

Status: Mini-Spezifikation v0.1 auf Basis des aktuellen Repo-Iststands
Stand: 2026-04-19

## 1. Zweck und Abgrenzung

Diese Mini-Spezifikation begrenzt den minimalen internen Uebergabestand von einem dokumentarisch abgeschlossenen Beta-Stand hin zu laufender interner Nutzung fuer den MVP der `AlexanderSmyslowski/catering-agents-platform`.

Sie erfindet kein Betriebsuebergabe-Board, kein Support-Handbuch als Vollmodell, kein formales Release-/Rollout-Modell und keine neue Produkt- oder Prozessfamilie. Ziel ist ausschliesslich, den kleinsten fachlichen Rahmen festzuhalten, unter dem ein bereits dokumentiert abgeschlossener Beta-Stand intern weiterverwendet werden darf.

## 2. Bezug auf Pflichtenheft, MVP-Arbeitspakete, P20, P21, P22, P23 und Memory

Grundlagen dieses Dokuments sind:
- `docs/product/PFLICHTENHEFT.md`
- `docs/product/MVP_ARBEITSPAKETE.md`
- `docs/product/P20_MINIMALER_INTERNER_BETA_AUSWERTUNGS_UND_GO_NO_GO_RAHMEN_MVP_MINISPEZ.md`
- `docs/product/P21_MINIMALER_UEBERGANG_VON_BETA_ZU_INTERN_NUTZBAREM_PRODUKTSTATUS_MVP_MINISPEZ.md`
- `docs/product/P22_MINIMALER_RESTPUNKT_UND_NACHZIEHRAHMEN_VOR_BETA_ABSCHLUSS_MVP_MINISPEZ.md`
- `docs/product/P23_MINIMALER_INTERNER_BETA_ABSCHLUSS_UND_DOKUMENTATIONSSTAND_MVP_MINISPEZ.md`
- `memory.md`
- der aktuelle Repo-Iststand in den Test-/Build-/Smoke-Pfaden, der Beta-Auswertung und dem Go/No-Go-Rahmen, dem Uebergang zu intern nutzbarem Produktstatus, dem Restpunkt- und Nachziehrahmen, dem Beta-Abschluss- und Dokumentationsstand sowie den vorhandenen Export-/Audit-/Fallback-Bezuegen

Wesentliche Ableitung:
- Das Pflichtenheft beschreibt eine interne, nachvollziehbare Betriebsplattform mit operativen Artefakten.
- Die MVP-Arbeitspakete ordnen die naechsten kleinen Schritte konservativ.
- P20 begrenzt die Beta-Auswertung und die Go/No-Go-Einordnung.
- P21 ordnet den Uebergang von Beta zu intern nutzbarem Produktstatus ein.
- P22 ordnet den Umgang mit kleinen Restpunkten vor Beta-Abschluss ein.
- P23 ordnet die kleine Abschlusssicht und den dokumentarisch sauberen Beta-Abschluss ein.
- P24 begrenzt nun den kleinsten Uebergabestand: unter welchen Bedingungen der dokumentarisch abgeschlossene Beta-Stand in laufende interne Nutzung uebergehen darf.
- `memory.md` bleibt der Kurzanker fuer die konsolidierten Repo-Fakten und die laufende Projektfortschreibung.

## 3. Aktueller repo-gebundener Kontext

### 3.1 Bereits vorhanden

Im Repo sind bereits folgende Bausteine sichtbar:
- gruener automatisierter Vitest-Korridor
- reproduzierbarer `npm run build`-Pfad
- schmale UI-/Smoke-Grundlage fuer die Kernrouten
- Beta-Auswertung und Go/No-Go-Rahmen ueber P20
- Uebergang zu intern nutzbarem Produktstatus ueber P21
- Restpunkt- und Nachziehrahmen vor Beta-Abschluss ueber P22
- Beta-Abschluss- und Dokumentationsstand ueber P23
- read-only Exportpfade fuer Angebot, Produktionsblatt und Einkaufsliste
- Review-/Audit-Sicht fuer interne Betriebs- und Kontrollnachweise
- manuelle Fallbacks und Datenkorrekturen als gesondert begrenzte Rahmen
- PR-/Commit-/Dokument-/memory-Fortschreibung als laufende repo-nahe Entscheidungs- und Aenderungsspur

### 3.2 Fuer den MVP ausreichend und verbindlich

Fuer den Uebergabestand von Beta zu laufender interner Nutzung ist im MVP verbindlich anzunehmen:
- die technische Basis ist ueber Test, Build und Smoke bereits belastbar genug, um den Stand nicht nur als Einzelereignis, sondern als weiter nutzbaren internen Zustand zu tragen
- die Go-/No-Go- und Abnahmekriterien aus P20, P21 und P23 stehen nicht im Widerspruch zum dokumentarisch abgeschlossenen Stand
- die Restpunkt-Einordnung aus P22 ist so weit geklaert, dass nur noch bewusst tolerierte Punkte offen bleiben
- der Stand kann intern weiter genutzt werden, ohne dass dafuer ein formales Betriebs-, Support- oder Release-Modell erforderlich wird
- PR, Doku und memory bleiben die kleinste tragende Dokumentationsspur fuer diese Uebergangsbewertung

### 3.3 Welche wenigen Rahmenbedingungen dafuer stabil genug vorliegen sollten

Ein dokumentarisch abgeschlossener Beta-Stand darf im MVP in laufende interne Nutzung uebergehen, wenn diese wenigen Rahmenbedingungen zusammen stabil genug sind:
- technisch: Test und Build laufen, die relevanten Kernrouten sind erreichbar und der Smoke-Korridor bleibt stabil
- fachlich: die operativen Exporte und Artefakte sind plausibel und die Kernsicht bleibt konsistent
- betrieblich: Lageueberblick, Fallbacks und Klaerungsweg machen den Stand intern fuehrbar
- dokumentarisch: PR, Doku und memory bilden den Uebergang knapp und konsistent ab

### 3.4 Welche Restpunkte dabei noch tolerierbar sein koennen

Tolerierbar koennen im MVP noch sein:
- kleine sprachliche Feinschliffe ohne fachliche Wirkung
- einzelne Rueckfragen, sofern sie den Uebergabestand nicht grundlegend unscharf machen
- kleine Dokumentationsluecken, wenn der Kernkontext trotzdem nachvollziehbar bleibt
- bewusst offene Anschlussfragen, die nicht mehr den Beta-Uebergang selbst betreffen
- kleine Nachschaerfungen, die die interne Nutzung verbessern, ohne eine neue Prozesswelt zu verlangen

### 3.5 Welche offenen Punkte eher gegen den Uebergang sprechen

Eher gegen den Uebergang sprechen offene Punkte, wenn sie den Stand als laufend intern nutzbar unsicher machen:
- neue Grundblocker in Test, Build oder Smoke
- widerspruechliche oder nicht mehr plausible Exporte
- ungeklaerte oder wiederkehrende Klaerungsfaelle, die den Betrieb unsauber machen
- fehlende oder gebrochene Review-/Audit-Nachvollziehbarkeit
- eine Lage, in der der Beta-Auswertungsrahmen aus P20 eher Stop als Fortsetzung nahelegt
- offene Punkte, die bereits ein formales Betriebs-, Support- oder Release-Modell verlangen wuerden

### 3.6 Rolle von PR, Doku und memory

Im bestehenden MVP-Rahmen gilt:
- PRs halten die konkrete Aenderung und die sichtbare Uebergangsentscheidung fest
- Doku hält die fachliche Einordnung des Uebergabestands fest
- `memory.md` hält den konsolidierten, dauerhaften Repo-Stand fest
- zusammen bilden sie die kleine Uebergangs- und Begrenzungsspur, ohne ein formales Betriebs-, Support- oder Release-System zu ersetzen

## 4. Kleinste MVP-Festlegung

### 4.1 Wann ein dokumentarisch abgeschlossener Beta-Stand in laufende interne Nutzung uebergehen darf

Ein Stand darf im MVP von dokumentarisch abgeschlossenem Beta-Stand in laufende interne Nutzung uebergehen, wenn:
1. der Beta-Stand fachlich durch P20 eingeordnet ist
2. der Uebergang in den intern nutzbaren Produktstatus durch P21 nicht im Widerspruch zum Abschluss steht
3. die Restpunkte vor Abschluss durch P22 entweder nachgezogen oder bewusst als tolerierbar festgehalten sind
4. die Schlussdoku den letzten Stand knapp und konsistent beschreibt
5. `memory.md` den Abschluss- und Uebergangszustand in verdichteter Form nachvollziehbar abbildet
6. Test, Build und relevante Smoke-Basis gruen sind oder als explizit akzeptierte Basis vorliegen

### 4.2 Welche wenigen technischen, fachlichen und betrieblichen Rahmenbedingungen stabil genug vorliegen sollten

Die Rahmenbedingungen gelten im MVP als stabil genug, wenn:
- technische Signale nicht nur punktuell, sondern als tragfaehiger Grundzustand vorliegen
- fachliche Signale die operativen Artefakte ausreichend plausibel machen
- betriebliche Signale zeigen, dass Lage, Fallbacks und Klaerung den Stand auffangen koennen
- dokumentarische Signale den Stand intern knapp und konsistent beschreiben

### 4.3 Welche kleineren Restpunkte dabei noch tolerierbar sein koennen

Im MVP sind noch tolerierbar:
- offene Detailfragen, die den produktiven Kern nicht blockieren
- kleine Nachschaerfungen an Begriffen, Markierungen oder Dokumentation
- vereinzelte Rueckfragen, sofern sie den Nutzungsstand nicht grundsaetzlich infrage stellen
- kleine Doku-Anpassungen, solange die interne Nutzung nicht unsicher wird

### 4.4 Welche offenen Punkte eher gegen den Uebergang sprechen

Eher gegen den Uebergang sprechen:
- offene Punkte mit Grundblocker-Charakter
- wiederkehrende Widersprueche zwischen Technik, Fachlichkeit und Betrieb
- unklare oder gebrochene Nachvollziehbarkeit bei zentralen Artefakten
- eine Lage, in der man fuer die weitere Nutzung bereits ein formales Betriebs-, Support- oder Release-Modell braeuchte

### 4.5 Wie PR, Dokumente und memory fuer die knappe Uebergabebewertung genutzt werden

- PR dient als Ort fuer die sichtbare Aenderung oder Uebergangsentscheidung
- Doku dient als Ort fuer die knappe fachliche Einordnung des Uebergabestands
- `memory.md` dient als dauerhafte Verdichtung des beschlossenen Uebergangsstatus

Wenn ein Uebergabestand nicht sauber einordenbar ist, soll er lieber sichtbar offen bleiben, statt in ein neues formales System verschoben zu werden.

### 4.6 Was im MVP bewusst noch kein formales Betriebs-, Support- oder Release-Uebergabemodell ist

Der minimale Uebergabestand von Beta zu laufender interner Nutzung ist ausdruecklich noch kein formales Modell:
- kein Betriebsuebergabe-Board
- kein Support-Handbuch als Vollmodell
- kein formales Release-/Rollout-Modell
- kein Support-/Ticket-System
- kein Rollout-Kalender
- kein Produktionsfreigabe-Board
- keine neuen Endpunkte
- keine neue Persistenzlogik
- keine neue Produktfamilie

## 5. Klare Abgrenzung

Diese Mini-Spezifikation fuehrt ausdruecklich nicht ein:
- kein Betriebsuebergabe-Board
- kein Support-Handbuch als Vollmodell
- kein formales Release-/Rollout-Modell
- kein Support-/Ticket-System
- keine neuen Endpunkte
- keine neue Persistenzlogik
- keine neue Produktfamilie

Der Uebergabestand bleibt damit bewusst klein und an den vorhandenen Repo-Bausteinen orientiert.

## 6. Offene Punkte

Bewusst offen bleibt:
- ob spaeter zwischen laufender interner Nutzung, formaler Freigabe und allgemeinem Betrieb strenger getrennt werden muss
- wie weit ein spaeterer Betrieb formale Rollen fuer Beobachtung, Rueckfrage und Entscheidung braucht
- ob einzelne Uebergabekriterien spaeter in ein staerker strukturiertes Betriebs-, Support- oder Release-Modell ueberfuehrt werden sollen
- welche Teile der heutigen PR-/Doku-/memory-Fortschreibung spaeter formalisiert werden muessen
- ob ein spaeterer Produkt- oder Betriebsausbau mehr Detailtiefe, mehr Automatisierung oder mehr Koordination verlangt

Diese Punkte sind noch nicht durch ein echtes Betriebs-, Support- oder Release-Modell geklaert und sollen deshalb hier nicht vorweggenommen werden.

## 7. Empfohlener kleinster naechster Schritt

Der naechste Schritt sollte weiterhin nur Klaerung und Begrenzung sein, nicht Implementierung:
1. die hier genannten Minimalregeln als internen Referenzrahmen festhalten
2. die Grenze zwischen dokumentarisch abgeschlossenem Beta-Stand und laufender interner Nutzung klar benennen
3. weitere Betriebs-, Support- oder Release-Strukturen erst spaeter explizit beauftragen

## 8. Einordnung

Diese Mini-Spezifikation ist absichtlich konservativ.
Sie soll den minimalen internen Uebergabestand von Beta zu laufender interner Nutzung fachlich begrenzen, ohne ein formales Betriebs-, Support- oder Release-Modell zu erfinden.

Alles darueber hinaus bleibt spaeteren, explizit beauftragten Schritten vorbehalten.
