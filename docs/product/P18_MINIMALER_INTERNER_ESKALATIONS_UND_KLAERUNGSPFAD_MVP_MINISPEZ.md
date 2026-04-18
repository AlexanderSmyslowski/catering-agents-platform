# P18 Minimaler interner Eskalations- und Klaerungspfad im MVP – Mini-Spezifikation

Status: Mini-Spezifikation v0.1 auf Basis des aktuellen Repo-Iststands
Stand: 2026-04-16

## 1. Zweck und Abgrenzung

Diese Mini-Spezifikation begrenzt den minimalen internen Eskalations- und Klaerungspfad fuer den MVP der `AlexanderSmyslowski/catering-agents-platform`.

Sie erfindet kein Incident-System, kein Ticket-System, keine neue Governance- oder Freigabeplattform und keine formale Eskalationsmatrix. Ziel ist ausschliesslich, den bereits realen MVP-Betrieb so einzuordnen, dass Unklarheiten, Widersprueche oder betriebliche Unsicherheiten innerhalb eines kleinen, repo-gebundenen Rahmens geklaert oder bewusst sichtbar gemacht werden koennen.

## 2. Bezug auf Pflichtenheft, MVP-Arbeitspakete, P10, P15, P16, P17 und Memory

Grundlagen dieses Dokuments sind:
- `docs/product/PFLICHTENHEFT.md`
- `docs/product/MVP_ARBEITSPAKETE.md`
- `docs/product/P10_MANUELLE_BETRIEBSINTERVENTIONEN_UND_FALLBACKS_MINISPEZ.md`
- `docs/product/P15_MINIMALER_INTERNER_ABNAHMEPROZESS_MVP_MINISPEZ.md`
- `docs/product/P16_MINIMALER_INTERNER_AENDERUNGS_UND_ENTSCHEIDUNGSLOG_MVP_MINISPEZ.md`
- `docs/product/P17_MINIMALER_INTERNER_BETRIEBSSTATUS_UND_LAGEUEBERBLICK_MVP_MINISPEZ.md`
- `memory.md`
- der aktuelle Repo-Iststand in den Test-/Build-/Smoke-Pfaden, den manuellen Fallbacks, der repo-/PR-/memory-nahen Entscheidungsfortschreibung und dem internen Lageueberblick

Wesentliche Ableitung:
- Das Pflichtenheft beschreibt eine interne, nachvollziehbare Betriebsplattform mit operativen Artefakten.
- Die MVP-Arbeitspakete halten Betrieb, Abnahme und Abgrenzung bewusst klein.
- P10 begrenzt manuelle Betriebsinterventionen und Fallbacks.
- P15 begrenzt die kleinste interne Abnahme auf bestehende Test-, Build-, Rollen-, Export- und Audit-/Review-Kontexte.
- P16 begrenzt die Dokumentation von Aenderungen und Entscheidungen auf PR-, Commit-, Doku- und memory-Kontexte.
- P17 begrenzt den internen Lageueberblick auf wenige technische, fachliche und betriebliche Signale.
- P18 ordnet nun die minimale Klaerung und bewusste Eskalation innerhalb dieses Rahmens ein, ohne daraus ein Incident-, Ticket- oder Governance-System zu machen.
- `memory.md` bleibt der Kurzanker fuer die konsolidierten Repo-Fakten und die laufende Projektfortschreibung.

## 3. Aktueller repo-gebundener Kontext

### 3.1 Bereits vorhanden

Im Repo sind bereits folgende Bausteine sichtbar:
- gruener automatisierter Vitest-Korridor
- reproduzierbarer `npm run build`-Pfad
- schmale UI-/Smoke-Grundlage fuer die Kernrouten
- read-only Exportpfade fuer Angebot, Produktionsblatt und Einkaufsliste
- Audit-/Review-/Finalize-Nachweise in den geschuetzten Kernpfaden
- manuelle Fallbacks und Datenkorrekturen als gesondert begrenzte Rahmen
- PR-/Commit-/Dokument-/memory-Fortschreibung als laufende repo-nahe Entscheidungs- und Aenderungsspur
- schmaler interner Lageueberblick als kleine Statusformulierung ohne Ops-Welt

### 3.2 Fuer den MVP ausreichend und verbindlich

Fuer den minimalen internen Eskalations- und Klaerungspfad im MVP ist verbindlich anzunehmen:
- technische, fachliche oder betriebliche Unklarheiten sollen zuerst als Klaerungsfall betrachtet werden
- wenn die Unklarheit mit den vorhandenen Dokumenten, PRs, Commits oder der aktuellen Betriebssicht sauber eingeordnet werden kann, reicht eine knappe interne Klaerung innerhalb des bestehenden Arbeitsflusses
- wenn ein Fall nicht hinreichend klar ist, soll er als sichtbare Entscheidung oder bewusste Eskalation markiert werden
- PR, Doku und `memory.md` koennen die knappe Fortfuehrung der Entscheidung tragen
- der interne Lageueberblick aus P17 liefert die Signale, die den Klaerungsbedarf sichtbar machen
- die Abnahmebasis aus P15 liefert den technischen Rahmen, innerhalb dessen eine Klaerung sinnvoll bleibt

### 3.3 Verhaeltnis zwischen Klaerung, Eskalation und bestehendem Arbeitsfluss

Der Pfad unterscheidet im MVP zwischen drei Situationen:
- klaerbar im bestehenden Arbeitsfluss: eine Unklarheit laesst sich mit vorhandenen Artefakten, Fallbacks oder Dokumenten knapp einordnen
- sichtbar zu machen: die Unklarheit soll bewusst festgehalten werden, ohne sofort neue Plattformlogik zu erzeugen
- bewusst zu eskalieren: die Unklarheit ist so relevant, dass eine sichtbare Entscheidung oder eine explizite menschliche Rueckkopplung noetig wird

Dabei soll kein neuer formaler Prozess entstehen. Der Pfad bleibt ein schmaler, repo-gebundener Hinweis auf die naechste menschliche oder dokumentarische Klärung.

### 3.4 Rolle von PR, Doku und memory

Im bestehenden MVP-Rahmen gilt:
- PRs halten die konkrete Aenderung und den sichtbaren Diskussionskontext fest
- Doku hält die fachliche Einordnung und die abgegrenzte Bedeutung fest
- `memory.md` hält den konsolidierten, dauerhaften Repo-Stand fest
- zusammen bilden sie den leichten Klaerungs- und Eskalationsrahmen, ohne ein Ticketsystem oder eine Governance-Plattform zu ersetzen

## 4. Kleinste MVP-Festlegung

### 4.1 Wann technische, fachliche oder betriebliche Unklarheiten als Klaerungsfall behandelt werden sollen

Im MVP sollen Unklarheiten als Klaerungsfall behandelt werden, wenn mindestens eines davon zutrifft:
- ein Test-/Build-/Smoke-Signal ist unklar oder widerspruechlich
- ein Exportpfad wirkt plausibel, aber die fachliche Einordnung fehlt
- Audit-/Review-Spuren zeigen einen Zustand, der nicht sauber zu den operativen Daten passt
- manuelle Fallbacks fuehren zu einer offenen Frage, die nicht sofort durch vorhandene Artefakte beantwortet wird
- die interne Fortschreibung in PR, Doku oder `memory.md` ist noch nicht konsistent

### 4.2 Wann ein Fall innerhalb des bestehenden Arbeitsflusses knapp geklaert werden kann

Ein Fall kann innerhalb des bestehenden Arbeitsflusses knapp geklaert werden, wenn:
- die Unklarheit mit den vorhandenen repo-gebundenen Artefakten direkt eingeordnet werden kann
- ein manueller Fallback oder ein kurzer Blick auf Export/Audit/Abnahme die Lage ausreichtend verdichtet
- kein neuer Prozess, keine neue Rolle und keine neue Plattform benoetigt wird
- die Entscheidung als kleiner Hinweis, PR-Kommentar, Dokumentpassage oder memory-Ergaenzung festgehalten werden kann

### 4.3 Wann eine bewusste Eskalation bzw. sichtbare Entscheidung noetig ist

Eine bewusste Eskalation oder sichtbare Entscheidung ist noetig, wenn:
- die Unklarheit mehrere Ebenen betrifft und nicht eindeutig in eine einfache Korrektur oder Dokumentation passt
- der Betrieb sonst mit einem offenen Widerspruch weiterlaufen wuerde
- eine spaetere Falschfortfuehrung wahrscheinlicher waere als eine kurze menschliche Rueckkopplung
- die Lage, die Abnahme oder die Aenderungsfortschreibung ohne explizite Sichtbarkeit unsauber wuerde

Auch dann bleibt der Pfad klein: sichtbar machen, knapp begruenden, im bestehenden repo-nahen Kontext ablegen.

### 4.4 Welche Rolle PR, Doku und memory dabei spielen

- PR dient als Ort fuer die sichtbare technische oder dokumentarische Aenderung
- Doku dient als Ort fuer die knappe fachliche Einordnung des Klaerungsfalls
- `memory.md` dient als dauerhafte, verdichtete Fortfuehrung des konsolidierten Stands

Wenn eine Eskalation noetig ist, soll sie bevorzugt in diesen drei Ebenen sichtbar bleiben, statt in eine neue Systemwelt auszuweichen.

### 4.5 Was im MVP bewusst noch kein Incident-, Ticket- oder Governance-Prozess ist

Der minimale interne Eskalations- und Klaerungspfad im MVP ist ausdruecklich noch kein formaler Prozess:
- kein Incident-Management-System
- kein Ticket-Backlog
- keine neue Governance- oder Freigabeplattform
- keine formale Eskalationsmatrix
- keine neuen Endpunkte
- keine neue Persistenzlogik
- keine neue Produktfamilie

P18 beschreibt nur den kleinsten internen Weg, Unklarheiten sichtbar zu machen und im bestehenden Rahmen zu klaeren.

## 5. Klare Abgrenzung

Diese Mini-Spezifikation fuehrt ausdruecklich nicht ein:
- kein Incident-Management-System
- kein Ticket-Backlog
- keine formale Eskalationsmatrix
- keine neue Governance- oder Freigabeplattform
- keine neuen Endpunkte
- keine neue Persistenzlogik
- keine neue Produktfamilie

Der Eskalations- und Klaerungspfad bleibt damit bewusst klein und an den vorhandenen Repo-Bausteinen orientiert.

## 6. Offene Punkte

Bewusst offen bleibt:
- ob spaeter eine strengere Trennung zwischen Klärung, Eskalation und Abnahme noetig wird
- wie weit ein spaeterer Betrieb eine formale Verantwortungs- oder Vertretungsregelung braucht
- ob einzelne Fälle spaeter in ein strukturierteres Betriebsmodell ueberfuehrt werden sollen
- welche Teile der heutigen PR-/Doku-/memory-Fortschreibung spaeter formalisiert werden muessen
- ob ein spaeterer Produkt- oder Betriebsausbau eine staerkere Koordination oder Nachverfolgung verlangt

Diese Punkte sind noch nicht durch einen echten Incident- oder Governance-Ausbau geklaert und sollen deshalb hier nicht vorweggenommen werden.

## 7. Empfohlener kleinster naechster Schritt

Der naechste Schritt sollte weiterhin nur Klärung und Begrenzung sein, nicht Implementierung:
1. die hier genannten Minimalregeln als internen Referenzrahmen festhalten
2. die Grenze zwischen klaerbarem Fall und sichtbarer Eskalation klar benennen
3. weitere Incident-, Ticket- oder Governance-Strukturen erst spaeter explizit beauftragen

## 8. Einordnung

Diese Mini-Spezifikation ist absichtlich konservativ.
Sie soll den aktuellen MVP-Eskalations- und Klaerungspfad fachlich begrenzen, ohne ein formales Incident-, Ticket- oder Governance-System zu erfinden.

Alles darueber hinaus bleibt spaeteren, explizit beauftragten Schritten vorbehalten.
