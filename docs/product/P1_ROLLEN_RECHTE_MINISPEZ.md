# P1 Rollen, Rechte und Autorisierung – Mini-Spezifikation

Status: Entwurf v0.1 auf Basis des aktuellen Repo-Iststands

Stand: 2026-04-11

## 1. Zweck der Mini-Spezifikation

Diese Mini-Spezifikation praezisiert das Arbeitspaket P1 aus `docs/product/MVP_ARBEITSPAKETE.md` fuer den aktuellen Repo-Stand.

Ziel ist nicht eine vollstaendige Enterprise-RBAC-Architektur, sondern eine kleine, repo-verankerte und MVP-taugliche Klärung von Rollen, Rechten und Schutzbedarf.

## 2. Bezug auf Pflichtenheft und MVP-Arbeitspakete

Grundlage dieser Mini-Spezifikation sind:
- `docs/product/PFLICHTENHEFT.md`
- `docs/product/MVP_ARBEITSPAKETE.md`
- `memory.md`
- `README.md`
- ergänzend: `docs/architecture/MEMORY_ARCHITECTURE.md`

Relevante Ableitung:
- P1 ist im MVP-Arbeitspaketplan als hoechstpriorisiertes Arbeitspaket markiert.
- Das Pflichtenheft benennt Rollen, Audit, Review, Betrieb und Datenschutz als offene oder zu praezisierende Bereiche.
- Der aktuelle Repo-Stand zeigt bereits implizite Rollen, aber noch kein formal geschlossenes Rechtebild.

## 3. aktueller Repo-Iststand

### 3.1 Bereits vorhanden

Im Repo sind bereits folgende sachliche Anker vorhanden:
- dreifach getrennte Kernservices: `intake-service`, `offer-service`, `production-service`
- gemeinsame UI: `backoffice-ui`
- Audit-Feed ueber die Services hinweg
- Review-Pfade fuer Rezepte
- Demo-Seed-Endpunkte
- lokale Steuerung ueber `npm run local:start`, `npm run local:status`, `npm run local:stop`
- Operator-Header `x-actor-name` zur Zuordnung mutierender Aktionen
- Service-default-Namen fuer Akteure je Bereich

### 3.2 Relevante technische Hinweise aus dem Repo

Die vorhandene Umsetzung deutet auf folgende Schutz- und Zuständigkeitslinien hin:
- Intake sendet mutierende Aktionen mit Standardname `Intake-Mitarbeiter`.
- Offer sendet mutierende Aktionen mit Standardname `Angebots-Mitarbeiter`.
- Production sendet mutierende Aktionen mit Standardname `Produktions-Mitarbeiter`.
- Die Backoffice-API setzt `x-actor-name` automatisch, wenn kein Header vorhanden ist.
- Rezept-Reviews schreiben in den Audit-Log.
- Demo-Seed-Endpunkte sind als interne Betriebs-/Entwickleraktionen vorhanden.

### 3.3 Bereits real umgesetzter P1-Fortschritt

Seit den Commits `dab9e71` und `66297ac` ist P1 nicht mehr nur konzeptionell, sondern bereits teilweise im Code verankert:
- im `shared-core` existiert eine minimale zentrale Rollen-/Rechte-Konvention
- konkret geschuetzt sind jetzt die Production-Pfade
  - `GET /v1/production/audit/events`
  - `POST /v1/production/seed-demo`
- die angeschlossenen Caller verwenden fuer diese Betriebswege den Betriebs-/Audit-Operator
- eine kleine gezielte Testabsicherung ist vorhanden und gruen (`tests/production-audit-access.test.ts`)

## 4. bereits vorhandene implizite Rollen / Verantwortlichkeiten

Aus den Dokumenten und dem Code lassen sich derzeit minimal folgende implizite Rollen erkennen:

1. Intake-Bearbeiter
   - arbeitet im Intake-Kontext
   - normalisiert Eingänge
   - bearbeitet unvollstaendige Spezifikationen

2. Angebots-Bearbeiter
   - arbeitet im Angebots-Kontext
   - erzeugt und pflegt Angebotsentwuerfe
   - kann Rezept-Review im Angebotspfad ausloesen

3. Produktions-Bearbeiter / Kueche
   - arbeitet im Produktions-Kontext
   - plant Produktion
   - nutzt Rezeptsuche und Suchspur
   - kann Rezept-Review im Produktionspfad ausloesen

4. Interner Betriebsoperator
   - nutzt Audit- und Admin-nahe Pfade
   - seedet Demo-Daten
   - prueft Betriebs- und Statuspfade

## 5. schutzbeduerftige Kernaktionen / Bereiche

Diese Bereiche sind im aktuellen MVP besonders schutz- bzw. regelungsbeduerftig:

- mutierende Intake-Aktionen
- mutierende Angebotsaktionen
- mutierende Produktionsaktionen
- Rezept-Review mit Freigabe / Verifizierung / Ablehnung
- Demo-Seed-Endpunkte
- Audit-Feed / Audit-Ansicht
- Governance-Funktionen rund um Finalize und Statussichtbarkeit
- UI-Bereiche mit produktiver Operativitaet statt reinem Lesen

Begruendung: Diese Pfade schreiben Zustände, beeinflussen operative Entscheidungen oder veraendern sichtbare Freigabe- und Aenderungsspuren.

## 6. minimale empfohlene MVP-Rollen

Die kleinste sinnvolle MVP-Rollenmenge ist:

1. Intake-Operator
2. Angebots-Operator
3. Produktions-Operator
4. Betriebs-/Audit-Operator

### 6.1 Warum diese Aufteilung

- Sie spiegelt die bereits vorhandene Dreiteilung der Services und UI-Bereiche wider.
- Sie folgt den im Code vorhandenen Standard-Akteursnamen.
- Sie trennt produktive Facharbeit von Betriebs- und Audit-Aktionen.
- Sie bleibt klein genug fuer den aktuellen Konsolidierungsstand.

## 7. minimale empfohlene Rechtezuordnung

### 7.1 Intake-Operator

Darf:
- Intake-Pfade nutzen
- Eingaben normalisieren
- unvollstaendige Spezifikationen nachbearbeiten
- eigene Intake-Aktionen im Audit erscheinen lassen

Soll nicht:
- Betriebs-Seed-Endpunkte ausloesen
- fachfremde Produktionsaktionen als reguläre Rolle ausfuehren

### 7.2 Angebots-Operator

Darf:
- Angebotsentwuerfe erzeugen und pflegen
- Angebots-Review-Pfade nutzen
- relevante Audit-Eintraege erzeugen

Soll nicht:
- Produktions- oder Betriebsaktionen ohne eigene Rolle ausfuehren

### 7.3 Produktions-Operator

Darf:
- Produktionsplanung nutzen
- Rezeptsuche und Suchspur sehen
- produktive Produktionsaktionen ausfuehren
- Produktions-Review-Pfade nutzen

Soll nicht:
- Demo-Seed-Endpunkte als normale Fachaktion ausfuehren

### 7.4 Betriebs-/Audit-Operator

Darf:
- Status- und Audit-Kontexte einsehen
- Demo-Seed-Endpunkte und Betriebsaktionen nutzen
- Governance- und Nachvollziehbarkeitskontexte prüfen

Soll nicht:
- produktive Fachaktionen in den Fachrollen still ersetzen

## 8. was aktuell offen / ungeklärt ist

Offen ist derzeit insbesondere:
- ob es neben den vier Minimalrollen noch eine echte Admin-Rolle braucht
- ob Rollen nur fachlich benannt oder technisch hart durchgesetzt werden sollen
- welche weiteren Endpunkte im MVP noch per Guard geschuetzt werden sollen
- wie fein die Rechte pro Fachaktion im UI und in den Services wirklich getrennt werden
- welche Authentifizierungsform im MVP verbindlich gilt
- wie Aufbewahrung, Datenschutz und Loeschkonzept final aussehen

## 9. empfohlener kleinster naechster Umsetzungsschritt fuer P1

Der kleinste naechste Umsetzungsschritt fuer P1 ist:

1. die noch ungeschuetzten mutierenden Fach- und Betriebswege entlang der bereits vorhandenen zentralen Konvention ebenfalls hart anschliessen
2. `x-actor-name` auf diesen naechsten Pfaden gegen die Konvention weiter validieren bzw. praezisieren
3. die drei Fachrollen plus Betriebs-/Audit-Operator in den bestehenden UI-/Servicepfaden konsistent abbilden
4. die bereits angeschlossenen Production-Guards stabil halten und nur echte Restpfade nachziehen

### Warum genau dieser Schritt

- Er ist klein und direkt an die bereits angeschlossenen Production-Pfade anschliessbar.
- Er erfindet keine neue Plattform- oder Enterprise-RBAC-Logik.
- Er schliesst jetzt die naechste reale Luecke: nicht mehr die Grundkonvention, sondern die noch offenen Restpfade.

## 10. Einordnung

Diese Mini-Spezifikation ist bewusst schmal gehalten.
Sie definiert nur das minimale MVP-Rollenbild, das aus dem realen Repo-Iststand belastbar ableitbar ist.
Alles darueber hinaus bleibt offen und wird erst nach explizitem Auftrag oder nachweisbarer Aenderung des Repo-Standes konkretisiert.
