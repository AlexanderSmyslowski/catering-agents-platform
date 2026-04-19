# P25 Minimaler interner Nutzungsrahmen nach Beta-Uebergabe im MVP – Mini-Spezifikation

Status: Mini-Spezifikation v0.1 auf Basis des aktuellen Repo-Iststands
Stand: 2026-04-19

## 1. Zweck und Abgrenzung

Diese Mini-Spezifikation begrenzt den minimalen internen Nutzungsrahmen nach Beta-Uebergabe fuer den MVP der `AlexanderSmyslowski/catering-agents-platform`.

Sie erfindet kein Betriebshandbuch als Vollmodell, keinen Support-/Incident-Prozess, kein formales Nutzungsfreigabe- oder Governance-Board und keine neue Produkt- oder Prozessfamilie. Ziel ist ausschliesslich, den kleinsten Rahmen festzuhalten, unter dem die nach P24 laufende interne Nutzung im MVP weiter stattfinden darf.

## 2. Bezug auf Pflichtenheft, MVP-Arbeitspakete, P21, P22, P23, P24 und Memory

Grundlagen dieses Dokuments sind:
- `docs/product/PFLICHTENHEFT.md`
- `docs/product/MVP_ARBEITSPAKETE.md`
- `docs/product/P21_MINIMALER_UEBERGANG_VON_BETA_ZU_INTERN_NUTZBAREM_PRODUKTSTATUS_MVP_MINISPEZ.md`
- `docs/product/P22_MINIMALER_RESTPUNKT_UND_NACHZIEHRAHMEN_VOR_BETA_ABSCHLUSS_MVP_MINISPEZ.md`
- `docs/product/P23_MINIMALER_INTERNER_BETA_ABSCHLUSS_UND_DOKUMENTATIONSSTAND_MVP_MINISPEZ.md`
- `docs/product/P24_MINIMALER_UEBERGABESTAND_VON_BETA_ZU_LAUFENDER_INTERNER_NUTZUNG_MVP_MINISPEZ.md`
- `memory.md`
- der aktuelle Repo-Iststand in den Test-/Build-/Smoke-Pfaden, dem Uebergang zu intern nutzbarem Produktstatus, dem Restpunkt- und Nachziehrahmen, dem Beta-Abschluss- und Dokumentationsstand, dem Uebergabestand zu laufender interner Nutzung sowie den vorhandenen Export-/Audit-/Fallback-Bezuegen

Wesentliche Ableitung:
- Das Pflichtenheft beschreibt eine interne, nachvollziehbare Betriebsplattform mit operativen Artefakten.
- Die MVP-Arbeitspakete ordnen die naechsten kleinen Schritte konservativ.
- P21 ordnet den Uebergang von Beta zu intern nutzbarem Produktstatus ein.
- P22 ordnet den Umgang mit kleinen Restpunkten vor Beta-Abschluss ein.
- P23 ordnet die kleine Abschlusssicht und den dokumentarisch sauberen Beta-Abschluss ein.
- P24 ordnet den Uebergabestand von dokumentarisch abgeschlossenem Beta-Stand zu laufender interner Nutzung ein.
- P25 begrenzt nun den kleinsten dauerhaften Nutzungsrahmen nach dieser Uebergabe.
- `memory.md` bleibt der Kurzanker fuer die konsolidierten Repo-Fakten und die laufende Projektfortschreibung.

## 3. Aktueller repo-gebundener Kontext

### 3.1 Bereits vorhanden

Im Repo sind bereits folgende Bausteine sichtbar:
- gruener automatisierter Vitest-Korridor
- reproduzierbarer `npm run build`-Pfad
- schmale UI-/Smoke-Grundlage fuer die Kernrouten
- Uebergang zu intern nutzbarem Produktstatus ueber P21
- Restpunkt- und Nachziehrahmen vor Beta-Abschluss ueber P22
- Beta-Abschluss- und Dokumentationsstand ueber P23
- Uebergabestand zu laufender interner Nutzung ueber P24
- read-only Exportpfade fuer Angebot, Produktionsblatt und Einkaufsliste
- Review-/Audit-Sicht fuer interne Betriebs- und Kontrollnachweise
- manuelle Fallbacks und Datenkorrekturen als gesondert begrenzte Rahmen
- PR-/Commit-/Dokument-/memory-Fortschreibung als laufende repo-nahe Entscheidungs- und Aenderungsspur

### 3.2 Fuer den MVP ausreichend und verbindlich

Fuer die laufende interne Nutzung nach Beta-Uebergabe ist im MVP verbindlich anzunehmen:
- die technische Basis ist ueber Test, Build und Smoke bereits belastbar genug, um die Nutzung als laufenden internen Zustand zu tragen
- die Einordnung aus P21 bis P24 steht nicht im Widerspruch zum laufenden Nutzungsrahmen
- die Restpunkt-Einordnung aus P22 ist so weit geklaert, dass nur noch bewusst tolerierte Punkte offen bleiben
- die Beta-Abschlusssicht aus P23 und der Uebergabestand aus P24 bleiben konsistent mit der laufenden Nutzung
- der Stand kann intern weiter genutzt werden, ohne dass dafuer ein formales Betriebs-, Support- oder Governance-Modell erforderlich wird
- PR, Doku und memory bleiben die kleinste tragende Dokumentationsspur fuer die laufende Nutzungsbewertung

### 3.3 Welche minimalen Rahmenbedingungen fuer laufende Nutzung gelten sollten

Die laufende interne Nutzung soll im MVP nur unter diesen wenigen Rahmenbedingungen stattfinden:
- technisch: Test und Build laufen, die relevanten Kernrouten sind erreichbar und der Smoke-Korridor bleibt stabil
- fachlich: die operativen Exporte und Artefakte sind plausibel und die Kernsicht bleibt konsistent
- betrieblich: Lageueberblick, Fallbacks und Klaerungsweg machen den Stand intern fuehrbar
- dokumentarisch: PR, Doku und memory bilden den Nutzungsstand knapp und konsistent ab

### 3.4 Welche Nutzungsgrenzen und welche Vorsicht im MVP weiter gelten

Im MVP bleibt die laufende interne Nutzung bewusst begrenzt:
- Nutzung fuer den internen Zweck ja, aber keine Ausweitung in neue Produktflaechen
- interne Bedienung ja, aber keine stillen Prozess- oder Rollenverschiebungen
- operative Arbeit ja, aber nur innerhalb der bereits beschriebenen Artefakte und Exporte
- Rueckfragen und Korrekturen ja, aber nicht als Ersatz fuer ein formales Betriebsmodell
- klare Sicht auf die bestehende Abgrenzung zu Beta, Abschluss und Uebergabe bleibt notwendig

### 3.5 Welche kleineren Restpunkte dabei noch tolerierbar sein koennen

Tolerierbar koennen im MVP noch sein:
- kleine sprachliche Feinschliffe ohne fachliche Wirkung
- einzelne Rueckfragen, sofern sie den Nutzungsstand nicht grundlegend unscharf machen
- kleine Dokumentationsluecken, wenn der Kernkontext trotzdem nachvollziehbar bleibt
- bewusst offene Anschlussfragen, die nicht mehr den laufenden Nutzungsrahmen selbst betreffen
- kleine Nachschaerfungen, die die interne Nutzung verbessern, ohne eine neue Prozesswelt zu verlangen

### 3.6 Welche Auffaelligkeiten eher gegen stabile laufende interne Nutzung sprechen

Eher gegen stabile laufende interne Nutzung sprechen Auffaelligkeiten, wenn sie den Nutzungsstand unsicher machen:
- neue Grundblocker in Test, Build oder Smoke
- widerspruechliche oder nicht mehr plausible Exporte
- ungeklaerte oder wiederkehrende Klaerungsfaelle, die den Betrieb unsauber machen
- fehlende oder gebrochene Review-/Audit-Nachvollziehbarkeit
- offene Punkte, die bereits ein formales Betriebs-, Support- oder Governance-Modell verlangen wuerden

### 3.7 Rolle von PR, Doku und memory

Im bestehenden MVP-Rahmen gilt:
- PRs halten die konkrete Aenderung und die sichtbare Nutzungsentscheidung fest
- Doku hält die fachliche Einordnung des Nutzungsrahmens fest
- `memory.md` hält den konsolidierten, dauerhaften Repo-Stand fest
- zusammen bilden sie die kleine Laufzeit-, Begrenzungs- und Bewertungsspur, ohne ein formales Betriebs-, Support- oder Governance-System zu ersetzen

## 4. Kleinste MVP-Festlegung

### 4.1 Unter welchen minimalen Rahmenbedingungen die laufende interne Nutzung stattfinden soll

Ein Stand soll im MVP als laufend intern nutzbar gelten, wenn:
1. die Beta-Uebergabe nach P24 dokumentarisch sauber erfolgt ist
2. die Einordnung aus P21 bis P23 nicht im Widerspruch zur laufenden Nutzung steht
3. die Restpunkte aus P22 entweder nachgezogen oder bewusst als tolerierbar festgehalten sind
4. Test, Build und relevante Smoke-Basis gruen sind oder als explizit akzeptierte Basis vorliegen
5. PR, Doku und memory den laufenden Nutzungsstand knapp und konsistent abbilden

### 4.2 Welche Nutzungsgrenzen und welche Vorsicht weiterhin gelten

Die laufende Nutzung gilt im MVP als tragfaehig, wenn:
- technische Signale nicht nur punktuell, sondern als tragfaehiger Grundzustand vorliegen
- fachliche Signale die operativen Artefakte ausreichend plausibel machen
- betriebliche Signale zeigen, dass Lage, Fallbacks und Klaerung den Stand auffangen koennen
- dokumentarische Signale den Stand intern knapp und konsistent beschreiben
- der interne Nutzen nicht durch neue Erwartungen an Betrieb, Support oder Governance ueberfrachtet wird

### 4.3 Welche Restpunkte noch tolerierbar sein koennen

Im MVP sind noch tolerierbar:
- offene Detailfragen, die den produktiven Kern nicht blockieren
- kleine Nachschaerfungen an Begriffen, Markierungen oder Dokumentation
- vereinzelte Rueckfragen, sofern sie den Nutzungsstand nicht grundsaetzlich infrage stellen
- kleine Doku-Anpassungen, solange die interne Nutzung nicht unsicher wird

### 4.4 Welche Arten von Auffaelligkeiten eher gegen stabile laufende interne Nutzung sprechen

Eher gegen den Nutzungsstand sprechen:
- offene Punkte mit Grundblocker-Charakter
- wiederkehrende Widersprueche zwischen Technik, Fachlichkeit und Betrieb
- unklare oder gebrochene Nachvollziehbarkeit bei zentralen Artefakten
- eine Lage, in der man fuer die weitere Nutzung bereits ein formales Betriebs-, Support- oder Governance-Modell braeuchte

### 4.5 Wie PR, Dokumente und memory fuer die knappe Nutzungsbewertung genutzt werden

- PR dient als Ort fuer die sichtbare Aenderung oder Nutzungsentscheidung
- Doku dient als Ort fuer die knappe fachliche Einordnung des Nutzungsstands
- `memory.md` dient als dauerhafte Verdichtung des beschlossenen Nutzungsstatus

Wenn ein Nutzungsstand nicht sauber einordenbar ist, soll er lieber sichtbar offen bleiben, statt in ein neues formales System verschoben zu werden.

### 4.6 Was im MVP bewusst noch kein formales Betriebs-, Support- oder Governance-Modell ist

Der minimale interne Nutzungsrahmen nach Beta-Uebergabe ist ausdruecklich noch kein formales Modell:
- kein Betriebshandbuch als Vollmodell
- kein Support-/Incident-Prozess
- kein formales Nutzungsfreigabe- oder Governance-Board
- kein Produktionsfreigabe-Board
- kein Release- oder Rollout-System
- keine neuen Endpunkte
- keine neue Persistenzlogik
- keine neue Produktfamilie

## 5. Klare Abgrenzung

Diese Mini-Spezifikation fuehrt ausdruecklich nicht ein:
- kein Betriebshandbuch als Vollmodell
- kein Support-/Incident-Prozess
- kein formales Nutzungsfreigabe- oder Governance-Board
- keine neuen Endpunkte
- keine neue Persistenzlogik
- keine neue Produktfamilie

Der Nutzungsrahmen bleibt damit bewusst klein und an den vorhandenen Repo-Bausteinen orientiert.

## 6. Offene Punkte

Bewusst offen bleibt:
- ob spaeter zwischen laufender interner Nutzung, formaler Freigabe und allgemeinem Betrieb strenger getrennt werden muss
- wie weit ein spaeterer Betrieb formale Rollen fuer Beobachtung, Rueckfrage und Entscheidung braucht
- ob einzelne Nutzungsgrenzen spaeter in ein staerker strukturiertes Betriebs-, Support- oder Governance-Modell ueberfuehrt werden sollen
- welche Teile der heutigen PR-/Doku-/memory-Fortschreibung spaeter formalisiert werden muessen
- ob ein spaeterer Produkt- oder Betriebsausbau mehr Detailtiefe, mehr Automatisierung oder mehr Koordination verlangt

Diese Punkte sind noch nicht durch ein echtes Betriebs-, Support- oder Governance-Modell geklaert und sollen deshalb hier nicht vorweggenommen werden.

## 7. Empfohlener kleinster naechster Schritt

Der naechste Schritt sollte weiterhin nur Klärung und Begrenzung sein, nicht Implementierung:
1. die hier genannten Minimalregeln als internen Referenzrahmen festhalten
2. die Grenze zwischen Beta-Uebergabe und laufender interner Nutzung klar benennen
3. weitere Betriebs-, Support- oder Governance-Strukturen erst spaeter explizit beauftragen

## 8. Einordnung

Diese Mini-Spezifikation ist absichtlich konservativ.
Sie soll den minimalen internen Nutzungsrahmen nach Beta-Uebergabe fachlich begrenzen, ohne ein formales Betriebs-, Support- oder Governance-Modell zu erfinden.

Alles darueber hinaus bleibt spaeteren, explizit beauftragten Schritten vorbehalten.
