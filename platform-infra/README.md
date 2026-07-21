# Platform Infra

MVP-Infrastruktur fuer lokalen Serverbetrieb und Hetzner-Deployments.

Enthalten:

- `docker-compose.yml` fuer PostgreSQL, Intake, Offer, Production, Export und Web
- `docker/` mit Runtime- und Web-Images
- `Caddyfile` fuer Reverse-Proxy, statische Web-App und automatische HTTPS-Zertifikate
- `.env.example` fuer die wichtigsten Deploy-Variablen
- `scripts/deploy-hetzner.sh` fuer rsync + Remote-Compose-Deploy
- `scripts/smoke-check.sh` fuer API-Healthchecks

Schnellstart:

```bash
cd platform-infra
cp .env.example .env
docker compose up --build -d
```

Danach ist die Plattform lokal standardmaessig auf `http://localhost:8080` erreichbar.
Die getrennten Arbeitsflaechen liegen lokal unter:

- `http://localhost:8080/angebot`
- `http://localhost:8080/produktion`

## Oeffentliche Domain auf Hetzner

Fuer eine echte Web-URL auf dem Hetzner-Server setze in `platform-infra/.env` mindestens:

```bash
CATERING_SITE_ADDRESS=app.example.com
CADDY_EMAIL=ops@example.com
HTTP_PORT=80
HTTPS_PORT=443
```

Dann zeigt Caddy die Plattform unter `https://app.example.com` aus und terminiert TLS direkt im `web`-Container.
Die beiden Agenten sind dann unter eigenen URLs erreichbar:

- `https://app.example.com/angebot`
- `https://app.example.com/produktion`

## Zusaetzliche Sites am gemeinsamen Proxy

Zusaetzliche Anwendungen erhalten je eine serverseitige `*.caddy`-Datei im
festen Verzeichnis `platform-infra/sites`. Dieses Verzeichnis wird nur lesbar
in den Caddy-Container eingebunden, ist nicht Teil des Repositories und wird
beim Deployment-Sync nicht geloescht. Der feste Pfad stellt sicher, dass der
Sync-Schutz und der Compose-Mount immer dasselbe servereigene Verzeichnis
verwenden. Dadurch bleiben anwendungseigene Hostbloecke auch erhalten, wenn das
Plattform-Image neu gebaut wird.

Vor dem ersten Start muss das Verzeichnis auf dem Zielserver existieren. Eine
Site-Datei darf nur ihren eigenen Hostblock enthalten. Beispiel:

```caddyfile
app2.example.com {
	reverse_proxy app2:3000
}
```

Nach Aenderungen die Gesamtkonfiguration validieren und Caddy neu laden oder den
`web`-Container kontrolliert neu erstellen.

## Reproduzierbarer Deploy-Run

Lokal:

```bash
export DEPLOY_HOST=your-server.example.com
export DEPLOY_USER=root
export DEPLOY_PATH=/opt/catering-agents-platform
export DEPLOY_BASE_URL=https://app.example.com
bash ./scripts/deploy-hetzner.sh
```

Voraussetzungen auf dem Server:

- Docker und Docker Compose Plugin installiert
- dieses Repo liegt unter `DEPLOY_PATH`
- `platform-infra/.env` ist dort ausgefuellt
- DNS fuer `CATERING_SITE_ADDRESS` zeigt auf den Hetzner-Server
- Ports `80` und `443` sind offen
