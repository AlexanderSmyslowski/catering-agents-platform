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

## Docker / Hetzner-MVP

Fuer einen zentralen Serverbetrieb liegt unter [platform-infra/README.md](/Users/alexandersmyslowski/Library/Mobile%20Documents/com~apple~CloudDocs/Dateien/THE%20ONE%20von%20Alexander/Codex/platform-infra/README.md) eine Compose-Basis mit:

- PostgreSQL
- Intake-, Offer-, Production- und Export-Service
- Nginx-Web-Frontend mit Reverse-Proxy auf die APIs

Start:

```bash
cd platform-infra
cp .env.example .env
docker compose up --build -d
```

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
- GitHub- und Checkpoint-Strategie siehe [docs/deployment-and-versioning.md](/Users/alexandersmyslowski/Library/Mobile%20Documents/com~apple~CloudDocs/Dateien/THE%20ONE%20von%20Alexander/Codex/docs/deployment-and-versioning.md).
