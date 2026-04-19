# P23 Minimaler interner Beta-Abschluss- und Dokumentationsstand im MVP – Mini-Spezifikation

Status: Mini-Spezifikation v0.1 auf Basis des aktuellen Repo-Iststands
Stand: 2026-04-16

## 1. Zweck und Abgrenzung

Diese Mini-Spezifikation begrenzt den minimalen internen Beta-Abschluss- und Dokumentationsstand fuer den MVP der `AlexanderSmyslowski/catering-agents-platform`.

Sie erfindet kein formales Abschlussgremium, kein Sign-off-System, kein vollständiges Audit-/Compliance-Abschlussmodell und kein Release- oder Governance-System. Ziel ist ausschliesslich, den Beta-Abschnitt fachlich so zu begrenzen, dass er intern dokumentarisch sauber abgeschlossen gelten kann, ohne daraus eine neue Produkt- oder Prozessfamilie zu machen.

## 2. Bezug auf Pflichtenheft, MVP-Arbeitspakete, P15, P20, P21, P22 und Memory

Grundlagen dieses Dokuments sind:
- `docs/product/PFLICHTENHEFT.md`
- `docs/product/MVP_ARBEITSPAKETE.md`
- `docs/product/P15_MINIMALER_INTERNER_ABNAHMEPROZESS_MVP_MINISPEZ.md`
- `docs/product/P20_MINIMALER_INTERNER_BETA_AUSWERTUNGS_UND_GO_NO_GO_RAHMEN_MVP_MINISPEZ.md`
- `docs/product/P21_MINIMALER_UEBERGANG_VON_BETA_ZU_INTERN_NUTZBAREM_PRODUKTSTATUS_MVP_MINISPEZ.md`
- `docs/product/P22_MINIMALER_RESTPUNKT_UND_NACHZIEHRAHMEN_VOR_BETA_ABSCHLUSS_MVP_MINISPEZ.md`
- `memory.md`
- der aktuelle Repo-Iststand in den Test-/Build-/Smoke-Pfaden, der bestehenden Freigabe- und Abnahmebasis, der Beta-Auswertung und dem Go/No-Go-Rahmen, dem Uebergang zu intern nutzbarem Produktstatus, dem Restpunkt- und Nachziehrahmen vor Beta-Abschluss sowie den vorhandenen Mini-Spezifikationen

Wesentliche Ableitung:
- Das Pflichtenheft beschreibt eine interne, nachvollziehbare Betriebsplattform mit operativen Artefakten.
- Die MVP-Arbeitspakete ordnen die naechsten kleinen Schritte konservativ.
- P15 begrenzt die kleinste interne Abnahme auf bestehende Test-, Build-, Rollen-, Export- und Audit-/Review-Kontexte.
- P20 begrenzt die knappe Auswertung eines internen Beta-Durchlaufs und die Einordnung in tragfaehig, nachzusaechern oder vorerst zu stoppen.
- P21 ordnet den Uebergang von Beta zu intern nutzbarem Produktstatus ein.
- P22 ordnet den Umgang mit kleinen Restpunkten vor Beta-Abschluss ein.
- P23 ordnet nun die kleine Abschlusssicht: wann der Beta-Abschnitt intern dokumentarisch sauber abgeschlossen gelten kann und welche Unterlagen dafuer konsistent vorliegen sollten.
- `memory.md` bleibt der Kurzanker fuer die konsolidierten Repo-Fakten und die laufende Projektfortschreibung.

## 3. Aktueller repo-gebundener Kontext

### 3.1 Bereits vorhanden

Im Repo sind bereits folgende Bausteine sichtbar:
- gruener automatisierter Vitest-Korridor
- reproduzierbarer `npm run build`-Pfad
- schmale UI-/Smoke-Grundlage fuer die Kernrouten
- bestehende Freigabe- und Abnahmebasis ueber P15
- Beta-Auswertung und Go/No-Go-Rahmen ueber P20
- Uebergang zu intern nutzbarem Produktstatus ueber P21
- Restpunkt- und Nachziehrahmen vor Beta-Abschluss ueber P22
- read-only Exportpfade fuer Angebot, Produktionsblatt und Einkaufsliste
- Review-/Audit-Sicht fuer interne Betriebs- und Kontrollnachweise
- manuelle Fallbacks und Datenkorrekturen als gesondert begrenzte Rahmen
- PR-/Commit-/Dokument-/memory-Fortschreibung als laufende repo-nahe Entscheidungs- und Aenderungsspur

### 3.2 Fuer den MVP ausreichend und verbindlich

Fuer einen dokumentarisch sauberen Beta-Abschluss ist im MVP verbindlich anzunehmen:
- die technische Basis ist ueber Test, Build und Smoke belastbar genug, damit der Beta-Abschnitt nicht nur subjektiv, sondern reproduzierbar eingeordnet werden kann
- die Go-/No-Go- und Abnahmekriterien aus P15, P20 und P21 sind nicht widerspruechlich zum Abschlussstand
- die Restpunkt-Einordnung aus P22 ist geklaert genug, sodass nur noch bewusst tolerierte Punkte offen bleiben
- der Beta-Abschnitt kann intern als abgeschlossen gelten, wenn der Stand dokumentarisch konsistent ist und keine Grundblocker mehr sichtbar sind
- PR, Doku und memory bleiben die kleinste tragende Dokumentationsspur fuer diese Schlussbewertung

### 3.3 Welche wenigen Unterlagen konsistent vorliegen sollten

Ein Beta-Abschnitt soll im MVP als dokumentarisch sauber abgeschlossen gelten koennen, wenn im Kern diese wenigen Unterlagen konsistent vorliegen:
- eine kleine, nachvollziehbare Schlussbeschreibung im PR oder in der dazugehoerigen Doku
- die zugehoerige Mini-Spezifikation oder Folge-Doku zur Beta-Einordnung
- ein konsistenter Memory-Eintrag, der den Abschlussstatus knapp festhaelt
- ein gruenes Test-/Build-Ergebnis als technische Schlussbasis
- der Bezug zu P20, P21 und P22 ohne Widerspruch

### 3.4 Welche kleineren offenen Punkte noch tolerierbar sein koennen

Tolerierbar koennen im MVP noch sein:
- kleine sprachliche Feinschliffe ohne fachliche Wirkung
- einzelne begrenzte Rueckfragen, sofern sie den Abschluss nicht grundlegend unscharf machen
- kleine dokumentarische Randluecken, wenn der Kernstand trotzdem nachvollziehbar bleibt
- bewusst offene Anschlussfragen, die nicht mehr den Beta-Abschluss selbst betreffen

### 3.5 Welche Dokumentationsluecken eher gegen einen sauberen Beta-Abschluss sprechen

Eher gegen einen sauberen Beta-Abschluss sprechen:
- unklare oder widerspruechliche Aussagen zwischen P20, P21, P22 und der Abschluss-Doku
- fehlende oder gebrochene Nachvollziehbarkeit des letzten Beta-Standes
- offene Grundblocker in Test, Build oder Smoke
- eine Lage, in der der Abschlussstand nur mit einem formalen Release-, QA- oder Governance-System plausibel waere
- ein Memory-Stand, der den Repo-Istzustand nicht konsistent wiedergibt

### 3.6 Wie PR, Doku und memory fuer die knappe Abschlusssicht genutzt werden

Im bestehenden MVP-Rahmen gilt:
- PRs halten die konkrete Aenderung und die sichtbare Abschlussentscheidung fest
- Doku hält die fachliche Abschlusssicht und die Repo-Einordnung fest
- `memory.md` hält den konsolidierten, dauerhaften Repo-Stand fest
- zusammen bilden sie die kleine Abschluss- und Dokumentationsspur, ohne ein formales Abschluss-, QA- oder Governance-System zu ersetzen

## 4. Kleinste MVP-Festlegung

### 4.1 Wann der Beta-Abschnitt intern als dokumentarisch sauber abgeschlossen gelten kann

Der Beta-Abschnitt soll im MVP als intern dokumentarisch sauber abgeschlossen gelten koennen, wenn:
1. der Beta-Stand fachlich durch P20 eingeordnet ist
2. der Uebergang in den intern nutzbaren Produktstatus durch P21 nicht im Widerspruch zum Abschluss steht
3. die Restpunkte vor Abschluss durch P22 entweder nachgezogen oder bewusst als tolerierbar festgehalten sind
4. die Schlussdoku den letzten Stand knapp und konsistent beschreibt
5. `memory.md` den Abschlussstatus in verdichteter Form nachvollziehbar abbildet
6. Test, Build und relevante Smoke-Basis gruen sind oder als explizit akzeptierte Basis vorliegen

### 4.2 Welche wenigen Dokumente und Nachweise konsistent vorliegen sollten

Mindestens sinnvoll sind:
- die passende Beta-Gate-Mini-Spezifikation oder deren direkte Nachfolgedoku
- ein kurzer Abschlussvermerk im PR oder in der dazugehoerigen Dokumentation
- ein konsistenter Memory-Eintrag
- gruene technische Basissignale aus Test und Build
- der klare Bezug auf P20, P21 und P22

### 4.3 Welche kleineren offenen Punkte dabei noch tolerierbar sind

Im MVP koennen noch tolerierbar sein:
- rein textliche Nachschaerfungen
- kleine Begriffsangleichungen
- abgrenzbare Rueckfragen ohne Einfluss auf den Abschlusskern
- geringe operative Anschlussfragen, sofern sie nicht den Beta-Abschluss selbst betreffen

### 4.4 Welche Dokumentationsluecken eher gegen einen sauberen Beta-Abschluss sprechen

Eher dagegen sprechen:
- fehlende Schlussdoku
- unvollstaendige oder widerspruechliche Aussagen in P20 bis P22
- ein Memory-Stand ohne erkennbaren Abschlussbezug
- offene technische Grundblocker
- ein Stand, der nur mit einem formalen Abschlussprozess glaubhaft gemacht werden koennte

### 4.5 Wie PR, Dokumente und memory fuer die Abschlusssicht genutzt werden

- PR dient als sichtbare Aenderungs- und Abschlussspur
- Doku dient als fachlicher Abschlussanker
- `memory.md` dient als verdichteter Langzeitanker des Beschlusses

Wenn die Abschlusssicht nicht sauber einordenbar ist, soll sie sichtbar offen bleiben, statt in ein neues formales System verschoben zu werden.

### 4.6 Was im MVP bewusst noch kein formales Abschluss- oder Governance-Modell ist

Der minimale Beta-Abschluss- und Dokumentationsstand im MVP ist ausdruecklich noch kein formales Modell:
- kein Abschlussgremium
- kein formales Sign-off-System
- kein vollständiges Audit-/Compliance-Abschlussmodell
- kein Release-Management-System
- kein formales QA-System
- kein Governance-System
- keine neuen Endpunkte
- keine neue Persistenzlogik
- keine neue Produktfamilie

## 5. Klare Abgrenzung

Diese Mini-Spezifikation fuehrt ausdruecklich nicht ein:
- kein Abschlussgremium
- kein formales Sign-off-System
- kein vollständiges Audit-/Compliance-Abschlussmodell
- kein Release-Management-System
- kein formales QA-System
- kein Governance-System
- keine neuen Endpunkte
- keine neue Persistenzlogik
- keine neue Produktfamilie

Der Beta-Abschluss bleibt damit bewusst klein und an den vorhandenen Repo-Bausteinen orientiert.

## 6. Offene Punkte

Bewusst offen bleibt:
- ob spaeter zwischen dokumentarischem Beta-Abschluss, internem Produktstatus und formaler Freigabe strenger getrennt werden muss
- wie weit ein spaeterer Betrieb formale Rollen fuer Abschluss, Rueckfrage und Entscheidung braucht
- ob einzelne Abschlusskriterien spaeter in ein strukturierteres Betriebs- oder Governance-Modell ueberfuehrt werden sollen
- welche Teile der heutigen PR-/Doku-/memory-Fortschreibung spaeter formalisiert werden muessen
- ob ein spaeterer Produkt- oder Betriebsausbau mehr Detailtiefe, mehr Koordination oder mehr Nachverfolgung verlangt

Diese Punkte sind noch nicht durch ein echtes Abschluss-, Release- oder Governance-Modell geklaert und sollen deshalb hier nicht vorweggenommen werden.

## 7. Empfohlener kleinster naechster Schritt

Der naechste Schritt sollte weiterhin nur Klärung und Begrenzung sein, nicht Implementierung:
1. die hier genannten Minimalregeln als internen Referenzrahmen festhalten
2. die Grenze zwischen dokumentarischem Beta-Abschluss und weiterem Produkt-/Betriebsausbau klar benennen
3. weitere Release-, QA- oder Governance-Strukturen erst spaeter explizit beauftragen

## 8. Einordnung

Diese Mini-Spezifikation ist absichtlich konservativ.
Sie soll den minimalen internen Beta-Abschluss- und Dokumentationsstand fachlich begrenzen, ohne ein formales Release-, QA- oder Governance-Modell zu erfinden.

Alles darueber hinaus bleibt spaeteren, explizit beauftragten Schritten vorbehalten.
