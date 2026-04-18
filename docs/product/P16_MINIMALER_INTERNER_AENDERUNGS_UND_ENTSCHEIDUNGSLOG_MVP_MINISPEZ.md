# P16 Minimaler interner Aenderungs- und Entscheidungslog im MVP – Mini-Spezifikation

Status: Mini-Spezifikation v0.1 auf Basis des aktuellen Repo-Iststands
Stand: 2026-04-16

## 1. Zweck und Abgrenzung

Diese Mini-Spezifikation begrenzt den minimalen internen Aenderungs- und Entscheidungslog fuer den MVP der `AlexanderSmyslowski/catering-agents-platform`.

Sie erfindet kein Ticket-System, keine neue Governance-Plattform, keine ADR-Plattform und keine Freigabedatenbank. Ziel ist ausschliesslich, den bereits realen MVP-Betrieb so einzuordnen, dass fachliche oder betriebsnahe Entscheidungen knapp und repo-gebunden festgehalten werden koennen, ohne daraus ein formales Entscheidungsregister zu machen.

## 2. Bezug auf Pflichtenheft, MVP-Arbeitspakete, P10, P14, P15 und Memory

Grundlagen dieses Dokuments sind:
- `docs/product/PFLICHTENHEFT.md`
- `docs/product/MVP_ARBEITSPAKETE.md`
- `docs/product/P10_MANUELLE_BETRIEBSINTERVENTIONEN_UND_FALLBACKS_MINISPEZ.md`
- `docs/product/P14_AUDIT_REVIEW_SPUREN_OPERATIVE_NUTZUNG_MINISPEZ.md`
- `docs/product/P15_MINIMALER_INTERNER_ABNAHMEPROZESS_MVP_MINISPEZ.md`
- `memory.md`
- der aktuelle Repo-Iststand in den PR-basierten Aenderungen, den Mini-Spezifikationen, den Repo-Dokumenten und der laufenden Projektfortschreibung

Wesentliche Ableitung:
- Das Pflichtenheft beschreibt die interne Betriebsplattform und ihre operativen Artefakte.
- Die MVP-Arbeitspakete ordnen die naechsten kleinen Schritte konservativ.
- P10 begrenzt manuelle Betriebsinterventionen und Fallbacks.
- P14 begrenzt Audit-/Review-Spuren auf interne Betriebs- und Kontrollnachweise.
- P15 begrenzt die kleinste interne Abnahme auf bestehende Test-, Build-, Rollen-, Export- und Audit-/Review-Kontexte.
- P16 ordnet nun die minimale Dokumentation von Aenderungen und Entscheidungen ein, ohne daraus ein formales Governance- oder Ticket-System zu machen.
- `memory.md` bleibt der Kurzanker fuer die konsolidierten Repo-Fakten und die laufende Projektfortschreibung.

## 3. Aktueller repo-gebundener Kontext

### 3.1 Bereits vorhanden

Im Repo sind bereits folgende Bausteine sichtbar:
- PR-basierte Aenderungen als normaler Arbeits- und Review-Rahmen
- Git-Commits als technische Aenderungsspur
- Mini-Spezifikationen als repo-gebundene, schmale Dokumentation kleiner MVP-Grenzen
- `memory.md` als laufende Projektfortschreibung und Kurzanker
- Audit-/Review-Spuren fuer interne Nachvollziehbarkeit
- interne Abnahme- und Plausibilisierungsrahmen fuer technische und fachnahe Aenderungen

### 3.2 Fuer den MVP ausreichend und verbindlich

Fuer den minimalen internen Aenderungs- und Entscheidungslog im MVP ist verbindlich anzunehmen:
- PR, Commit, Dokument und `memory.md` koennen zusammen genuegen, wenn eine Aenderung fachlich klein und klar begrenzt ist
- dokumentarische Aenderungen brauchen in erster Linie eine knappe fachliche Einordnung und Scope-Pruefung
- fachliche Abgrenzungen, Betriebsgrenzen oder Freigabeentscheidungen sollen knapp im naheliegenden Repo-Kontext festgehalten werden
- Audit-/Review-Spuren liefern die interne Betriebs- und Entscheidungsnachvollziehbarkeit, wenn eine Entscheidung an einen konkreten Kernpfad gebunden ist
- die interne Abnahme aus P15 kann als technischer Beleg dienen, waehrend P16 die dazugehoerige kleine Entscheidungsnotiz ordnet

### 3.3 Verhaeltnis zu Audit-/Review-Spuren und interner Abnahme

Der Aenderungs- und Entscheidungslog steht im MVP in folgender Beziehung zu den benachbarten Mini-Spezifikationen:
- Audit-/Review-Spuren beschreiben, dass und wie an operativen Daten oder Pfaden gearbeitet wurde
- die interne Abnahme prueft, ob die relevante Aenderung technisch und fachlich innerhalb des kleinen MVP-Rahmens bleibt
- der Aenderungs- und Entscheidungslog dokumentiert die knappe fachliche oder betriebliche Einordnung der Aenderung
- zusammen bilden diese Ebenen im MVP einen leichten, repo-gebundenen Nachweisrahmen ohne neue Plattformlogik

## 4. Kleinste MVP-Festlegung

### 4.1 Welche Entscheidungen mindestens festgehalten werden sollen

Im MVP sollen mindestens folgende Arten von Entscheidungen knapp festgehalten werden:
- fachliche Abgrenzungen, wenn ein Bereich bewusst innerhalb oder ausserhalb des MVP-Kerns liegt
- betriebsnahe Entscheidungen, wenn ein Lauf, ein Export oder ein manueller Fallback bewusst wiederholt oder begrenzt wird
- Freigabe- oder Abnahmeentscheidungen, wenn eine Aenderung nur nach manueller Plausibilisierung weitergegeben wird
- Entscheidungen, die einen konkreten Guard-, Export- oder Audit-Kontext beruehren

### 4.2 Wo PR, Commit, Doku und memory zusammen ausreichen

PR, Commit, Dokument und `memory.md` reichen im MVP zusammen aus, wenn:
- die Aenderung klein und repo-gebunden ist
- der fachliche Kontext eindeutig im PR und im Dokument beschrieben ist
- der Commit die technische Aenderung sauber transportiert
- `memory.md` den dauerhaften Projektstand knapp spiegelt

In dieser Form ist kein weiteres Register noetig, solange keine neue Produktwelt oder neue Freigabeinstanz eingefuehrt wird.

### 4.3 Was bei rein dokumentarischen Aenderungen genuegt

Bei rein dokumentarischen Aenderungen genuegt im MVP:
- ein klarer PR oder Commit mit dokumentarischem Fokus
- eine knappe fachliche Einordnung im betroffenen Dokument
- ein kurzer Abgleich gegen die angrenzenden Mini-Spezifikationen und das Pflichtenheft
- nur dann ein `memory.md`-Update, wenn daraus ein dauerhafter Repo-Fakt folgt

### 4.4 Was bei fachlichen Abgrenzungen, Betriebsgrenzen oder Freigabeentscheidungen zusaetzlich dokumentiert werden soll

Wenn eine Aenderung fachliche Abgrenzungen, Betriebsgrenzen oder Freigabeentscheidungen beruehrt, soll zusaetzlich knapp dokumentiert werden:
- welche Grenze genau gezogen wurde
- warum die Grenze fuer den MVP wichtig ist
- ob die Aenderung auf einen bestehenden Guard-, Export-, Audit- oder Abnahmekontext verweist
- ob der Entscheid nur intern und temporaer gilt oder als dauerhafter Repo-Stand gilt

### 4.5 Was im MVP bewusst noch kein formales Entscheidungsregister ist

Der minimale Aenderungs- und Entscheidungslog im MVP ist ausdruecklich noch kein formales Entscheidungsregister:
- kein Ticket-System
- keine neue Governance- oder ADR-Plattform
- keine Freigabedatenbank
- keine neue Workflow-Engine
- keine neuen Endpunkte
- keine neue Persistenzlogik

P16 beschreibt nur die kleinste interne Dokumentationsform fuer Aenderungen und Entscheidungen im bestehenden MVP-Rahmen.

## 5. Klare Abgrenzung

Diese Mini-Spezifikation fuehrt ausdruecklich nicht ein:
- kein Ticket-System
- keine neue Governance- oder ADR-Plattform
- keine neue Freigabedatenbank
- keine neuen Endpunkte
- keine neue Persistenzlogik
- keine neue Produktfamilie

Der Aenderungs- und Entscheidungslog bleibt damit bewusst klein und an den vorhandenen Repo-Bausteinen orientiert.

## 6. Offene Punkte

Bewusst offen bleibt:
- ob spaeter eine feinere Trennung zwischen Entscheidung, Abnahme und Review noetig wird
- wie weit ein spaeterer Betrieb eine formale Historie pro Bereich benoetigt
- ob einzelne Aenderungsklassen spaeter eigene Dokumentationsregeln erhalten sollen
- ob ein spaeterer Produkt- oder Betriebsausbau eine strengere ADR- oder Governance-Struktur verlangt
- welche Teile der heutigen Mini-Spezifikation spaeter in eine haerte Dokumentationsform ueberfuehrt werden sollen

Diese Punkte sind noch nicht durch einen echten Governance- oder Entscheidungsregister-Ausbau geklaert und sollen deshalb hier nicht vorweggenommen werden.

## 7. Empfohlener kleinster naechster Schritt

Der naechste Schritt sollte weiterhin nur Klärung und Begrenzung sein, nicht Implementierung:
1. die hier genannten Minimalregeln als internen Referenzrahmen festhalten
2. die Grenze zwischen knapper Dokumentation und formaler Nachverfolgung klar benennen
3. weitere Governance-, ADR- oder Ticket-Strukturen erst spaeter explizit beauftragen

## 8. Einordnung

Diese Mini-Spezifikation ist absichtlich konservativ.
Sie soll den aktuellen MVP-Aenderungs- und Entscheidungslog fachlich begrenzen, ohne ein formales Governance-System zu erfinden.

Alles darueber hinaus bleibt spaeteren, explizit beauftragten Schritten vorbehalten.
