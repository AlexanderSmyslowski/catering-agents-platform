# P21 Minimaler Uebergang von Beta zu intern nutzbarem Produktstatus im MVP – Mini-Spezifikation

Status: Mini-Spezifikation v0.1 auf Basis des aktuellen Repo-Iststands
Stand: 2026-04-16

## 1. Zweck und Abgrenzung

Diese Mini-Spezifikation begrenzt den minimalen internen Uebergang von Beta zu intern nutzbarem Produktstatus fuer den MVP der `AlexanderSmyslowski/catering-agents-platform`.

Sie erfindet kein formales Release-Management, kein formales Betriebsmodell und kein Support- oder Rollout-System. Ziel ist ausschliesslich, den Punkt fachlich einzuordnen, an dem ein kontrollierter interner Beta-Durchlauf nicht mehr nur als Beta laeuft, sondern als intern tragfaehiger Nutzungsstand gelten kann.

## 2. Bezug auf Pflichtenheft, MVP-Arbeitspakete, P7, P15, P17, P19, P20 und Memory

Grundlagen dieses Dokuments sind:
- `docs/product/PFLICHTENHEFT.md`
- `docs/product/MVP_ARBEITSPAKETE.md`
- `docs/product/P7_BETRIEBSFREIGABE_MVP_FREIGABEKRITERIEN_MINISPEZ.md`
- `docs/product/P15_MINIMALER_INTERNER_ABNAHMEPROZESS_MVP_MINISPEZ.md`
- `docs/product/P17_MINIMALER_INTERNER_BETRIEBSSTATUS_UND_LAGEUEBERBLICK_MVP_MINISPEZ.md`
- `docs/product/P19_MINIMALER_INTERNER_BETA_DURCHFUEHRUNGSRAHMEN_MVP_MINISPEZ.md`
- `docs/product/P20_MINIMALER_INTERNER_BETA_AUSWERTUNGS_UND_GO_NO_GO_RAHMEN_MVP_MINISPEZ.md`
- `memory.md`
- der aktuelle Repo-Iststand in den Test-/Build-/Smoke-Pfaden, der bestehenden Freigabe- und Abnahmebasis, dem internen Betriebsstatus-/Lageueberblick, dem internen Beta-Durchfuehrungsrahmen, der Beta-Auswertung und dem Go/No-Go-Rahmen sowie den manuellen Fallbacks, operativen Exporten und der bestehenden Review-/Audit-Sicht

Wesentliche Ableitung:
- Das Pflichtenheft beschreibt eine interne, nachvollziehbare Betriebsplattform mit operativen Artefakten.
- Die MVP-Arbeitspakete ordnen die naechsten kleinen Schritte konservativ.
- P7 begrenzt den internen Go/No-Go-Rahmen fuer den Betrieb.
- P15 begrenzt die kleinste interne Abnahme auf bestehende Test-, Build-, Rollen-, Export- und Audit-/Review-Kontexte.
- P17 begrenzt den internen Lageueberblick auf wenige technische, fachliche und betriebliche Signale.
- P19 begrenzt den internen Beta-Durchlauf auf einen kontrollierten, kleinen internen Rahmen.
- P20 begrenzt die knappe Auswertung dieses Beta-Durchlaufs und die Einordnung in tragfaehig, nachzusaechern oder vorerst zu stoppen.
- P21 ordnet nun den konservativen Uebergang von Beta zu intern nutzbarem Produktstatus ein, ohne daraus ein formales Release-, Rollout- oder Betriebsmodell zu machen.
- `memory.md` bleibt der Kurzanker fuer die konsolidierten Repo-Fakten und die laufende Projektfortschreibung.

## 3. Aktueller repo-gebundener Kontext

### 3.1 Bereits vorhanden

Im Repo sind bereits folgende Bausteine sichtbar:
- gruener automatisierter Vitest-Korridor
- reproduzierbarer `npm run build`-Pfad
- schmale UI-/Smoke-Grundlage fuer die Kernrouten
- bestehende Freigabe- und Abnahmebasis ueber P7 und P15
- schmaler interner Lageueberblick ueber P17
- interner Beta-Durchfuehrungsrahmen ueber P19
- Beta-Auswertung und Go/No-Go-Rahmen ueber P20
- sichtbare Klaerung und Eskalation ueber P18
- read-only Exportpfade fuer Angebot, Produktionsblatt und Einkaufsliste
- Review-/Audit-Sicht fuer interne Betriebs- und Kontrollnachweise
- manuelle Fallbacks und Datenkorrekturen als gesondert begrenzte Rahmen
- PR-/Commit-/Dokument-/memory-Fortschreibung als laufende repo-nahe Entscheidungs- und Aenderungsspur

### 3.2 Fuer den MVP ausreichend und verbindlich

Fuer den Uebergang zu intern nutzbarem Produktstatus ist im MVP verbindlich anzunehmen:
- die technische Basis ist ueber Test, Build und Smoke bereits belastbar genug, um nicht nur einen Beta-Durchlauf, sondern einen stabilen Nutzungsstand zu tragen
- die Go-/No-Go- und Abnahmekriterien aus P7, P15 und P20 stehen nicht im Widerspruch zueinander
- der Lageueberblick aus P17 zeigt keine offenen Grundblocker, die den Nutzungsstand unsauber machen wuerden
- der Klaerungs- und Eskalationspfad aus P18 steht bereit, wenn der Uebergang noch offene Einordnungen braucht
- der Beta-Durchfuehrungsrahmen aus P19 war kontrolliert genug, um den Schritt in einen intern nutzbaren Stand zu begruenden
- manuelle Fallbacks und operative Exporte bleiben als Rueckfall- und Plausibilisierungsebene verfuegbar
- Review-/Audit-Sicht bleibt vorhanden, um den Stand intern nachvollziehbar einzuordnen

### 3.3 Welche Mindestsignale zusammen gruen genug sein muessen

Ein Stand soll im MVP als intern nutzbarer Produktstatus gelten koennen, wenn mindestens diese Mindestsignale zusammen gruen genug sind:
- technisch: Test und Build laufen, die relevanten Kernrouten sind erreichbar und der Smoke-Korridor bleibt stabil
- fachlich: die operativen Exporte und Artefakte sind plausibel und die Kernsicht bleibt konsistent
- betrieblich: Lageueberblick, Fallbacks und Klaerungsweg machen den Stand intern fuehrbar
- dokumentarisch: PR, Doku und memory bilden den Stand knapp und konsistent ab

### 3.4 Welche Restoffenheiten im MVP noch tolerierbar sind

Tolerierbar bleiben im MVP noch Restoffenheiten, wenn sie den Nutzungsstand nicht grundlegend blockieren:
- einzelne knappe Dokumentationsluecken, sofern der Kernkontext nachvollziehbar bleibt
- operative Randfragen, die ueber P18 oder bestehende Artefakte knapp geklaert werden koennen
- nicht-kritische Nachschaerfungen an Formulierungen, sofern die Nutzung intern klar bleibt
- bekannte kleine Betriebsannahmen, die bewusst sichtbar gemacht sind

### 3.5 Welche offenen Punkte eher gegen einen Uebergang sprechen

Eher gegen einen Uebergang sprechen offene Punkte, wenn sie den Stand als intern nutzbar unsicher machen:
- neue Grundblocker in Test, Build oder Smoke
- widerspruechliche oder nicht mehr plausible Exporte
- ungeklaerte oder wiederkehrende Klaerungsfaelle, die den Betrieb unsauber machen
- fehlende oder gebrochene Review-/Audit-Nachvollziehbarkeit
- eine Lage, in der der Beta-Auswertungsrahmen aus P20 eher Stop als Fortsetzung nahelegt

### 3.6 Rolle von PR, Doku und memory

Im bestehenden MVP-Rahmen gilt:
- PRs halten die konkrete Aenderung und die sichtbare Uebergangsentscheidung fest
- Doku hält die fachliche Einordnung des Standes fest
- `memory.md` hält den konsolidierten, dauerhaften Repo-Stand fest
- zusammen bilden sie die kleine Uebergangsspur, ohne ein formales Freigabe-, Betriebs- oder Steuerungssystem zu ersetzen

## 4. Kleinste MVP-Festlegung

### 4.1 Wann ein Stand nicht mehr nur als Beta-Durchlauf, sondern als intern nutzbarer Produktstatus gelten soll

Ein Stand soll im MVP nicht mehr nur als Beta-Durchlauf gelten, sondern als intern nutzbarer Produktstatus, wenn:
1. die Beta-Durchfuehrung kontrolliert genug war, um den Stand ernsthaft zu tragen
2. die Auswertung aus P20 keinen Stop-Charakter hat
3. die Mindestsignale aus Technik, Fachlichkeit, Betrieb und Dokumentation gemeinsam hinreichend gruen sind
4. offene Punkte nur noch Restoffenheiten sind und keine Grundblocker
5. die Nutzung intern weiterfuehrbar ist, ohne dass ein neues Betriebsmodell erforderlich wird

### 4.2 Wie technische, fachliche und betriebliche Mindestsignale zusammen gruen genug sein muessen

Die Signale gelten im MVP als zusammen gruen genug, wenn:
- technische Signale nicht nur punktuell, sondern als tragfaehiger Grundzustand vorliegen
- fachliche Signale die operativen Artefakte ausreichend plausibel machen
- betriebliche Signale zeigen, dass Lage, Fallbacks und Klaerung den Stand auffangen koennen
- dokumentarische Signale den Stand intern knapp und konsistent beschreiben

### 4.3 Welche Restoffenheiten noch tolerierbar sind

Im MVP sind noch tolerierbar:
- offene Detailfragen, die den produktiven Kern nicht blockieren
- kleine Nachschaerfungen an Begriffen, Markierungen oder Dokumentation
- vereinzelte Rueckfragen, sofern sie den Nutzungsstand nicht grundsaetzlich infrage stellen

### 4.4 Welche Arten offener Punkte eher gegen einen Uebergang sprechen

Eher gegen den Uebergang sprechen:
- offene Punkte mit Grundblocker-Charakter
- wiederkehrende Widersprueche zwischen Technik, Fachlichkeit und Betrieb
- unklare oder gebrochene Nachvollziehbarkeit bei zentralen Artefakten
- eine Lage, in der man fuer den weiteren Betrieb bereits ein formales Release-, Rollout- oder Betriebsmodell braeuchte

### 4.5 Was im MVP bewusst noch kein formales Release-, Rollout- oder Betriebsmodell ist

Der minimale Uebergang von Beta zu intern nutzbarem Produktstatus ist ausdruecklich noch kein formales Modell:
- kein formales Release-Management
- kein formales Betriebsmodell
- kein Support- oder Rollout-System
- kein Produktionsfreigabe-Board
- kein Release-Kalender
- kein Support-/Betriebshandbuch als Vollmodell
- keine neuen Endpunkte
- keine neue Persistenzlogik
- keine neue Produktfamilie

P21 beschreibt nur die kleinste interne Einordnung, ab wann der Beta-Stand als intern nutzbarer Produktstatus gelten kann.

## 5. Klare Abgrenzung

Diese Mini-Spezifikation fuehrt ausdruecklich nicht ein:
- kein Produktionsfreigabe-Board
- kein Release-Kalender
- kein Support-/Betriebshandbuch als Vollmodell
- keine neuen Endpunkte
- keine neue Persistenzlogik
- keine neue Produktfamilie

Der Uebergang bleibt damit bewusst klein und an den vorhandenen Repo-Bausteinen orientiert.

## 6. Offene Punkte

Bewusst offen bleibt:
- ob spaeter zwischen intern nutzbarem Produktstatus, allgemeinem Betrieb und formaler Freigabe strenger getrennt werden muss
- wie weit ein spaeterer Betrieb formale Rollen fuer Beobachtung, Rueckfrage und Entscheidung braucht
- ob einzelne Uebergangskriterien spaeter in ein staerker strukturiertes Betriebsmodell ueberfuehrt werden sollen
- welche Teile der heutigen PR-/Doku-/memory-Fortschreibung spaeter formaler werden muessen
- ob ein spaeterer Produkt- oder Betriebsausbau mehr Detailtiefe, mehr Automatisierung oder mehr Koordination verlangt

Diese Punkte sind noch nicht durch einen echten Release-, Betriebs- oder Steuerungsausbau geklaert und sollen deshalb hier nicht vorweggenommen werden.

## 7. Empfohlener kleinster naechster Schritt

Der naechste Schritt sollte weiterhin nur Klärung und Begrenzung sein, nicht Implementierung:
1. die hier genannten Minimalregeln als internen Referenzrahmen festhalten
2. die Grenze zwischen Beta-Stand und intern nutzbarem Produktstatus klar benennen
3. weitere Release-, Betriebs- oder Steuerungsstrukturen erst spaeter explizit beauftragen

## 8. Einordnung

Diese Mini-Spezifikation ist absichtlich konservativ.
Sie soll den aktuellen Uebergang von Beta zu intern nutzbarem Produktstatus fachlich begrenzen, ohne ein formales Release-, Betriebs- oder Steuerungsmodell zu erfinden.

Alles darueber hinaus bleibt spaeteren, explizit beauftragten Schritten vorbehalten.
