# P14 Audit-/Review-Spuren und operative Nutzung im MVP – Mini-Spezifikation

Status: Mini-Spezifikation v0.1 auf Basis des aktuellen Repo-Iststands
Stand: 2026-04-16

## 1. Zweck und Abgrenzung

Diese Mini-Spezifikation begrenzt die operative Nutzung der Audit-/Review-Spuren im MVP der `AlexanderSmyslowski/catering-agents-platform`.

Sie erfindet keine neue Compliance-Architektur, keine neue Revisions- oder Archivplattform, keine automatische Auswertung oder Eskalationslogik und keine neue Monitoring- oder SIEM-Architektur. Ziel ist ausschliesslich, den bereits realen MVP-Kern der Audit-/Review-Spuren so einzuordnen, dass klar bleibt:
- was bereits vorhanden ist
- wofuer die Audit-/Review-Spuren im internen Betrieb genügen
- wofuer sie nur als Hilfs-/Kontrollnachweis dienen
- wo keine weitergehende Revisionssicherheit behauptet wird

## 2. Bezug auf Pflichtenheft, MVP-Arbeitspakete, P7, P10, P11, P13 und Memory

Grundlagen dieses Dokuments sind:
- `docs/product/PFLICHTENHEFT.md`
- `docs/product/MVP_ARBEITSPAKETE.md`
- `docs/product/P7_BETRIEBSFREIGABE_MVP_FREIGABEKRITERIEN_MINISPEZ.md`
- `docs/product/P10_MANUELLE_BETRIEBSINTERVENTIONEN_UND_FALLBACKS_MINISPEZ.md`
- `docs/product/P11_DATENKORREKTUREN_UND_FACHLICHE_NACHPFLEGE_MINISPEZ.md`
- `docs/product/P13_EXPORT_VERBINDLICHKEIT_UND_OPERATIVE_NUTZUNG_MINISPEZ.md`
- `memory.md`
- der aktuelle Repo-Iststand in den Audit-/Review-Pfaden, in den operativen Kerndaten, in den Exporteinbindungen und in den manuellen Betriebsrahmen

Wesentliche Ableitung:
- Das Pflichtenheft beschreibt operative Entscheidungen über Export, Audit und Review als nachvollziehbar.
- Die MVP-Arbeitspakete halten Betrieb, Audit und Abgrenzung bewusst klein.
- P7 begrenzt den internen Betriebsfreigaberahmen.
- P10 begrenzt manuelle Betriebsinterventionen und Fallbacks.
- P11 begrenzt Datenkorrekturen und fachliche Nachpflege.
- P13 begrenzt Export-Verbindlichkeit als interne Nutzbarkeit ohne Aussenwirkung.
- P14 ordnet nun die Audit-/Review-Spuren selbst als interne Betriebs- und Kontrollnachweise ein und begrenzt deren Anspruch auf die im Repo tatsächlich vorhandenen Pfade.
- `memory.md` bleibt der Kurzanker fuer die konsolidierten Repo-Fakten.

## 3. Aktueller repo-gebundener Kontext

### 3.1 Bereits vorhanden

Im Repo sind bereits folgende Bausteine sichtbar:
- Audit-Log / Audit-Feed ueber Intake, Offer und Production hinweg
- Rezept-Review-Pfade mit Freigabe, Verifizierung oder Ablehnung
- Finalize-Pfad und `pending_reapproval`-nahe Governance-Sichtbarkeit
- Audit-/Review-/Finalize-Nachweise in den geschuetzten Kernpfaden
- Operator-Zuordnung ueber die vorhandene Minimalrollen- und `x-actor-name`-Konvention
- Exportartefakte als operative Ausgabeformen
- manuelle Fallbacks und Datenkorrekturen als gesondert begrenzte Rahmen

### 3.2 Fuer den MVP zulässig und verbindlich

Fuer den MVP ist verbindlich anzunehmen:
- Audit-/Review-Spuren duerfen im internen Betrieb als Nachweis genutzt werden, dass geschuetzte Kernaktionen stattgefunden haben
- Audit-/Review-Spuren duerfen helfen, mutierende Aktionen, Review-Entscheidungen und Betriebslaeufe nachzuvollziehen
- Audit-/Review-Spuren duerfen als Kontrollbasis dienen, bevor ein Operator manuell korrigiert, exportiert oder erneut laeuft
- Audit-/Review-Spuren duerfen im MVP als interne Referenz fuer Betriebs- und Nachvollziehbarkeitsfragen verwendet werden
- Audit-/Review-Spuren genügen im MVP fuer interne Transparenz und Verifikation, nicht fuer eine neue externe Beweiswelt

### 3.3 Verhaeltnis zu operativen Kerndaten

Audit-/Review-Spuren sind im MVP von den operativen Quelldaten fachlich abzugrenzen:
- operative Kerndaten sind die fachliche Quelle
- Audit-/Review-Spuren beschreiben, dass und wie an diesen Daten gearbeitet wurde
- Audit-/Review-Spuren ersetzen nicht die fachliche Quelle
- wenn operative Kerndaten inkonsistent sind, bleibt die Spur ein Nachweis ueber den Zustand, nicht der Zustand selbst

### 3.4 Verhaeltnis zu Exporten

Im bestehenden MVP-Rahmen gilt:
- Exporte sind abgeleitete operative Ausgabeformen
- Audit-/Review-Spuren koennen belegen, dass ein Export oder eine Review-Aktion im internen Betrieb stattgefunden hat
- Exportartefakte bleiben von den Audit-/Review-Spuren fachlich getrennt
- weder Export noch Spur allein begruenden eine neue Freigabe- oder Signaturwahrheit

### 3.5 Verhaeltnis zu manuellen Fallbacks und Datenkorrekturen

Die Nachbarschaft zu manuellen Fallbacks und Datenkorrekturen ist im MVP wichtig:
- ein manueller Fallback kann sich auf Audit-/Review-Spuren stuetzen, um den Zustand einzuordnen
- Datenkorrekturen koennen Audit-/Review-Spuren erzeugen oder verlaengern, bleiben aber fachlich von ihnen getrennt
- eine Korrektur ist nicht automatisch durch die Spur legitimiert; die fachliche Entscheidung bleibt beim Operator
- die Spur hilft bei der Einordnung, ersetzt aber nicht die manuelle Bewertung

## 4. Kleinste MVP-Festlegung

### 4.1 Wofuer Audit-/Review-Spuren im internen Betrieb genuegen

Im MVP genuegen Audit-/Review-Spuren fuer:
- interne Nachvollziehbarkeit mutierender Kernaktionen
- Sichtbarkeit von Review-Entscheidungen und Finalize-Bewegungen
- operative Einordnung von Fehler-, Seed-, Fallback- und Korrekturlagen
- interne Rueckfrage, wer was in welchem Kontext getan hat
- Kontrolle, ob ein Kernpfad geschuetzt und fachlich belegt wurde

### 4.2 Wofuer sie nur als Hilfs-/Kontrollnachweis dienen

Im MVP dienen Audit-/Review-Spuren nur als Hilfs-/Kontrollnachweis fuer:
- die Plausibilisierung von Exporten
- die Einordnung von Datenkorrekturen
- die Bewertung manueller Fallbacks
- die interne Kontrolle eines bereits abgeschlossenen Review- oder Finalize-Vorgangs
- die Rekonstruktion des Ablaufs fuer interne Betriebszwecke

### 4.3 Keine weitergehende Revisionssicherheit, Compliance-Wirkung oder externe Nachweisqualität

Im MVP wird ausdruecklich nicht behauptet:
- dass die Audit-/Review-Spuren eine formale Revisionssicherheit nach aussen herstellen
- dass sie eine neue Compliance-Architektur ersetzen
- dass sie eine rechtliche Nachweisqualitaet ausserhalb des internen Betriebs begruenden
- dass sie eine externe Revisions- oder Signaturwelt ersparen

Die Spuren sind interne Betriebs- und Kontrollnachweise. Mehr wird im MVP nicht zugesagt.

### 4.4 Abgrenzung zu operativen Quelldaten und Exportartefakten

Die fachliche Abgrenzung lautet:
- operative Quelldaten sind die fachliche Ausgangslage
- Audit-/Review-Spuren beschreiben den Weg und die Entscheidungen
- Exportartefakte verdichten die operative Darstellung
- keine dieser Ebenen ersetzt die andere
- bei Widerspruechen muss die fachliche Quelle, die Spur und der Export getrennt beurteilt werden

## 5. Klare Abgrenzung

Diese Mini-Spezifikation fuehrt ausdruecklich nicht ein:
- keine neue Compliance-Architektur
- keine neue Revisions- oder Archivplattform
- keine automatische Auswertung oder Eskalationslogik
- keine neuen Endpunkte
- keine neue Persistenzlogik
- keine neue Produktfamilie

P14 ordnet nur die operative Nutzung der bereits vorhandenen Audit-/Review-Spuren ein.

## 6. Offene Punkte

Bewusst offen bleibt:
- ob spaeter eine strengere Revisionsklassifikation der Spuren noetig wird
- wie weit ein spaeterer Betrieb die Spur als Nachweis gegenueber internen oder externen Stellen verwenden will
- welche Teile der Nachvollziehbarkeit organisatorisch dokumentiert und welche technisch hart gefuehrt werden muessen
- ob der MVP spaeter eine feinere Trennung zwischen Spur, Beleg und Freigabe benoetigt
- welche weiteren Betriebs- oder Governance-Funktionen die Spuren spaeter noch ergaenzen sollen

Diese Punkte sind noch nicht durch einen echten Compliance- oder Revisionsausbau geklaert und sollen deshalb hier nicht vorweggenommen werden.

## 7. Empfohlener kleinster naechster Schritt

Der naechste Schritt sollte weiterhin nur Klärung und Begrenzung sein, nicht Implementierung:
1. die hier genannten Nutzungszwecke der Audit-/Review-Spuren als internen Referenzrahmen festhalten
2. die Grenze zwischen operativer Nachvollziehbarkeit und externer Revisionswirkung klar benennen
3. weitere Compliance-, Revisions- oder Auswertungsfunktionen erst spaeter explizit beauftragen

## 8. Einordnung

Diese Mini-Spezifikation ist absichtlich konservativ.
Sie soll den aktuellen MVP-Kern der Audit-/Review-Spuren fachlich begrenzen, ohne eine neue Compliance-, Revisions- oder Monitoring-Plattform zu erfinden.

Alles darueber hinaus bleibt spaeteren, explizit beauftragten Schritten vorbehalten.
