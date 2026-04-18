# P12 Demo-/Seed-Daten und zulässige Nutzung im MVP – Mini-Spezifikation

Status: Mini-Spezifikation v0.1 auf Basis des aktuellen Repo-Iststands
Stand: 2026-04-16

## 1. Zweck und Abgrenzung

Diese Mini-Spezifikation begrenzt Demo-/Seed-Daten und ihre zulässige Nutzung im MVP der `AlexanderSmyslowski/catering-agents-platform`.

Sie erfindet keine neue Testdatenplattform, keine automatische Datenbereinigung, keine neue Migrations- oder Reset-Architektur und keine neue Produktfamilie. Ziel ist ausschliesslich, den bereits realen MVP-Kern so einzuordnen, dass klar bleibt:
- was bereits vorhanden ist
- wofuer Demo-/Seed-Daten im MVP zulässig sind
- wofuer sie ausdrücklich nicht genutzt werden sollen
- wie sie fachlich von realen operativen Daten abzugrenzen sind

## 2. Bezug auf Pflichtenheft, MVP-Arbeitspakete, P1, P5, P10 und Memory

Grundlagen dieses Dokuments sind:
- `docs/product/PFLICHTENHEFT.md`
- `docs/product/MVP_ARBEITSPAKETE.md`
- `docs/product/P1_ROLLEN_RECHTE_MINISPEZ.md`
- `docs/product/P5_MVP_ABGRENZUNG_MINISPEZ.md`
- `docs/product/P10_MANUELLE_BETRIEBSINTERVENTIONEN_UND_FALLBACKS_MINISPEZ.md`
- `memory.md`
- der aktuelle Repo-Iststand in den Seed-/Demo-Pfaden, im Audit-/Betriebs-/Operator-Kontext und in den read-only Kontextelementen

Wesentliche Ableitung:
- Das Pflichtenheft beschreibt eine interne, nachvollziehbare Betriebsplattform mit operativen Artefakten.
- Die MVP-Arbeitspakete halten Rollen, Betrieb und Abgrenzung bewusst klein.
- P1 begrenzt die mutierenden Kernpfade ueber Rollen und Guards.
- P5 grenzt die MVP-Kerne pro Bereich ab.
- P10 begrenzt manuelle Betriebsinterventionen und Fallbacks.
- P12 begrenzt nun die Demo-/Seed-Nutzung innerhalb dieser bestehenden Grenzen und macht deutlich, dass Seed-Daten Betriebs- und Verifikationshilfen sind, keine neue Datenwelt.
- `memory.md` bleibt der Kurzanker fuer die konsolidierten Repo-Fakten.

## 3. Aktueller repo-gebundener Kontext

### 3.1 Bereits vorhanden

Im Repo sind bereits folgende Bausteine sichtbar:
- bestehende Seed-/Demo-Pfade fuer Intake, Angebot und Produktion
- Audit-/Betriebs-/Operator-Kontext mit `x-actor-name`
- geschuetzte mutierende Kernpfade im MVP
- read-only Detail-, Export- und Audit-Kontexte
- bestehende Exportpfade fuer Angebot, Produktionsblatt und Einkaufsliste
- manuelle Fallbacks und Betriebsinterventionen als gesondert begrenzter Rahmen

### 3.2 Fuer den MVP zulässig und verbindlich

Fuer den MVP ist verbindlich anzunehmen:
- Demo-/Seed-Daten duerfen zum lokalen oder servernahen Aufsetzen eines reproduzierbaren Betriebszustands verwendet werden
- Demo-/Seed-Daten duerfen zur Verifikation von Kernpfaden, Audit-Sichtbarkeit und operativen UI-Kontexten verwendet werden
- Demo-/Seed-Daten duerfen innerhalb des Betriebs-/Audit-Kontexts als bewusst eingesetztes Hilfsmittel fuer interne Verifikation dienen
- Demo-/Seed-Daten duerfen nicht stillschweigend reale operative Daten ersetzen
- Demo-/Seed-Daten duerfen nicht als Grundlage fuer eine neue Datenmanagement- oder Reset-Logik missverstanden werden
- reale operative Daten bleiben fachlich getrennt von Seed-/Demo-Daten zu betrachten

### 3.3 Verhaeltnis zu echten operativen Artefakten

Demo-/Seed-Daten sind im MVP von echten operativen Artefakten fachlich abzugrenzen:
- reale Intake-Spezifikationen, Angebotsentwuerfe, Produktionsplaene und Einkaufslisten haben Vorrang vor Seed-Daten
- Seed-Daten sind vor allem Verifikations-, Demo- und Startdaten
- operative Entscheidungen sollen nicht stillschweigend auf Seed-Daten basieren, wenn echte Daten vorhanden und belastbar sind
- Seed-Daten duerfen operative Artefakte illustrieren, aber nicht ihre fachliche Echtheit behaupten

### 3.4 Verhaeltnis zu read-only Pruefungen, Exports und manuellen Fallbacks

Im bestehenden MVP-Rahmen gilt:
- read-only Pruefungen koennen Seed-Daten nutzen, um Wege, Zustände und Anzeigen zu pruefen
- Exporte koennen Seed-Daten nutzen, um Format, Erreichbarkeit und Artefaktverhalten zu verifizieren
- manuelle Fallbacks koennen Seed-Daten als kontrollierte Basis verwenden, wenn ein Betrieb bewusst wiederhergestellt oder demonstriert werden soll
- Seed-/Demo-Daten sollen dabei nicht als Ersatz fuer echte operative Datenpflege missverstanden werden

## 4. Kleinste MVP-Festlegung

### 4.1 Wofuer Demo-/Seed-Daten im MVP zulässig sind

Im MVP sind Demo-/Seed-Daten zulässig fuer:
- lokales Hochfahren des Systems mit bekanntem Startzustand
- Demo- und Verifikationslaeufe im internen Betrieb
- Pruefung von UI-Routen, Exporten, Audit-Sichtbarkeit und mutierenden Kernpfaden im geschuetzten Rahmen
- Wiederherstellung eines bekannten Betriebszustands, wenn dies bewusst fuer Verifikation oder Demonstration gebraucht wird
- operatorseitige interne Tests und Vorfuehrungen

### 4.2 Wofuer sie ausdruecklich nicht genutzt werden sollen

Demo-/Seed-Daten sollen im MVP ausdruecklich nicht genutzt werden fuer:
- Verwechslung mit echten operativen Kunden- oder Produktionsdaten
- fachliche Hauptquelle fuer reale Arbeitsentscheidungen
- dauerhaften Ersatz sauber gefuehrter realer Daten
- stillschweigende Korrektur von Datenqualitaetsproblemen in echten Artefakten
- Aufbau einer neuen Datenmanagement- oder Reset-Plattform

### 4.3 Abgrenzung zu realen operativen Daten

Die fachliche Abgrenzung lautet:
- Seed-/Demo-Daten sind kontrollierte, bewusst gesetzte Hilfsdaten
- reale operative Daten sind die Grundlage fuer echte Nutzung und echte Nachpflege
- Seed-/Demo-Daten duerfen echte Abläufe nachstellen, aber nicht als echt interpretiert werden
- sobald echte Daten vorhanden sind, muss die fachliche Entscheidung an ihnen ausgerichtet bleiben

### 4.4 Nutzung nur im Betriebs-/Audit-Kontext

Folgende Nutzung ist nur im Betriebs-/Audit-Kontext zulässig:
- Seeden von Demo-Daten ueber die bereits geschuetzten Seed-Pfade
- Ausfuehrung von Seed-Daten als Betriebsaktion unter passendem Operator-Kontext
- Auditierung von Seed-/Demo-Aktionen als sichtbare Betriebs- und Verifikationsspuren
- kontrolliertes Wiederholen von Demo- oder Seed-Läufen zur Verifikation

## 5. Klare Abgrenzung

Diese Mini-Spezifikation fuehrt ausdruecklich nicht ein:
- keine neue Testdatenplattform
- keine automatische Datenbereinigung
- keine neue Migrations- oder Reset-Architektur
- keine neuen Endpunkte
- keine neue Persistenzlogik
- keine neue Produktfamilie

P12 ordnet nur die zulässige Demo-/Seed-Nutzung des bestehenden MVP-Kerns ein.

## 6. Offene Punkte

Bewusst offen bleibt:
- wie spaeter zwischen Demo-, Test- und Betriebsdaten noch feiner unterschieden werden soll
- ob bestimmte Seed-Daten spaeter durch produktnahe Beispieldaten ersetzt werden sollen
- wie weit ein spaeterer Betriebs- oder Produktionsausbau eine strengere Datenklassenlogik braucht
- welche Teile der Seed-/Demo-Nutzung nur organisatorisch und welche spaeter technisch hart gefuehrt werden muessen
- ob die heutige Seed-Nutzung spaeter um eine formale Lösch- oder Erneuerungslogik ergaenzt wird

Diese Punkte sind noch nicht durch einen echten Datenmanagement-Ausbau geklaert und sollen deshalb hier nicht vorweggenommen werden.

## 7. Empfohlener kleinster naechster Schritt

Der naechste Schritt sollte weiterhin nur Klärung und Begrenzung sein, nicht Implementierung:
1. die hier genannten Seed-/Demo-Zwecke als internen Referenzrahmen festhalten
2. die Grenze zwischen echten operativen Daten und Seed-/Demo-Daten klar benennen
3. weitere Datenmanagement- oder Reset-Funktionen erst spaeter explizit beauftragen

## 8. Einordnung

Diese Mini-Spezifikation ist absichtlich konservativ.
Sie soll den aktuellen MVP-Kern fuer Demo-/Seed-Nutzung fachlich einordnen, ohne eine neue Datenmanagement-Plattform zu erfinden.

Alles darueber hinaus bleibt spaeteren, explizit beauftragten Schritten vorbehalten.
