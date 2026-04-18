# P22 Minimaler Restpunkt- und Nachziehrahmen vor Beta-Abschluss im MVP – Mini-Spezifikation

Status: Mini-Spezifikation v0.1 auf Basis des aktuellen Repo-Iststands
Stand: 2026-04-16

## 1. Zweck und Abgrenzung

Diese Mini-Spezifikation begrenzt den minimalen internen Restpunkt- und Nachziehrahmen vor Beta-Abschluss fuer den MVP der `AlexanderSmyslowski/catering-agents-platform`.

Sie erfindet kein formales Defect-Management, kein Ticket-Triage-System, kein Priorisierungsboard und kein formales QA-System. Ziel ist ausschliesslich, den Umgang mit kleinen Restpunkten vor einem sauberen Beta-Abschluss fachlich einzuordnen, ohne daraus eine neue Produkt- oder Prozessfamilie zu machen.

## 2. Bezug auf Pflichtenheft, MVP-Arbeitspakete, P15, P17, P19, P20, P21 und Memory

Grundlagen dieses Dokuments sind:
- `docs/product/PFLICHTENHEFT.md`
- `docs/product/MVP_ARBEITSPAKETE.md`
- `docs/product/P15_MINIMALER_INTERNER_ABNAHMEPROZESS_MVP_MINISPEZ.md`
- `docs/product/P17_MINIMALER_INTERNER_BETRIEBSSTATUS_UND_LAGEUEBERBLICK_MVP_MINISPEZ.md`
- `docs/product/P19_MINIMALER_INTERNER_BETA_DURCHFUEHRUNGSRAHMEN_MVP_MINISPEZ.md`
- `docs/product/P20_MINIMALER_INTERNER_BETA_AUSWERTUNGS_UND_GO_NO_GO_RAHMEN_MVP_MINISPEZ.md`
- `docs/product/P21_MINIMALER_UEBERGANG_VON_BETA_ZU_INTERN_NUTZBAREM_PRODUKTSTATUS_MVP_MINISPEZ.md`
- `memory.md`
- der aktuelle Repo-Iststand in den Test-/Build-/Smoke-Pfaden, der bestehenden Freigabe- und Abnahmebasis, dem internen Betriebsstatus-/Lageueberblick, dem internen Beta-Durchfuehrungsrahmen, der Beta-Auswertung und dem Go/No-Go-Rahmen, dem Uebergang zu intern nutzbarem Produktstatus sowie den manuellen Fallbacks, operativen Exporten und der Review-/Audit-Sicht

Wesentliche Ableitung:
- Das Pflichtenheft beschreibt eine interne, nachvollziehbare Betriebsplattform mit operativen Artefakten.
- Die MVP-Arbeitspakete ordnen die naechsten kleinen Schritte konservativ.
- P15 begrenzt die kleinste interne Abnahme auf bestehende Test-, Build-, Rollen-, Export- und Audit-/Review-Kontexte.
- P17 begrenzt den internen Lageueberblick auf wenige technische, fachliche und betriebliche Signale.
- P19 begrenzt den internen Beta-Durchlauf auf einen kontrollierten, kleinen internen Rahmen.
- P20 begrenzt die knappe Auswertung dieses Beta-Durchlaufs und die Einordnung in tragfaehig, nachzuschaerfen oder vorerst zu stoppen.
- P21 begrenzt den Uebergang von Beta zu intern nutzbarem Produktstatus.
- P22 ordnet nun die Behandlung kleiner Restpunkte vor Beta-Abschluss ein, ohne daraus ein formales Backlog-, QA- oder Release-Management zu machen.
- `memory.md` bleibt der Kurzanker fuer die konsolidierten Repo-Fakten und die laufende Projektfortschreibung.

## 3. Aktueller repo-gebundener Kontext

### 3.1 Bereits vorhanden

Im Repo sind bereits folgende Bausteine sichtbar:
- gruener automatisierter Vitest-Korridor
- reproduzierbarer `npm run build`-Pfad
- schmale UI-/Smoke-Grundlage fuer die Kernrouten
- bestehende Freigabe- und Abnahmebasis ueber P15
- schmaler interner Lageueberblick ueber P17
- interner Beta-Durchfuehrungsrahmen ueber P19
- Beta-Auswertung und Go/No-Go-Rahmen ueber P20
- Uebergang zu intern nutzbarem Produktstatus ueber P21
- sichtbare Klaerung und Eskalation ueber P18
- read-only Exportpfade fuer Angebot, Produktionsblatt und Einkaufsliste
- Review-/Audit-Sicht fuer interne Betriebs- und Kontrollnachweise
- manuelle Fallbacks und Datenkorrekturen als gesondert begrenzte Rahmen
- PR-/Commit-/Dokument-/memory-Fortschreibung als laufende repo-nahe Entscheidungs- und Aenderungsspur

### 3.2 Fuer den MVP ausreichend und verbindlich

Fuer den Umgang mit Restpunkten vor Beta-Abschluss ist im MVP verbindlich anzunehmen:
- die technische Basis ist ueber Test, Build und Smoke bereits belastbar genug, um kleine Restpunkte nicht blind zu lassen
- die Go-/No-Go- und Abnahmekriterien aus P15, P19, P20 und P21 bilden den Bewertungsrahmen
- der Lageueberblick aus P17 zeigt, ob Restpunkte technische, fachliche oder betriebliche Grundsignale beruehren
- der Klaerungs- und Eskalationspfad aus P18 steht bereit, wenn ein Restpunkt nicht knapp eingeordnet werden kann
- manuelle Fallbacks und operative Exporte bleiben als Rueckfall- und Plausibilisierungsebene verfuegbar
- Review-/Audit-Sicht bleibt vorhanden, um Restpunkte intern nachvollziehbar einzuordnen

### 3.3 Welche Arten kleiner Restpunkte vor Beta-Abschluss tolerierbar sein koennen

Tolerierbar koennen im MVP kleine Restpunkte sein, wenn sie den Beta-Abschluss nicht grundlegend blockieren:
- knappe Dokumentationsluecken, sofern der Kernkontext nachvollziehbar bleibt
- sprachliche oder begriffliche Nachschaerfungen ohne technische Wirkung
- nicht-kritische offene Fragen, die die Nutzung intern nicht unsicher machen
- kleine, bekannte Betriebsannahmen, die bereits sichtbar gemacht sind
- minimale Ergaenzungen an Hinweisen, Abgrenzungen oder internen Formulierungen

### 3.4 Welche Restpunkte eher vor Abschluss noch nachgezogen werden sollten

Eher vor Abschluss nachgezogen werden sollten Restpunkte, wenn sie die Schlussbewertung besser absichern:
- offene Punkte, die die technische Nachvollziehbarkeit eines Kernpfads betreffen
- fachliche Unklarheiten bei zentralen Exporten oder sichtbaren Artefakten
- betriebliche Uneindeutigkeiten, die den intern nutzbaren Produktstatus unscharf machen wuerden
- kleine Korrekturen an Doku oder memory, die einen ansonsten klaren Stand deutlich sauberer machen
- offene Rueckfragen, die sich mit wenig Aufwand ueber P18 oder vorhandene Repo-Artefakte klaeren lassen

### 3.5 Welche offenen Punkte eher gegen einen sauberen Beta-Abschluss sprechen

Eher gegen einen sauberen Beta-Abschluss sprechen:
- neue Grundblocker in Test, Build oder Smoke
- widerspruechliche oder nicht mehr plausible Exporte
- ungeklaerte oder wiederkehrende Klaerungsfaelle mit Grundblocker-Charakter
- gebrochene Review-/Audit-Nachvollziehbarkeit
- eine Lage, in der der Beta-Auswertungsrahmen aus P20 eher Stop als Fortsetzung nahelegt
- offene Punkte, die bereits ein formales Backlog-, QA- oder Release-System verlangen wuerden

### 3.6 Wie technische, fachliche und betriebliche Restpunkte voneinander abzugrenzen sind

Im MVP sollen Restpunkte knapp in drei Ebenen getrennt werden:
- technische Restpunkte: Test-, Build-, Smoke- oder Stabilitaetsfragen
- fachliche Restpunkte: Export-, Artefakt- oder Plausibilitaetsfragen
- betriebliche Restpunkte: Fallbacks, Verantwortung, Lage oder dokumentarische Luecken

Die Abgrenzung soll bewusst klein bleiben:
1. zuerst Restpunkt sichtbar machen
2. dann grob einer der drei Ebenen zuordnen
3. dann entscheiden, ob er vor Abschluss nachgezogen, toleriert oder als offener Restpunkt festgehalten wird

### 3.7 Rolle von PR, Doku und memory

Im bestehenden MVP-Rahmen gilt:
- PRs halten die konkrete Aenderung und die sichtbare Nachzieh- oder Restpunktentscheidung fest
- Doku hält die fachliche Einordnung eines Restpunkts fest
- `memory.md` hält den konsolidierten, dauerhaften Repo-Stand fest
- zusammen bilden sie die kleine Restpunkt- und Nachziehspur, ohne ein formales Defect-, QA- oder Release-Management zu ersetzen

## 4. Kleinste MVP-Festlegung

### 4.1 Welche Arten kleiner Restpunkte vor Beta-Abschluss tolerierbar sein koennen

Im MVP koennen vor Beta-Abschluss vor allem solche Restpunkte tolerierbar sein:
- rein textliche oder begriffliche Feinschliffe
- nicht-kritische Dokumentationsnotizen
- kleine Klarstellungen, die keinen Kernpfad beruehren
- bewusst offene Randfragen, sofern sie die Nutzung nicht blockieren

### 4.2 Welche Restpunkte eher noch nachgezogen werden sollten

Eher nachziehen sollte man im MVP Restpunkte, wenn:
- sie einen Kernpfad, Export oder sichtbare Betriebslogik beruehren
- sie die interne Nachvollziehbarkeit unnötig unscharf machen
- sie mit wenig Aufwand vor Beta-Abschluss sauberer gezogen werden koennen
- sie sonst spaeter in einen unnoetigen offenen Zweifel uebergehen wuerden

### 4.3 Welche offenen Punkte eher gegen einen sauberen Beta-Abschluss sprechen

Gegen einen sauberen Beta-Abschluss sprechen eher:
- offene technische Basisfragen
- offene fachliche Widersprueche in zentralen Artefakten
- betriebliche Unklarheiten mit Eskalations- oder Fallback-Charakter
- dokumentarische Luecken, die den intern nutzbaren Produktstatus unsauber machen wuerden

### 4.4 Wie PR, Doku und memory fuer die Restpunktbewertung und Nachziehentscheidung genutzt werden

- PR dient als Ort fuer die sichtbare Aenderung oder Nachziehentscheidung
- Doku dient als Ort fuer die knappe fachliche Einordnung des Restpunkts
- `memory.md` dient als dauerhafte Verdichtung des beschlossenen Restpunktstatus

Wenn ein Restpunkt nicht sauber einordenbar ist, soll er lieber sichtbar offen bleiben, statt in ein neues formales System verschoben zu werden.

### 4.5 Was im MVP bewusst noch kein formales Backlog-, QA- oder Release-Management ist

Der minimale Restpunkt- und Nachziehrahmen im MVP ist ausdruecklich noch kein formales Managementmodell:
- kein vollständiges Defect-Management
- kein Ticket-Triage-System
- kein Priorisierungsboard
- kein Release-Management-System
- kein formales QA-System
- keine neuen Endpunkte
- keine neue Persistenzlogik
- keine neue Produktfamilie

P22 beschreibt nur den kleinsten internen Umgang mit Restpunkten vor Beta-Abschluss.

## 5. Klare Abgrenzung

Diese Mini-Spezifikation fuehrt ausdruecklich nicht ein:
- kein vollständiges Defect-Management
- kein Ticket-Triage-System
- kein Priorisierungsboard
- keine neuen Endpunkte
- keine neue Persistenzlogik
- keine neue Produktfamilie

Der Restpunkt- und Nachziehrahmen bleibt damit bewusst klein und an den vorhandenen Repo-Bausteinen orientiert.

## 6. Offene Punkte

Bewusst offen bleibt:
- ob spaeter zwischen Restpunkten vor Beta-Abschluss, Restpunkten nach Beta-Abschluss und laufender Pflege strenger getrennt werden muss
- wie weit ein spaeterer Betrieb formale Rollen fuer Nachziehen, Sichtung und Entscheidung braucht
- ob einzelne Restpunktkategorien spaeter in ein strukturierteres Betriebs- oder QA-Modell ueberfuehrt werden sollen
- welche Teile der heutigen PR-/Doku-/memory-Fortschreibung spaeter formalisiert werden muessen
- ob ein spaeterer Produkt- oder Betriebsausbau mehr Detailtiefe, mehr Koordination oder mehr Nachverfolgung verlangt

Diese Punkte sind noch nicht durch ein echtes Defect-, QA- oder Release-Management geklaert und sollen deshalb hier nicht vorweggenommen werden.

## 7. Empfohlener kleinster naechster Schritt

Der naechste Schritt sollte weiterhin nur Klärung und Begrenzung sein, nicht Implementierung:
1. die hier genannten Minimalregeln als internen Referenzrahmen festhalten
2. die Grenze zwischen tolerierbarem Restpunkt und vor Abschluss nachzuziehender Aenderung klar benennen
3. weitere Defect-, QA- oder Release-Strukturen erst spaeter explizit beauftragen

## 8. Einordnung

Diese Mini-Spezifikation ist absichtlich konservativ.
Sie soll den aktuellen Umgang mit Restpunkten vor Beta-Abschluss fachlich begrenzen, ohne ein formales Defect-, QA- oder Release-Management zu erfinden.

Alles darueber hinaus bleibt spaeteren, explizit beauftragten Schritten vorbehalten.
