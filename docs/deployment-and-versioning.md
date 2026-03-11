# Deployment und Versionierung

## Hetzner fuer den MVP

Ja, fuer dieses Projekt macht ein Hetzner-Server im MVP Sinn, wenn die Plattform intern genutzt wird und Datenschutz, Kostenkontrolle und EU-Hosting wichtig sind.

Empfohlene Aufteilung:

- `backoffice-ui` als zentrale Web-Oberflaeche fuer Angebots-Ersteller und Produktionsplaner
- `intake-service`, `offer-service`, `production-service` als interne HTTP-Services
- `print-export` als separater HTTP-Service fuer HTML-/CSV-Downloads
- PostgreSQL, Redis und Objektspeicher im selben privaten Netz oder auf derselben VM
- Reverse Proxy mit HTTPS und Authentifizierung vor allen UIs und APIs

Aktueller MVP-Stand:

- Laufzeitdaten werden dateibasiert unter `CATERING_DATA_ROOT` gespeichert
- ohne gesetzte Umgebungsvariable wird lokal `./data` verwendet
- dadurch bleiben Intake-Vorgaenge, Angebotsentwuerfe, Produktionsplaene, Einkaufslisten und recherchierte Rezepte nach Neustarts erhalten
- alternativ kann `CATERING_DATABASE_URL` gesetzt werden; dann nutzen alle Services PostgreSQL mit JSONB-Persistenz
- die interne Web-App ist als Vite-Frontend angebunden und spricht die Service-APIs ueber Reverse-Proxy-Pfade an
- Exportdownloads fuer Angebote, Produktionsplaene und Einkaufslisten laufen ueber einen separaten Export-Service

Empfohlene Hetzner-MVP-Topologie:

- Nginx oder Caddy terminiert HTTPS
- `/api/intake` -> `intake-service`
- `/api/offers` -> `offer-service`
- `/api/production` -> `production-service`
- `/api/exports` -> `print-export`
- `/` -> gebaute `backoffice-ui`
- PostgreSQL auf derselben VM oder als separater Hetzner-Dienst

Im Repo liegt dafuer jetzt eine lauffaehige Compose-Basis unter [platform-infra/docker-compose.yml](/Users/alexandersmyslowski/Library/Mobile%20Documents/com~apple~CloudDocs/Dateien/THE%20ONE%20von%20Alexander/Codex/platform-infra/docker-compose.yml) mit separatem Web-Proxy und PostgreSQL.

Das ist sinnvoll, weil:

- beide Rollen dieselbe Plattform im Browser nutzen koennen
- niemand direkten Shell-Zugriff auf den Server braucht
- die Agenten zentral mit denselben Stammdaten, Logs und Rezeptquellen arbeiten
- Hetzner fuer einen internen MVP genug Leistung bei ueberschaubaren Kosten bietet

## Zugriff fuer verschiedene Personen

Empfohlener Betriebsmodus:

- Angebots-Ersteller oeffnen die Web-App und arbeiten im Bereich `Offer Workspace`
- Kueche / Produktionsplanung oeffnet dieselbe Web-App im Bereich `Production Control`
- Intake- und Review-Masken liegen ebenfalls in derselben internen Anwendung
- Rollen und Rechte werden in der App und vor dem Reverse Proxy geregelt

Nicht empfohlen:

- gemeinsame Nutzung eines Terminalzugangs
- lokale Einzelinstallationen pro Mitarbeiter
- direkter Aufruf einzelner Services ohne UI und Rechtekonzept

## GitHub-Strategie

Das Projekt sollte als Git-Repository lokal entwickelt und auf GitHub gespiegelt werden.

Empfohlener Ablauf:

- `main` enthaelt nur stabile, nachvollziehbare Zwischenstaende
- Arbeitsbranches bekommen das Prefix `codex/`
- jeder fachlich stabile Schritt wird mit Commit und Git-Tag markiert
- Tags bilden reproduzierbare Checkpoints

Namensschema fuer stabile Zwischenversionen:

- Tag-Format: `checkpoint-YYYYMMDD-N-kurzname`
- Beispiel: `checkpoint-20260310-1-mvp-foundation`

Im Repo ist dafuer ein Helfer hinterlegt:

```bash
npm run checkpoint -- <kurzname>
```

Mit Push:

```bash
npm run checkpoint -- <kurzname> --push
```

Was zu jedem Checkpoint gehoert:

- lauffaehiger Build
- gruene Tests
- kurzer Change-Summary im Commit

## Reproduzierbarkeit

Fuer reproduzierbare Zwischenstaende gilt:

- jeder Checkpoint muss `npm run build` und `npm test` erfolgreich bestehen
- relevante Architekturentscheidungen werden in `docs/` festgehalten
- spaetere Datenimporte und Stammdaten-Bootstrap-Skripte werden versioniert im Repo abgelegt

## GitHub Actions

Im Repo ist eine einfache CI vorgesehen:

- bei Push und Pull Request werden Build und Tests ausgefuehrt
- damit ist jeder Checkpoint auf GitHub nachvollziehbar pruefbar

## Naechster praktischer Schritt

Sobald ein GitHub-Repository angelegt ist:

1. lokalen Remote `origin` setzen
2. `main` pushen
3. Tags pushen
4. spaeter fuer jeden stabilen Meilenstein neuen Checkpoint-Tag setzen

## Praktischer Ablauf im Repo

Der Script-Workflow macht automatisch:

- `npm run build`
- `npm test`
- Ermittlung der naechsten Checkpoint-Nummer fuer den aktuellen Tag
- Erstellung eines annotierten Git-Tags
- optional Push von Branch und Tag
