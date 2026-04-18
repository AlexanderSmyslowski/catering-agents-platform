# P20 Minimaler interner Beta-Auswertungs- und Go/No-Go-Rahmen im MVP – Mini-Spezifikation

Status: Mini-Spezifikation v0.1 auf Basis des aktuellen Repo-Iststands
Stand: 2026-04-16

## 1. Zweck und Abgrenzung

Diese Mini-Spezifikation begrenzt den minimalen internen Beta-Auswertungs- und Go/No-Go-Rahmen fuer den MVP der `AlexanderSmyslowski/catering-agents-platform`.

Sie erfindet kein formales QA-System, kein Release-System und kein Steering-System. Ziel ist ausschliesslich, den ersten kontrollierten internen Beta-Durchlauf nach P19 knapp auszuwerten und im bestehenden MVP-Rahmen zu entscheiden, ob die Nutzung fortgesetzt, nachgeschaerft oder vorerst gestoppt werden sollte.

## 2. Bezug auf Pflichtenheft, MVP-Arbeitspakete, P7, P15, P17, P18, P19 und Memory

Grundlagen dieses Dokuments sind:
- `docs/product/PFLICHTENHEFT.md`
- `docs/product/MVP_ARBEITSPAKETE.md`
- `docs/product/P7_BETRIEBSFREIGABE_MVP_FREIGABEKRITERIEN_MINISPEZ.md`
- `docs/product/P15_MINIMALER_INTERNER_ABNAHMEPROZESS_MVP_MINISPEZ.md`
- `docs/product/P17_MINIMALER_INTERNER_BETRIEBSSTATUS_UND_LAGEUEBERBLICK_MVP_MINISPEZ.md`
- `docs/product/P18_MINIMALER_INTERNER_ESKALATIONS_UND_KLAERUNGSPFAD_MVP_MINISPEZ.md`
- `docs/product/P19_MINIMALER_INTERNER_BETA_DURCHFUEHRUNGSRAHMEN_MVP_MINISPEZ.md`
- `memory.md`
- der aktuelle Repo-Iststand in den Test-/Build-/Smoke-Pfaden, der bestehenden Freigabe- und Abnahmebasis, dem internen Betriebsstatus-/Lageueberblick, dem Klaerungs- und Eskalationspfad, dem internen Beta-Durchfuehrungsrahmen sowie den manuellen Fallbacks und operativen Exporten

Wesentliche Ableitung:
- Das Pflichtenheft beschreibt eine interne, nachvollziehbare Betriebsplattform mit operativen Artefakten.
- Die MVP-Arbeitspakete ordnen die naechsten kleinen Schritte konservativ.
- P7 begrenzt den internen Go/No-Go-Rahmen fuer den Betrieb.
- P15 begrenzt die kleinste interne Abnahme auf bestehende Test-, Build-, Rollen-, Export- und Audit-/Review-Kontexte.
- P17 begrenzt den internen Lageueberblick auf wenige technische, fachliche und betriebliche Signale.
- P18 begrenzt die sichtbare Klaerung und Eskalation auf PR-, Doku- und memory-Kontexte.
- P19 begrenzt den internen Beta-Durchlauf auf einen kontrollierten, kleinen internen Rahmen.
- P20 ordnet nun die knappe Auswertung dieses Beta-Durchlaufs und die daraus folgende Go/No-Go-Einordnung ein, ohne ein formales QA-, Release- oder Steering-Modell zu machen.
- `memory.md` bleibt der Kurzanker fuer die konsolidierten Repo-Fakten und die laufende Projektfortschreibung.

## 3. Aktueller repo-gebundener Kontext

### 3.1 Bereits vorhanden

Im Repo sind bereits folgende Bausteine sichtbar:
- gruener automatisierter Vitest-Korridor
- reproduzierbarer `npm run build`-Pfad
- schmale UI-/Smoke-Grundlage fuer die Kernrouten
- bestehende Freigabe- und Abnahmebasis ueber P7 und P15
- schmaler interner Lageueberblick ueber P17
- sichtbare Klaerung und Eskalation ueber P18
- interner Beta-Durchfuehrungsrahmen ueber P19
- read-only Exportpfade fuer Angebot, Produktionsblatt und Einkaufsliste
- manuelle Fallbacks und Datenkorrekturen als gesondert begrenzte Rahmen
- PR-/Commit-/Dokument-/memory-Fortschreibung als laufende repo-nahe Entscheidungs- und Aenderungsspur

### 3.2 Fuer den MVP ausreichend und verbindlich

Fuer die knappe Auswertung eines internen Beta-Durchlaufs im MVP ist verbindlich anzunehmen:
- die technische Basis ist ueber Test, Build und Smoke bereits belastbar genug, um den Durchlauf nicht blind zu bewerten
- die Go-/No-Go- und Abnahmekriterien aus P7 und P15 bilden den Rahmen fuer die Bewertung
- der Lageueberblick aus P17 zeigt, ob technische, fachliche oder betriebliche Grundsignale stabil geblieben sind
- der Klaerungs- und Eskalationspfad aus P18 steht bereit, wenn Auffaelligkeiten nicht knapp eingeordnet werden koennen
- der Beta-Durchfuehrungsrahmen aus P19 bleibt die Referenz fuer den kontrollierten internen Lauf
- manuelle Fallbacks und operative Exporte bleiben als Rueckfall- und Plausibilisierungsebene verfuegbar

### 3.3 Welche Beobachtungen aus dem Beta-Durchlauf auswertungsrelevant sind

Im MVP sollen aus einem internen Beta-Durchlauf nur wenige Beobachtungen ausgewertet werden:
- ob die technischen Kernsignale waehrend des Laufs stabil geblieben sind
- ob die betroffenen Exporte und Kernrouten die erwartete fachliche Plausibilitaet behalten haben
- ob waehrend des Laufs Klaerungsfaelle, Eskalationen oder manuelle Fallbacks notwendig wurden
- ob die dokumentarische Fortschreibung in PR, Doku und memory konsistent geblieben ist
- ob der Lauf neue systematische Unsicherheiten sichtbar gemacht hat

### 3.4 Rolle von PR, Doku und memory

Im bestehenden MVP-Rahmen gilt:
- PRs halten die beobachtete Aenderung, die Rueckfragen und die sichtbare Entscheidungsspur fest
- Doku hält die knappe fachliche Einordnung von Auffaelligkeiten und Resultaten fest
- `memory.md` hält den konsolidierten, dauerhaften Repo-Stand fest
- zusammen bilden sie die kleine Auswertungs- und Go/No-Go-Spur, ohne ein neues Gremium oder Scorecard-System zu ersetzen

## 4. Kleinste MVP-Festlegung

### 4.1 Wie technische, fachliche und betriebliche Auffaelligkeiten zusammengefuehrt werden sollen

Im MVP sollen Auffaelligkeiten aus einem Beta-Durchlauf knapp zusammengefuehrt werden als:
- technische Auffaelligkeiten: Test-, Build-, Smoke- oder Stabilitaetssignale
- fachliche Auffaelligkeiten: Export-, Artefakt- oder Plausibilitaetsfragen
- betriebliche Auffaelligkeiten: Fallbacks, Bedienung, Klarheit der Verantwortlichkeit oder dokumentarische Luecken

Die Zusammenfuehrung soll bewusst klein bleiben:
1. erst sichtbare Beobachtung
2. dann knappe Zuordnung in eine der drei Ebenen
3. dann Entscheidung, ob Fortsetzung, Nachschärfung oder Stop vorliegt

### 4.2 Wann das Ergebnis als tragfaehig genug fuer Fortsetzung gilt

Das Ergebnis eines Beta-Durchlaufs gilt im MVP als tragfaehig genug fuer Fortsetzung, wenn:
- keine neuen Grundblocker sichtbar geworden sind
- die Kernsignale und relevanten Exporte stabil und plausibel geblieben sind
- auftretende Auffaelligkeiten knapp eingeordnet werden konnten
- die dokumentarische Fortschreibung den Lauf ausreichend abbildet
- die naechste kleine Nutzung nicht durch offene Grundwidersprueche blockiert wird

### 4.3 Wann eher Nachschaerfung vor weiterer Nutzung angezeigt ist

Eher Nachschaerfung vor weiterer Nutzung ist angezeigt, wenn:
- der Beta-Durchlauf zwar grundsaetzlich funktioniert hat, aber einzelne Signal- oder Abgrenzungsfragen offen geblieben sind
- wiederholte Rueckfragen zu den gleichen Punkten entstanden sind
- die fachliche Plausibilisierung einzelner Artefakte oder Exporte noch zu grob ist
- eine kleine Korrektur an Doku, Fallback oder Klaerungsweg die naechste Nutzung deutlich sicherer machen wuerde

### 4.4 Wann eher ein vorlaeufiges Stop-/Kein-Go-Signal anzunehmen ist

Ein vorlaeufiges Stop-/Kein-Go-Signal ist im MVP eher anzunehmen, wenn:
- der Beta-Durchlauf einen Grundblocker oder einen wiederkehrenden Widerspruch sichtbar gemacht hat
- technische, fachliche und betriebliche Signale nicht mehr knapp zusammengefuehrt werden koennen
- der Lauf nur durch wiederholte manuelle Sonderwege stabil blieb
- die dokumentarische oder operative Lage ohne klares Nachschaerfungsbild unsauber geworden ist

### 4.5 Was im MVP bewusst noch kein formales QA-, Release- oder Steering-Modell ist

Die minimale interne Beta-Auswertung im MVP ist ausdruecklich noch kein formales Modell:
- kein Abnahmegremium
- kein formales Freigabeboard
- kein KPI-/Scorecard-System
- kein Release-Management-System
- kein Rollout-System
- kein Support-/Ticket-System
- keine neuen Endpunkte
- keine neue Persistenzlogik
- keine neue Produktfamilie

P20 beschreibt nur die kleinste interne Auswertung und Go/No-Go-Einordnung fuer den bestehenden Beta-Rahmen.

## 5. Klare Abgrenzung

Diese Mini-Spezifikation fuehrt ausdruecklich nicht ein:
- kein Abnahmegremium
- kein formales Freigabeboard
- kein KPI-/Scorecard-System
- kein Release-Management-System
- kein Rollout-System
- kein Support-/Ticket-System
- keine neuen Endpunkte
- keine neue Persistenzlogik
- keine neue Produktfamilie

Der Beta-Auswertungs- und Go/No-Go-Rahmen bleibt damit bewusst klein und an den vorhandenen Repo-Bausteinen orientiert.

## 6. Offene Punkte

Bewusst offen bleibt:
- ob spaeter eine strengere Trennung zwischen interner Beta-Auswertung, interner Freigabe und allgemeinem Betrieb benoetigt wird
- wie weit spaetere Betriebsstufen formale Rollen fuer Beobachtung, Rueckfrage und Entscheidung brauchen
- ob einzelne Beta-Erkenntnisse spaeter in ein staerker strukturiertes Betriebsmodell ueberfuehrt werden sollen
- welche Teile der heutigen PR-/Doku-/memory-Fortschreibung spaeter formaler werden muessen
- ob ein spaeterer Produkt- oder Betriebsausbau mehr Detailtiefe, mehr Automatisierung oder mehr Koordination verlangt

Diese Punkte sind noch nicht durch einen echten QA-, Release- oder Steering-Ausbau geklaert und sollen deshalb hier nicht vorweggenommen werden.

## 7. Empfohlener kleinster naechster Schritt

Der naechste Schritt sollte weiterhin nur Klärung und Begrenzung sein, nicht Implementierung:
1. die hier genannten Minimalregeln als internen Referenzrahmen festhalten
2. die Grenze zwischen tragfaehig, nachzuschaerfen und vorerst zu stoppen klar benennen
3. weitere QA-, Release- oder Steering-Strukturen erst spaeter explizit beauftragen

## 8. Einordnung

Diese Mini-Spezifikation ist absichtlich konservativ.
Sie soll den aktuellen MVP-Beta-Auswertungs- und Go/No-Go-Rahmen fachlich begrenzen, ohne ein formales QA-, Release- oder Steering-System zu erfinden.

Alles darueber hinaus bleibt spaeteren, explizit beauftragten Schritten vorbehalten.
