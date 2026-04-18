# P13 Export-Verbindlichkeit und operative Nutzung im MVP – Mini-Spezifikation

Status: Mini-Spezifikation v0.1 auf Basis des aktuellen Repo-Iststands
Stand: 2026-04-16

## 1. Zweck und Abgrenzung

Diese Mini-Spezifikation begrenzt die Export-Verbindlichkeit und operative Nutzung der Exporte im MVP der `AlexanderSmyslowski/catering-agents-platform`.

Sie erfindet keine neue Dokumentengenerierungs-Plattform, keine neue Freigabe- oder Signaturarchitektur und keine neue Produktfamilie. Ziel ist ausschliesslich, den bereits realen MVP-Kern der Exporte so einzuordnen, dass klar bleibt:
- was bereits vorhanden ist
- welche Exporte im MVP operativ verwendbar sind
- welche Exporte nur Prüf- oder Hilfsartefakte bleiben
- wo ausdrücklich keine formale Aussenverbindlichkeit behauptet wird

## 2. Bezug auf Pflichtenheft, MVP-Arbeitspakete, P7, P10, P11 und Memory

Grundlagen dieses Dokuments sind:
- `docs/product/PFLICHTENHEFT.md`
- `docs/product/MVP_ARBEITSPAKETE.md`
- `docs/product/P7_BETRIEBSFREIGABE_MVP_FREIGABEKRITERIEN_MINISPEZ.md`
- `docs/product/P10_MANUELLE_BETRIEBSINTERVENTIONEN_UND_FALLBACKS_MINISPEZ.md`
- `docs/product/P11_DATENKORREKTUREN_UND_FACHLICHE_NACHPFLEGE_MINISPEZ.md`
- `memory.md`
- der aktuelle Repo-Iststand in den read-only Exportpfaden, im Audit-/Betriebs-/Operator-Kontext und in den zugrunde liegenden operativen Datenpfaden

Wesentliche Ableitung:
- Das Pflichtenheft beschreibt operative Artefakte fuer interne Nutzung.
- Die MVP-Arbeitspakete halten Betrieb, Audit und Abgrenzung bewusst klein.
- P7 begrenzt den Freigaberahmen des internen MVP-Betriebs.
- P10 begrenzt manuelle Fallbacks und Betriebsinterventionen.
- P11 begrenzt Datenkorrekturen und fachliche Nachpflege an den zugrunde liegenden Daten.
- P13 ordnet nun die Exporte als operative Artefakte ein und stellt klar, dass Exportverbindlichkeit im MVP interne Nutzbarkeit und Nachvollziehbarkeit meint, nicht eine neue Aussenfreigabe.
- `memory.md` bleibt der Kurzanker fuer die konsolidierten Repo-Fakten.

## 3. Aktueller repo-gebundener Kontext

### 3.1 Bereits vorhanden

Im Repo sind bereits folgende Bausteine sichtbar:
- read-only Exportpfade fuer Angebot, Produktionsblatt und Einkaufsliste
- operative Artefakte in Angebot, Produktion und Einkauf
- Audit-/Nachvollziehbarkeitskontext fuer mutierende Aktionen und Betriebslaeufe
- manuelle Fallbacks und Datenkorrekturen als gesondert begrenzte Rahmen
- Rollen-/Operator-Zuordnung ueber die vorhandene Minimalrollen- und `x-actor-name`-Konvention

### 3.2 Fuer den MVP zulässig und verbindlich

Fuer den MVP ist verbindlich anzunehmen:
- Exporte duerfen als operative Arbeitsartefakte genutzt werden, wenn sie aus den passenden fachlichen Kernpfaden stammen
- Exporte duerfen intern zur Abstimmung, Weiterverarbeitung und Verifikation verwendet werden
- Exporte duerfen die operative Sicht auf Angebot, Produktion und Einkauf verdichten
- Exporte duerfen als nachvollziehbare Belege fuer den internen Betrieb dienen
- Exportartefakte duerfen nur dann als belastbar gelten, wenn ihre zugrunde liegenden operativen Daten ebenfalls als konsistent und passend zum Kontext gelten

### 3.3 Verhaeltnis zu operativen Artefakten in Angebot, Produktion und Einkauf

Exportartefakte sind im MVP von ihren zugrunde liegenden Daten fachlich abzugrenzen:
- Angebote, Produktionsplaene und Einkaufslisten sind die fachliche Quelle
- HTML-/CSV-Exporte sind abgeleitete operative Ausgabeformen dieser Quelle
- ein Export ist kein eigenstaendiger fachlicher Wahrheitskern, sondern eine Darstellung bzw. Verdichtung vorhandener operativer Daten
- wenn die zugrunde liegenden Daten unklar oder inkonsistent sind, ist der Export ebenfalls nur mit Vorsicht zu verwenden

### 3.4 Verhaeltnis zu Audit/Nachvollziehbarkeit

Im bestehenden MVP-Rahmen gilt:
- Exporte koennen Teil der operativen Nachvollziehbarkeit sein
- Exportausgaben koennen im internen Betrieb helfen, Entscheidungen und Bestand sichtbar zu machen
- ein Export ist jedoch keine neue Freigabe- oder Signaturwahrheit
- Audit-Nachvollziehbarkeit bleibt fachlich von der Exportausgabe getrennt

### 3.5 Verhaeltnis zu manuellen Fallbacks und Datenkorrekturen

Exports und die benachbarten Fallback-/Korrektur-Rahmen stehen im MVP in folgender Beziehung:
- manuelle Fallbacks koennen Exporte als Hilfs- und Verifikationsartefakte nutzen
- Datenkorrekturen koennen vor einem neuen Export laengere fachliche Konsistenz herstellen
- ein korrigierter Export wird dennoch nur als abgeleitete Ausgabe verstanden, nicht als neue fachliche Quelle
- Exportartefakte sollen nicht stillschweigend die Korrektur von Primardaten ersetzen

## 4. Kleinste MVP-Festlegung

### 4.1 Welche Exporte im MVP operativ verwendbar sind

Im MVP sind folgende Exporte operativ verwendbar:
- Angebots-Exporte fuer interne Abstimmung und Weitergabe
- Produktionsblatt-Exporte fuer interne Produktions- und Kuechenplanung
- Einkaufslisten-Exporte fuer operative Beschaffung und Nachverfolgung

Diese Exporte sind im MVP als Arbeitsartefakte nutzbar, wenn ihre zugrunde liegenden Daten aus dem passenden Kontext stammen und der Operator-Kontext stimmt.

### 4.2 Welche Exporte nur Prüf-/Hilfsartefakte bleiben

Im MVP bleiben folgende Verwendungen bewusst nur Prüf-/Hilfsartefakte:
- Exporte zur Kontrolle der Datenlage ohne operative Weiterverwendung
- Exporte zur Verifikation von Layout, Struktur und Erreichbarkeit
- Exporte zur Demonstration eines Zustands im internen Betrieb
- Exporte, deren fachliche Quelle noch nicht als belastbar gilt

### 4.3 Keine formale Aussenverbindlichkeit, Signatur oder rechtliche Freigabewirkung

Im MVP wird ausdruecklich nicht behauptet:
- dass ein Export automatisch eine formale Aussenverbindlichkeit erzeugt
- dass ein Export eine Signaturarchitektur ersetzt
- dass ein Export rechtliche Freigabewirkung hat
- dass ein Export die fachliche Freigabe eines Artefakts nach aussen darstellt

Die Exporte sind interne operative Ausgabeformen. Mehr wird im MVP nicht zugesagt.

### 4.4 Abgrenzung zu den zugrunde liegenden operativen Daten

Die fachliche Abgrenzung lautet:
- operative Daten sind die Quelle
- Exportartefakte sind die abgeleitete Darstellung
- ein Export kann nur so verbindlich sein wie die Daten, aus denen er erzeugt wurde
- bei Datenkorrekturen oder manuellen Fallbacks muss die zugrunde liegende Quelle erneut als passend bewertet werden, bevor ein Export als intern brauchbar gilt

## 5. Klare Abgrenzung

Diese Mini-Spezifikation fuehrt ausdruecklich nicht ein:
- keine neue Signatur- oder Freigabewelt
- keine neue Dokumentenklassifikation ausserhalb des MVP
- keine automatische Korrektur oder Nachbearbeitung von Exportartefakten
- keine neuen Endpunkte
- keine neue Persistenzlogik
- keine neue Produktfamilie

P13 ordnet nur die operative Nutzung der bestehenden Exportpfade ein.

## 6. Offene Punkte

Bewusst offen bleibt:
- ob spaeter einzelne Exporte strenger als interne Belege oder nur als Hilfsartefakte behandelt werden sollen
- ob im spaeteren Betrieb eine feinere Unterscheidung zwischen Entwurf, Arbeitsbeleg und freigegebenem Beleg noetig wird
- wie weit ein spaeterer Aussenauftritt des Exports rechtlich oder organisatorisch eingeordnet werden muss
- welche Teile der Exportnutzung organisatorisch dokumentiert und welche technisch hart gefuehrt werden muessen
- ob der MVP spaeter eine strengere Klassifikation von Exportartefakten benoetigt

Diese Punkte sind noch nicht durch einen echten Export- oder Freigabe-Ausbau geklaert und sollen deshalb hier nicht vorweggenommen werden.

## 7. Empfohlener kleinster naechster Schritt

Der naechste Schritt sollte weiterhin nur Klärung und Begrenzung sein, nicht Implementierung:
1. die hier genannten Exportzwecke als internen Referenzrahmen festhalten
2. die Grenze zwischen operativ nutzbarem Export und reinem Prüf-/Hilfsartefakt klar benennen
3. weitere Export- oder Freigabefunktionen erst spaeter explizit beauftragen

## 8. Einordnung

Diese Mini-Spezifikation ist absichtlich konservativ.
Sie soll den aktuellen MVP-Kern der Exporte fachlich begrenzen, ohne eine neue Freigabe-, Signatur- oder Dokumentengenerierungsplattform zu erfinden.

Alles darueber hinaus bleibt spaeteren, explizit beauftragten Schritten vorbehalten.
