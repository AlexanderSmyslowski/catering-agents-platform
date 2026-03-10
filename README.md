# Catering Agents Platform

MVP-Monorepo fuer zwei spezialisierte Catering-Agenten:

- `offer-service`: Angebots-CoPilot
- `intake-service`: Intake, Parsing, Normalisierung
- `production-service`: Produktions-/Kuechen-CoPilot
- `shared-core`: kanonische Schemata, Regeln und Taxonomien
- `print-export`: Exporthelfer fuer HTML/CSV
- `backoffice-ui`: UI-Skelett fuer interne Workflows

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
- GitHub- und Checkpoint-Strategie siehe [docs/deployment-and-versioning.md](/Users/alexandersmyslowski/Library/Mobile%20Documents/com~apple~CloudDocs/Dateien/THE%20ONE%20von%20Alexander/Codex/docs/deployment-and-versioning.md).
