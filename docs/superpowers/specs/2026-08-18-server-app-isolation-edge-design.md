# Server Application Isolation and Edge Architecture

Date: 2026-08-18
Status: approved design
Scope: production infrastructure for the shared Hetzner host

## Goal

Prevent deployments of Zeiterfassung, EventOS, and Catering Agents Platform from recreating, disconnecting, stopping, or otherwise mutating infrastructure owned by another application. A failure or deployment in one application must not make another application unavailable.

## Current Failure Mode

The public reverse proxy currently belongs to the Catering Agents Platform Compose project. Its Caddy configuration also serves applications outside that project. A Catering Agents Platform deployment therefore recreates `platform-infra-web-1`. When that container is recreated without the runtime-only `zeiterfassung_default` attachment, Docker DNS can no longer resolve `zeiterfassung-app-1:3040`; `zeit.the-one.catering` returns HTTP 502 while the Zeiterfassung container itself remains healthy.

This happened repeatedly on 2026-08-18 and is the same class of incident documented in `INCIDENT_SHARED_PROXY_ROUTE_REMOVED_2026-07-12.md`.

The attempted fix of declaring `zeiterfassung_default` as an external network in the base `platform-infra/docker-compose.yml` is rejected because it makes the normal standalone/local Compose stack depend on a production-only network.

## Principles

1. **One owner per runtime resource.** Every container, network, volume, secret path, database, deployment lock, rollback point, and monitoring job has exactly one owning application or the Edge layer.
2. **Application deploys cannot own the public edge.** The public TLS/reverse-proxy service is deployed independently from application repositories.
3. **Private-by-default networking.** Each application has a private internal network. Databases and internal services never join a cross-application network.
4. **One ingress network per application.** The Edge proxy may join a narrow application-specific ingress network; only the application's public upstream service joins that network from the application side.
5. **No shared app network.** Zeiterfassung, EventOS, and Catering do not join one common application network.
6. **No cross-app container lifecycle operations.** A deploy script must operate only on its own Compose project and may not recreate or remove foreign containers, networks, or volumes.
7. **Fail closed before mutation.** Deploys verify ownership, source identity, current public health, and expected resource scope before cutover.
8. **Cross-app health after edge changes.** Any Edge deployment must prove that all managed public hostnames remain healthy.
9. **Local development stays self-contained.** Production-only network dependencies live in production overrides or the Edge project, never in base Compose files used by local development.
10. **Rollback is application-specific.** Rolling back one application must not roll back or recreate the Edge or another application.

## Target Topology

```text
Internet
   |
   v
+------------------------------+
| edge-caddy                   |
| standalone Compose project   |
+-----+-------------+----------+
      |             |
      |             |
 zt_ingress     eventos_ingress      catering_ingress
      |             |                    |
      v             v                    v
 Zeiterfassung   EventOS             Catering web
 app service     public upstream     public web
      |             |                    |
 zt_private      eventos_private     catering_private
      |             |                    |
 data/secrets    DB/internal         Postgres/services
```

The Edge container is the only component attached to more than one application-specific ingress network. It is not attached to application private networks.

## Resource Ownership

### Edge

Owns:
- public ports 80/443
- TLS termination
- host routing
- Caddy data/config volumes
- application-specific ingress networks, or explicit contracts for their creation
- Edge deployment lock and rollback
- cross-hostname smoke tests

Must not own:
- application databases
- application secrets
- application private networks
- application containers

### Zeiterfassung

Owns:
- Zeiterfassung application container/image
- `zt_private` network
- Zeiterfassung data/secrets and backups
- Zeiterfassung release directories and deploy lock
- `zt_ingress` membership for the application upstream only

Must not publish host ports 80/443 in the shared-host production topology.

### EventOS

Owns its own app/database/internal services, volumes, secrets, deploy lock, rollback, private network, and `eventos_ingress` upstream membership.

### Catering Agents Platform

Owns its Postgres, intake, offer, production, exports, UI/web application resources, private network, deploy lock/rollback, and `catering_ingress` upstream membership.

Its production deployment must not create, restart, or recreate the standalone Edge Caddy.

## Migration Strategy

### Phase 0 — Restore current public availability

Until the Edge split is complete, reconnect the existing shared Caddy container to `zeiterfassung_default` as a reversible runtime recovery only. Verify Zeiterfassung health/readiness/context and existing EventOS/Catering public routes. This is recovery, not the durable architecture.

### Phase 1 — Stop current Catering deploys from breaking Zeiterfassung

Before a full Edge extraction, modify the production-only deployment path so that the current shared Caddy retains the required Zeiterfassung network attachment while local/base Compose remains standalone. The production override must not be loaded by normal local `docker compose up` commands.

This phase is temporary and must include a test proving:
- base Compose starts/configures without `zeiterfassung_default`;
- production Compose fails clearly if the required production external network is absent;
- production Compose attaches `web` to both its normal network and `zeiterfassung_default`;
- deployment scripts use the production override explicitly;
- the new production invariant is recorded in `memory.md`.

### Phase 2 — Extract standalone Edge

Create a separately owned Edge deployment unit. The preferred final ownership is a dedicated infrastructure repository or a clearly independent server-infra project that cannot be deployed by an application workflow.

Move public Caddy routing and TLS volumes to this Edge unit. Application repositories provide only their upstream contract: hostname, ingress network name, upstream service alias, port, health endpoint.

Application deploys no longer rebuild or recreate Edge Caddy.

### Phase 3 — Per-app ingress/private network split

For each application:
- preserve/create one private internal network;
- create one application-specific ingress network;
- attach only the public upstream service to ingress;
- attach Edge to ingress;
- keep DB/internal workers off ingress;
- remove obsolete cross-project network dependencies.

### Phase 4 — Deployment ownership guards

Every production deploy must capture the pre-deploy resource set and reject a plan that would mutate resources outside its ownership namespace.

At minimum, guards verify:
- expected Compose project name;
- allowed container name/prefix set;
- allowed network set;
- allowed volume set;
- no ownership of Edge ports 80/443 by application projects;
- no `docker compose down` or prune operation against foreign projects;
- exact source SHA/release identity where the application already has release provenance.

### Phase 5 — Cross-app smoke contracts

After an Edge deployment, verify all managed public applications. After an application deployment, verify the target application and lightweight reachability of other public applications to detect accidental shared-infrastructure mutation.

Current minimum host checks:
- `https://zeit.the-one.catering/healthz`
- `https://zeit.the-one.catering/readyz`
- `https://zeit.the-one.catering/api/public/config`
- `https://eventos.commcats.de/`
- Catering platform public route(s) configured for the deployment environment

## Deployment Locks

Use separate lock namespaces:
- `edge`
- `zeiterfassung`
- `eventos`
- `catering-platform`

An application lock never grants permission to mutate Edge. Edge operations may require an Edge lock plus pre/post cross-app health verification.

## Ports

On the shared host, only Edge binds public 80/443 in the final state. Applications communicate with Edge through Docker ingress networks and do not expose their application ports publicly. Internal application ports remain network-local.

## Secrets and Data

No application shares secret directories or database/data volumes with another application. Edge stores only TLS/proxy configuration material required for routing and must not mount application `.env`, databases, or application secrets.

## Failure Containment Acceptance Criteria

The migration is complete only when all of these are demonstrated:

1. Recreate/deploy Catering application services: Zeiterfassung and EventOS stay publicly healthy and their container identities are unchanged.
2. Recreate/deploy Zeiterfassung: Catering and EventOS stay publicly healthy and their container identities are unchanged.
3. Recreate/deploy EventOS: Zeiterfassung and Catering stay publicly healthy and their container identities are unchanged.
4. Recreate/reload Edge: application containers, databases, and volumes are not recreated.
5. Stop one application upstream: other applications remain reachable through Edge.
6. Remove one app ingress network from Edge in a test/rehearsal environment: only that application's route fails.
7. Application private databases are not resolvable/reachable from Edge networks.
8. Base local Compose workflows continue to work without production-only external networks.
9. Every production deployment has an app-specific rollback point.
10. Cross-app smoke tests run after any Edge mutation.

## Immediate Release Constraint

Zeiterfassung `0.4.145` must not be deployed until the currently broken public Zeiterfassung route has been restored and Phase 1 is merged/deployed or an equivalent durable Edge isolation has been completed. The release itself remains separate from the infrastructure migration.

## Non-Goals

- Moving applications to separate physical servers immediately.
- Kubernetes or a new orchestrator.
- Sharing one large Docker network between all applications.
- Refactoring application business logic.
- Changing application databases as part of the isolation work.
