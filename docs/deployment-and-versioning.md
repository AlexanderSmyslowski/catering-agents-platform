# Deployment und Versionierung

## Hetzner fuer den MVP

Ja, fuer dieses Projekt macht ein Hetzner-Server im MVP Sinn, wenn die Plattform intern genutzt wird und Datenschutz, Kostenkontrolle und EU-Hosting wichtig sind.

Empfohlene Aufteilung:

- `backoffice-ui` als zentrale Web-Oberflaeche fuer Angebots-Ersteller und Produktionsplaner
- `intake-service`, `offer-service`, `production-service` als interne HTTP-Services
- `print-export` als separater HTTP-Service fuer HTML-/CSV-Downloads
- PostgreSQL, Redis und Objektspeicher im selben privaten Netz oder auf derselben VM
- Caddy als Reverse Proxy mit HTTPS und Authentifizierung vor allen UIs und APIs

Aktueller MVP-Stand:

- Laufzeitdaten werden dateibasiert unter `CATERING_DATA_ROOT` gespeichert
- ohne gesetzte Umgebungsvariable wird lokal `./data` verwendet
- dadurch bleiben Intake-Vorgaenge, Angebotsentwuerfe, Produktionsplaene, Einkaufslisten und recherchierte Rezepte nach Neustarts erhalten
- alternativ kann `CATERING_DATABASE_URL` gesetzt werden; dann nutzen alle Services PostgreSQL mit JSONB-Persistenz
- die interne Web-App ist als Vite-Frontend angebunden und spricht die Service-APIs ueber Reverse-Proxy-Pfade an
- Exportdownloads fuer Angebote, Produktionsplaene und Einkaufslisten laufen ueber einen separaten Export-Service
- alle mutierenden Fachaktionen koennen ueber `x-actor-name` einem Operator zugeordnet werden und landen im gemeinsamen Audit-Log

Empfohlene Hetzner-MVP-Topologie:

- Caddy im `web`-Container terminiert HTTPS
- `/api/intake` -> `intake-service`
- `/api/offers` -> `offer-service`
- `/api/production` -> `production-service`
- `/api/exports` -> `print-export`
- `/` -> gebaute `backoffice-ui`
- PostgreSQL auf derselben VM oder als separater Hetzner-Dienst

Im Repo liegt dafuer jetzt eine lauffaehige Compose-Basis unter [platform-infra/docker-compose.yml](/Users/alexandersmyslowski/Library/Mobile%20Documents/com~apple~CloudDocs/Dateien/THE%20ONE%20von%20Alexander/Codex/platform-infra/docker-compose.yml) mit separatem Web-Proxy und PostgreSQL.
Der reproduzierbare Remote-Deploy liegt unter [platform-infra/scripts/deploy-hetzner.sh](/Users/alexandersmyslowski/Library/Mobile%20Documents/com~apple~CloudDocs/Dateien/THE%20ONE%20von%20Alexander/Codex/platform-infra/scripts/deploy-hetzner.sh).

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
- Rezept-PDFs oder Textdateien koennen ueber beide Agenten-Workspaces hochgeladen werden und erweitern die gemeinsame Rezeptbibliothek
- manuelle Angebote, PDFs, E-Mails und Textdateien koennen ueber den Intake-Upload direkt nach `AcceptedEventSpec` normalisiert werden
- unvollstaendige `AcceptedEventSpec`-Datensaetze koennen im Backoffice manuell nachbearbeitet und erneut validiert werden
- ein strukturiertes Intake-Formular kann ohne Freitext direkt operative `AcceptedEventSpec`-Datensaetze anlegen
- Rezepte aus Uploads oder Internet-Fallbacks koennen in der Rezeptliste freigegeben, verifiziert oder abgelehnt werden
- Service-Gesundheit und Demo-Seeding sind ueber die Admin-Pfade in der Web-App sichtbar
- die Web-App fuehrt einen Operator-Namen lokal und sendet ihn bei mutierenden Aktionen mit, damit Audit-Eintraege personell nachvollziehbar bleiben
- bei Produktionsplaenen wird pro Gericht eine Suchspur angezeigt, damit interne Treffer, Websuchen und Verwerfungsgruende nachvollziehbar bleiben
- Rollen und Rechte werden in der App und vor dem Reverse Proxy geregelt

Fuer die lokale MVP-Nutzung gibt es jetzt auch einen Ein-Kommando-Start:

- `npm run local:start` startet UI, Intake, Offer, Production und Export mit gemeinsamem `CATERING_DATA_ROOT`
- `npm run local:status` zeigt den aktuellen lokalen Stack-Status
- `npm run local:stop` beendet den lokalen Stack wieder

Nicht empfohlen:

- gemeinsame Nutzung eines Terminalzugangs
- lokale Einzelinstallationen pro Mitarbeiter
- direkter Aufruf einzelner Services ohne UI und Rechtekonzept

## Audit und Nachvollziehbarkeit

Der gemeinsame Audit-Feed ist serviceuebergreifend aufgebaut:

- Intake, Offer und Production schreiben in dieselbe persistierte Audit-Collection
- gelesen wird der Feed aktuell ueber `GET /v1/production/audit/events`
- bei Dateispeicher liegt er unter `audit/events`, bei PostgreSQL in derselben `catering_records`-Tabelle
- typische Aktionen: Intake-Normalisierung, Angebotsentwurf, Varianten-Promotion, Produktionsplanung, Rezept-Upload und Rezept-Review

Damit ist spaeter nachvollziehbar:

- wer einen Angebotsentwurf erzeugt hat
- wer einen Produktionsplan ausgeloest hat
- wer ein Rezept hochgeladen, freigegeben, verifiziert oder abgelehnt hat

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
- fuer bestehende Catering-Rezeptordner gibt es jetzt den versionierten Bulk-Import `npm run import:recipes:caterings -- "<pfad>"`

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
