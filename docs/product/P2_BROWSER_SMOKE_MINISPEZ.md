# P2 Browser-/Smoke-Absicherung der Kernpfade – Mini-Spezifikation

Status: Mini-Spezifikation v0.1 auf Basis des aktuellen Repo-Iststands
Stand: 2026-04-16

## 1. Zweck der Mini-Spezifikation

Diese Mini-Spezifikation beschreibt den kleinsten sinnvollen Browser-/Smoke-Korridor fuer die Catering Agents Platform.

Sie erfindet keine neue Testarchitektur, sondern grenzt nur ein, welche vorhandenen Kernpfade fuer einen ersten, repo-gebundenen Smoke-Check sinnvoll sind und was dabei bewusst noch nicht Teil des Vorhabens ist.

## 2. Bezug auf Pflichtenheft, MVP-Arbeitspakete und P5

Grundlagen dieses Dokuments sind:
- `docs/product/PFLICHTENHEFT.md`
- `docs/product/MVP_ARBEITSPAKETE.md`
- `docs/product/P5_MVP_ABGRENZUNG_MINISPEZ.md`
- `memory.md`
- `README.md`
- der aktuelle Repo-Iststand in Backoffice-UI und lokalen Service-Skripten

Wesentliche Ableitungen:
- Das Pflichtenheft fordert eine interne, nachvollziehbare Betriebsplattform mit Backoffice-UI.
- Die MVP-Arbeitspakete setzen P2 als schmale Browser-/Smoke-Absicherung nach der P1-Konsolidierung.
- P5 schärft die MVP-Grenzen pro Kernbereich; P2 soll diese Grenzen nun praktisch mit einem kleinen Erreichbarkeitskorridor absichern.

## 3. Aktueller Repo-Iststand fuer Browser-/Smoke-Absicherung

### 3.1 Bereits vorhanden

Im Repo existieren bereits folgende nutzbare Bausteine:
- Backoffice-UI mit echten Routen fuer `/`, `/angebot` und `/produktion`
- lokale UI auf Port `3200`
- lokale Services mit Health-Endpunkten auf den Ports `3101` bis `3104`
- lokaler Start ueber `npm run local:start`
- Statuspruefung ueber `npm run local:status`
- Stop ueber `npm run local:stop`
- bestehender Deployment-Smoke-Check unter `platform-infra/scripts/smoke-check.sh`
- reproduzierbar gepruefte read-only Exportpfade fuer Produktionsplan, Angebots-HTML und Einkaufslisten-CSV
- gemeinsamer UI- und Service-Rahmen mit bereits vorhandenen Health- und Audit-Pfaden

Diese erste Smoke-Stufe wurde bereits real ausgefuehrt: die drei UI-Routen, die vier Health-Endpunkte und die drei read-only Exportpfade lieferten jeweils die erwarteten Ergebnisse, ohne dass dafuer eine grosse Browser-/E2E-Infrastruktur aufgebaut werden musste.

### 3.2 Nicht vorhanden bzw. nicht als eigene Browser-E2E-Infrastruktur ausgebaut

Im aktuellen Repo-Stand ist keine grosse Browser-Testarchitektur als eigener Stack-Anker sichtbar, insbesondere:
- kein dediziertes Playwright-Setup
- kein dediziertes Cypress-Setup
- keine breite Browser-Matrix als dokumentierter MVP-Standard

Dafuer existieren bereits:
- Vitest-basierte Tests fuer fachliche Pfade
- jsdom- und Vite-Umfeld fuer die UI
- kleine bestehende Shell-basierte Smoke-Skripte fuer Infrastruktur-Checks

### 3.3 Zusätzlich klein inhaltlich geprüft

Mit dem vorhandenen Browser-Tool wurde ausserdem einmalig die gerenderte UI betrachtet. Dabei zeigten die drei Kernrouten die erwartbaren Kernmarker im DOM:
- Startseite: `Catering-Agenten`, `Angebotsagent`, `Produktionsagent`, `Gemeinsamer Regelkern`
- `/angebot`: `Angebotsagent`, `Angebots-URL: Kundenanfrage, Varianten und operative Übergabe.`
- `/produktion`: `Produktionsagent`, `Produktions-URL: unabhängige Küchenvorbereitung, Rezepte und Einkaufslisten.`

Damit ist die kleinste inhaltliche Smoke-Erweiterung ohne neue Testarchitektur bereits zusätzlich bestätigt.

### 3.4 Zusätzlicher repo-verankerter UI-Route-Smoke-Test

Ergänzend existiert ein minimaler, repo-verankerter UI-Route-Smoke-Test unter `tests/backoffice-route-smoke.test.ts`.
Er prueft die drei Kernrouten `/`, `/angebot` und `/produktion` im jsdom/Vitest-Kontext.

Die Assertions fuer `/angebot` und `/produktion` wurden bewusst auf route-eindeutige Marker geschaerft, damit ein Fallback auf `/` nicht faelschlich gruen bleibt.

### 3.5 Zusätzlich operativ verifiziert

Als kleinster echter Nutzpfad wurde auf der Produktionsseite ein vorhandener Export-Link aus der UI gefolgt:
- `Produktionsblatt exportieren` fuer `plan-spec-demo-production-coffee`
- Ziel: `http://127.0.0.1:3200/api/exports/v1/exports/production-plans/plan-spec-demo-production-coffee/html`
- sichtbar dort: `Produktionsplan plan-spec-demo-production-coffee` und `Status: partial`

Zusätzlich wurde der zugehörige Einkaufslisten-Export als weiterer kleiner read-only Servicepfad geprüft:
- `Einkaufsliste herunterladen` fuer `purchase-spec-demo-production-coffee`
- Ziel: `http://127.0.0.1:3200/api/exports/v1/exports/purchase-lists/purchase-spec-demo-production-coffee/csv`
- sichtbarer CSV-Anfang: `"group","item","normalizedQty","normalizedUnit","purchaseQty","purchaseUnit","supplierHint"`

Als weiterer kleiner read-only Nutzpfad wurde auch der Angebots-Export verifiziert:
- `Angebot exportieren` fuer `draft-demo-offer-conference-buffet`
- Ziel: `http://127.0.0.1:3200/api/exports/v1/exports/offers/draft-demo-offer-conference-buffet/html`
- sichtbarer HTML-Anfang: `Angebot draft-demo-offer-conference-buffet` und die Leistungsbausteine des Angebots

Damit ist der erste P2-Smoke-Korridor jetzt real belegt: drei UI-Routen, vier Health-Endpunkte und drei read-only Nutzpfade sind nachgewiesen, ohne eine neue Browser-/E2E-Infrastruktur oder breitere Pfadabdeckung aufzubauen.

## 4. Empfohlene kleinste MVP-Kernpfade fuer erste Smoke-Checks

Fuer die erste Smoke-Stufe sind die kleinsten sinnvollen Kernpfade:

1. Backoffice-UI Startseite
   - `http://127.0.0.1:3200/`
2. Angebotsbereich
   - `http://127.0.0.1:3200/angebot`
3. Produktionsbereich
   - `http://127.0.0.1:3200/produktion`
4. lokale Service-Health-Ketten als minimale technische Rueckversicherung
   - `http://127.0.0.1:3101/health`
   - `http://127.0.0.1:3102/health`
   - `http://127.0.0.1:3103/health`
   - `http://127.0.0.1:3104/health`

Diese Pfade sind klein genug fuer einen ersten Smoke-Korridor und gleichzeitig direkt an die reale Produktnutzung gebunden.

## 5. Was in P2 der ersten Stufe explizit drin ist

P2 der ersten Stufe umfasst nur:
- Erreichbarkeit der zentralen Backoffice-Einstiege
- minimale technische Erreichbarkeit der lokalen Kernservices
- keine neue Produktlogik
- keine neue Rollen- oder Rechtefunktionalitaet
- keine neue API
- keine neue Persistenz
- keine breite Browser-Automation

Der Fokus liegt auf "laeuft und ist erreichbar", nicht auf einer umfassenden funktionalen End-to-End-Validierung.

## 6. Was bewusst noch nicht drin ist

Bewusst nicht Teil von P2 in dieser Stufe:
- vollständige Browser-E2E-Suite
- grosse UI-Regression-Matrix
- neue Testinfrastruktur oder neue Testlaufzeit-Tools
- tiefe Interaktionen mit allen Formularen und Arbeitsflueßen
- automatisierte fachliche Vollabdeckung fuer alle Servicepfade
- neue Produktflaechen oder neue UI-Bereiche

## 7. Technische Voraussetzungen / Blocker

### 7.1 Voraussetzungen

Fuer einen ersten Smoke-Check muessen lediglich die bestehenden lokalen Komponenten laufen:
- `npm run local:start --seed-demo`
- oder ein aequivalent gestarteter lokaler Stack

### 7.2 Blocker

Ein breiter Browser-Run ist aktuell blockiert bzw. nicht vorgesehen, weil:
- kein dediziertes Browser-E2E-Setup im Repo verankert ist
- P2 bewusst klein gehalten werden soll
- die naechste echte Luecke eher in der schmalen Erreichbarkeits- und Statusabsicherung liegt als in einer neuen Testarchitektur

## 8. Empfohlener kleinster erster Ausfuehrungsschritt

Der kleinste sinnvolle erste Smoke-Schritt ist:
1. lokalen Stack mit Demo-Daten starten
2. die drei zentralen UI-Routen per HTTP auf Status 200 pruefen
3. optional anschliessend die vier lokalen Health-Endpunkte und die drei read-only Exportpfade pruefen

Damit wird P2 als minimaler, repo-gebundener Smoke-Korridor validiert, ohne einen groesseren Testaufbau zu starten.

## 9. Einordnung

Dieses Dokument begrenzt P2 bewusst auf den kleinsten belastbaren Anfang.
Es soll keine Browser-Strategie fuer das gesamte Produkt ausformulieren, sondern nur den naechsten realistischen Abschnitt fuer die Kernpfade festhalten.

Alles darueber hinaus bleibt spaetere Teststrategie und muss separat begruendet werden.