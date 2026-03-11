# Catering Agents Platform

MVP-Monorepo fuer zwei spezialisierte Catering-Agenten:

- `offer-service`: Angebots-CoPilot
- `intake-service`: Intake, Parsing, Normalisierung
- `production-service`: Produktions-/Kuechen-CoPilot
- `shared-core`: kanonische Schemata, Regeln und Taxonomien
- `print-export`: HTML-/CSV-Exportservice fuer Angebote, Produktionsplaene und Einkaufslisten
- `backoffice-ui`: interne Web-App fuer Intake, Angebote, Produktion und Exporte

## Schnellstart

```bash
npm install
npm test
```

## Entwicklungsserver

```bash
npm run dev:intake
npm run dev:offer
npm run dev:production
npm run dev:exports
npm run dev:ui
```

Standardmaessig speichern die Services ihre Laufzeitdaten unter `./data`.
Auf Servern sollte dafuer ein persistentes Verzeichnis gesetzt werden:

```bash
export CATERING_DATA_ROOT=/var/lib/catering-agents
```

Fuer PostgreSQL statt Dateispeicher:

```bash
export CATERING_DATABASE_URL=postgresql://user:password@localhost:5432/catering_agents
```

Die interne Web-App laeuft im Dev-Modus ueber Vite auf Port `3200` und proxied standardmaessig auf:

- `http://localhost:3101` fuer Intake
- `http://localhost:3102` fuer Offers
- `http://localhost:3103` fuer Production
- `http://localhost:3104` fuer Exporte

Optional konfigurierbar ueber:

- `VITE_INTAKE_PROXY_TARGET`
- `VITE_OFFERS_PROXY_TARGET`
- `VITE_PRODUCTION_PROXY_TARGET`
- `VITE_EXPORTS_PROXY_TARGET`

Die Web-App bietet Exportlinks fuer:

- Angebots-HTML
- Produktionsblatt-HTML
- Einkaufslisten-CSV
- einen sichtbaren Audit-Trail der letzten Operator-Aktionen

Die Rezeptbibliothek kann jetzt von beiden Agenten aus erweitert werden:

- `POST /v1/offers/recipes/upload` fuer Datei-Uploads ueber den Angebotsagenten
- `POST /v1/production/recipes/upload` fuer Datei-Uploads ueber den Produktionsagenten
- beide Pfade schreiben in dieselbe persistierte Rezeptbibliothek
- fuer Tests und interne Automationen existieren zusaetzlich die JSON-Endpunkte `.../recipes/import-text`
- `PATCH /v1/offers/recipes/:recipeId/review` und `PATCH /v1/production/recipes/:recipeId/review` erlauben Freigabe, Verifizierung oder Ablehnung
- `review_required` und `rejected` Rezepte werden nicht still weiter als interne Kandidaten verwendet

Fuer frische Deployments stehen ausserdem Admin-Endpunkte bereit:

- `GET /health` auf Intake, Offer, Production und Export
- `POST /v1/intake/seed-demo`
- `POST /v1/offers/seed-demo`
- `POST /v1/production/seed-demo`
- `GET /v1/production/audit/events?limit=30` fuer den gemeinsamen Audit-Feed

Operator-Namen koennen ueber den Header `x-actor-name` mitgegeben werden.
Die Backoffice-UI speichert diesen Namen lokal und sendet ihn bei mutierenden Aktionen automatisch mit.

Die Web-App nutzt diese Pfade jetzt direkt fuer Service-Status und Demo-Befuellung.
Zusatzlich kann sie nun PDF-, TXT-, MD- und E-Mail-Dateien ueber den Intake-Pfad hochladen und daraus direkt `AcceptedEventSpec`-Datensaetze erzeugen.
Angebotsvarianten koennen ausserdem direkt aus der UI in operative `AcceptedEventSpec`-Datensaetze promoted werden.
Unvollstaendige `AcceptedEventSpec`-Datensaetze lassen sich im Intake-Bereich nun direkt im Backoffice nachbearbeiten und erneut validieren.

## Docker / Hetzner-MVP

Fuer einen zentralen Serverbetrieb liegt unter [platform-infra/README.md](/Users/alexandersmyslowski/Library/Mobile%20Documents/com~apple~CloudDocs/Dateien/THE%20ONE%20von%20Alexander/Codex/platform-infra/README.md) eine Compose-Basis mit:

- PostgreSQL
- Intake-, Offer-, Production- und Export-Service
- Caddy-Web-Frontend mit Reverse-Proxy auf die APIs und optionaler automatischer HTTPS-Terminierung

Start:

```bash
cd platform-infra
cp .env.example .env
docker compose up --build -d
```

Fuer eine echte Hetzner-Domain wird in `platform-infra/.env` z. B. gesetzt:

```bash
CATERING_SITE_ADDRESS=app.example.com
CADDY_EMAIL=ops@example.com
HTTP_PORT=80
HTTPS_PORT=443
```

Danach ist die Web-App unter `https://app.example.com` vorgesehen.

## Checkpoints

Einen reproduzierbaren Zwischenstand erzeugst du mit:

```bash
npm run checkpoint -- <kurzname>
```

Optional direkt mit Push:

```bash
npm run checkpoint -- <kurzname> --push
```

## Betrieb und Versionierung

- Deployment-Empfehlung fuer den MVP: Hetzner-VM als interne Plattform mit HTTPS-Reverse-Proxy, Web-App fuer Mitarbeiter und getrennten API-Services.
- Zugriff fuer Angebots-Ersteller und Kuechenplanung erfolgt ueber die interne Web-App, nicht direkt per Shell auf dem Server.
- Intake-, Angebots-, Produktions- und Rezeptdaten werden im MVP entweder dateibasiert oder ueber PostgreSQL persistiert und ueberstehen Server-Neustarts.
- Nutzeraktionen aus Intake, Angebot, Produktion und Rezept-Review landen in einem gemeinsamen Audit-Log und sind in der Web-App sichtbar.
- GitHub- und Checkpoint-Strategie siehe [docs/deployment-and-versioning.md](/Users/alexandersmyslowski/Library/Mobile%20Documents/com~apple~CloudDocs/Dateien/THE%20ONE%20von%20Alexander/Codex/docs/deployment-and-versioning.md).
