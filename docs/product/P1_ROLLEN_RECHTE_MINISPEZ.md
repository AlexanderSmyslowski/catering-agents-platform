# P1 Rollen, Rechte und Autorisierung – Mini-Spezifikation

Status: Konsolidierte Mini-Spezifikation v0.2 auf Basis des aktuellen Repo-Iststands

Stand: 2026-04-16

## 1. Zweck der Mini-Spezifikation

Diese Mini-Spezifikation praezisiert das Arbeitspaket P1 aus `docs/product/MVP_ARBEITSPAKETE.md` fuer den aktuellen Repo-Stand.

Ziel ist nicht eine vollstaendige Enterprise-RBAC-Architektur, sondern eine kleine, repo-verankerte und MVP-taugliche Klärung von Rollen, Rechten und Schutzbedarf. P1 ist dabei in einer ersten MVP-Stufe bereits real verankert und wird hier bewusst konsolidiert, nicht weiter aufgebläht.

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
- Der aktuelle Repo-Stand zeigt bereits implizite Rollen und die erste formal verankerte Rechtebasis; der restliche Schutzumfang wird als Folgearbeit konsolidiert.

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

Seit den Commits `dab9e71` und `66297ac` ist P1 in einer ersten MVP-Stufe real verankert und nicht mehr nur konzeptionell:
- im `shared-core` existiert eine minimale zentrale Rollen-/Rechte-Konvention
- konkret geschützt sind:
  - `GET /v1/production/audit/events`
  - `POST /v1/production/seed-demo`
  - `POST /v1/intake/spec-governance/finalize`
  - `PATCH /v1/offers/recipes/:recipeId/review`
  - `PATCH /v1/production/recipes/:recipeId/review`
- die angeschlossenen Caller verwenden für diese Betriebswege den Betriebs-/Audit-Operator
- die kleine Access-Control-Verifikation ist grün:
  - `tests/intake-finalize-access.test.ts`
  - `tests/production-audit-access.test.ts`
  - `tests/recipe-review-access.test.ts`
  - insgesamt 6 Tests grün

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

Hinweis:
- Die Zuordnung der Default-Akteursnamen ist im Code normalisiert (trim + lowercase) und damit kanonisch, nicht fall- oder whitespace-sensitiv.

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

Der naechste Schritt ist fuer P1 bewusst keine weitere Aufblaehung, sondern die Konsolidierung des bereits real verankerten Minimalbilds.

1. die bereits geschuetzten Kernpfade als Referenzstand stabil halten
2. den jetzt dokumentierten Rollen-/Rechteanker nicht mit neuer RBAC-Komplexitaet ueberfrachten
3. verbleibende Restpfade nur dann als eigener Folgeauftrag behandeln, wenn spaeter ein konkreter MVP-Bedarf belegt ist

### Warum genau dieser Schritt

- P1 ist bereits in einer ersten MVP-Stufe real verankert.
- Der Verifikationskorridor ist gruen.
- Der naechste sinnvolle Fokus ist deshalb Begrenzung und Klarheit, nicht weiterer Aufbau.

## 10. Einordnung

Diese Mini-Spezifikation ist bewusst schmal gehalten.
Sie definiert nur das minimale MVP-Rollenbild, das aus dem realen Repo-Iststand belastbar ableitbar ist.
Alles darueber hinaus bleibt offen und wird erst nach explizitem Auftrag oder nachweisbarer Aenderung des Repo-Standes konkretisiert.
