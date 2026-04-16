# P5 MVP-Abgrenzung pro Kernbereich – Mini-Spezifikation

Status: Mini-Spezifikation v0.1 auf Basis des aktuellen Repo-Iststands
Stand: 2026-04-16

## 1. Zweck des Dokuments

Diese Mini-Spezifikation schaerft die MVP-Grenzen pro Kernbereich der Catering Agents Platform.

Sie erfindet keine neue Featureliste und keine neue Roadmap, sondern ordnet den bereits realen Repo-Iststand so, dass klar bleibt:
- was heute bereits zum MVP gehoert
- was bewusst nicht Teil des MVP ist
- wo die Grenze zwischen internem Nutzwert und spaeterer Produktisierung liegt
- welche kleinen Restentscheidungen noch offen sind

## 2. Bezug auf Pflichtenheft und MVP-Arbeitspakete

Grundlagen dieses Dokuments sind:
- `docs/product/PFLICHTENHEFT.md`
- `docs/product/MVP_ARBEITSPAKETE.md`
- `memory.md`
- `README.md`
- der aktuelle Repo-Iststand, insbesondere `shared-core/src/access-control.js` und die dazugehoerigen Access-Control-Tests

Wesentliche Ableitungen:
- Das Pflichtenheft beschreibt einen internen, stabilen MVP-Kern und grenzt Multi-Tenancy, Plattformisierung und weitere Produktlinien explizit ab.
- Die MVP-Arbeitspakete setzen P1 als bereits real verankerte erste Stufe und P5 als naechsten Spezifikationsanker zur Scharfzeichnung der Grenzen.
- Der reale Repo-Stand bestaetigt, dass zentrale Kernpfade bereits geschuetzt und gezielt verifiziert sind.

## 3. Aktuelle Kernbereiche des Produkts

Die aktuell belastbar sichtbaren Kernbereiche sind:
- Intake
- Angebot
- Produktion
- Rezeptbibliothek / Review
- Exporte
- Backoffice-UI
- Shared Core / Access-Control / Governance
- Betrieb / lokale Reproduzierbarkeit

Diese Aufteilung folgt dem aktuellen Monorepo- und Produktaufbau und bleibt bewusst enger als eine allgemeine Plattformdefinition.

## 4. Abgrenzung pro Kernbereich

### 4.1 Intake

Bereits Teil des MVP:
- Intake-Service als operativer Eingang fuer Daten und Normalisierung
- ueberfuehren von Eingaben in strukturierte operative Daten
- Nachbearbeitung unvollstaendiger Spezifikationen im Backoffice
- Governance-Finalize-Pfad als bewusst geschuetzter Betriebsweg

Bewusst nicht Teil des MVP:
- breite neue Input- oder Connector-Landschaft
- neue Produktoberflaechen fuer externe Einlieferung
- generische Workflow-Automation ueber den aktuellen Intake-Kern hinaus
- neue Persistenzwelt oder neue API als Folge von Intake-Erweiterung

### 4.2 Angebot

Bereits Teil des MVP:
- Offer-Service als Angebots-CoPilot
- Angebotsentwuerfe und Angebotsvarianten aus strukturierten Grunddaten
- interne operative Angebotsableitung
- Rezept-Review als geschuetzter Fachpfad

Bewusst nicht Teil des MVP:
- umfassende Angebotsplattform mit externer Vermarktung
- Multi-Tenant-Angebotslogik
- neue, eigenstaendige Angebots-Workflows ohne direkten Bezug zum bestehenden Kern
- Grossausbau der Angebotslogik ueber die bestehende interne Nutzung hinaus

### 4.3 Produktion

Bereits Teil des MVP:
- Production-Service als Produktions-/Kuechen-CoPilot
- Produktionsplanung aus den vorhandenen Grunddaten
- Rezeptsuche und Suchspur
- Produktions-Review als geschuetzter Fachpfad
- Betriebs-/Audit-Pfad fuer Produktionskontext

Bewusst nicht Teil des MVP:
- ausgeweitete Einsatzplanung oder Workforce-Planung
- generische Produktionsplattform fuer weitere Domänen
- neue Produktflaechen fuer externe Produktionssteuerung
- grossflaechige Optimierungs- oder Scheduling-Funktionalitaet ohne expliziten Auftrag

### 4.4 Rezeptbibliothek / Review

Bereits Teil des MVP:
- gemeinsame Rezeptbibliothek fuer die bestehenden Fachpfade
- Review mit Freigabe, Verifizierung oder Ablehnung
- Upload aus den bestehenden Offer- und Production-Pfaden
- operative Verwendbarkeit nur fuer validierte bzw. freigegebene Inhalte

Bewusst nicht Teil des MVP:
- allgemeines Content-Management-System
- oeffentliche Rezeptplattform
- neue Review-States oder Moderations-Workflows ohne belegten Bedarf
- separate Produktlinie fuer Rezeptverwaltung als eigenes Ziel

### 4.5 Exporte

Bereits Teil des MVP:
- HTML- und CSV-Exporte fuer operative Artefakte
- Angebots-HTML
- Produktionsblatt-HTML
- Einkaufslisten-CSV

Bewusst nicht Teil des MVP:
- breite Reporting- oder BI-Suite
- generische Exportplattform fuer beliebige Formate
- externe Distributions- oder Publishing-Funktionen
- Produktisierung der Exporte als eigener Kernbereich

### 4.6 Backoffice-UI

Bereits Teil des MVP:
- interne Web-App als operative Schaltzentrale
- Einstieg fuer Angebot und Produktion
- sichtbarer Audit-Trail der letzten Operator-Aktionen
- bestehende read-first Governance-Sicht
- lokale Speicherung des Operator-Namens und Weitergabe bei mutierenden Aktionen

Bewusst nicht Teil des MVP:
- oeffentliche Endkunden-UI
- breite UI-Ausweitung ausserhalb des operativen Kerns
- neue Screen-Landschaft ohne konkreten Produktnutzen
- Plattform- oder White-Label-Frontend

### 4.7 Shared Core / Access-Control / Governance

Bereits Teil des MVP:
- kanonische Schemata, Regeln und Taxonomien
- minimale zentrale Rollen-/Rechte-Konvention im `shared-core`
- geschuetzte Kernpfade:
  - `GET /v1/production/audit/events`
  - `POST /v1/production/seed-demo`
  - `POST /v1/intake/spec-governance/finalize`
  - `PATCH /v1/offers/recipes/:recipeId/review`
  - `PATCH /v1/production/recipes/:recipeId/review`
- kleine gezielte Access-Control-Verifikation mit gruenem Verlauf
- read-first Governance bis einschliesslich des konsolidierten Stands 6c

Bewusst nicht Teil des MVP:
- Hard-Approve
- Snapshots / `lastHardApproved`
- Point-of-no-return-Ausbau
- ChangeItem-Persistenz
- ChangeItem-Anzeige
- neue Governance-Fachbloecke
- neue Persistenzwelt oder Prisma als neue Kernbasis

### 4.8 Betrieb / lokale Reproduzierbarkeit

Bereits Teil des MVP:
- lokaler Stack-Start / -Status / -Stop
- dokumentierter Hetzner- und Reverse-Proxy-Rahmen
- HTTPS-Terminierung im Betriebsbild
- dateibasierte oder PostgreSQL-basierte Laufzeitdaten je Konfiguration

Bewusst nicht Teil des MVP:
- neue Infrastrukturproduktisierung
- Multi-Region- oder Plattformbetrieb als eigener Ausbau
- ungebundene Deploy-Roadmap
- Betriebsmodell als separater Produktkern

### 4.9 Praktische Priorisierung

Fuer die praktische Pflege und weitere Verifikation gilt im aktuellen Repo-Stand folgende Reihenfolge:
1. Shared Core / Access-Control / Governance
2. Betrieb / lokale Reproduzierbarkeit
3. Intake, Angebot, Produktion, Exporte und Backoffice-UI

Diese Reihenfolge ist keine neue Roadmap, sondern nur die Priorisierung der bereits realen Kernbereiche nach Stabilitaet und Nutzwert.

Der aktuelle MVP ist auf internen Nutzwert optimiert:
- deterministisch
- operator-orientiert
- auditierbar
- reproduzierbar
- klein genug fuer schnelle Stabilisierung

Spaetere Produktisierung wuerde erst dort beginnen, wo aus internem Betrieb eine breitere Produktform werden soll, zum Beispiel:
- andere Mandanten oder Kundenkontexte
- externe Self-Service-Funktionen
- deutlich feinere AuthN/AuthZ-Mechanik
- separate Provisionierung oder Plattformsteuerung
- neue öffentliche Produktoberflaechen

Diese Schwelle wird im aktuellen Stand bewusst nicht ueberschritten.

## 6. Offene Restentscheidungen

Offen bleiben aktuell nur eng begrenzte Fragen:
- ob ueber die bereits geschuetzten P1-Kernpfade hinaus noch weitere Guards als echter MVP-Bedarf belegt werden
- wie fein die fachlichen Rollen spaeter nur als Benennung oder doch als echte AuthN/AuthZ umgesetzt werden sollen
- wie stark der Betrieb ausserhalb des lokalen und dokumentierten Hetzner-Rahmens weiter gehärtet werden muss
- ob und wann weitere Browser-/Smoke-Absicherung als naechster Nachweis fuer den Kern hinzukommt

## 7. Empfohlener naechster kleiner Folgeschritt nach P5

Der naechste kleine Schritt nach dieser Abgrenzung ist keine neue Produktflaeche, sondern die Pflege der bereits realen Mindestkorridore in ihrer Prioritaet. Wenn eine naechste fachliche Vertiefung benoetigt wird, liegt sie zuerst bei Shared Core / Access-Control / Governance und beim Betrieb, nicht bei neuen UI- oder API-Flaechen.

## 8. Einordnung

Dieses Dokument ist absichtlich schmal.
Es dient als Grenzanker fuer Folgearbeit und soll verhindern, dass aus dem bestehenden internen MVP stillschweigend neue Produktflaechen werden.

Wenn sich der Repo-Iststand spaeter aendert, muss diese Mini-Spezifikation gezielt und repo-gebunden nachgezogen werden.