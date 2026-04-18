# P9 Formaler AuthN-/AuthZ-Rahmen im MVP – Mini-Spezifikation

Status: Mini-Spezifikation v0.1 auf Basis des aktuellen Repo-Iststands
Stand: 2026-04-16

## 1. Zweck und Abgrenzung

Diese Mini-Spezifikation begrenzt den formalen AuthN-/AuthZ-Rahmen fuer den MVP der `AlexanderSmyslowski/catering-agents-platform`.

Sie erfindet keine neue Login-/Session-Plattform, keine neue RBAC-Welt und keine neue Identity-Infrastruktur. Ziel ist ausschliesslich, den bereits realen MVP-Rahmen so zu ordnen, dass klar bleibt:
- was im MVP als ausreichend vorhandener AuthN-/AuthZ-Rahmen gilt
- was fuer den internen Betrieb verbindlich angenommen wird
- was read-only vs. mutierend abgesichert sein muss
- was bewusst noch nicht als echte Login-, Session-, Token- oder IdP-Integration umgesetzt wird

## 2. Bezug auf Pflichtenheft, MVP-Arbeitspakete, P1, P7, P8 und Memory

Grundlagen dieses Dokuments sind:
- `docs/product/PFLICHTENHEFT.md`
- `docs/product/MVP_ARBEITSPAKETE.md`
- `docs/product/P1_ROLLEN_RECHTE_MINISPEZ.md`
- `docs/product/P7_BETRIEBSFREIGABE_MVP_FREIGABEKRITERIEN_MINISPEZ.md`
- `docs/product/P8_UI_ROLLENVERANTWORTUNG_UND_OPERATOR_ZUORDNUNG_MINISPEZ.md`
- `memory.md`
- der aktuelle Repo-Iststand in den Guards, in der Operator-Zuordnung und im Betriebs-/Proxy-Rahmen

Wesentliche Ableitung:
- Das Pflichtenheft beschreibt eine interne Betriebsplattform mit auditierbaren und operativen Pfaden.
- Die MVP-Arbeitspakete priorisieren zuerst Rollen/Rechte, Verifikation, Betrieb, Audit und anschliessend die saubere Abgrenzung.
- P1 hat die minimale Rollen-/Rechte-Grundlage bereits real verankert.
- P7 formuliert die Betriebsfreigabe fuer den internen MVP-Betrieb.
- P8 ordnet die UI fachlich auf die bestehenden Minimalrollen und Operatoren zu.
- P9 faasst diese Punkte zu einem schmalen formalen AuthN-/AuthZ-Rahmen zusammen, ohne daraus eine neue Login-Welt zu machen.
- `memory.md` bleibt der Kurzanker fuer den konsolidierten Repo-Stand.

## 3. Aktueller repo-gebundener Ist-Stand

### 3.1 Rollen-/Guard-Grundlage

Bereits vorhanden im Repo:
- minimale zentrale Rollen-/Rechte-Konvention im `shared-core`
- geschuetzte Kernpfade fuer Intake, Angebot, Produktion und Betriebs-/Audit-Kontexte
- testseitig belegte Guard-Verifikation
- eindeutige Trennung zwischen mutierenden und read-only Pfaden im MVP-Kern

### 3.2 Operator-Zuordnung ueber `x-actor-name`

Bereits vorhanden im Repo:
- mutierende Aktionen werden ueber `x-actor-name` einem Operator-Kontext zugeordnet
- die Backoffice-API setzt einen Default-Actor, wenn kein Header gesetzt ist
- die Services pruefen den Actor gegen die minimalen MVP-Rollen
- der Audit-/Betriebs-Operator ist als eigene Zuordnungsbasis vorhanden

### 3.3 Reverse-Proxy-/HTTPS-Rahmen

Bereits vorhanden im Repo:
- Caddy als Reverse-Proxy mit HTTPS im infrastrukturellen Betriebsbild
- interne Web-App und APIs werden im Betriebsmodell hinter dem Proxy gedacht
- die Dokumentation trennt lokalen Stack und servernahen Zielbetrieb
- Laufzeitdaten werden dateibasiert oder per PostgreSQL gefuehrt, ohne dass daraus eine neue Identity- oder Login-Plattform folgt

### 3.4 Was heute eher organisatorisch bzw. implizit geregelt ist

Heute bereits eher organisatorisch bzw. implizit geregelt:
- welcher Operatorname im Backoffice als Standard verwendet wird
- welche Rolle in welchem Bereich normalerweise arbeitet
- welche Pfade read-only betrachtet werden
- welche mutierenden Pfade nur in geschuetzten Kernkontexten sinnvoll sind
- dass die interne Plattform nicht als offenes Endkunden- oder Self-Service-System gedacht ist

## 4. Kleinste MVP-Festlegung

### 4.1 Was im MVP als ausreichend vorhandener AuthN-/AuthZ-Rahmen gilt

Fuer den MVP ist der AuthN-/AuthZ-Rahmen ausreichend vorhanden, wenn:
1. die minimalen Rollen im `shared-core` als gemeinsame Referenz dienen
2. mutierende Kernpfade ueber Actor-Zuordnung und Guards abgesichert sind
3. read-only Pfade nicht als Schreibwege behandelt werden
4. der interne Betrieb ueber den vorhandenen Proxy- und UI-Rahmen stattfindet
5. keine neue Login-Schicht benoetigt wird, um den bestehenden MVP-Kern sicher zu nutzen

### 4.2 Was fuer internen Betrieb verbindlich angenommen wird

Fuer den internen MVP-Betrieb verbindlich angenommen wird:
- Actor-Zuordnung ueber `x-actor-name` oder die vorhandenen Defaults bleibt die operative Identitaetsbasis fuer mutierende Requests
- interne Operatoren sind die relevante Nutzungsform, nicht externe Endnutzerkonten
- geschuetzte Kernpfade bleiben geschuetzt und muessen nicht durch eine neue Login-Welt ersetzt werden
- read-only Detail-, Export- und Audit-Kontexte muessen nicht in eine neue Session-/Token-Architektur verschoben werden, solange sie nicht mutieren

### 4.3 Read-only vs. mutierend

Verbindlich fuer den MVP:
- read-only muss fuer Detail-, Export- und Audit-Kontexte gelten, soweit kein expliziter Schreibvorgang vorgesehen ist
- mutierend muss fuer Intake-, Angebots-, Produktions- und Betriebsaktionen mit vorhandener Rolle und Actor-Zuordnung abgesichert sein
- ein read-only Kontext darf keine verdeckte Schreibwirkung ausloesen
- ein mutierender Kontext darf nicht als bloesse Anzeige behandelt werden

### 4.4 Was bewusst noch nicht umgesetzt ist

Bewusst nicht umgesetzt und fuer den MVP nicht erforderlich:
- echte Login-Integration
- Session-Management als eigene Produktwelt
- Token- oder Refresh-Token-Mechanik
- IdP-Integration
- OAuth-/OIDC-/SSO-Implementierung
- neue Identity- oder Secret-Plattform

## 5. Offene Punkte

Bewusst offen bleibt:
- ob der heutige interne Actor-Rahmen spaeter durch echte Benutzeridentitaeten ersetzt oder ergaenzt wird
- wie fein AuthN und AuthZ spaeter tatsaechlich getrennt werden sollen
- ob read-only und mutierend in spaeteren Phasen noch weiter differenziert werden muessen
- wie ein moeglicher externer Identity-Rahmen spaeter an den bestehenden MVP-Kern angebunden werden koennte
- welche Teile der heutigen Konvention nur organisatorisch und welche spaeter technisch hart abzusichern sind

Diese Punkte sind noch nicht durch einen echten AuthN-/AuthZ-Ausbau geklaert und sollen deshalb hier nicht vorweggenommen werden.

## 6. Klare Abgrenzung

Diese Mini-Spezifikation fuehrt ausdruecklich nicht ein:
- keine neue externe Nutzerrolle
- keine feingranulare Feldberechtigung
- keine SSO-/OIDC-/OAuth-Implementierung
- keine neue Secret-/Identity-Plattform
- keine neuen Endpunkte
- keine neue Persistenzlogik
- keine neue Produktfamilie

Die Mini-Spezifikation ordnet nur den bestehenden MVP-Rahmen fachlich ein.

## 7. Empfohlener kleinster naechster Schritt

Der naechste Schritt sollte weiterhin nur Klärung und Begrenzung sein, nicht Implementierung:
1. die heutigen Minimalrollen und Actor-Namen als interne Referenz festhalten
2. den Unterschied zwischen read-only und mutierend im MVP explizit sichtbar lassen
3. weitere AuthN-/AuthZ-Feinheiten erst bei einem echten Ausbau beauftragen

Damit bleibt P9 ein schmaler Beta-Gate-Schritt ohne neue Login- oder RBAC-Welt.

## 8. Einordnung

Diese Mini-Spezifikation ist absichtlich konservativ.
Sie soll den aktuellen MVP-Rahmen im AuthN-/AuthZ-Bereich sauber begrenzen und fachlich einordnen, ohne eine neue Plattform zu erfinden.

Alles darueber hinaus bleibt spaeteren, explizit beauftragten Schritten vorbehalten.
