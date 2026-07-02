# Runtime Smoke Startup Budget

- Ziel: Runtime-Smoke unter voller Suite-Last stabil starten lassen.
- Scope: Test-Harness-Timeouts fuer Service-Startups; keine Service- oder Produktlogik.
- Befund: production und print-export starten isoliert, laufen in der Vollsuite aber in das 10s-Health-Budget.
- Erfolg: Runtime-Smoke isoliert und `npm test` laufen gruen.
