# Catering Agents Platform

MVP-Monorepo fuer eine interne Catering-Plattform mit zwei spezialisierten Agenten: Angebotsagent fuer Angebotserstellung und Produktionsagent fuer Rezepte, Produktionsplanung und Einkaufslisten.

## Workspaces

- `offer-service`: Angebots-CoPilot
- `intake-service`: Intake, Parsing und Normalisierung
- `production-service`: Produktions-/Kuechen-CoPilot
- `shared-core`: kanonische Schemata, Regeln und Taxonomien
- `print-export`: HTML-/CSV-Exportservice fuer Angebote, Produktionsplaene und Einkaufslisten
- `backoffice-ui`: interne Web-App fuer Intake, Angebote, Produktion und Exporte

## Schnellstart

```bash
npm install
npm test
npm run build
```

## Entwicklungsserver

```bash
npm run dev:intake
npm run dev:offer
npm run dev:production
npm run dev:exports
npm run dev:ui
```

Die interne Web-App laeuft im Dev-Modus ueber Vite auf Port `3200`.

## Lokaler Stack

```bash
npm run local:start
npm run local:start:subscription
npm run local:start:fresh
npm run local:status
npm run local:check
npm run local:stop
```

- `npm run local:start` startet den lokalen Stack mit Demo-Seeding.
- `npm run local:start:subscription` startet den leeren lokalen Operator-Stack mit dem angemeldeten ChatGPT-Konto ueber Codex CLI.
- `npm run local:start:fresh` stoppt den laufenden Stack und startet mit temporaerer synthetischer Datenwurzel neu.
- `npm run local:status` zeigt lokale Prozess- und Erreichbarkeitsdaten fuer die erwarteten Services.
- `npm run local:check` prueft UI-Routen, Health-Endpunkte, read-only Exportpfade und lokale Auditbelege gegen den laufenden Stack.
- `npm run local:stop` beendet die lokalen `screen`-Sitzungen und zugehoerigen Repo-Prozesse.

## Datenhaltung

Standardmaessig speichern die Services ihre Laufzeitdaten unter `./data`.

```bash
export CATERING_DATA_ROOT=/var/lib/catering-agents
```

Fuer PostgreSQL statt Dateispeicher:

```bash
export CATERING_DATABASE_URL=postgresql://user:password@localhost:5432/catering_agents
```

Freigegebene anonymisierte Produktionsdokumente werden mit `CATERING_PRODUCTION_DRAFT_DATA_MODE=pseudonymized_approved` aktiviert; ohne diese explizite Konfiguration bleibt der Modus `synthetic_or_demo_only`.

## Ports und Proxies

Die UI proxied standardmaessig auf:

- `http://localhost:3101` fuer Intake
- `http://localhost:3102` fuer Offers
- `http://localhost:3103` fuer Production
- `http://localhost:3104` fuer Exporte

Optional konfigurierbar ueber `VITE_INTAKE_PROXY_TARGET`, `VITE_OFFERS_PROXY_TARGET`, `VITE_PRODUCTION_PROXY_TARGET` und `VITE_EXPORTS_PROXY_TARGET`.

Die getrennten Arbeitsflaechen liegen lokal unter `http://localhost:3200/`, `/angebot` und `/produktion`.

## LLM-Skripte

| Befehl | Zweck |
| --- | --- |
| `npm run llm:synthetic-live:preflight` | prueft lokale Env-, Flag- und Fixture-Voraussetzungen. |
| `npm run llm:synthetic-live:probe` | fuehrt den synthetischen Clarification-Probe-Lauf aus. |
| `npm run llm:synthetic-live:probe:strict` | bricht bei Probe-Fehler oder Eval-Drift hart ab. |
| `npm run llm:synthetic-live:check` | buendelt Preflight und Strict-Probe. |
| `npm run llm:synthetic-live:probe:mini-pilot` | fuehrt den guarded Mini-Pilot-Probe aus. |
| `npm run llm:synthetic-live:check:mini-pilot` | buendelt Mini-Pilot-Preflight und guarded Probe. |
