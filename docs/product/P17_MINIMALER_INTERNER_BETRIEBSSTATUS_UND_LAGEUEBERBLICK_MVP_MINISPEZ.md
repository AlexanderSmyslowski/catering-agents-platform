# P17 Minimaler interner Betriebsstatus- und Lageueberblick im MVP – Mini-Spezifikation

Status: Mini-Spezifikation v0.1 auf Basis des aktuellen Repo-Iststands
Stand: 2026-04-16

## 1. Zweck und Abgrenzung

Diese Mini-Spezifikation begrenzt den minimalen internen Betriebsstatus- und Lageueberblick fuer den MVP der `AlexanderSmyslowski/catering-agents-platform`.

Sie erfindet keine neue Monitoring-Plattform, keine Alerting-/Eskalationsarchitektur, keine Incident-Organisation und keine Ops-Konsole. Ziel ist ausschliesslich, den bereits realen MVP-Betrieb so einzuordnen, dass ein interner Betreiber mit wenigen repo-gebundenen Signalen erkennen kann:
- ob der Betrieb technisch grundsaetzlich gruen ist
- ob fachliche Artefakte und Exporte plausibel sind
- ob Audit-/Review-Spuren und manuelle Fallbacks einen stabilen Betriebskontext zeigen
- wie der aktuelle Lagezustand im kleinen MVP-Rahmen knapp beschrieben werden kann

## 2. Bezug auf Pflichtenheft, MVP-Arbeitspakete, P10, P14, P15, P16 und Memory

Grundlagen dieses Dokuments sind:
- `docs/product/PFLICHTENHEFT.md`
- `docs/product/MVP_ARBEITSPAKETE.md`
- `docs/product/P10_MANUELLE_BETRIEBSINTERVENTIONEN_UND_FALLBACKS_MINISPEZ.md`
- `docs/product/P14_AUDIT_REVIEW_SPUREN_OPERATIVE_NUTZUNG_MINISPEZ.md`
- `docs/product/P15_MINIMALER_INTERNER_ABNAHMEPROZESS_MVP_MINISPEZ.md`
- `docs/product/P16_MINIMALER_INTERNER_AENDERUNGS_UND_ENTSCHEIDUNGSLOG_MVP_MINISPEZ.md`
- `memory.md`
- der aktuelle Repo-Iststand in den Test-/Build-/Smoke-Pfaden, den Exportpruefungen, den Audit-/Review-Pfaden, den manuellen Fallbacks sowie in der laufenden repo-/PR-/memory-nahen Fortfuehrung

Wesentliche Ableitung:
- Das Pflichtenheft beschreibt eine interne, nachvollziehbare Betriebsplattform mit operativen Artefakten.
- Die MVP-Arbeitspakete halten Betrieb, Abnahme und Abgrenzung bewusst klein.
- P10 begrenzt manuelle Betriebsinterventionen und Fallbacks.
- P14 begrenzt Audit-/Review-Spuren auf interne Betriebs- und Kontrollnachweise.
- P15 begrenzt die kleinste interne Abnahme auf bestehende Test-, Build-, Rollen-, Export- und Audit-/Review-Kontexte.
- P16 begrenzt die Dokumentation von Aenderungen und Entscheidungen auf PR-, Commit-, Doku- und memory-Kontexte.
- P17 ordnet nun die wenigen Signale fuer den internen Lageueberblick ein, ohne daraus ein formales Betriebs- oder Monitoring-System zu machen.
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

### 3.2 Fuer den MVP ausreichend und verbindlich

Fuer den minimalen internen Betriebsstatus- und Lageueberblick im MVP ist verbindlich anzunehmen:
- Tests und Build sind die erste technische Lagebasis
- die Smoke-Grundlage zeigt, ob die Kernrouten grundsaetzlich erreichbar bleiben
- Exporte zeigen, ob operative Artefakte weiterhin plausibel erzeugbar sind
- Audit-/Review-Spuren zeigen, ob Kernaktionen und betriebliche Bewegungen nachvollziehbar bleiben
- manuelle Fallbacks zeigen, ob der Betrieb noch bewusst und kontrolliert eingeordnet werden kann
- PR, Commit, Dokument und `memory.md` zeigen, ob die laufende Fortschreibung konsistent bleibt

### 3.3 Verhaeltnis zwischen technischen, fachlichen und betrieblichen Signalen

Der Lageueberblick unterscheidet im MVP zwischen drei Signalarten:
- technische Signale: Test-/Build-Status, Smoke-Erreichbarkeit, geschuetzte Kernpfade
- fachliche Signale: Exportplausibilitaet, Audit-/Review-Belege, inhaltlich nachvollziehbare Artefakte
- betriebliche Signale: manuelle Fallbacks, bekannte Einschränkungen, PR-/memory-nahe Entscheidungsfortschreibung

Diese Ebenen sollen getrennt wahrgenommen werden. Ein gruenes Testergebnis ersetzt keine fachliche Plausibilisierung, und ein plausibler Export ersetzt kein geschuetztes Kernsignal.

### 3.4 Rolle von Export-, Audit-/Review- und Fallback-Sicht

Im bestehenden MVP-Rahmen gilt:
- Export-Sicht hilft, operative Artefakte als Lageindikator zu lesen
- Audit-/Review-Sicht hilft, Aenderungen und Betriebsbewegungen in ihrer internen Bedeutung zu verstehen
- Fallback-Sicht hilft, Stoerungen oder Unsicherheiten als bewusst kontrollierten Betriebszustand einzuordnen
- gemeinsam bilden diese Sichten den schmalen Lageueberblick, ohne eine eigene Ops- oder Monitoring-Welt zu erzeugen

## 4. Kleinste MVP-Festlegung

### 4.1 Welche wenigen Statussignale im laufenden internen Betrieb genuegen sollen

Im MVP genuegen fuer den internen Betriebsstatus im Kern diese wenigen Signale:
1. `tests gruen` oder `tests nicht gruen`
2. `build gruen` oder `build nicht gruen`
3. `smoke / kernrouten erreichbar` oder `smoke offen`
4. `exporte plausibel` oder `exportpfad offen`
5. `audit/review nachvollziehbar` oder `nachvollziehbarkeit offen`
6. `fallback bewusst und dokumentiert` oder `betrieblich ungeklaert`

Diese Signale sollen nicht als formales Dashboard, sondern als knappe Lageformulierung verwendet werden.

### 4.2 Was als knapper interner Lageueberblick ausreicht

Ein knapper interner Lageueberblick reicht im MVP aus, wenn er in wenigen Saetzen sagen kann:
- ob die technische Basis laeuft
- ob die operativen Artefakte plausibel sind
- ob Nachvollziehbarkeit und manuelle Steuerbarkeit erhalten sind
- ob ein aktueller Einschraenkungs- oder Stoerungszustand bekannt ist

Die Lagebeschreibung soll bewusst klein bleiben und nur den aktuellen internen Betriebsrahmen benennen.

### 4.3 Wie technische, fachliche und betriebliche Signale voneinander abzugrenzen sind

Die Abgrenzung lautet:
- technische Signale beantworten: laeuft der Kern stabil?
- fachliche Signale beantworten: sind Artefakte und Nachweise inhaltlich plausibel?
- betriebliche Signale beantworten: kann der aktuelle Zustand noch bewusst manuell gefuehrt oder eingeordnet werden?

Ein einzelnes Signal darf nie stillschweigend als Beleg fuer alle drei Ebenen verwendet werden.

### 4.4 Welche Rolle Export-, Audit-/Review- und Fallback-Sicht dabei spielen

- Export-Sicht liefert den Blick auf operative Ausgabeformen
- Audit-/Review-Sicht liefert den Blick auf interne Bewegungs- und Entscheidungsnachweise
- Fallback-Sicht liefert den Blick auf kontrollierte manuelle Reaktion bei Stoerung oder Unsicherheit

Zusammen geben sie im MVP einen schmalen, internen Lageueberblick. Mehr wird hier nicht behauptet.

### 4.5 Was im MVP bewusst noch kein Monitoring-, Incident- oder Ops-System ist

Der interne Status- und Lageueberblick im MVP ist ausdruecklich noch kein formales Betriebs- oder Monitoring-System:
- keine Monitoring-Plattform
- keine Alerting-/Eskalationsarchitektur
- keine Incident-Organisation
- keine Ops-Konsole
- keine neuen Endpunkte
- keine neue Persistenzlogik
- keine neue Produktfamilie

P17 beschreibt nur den kleinsten internen Lageblick auf Basis bereits vorhandener Repo-Signale.

## 5. Klare Abgrenzung

Diese Mini-Spezifikation fuehrt ausdruecklich nicht ein:
- keine neue Monitoring-Plattform
- keine Alerting-/Eskalationsarchitektur
- keine Incident- oder Ticket-Organisation
- keine neue Ops-Konsole
- keine neuen Endpunkte
- keine neue Persistenzlogik
- keine neue Produktfamilie

Der Betriebsstatus- und Lageueberblick bleibt damit bewusst klein und an den vorhandenen Repo-Bausteinen orientiert.

## 6. Offene Punkte

Bewusst offen bleibt:
- ob spaeter eine strengere Trennung zwischen Statusanzeige, Lagebild und Betriebsverantwortung benoetigt wird
- wie weit ein spaeterer Betrieb Alerts oder automatische Eskalationen tatsaechlich braucht
- ob einzelne Signale spaeter in eine formale Betriebskoordination ueberfuehrt werden sollen
- welche Teile des heutigen Lageueberblicks spaeter einer festen Ops-Organisation zugeordnet werden muessen
- ob ein spaeterer Ausbau mehr Detailtiefe oder mehr Automatisierung verlangt

Diese Punkte sind noch nicht durch einen echten Ops- oder Monitoring-Ausbau geklaert und sollen deshalb hier nicht vorweggenommen werden.

## 7. Empfohlener kleinster naechster Schritt

Der naechste Schritt sollte weiterhin nur Klärung und Begrenzung sein, nicht Implementierung:
1. die hier genannten Minimalregeln als internen Referenzrahmen festhalten
2. die Grenze zwischen Statussignal und betrieblicher Verantwortung klar benennen
3. weitere Monitoring-, Incident- oder Ops-Strukturen erst spaeter explizit beauftragen

## 8. Einordnung

Diese Mini-Spezifikation ist absichtlich konservativ.
Sie soll den aktuellen MVP-Betriebsstatus und Lageueberblick fachlich begrenzen, ohne eine neue Monitoring-, Incident- oder Ops-Plattform zu erfinden.

Alles darueber hinaus bleibt spaeteren, explizit beauftragten Schritten vorbehalten.
