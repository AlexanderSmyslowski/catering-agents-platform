# P6 Aufbewahrung, Löschung und Archivierung – Mini-Spezifikation

Status: Mini-Spezifikation v0.1 auf Basis des aktuellen Repo-Iststands
Stand: 2026-04-16

## 1. Zweck und Abgrenzung

Diese Mini-Spezifikation begrenzt den MVP-Umgang mit Aufbewahrung, Löschung und Archivierung im Repo `AlexanderSmyslowski/catering-agents-platform`.

Sie ist bewusst klein und operativ. Sie erfindet keine neue Retention-Strategie, keine Compliance-Architektur und keine technische Archivplattform. Ziel ist nur, den bereits realen Produktkern so zu ordnen, dass klar ist:
- was im MVP aktiv vorgehalten wird
- was eher archiviert als hart geloescht werden soll
- was nur manuell bzw. operativ geloescht werden darf
- was bewusst offen bleibt und spaeter separat geklaert werden muss

## 2. Bezug auf Pflichtenheft, MVP-Arbeitspakete, P5 und Memory

Grundlagen dieses Dokuments sind:
- `docs/product/PFLICHTENHEFT.md`
- `docs/product/MVP_ARBEITSPAKETE.md`
- `docs/product/P5_MVP_ABGRENZUNG_MINISPEZ.md`
- `memory.md`
- der aktuelle Repo-Iststand in Intake, Angebot, Produktion, Exporte und Audit-/Review-Flows

Wesentliche Ableitung:
- Das Pflichtenheft beschreibt eine interne, nachvollziehbare Betriebsplattform mit auditierbaren Aenderungen und operativen Artefakten.
- Die MVP-Arbeitspakete priorisieren zuerst Rollen/Rechte, Smoke/Verifikation, Betrieb, Audit und danach die saubere Abgrenzung des MVP-Kerns.
- P5 begrenzt bereits den MVP-Kern pro Bereich; P6 ergaenzt diese Grenze jetzt um den Umgang mit Aufbewahrung, Archivierung und Loeschung.
- `memory.md` dokumentiert den aktuellen konsolidierten Repo-Stand und bleibt der Kurzanker fuer durable Projektfakten.

## 3. Aktueller repo-gebundener Datenkontext

Im aktuellen Repo sind fuer P6 vor allem folgende Daten- und Artefaktklassen relevant:
- Intake-Anfragen und normalisierte Intake-Daten
- AcceptedEventSpecs / akzeptierte Veranstaltungsdaten
- Angebotsentwuerfe und Angebotsvarianten
- Produktionsplaene
- Einkaufslisten
- Audit-/Review-bezogene Nachvollziehbarkeit
- Export-Artefakte fuer Angebot, Produktion und Einkauf

Diese Objekte sind nicht nur technische Zwischendaten, sondern Teil des operativen Produktgedaechtnisses.
Darum ist fuer den MVP-Kontext ein vorsichtiger Umgang mit Loeschung sinnvoller als ein pauschales automatisches Entfernen.

## 4. Kleinste MVP-Regeln fuer Aufbewahrung, Archivierung und Loeschung

### 4.1 Was im MVP aktiv vorgehalten wird

Aktiv vorgehalten werden sollen im MVP insbesondere:
- aktuelle Intake-Anfragen, solange sie fuer Bearbeitung, Nachvollziehbarkeit oder Uebernahme relevant sind
- AcceptedEventSpecs als operative Grunddaten fuer Angebot, Produktion und Export
- aktuelle Angebotsentwuerfe und operative Varianten, solange sie fuer den laufenden Vorgang relevant sind
- aktuelle Produktionsplaene und Einkaufslisten, solange sie fuer den laufenden operativen Einsatz relevant sind
- Audit-/Review-Spuren, soweit sie fuer interne Nachvollziehbarkeit benoetigt werden

Konservativ gilt: Alles, was noch direkt fuer operative Weiterbearbeitung, Rueckverfolgung oder Export benoetigt wird, bleibt aktiv und wird nicht automatisch geloescht.

### 4.2 Was im MVP eher archiviert als geloescht wird

Eher archiviert als hart geloescht werden sollen im MVP:
- abgeschlossene oder nicht mehr aktive Angebotsentwuerfe
- nicht mehr aktive Produktionsplaene
- bereits genutzte Einkaufslisten
- abgeschlossene Export-Artefakte und deren operative Nachweise
- alte, aber nachvollziehbarkeitsrelevante Zwischenstaende, sofern sie nicht mehr im aktiven Arbeitskorridor liegen

Archivieren bedeutet hier bewusst nur: aus dem aktiven Arbeitsfokus herausnehmen und spaeter wieder auffindbar halten, nicht eine neue Plattform oder ein neues Langzeitarchivsystem aufzubauen.

### 4.3 Was nur manuell / operativ geloescht werden darf

Nur manuell oder operativ geloescht werden sollten im MVP:
- eindeutig fehlerhafte oder doppelt erzeugte Test-/Demo-Daten
- klar unbrauchbare Zwischenstaende ohne produktiven Nutzen
- offensichtliche Bereinigungen auf Operatorenebene, wenn sie bewusst angeordnet werden

Wichtig:
- keine automatische Loeschung im Hintergrund
- keine stille Bereinigung durch einen neuen Retention-Job
- keine geloeschten Daten ohne bewusste operative Entscheidung

### 4.4 Was bewusst offen bleibt

Offen bleiben im MVP bewusst:
- konkrete Aufbewahrungsfristen
- Differenzierung nach Datenkategorie, Umgebung und rechtlicher Grundlage
- ob Archivierung logisch, dateibasiert oder extern erfolgen soll
- wer eine manuelle Loeschung genau freigibt
- wie exportierte Artefakte langfristig behandelt werden
- ob spaeter eine eigene Archivierungs- oder Retention-Policy notwendig wird

Diese Punkte sind fuer den aktuellen MVP-Stand noch nicht hart zu spezifizieren.

## 5. Klare Abgrenzung

Diese Mini-Spezifikation fuehrt ausdruecklich nicht ein:
- keine automatische Retention-Engine
- keine neue Archivplattform
- keine neue Compliance-Architektur
- keine neuen Endpunkte
- keine neue Persistenzlogik
- keine neue Feature-Familie
- keine grosse Datenschutz-/Compliance-Welt

Der Anspruch ist nur: den MVP intern so klein zu begrenzen, dass Aufbewahrung und Loeschung nicht stillschweigend zu einer neuen Produktwelt auswachsen.

## 6. Operative MVP-Empfehlung

Der kleinste sinnvolle naechste Schritt ist bewusst keine Implementierung, sondern eine klare fachliche Begrenzung:
1. aktive, archivierungsnahe und loeschbare Datenklassen im Produktkontext benennen
2. die manuelle Bereinigung von der automatischen Loeschung trennen
3. nur so viel Aufbewahrung festhalten, wie fuer Nachvollziehbarkeit und laufende Operationen wirklich noetig ist
4. offene Fristen und Freigaben getrennt spaeter entscheiden

Damit bleibt P6 als Beta-Gate klein, intern und repo-gebunden.

## 7. Risiken und offene Annahmen

Risiken im aktuellen Stand:
- ohne klare Begrenzung kann aus Aufbewahrung schnell ein neues Compliance-Projekt werden
- zu fruehe Automatisierung wuerde die bestehende MVP-Schoepfungslogik unnoetig verkomplizieren
- harte Aufbewahrungsregeln ohne echten Produktbedarf wuerden den internen Betrieb blockieren

Annahmen:
- der aktuelle Produktkern braucht in erster Linie Nachvollziehbarkeit und operative Nutzbarkeit
- Archivierung ist im MVP primaer eine Ordnungs- und Begrenzungsfrage, keine eigene Plattformfrage
- Loeschung soll nur dort erfolgen, wo sie operativ bewusst gewollt ist

## 8. Empfehlung fuer den naechsten kleinen Schritt

Der naechste Schritt sollte weiterhin nur Klärung und Begrenzung sein, nicht Implementierung:
- die genannten Datenklassen in einem kleinen Folgeabgleich bestaetigen
- die operative Loeschgrenze fuer Demo-, Test- und Fehlfaelle festhalten
- erst danach entscheiden, ob und wo spaeter eine technische Archivierung wirklich notwendig wird

## 9. Einordnung

Diese Mini-Spezifikation ist absichtlich konservativ.
Sie soll den MVP-Kern vor ueberhasteter Retention- oder Compliance-Ausweitung schuetzen und gleichzeitig den bestehenden Repo-Stand operativ sauber beschreiben.

Alles darueber hinaus bleibt spaeteren, explizit beauftragten Schritten vorbehalten.
