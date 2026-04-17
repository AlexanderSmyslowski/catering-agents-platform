# P3 Betrieb und Deployment – Mini-Spezifikation

Status: Mini-Spezifikation v0.1 auf Basis des aktuellen Repo-Iststands
Stand: 2026-04-16

## 1. Zweck der Mini-Spezifikation

Diese Mini-Spezifikation schärft den Betriebs- und Deployment-Rahmen der Catering Agents Platform fuer den MVP.

Sie erfindet keine neue Infra-Roadmap, sondern ordnet den bereits vorhandenen lokalen und Hetzner-orientierten Betriebsrahmen so, dass klar bleibt:
- was bereits vorhanden ist
- was fuer den MVP belastbar angenommen werden kann
- wo die wichtigsten Betriebsrisiken oder Luecken liegen
- welcher kleinste naechste Schritt den Betrieb real weiter haertet

## 2. Bezug auf Pflichtenheft, MVP-Arbeitspakete und P5

Grundlagen dieses Dokuments sind:
- `docs/product/PFLICHTENHEFT.md`
- `docs/product/MVP_ARBEITSPAKETE.md`
- `docs/product/P5_MVP_ABGRENZUNG_MINISPEZ.md`
- `memory.md`
- `README.md`
- `docs/deployment-and-versioning.md`
- `platform-infra/README.md`
- der aktuelle Repo-Iststand in den lokalen Start-, Status- und Deploy-Skripten

Wesentliche Ableitungen:
- Das Pflichtenheft beschreibt die Plattform als interne, stabile Betriebsplattform mit reproduzierbarem Deployment-Rahmen.
- Die MVP-Arbeitspakete setzen P3 als Betrieb-/Deployment-Haertung nach P1/P2/Konsolidierung.
- P5 begrenzt den Produktkern; P3 soll diese Grenzen betrieblich absichern, nicht erweitern.

## 3. Aktueller Repo-Iststand zu Betrieb / Deployment

### 3.1 Bereits dokumentiert und real angelegt

Im Repo sind bereits folgende Betriebswege und Annahmen sichtbar:
- lokaler Ein-Kommando-Start ueber `npm run local:start`
- lokaler Status ueber `npm run local:status`
- reproduzierbarer lokaler Check ueber `npm run local:check`
- lokaler Stop ueber `npm run local:stop`
- der lokale Check prueft neben fünf `screen`-Sessions und den vier Health-Endpunkten jetzt auch einen konkreten read-only Exportpfad sowie einen gehärteten read-only Audit-Beleg fuer den Demo-Startweg
- `platform-infra/docker-compose.yml` als Compose-Basis fuer den servernahen Betrieb
- `platform-infra/scripts/deploy-hetzner.sh` als reproduzierbarer Deploy-Run
- `platform-infra/scripts/smoke-check.sh` fuer einfache API-Healthchecks
- Caddy als Reverse-Proxy mit HTTPS im infrastrukturellen Betriebsbild
- lokale Web-App auf `http://127.0.0.1:3200`
- lokale Service-Health-Endpunkte auf `3101` bis `3104`
- Datenhaltung wahlweise dateibasiert ueber `CATERING_DATA_ROOT` oder ueber PostgreSQL via `CATERING_DATABASE_URL`
- Operator-Zuordnung ueber `x-actor-name`
- Audit-Feed als gemeinsame Nachvollziehbarkeitsquelle fuer mutierende Aktionen

### 3.2 Was fuer den MVP-Betrieb belastbar angenommen werden kann

Aus dem Repo-Iststand kann fuer den MVP-Betrieb aktuell klein und konservativ angenommen werden:
- der lokale Stack ist reproduzierbar startbar und statusfaehig
- UI und Kernservices gehoeren zusammen und muessen gemeinsam betrachtet werden
- die interne Plattform ist fuer eine geschlossene Nutzung gedacht, nicht fuer offene Produktisierung
- Betriebsdaten muessen Neustarts ueberstehen
- die dokumentierte Hetzner-/Reverse-Proxy-Landschaft ist der naechste Zielrahmen, aber noch kein Anlass fuer neue Produktarchitektur

### 3.3 Wichtige offene Risiken / Luecken

Die aktuell wichtigsten Luecken fuer einen stabilen MVP-Betrieb sind:
- fehlende formale Absicherung, dass der lokale und der servernahe Weg ueberall gleich reproduzierbar sind
- noch nicht voll verengte Betriebsdokumentation fuer Start, Status, Stop und Deploy im MVP-Kontext
- Abhaengigkeit von korrekt gesetzten Umgebungsvariablen und Laufzeitdatenpfaden
- fehlende explizite Betriebsgrenze fuer Fehlerfaelle zwischen lokalem Stack und Hetzner-Betrieb
- noch keine stark verdichtete Aussage, welche Betriebsannahmen fuer den MVP als ausreichend gelten

## 4. Bereits vorhandene Betriebsbausteine

Bereits vorhandene Bausteine, die P3 nur absichern, nicht neu erfinden soll:
- lokaler Start-/Status-/Stop-Rahmen
- Compose-Basis fuer servernahen Betrieb
- Reverse-Proxy / HTTPS als Betriebsannahme
- Export-Service als separater Betriebsbaustein
- gemeinsame Audit- und Operator-Zuordnung
- bestehende Health-Endpunkte fuer Intake, Angebot, Produktion und Export

## 5. Minimale MVP-Betriebsannahmen

Fuer den MVP koennen aktuell folgende Minimalannahmen festgehalten werden:
1. Die Plattform wird intern betrieben und nicht als oeffentliche Multi-Tenant-Loesung.
2. Ein lokaler Stack mit Demo-Daten ist der wichtigste reproduzierbare Entwicklungs- und Verifikationsmodus.
3. Der servernahe Deployment-Weg orientiert sich an der Hetzner-/Caddy-/Compose-Basis.
4. Laufzeitdaten muessen persistent sein, entweder dateibasiert oder ueber PostgreSQL.
5. Operator-Aktionen muessen auditierbar bleiben.
6. Die UI ist Teil des Betriebsrahmens und nicht nur ein optionales Add-on.
7. P3 darf keine neue Produktflaeche aufmachen, sondern nur den vorhandenen Betriebsrahmen haerten.

## 6. Was in P3 der ersten Stufe explizit drin ist

P3 Stufe 1 umfasst nur:
- klare Beschreibung des lokalen Start-/Status-/Stop-Pfads
- klare Beschreibung des servernahen Compose-/Deploy-Pfads
- klare Trennung zwischen lokalem Entwicklungsbetrieb und Hetzner-Zielbetrieb
- minimale Beschreibung der Datenhaltungsmodi
- Benennung der wichtigsten Betriebsannahmen
- Benennung der wichtigsten Betriebsrisiken
- Abgrenzung gegen neue Infra-Roadmaps oder Plattformisierung

## 7. Was bewusst noch nicht drin ist

Bewusst nicht Teil von P3 in dieser Stufe:
- neue Infrastrukturarchitektur
- Multi-Region-Betrieb
- neue Orchestrierungsplattform
- neue CI/CD-Roadmap
- neue API
- neue Persistenzmigration
- neue UI-Flaechen
- grosse Observability-/Monitoring-Plattform
- Plattformisierung oder White-Label-Betriebsmodell

## 8. Empfohlener kleinster naechster P3-Schritt

Der kleinste sinnvolle naechste Schritt ist eine knappe, repo-gebundene Betriebsabsicherung des lokalen Stack-Pfads:
- Start ueber `npm run local:start`
- Status ueber `npm run local:status`
- Health ueber `npm run local:check`
- plus ein bewusst kleiner Health-/Erreichbarkeitsnachweis fuer einen konkreten read-only Exportpfad

Damit ist P3 in der ersten Stufe praktisch bestaetigt und bewusst ausreichend gehärtet, ohne eine grosse Infra-Baustelle zu eroefnen.

Ein weiterer Mikro-Ausbau des gleichen Checks wird an dieser Stelle nicht empfohlen; der naechste sinnvolle Schritt liegt ausserhalb von P3.

## 9. Einordnung

Dieses Dokument ist absichtlich schmal.
Es soll den MVP-Betriebsrahmen nur so weit schaerfen, dass er als belastbare Arbeitsgrundlage dient.

Wenn sich der Repo-Iststand spaeter aendert, muss diese Mini-Spezifikation gezielt und repo-gebunden nachgezogen werden.