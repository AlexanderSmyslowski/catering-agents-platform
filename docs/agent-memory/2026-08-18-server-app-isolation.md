# Server-App-Isolation — 2026-08-18

## Incident

A Catering Agents Platform production deployment recreated the shared Caddy container `platform-infra-web-1`. Because the deployed base Compose did not preserve the runtime attachment to `zeiterfassung_default`, Docker DNS could no longer resolve `zeiterfassung-app-1` and the public Zeiterfassung route returned HTTP 502 while the app itself remained internally healthy.

The same failure class had occurred previously: host-only network repair is not durable when another repository owns and recreates the shared proxy.

## Transitional invariant

- `platform-infra/docker-compose.yml` remains self-contained and must not require `zeiterfassung_default` for local/clean-machine startup.
- Production uses `platform-infra/docker-compose.production.yml` in addition to the base file.
- Only production `web` joins the external `zeiterfassung_default` network during the transition.
- The Hetzner deploy path must explicitly select both Compose files.

## Approved target architecture

Public ingress is to become an independent edge infrastructure unit. Zeiterfassung, EventOS and Catering each own separate private and ingress networks, persistent data, secrets, deployment locks, release metadata and rollback points. Application deployments must not own or recreate unrelated application ingress resources.

See `docs/superpowers/specs/2026-08-18-server-app-isolation-design.md` for the approved architecture and phased migration.