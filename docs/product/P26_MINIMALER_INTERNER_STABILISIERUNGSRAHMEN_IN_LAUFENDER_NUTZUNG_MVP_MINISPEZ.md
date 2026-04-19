# P26 Minimaler interner Stabilisierungsrahmen in laufender Nutzung im MVP – Mini-Spezifikation

Status: Mini-Spezifikation v0.1 auf Basis des aktuellen Repo-Iststands
Stand: 2026-04-19

## 1. Zweck und Abgrenzung

Diese Mini-Spezifikation begrenzt den minimalen internen Stabilisierungsrahmen in laufender Nutzung fuer den MVP der `AlexanderSmyslowski/catering-agents-platform`.

Sie erfindet kein Monitoring-Board, keinen Incident-/Support-Prozess, kein formales Stabilitaets-Freigabesystem und keine neue Produkt- oder Prozessfamilie. Ziel ist ausschliesslich, den kleinsten Rahmen festzuhalten, unter dem die laufende interne Nutzung im MVP als hinreichend ruhig und belastbar betrachtet werden kann.

## 2. Bezug auf Pflichtenheft, MVP-Arbeitspakete, P22, P23, P25 und Memory

Grundlagen dieses Dokuments sind:
- `docs/product/PFLICHTENHEFT.md`
- `docs/product/MVP_ARBEITSPAKETE.md`
- `docs/product/P22_MINIMALER_RESTPUNKT_UND_NACHZIEHRAHMEN_VOR_BETA_ABSCHLUSS_MVP_MINISPEZ.md`
- `docs/product/P23_MINIMALER_INTERNER_BETA_ABSCHLUSS_UND_DOKUMENTATIONSSTAND_MVP_MINISPEZ.md`
- `docs/product/P25_MINIMALER_INTERNER_NUTZUNGSRAHMEN_NACH_BETA_UEBERGABE_MVP_MINISPEZ.md`
- `memory.md`
- der aktuelle Repo-Iststand in den Test-/Build-/Smoke-Pfaden, dem Restpunkt- und Nachziehrahmen, dem Beta-Abschluss- und Dokumentationsstand, dem Uebergabestand von Beta zu laufender interner Nutzung, dem Nutzungsrahmen nach Beta-Uebergabe sowie den vorhandenen Export-/Audit-/Fallback-Bezuegen

Wesentliche Ableitung:
- Das Pflichtenheft beschreibt eine interne, nachvollziehbare Betriebsplattform mit operativen Artefakten.
- Die MVP-Arbeitspakete ordnen die naechsten kleinen Schritte konservativ.
- P22 ordnet den Umgang mit kleinen Restpunkten vor Beta-Abschluss ein.
- P23 ordnet die kleine Abschlusssicht und den dokumentarisch sauberen Beta-Abschluss ein.
- P25 bildet den naechsten Bezugspunkt fuer die laufende interne Nutzung.
- P25 ordnet den dauerhaften Nutzungsrahmen nach Beta-Uebergabe ein.
- P26 begrenzt nun den kleinsten Stabilisierungsrahmen fuer diese laufende interne Nutzung.
- `memory.md` bleibt der Kurzanker fuer die konsolidierten Repo-Fakten und die laufende Projektfortschreibung.

## 3. Aktueller repo-gebundener Kontext

### 3.1 Bereits vorhanden

Im Repo sind bereits folgende Bausteine sichtbar:
- gruener automatisierter Vitest-Korridor
- reproduzierbarer `npm run build`-Pfad
- schmale UI-/Smoke-Grundlage fuer die Kernrouten
- Restpunkt- und Nachziehrahmen vor Beta-Abschluss ueber P22
- Beta-Abschluss- und Dokumentationsstand ueber P23
- Nutzungsrahmen nach Beta-Uebergabe ueber P25
- read-only Exportpfade fuer Angebot, Produktionsblatt und Einkaufsliste
- Review-/Audit-Sicht fuer interne Betriebs- und Kontrollnachweise
- manuelle Fallbacks und Datenkorrekturen als gesondert begrenzte Rahmen
- PR-/Commit-/Dokument-/memory-Fortschreibung als laufende repo-nahe Entscheidungs- und Aenderungsspur

### 3.2 Fuer den MVP ausreichend und verbindlich

Fuer die knappe Stabilitaetsbetrachtung in laufender interner Nutzung ist im MVP verbindlich anzunehmen:
- die technische Basis ist ueber Test, Build und Smoke bereits belastbar genug, um die laufende Nutzung nicht als instabilen Sonderfall zu betrachten
- die Einordnung aus P22 bis P25 steht nicht im Widerspruch zu einem ruhigen laufenden Nutzungsstand
- die Restpunkt-Einordnung aus P22 ist so weit geklaert, dass nur noch bewusst tolerierte Punkte offen bleiben
- die Beta-Abschlusssicht aus P23 und der Nutzungsrahmen aus P25 bleiben konsistent mit der laufenden Nutzung
- der Stand kann intern weiter genutzt werden, ohne dass dafuer ein formales Betriebs-, Monitoring- oder Support-Modell erforderlich wird
- PR, Doku und memory bleiben die kleinste tragende Dokumentationsspur fuer die laufende Stabilitaetsbewertung

### 3.3 Welche wenigen Signale zusammen ruhig genug sein sollten

Die laufende interne Nutzung soll im MVP nur dann als hinreichend stabil betrachtet werden, wenn diese wenigen Signale zusammen ruhig genug sind:
- technisch: Test und Build laufen, die relevanten Kernrouten sind erreichbar und der Smoke-Korridor bleibt stabil
- fachlich: die operativen Exporte und Artefakte sind plausibel und die Kernsicht bleibt konsistent
- betrieblich: Lageueberblick, Fallbacks und Klaerungsweg machen den Stand intern fuehrbar
- dokumentarisch: PR, Doku und memory bilden den Nutzungs- und Stabilitaetsstand knapp und konsistent ab

### 3.4 Welche kleineren Restpunkte dabei noch tolerierbar sein koennen

Tolerierbar koennen im MVP noch sein:
- kleine sprachliche Feinschliffe ohne fachliche Wirkung
- einzelne Rueckfragen, sofern sie den Nutzungsstand nicht grundlegend unscharf machen
- kleine Dokumentationsluecken, wenn der Kernkontext trotzdem nachvollziehbar bleibt
- bewusst offene Anschlussfragen, die nicht mehr den laufenden Nutzungsrahmen selbst betreffen
- kleine Nachschaerfungen, die die interne Nutzung verbessern, ohne eine neue Prozesswelt zu verlangen

### 3.5 Welche Auffaelligkeiten eher fuer erneuten Nachziehbedarf oder gegen Stabilitaet sprechen

Eher fuer erneuten Nachziehbedarf oder gegen stabile laufende interne Nutzung sprechen Auffaelligkeiten, wenn sie den Nutzungsstand unsicher machen:
- neue Grundblocker in Test, Build oder Smoke
- widerspruechliche oder nicht mehr plausible Exporte
- ungeklaerte oder wiederkehrende Klaerungsfaelle, die den Betrieb unsauber machen
- fehlende oder gebrochene Review-/Audit-Nachvollziehbarkeit
- offene Punkte, die bereits ein formales Betriebs-, Monitoring- oder Support-Modell verlangen wuerden

### 3.6 Rolle von PR, Doku und memory

Im bestehenden MVP-Rahmen gilt:
- PRs halten die konkrete Aenderung und die sichtbare Stabilitaetsentscheidung fest
- Doku hält die fachliche Einordnung des Stabilisierungsrahmens fest
- `memory.md` hält den konsolidierten, dauerhaften Repo-Stand fest
- zusammen bilden sie die kleine Laufzeit-, Begrenzungs- und Bewertungsspur, ohne ein formales Betriebs-, Monitoring- oder Support-System zu ersetzen

## 4. Kleinste MVP-Festlegung

### 4.1 Wann ein laufend intern genutzter Stand als hinreichend stabil betrachtet werden kann

Ein Stand soll im MVP als hinreichend stabil gelten, wenn:
1. die in P25 definierte laufende interne Nutzung als tragfaehiger Folgeraum nach der Uebergabe dokumentarisch sauber beschrieben ist
2. die laufende Nutzung nach P25 im Grundsatz bereits als dauerhafter interner Zustand eingeordnet ist
3. die Restpunkte aus P22 entweder nachgezogen oder bewusst als tolerierbar festgehalten sind
4. die Einordnung aus P23 bis P25 nicht im Widerspruch zu einem ruhigen laufenden Zustand steht
5. Test, Build und relevante Smoke-Basis gruen sind oder als explizit akzeptierte Basis vorliegen
6. PR, Doku und memory den laufenden Nutzungs- und Stabilitaetsstand knapp und konsistent abbilden

### 4.2 Welche technischen, fachlichen und betrieblichen Signale zusammen ausreichend ruhig sein sollten

Die Signale gelten im MVP als ausreichend ruhig, wenn:
- technische Signale nicht nur punktuell, sondern als tragfaehiger Grundzustand vorliegen
- fachliche Signale die operativen Artefakte ausreichend plausibel machen
- betriebliche Signale zeigen, dass Lage, Fallbacks und Klaerung den Stand auffangen koennen
- dokumentarische Signale den Stand intern knapp und konsistent beschreiben
- der interne Nutzen nicht durch neue Erwartungen an Monitoring, Incident-Handling oder Governance ueberfrachtet wird

### 4.3 Welche Restpunkte noch tolerierbar sein koennen

Im MVP sind noch tolerierbar:
- offene Detailfragen, die den produktiven Kern nicht blockieren
- kleine Nachschaerfungen an Begriffen, Markierungen oder Dokumentation
- vereinzelte Rueckfragen, sofern sie den Nutzungsstand nicht grundsaetzlich infrage stellen
- kleine Doku-Anpassungen, solange die interne Nutzung nicht unsicher wird

### 4.4 Welche Arten von Auffaelligkeiten eher fuer Nachziehbedarf oder gegen Stabilitaet sprechen

Eher gegen den Stabilisierungsrahmen sprechen:
- offene Punkte mit Grundblocker-Charakter
- wiederkehrende Widersprueche zwischen Technik, Fachlichkeit und Betrieb
- unklare oder gebrochene Nachvollziehbarkeit bei zentralen Artefakten
- eine Lage, in der man fuer die weitere Nutzung bereits ein formales Monitoring-, Incident- oder Support-Modell braeuchte

### 4.5 Wie PR, Dokumente und memory fuer die knappe Stabilitaetsbewertung genutzt werden

- PR dient als Ort fuer die sichtbare Aenderung oder Stabilitaetsentscheidung
- Doku dient als Ort fuer die knappe fachliche Einordnung des Stabilisierungsstands
- `memory.md` dient als dauerhafte Verdichtung des beschlossenen Stabilitaetsstatus

Wenn ein Stabilitaetsstand nicht sauber einordenbar ist, soll er lieber sichtbar offen bleiben, statt in ein neues formales System verschoben zu werden.

### 4.6 Was im MVP bewusst noch kein formales Betriebs-, Monitoring- oder Support-Modell ist

Der minimale Stabilisierungsrahmen in laufender Nutzung ist ausdruecklich noch kein formales Modell:
- kein Monitoring-Board
- kein Incident-/Support-Prozess
- kein formales Stabilitaets-Freigabesystem
- kein Produktionsfreigabe-Board
- kein Release- oder Rollout-System
- keine neuen Endpunkte
- keine neue Persistenzlogik
- keine neue Produktfamilie

## 5. Klare Abgrenzung

Diese Mini-Spezifikation fuehrt ausdruecklich nicht ein:
- kein Monitoring-Board
- kein Incident-/Support-Prozess
- kein formales Stabilitaets-Freigabesystem
- keine neuen Endpunkte
- keine neue Persistenzlogik
- keine neue Produktfamilie

Der Stabilisierungsrahmen bleibt damit bewusst klein und an den vorhandenen Repo-Bausteinen orientiert.

## 6. Offene Punkte

Bewusst offen bleibt:
- ob spaeter zwischen laufender interner Nutzung, formaler Freigabe und allgemeinem Betrieb strenger getrennt werden muss
- wie weit ein spaeterer Betrieb formale Rollen fuer Beobachtung, Rueckfrage und Entscheidung braucht
- ob einzelne Stabilitaetskriterien spaeter in ein staerker strukturiertes Betriebs-, Monitoring- oder Support-Modell ueberfuehrt werden sollen
- welche Teile der heutigen PR-/Doku-/memory-Fortschreibung spaeter formalisiert werden muessen
- ob ein spaeterer Produkt- oder Betriebsausbau mehr Detailtiefe, mehr Automatisierung oder mehr Koordination verlangt

Diese Punkte sind noch nicht durch ein echtes Betriebs-, Monitoring- oder Support-Modell geklaert und sollen deshalb hier nicht vorweggenommen werden.

## 7. Empfohlener kleinster naechster Schritt

Der naechste Schritt sollte weiterhin nur Klärung und Begrenzung sein, nicht Implementierung:
1. die hier genannten Minimalregeln als internen Referenzrahmen festhalten
2. die Grenze zwischen laufender Nutzung und hinreichender Stabilitaet klar benennen
3. weitere Betriebs-, Monitoring- oder Support-Strukturen erst spaeter explizit beauftragen

## 8. Einordnung

Diese Mini-Spezifikation ist absichtlich konservativ.
Sie soll den minimalen internen Stabilisierungsrahmen in laufender Nutzung fachlich begrenzen, ohne ein formales Betriebs-, Monitoring- oder Support-Modell zu erfinden.

Alles darueber hinaus bleibt spaeteren, explizit beauftragten Schritten vorbehalten.
