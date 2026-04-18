# P10 Manuelle Betriebsinterventionen und Fallbacks im MVP – Mini-Spezifikation

Status: Mini-Spezifikation v0.1 auf Basis des aktuellen Repo-Iststands
Stand: 2026-04-16

## 1. Zweck und Abgrenzung

Diese Mini-Spezifikation begrenzt manuelle Betriebsinterventionen und Fallback-Prozesse fuer den MVP der `AlexanderSmyslowski/catering-agents-platform`.

Sie erfindet keine neue Incident-Plattform, keine neue Admin-Konsole, keine automatische Recovery-Engine und keine neue Betriebsproduktfamilie. Ziel ist ausschliesslich, den bereits realen MVP-Betrieb so einzuordnen, dass klar bleibt:
- was bereits vorhanden ist
- was fuer den MVP manuell/operativ zulässig und verbindlich ist
- was bei Stoerung, inkonsistentem Zustand oder fehlgeschlagenem Lauf erwartet wird
- was bewusst nicht automatisiert wird

## 2. Bezug auf Pflichtenheft, MVP-Arbeitspakete, P3, P7, P9 und Memory

Grundlagen dieses Dokuments sind:
- `docs/product/PFLICHTENHEFT.md`
- `docs/product/MVP_ARBEITSPAKETE.md`
- `docs/product/P3_BETRIEB_DEPLOYMENT_MINISPEZ.md`
- `docs/product/P7_BETRIEBSFREIGABE_MVP_FREIGABEKRITERIEN_MINISPEZ.md`
- `docs/product/P9_AUTHN_AUTHZ_MVP_RAHMEN_MINISPEZ.md`
- `memory.md`
- der aktuelle Repo-Iststand in den lokalen/servernahen Betriebswegen, im Exportpfad und in den Guard-/Operator-Pfaden

Wesentliche Ableitung:
- Das Pflichtenheft beschreibt eine interne, nachvollziehbare Betriebsplattform mit operativen Artefakten.
- P3 begrenzt den Betriebs- und Deployment-Rahmen.
- P7 formuliert einen kleinen Freigaberahmen fuer den internen MVP-Betrieb.
- P9 ordnet die minimale AuthN-/AuthZ-Grundlage fuer read-only und mutierend ein.
- P10 bleibt bewusst unterhalb einer Automatisierungs- oder Incident-Plattform und beschreibt nur, wie manuelle Eingriffe und Fallbacks im bestehenden Rahmen fachlich behandelt werden.
- `memory.md` bleibt der Kurzanker fuer die konsolidierten Repo-Fakten.

## 3. Aktueller repo-gebundener Kontext

### 3.1 Bereits vorhanden

Im Repo sind bereits folgende Bausteine sichtbar:
- lokaler Stack-Start, Status und Stop
- servernaher Betriebsrahmen ueber die vorhandene Deployment-/Proxy-Dokumentation
- read-only Exportpfade fuer Angebot, Produktionsblatt und Einkaufsliste
- mutierende Kernpfade mit Rollen-/Guard-Konvention im `shared-core`
- Operator-Zuordnung ueber `x-actor-name`
- Audit-/Review-/Finalize-Nachweise in den geschuetzten Kernpfaden
- konservative Grenzen fuer Aufbewahrung, Archivierung und Loeschung

### 3.2 Fuer den MVP zulässig und verbindlich

Fuer den MVP ist verbindlich anzunehmen:
- manuelle Betriebsinterventionen erfolgen innerhalb des bestehenden lokalen oder servernahen Betriebsrahmens
- Fallbacks werden erst durch einen Operator oder einen dokumentierten Betriebsweg ausgefuehrt, nicht durch eine neue automatische Recovery-Schicht
- read-only Pruefungen und Exporte bleiben die erste sichere Kontrollstufe bei Stoerungen
- mutierende Eingriffe laufen nur ueber bereits geschuetzte Kernpfade und nur mit passender Rollen-/Header-Zuordnung
- wenn ein Lauf scheitert, wird nicht stillschweigend eine neue Produktlogik aktiviert

### 3.3 Was heute eher organisatorisch bzw. manuell behandelt wird

Heute bereits eher organisatorisch bzw. manuell behandelt:
- ob ein Lauf wiederholt werden soll
- ob vor dem Wiederholen Eingabedaten oder Operator-Zuordnung korrigiert werden muessen
- ob ein Export nur kontrolliert erneut ausgefuehrt werden darf
- ob ein inkonsistenter Zustand erst read-only gesichtet und dann gezielt manuell bereinigt wird
- welche Datenreste, Demo-Daten oder Zwischenzustaende bewusst stehen bleiben duerfen

## 4. Kleinste MVP-Festlegung

### 4.1 Zulässige manuelle Eingriffe im MVP

Im MVP sind folgende manuelle Eingriffe fachlich zulässig:
- Stack-Start, Stop und erneuter Start ueber die vorhandenen Betriebswege
- erneutes Ausfuehren eines fehlgeschlagenen Imports, Exports oder Service-Laufs nach Korrektur der Eingabe oder des Operators
- manuelle Pruefung der Route, des Exportpfads oder des betroffenen Kernpfads, bevor ein Lauf wiederholt wird
- manuelle Korrektur einer falschen oder fehlenden Operator-Zuordnung innerhalb des bestehenden `x-actor-name`-Rahmens
- manuelle Bereinigung inkonsistenter Datenzustände ueber die bereits geschuetzten Kernpfade und vorhandenen Betriebsartefakte

### 4.2 Erwartete Fallbacks bei Stoerung oder fehlerhaftem Lauf

Wenn ein Lauf stoert oder fehlschlaegt, ist im MVP folgendes erwartet:
1. zuerst read-only pruefen, ob der betroffene Zustand noch nachvollziehbar ist
2. dann den Fehler auf Operator-, Eingabe-, Export- oder Datenzustand eingrenzen
3. erst danach den Lauf manuell wiederholen oder den Zustand manuell korrigieren
4. wenn der Zustand nicht sicher ist, den betroffenen Pfad nicht automatisiert weiterlaufen lassen
5. wenn noetig, auf die bestehende Betriebsfreigabe- oder Guard-Basis zurueckfallen und keinen neuen Hilfspfad erfinden

### 4.3 Was bei typischen Problemklassen nur manuell/operativ behandelt wird

#### Import-/Export-Probleme
- fehlgeschlagene Importe oder Exporte werden im MVP nicht automatisch kompensiert
- der Operator prueft die Eingabe, den Zielpfad und den aktuellen Betriebszustand
- ein erneuter Lauf erfolgt nur bewusst und mit derselben vorhandenen Fachlogik

#### Rollen-/Header-Probleme
- fehlende oder falsche Operator-Zuordnung wird ueber die bestehende `x-actor-name`-Konvention operativ geklaert
- mutierende Aktionen werden nicht in einen neuen Identitaets- oder Login-Flow verschoben
- wenn die Rollenfrage unklar bleibt, ist read-only die sichere Fallback-Position

#### Dateninkonsistenzen
- Inkonsistenzen werden erst sichtbar gemacht und dann manuell bereinigt
- es gibt keine automatische Recovery-Engine, die einen neuen Sollzustand erzwingt
- operative Korrektur bleibt innerhalb der bereits vorhandenen Kernpfade und Artefakte

### 4.4 Was dokumentiert, aber bewusst nicht automatisiert wird

Dokumentiert, aber bewusst nicht automatisiert wird im MVP:
- Wiederanlauf nach Fehlversuch
- manuelle Einordnung von Daten- oder Operatorfehlern
- bewusste Entscheidung, ob ein Lauf erneut ausgefuehrt werden darf
- manuelle Abstimmung zwischen read-only Pruefung und mutierender Korrektur
- operatives Stehenlassen eines ungeklärten Zustands bis zur menschlichen Entscheidung

## 5. Klare Abgrenzung

Diese Mini-Spezifikation fuehrt ausdruecklich nicht ein:
- keine automatische Recovery-Engine
- keine neue Incident-/Ticket-Architektur
- keine neue Admin-Oberflaeche
- keine neuen Endpunkte
- keine neue Persistenzlogik
- keine neue Produktfamilie

P10 ordnet nur den bestehenden MVP-Betrieb bei Stoerung und manueller Eingriffserfordernis ein.

## 6. Offene Punkte

Bewusst offen bleibt:
- wer im spaeteren Betrieb konkret die manuelle Intervention ausloest
- wie weit ein Fallback technisch oder organisatorisch protokolliert werden soll
- ab wann ein wiederholter manueller Eingriff zu einem echten Produktproblem wird
- ob spaetere Betriebsstufen eine formale Eskalations- oder On-Call-Logik benoetigen
- welche Teile der heutigen manuellen Behandlung spaeter noch automatisiert werden sollen

Diese Punkte sind noch nicht durch einen echten Betriebs- oder Recovery-Ausbau geklaert und sollen deshalb hier nicht vorweggenommen werden.

## 7. Empfohlener kleinster naechster Schritt

Der naechste Schritt sollte weiterhin nur Klärung und Begrenzung sein, nicht Implementierung:
1. die hier genannten manuellen Eingriffe als internen Referenzrahmen festhalten
2. die Grenze zwischen read-only Sichtung und mutierender Korrektur klar benennen
3. weitere Recovery- oder Betriebsautomatisierung erst spaeter explizit beauftragen

## 8. Einordnung

Diese Mini-Spezifikation ist absichtlich konservativ.
Sie soll den aktuellen MVP-Betrieb bei Stoerungen und Fallbacks fachlich einordnen, ohne eine neue Betriebs- oder Incident-Plattform zu erfinden.

Alles darueber hinaus bleibt spaeteren, explizit beauftragten Schritten vorbehalten.
