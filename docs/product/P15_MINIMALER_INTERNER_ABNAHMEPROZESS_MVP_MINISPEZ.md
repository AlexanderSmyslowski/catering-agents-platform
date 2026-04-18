# P15 Minimaler interner Abnahmeprozess im MVP – Mini-Spezifikation

Status: Mini-Spezifikation v0.1 auf Basis des aktuellen Repo-Iststands
Stand: 2026-04-16

## 1. Zweck und Abgrenzung

Diese Mini-Spezifikation begrenzt den minimalen internen Abnahmeprozess fuer den MVP der `AlexanderSmyslowski/catering-agents-platform`.

Sie erfindet keine neue QA-Organisation, keine neue Freigabeplattform, keine mehrstufige Sign-off-Architektur und keine Workflow-Engine. Ziel ist ausschliesslich, den bereits realen MVP-Abnahmeprozess so zu formulieren, dass klar bleibt:
- was fuer eine interne Abnahme im MVP genuegt
- was bei rein dokumentarischen Aenderungen ausreicht
- was bei fachnahen oder betriebsnahen Aenderungen zusaetzlich manuell gegengeprueft werden soll
- was bewusst noch kein formaler Release-Prozess ist

## 2. Bezug auf Pflichtenheft, MVP-Arbeitspakete, P7, P10, P13, P14 und Memory

Grundlagen dieses Dokuments sind:
- `docs/product/PFLICHTENHEFT.md`
- `docs/product/MVP_ARBEITSPAKETE.md`
- `docs/product/P7_BETRIEBSFREIGABE_MVP_FREIGABEKRITERIEN_MINISPEZ.md`
- `docs/product/P10_MANUELLE_BETRIEBSINTERVENTIONEN_UND_FALLBACKS_MINISPEZ.md`
- `docs/product/P13_EXPORT_VERBINDLICHKEIT_UND_OPERATIVE_NUTZUNG_MINISPEZ.md`
- `docs/product/P14_AUDIT_REVIEW_SPUREN_OPERATIVE_NUTZUNG_MINISPEZ.md`
- `memory.md`
- der aktuelle Repo-Iststand in den Smoke-/Test-/Build-Pfaden, den Rollen-/Guard-Pfaden, den Exportpfaden, den Audit-/Review-Pfaden und den manuellen Betriebsrahmen

Wesentliche Ableitung:
- Das Pflichtenheft beschreibt die interne Betriebsplattform und ihre operativen Artefakte.
- Die MVP-Arbeitspakete ordnen die naechsten kleinen Schritte konservativ.
- P7 begrenzt die Betriebsfreigabe auf einen kleinen Go/No-Go-Rahmen.
- P10 begrenzt manuelle Betriebsinterventionen und Fallbacks.
- P13 begrenzt Export-Verbindlichkeit auf interne Nutzbarkeit.
- P14 begrenzt Audit-/Review-Spuren auf interne Betriebs- und Kontrollnachweise.
- P15 fasst diese bereits realen Grenzen zu einem minimalen internen Abnahmeprozess zusammen, ohne daraus einen formalen Release-Prozess zu machen.
- `memory.md` bleibt der Kurzanker fuer die konsolidierten Repo-Fakten.

## 3. Aktueller repo-gebundener Kontext

### 3.1 Bereits vorhanden

Im Repo sind bereits folgende Bausteine sichtbar:
- gruener automatisierter Vitest-Korridor
- reproduzierbarer `npm run build`-Pfad
- schmale UI-/Smoke-Grundlage fuer die Kernrouten
- zentrale Rollen-/Guard-Grundlage im `shared-core`
- geschuetzte mutierende Kernpfade
- read-only Exportpfade fuer Angebot, Produktionsblatt und Einkaufsliste
- Audit-/Review-/Finalize-Nachweise in den geschuetzten Kernpfaden
- manuelle Fallbacks und Datenkorrekturen als gesondert begrenzte Rahmen

### 3.2 Fuer den MVP ausreichend und verbindlich

Fuer die minimale interne Abnahme im MVP ist verbindlich anzunehmen:
- die bereits vorhandene Test-/Build-Basis ist die erste technische Abnahmeschwelle
- die Rollen-/Guard-Basis ist bei mutierenden Kernpfaden mit zu beachten
- Exporte sind als operative Arbeitsartefakte zu prufen, wenn sie vom Aenderungskontext beruehrt werden
- Audit-/Review-Spuren dienen als interne Kontroll- und Plausibilisierungsbasis
- manuelle Fallbacks bleiben Teil der operativen Einordnung, nicht Teil einer neuen Automatisierungswelt

### 3.3 Was heute bereits fachlich als Abnahmehilfe dient

Heute bereits als Abnahmehilfe nutzbar:
- Tests bestaetigen die Kernlogik und die geschuetzten Pfade
- Builds bestaetigen die technische Integritaet des Monorepos
- Exportpfade helfen, operative Artefakte gegen den Fachkontext zu plausibilisieren
- Audit-/Review-Spuren helfen, Aenderungen und Entscheidungen intern nachzuvollziehen
- manuelle Fallbacks helfen, unklare oder stoeranfällige Faelle bewusst einzuordnen

## 4. Kleinste MVP-Festlegung

### 4.1 Was fuer rein dokumentarische Aenderungen genuegt

Wenn nur Dokumentation oder memory-nahe Texte geaendert werden und keine runtime-relevanten Dateien betroffen sind, genuegt im MVP:
- fachliche Review des betroffenen Dokuments
- Abgleich gegen Pflichtenheft und angrenzende Mini-Spezifikationen
- Pruefung, dass keine neue Produkt-, API- oder Persistenzbehauptung eingefuehrt wird

Fuer rein dokumentarische Aenderungen ist damit keine formale technische Abnahme mit Build-/Testpflicht gemeint, solange der Aenderungskreis wirklich dokumentarisch bleibt.

### 4.2 Was bei fachnahen oder betriebsnahen Aenderungen zusaetzlich gegengeprueft werden soll

Wenn Aenderungen fachnah oder betriebsnah sind, also z. B. Rollen/Guards, Servicepfade, Exporte, Audit-/Review-Sicht oder manuelle Betriebswege beruehren, soll die minimale interne Abnahme im MVP aus der folgenden Kombination bestehen:
1. fachliche Diff- und Scope-Pruefung gegen die betroffenen Dokumente oder Codepfade
2. relevanter manueller Plausibilitaetscheck im betroffenen Bedien- oder Betriebsfluss
3. `npm test`
4. `npm run build`

Wenn die Aenderung einen konkreten Kernpfad betrifft, soll die Abnahme zusaetzlich den kleinsten fachlich passenden Kontrollpfad beruecksichtigen, zum Beispiel:
- Guard-/Access-Control-bezogene Tests bei Rollen- oder Schutzpfaden
- Exportpruefungen bei Exportberuehrung
- Audit-/Review-Sicht bei betriebsnahen Nachvollziehbarkeitsfragen
- manuelle Fallback-Pruefung bei Stoerungs- oder Wiederanlaufthemen

### 4.3 Rolle von Audit-/Review-Spuren und Exportpruefungen

Audit-/Review-Spuren und Exportpruefungen spielen in der minimalen internen Abnahme im MVP folgende Rolle:
- Audit-/Review-Spuren liefern die interne Nachvollziehbarkeit von Aenderungen und Entscheidungen
- Exportpruefungen liefern die Plausibilisierung operativer Artefakte
- beide zusammen helfen, fachnahe oder betriebsnahe Aenderungen gegen den realen Nutzungskontext einzuordnen
- weder Spur noch Export ersetzen die fachliche Review oder die technische Grundpruefung

### 4.4 Was im MVP bewusst noch kein formaler Release-Prozess ist

Der minimale interne Abnahmeprozess im MVP ist ausdruecklich noch kein formaler Release-Prozess:
- keine QA-Organisation mit eigener Welt
- keine mehrstufige Sign-off-Architektur
- keine neue Freigabeplattform
- keine neue Workflow-Engine
- keine neue Endpunkt- oder Persistenzwelt
- keine formale Aussenfreigabe oder Abnahmefiktion

P15 beschreibt nur die kleinste interne Abnahmeform fuer den bestehenden MVP-Rahmen.

## 5. Klare Abgrenzung

Diese Mini-Spezifikation fuehrt ausdruecklich nicht ein:
- keine neue QA-Organisation
- keine neue Freigabeplattform
- keine mehrstufige Workflow- oder Sign-off-Architektur
- keine neuen Endpunkte
- keine neue Persistenzlogik
- keine neue Produktfamilie

Der Abnahmeprozess bleibt damit bewusst klein und an den vorhandenen Repo-Bausteinen orientiert.

## 6. Offene Punkte

Bewusst offen bleibt:
- wer spaeter die formalen internen Abnehmerrollen genau sind
- ob zukuenftig nach Aenderungsklassen getrennte Abnahmewege benoetigt werden
- ob spaetere Betriebsstufen eine staerkere Trennung zwischen dokumentarischer, fachlicher und technischer Abnahme brauchen
- wie weit ein spaeterer Release- oder QA-Ausbau organisatorisch formalisiert werden soll
- ob es spaeter eine explizite Abnahme-Matrix pro Bereich geben muss

Diese Punkte sind noch nicht durch einen echten Release- oder QA-Ausbau geklaert und sollen deshalb hier nicht vorweggenommen werden.

## 7. Empfohlener kleinster naechster Schritt

Der naechste Schritt sollte weiterhin nur Klärung und Begrenzung sein, nicht Implementierung:
1. die hier genannten Minimalregeln als internen Referenzrahmen festhalten
2. die Grenze zwischen dokumentarischer und fachnaher Aenderung klar benennen
3. weitere QA-, Release- oder Sign-off-Strukturen erst spaeter explizit beauftragen

## 8. Einordnung

Diese Mini-Spezifikation ist absichtlich konservativ.
Sie soll den aktuellen MVP-Abnahmeprozess fachlich begrenzen, ohne einen formalen Enterprise-Release-Prozess zu erfinden.

Alles darueber hinaus bleibt spaeteren, explizit beauftragten Schritten vorbehalten.
