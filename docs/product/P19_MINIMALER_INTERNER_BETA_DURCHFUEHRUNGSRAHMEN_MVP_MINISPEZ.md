# P19 Minimaler interner Beta-Durchfuehrungsrahmen im MVP – Mini-Spezifikation

Status: Mini-Spezifikation v0.1 auf Basis des aktuellen Repo-Iststands
Stand: 2026-04-16

## 1. Zweck und Abgrenzung

Diese Mini-Spezifikation begrenzt den minimalen internen Beta-Durchfuehrungsrahmen fuer den MVP der `AlexanderSmyslowski/catering-agents-platform`.

Sie erfindet kein Release-Management-System, kein Rollout-System und kein Support-/Ticket-System. Ziel ist ausschliesslich, einen ersten kontrollierten internen Beta-Durchlauf im bestehenden MVP-Rahmen fachlich sauber einzuordnen, ohne daraus eine neue Produkt- oder Betriebsfamilie zu machen.

## 2. Bezug auf Pflichtenheft, MVP-Arbeitspakete, P7, P15, P17, P18 und Memory

Grundlagen dieses Dokuments sind:
- `docs/product/PFLICHTENHEFT.md`
- `docs/product/MVP_ARBEITSPAKETE.md`
- `docs/product/P7_BETRIEBSFREIGABE_MVP_FREIGABEKRITERIEN_MINISPEZ.md`
- `docs/product/P15_MINIMALER_INTERNER_ABNAHMEPROZESS_MVP_MINISPEZ.md`
- `docs/product/P17_MINIMALER_INTERNER_BETRIEBSSTATUS_UND_LAGEUEBERBLICK_MVP_MINISPEZ.md`
- `docs/product/P18_MINIMALER_INTERNER_ESKALATIONS_UND_KLAERUNGSPFAD_MVP_MINISPEZ.md`
- `memory.md`
- der aktuelle Repo-Iststand in den Test-/Build-/Smoke-Pfaden, der bestehenden Freigabe- und Abnahmebasis, dem internen Betriebsstatus-/Lageueberblick, dem Klaerungs- und Eskalationspfad sowie den manuellen Fallbacks und operativen Exporten

Wesentliche Ableitung:
- Das Pflichtenheft beschreibt eine interne, nachvollziehbare Betriebsplattform mit operativen Artefakten.
- Die MVP-Arbeitspakete ordnen die naechsten kleinen Schritte konservativ.
- P7 begrenzt den internen Go/No-Go-Rahmen fuer den Betrieb.
- P15 begrenzt die kleinste interne Abnahme auf bestehende Test-, Build-, Rollen-, Export- und Audit-/Review-Kontexte.
- P17 begrenzt den internen Lageueberblick auf wenige technische, fachliche und betriebliche Signale.
- P18 begrenzt die sichtbare Klaerung und Eskalation auf PR-, Doku- und memory-Kontexte.
- P19 ordnet nun den kleinsten internen Beta-Durchlauf innerhalb dieses Rahmens ein, ohne daraus ein Release-, Rollout- oder Support-Modell zu machen.
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
- read-only Exportpfade fuer Angebot, Produktionsblatt und Einkaufsliste
- manuelle Fallbacks und Datenkorrekturen als gesondert begrenzte Rahmen
- PR-/Commit-/Dokument-/memory-Fortschreibung als laufende repo-nahe Entscheidungs- und Aenderungsspur

### 3.2 Fuer den MVP ausreichend und verbindlich

Fuer einen internen Beta-Durchlauf im MVP ist verbindlich anzunehmen:
- die technische Basis ist ueber Test und Build bereits belastbar genug, um einen kleinen kontrollierten Lauf zu tragen
- die Go-/No-Go- und Abnahmekriterien aus P7 und P15 sind mindestens fuer die betroffenen Pfade eingehalten
- der Lageueberblick aus P17 zeigt keine offenen Grundblocker, die den Durchlauf unsauber machen wuerden
- der Klaerungs- und Eskalationspfad aus P18 ist vorhanden, falls waehrend des Durchlaufs Unklarheiten entstehen
- manuelle Fallbacks und operative Exporte bleiben als kontrollierte Rueckfallebene verfuegbar

### 3.3 Personelle und operative Naehe im MVP

Fuer den minimalen Beta-Durchlauf reicht im MVP eine kleine interne Naehe aus:
- derselbe repo-nahe Betreiber- und Reviewer-Kreis, der die Mini-Spezifikationen und Kernpfade ohnehin kennt
- klar benannte interne Verantwortlichkeit fuer Beobachtung, Rueckfragen und Dokumentation
- keine neue Support-Organisation, kein externer Beta-Kanal und keine separate Rollout-Kette
- operative Begleitung direkt im bestehenden PR-/Doku-/memory-Rahmen statt in einer neuen Prozesswelt

## 4. Kleinste MVP-Festlegung

### 4.1 Wann ein interner Beta-Durchlauf zulaessig ist

Ein interner Beta-Durchlauf ist im MVP zulaessig, wenn alle folgenden Minimalbedingungen erfuellt sind:
1. der relevante Kernpfad ist technisch gruen oder nachvollziehbar stabil
2. die betroffenen Freigabe- und Abnahmepunkte sind nicht widerspruechlich
3. ein offener Klärungsfall aus P18 blockiert den Lauf nicht mehr oder ist bewusst sichtbar gemacht
4. manuelle Fallbacks und operative Exporte sind bei Bedarf erreichbar
5. der Durchlauf bleibt intern, kontrolliert und auf den aktuellen Repo-Rahmen begrenzt

### 4.2 Welche personelle und operative Naehe ausreichend ist

Im MVP reicht fuer den Beta-Durchlauf:
- ein kleiner interner Kreis aus Betreiber, fachlicher Beobachtung und Review
- unmittelbare Verfuegbarkeit der Personen, die die Fach- und Betriebsfragen knappe einordnen koennen
- keine formale Beta-Organisation, kein Stufenmodell und kein Support-Backlog
- eine direkte Rueckkopplung in PR, Doku und memory, wenn etwas unklar oder auffaellig ist

### 4.3 Welche technischen, fachlichen und betrieblichen Voraussetzungen vorher gruen sein sollten

Vor dem Beta-Durchlauf sollten mindestens folgende Voraussetzungen gruen oder ausreichend geklaert sein:
- technische Voraussetzungen: Test und Build laufen, die relevanten Kernrouten sind erreichbar
- fachliche Voraussetzungen: die operative Bedeutung der betroffenen Artefakte ist bekannt, insbesondere Exporte und relevante UI-/Service-Kontexte
- betriebliche Voraussetzungen: die minimale Abnahmebasis ist vorhanden, Fallbacks sind klar und ein Eskalationspfad ist bereit
- dokumentarische Voraussetzungen: die Beurteilung ist im aktuellen Repo-Kontext nachvollziehbar, ohne neue Systemlogik zu brauchen

### 4.4 Was waehrend des Beta-Durchlaufs beobachtet und knapp festgehalten werden soll

Waehrend eines solchen Beta-Durchlaufs soll knapp beobachtet und festgehalten werden:
- ob die technische Basis stabil bleibt
- ob die Kern-UI und die betroffenen Exporte erwartbar funktionieren
- ob Audit-/Review- und Abnahmespuren die beobachteten Schritte plausibel tragen
- ob manuelle Fallbacks oder Klaerungen noetig werden
- ob im Durchlauf neue fachliche oder betriebliche Fragen auftauchen
- ob die Dokumentation und memory-Fortfuehrung den Lauf ausreichend abbilden

### 4.5 Wann ein Beta-Durchlauf als aussagekraeftig genug gilt

Ein Beta-Durchlauf gilt im MVP als aussagekraeftig genug, wenn:
- der kontrollierte interne Lauf ohne neue Grundblocker durchlaeuft
- die relevanten Kernpfade, Exporte und Kontrollsichten kein neues systematisches Problem zeigen
- auftretende Unklarheiten bereits ueber P18 oder die vorhandenen Repo-Artefakte eingeordnet werden koennen
- die Beobachtungen knapp genug sind, um die naechste Produktentscheidung zu staetzen

### 4.6 Was im MVP bewusst noch kein formales Release-, Rollout- oder Support-Modell ist

Der minimale interne Beta-Durchfuehrungsrahmen im MVP ist ausdruecklich noch kein formales Betriebsmodell:
- kein externes Beta-Programm
- kein gestuftes Rollout-Modell
- kein Support-/Incident-Betriebssystem
- kein Release-Management-System
- kein Rollout-System
- kein Support-/Ticket-System
- keine neuen Endpunkte
- keine neue Persistenzlogik
- keine neue Produktfamilie

P19 beschreibt nur den kleinsten internen Weg, einen Beta-Durchlauf kontrolliert und repo-gebunden zu begrenzen.

## 5. Klare Abgrenzung

Diese Mini-Spezifikation fuehrt ausdruecklich nicht ein:
- kein externes Beta-Programm
- kein gestuftes Rollout-Modell
- kein Support-/Incident-Betriebssystem
- kein Release-Management-System
- kein Rollout-System
- kein Support-/Ticket-System
- keine neuen Endpunkte
- keine neue Persistenzlogik
- keine neue Produktfamilie

Der Beta-Durchfuehrungsrahmen bleibt damit bewusst klein und an den vorhandenen Repo-Bausteinen orientiert.

## 6. Offene Punkte

Bewusst offen bleibt:
- ob spaeter zwischen interner Beta, interner Freigabe und allgemeinem Betrieb strenger getrennt werden muss
- wie weit ein spaeterer Betrieb formale Rollen fuer Beobachtung, Rueckfrage und Entscheidung braucht
- ob einzelne Beta-Beobachtungen spaeter in ein staerker strukturiertes Betriebsmodell ueberfuehrt werden sollen
- welche Teile der heutigen PR-/Doku-/memory-Fortschreibung spaeter formaler werden muessen
- ob ein spaeterer Produkt- oder Betriebsausbau mehr Detailtiefe, mehr Automatisierung oder mehr Koordination verlangt

Diese Punkte sind noch nicht durch einen echten Release- oder Support-Ausbau geklaert und sollen deshalb hier nicht vorweggenommen werden.

## 7. Empfohlener kleinster naechster Schritt

Der naechste Schritt sollte weiterhin nur Klärung und Begrenzung sein, nicht Implementierung:
1. die hier genannten Minimalregeln als internen Referenzrahmen festhalten
2. die Grenze zwischen internem Beta-Durchlauf und formaler Freigabe klar benennen
3. weitere Release-, Rollout- oder Support-Strukturen erst spaeter explizit beauftragen

## 8. Einordnung

Diese Mini-Spezifikation ist absichtlich konservativ.
Sie soll den aktuellen MVP-Beta-Durchfuehrungsrahmen fachlich begrenzen, ohne eine neue Release-, Rollout- oder Support-Plattform zu erfinden.

Alles darueber hinaus bleibt spaeteren, explizit beauftragten Schritten vorbehalten.
