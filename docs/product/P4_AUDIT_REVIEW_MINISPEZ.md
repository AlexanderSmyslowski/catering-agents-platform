# P4 Audit-, Review- und Nachvollziehbarkeit – Mini-Spezifikation

Status: Mini-Spezifikation v0.1 auf Basis des aktuellen Repo-Iststands
Stand: 2026-04-16

## 1. Zweck der Mini-Spezifikation

Diese Mini-Spezifikation schaerft den Audit-, Review- und Nachvollziehbarkeitsrahmen der Catering Agents Platform fuer den MVP.

Sie erfindet keine neue Compliance- oder Governance-Architektur, sondern ordnet die bereits real vorhandenen Nachweis- und Review-Pfade so, dass klar bleibt:
- was bereits vorhanden ist
- was fuer den MVP belastbar angenommen werden kann
- wo die wichtigsten Nachvollziehbarkeitsluecken liegen
- welcher kleinste naechste Schritt den Bereich praktisch weiter haertet

## 2. Bezug auf Pflichtenheft, MVP-Arbeitspakete und P5

Grundlagen dieses Dokuments sind:
- `docs/product/PFLICHTENHEFT.md`
- `docs/product/MVP_ARBEITSPAKETE.md`
- `docs/product/P5_MVP_ABGRENZUNG_MINISPEZ.md`
- `memory.md`
- `README.md`
- der aktuelle Repo-Iststand in den Audit-/Review-Pfaden und im Backoffice-UI

Wesentliche Ableitungen:
- Das Pflichtenheft verlangt eine nachvollziehbare interne Betriebsplattform mit Auditierbarkeit und klarer Trennung von finalisiert und freigegeben.
- Die MVP-Arbeitspakete setzen P4 als Operationalisierung von Audit-, Review- und Nachvollziehbarkeit nach P1 bis P3.
- P5 begrenzt den MVP-Kern; P4 soll diese Grenzen ueber nachvollziehbare Aktionen absichern, nicht erweitern.

## 3. Aktueller Repo-Iststand zu Audit / Review / Nachvollziehbarkeit

### 3.1 Bereits real vorhanden

Im Repo sind bereits folgende Bausteine sichtbar:
- zentraler Audit-Feed fuer Produktionskontext
- `GET /v1/production/audit/events`
- `POST /v1/production/seed-demo`
- `POST /v1/intake/spec-governance/finalize`
- `PATCH /v1/offers/recipes/:recipeId/review`
- `PATCH /v1/production/recipes/:recipeId/review`
- Operator-Zuordnung ueber den Header `x-actor-name`
- lokale Operator-Speicherung in der Backoffice-UI
- Audit-Trail / Änderungen-Sicht im UI
- read-first Governance-Kontext mit klarer Unterscheidung zwischen finalisiert und freigegeben
- bestehende Access-Control-Verifikation fuer die zentralen Kernpfade

### 3.2 Was daraus belastbar abgeleitet werden kann

Aus dem Repo-Iststand kann fuer den MVP-Betrieb aktuell klein und konservativ abgeleitet werden:
- mutierende Aktionen sind auditierbar und lassen sich einem Operator zuordnen
- Review- und Finalize-Aktionen sind nicht nur fachlich vorhanden, sondern auch als geschuetzte Kernpfade verankert
- der Audit-Feed ist bereits als operative Nachvollziehbarkeitsquelle nutzbar
- die UI transportiert Operator-Kontext in mutierende Pfade
- Nachvollziehbarkeit ist nicht nur ein Dokumentationsbegriff, sondern bereits in Pfaden und UI-Kontext angelegt

### 3.3 Kleine direkte Prüfung im aktuellen Repo-Stand

Mit dem lokalen Stack wurde bereits ein kleiner Audit-Feed-Check ausgefuehrt:
- `GET /v1/production/audit/events?limit=5`
- Header: `x-actor-name: Betriebs-/Audit-Operator`
- Ergebnis: 3 Eintraege im Audit-Feed
- der erste sichtbare Eintrag war `production.seed_demo` mit Actor `Betriebs-/Audit-Operator`

Damit ist der kleinste operative Audit-Nachweis direkt im bestehenden lokalen Betriebsrahmen bestaetigt.

### 3.4 Kleine codierte Traceability-Absicherung

Zusätzlich ist der Nachvollziehbarkeitsweg nun als kleiner Regressionstest abgesichert:
- `tests/p4-audit-traceability.test.ts`
- Produktions-`seed-demo` erzeugt einen sichtbaren `production.seed_demo`-Audit-Eintrag
- ein Produktions-Rezeptreview erzeugt einen sichtbaren `recipe.reviewed`-Eintrag im gleichen Audit-Kontext
- ein Intake-Finalize erzeugt einen sichtbaren `intake.spec_governance_finalized`-Eintrag im gleichen Nachvollziehbarkeitsrahmen
- beide Nachweise laufen ueber die vorhandene lokale App-/Service-Konfiguration ohne neue Infrastruktur
- zusaetzlich ist ein kleiner Angebots-Rezeptreview-Nachweis als eigener Regressionstest codiert

Damit ist der Audit-/Review-Korridor nicht nur manuell, sondern auch als kleiner reproduzierbarer Testlauf bestaetigt. P4 ist in dieser ersten Stufe real begonnen, sichtbar verankert und bewusst schmal gehalten.

## 4. Bereits vorhandene Bausteine

Bereits vorhandene Bausteine, die P4 nur operationalisieren, nicht neu erfinden soll:
- zentraler Produktions-Audit-Feed
- geschuetzte Review-Endpunkte fuer Angebot und Produktion
- Finalize-Pfad fuer Spec-Governance
- Operator-Header und lokale Operator-Uebernahme in der UI
- sichtbare Änderungs- und Audit-Kontexte in der Backoffice-UI
- bereits gruene Access-Control-Verifikation fuer P1-Pfade

## 5. Minimale MVP-Ziele fuer P4

Fuer den MVP koennen fuer P4 folgende Minimalziele festgehalten werden:
1. Jede mutierende Kernaktion soll im vorhandenen System einem Operator zuordenbar bleiben.
2. Audit-Feed und Review-Pfade sollen als operative Nachweise nutzbar sein.
3. Der Unterschied zwischen finalisiert und freigegeben soll in den Nachvollziehbarkeitswegen klar bleiben.
4. Geschuetzte Kernpfade sollen nicht still verwischt oder umgangen werden.
5. P4 soll keine neue Compliance-Welt aufmachen, sondern die vorhandene Nachvollziehbarkeit praktisch greifbar halten.

## 6. Wichtigste offene Luecken / Risiken

Die aktuell wichtigsten Luecken fuer einen stabilen MVP-Nachweis sind:
- keine vollstaendige formale Audit-Abdeckung ueber alle denkbaren Fachaktionen
- die zentrale Nachvollziehbarkeit ist operativ vorhanden, aber nicht fuer alle Randfaelle gleich dicht dokumentiert
- Review- und Finalize-Pfade sind geschuetzt, aber ihre fachliche Lesbarkeit im Alltag kann noch geschaerft werden
- die UI zeigt bereits Nachvollziehbarkeit, aber der Nachweis ist noch bewusst schmal gehalten
- die grenzscharfe Trennung zwischen operativer Nachvollziehbarkeit und spaeterer Compliance-Produktisierung muss bewahrt bleiben

## 7. Was in P4 der ersten Stufe explizit drin ist

P4 Stufe 1 umfasst nur:
- Beschreibung der vorhandenen Audit- und Review-Pfade
- Benennung der Operator-Zuordnung ueber `x-actor-name`
- Einordnung des Audit-Feeds als operative Nachvollziehbarkeitsquelle
- Klarstellung der geschuetzten Kernpfade
- minimale Pruefung eines realen Audit-Feeds im lokalen Stack
- Abgrenzung gegen neue Compliance- oder Governance-Architektur

## 8. Was bewusst noch nicht drin ist

Bewusst nicht Teil von P4 in dieser Stufe:
- neue Compliance-Architektur
- neue Audit-Datenbank
- neue Review-Produktlinie
- neue API-Endpunkte
- neue Persistenzmigration
- grosse Reporting- oder Archivierungsplattform
- neue Produktflaechen fuer Nachvollziehbarkeit ausserhalb des bestehenden Kerns
- formale regulatorische Vollabdeckung

## 9. Empfohlener kleinster naechster P4-Schritt

Der kleinste sinnvolle naechste Schritt ist hier bewusst kein weiterer Ausbau der Traceability-Strange selbst.
Die vorhandenen Nachweise sind inzwischen klein, reproduzierbar und testseitig belegt; P4 kann damit als tragfaehige Basis stehen bleiben.

Falls spaeter noch ein weiterer P4-Nachweis belegt werden muss, sollte er nur dann ergänzt werden, wenn ein konkreter Repo-Anker oder ein echter Regressionstext fehlt.
Bis dahin liegt der naechste sinnvolle kleine Block ausserhalb von P4.

## 10. Einordnung

Dieses Dokument ist absichtlich schmal.
Es soll den MVP-Nachvollziehbarkeitsrahmen nur so weit schaerfen, dass er als belastbare Arbeitsgrundlage dient.

Wenn sich der Repo-Iststand spaeter aendert, muss diese Mini-Spezifikation gezielt und repo-gebunden nachgezogen werden.
