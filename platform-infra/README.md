# Platform Infra

MVP-Infrastruktur fuer lokalen Serverbetrieb und Hetzner-Deployments.

Enthalten:

- `docker-compose.yml` fuer PostgreSQL, Intake, Offer, Production, Export und Web
- `docker/` mit Runtime- und Web-Images
- `nginx/default.conf` als Reverse-Proxy vor UI und APIs
- `.env.example` fuer die wichtigsten Deploy-Variablen

Schnellstart:

```bash
cd platform-infra
cp .env.example .env
docker compose up --build -d
```

Danach ist die Plattform standardmaessig auf `http://localhost:8080` erreichbar.
