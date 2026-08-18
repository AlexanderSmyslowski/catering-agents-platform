# Server Application Isolation Design

**Status:** approved architecture target
**Date:** 2026-08-18

## Goal

Prevent Zeiterfassung, EventOS and Catering Agents Platform deployments from recreating, disconnecting, restarting, overwriting or otherwise impairing one another while they share the same Hetzner host.

## Incident Driver

On 2026-08-18 the shared Caddy container `platform-infra-web-1`, owned by the Catering Agents Platform deployment, was recreated from a Compose definition that did not preserve its attachment to `zeiterfassung_default`. The Zeiterfassung app container remained internally healthy, but the public route returned HTTP 502 because Docker DNS could no longer resolve `zeiterfassung-app-1`. A later Catering deployment recreated the shared proxy again and repeated the outage.

This proves that an application-owned deployment must not own shared ingress lifecycle for unrelated applications.

## Target Architecture

### 1. Independent application domains

Each application owns only its own runtime resources:

- unique Compose project name;
- private application network;
- application-specific ingress network;
- application-specific volumes and secrets;
- application-specific deploy lock;
- application-specific release metadata and rollback point;
- application-specific health and smoke gates.

No application deployment may invoke `docker compose down`, recreate, remove or mutate resources owned by another application.

### 2. Independent edge proxy

Public ingress becomes an independent infrastructure unit, not part of Catering Agents Platform, Zeiterfassung or EventOS.

The edge Caddy:

- owns ports 80/443;
- has its own deployment lifecycle and rollback;
- attaches only to application-specific ingress networks;
- never joins application private/database networks;
- routes each hostname only to the corresponding web/application upstream;
- is not automatically recreated by an application deployment.

Target network model:

```text
Internet
   |
   v
Independent Edge Caddy
   |-- zt_ingress ------> Zeiterfassung web/app ----> zt_private
   |-- eventos_ingress -> EventOS web/app ----------> eventos_private
   `-- catering_ingress -> Catering web ------------> catering_private
```

Database, worker and internal-service containers remain reachable only on their owning application's private network.

### 3. Transitional production override

Until edge extraction is complete, Catering's base `platform-infra/docker-compose.yml` must remain self-contained for local and clean-machine startup. Production-only cross-project network attachment must live in a production Compose override used only by the Hetzner deployment path.

The transitional override may attach the existing shared Caddy to `zeiterfassung_default`, but it must not make that external network a prerequisite for normal local Compose startup.

### 4. Deployment ownership contract

Every deployment path must fail closed unless it can prove that its planned mutations are limited to resources owned by that application or the independent edge unit.

At minimum:

- explicit Compose project name;
- explicit Compose file set;
- no generic host-wide container removal;
- no mutation of another application's volumes, secrets or data directories;
- pre-deploy inventory of owned containers/networks/volumes;
- post-deploy assertion that unrelated application container IDs/restart counts did not change;
- independent rollback snapshot/point.

### 5. Cross-application availability contract

A production infrastructure deploy is not successful merely because its own service is healthy. Shared-edge changes must run post-change checks for every public hostname managed by that edge.

Required minimum checks during the migration period:

- `https://zeit.the-one.catering/healthz` returns HTTP 200 and valid identity JSON;
- `https://zeit.the-one.catering/readyz` returns HTTP 200;
- `https://zeit.the-one.catering/api/public/config` is reachable with its expected public contract;
- `https://eventos.commcats.de/` returns its expected successful response;
- Catering's own UI/API smoke remains green.

Application-only deployments should additionally prove that unrelated application containers were not recreated.

## Migration Phases

### Phase 0 — live recovery

Restore the currently broken public Zeiterfassung route without changing the Zeiterfassung app, database, secrets or release identity. This is an operational recovery only, not the permanent architecture.

### Phase 1 — safe transitional proxy attachment

Replace the unsafe PR #629 base-Compose external-network dependency with a production-only Compose override. Update the production deployment path to use base + override. Preserve standalone local Compose startup. Record the production invariant in `memory.md` and add contract tests.

### Phase 2 — independent edge unit

Create a separately owned edge-infrastructure deployment source with Caddy configuration, edge-only Compose project, explicit app ingress networks, validation, rollback and all-hostname smoke checks. Remove ports 80/443 ownership from application projects.

### Phase 3 — app-specific ingress/private networks

Migrate Zeiterfassung, EventOS and Catering individually so each exposes only its web/app upstream on an application-specific ingress network and keeps all non-public services on its private network.

### Phase 4 — deployment isolation gates

Add resource-ownership preflight/postflight checks to each application deployment. A deployment must fail if it would mutate an unrelated application's resources or if unrelated container identity changes unexpectedly.

### Phase 5 — cutover verification

After the independent edge is authoritative:

- perform one controlled deployment of each application;
- prove the other applications remain healthy and their unrelated container identities remain unchanged;
- verify independent rollback for each application and the edge;
- remove obsolete shared-proxy compatibility configuration.

## Security Boundaries

- Edge Caddy receives no database credentials or application secrets.
- Edge Caddy is not attached to database/private networks.
- Cross-project communication is limited to HTTP(S) upstream traffic on named ingress networks.
- Secrets and persistent data remain app-owned and are never copied into the edge project.
- No host socket or Docker socket is exposed to application containers.

## Non-Goals

- Moving applications to separate physical servers during this migration.
- Kubernetes or a new orchestration platform.
- Rewriting application code.
- Consolidating databases or secrets.
- Introducing service discovery beyond Docker DNS on explicit ingress networks.

## Acceptance Criteria

The migration is complete only when all of the following are true:

1. Catering deployment cannot recreate or disconnect Zeiterfassung or EventOS.
2. Zeiterfassung deployment cannot recreate or disconnect Catering or EventOS.
3. EventOS deployment cannot recreate or disconnect Catering or Zeiterfassung.
4. Edge deployment is independent and validates every managed public hostname.
5. Each app has distinct private and ingress network ownership.
6. Each app has independent persistent data, secrets, release metadata and rollback.
7. A deliberate deployment rehearsal of each application leaves unrelated application container identity/restart state unchanged and all public health checks green.
