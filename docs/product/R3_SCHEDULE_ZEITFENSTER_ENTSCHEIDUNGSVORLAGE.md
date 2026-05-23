# R3 Schedule-/Zeitfenster-Entscheidungsvorlage

Status: strukturierte Rueckfrage / Entscheidungsvorlage, keine Runtime-Implementierung
Stand: 2026-05-23
Scope: Umgang mit der Rehearsal-Rueckfrage `Wie lautet das verbindliche Zeitfenster?` aus bestehender `event.schedule`-Uncertainty

## 1. Ausgangsbefund

Im synthetischen internen Rehearsal bleibt nach R2 ein echter fachlicher Befund offen:

- Die Rueckfrage `Wie lautet das verbindliche Zeitfenster?` entsteht aus bestehender `event.schedule`-Uncertainty.
- Die vorhandenen strukturierten Antwortfelder koennen diese Frage nicht sauber fachlich beantworten.
- Eine freie Kurztextantwort waere derzeit nur eine Clarification-Antwort, aber noch kein verbindliches Schedule-/Zeitfenster-Modell.
- Eine automatische Spec-Korrektur aus der Antwort ist weiterhin nicht freigegeben.

Damit ist der naechste Schritt keine Runtime-Aenderung, sondern eine bewusste Produkt-/Datenmodellentscheidung.

## 2. Optionen

### Option A: Vorerst Copy-/Anleitungs-Loesung ohne Datenmodelländerung

Beschreibung: Die Rueckfrage bleibt fachlich als offene Klärung sichtbar. UI-/Runbook-Copy erklaert nur, dass das verbindliche Zeitfenster im Rehearsal manuell notiert und nicht automatisch in die Event-Spec ueberfuehrt wird.

Bewertung:

- MVP-Fit: hoch fuer internen Beta-MVP, weil minimal und risikoarm.
- Produktwert: niedrig bis mittel; Reibung wird erklaert, aber nicht strukturell geloest.
- Implementierungsrisiko: niedrig.
- Datenmodell-/Persistenzrisiko: keines.
- Risiko: Nutzer koennen die Antwort als fachlich verarbeitet missverstehen, wenn Copy nicht klar genug ist.

### Option B: Strukturierte Rueckfrage mit bestehender Spec-Patch-Bindung

Beschreibung: Die Zeitfenster-Rueckfrage wuerde spaeter explizit an eine vorhandene Spec-Patch-/Spec-Korrektur-Grenze gebunden. Eine Antwort waere dann nicht nur Freitext, sondern ein reviewfaehiger Vorschlag zur Korrektur von `event.schedule`.

Bewertung:

- MVP-Fit: mittel; fachlich sauberer als A, aber groesser als ein reiner Rehearsal-Fix.
- Produktwert: hoch fuer spaetere echte Nutzbarkeit, weil Antwort und Spec-Korrektur bewusst verbunden werden.
- Implementierungsrisiko: mittel bis hoch, weil Fragebindung, Review, Patch-Anwendung, Audit und Stop-Gates sauber entschieden werden muessen.
- Datenmodell-/Persistenzrisiko: mittel; keine neue Persistenzwelt noetig, aber die bestehende Spec-Patch-Grenze muesste bewusst als fuehrender Pfad bestaetigt werden.
- Risiko: Zu fruehe Umsetzung wuerde faktisch automatische Spec-Korrektur oder neue Fachableitung einfuehren.

### Option C: Spaeteres eigenes Schedule-/Zeitfenster-Modell

Beschreibung: `event.schedule` bzw. Zeitfenster werden spaeter als eigenes kleines Fachmodell mit Start/Ende, Liefer-/Service-/Abbau-Bezug, Verbindlichkeitsstatus und Reviewgrenze modelliert.

Bewertung:

- MVP-Fit: niedrig fuer den unmittelbaren internen Beta-MVP; wahrscheinlich zu gross.
- Produktwert: hoch fuer spaetere Produktionsreife.
- Implementierungsrisiko: hoch im aktuellen Scope.
- Datenmodell-/Persistenzrisiko: hoch, weil ein neues Fachmodell und ggf. Migration/API/UI-Pfade entschieden werden muessten.
- Risiko: Verfruehter Modellbau verschiebt den MVP von Rehearsal-Stabilisierung zu Produktarchitektur-Ausbau.

## 3. Empfehlung fuer den internen Beta-MVP

Empfohlen wird Option A als konservativer Minimalentscheid fuer den internen Beta-MVP:

- Die bestehende Rueckfrage bleibt sichtbar.
- Es wird klar benannt, dass das verbindliche Zeitfenster im aktuellen Korridor nicht strukturiert in `event.schedule` ueberfuehrt wird.
- Keine Runtime-Logik, keine neue Persistenz, keine API, keine UI-Feature-Umsetzung und keine echte Datenverarbeitung werden eingefuehrt.

Option B ist der naechste fachlich saubere Entscheidungspfad, falls Alexander nach dem Beta-Rehearsal echte strukturierte Zeitfenster-Antworten in Richtung Spec-Korrektur freigeben will.

Option C bleibt ein spaeterer Produktarchitekturpfad und ist fuer den aktuellen Beta-MVP zu gross.

## 4. Nicht-Ziele fuer R3

R3 fuehrt nicht ein:

- kein neues Schedule-/Zeitfenster-Datenmodell,
- keine Migration und keine neue Persistenzwelt,
- keine neue API,
- keine UI-Feature-Umsetzung,
- keine automatische Spec-Korrektur,
- keine automatische Fachableitung aus Clarification-Antworten,
- keine echte Datenverarbeitung,
- keine Produktionsfreigabe,
- kein OAuth/Login/OIDC,
- kein Deployment.

## 5. Stop-Gates

Vor einer Runtime-Umsetzung muss gestoppt werden, wenn einer dieser Punkte beruehrt wird:

1. Eine Antwort soll `event.schedule` automatisch oder halbautomatisch veraendern.
2. Es sollen neue strukturierte Felder fuer Start/Ende/Lieferung/Service/Abbau eingefuehrt werden.
3. Es soll eine neue API, Persistenz, Migration oder UI-Eingabe entstehen.
4. Es sollen echte Kunden-, Personen-, Einsatz- oder Produktionsdaten verarbeitet werden.
5. Die Entscheidung zwischen Spec-Patch-Bindung und eigenem Schedule-Modell ist nicht ausdruecklich getroffen.
6. Audit-/Review-Verantwortung fuer Zeitfenster-Aenderungen ist unklar.

## 6. Rueckfrage an Alexander

Welche Zielrichtung soll nach dem internen Beta-Rehearsal gelten?

A) Vorerst nur Copy-/Anleitung: Zeitfenster bleibt offene Klärung ohne Datenmodelländerung.

B) Strukturierte Zeitfenster-Rueckfrage wird spaeter an bestehende Spec-Patch-/Review-Grenzen gebunden.

C) Spaeter eigenes Schedule-/Zeitfenster-Modell bewusst entwerfen.

Konservative Empfehlung fuer jetzt: A bestaetigen; B nur als naechstes bewusstes Gate vormerken; C zurueckstellen.
