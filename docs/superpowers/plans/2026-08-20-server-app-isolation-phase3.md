# Server Isolation Phase 3: Catering-Owned Ingress and Private Networks

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to execute this plan task-by-task. Every implementation task starts with a failing regression contract, uses checkbox tracking, and stops on a failed gate.

**Goal:** Prepare one independently reviewable, workflow-dispatched Catering network-isolation pilot that adds owner-controlled ingress/private networks without changing Zeiterfassung, EventOS, Iranmonitor, Shared Edge runtime behavior, public ports, DNS, TLS, data, volumes, or secrets. The only Shared Edge change in scope is the explicitly authorized external `catering_ingress` membership, represented both by its versioned source override and by the additive live attachment.

**Architecture:** Phase 3.1 migrates Catering additively from the existing compatibility networks to `catering_ingress` and `catering_private`. Catering owns creation, labels, membership changes, rollback, and later lifecycle of those two networks; Shared Edge is only a separately locked consumer of `catering_ingress`. The old compatibility memberships remain available until every Catering-only gate is green and the owner-scoped detaches have each been independently evidenced.

**Tech Stack:** Docker Compose, Docker networks/DNS, Docker CLI inspection, Bash, GitHub Actions, Vitest contract tests, `curl`, and non-sensitive manifests.

**Spec:** `docs/superpowers/specs/2026-08-18-server-app-isolation-design.md`

## Global Constraints

- Authoritative repository baseline for this plan: `main` at `b3d7b4b528f4762e07198ef1305b9844a98b62f9`.
- The Phase-2 completion reference is `main` `b3d7b4b528f4762e07198ef1305b9844a98b62f9`, Evidence Run `32596742623`, plus the public cutover commit/run values already encoded by the executable post-cutover evidence contract (`6703d2aa9bb426c7f44d6601306dc623219741be` / `32417734936`). These are references, not a new deployment assertion.
- The plan is documentation only. Creating networks, running Compose, changing memberships, starting workflows, changing Caddy, switching ports/DNS/TLS, or deploying is deferred to a later execution turn after independent review, PR/Main-CI, and the separate Git completion. The complete Catering pilot, including its owner-scoped detaches, is already product-authorized; no second product authorization is required between its mechanical stages. The first production network mutation still requires the merged plan, implementation PR, terminal Exact-Head-CI, and independent review.
- Only Catering and the additive Shared Edge membership needed to expose Catering may be touched in Phase 3.1. The narrowly scoped, versioned Shared Edge Compose pilot override described in §2.3 is part of that source contract; it may express only the external `catering_ingress` consumer membership and must not alter runtime edge behavior. Zeiterfassung, EventOS, Iranmonitor, their owners, and their resources are read-only invariants.
- No database, volume, secret, image, release, application-source, schema, DNS, TLS/ACME, Caddy-route, hostname, or public-port change is allowed. The only permitted Edge source/runtime delta is the external `catering_ingress` membership described in §2.3; it must not change Edge behavior.
- Every mutation is owner-scoped, fail-closed, reversible, and followed by a complete foreign-invariant and all-host smoke check.
- A missing owner-authoritative external inventory, unknown resource, ambiguous alias, changed protected identity, unavailable command, or failed permission check stops before mutation.
- The later implementation must carry two versioned, tested repository templates: `platform-infra/docker-compose.phase3-catering-pilot.yml` and `edge-infra/docker-compose.phase3-catering-pilot.yml`. Their protected installed copies are exactly `/opt/catering-phase3/platform-compose.phase3.yml` and `/opt/catering-phase3/edge-compose.phase3.yml`; `/opt/catering-phase3/phase3.activation` is the only activation marker, and `/opt/catering-phase3/phase3.transaction-baseline.manifest` is the fixed canonical immutable transaction/baseline manifest for one pilot run. These four protected paths are outside every general rsync/delete/snapshot/restore tree. The source copies and marker are installed atomically under the lock contract; the baseline manifest is installed once, read back, hashed, and never overwritten. A separate non-sensitive Evidence-/Laufmanifest records progress and smokes without replacing the bound baseline. A runtime `docker network connect` never recreates or restarts Edge, while later normal callers consume their mode-appropriate file set or fail closed.
- The exact host locks are `/opt/catering-agents-platform.deploy-lock` followed by `/opt/shared-edge.deploy-lock`; release is reverse order. Workflow concurrency is supplementary and never replaces either host lock. Candidate and rollback states hold both locks across the complete marker/source/network transaction.
- The marker state machine is exact: absent or `inactive` means the stable current Phase-2 Shared-Edge cutover state; `candidate` means the pilot is running and every normal mutating deploy/recovery/cutover/rollback caller stops fail closed; `active` means Phase 3.1 is fully activated; `rolling_back` means restoration is running and every normal mutating caller stops fail closed. Only `active` may reach a terminal `PILOT: GO`, and only a verified restoration to the exact prior absent/inactive state may reach `PILOT: ROLLED BACK`.

---

## 1. Evidence-first inventory of the current contract

### 1.1 Authority and source boundary

The executable sources on the current `main` commit are the runtime authority. The Phase-2 prose plan can contain historical examples; it must not override executable Compose, Caddy, deploy, workflow, evidence, owner-authoritative external contracts, or a successful read-only runtime probe. In particular, the active upstreams are `http://web:8081`, `zeiterfassung-app-1:3040`, and `commcats-eventos-app:3045`; the historical `web:80` and `app:3040` examples are stale and must be rejected by an implementation test.

This repository has no Zeiterfassung or EventOS Compose/deploy/rollback source. Their complete owner inventories are therefore a hard preflight dependency for their future phases, not something this plan may infer from a container name. Until those owners provide an immutable source revision, exact project/file set, rendered Compose contract, service/alias matrix, lock, rollback point, and read-only live inventory, Phase 3.2 and 3.3 remain blocked.

### 1.2 Current Phase-2 topology proven by the Evidence Run

The Evidence Run `32596742623` is the baseline for the current deployed topology:

| Resource | Current membership/ownership | Phase-3.1 treatment |
| --- | --- | --- |
| Catering `web` | `platform-infra_default` + `zeiterfassung_default`; public 80/443 ownership is held by Shared Edge in the cutover state | Keep both old memberships during additive migration; add `catering_ingress` and `catering_private`; detach only Catering-owned memberships later, one at a time |
| Catering `postgres`, `intake`, `offer`, `production`, `exports` | `platform-infra_default` only | Add `catering_private` while retaining the old path; after private DNS/port/identity and complete smoke proof, detach only their own old membership one service at a time |
| Shared Edge `edge` | `platform-infra_default` + `zeiterfassung_default`; owns host ports 80/443 | Add `catering_ingress` as a consumer under the Shared Edge lock; retain both old networks because EventOS/Zeiterfassung still use them; never join `catering_private` |
| Zeiterfassung `zeiterfassung-app-1` | `zeiterfassung_default` | Read-only invariant; no connect, disconnect, restart, recreate, Compose, or port action in this pilot |
| EventOS `commcats-eventos-app` | `platform-infra_default` + `commcats-eventos_default` as evidenced by the Phase-2 contract | Read-only invariant; no connect, disconnect, restart, recreate, Compose, or port action in this pilot |
| Iranmonitor | `deploy_default` only | Read-only invariant; no connect, disconnect, restart, recreate, Compose, or port action in this pilot |

The baseline manifest must preserve the exact current IDs, statuses, `StartedAt`, `RestartCount`, images, Compose identities, network IDs, network members/aliases, host-port bindings, protected volume identities, secret names/IDs, release markers, Compose file hashes, and effective upstreams. No secret values or protected file contents may enter logs or evidence.

### 1.3 Foreign-app invariants

Before and after **every** pilot mutation (network creation/verification, each service membership connect or disconnect, Shared Edge attachment, each smoke stage, rollback, and final evidence), capture and compare for Zeiterfassung, EventOS, and Iranmonitor:

- full container ID;
- `RestartCount`;
- exact status and `StartedAt`;
- exact image and Compose project/service/container identity;
- exact network names, network IDs, and per-network aliases;
- exact host-port bindings, including host address and protocol.

Any difference, missing value, duplicate container, unknown member, or malformed binding is a fail-closed gate. ID/`RestartCount` alone is insufficient.

#### Iranmonitor allowlist

The only accepted Iranmonitor containers are:

| Container | Compose identity | Image | Network | Host ports |
| --- | --- | --- | --- | --- |
| `deploy-web-1` | project `deploy`, service `web` | `deploy-web` | `deploy_default` | `0.0.0.0:3000->3000/tcp` |
| `deploy-ingest-1` | project `deploy`, service `ingest` | `deploy-ingest` | `deploy_default` | none |
| `deploy-db-1` | project `deploy`, service `db` | `postgres:16-alpine` | `deploy_default` | `127.0.0.1:5432->5432/tcp` |

No additional `deploy`/Iranmonitor container is accepted. Iranmonitor must never appear on Catering, Zeiterfassung, EventOS, `catering_ingress`, `catering_private`, or any Shared Edge ingress/private network, and it is never mutated, recreated, restarted, or reconfigured by this pilot.

#### Static foreign-app allowlist from the executable Phase-2 evidence contract

The following identities are the complete read-only foreign-app allowlist for this pilot. The values below are the exact values emitted by Evidence Run `32596742623`; a live owner-authoritative mismatch is `NO-GO`, never an invitation to guess or broaden the allowlist. Before and after every mutation, the full ID, `RestartCount`, status, `StartedAt`, image, Compose identity, exact network IDs/memberships/aliases, and host-port bindings are compared, not only the fields abbreviated in this table.

| Container | Compose identity | Exact image | Networks and aliases | Host-port invariant |
| --- | --- | --- | --- | --- |
| `zeiterfassung-app-1` | project `zeiterfassung`, service `app` | `zeiterfassung-app:0.4.141-75d58ec8e817` | `zeiterfassung_default`: `app`, `zeiterfassung-app-1` | none; the public contract is through Shared Edge's `zeiterfassung-app-1:3040` upstream |
| `commcats-eventos-app` | project `commcats-eventos`, service `app` | `commcats-eventos-app` | `commcats-eventos_default`: `app`, `commcats-eventos-app`; `platform-infra_default`: `app`, `commcats-eventos-app` | none; no host binding for `3000/tcp`; the public contract is through Shared Edge's `commcats-eventos-app:3045` upstream |
| `commcats-eventos-postgres` | project `commcats-eventos`, service `postgres` | `commcats-eventos-postgres:17.10-hardened` | `commcats-eventos_default`: `postgres`, `commcats-eventos-postgres` | none; no host binding for `5432/tcp` |

The allowlist also requires the exact network IDs and member sets from the baseline manifest: `platform-infra_default` contains the EventOS app, all six Platform-Infrastructure services, and Shared Edge; `zeiterfassung_default` contains Zeiterfassung app, Catering web, and Shared Edge; `commcats-eventos_default` contains only EventOS app and EventOS Postgres. EventOS release marker, immutable app content digest, Compose working-directory identity, and the Zeiterfassung image/working-directory metadata remain unchanged. The Iranmonitor table above remains the complete `deploy` allowlist; no additional foreign container or network consumer is accepted.

### 1.4 Current executable source facts

- `platform-infra/docker-compose.yml` has services `postgres`, `intake`, `offer`, `production`, `exports`, and `web` on the implicit project network. `web` publishes development/default ports; the production edge-cutover override removes those bindings.
- `platform-infra/docker-compose.production.yml` adds only `web` to external `zeiterfassung_default`.
- `edge-infra/docker-compose.yml` is project `shared-edge`, owns 80/443, and currently consumes external `platform-infra_default` and `zeiterfassung_default`.
- In absent/`inactive` Phase-2 production, every productive Platform/Web recovery/rollback path uses exactly `platform-infra/docker-compose.yml` + `platform-infra/docker-compose.production.yml` + `platform-infra/docker-compose.edge-cutover.yml`; Base+Production without edge-cutover is never a production contract, and a productive `EDGE_EXTERNAL=false` path fails closed before mutation. In `active`, the protected `/opt/catering-phase3/platform-compose.phase3.yml` is the fourth file. `candidate` and `rolling_back` block normal mutating callers. The edge-cutover layer's removal of application host-port bindings remains mandatory; no path may return 80/443 to an App container.
- Edge file sets are mode-dependent: absent/`inactive` production uses Edge Base only; absent/`inactive` rehearsal uses Edge Base + `edge-infra/docker-compose.rehearsal.yml` with rehearsal last; `active` production/cutover-safe normal deploy uses Edge Base + protected `/opt/catering-phase3/edge-compose.phase3.yml`; `active` rehearsal uses Edge Base + protected Phase-3 override + rehearsal last. `candidate`/`rolling_back` block normal mutating Edge callers. Rollback restores the previous marker state and its mode-specific chain; rehearsal listener/volume behavior remains unchanged.
- The exact internal Catering listener is `web:8081`; internal service names remain `postgres:5432`, `intake:3101`, `offer:3102`, `production:3103`, and `exports:3104`.
- Existing deployment scripts use explicit project/file contracts in some paths but the full Catering deploy still uses `docker compose ... up --build -d`, which could recreate more than the owner-scoped pilot permits. The pilot must not reuse that broad mutation path; any later caller change is limited to the marker/lock/file-set guards.
- `edge-infra/scripts/cutover-hetzner.sh` is the already completed Phase-2 cutover caller, not a general Phase-3 recovery path. Once Shared Edge already owns 80/443 and the Phase-2 cutover evidence is present, it must stop before any mutation; it must also stop for `candidate`, `active`, or `rolling_back`. It may never restore direct Catering 80/443 ownership or mutate `.env`, sources, ports, containers, or rollback state before this guard.
- Existing `edge-infra/scripts/post-cutover-evidence.sh` and `.github/workflows/post-cutover-evidence.yml` remain a Phase-2 compatibility-network proof only. They must stop as `NOT_APPLICABLE_PHASE3` for `candidate`, `active`, or `rolling_back`; a separate Phase-3 Catering pilot helper/workflow/evidence contract is the only path allowed to evaluate the new topology or emit `PILOT: GO`.

---

## 2. Target topology and ownership

### 2.1 Catering networks

| Network | Owner/labels | Additive target members | Prohibited members |
| --- | --- | --- | --- |
| `catering_ingress` | Catering owner; exact stable name, driver/scope/internal parameters, and owner/phase labels recorded in the manifest | Catering `web`; Shared Edge as consumer only | Catering internal services, Zeiterfassung, EventOS, Iranmonitor, databases, workers, or unknown containers |
| `catering_private` | Catering owner; exact stable name, driver/scope/internal parameters, and owner/phase labels recorded in the manifest | `web`, `postgres`, `intake`, `offer`, `production`, `exports` | Shared Edge, Zeiterfassung, EventOS, Iranmonitor, and all unrelated containers |

The app owner creates or verifies these networks additively. An existing network with any mismatched name, owner/phase/kind label, driver, scope, `internal` setting, IPAM, option, or unexpected member fails closed. Shared Edge never creates, labels, removes, or owns either network.

#### Deterministic network ownership and member contract

Both networks use the following exact required labels; a missing or conflicting value is `NO-GO`:

| Network | `com.catering.owner` | `com.catering.phase` | `com.catering.kind` |
| --- | --- | --- | --- |
| `catering_ingress` | `catering-agents-platform` | `phase3.1` | `ingress` |
| `catering_private` | `catering-agents-platform` | `phase3.1` | `private` |

`catering_ingress` must be `driver=bridge`, `scope=local`, `internal=false`; `catering_private` must also be `driver=bridge`, `scope=local`, `internal=false`. Both use the engine-default IPAM with no user-defined subnet, gateway, IP-range, auxiliary addresses, IPv6 setting, or network options. Any unexpected custom IPAM/options or any conflicting owner/phase/kind label fails closed. The RED/GREEN contract must assert these exact rendered values and the Docker Compose/Engine inspection values rather than only checking names.

The name `catering_private` expresses exact owner-controlled membership, not Docker's `internal=true` flag. It is therefore deliberately `internal=false`: the five internal services have no published host ports and Shared Edge is never a member, but explicitly enabled professional-source/recipe search and later controlled provider access may still use outbound HTTPS. No proxy or invented egress gateway is introduced. The pilot must prove that every internal Catering service has an empty `HostConfig.PortBindings` set, that Shared Edge is absent from `catering_private`, that the member/alias allowlist is exact, and that the public Catering identity remains unchanged. A non-secret egress functional proof (for example, an allowlisted HTTPS metadata/status probe with no response body, credentials, or authorization headers) is required only when the existing production feature is actually enabled; a disabled feature is recorded as not exercised and does not force an external search during this network pilot. If an enabled egress path is unavailable after the staged changes, the pilot is `NO-GO`; it may not claim isolation success while breaking an activated source/provider path.

The exact allowed member/alias sets are stage-bound:

| Stage | `catering_ingress` | `catering_private` | Compatibility interpretation |
| --- | --- | --- | --- |
| Preflight before this run | absent, or pre-existing with the exact labels/parameters and no members | absent, or pre-existing with the exact labels/parameters and no members | Any non-empty or unexplained pre-existing network is `NO-GO`; record `absent`, `pre-existing`, or `created-by-run` provenance before proceeding |
| Additive | `platform-infra-web-1=web,platform-infra-web-1`; `shared-edge-edge-1=edge,shared-edge-edge-1` (or the exact current Edge container identity with only `edge` plus its container-name alias) | `platform-infra-web-1=web,platform-infra-web-1`; `platform-infra-postgres-1=postgres,platform-infra-postgres-1`; `platform-infra-intake-1=intake,platform-infra-intake-1`; `platform-infra-offer-1=offer,platform-infra-offer-1`; `platform-infra-production-1=production,platform-infra-production-1`; `platform-infra-exports-1=exports,platform-infra-exports-1` | Old compatibility members remain; any private resolution from Edge via `platform-infra_default` is recorded as a bounded non-GO exception |
| Each internal-service detach | Same exact two ingress members | Same exact six private members | Only the detached service's old `platform-infra_default` membership is removed; its private alias/port must fail from Edge over every still-attached Edge network |
| Final active state (terminal `PILOT: GO` only after active readback) | Same exact web + Edge members; Edge has no `web` alias | Same exact six Catering members | All five private services are unresolvable/unreachable from Edge; `web:8081` resolves only through ingress; old compatibility networks remain for foreign consumers |

Only the Catering owner may create these networks. If and only if a network was `created-by-run`, the Catering owner under the Catering lock may remove it during rollback after re-checking the exact full ID, required owner/phase/kind labels, driver/scope/internal/IPAM/options, emptiness, and absence of every foreign consumer. A pre-existing exact network remains in place on rollback. Shared Edge is a consumer only and may never create or remove either network.

### 2.2 Exact intermediate topology

The source contract and live connect/disconnect sequence must preserve this exact progression:

1. **Baseline:** `web` on `platform-infra_default` + `zeiterfassung_default`; the five internal services only on `platform-infra_default`; Shared Edge on both compatibility networks.
2. **Additive app stage:** `web` remains on both old networks and joins `catering_ingress` + `catering_private`; each internal service remains on `platform-infra_default` and joins `catering_private`; Shared Edge remains on both old networks and joins `catering_ingress`. No old membership is removed here.
3. **Private proof:** verify each internal service's exact private DNS name/port and identity from the Catering web/private path, verify `web:8081` from the edge through `catering_ingress`, and run all-host smokes/invariants. Record any private resolution from Edge over `platform-infra_default` as the bounded additive compatibility exception; it is not an isolation `GO` until the later owner-scoped detaches have blocked all five private services.
4. **Owner-scoped detaches:** after the complete proof and all technical gates are green, detach each internal Catering service from `platform-infra_default` individually; then detach Catering `web` from `zeiterfassung_default`; then detach Catering `web` from `platform-infra_default`. After each individual internal-service detach, prove that that service's exact alias and port are no longer resolvable or reachable from Shared Edge over every network still attached to Edge. The complete Catering pilot, including these detaches, is already product-authorized, so no new product-authorization pause is inserted between the mechanical stages; review/PR/Main-CI and execution gates still apply. After every single detach, repeat the complete foreign invariant and smoke suite. Do not remove a compatibility network.
5. **Pilot end state:** Catering `web` is only on `catering_ingress` + `catering_private`; the five internal services are only on `catering_private`; Shared Edge is on `catering_ingress` plus its old compatibility networks. The old networks remain because Zeiterfassung/EventOS still depend on them.

Expected aliases are the existing service identities: `web`, `postgres`, `intake`, `offer`, `production`, and `exports` on the Catering networks. No generic alias is permitted for an external app. Any alias not observed in the executable source and baseline manifest must be explicitly owner-approved and tested before use.

#### Canonical Catering Compose chain and final web override

The production source contract is state-dependent. In absent/`inactive` Phase-2 production it is exactly these three files, in this order:

```text
platform-infra/docker-compose.yml
platform-infra/docker-compose.production.yml
platform-infra/docker-compose.edge-cutover.yml
```

In `active` Phase 3.1 production it is exactly the same three files followed by the protected installed copy, never the repository template directly:

```text
platform-infra/docker-compose.yml
platform-infra/docker-compose.production.yml
platform-infra/docker-compose.edge-cutover.yml
/opt/catering-phase3/platform-compose.phase3.yml
```

The Phase-3 file must use a tested Compose `networks: !override` for `web`, replacing inherited networks rather than merging with them. Its rendered final network set must be exactly:

```text
web:         catering_ingress, catering_private
postgres:    catering_private
intake:      catering_private
offer:       catering_private
production:  catering_private
exports:     catering_private
```

No rendered Catering service may retain `platform-infra_default` or `zeiterfassung_default` at the active final state, and no later recreate may silently reattach either old network to `web`. The RED/GREEN contract must assert the inactive three-file Phase-2 chain and the active four-file Phase-3 chain separately, then run `docker compose ... config --format json` over each exact chain and assert the complete six-service matrix, with the edge-cutover removal of application host-port bindings still present. Unsupported `!override`, an omitted file, a different file order, an inherited old network, or any unexpected service/network/port is `NO-GO`. Docker Compose `!override` support must be version-gated at `>=2.24.4`.

The Phase-3 override must declare both `catering_ingress` and `catering_private` as `external: true` with their exact stable `name` values. Compose must consume, never implicitly create, delete, or rename these networks; the engine inspection is authoritative for driver, scope, `internal=false`, default IPAM, labels, IDs, and members. The rendered contract must reject a missing external declaration, a name mismatch, or any Compose behavior that would own the network lifecycle.

#### Durable Catering source contract

The repository Phase-3 override is a versioned inert template, not an active source by itself. Under both exact host locks, the Catering owner stages it as `/opt/catering-phase3/platform-compose.phase3.yml`, atomically installs it, verifies the expected SHA-256 and `cmp`, and records prior/new hashes, lock identities, destination, and rollback artifact in the separate Evidence-/Laufmanifest. The protected copy is outside all general Platform/Web rsync, snapshot, and restore trees; only the marker transaction may change it. Any failed hash, lock, source-chain, or protected-path check stops before live mutation.

Before activation and after rollback, every canonical production Platform/Web recovery/rollback path must consume the exact three-file Phase-2 chain above or fail closed. After activation, it must consume the exact four-file chain with the protected copy or fail closed. The pilot itself never runs `docker compose up`, broad recreate, restart, or an internal-service recreate: live owner-scoped connects/disconnects are used only for the approved staged migration. Rollback restores the protected copy's exact prior state/absence under `rolling_back`; a later normal recreate uses the mode-appropriate chain and therefore cannot reattach old networks to `web` or reclaim host ports.

### 2.3 Shared Edge boundary

Shared Edge may be connected to `catering_ingress` only as a separately locked consumer. The authorized Edge source override is the only Edge configuration delta; it expresses membership only. The pilot must not change Caddyfile text, upstream values, hostnames, DNS, TLS/ACME, image, public ports, container ID, `RestartCount`, or recreate/restart the edge. Its old `platform-infra_default` and `zeiterfassung_default` memberships remain for EventOS/Zeiterfassung.

#### Durable Edge source contract

The source of truth for this pilot is the versioned, reviewed `edge-infra/docker-compose.phase3-catering-pilot.yml`, installed only as `/opt/catering-phase3/edge-compose.phase3.yml` under the exact host locks. The mode contract is:

| Marker/mode | Exact Edge Compose files, in order | Mutation rule |
| --- | --- | --- |
| absent/`inactive`, production | `edge-infra/docker-compose.yml` | Phase-2 production; no rehearsal or Phase-3 override |
| absent/`inactive`, rehearsal | `edge-infra/docker-compose.yml` + `edge-infra/docker-compose.rehearsal.yml` | rehearsal last; preserve listener/volume behavior |
| `active`, production/cutover-safe normal deploy | `edge-infra/docker-compose.yml` + `/opt/catering-phase3/edge-compose.phase3.yml` | protected Phase-3 override last |
| `active`, rehearsal | `edge-infra/docker-compose.yml` + `/opt/catering-phase3/edge-compose.phase3.yml` + `edge-infra/docker-compose.rehearsal.yml` | rehearsal last; preserve listener/volume behavior |
| `candidate` or `rolling_back` | none | every normal mutating Edge caller fails closed |

The protected source must:

- use the explicit `shared-edge` project and declare only `catering_ingress` as `external: true` with its exact stable name;
- retain `platform-infra_default` and `zeiterfassung_default` during this Catering-only pilot and add only the Edge consumer membership on `catering_ingress`;
- never declare or attach `catering_private`, and never change Caddyfile/upstream text, hostnames, DNS, TLS/ACME, public ports, image, container identity, or restart behavior;
- be validated by the full Edge Compose/config contract before any live membership change;
- be synchronized/installed under both host locks in the fixed order atomically (staged file, exact hash/cmp verification, and a reversible prior-source snapshot), with source path, prior/new hashes, lock order, marker state, and rollback artifact recorded in the separate Evidence-/Laufmanifest;
- be applied as source only: the live `docker network connect` is additive and must not recreate or restart Edge, while a later normal Edge recreate/redeploy must read this exact artifact and restore the proven `catering_ingress` membership.

This source artifact and its owner-scoped install/rollback are future implementation scope for this pilot; they do not authorize a runtime action in this documentation turn.

#### Immutable transaction/baseline manifest contract

The canonical protected manifest path is fixed and never derived from input: `/opt/catering-phase3/phase3.transaction-baseline.manifest`. It is a non-secret, per-pilot-run transaction/baseline manifest, outside every Platform/Web/Edge `rsync --delete`, snapshot, and restore tree. The transaction identifier stored inside it is a unique data value, not a path component; it is accepted only when it matches `^[a-z0-9][a-z0-9-]{0,63}$` and is used only as a manifest value and exact owner/transaction label. No environment value, credential, secret, file content, mount content, or authorization material is stored.

The immutable manifest is a canonical, deterministically serialized record containing at least:

- the unique `transaction_id`, pilot scope/owner, schema, and the exact previous marker state (`absent` or `inactive`) plus its prior marker fields/hash;
- prior presence/absence and SHA-256 for both protected source copies, the exact owner-scoped rollback-artifact identifiers/paths and hashes, and explicit permission for which prior source state may be restored;
- pre-mutation presence/absence, full IDs, owner/phase/kind labels, driver/scope/internal/IPAM/options, and exact members/aliases for `catering_ingress` and `catering_private`, plus a `created_by_run_authorized` decision derived before the run (`true` only for an absent exact target, `false` for a pre-existing exact target). A network created by this run must additionally carry the exact `com.catering.transaction=<transaction_id>` label alongside the required owner/phase/kind labels;
- the complete foreign-app baseline for Zeiterfassung, EventOS, and Iranmonitor, including full container identity, `RestartCount`, status, `StartedAt`, image, Compose identity, network IDs/members/aliases, host-port bindings, protected volume identities, secret names/IDs, release markers, and effective upstreams.

The manifest is atomically installed under both host locks before any source or network mutation, fully read back byte-for-byte, and SHA-256 hashed from those exact bytes. The hash is the immutable identity of this manifest. After installation its content never changes for the duration of the pilot or any `active` state. Progress, mutation steps, smokes, mode, rendered Compose/config hashes, and other run evidence belong only in a separate non-secret Evidence-/Laufmanifest; they must never overwrite or be merged into the bound baseline.

Whether a network was `created-by-run` is derived only from this pre-bound baseline (`absent` plus `created_by_run_authorized=true`) and the live resource's exact owner/phase/kind/`com.catering.transaction` labels and full ID. A stale, unbound, or differently hashed manifest can never authorize network removal. Recovery after a process, SSH, workflow, or host interruption reads only the canonical manifest whose SHA-256 is bound by the marker; a missing file, hash mismatch, duplicate/unknown transaction context, or label mismatch is fail-closed and performs no mutation.

#### Atomic activation marker and caller contract

The durable activation state is one non-secret marker at the exact path `/opt/catering-phase3/phase3.activation`. The four protected paths are exactly:

```text
/opt/catering-phase3/platform-compose.phase3.yml
/opt/catering-phase3/edge-compose.phase3.yml
/opt/catering-phase3/phase3.activation
/opt/catering-phase3/phase3.transaction-baseline.manifest
```

The directory is outside every general Platform/Web/Edge `rsync --delete`, snapshot, and restore tree, owned by the existing deployment role with restrictive permissions, and covered by the immutable baseline contract. Repository templates in `main` are inert and never activate Phase 3 by themselves. The source copies and marker may be changed only by the lock-scoped transaction; the baseline manifest is installed once and never overwritten. After a successful rollback, its proof may be archived into the separate Evidence manifest only after complete restore/invariants/smokes, and the canonical baseline path is then removed before the old `absent`/`inactive` state is restored. If rollback fails, the bound baseline remains at the canonical path.

The marker state machine is exact:

| State | Meaning and permitted callers |
| --- | --- |
| absent or `inactive` | Stable current Phase-2 Shared-Edge cutover state. The canonical baseline manifest and its transaction hash are absent. Normal production callers use the complete three-file Platform Phase-2 chain and mode-appropriate Edge Base/Rehearsal chain; no caller may interpret this as pre-cutover or use Base+Production without edge-cutover. |
| `candidate` | Pilot is running under both host locks and is bound to the canonical baseline manifest by `transaction_manifest_sha256`. Every normal mutating Platform, Web-recovery, Edge, cutover, rollback, and deploy caller stops fail closed. Only the pilot helper may continue its staged transaction. |
| `active` | Phase 3.1 is fully activated; the protected source copies, network IDs, and canonical baseline manifest all match the marker's exact hashes. Normal callers may use the mode-dependent Phase-3 chains below after their own pre-mutation validation. |
| `rolling_back` | Restoration is running under both host locks and preserves the same bound baseline hash. Every normal mutating caller stops fail closed until the exact prior absent/`inactive` state has been restored and read back. |

Absent and `inactive` are semantically identical for the current Phase-2 production state. They are not a permission to run a direct pre-cutover chain. A staged baseline file may exist transiently before the candidate marker is committed while both locks are held; that is not a valid stable `inactive` state, and an interruption there is fail-closed with no mutation because no marker-bound hash exists yet.

For `candidate`, `active`, and `rolling_back`, the marker is one atomically written, newline-delimited record with exactly these fields:

```text
schema=phase3.1
state=candidate|active|rolling_back
owner=catering-agents-platform
platform_override_sha256=<exact installed Platform override hash>
edge_override_sha256=<exact installed Edge override hash>
catering_ingress_id=<full engine network ID>
catering_private_id=<full engine network ID>
transaction_manifest_sha256=<exact 64-hex SHA-256 of the canonical baseline manifest>
```

For `inactive`, the exact record is `schema=phase3.1`, `state=inactive`, `owner=catering-agents-platform`, both source hashes `absent`, both network IDs `absent`, and `transaction_manifest_sha256=absent`; the record may instead be absent. No other fields are valid. Candidate resource IDs are `absent` only in the first candidate readback when the corresponding network was proven absent; after that network is created/verified, the candidate marker is atomically rewritten with its full ID before any subsequent mutation. `active` requires full 64-hex source hashes, network IDs, and `transaction_manifest_sha256`. In `rolling_back`, every source/network resource field may be `absent` or the full confirmed hash/ID from the last confirmed pilot state, but `transaction_manifest_sha256` remains the same full 64-hex value until rollback completes; these values are immutable rollback provenance, not a claim that a resource remains live until rollback ends. Container IDs are never configuration generations. Mode and rendered-config hashes remain separate Evidence-/Laufmanifest fields and are never marker fields.

The marker contains no secret, environment value, authorization material, or file content. Every normal mutating caller validates the marker ↔ canonical baseline manifest ↔ exact SHA-256 ↔ transaction/owner-label context before mutation. For `candidate` and `active`, any unknown state/field, duplicate field, malformed value, missing manifest, hash mismatch, transaction-context mismatch, missing protected source, source hash mismatch, network-ID mismatch, or absent required manifest proof is `NO-GO` before any stop, recreate, sync, connect, or disconnect mutation; the source/network values must match the applicable live resources. For `rolling_back`, syntax, the immutable marker hash, transaction context, and baseline/rollback evidence remain strict, but current-live equality is deliberately not required while resources are being restored or removed. All normal mutating callers remain blocked solely by `state=candidate` or `state=rolling_back`; only the pilot helper may continue a manifest-checked transaction. A `candidate` marker is never a terminal GO; only successful active readback may precede `PILOT: GO`.

All Phase-3 activation, source synchronization, membership mutation, and rollback acquire `/opt/catering-agents-platform.deploy-lock` first and `/opt/shared-edge.deploy-lock` second, hold both across the complete baseline/source/marker/network transaction, and release in reverse order. Workflow concurrency is supplementary and cannot replace either host lock. The atomic sequence is fixed: (a) acquire both locks; (b) capture the complete baseline; (c) atomically install the immutable canonical baseline manifest, fully read it back, and hash it; (d) atomically install/read back the two inert protected sources and verify exact hashes/cmp; (e) atomically write `candidate` with the exact `transaction_manifest_sha256` and fully read it back; (f) only then perform the first network mutation; (g) complete the runtime migration and all separate Evidence-/Laufmanifest records as a non-terminal `PILOT: GO CANDIDATE`; (h) atomically write `active` with the same manifest hash, full source hashes, and network IDs and fully read it back; (i) run final invariants and smokes; (j) only then emit terminal `PILOT: GO`. No text or helper branch may emit terminal GO before successful active readback.

Rollback uses exactly the marker-hash-bound canonical baseline manifest. Its fixed sequence is: (a) under both locks, atomically write/read `rolling_back` while preserving the same `transaction_manifest_sha256`; (b) validate the canonical manifest and restore the exact prior protected source presence/hashes and owner-scoped rollback artifacts; (c) additively restore every exact old Catering/Edge compatibility membership and alias; (d) run all foreign invariants and smokes; (e) remove new pilot memberships one at a time and only networks whose `created-by-run` authorization is proven by the immutable baseline plus exact owner/transaction labels; (f) rerun invariants, smokes, source checks, and manifest/provenance checks without requiring removed resources to remain live; (g) only after complete restore/invariants/smokes archive the immutable manifest proof as separate Evidence; (h) remove the canonical baseline manifest and atomically restore/read the exact prior absent/`inactive` marker; (i) only then emit terminal `PILOT: ROLLED BACK`. There is no transition directly from `active` to `inactive` at rollback start. Any process/SSH/workflow/host interruption or other failure leaves `rolling_back` and the bound canonical manifest in place, normal callers blocked, and terminal outcome `PILOT: NO-GO`.

General Platform/Web/Edge rsync, snapshot, and restore paths must exclude `/opt/catering-phase3` mechanically and must not copy, delete, or overwrite any protected path. Every normal mutating caller validates the marker, canonical manifest, exact manifest hash/transaction context, lock order, mode-specific file chain, source hashes, network IDs, and rendered-config evidence before mutation: active plus missing/hash-false sources or manifest is `NO-GO`; inactive/absent plus templates and no baseline manifest is Phase-2-safe; candidate/rolling_back is always blocked. The pilot helper's `rolling_back` path instead validates the same immutable manifest proof while resources are restored or removed.

The separate non-secret Evidence-/Laufmanifest records marker state/path, prior and new marker hashes, the immutable baseline manifest hash/path, both protected source hashes/paths, network IDs/members, provenance, rendered Compose/config hashes, mode, lock order, smokes, and rollback artifacts without secrets, environment values, credentials, or protected file/mount contents. It is append-only run evidence and never replaces the canonical baseline.

#### Canonical recreate, recovery, and rollback callers

The current executable callers that must be brought under this same file-chain/activation/lock contract in the later implementation are explicitly:

- `platform-infra/scripts/deploy-hetzner.sh` (Platform deploy/recreate and its rollback snapshot);
- `platform-infra/scripts/deploy-web-listener-hetzner.sh` (Catering web listener recovery and `rollback_web`);
- `edge-infra/scripts/deploy-hetzner.sh` (Shared Edge deploy/recreate, rehearsal/cutover mode, and `rollback_edge_candidate`);
- `edge-infra/scripts/cutover-hetzner.sh` (the existing cutover orchestration, its two deploy invocations, and `rollback_cutover`).

Their current workflow callers are `.github/workflows/deploy-production.yml`, `.github/workflows/deploy-catering-web-listener.yml`, `.github/workflows/deploy-edge-production.yml`, and `.github/workflows/cutover-edge-production.yml`; the read-only `.github/workflows/post-cutover-evidence.yml` must validate the same non-sensitive activation/source manifest without mutating it. Existing contract tests covering these callers include `tests/platform-infra-deploy-contract.test.ts`, `tests/platform-infra-production-isolation.test.ts`, `tests/platform-infra-edge-cutover-contract.test.ts`, `tests/catering-web-listener-deploy-contract.test.ts`, `tests/edge-deploy-contract.test.ts`, `tests/edge-infra-contract.test.ts`, `tests/shared-edge-cutover-orchestrator-contract.test.ts`, `tests/edge-workflow-contract.test.ts`, `tests/hetzner-deploy-hardening.test.ts`, and `tests/hetzner-deploy-manifest-permission.test.ts`; the exact current set must be confirmed by the implementation RED contract rather than guessed.

Before the marker is active, after rollback, or when the marker is absent/inactive, Platform/Web callers must use exactly `docker-compose.yml` + `docker-compose.production.yml` + `docker-compose.edge-cutover.yml`; no Base+Production-only production path and no `EDGE_EXTERNAL=false` production path may mutate. Active Platform callers add only the protected `/opt/catering-phase3/platform-compose.phase3.yml`. Edge callers use the exact mode table above. `candidate` and `rolling_back` block all normal mutating callers. The later implementation may change only these callers/workflows/tests to add exact marker validation, the exact lock order, explicit mode/file lists, and fail-closed guards; it may not change application logic, images, Caddy/upstreams, DNS, TLS, ports, or foreign-app sources. No caller may issue a broad `compose up`, unscoped restart, source sync, or `.env`/protected-file mutation before the pre-mutation marker, hash, lock, and rendered-config checks pass.

`deploy-edge-production.yml` must not install or alter `.env` or any protected server file before the marker/state and both host-lock checks. It may stage non-secret material outside the destination only; the locked Edge caller performs installation after state/hash gates. For `candidate` or `rolling_back`, it performs no mutation. `edge-infra/scripts/cutover-hetzner.sh` is historical and one-shot: it must first acquire/validate the exact state/lock contract and then fail closed for `candidate`, `active`, and `rolling_back`; in the already completed Phase-2 state where Shared Edge owns 80/443 it also fails closed before any mutation. Its workflow must not allow it to change `.env`, sources, ports, containers, or rollback state, and it is never expanded into a Phase-3 recovery path.

Shared Edge must never join `catering_private`, and it must never gain new private access through `catering_ingress`. During the baseline and additive stages, private aliases may remain resolvable over the documented `platform-infra_default` compatibility path because Edge and the five internal Catering services still share that old network. That is a bounded compatibility exception: it must not grow, must be measured in the manifest, and is explicitly **not** an isolation `GO`. After each internal-service detach, that detached service's exact alias and port must be unresolvable and unreachable from Edge over every network still attached to Edge. Before `PILOT: GO`, all five private services must be neither resolvable nor reachable from Edge, while `web:8081` must resolve and be reachable only through `catering_ingress`.

On `catering_ingress`, only Catering `web` receives the alias `web`. Shared Edge is represented exclusively by `edge` and `shared-edge-edge-1` (or the exact existing Edge container-name alias captured in the baseline), never by `web`. Caddy continues to consume the unchanged `http://web:8081` upstream. The contract must reject duplicate `web` aliases, a `web` alias on Edge, or a DNS/self-resolution result that targets Edge instead of Catering web.

---

## 3. Non-negotiable execution gates

1. **Read-only preflight:** capture exact deployed/main and Phase-2-GO references, explicit Compose projects/file sets, service/container metadata, all foreign invariants, network IDs/members/aliases, volume IDs, secret names/IDs, release markers, host ports, upstreams, locks, rollback archives, and non-sensitive manifest paths.
2. **TDD first:** add a failing contract before any workflow/helper/Compose implementation. The RED test must exercise the real helper/fake-remote path and fail on missing Phase-3 surfaces, unsupported commands, unknown networks, label collisions, foreign drift, private edge reachability, or smoke identity mismatch. Then implement the smallest green path.
3. **Explicit project/file set:** absent/`inactive` Platform production and Web recovery/rollback use exactly `-p platform-infra -f docker-compose.yml -f docker-compose.production.yml -f docker-compose.edge-cutover.yml`; active Platform callers append only `-f /opt/catering-phase3/platform-compose.phase3.yml`. Absent/`inactive` Edge production uses `-p shared-edge -f docker-compose.yml`; absent/`inactive` rehearsal appends `-f docker-compose.rehearsal.yml`; active production appends only `-f /opt/catering-phase3/edge-compose.phase3.yml`; active rehearsal appends the protected override and then rehearsal last. Candidate/rolling_back callers mutate nothing. A missing mode-appropriate file, wrong order, Base+Production-only production path, or productive `EDGE_EXTERNAL=false` path is `NO-GO`. The pilot helper itself may not invoke implicit projects, broad `up`, `down`, prune, unscoped restart, `rm`, or compatibility-network deletion; an existing canonical caller may mutate only after the marker/file/lock guards and only within its reviewed owner scope.
4. **Compose merge contract:** before activation, assert Docker Compose `>=2.24.4` and successful `!override` parsing/rendering; the RED/GREEN contract must inspect the final JSON network matrix for all six Catering services and prove that `web` has exactly `catering_ingress` + `catering_private` and no old network. Unsupported Compose or a different rendered set is `NO-GO`.
4a. **External network and egress contract:** the Platform and Edge overrides must declare the exact networks as `external: true`; engine state, not Compose defaults, proves `driver=bridge`, `scope=local`, `internal=false`, default IPAM, labels, IDs, and members. The contract proves no internal Catering service has a host-port binding, Shared Edge is absent from `catering_private`, and only the stage-allowed Catering members exist. Because `catering_private` is a membership boundary rather than Docker `internal=true`, an explicitly enabled professional-source/recipe/provider HTTPS path must pass a non-secret functional metadata/status check; if the feature is disabled, record it as not exercised. No external search is forced by the pilot, but an enabled path that breaks is `NO-GO`.
4b. **Activation and caller contract:** before any mutation, every normal Platform, web-listener, Edge, cutover, recovery, rollback, and relevant evidence caller validates the exact marker state, the canonical `/opt/catering-phase3/phase3.transaction-baseline.manifest`, its exact `transaction_manifest_sha256`, the transaction/owner-label context, the two host locks in order `/opt/catering-agents-platform.deploy-lock` then `/opt/shared-edge.deploy-lock`, both protected source hashes, both network IDs, and the mode-specific file set/rendered-config evidence separately. Absent/`inactive` is the stable Phase-2 state and requires no baseline manifest; `candidate`/`rolling_back` is fail-closed for those normal callers; active with missing/hash-false sources or manifest is `NO-GO`. The marker becomes `candidate` before the first network mutation and `active` only after the non-terminal GO candidate; rollback starts from the marker-hash-bound canonical baseline in `rolling_back` and restores the exact prior absent/`inactive` state only at the end. Protected files are outside and excluded from `rsync --delete`; no caller may stop/recreate/sync or mutate `.env` before these checks. The pilot helper alone may continue a `rolling_back` transaction under the same immutable manifest/provenance checks.
5. **Owner-only network lifecycle:** Catering alone may create/label its two networks and change Catering memberships. Shared Edge can only connect/disconnect its own edge membership under its own lock; Edge never creates or removes Catering networks.
6. **Network provenance and rollback ownership:** before each network create/verify, record `absent`, `pre-existing-exact`, or `created-by-run` plus full ID, required labels, parameters, and members. A pre-existing exact network remains on rollback. Only the Catering owner under the Catering lock may remove a `created-by-run` network, and only after exact ID/owner/phase/kind/parameter checks, emptiness, and absence of foreign consumers; no pre-existing or foreign network may be removed.
7. **Additive before removal:** create/verify both new networks and add every required membership while all old memberships remain. Detach only one owner-scoped membership at a time after the full proof.
8. **Fail closed:** reject absent/malformed IDs, collisions, unexpected labels or members, stale upstreams, duplicate aliases, `web` on Edge, Edge on `catering_private`, internal services on `catering_ingress`, any new private reachability through `catering_ingress`, changed protected state, unavailable SSH/Docker commands, or any foreign invariant delta. Existing private resolution through `platform-infra_default` is allowed only in the explicitly recorded baseline/additive compatibility stage and cannot satisfy the isolation gate.
9. **Foreign invariants:** compare full ID, `RestartCount`, status, `StartedAt`, image, Compose identity, networks/IDs/aliases, and host ports for Zeiterfassung, EventOS, and Iranmonitor before and after every mutation. Also preserve Shared Edge's ID/`RestartCount` and 80/443 ownership.
10. **All-host smokes after every mutation:** Zeiterfassung `/healthz`, `/readyz`, `/api/public/config` with semantic identity; EventOS public identity; Catering authenticated intake health (`service=intake-service,status=ok`) plus existing UI/API/health/TLS checks. No `-k` or insecure TLS. Also prove the exact public Catering identity, internal services' absence of host ports, Shared Edge's absence from `catering_private`, and the conditional enabled-egress probe from §2.1.
11. **Protected state:** database/Caddy volumes, secret names/IDs, release metadata, Caddy/upstream text, DNS, TLS, image, and public port bindings stay unchanged. The edge-cutover removal of application host-port bindings remains required in every rendered Catering file chain. `/opt/catering-phase3/platform-compose.phase3.yml`, `/opt/catering-phase3/edge-compose.phase3.yml`, `/opt/catering-phase3/phase3.activation`, and `/opt/catering-phase3/phase3.transaction-baseline.manifest` are protected from every general rsync/snapshot/restore path. The baseline manifest is installed once and never overwritten; only the locked transaction may install/remove it at the controlled start/end boundaries described above, and only a separate Evidence archive may retain its proof.
12. **Safe rollback order:** under both exact host locks, validate the marker-bound canonical baseline and write/read `rolling_back` with the same `transaction_manifest_sha256`; restore and hash/cmp-verify prior protected sources/absence and owner-scoped rollback artifacts; restore old Catering/Edge compatibility memberships and aliases; run invariants/smokes; remove new pilot memberships one by one and only eligible run-created empty networks proven by the immutable baseline plus exact owner/transaction labels; rerun invariants/smokes/source/manifest checks; only after complete restore archive the immutable manifest proof into separate Evidence, remove the canonical baseline, and restore/read the exact prior absent/`inactive` marker; only then emit `PILOT: ROLLED BACK`. Any failure leaves `rolling_back` and the bound baseline, blocks normal callers, and emits `PILOT: NO-GO`. Existing networks remain, and Edge is not unnecessarily interrupted.
13. **Evidence:** emit only non-sensitive Phase-3 Evidence-/Laufmanifests from the separate pilot helper. They record marker state/path and hashes, the canonical baseline path/hash, protected source hashes/paths, network IDs/members/provenance, rendered Compose/config hashes, mode, upstreams, smokes, rollback point, lock order, and exact mutation steps without secrets, environment values, credentials, or file/mount contents. The immutable baseline is not a progress manifest and is never overwritten. The existing Phase-2 evidence helper never evaluates these states. Terminal Phase-3 statuses are exactly `PILOT: GO`, `PILOT: ROLLED BACK`, or `PILOT: NO-GO`; `PILOT: GO CANDIDATE` is non-terminal and may never be reported as GO.
14. **Stage-specific isolation:** baseline/additive compatibility resolution over `platform-infra_default` is recorded as an allowed, non-growing exception and never as an isolation `GO`; after each internal detach the exact detached alias/port must fail from Edge across all Edge networks; only the final state with all five private services blocked and `web:8081` reachable solely through `catering_ingress` can emit `PILOT: GO`.
15. **Phase-2/Phase-3 evidence separation:** `.github/workflows/post-cutover-evidence.yml` and `edge-infra/scripts/post-cutover-evidence.sh` remain exclusively the Phase-2 compatibility proof. They stop as `NOT_APPLICABLE_PHASE3` for `candidate`, `active`, or `rolling_back` and never reinterpret old network assumptions as Phase-3 truth. Only the separate Catering pilot workflow/helper/evidence contract can evaluate the new model or emit terminal `PILOT: GO`.

---

## 4. Ordered implementation sequence

### Phase 3.0 — Workflow and RED contract

- [ ] Confirm the current `main` SHA and the Phase-2-GO evidence reference before implementation. Do not treat the checked-out source SHA as proof that the remote deployment already runs it.
- [ ] Add a manual `workflow_dispatch` workflow bound to `environment: production`, `contents: read`, an explicit main-branch guard, and the existing SSH/known-host/secret roles. The workflow must never print secret values, must not mutate `.env` or protected server files before the helper's two host locks/state gates, and must invoke exactly one owner-scoped pilot helper. Workflow concurrency is not a substitute for `/opt/catering-agents-platform.deploy-lock` plus `/opt/shared-edge.deploy-lock`.
- [ ] Add the versioned `platform-infra/docker-compose.phase3-catering-pilot.yml` and `edge-infra/docker-compose.phase3-catering-pilot.yml` source overrides before live work. The Catering override must use `networks: !override` for `web`; the Edge override is limited to external `catering_ingress` plus retained old compatibility networks. Validate both rendered file/hash contracts and define atomic owner-/lock-scoped source install and rollback before any runtime membership connect.
- [ ] Add the non-secret `/opt/catering-phase3/phase3.activation` marker contract, the exact protected source copies, and the fixed canonical `/opt/catering-phase3/phase3.transaction-baseline.manifest`. The RED/GREEN test must prove absent/inactive has no bound manifest, candidate/active/rolling_back require the exact manifest hash, candidate/rolling_back block normal mutators, active binds exact source hashes/network IDs/manifest hash, baseline/source installation is staged and atomic before the first network mutation, `rsync --delete` cannot remove any protected path, and rollback restores the exact prior marker/source state only after the immutable manifest proof is archived. Inject failures before the first network creation, between the first and second network creations, and after both creations, plus the exact pre-existing-resource case; assert candidate progress, rolling_back provenance, manifest/hash mismatch fail-closed behavior, and that pre-existing networks remain untouched.
- [ ] Add the failing contract test before adding the helper or either Compose override. It must require Compose `>=2.24.4`/`!override` support, the inactive three-file and active four-file Platform chains, all mode-dependent Edge chains, final six-service network matrix, explicit `external: true` declarations, `catering_private` `internal=false`, compatibility retention, deterministic network labels/parameters, foreign-app allowlists, alias separation, conditional enabled-egress proof, source persistence/rollback, network provenance/removal ownership, exact host-lock order, canonical caller/workflow state/file-set guards, historical cutover stop, safe terminal statuses, rollback order, Phase-2/Phase-3 evidence separation, all-host smoke stages, no destructive commands, and the hard stop before Phase 3.2.
- [ ] Run the RED test without invoking Docker, SSH, Compose, workflow dispatch, or production.
- [ ] Add contract coverage that `edge-infra/scripts/cutover-hetzner.sh` is historical and one-shot: it fails closed before any mutation when Shared Edge already owns 80/443 or when the marker is `candidate`, `active`, or `rolling_back`, and it can never restore direct Catering 80/443 ownership. Cover the workflow guard and prove no `.env`, source, port, container, or rollback mutation precedes the stop.

### Phase 3.1 — Catering-only pilot helper

- [ ] Implement a read-only baseline snapshot and validation of the exact current topology, all three foreign-app allowlists (including the three exact Iranmonitor containers), the Catering service identities, volumes, secret names, release metadata, Shared Edge identity, 80/443 ownership, locks, and rollback points.
- [ ] Validate/create `catering_ingress` and `catering_private` only through the Catering owner contract. Record each network as absent, pre-existing-exact, or created-by-run; reject collisions and unexpected consumers; retain stable IDs and exact labels/parameters.
- [ ] Validate both the inactive three-file and active four-file `platform-infra` Compose chains without starting them. Confirm Compose `>=2.24.4`, render JSON, and prove the `!override` final six-service network matrix, explicit external networks, and retained edge-cutover port removal. Use live `docker network connect --alias` operations for additive membership, not broad Compose `up`, `--build`, recreate, restart, or internal-service mutation.
- [ ] Acquire both exact host locks in fixed order, capture the baseline, atomically install/read back/hash the immutable canonical manifest, atomically install/hash-check the two inert protected source copies, write/read `candidate` with `transaction_manifest_sha256` before the first network mutation, and validate the mode-specific complete file sets separately from the marker. Every later canonical recreate/deploy/recovery/rollback path must validate marker ↔ manifest ↔ hash and consume its state-appropriate file set or fail closed; source/manifest installation itself must not recreate or restart any container.
- [ ] Add the five internal services to `catering_private`, add only `web` as `web` on `catering_ingress`, and add Shared Edge with only `edge` plus its container-name alias under the separate lock. After each individual operation, capture full foreign invariants, private/ingress DNS and port identity, and all-host smokes; reject duplicate `web` aliases or DNS self-targets.
- [ ] Detach the old Catering memberships only in the exact sequence from §2.2, one command per stage, after every gate is green. For each internal detach, test that its exact alias/port is no longer resolvable/reachable from Edge over all attached Edge networks; treat the baseline/additive `platform-infra_default` exception as non-GO until all five are blocked. Preserve both compatibility networks and stop after the Catering end state.
- [ ] If the existing production source/provider feature is enabled, execute its allowlisted non-secret HTTPS metadata/status proof after each relevant stage; if disabled, record not exercised and do not force external search. A failed enabled path is `NO-GO`. Prove all five internal services have no host ports and that only the exact allowed members are present on `catering_private` (`internal=false`).
- [ ] After all pilot gates, smokes, foreign invariants, isolation proofs, source persistence/recreate checks, and separate Evidence-/Laufmanifest records are green, write/read `active` binding both override hashes, full network IDs, and the same exact `transaction_manifest_sha256`, then rerun final invariants/smokes and only then emit terminal `PILOT: GO`. Until successful active readback, only `PILOT: GO CANDIDATE` is permitted; on failure, transition to `rolling_back`, never directly to inactive.
- [ ] On any failure, validate the marker-bound canonical baseline, write/read `rolling_back` preserving its exact hash, restore both prior protected source artifacts/absence and owner-scoped rollback artifacts, additively re-establish every exact old Catering/Edge membership and alias, pass invariants/smokes, remove new memberships one at a time, and remove only networks whose `created-by-run` authorization is proven by the immutable baseline plus exact owner/transaction labels, emptiness, and no-foreign-consumer checks. Archive the manifest proof only after complete restore, then remove the canonical baseline and restore/read the exact prior absent/`inactive` marker only at the end. Pre-existing networks remain. Emit `PILOT: ROLLED BACK` only after that final readback; any failure leaves `rolling_back` and the bound manifest and emits `PILOT: NO-GO`.
- [ ] Keep the existing post-cutover evidence helper/workflow Phase-2-only. Add a separate Phase-3 pilot helper/workflow/evidence contract for the new topology; it alone may emit `PILOT: GO`, while the Phase-2 helper reports `NOT_APPLICABLE_PHASE3` for all non-Phase-2 marker states.

### Hard pilot exit before Phase 3.2

- [ ] After successful Catering migration, complete the separate non-sensitive Evidence-/Laufmanifest, independent review, workflow CI, and operational acceptance; do not rewrite the immutable baseline manifest.
- [ ] Stop before any Zeiterfassung, EventOS, or Iranmonitor network/Compose/port/restart action. Phase 3.2 is a new risk gate requiring owner-authoritative external inventories and a separate reviewed implementation; the Catering pilot does not authorize it.

### Phase 3.2 and 3.3 — Not part of this pilot

- [ ] Do not implement or execute Zeiterfassung or EventOS migration in this Catering pilot. Their six-network target and owner contracts remain future work.
- [ ] Do not mutate Iranmonitor under any Phase-3 stage.
- [ ] Preserve the hard owner-authoritative gate for any future Phase 3.2/3.3 turn: before a foreign-app mutation, its owner must provide an immutable repository/source revision, exact Compose project and file set, rendered service/network/alias/port matrix, private-only service classification, volume and secret identity names/IDs, deploy lock, rollback point, and a reconciled read-only live manifest. The edge consumer contract must match that owner evidence exactly; missing, stale, contradictory, or unreviewed evidence is `NO-GO`.
- [ ] Treat each future foreign-app phase as a new TDD + independent review + PR/Main-CI + execution-gate decision. This plan preserves the gate but authorizes no Zeiterfassung, EventOS, or Iranmonitor migration and invents no external service identity.

### Phase 3.4 — Future compatibility cleanup

- [ ] Do not remove `platform-infra_default` or `zeiterfassung_default` in this pilot. Any later Shared Edge cleanup is a separate edge-only risk gate requiring zero-consumer evidence, retained rollback, and independent approval.

---

## 5. Verification commands for the eventual implementation

Run these serially in the later implementation/approval turn; do not execute them as part of this documentation correction:

1. Focused RED/GREEN contract tests, then the existing Edge/Platform/Evidence contract groups.
2. Render the inactive/Phase-2 Platform chain (`docker-compose.yml`, `docker-compose.production.yml`, `docker-compose.edge-cutover.yml`) and the active chain with `/opt/catering-phase3/platform-compose.phase3.yml` separately using non-secret values; assert the six-service network/port matrix, explicit external network declarations, `catering_private` `internal=false`, and never use `up` for the pilot membership migration.
3. Render each mode-specific Edge chain separately: Base; Base + `docker-compose.rehearsal.yml`; Base + protected Phase-3 copy; Base + protected Phase-3 copy + rehearsal last. Validate Caddy through the existing edge service environment without changing Caddy text; assert external `catering_ingress`, retained old networks, no private network, unchanged `http://web:8081`, and preserved rehearsal listener/volume behavior.
4. Read-only Docker inspections for all IDs, status, `StartedAt`, `RestartCount`, images, Compose labels, network IDs/members/aliases, ports, volumes, secret names/IDs, release markers, exact host locks, marker state, protected source hashes, and rendered-config hashes before/after each stage.
5. Owner-scoped `docker network connect`/`disconnect` checks with strict command allowlists and exact alias mapping.
6. Full all-host smokes after every single mutation and after rollback. Record the stage: in baseline/additive mode, private-service resolution over `platform-infra_default` is the bounded compatibility exception and is not an isolation `GO`; after each internal detach, the exact detached service alias/port must fail from Edge across all Edge networks; at final GO, all five private services must fail from Edge and only `web:8081` may resolve/reach through `catering_ingress`. When an existing source/provider feature is enabled, add the allowlisted non-secret HTTPS metadata/status proof; otherwise record it not exercised.
7. Read and validate `/opt/catering-phase3/phase3.activation` and the fixed canonical `/opt/catering-phase3/phase3.transaction-baseline.manifest` under `/opt/catering-agents-platform.deploy-lock` then `/opt/shared-edge.deploy-lock` before every mutation and after rollback. Verify the marker's exact state/fields, `transaction_manifest_sha256`, byte-for-byte manifest readback/hash, strict transaction/owner-label context, source hashes, and applicable network IDs; validate mode and rendered-config hash separately from the execution context and Evidence-/Laufmanifest because they are not marker fields. Test candidate/rolling_back blocking for normal callers, process/SSH/workflow/host interruption and missing/mismatched-manifest fail-closed behavior without mutation, rolling_back provenance/manifest validation without a live-resource requirement, active hash/source failures, exact final active readback, and inactive templates with an absent baseline manifest not activating Phase 3.
8. Run the existing Phase-2 evidence contract only against absent/`inactive` and assert `NOT_APPLICABLE_PHASE3` for candidate/active/rolling_back; run the separate Phase-3 evidence contract for pilot states.
9. `bash -n`, ShellCheck, TypeScript/test/build gates as applicable, and `git diff --check` with a changed-path allowlist.

Any unavailable command, missing owner source, unknown resource, unexpected member, foreign ID/restart/port/network drift, private edge reachability, or smoke mismatch stops the run and leaves the old path intact.

---

## 6. Scope, non-goals, and open risks

### Documentation scope for this plan correction

This documentation turn changes exactly three already scoped files: this plan, [`memory.md`](../../../memory.md), and [`docs/agent-memory/2026-08-22-server-app-isolation-phase3-catering-pilot.md`](../../agent-memory/2026-08-22-server-app-isolation-phase3-catering-pilot.md). No workflow, helper, Compose, Caddy, application, database, secret, volume, or production file is changed here.

### Future implementation scope

The later pilot implementation may add only the Catering workflow/helper, the two inert repository Compose templates, their protected copies at `/opt/catering-phase3/platform-compose.phase3.yml` and `/opt/catering-phase3/edge-compose.phase3.yml`, the exact marker handling at `/opt/catering-phase3/phase3.activation`, the fixed canonical immutable baseline manifest at `/opt/catering-phase3/phase3.transaction-baseline.manifest`, and the atomic owner-/lock-scoped hash-checked install/rollback needed for these four protected paths. The fourth protected path is the baseline-manifest contract; it is not a progress/evidence manifest and must never be overwritten during the pilot. It may minimally update the existing callers/workflows and their contract tests—`platform-infra/scripts/deploy-hetzner.sh`, `platform-infra/scripts/deploy-web-listener-hetzner.sh`, `edge-infra/scripts/deploy-hetzner.sh`, the historical `edge-infra/scripts/cutover-hetzner.sh`, `.github/workflows/deploy-production.yml`, the actual Web workflow `.github/workflows/deploy-catering-web-listener.yml` (the `deploy-web-listener-hetzner.yml` name is not an executable workflow in this repository), `.github/workflows/deploy-edge-production.yml`, `.github/workflows/cutover-edge-production.yml`, the Phase-2 evidence workflow only for state separation, a separate pilot workflow/helper, and the existing caller contract-test set listed in §2.3—only for explicit mode-specific file chains, activation-state validation, lock ordering, protected-path exclusions, and fail-closed pre-mutation guards. The Edge override may express only external `catering_ingress` and retained old compatibility networks. The Platform override may declare only the exact external Catering networks and final service membership; `catering_private` remains `internal=false` and carries no host ports. No implementation may modify product sources, data migrations, Shared Edge Caddy/upstreams, DNS, TLS, ports, images, public infrastructure behavior, or foreign app sources.

### Open risks and blockers

1. The authoritative Phase-3 plan was previously absent from `main` and is currently supplied by PR #656 on an older base; this corrected plan must be independently reviewed before implementation.
2. Zeiterfassung and EventOS owner repositories, complete service inventories, project/file sets, aliases, locks, and rollback contracts are absent from this repository. Their phases are hard blocked and are not part of the Catering pilot; the exact foreign allowlist above is the read-only Phase-2 baseline, not authorization to mutate them.
3. The production SSH role's ability to create/inspect owner-labeled Docker networks and perform only owner-scoped connects/disconnects has not been verified in this documentation turn.
4. The local environment may not have Docker; a local Compose-config gate is not a substitute for the hosted Exact-Head-CI and later approved read-only preflight.
5. The historical Phase-2 prose drift (`web:80`, `app:3040`) must remain rejected; executable current upstreams are the only accepted values.
6. Both source templates, their protected copies, the exact marker, both host locks, and their atomic/hash-checked sync and rollback must be implemented and tested before live membership changes; a one-time runtime connect alone is not sufficient. Compatibility private resolution must remain stage-labelled and must not be mistaken for the final isolation gate.
7. The existing production SSH role and each listed deploy/cutover/recovery/rollback caller must be updated and tested for the shared marker/file-chain contract before activation; unknown permissions or a caller that cannot validate the marker is a hard `NO-GO`.
8. Because `catering_private` deliberately remains `internal=false`, an enabled professional-source/provider HTTPS path must be verified without exposing secrets; if that path is enabled but unavailable after migration, the pilot is `NO-GO`.

## Self-review

- Iranmonitor is an explicit immutable foreign-app allowlist with no extra containers or cross-app network membership.
- Every foreign invariant includes ID, `RestartCount`, exact networks/IDs/aliases, and host ports, with status/`StartedAt`/image/Compose identity in the manifest.
- The additive and detach topology is mechanically specified, including compatibility retention and the exact Catering end state.
- The mode-specific Phase-2 three-file and Phase-3 four-file Catering chains, Compose `!override` version gate, rendered six-service network matrix, and edge-cutover port-removal invariant prevent later recreates from reattaching old networks to `web` or reclaiming 80/443.
- Both new networks are explicit external Compose resources; engine ownership/labels/parameters are authoritative and `catering_private` remains `internal=false` so enabled outbound HTTPS is not silently broken while membership stays exact.
- The static Zeiterfassung/EventOS/Iranmonitor allowlist is complete for the Phase-2 evidence baseline; any owner/runtime mismatch is `NO-GO`, not an inferred migration permission.
- Network labels, driver/scope/internal/IPAM/options, stage member/alias sets, provenance, and creation/removal ownership are deterministic and explicit.
- Source configuration and live owner-scoped connect/disconnect are separated so internal Catering services are not recreated or restarted.
- The exact non-secret marker automaton (`absent`/`inactive`/`candidate`/`active`/`rolling_back`), fixed canonical immutable baseline manifest, exact `transaction_manifest_sha256` binding, shared lock order, and caller/workflow allowlist make templates inert until active readback and keep legacy deploys safe before activation and after rollback; state/source/manifest/hash/transaction-context drift fails closed before mutation.
- Both Catering and Shared Edge have durable, versioned pilot source contracts with protected copies and mode-specific chains; the source/marker/baseline install and rollback are lock-scoped, atomic, hash-checked, and manifest-bound, while runtime connect remains non-recreating and later normal recreate consumes the correct chain. Progress, smokes, mode, and rendered-config data stay in separate Evidence-/Laufmanifests. Only the authorized external `catering_ingress` membership changes; Caddy, upstreams, hostnames, ports, DNS, TLS, image, restart, and runtime behavior remain unchanged.
- Rollback enters `rolling_back` with the same bound manifest hash, restores marker/sources and old memberships before removing new memberships, removes only run-created, empty, exact-label/ID-verified Catering networks authorized by the pre-bound baseline, archives proof only after complete restore/invariants/smokes, and fails without deleting the bound manifest if any step fails.
- `web` is the sole `web` alias on ingress; Edge is only `edge` plus its container-name alias, preventing DNS self-targets.
- Isolation checks are stage-specific: the bounded old `platform-infra_default` compatibility resolution is allowed only before the relevant detaches and never counts as GO; each detached internal alias/port must then fail from Edge, and final GO requires all five private services blocked with `web:8081` only on ingress.
- Egress is tested conditionally: disabled source/provider functionality is recorded as not exercised, while an enabled path must pass a non-secret HTTPS metadata/status proof; this plan adds no proxy or external-search requirement.
- Phase-2 evidence remains separate and cannot emit Phase-3 GO; only the separate pilot helper may emit terminal GO after active readback and final invariants/smokes.
- The pilot has an explicit terminal stop before Phase 3.2; no Zeiterfassung/EventOS/Iranmonitor mutation is implied.
- Phase-2-GO identity and the already documented cutover references are recorded without inventing new historical values.
- The current turn changes exactly the plan, `memory.md`, and the linked Phase-3 snapshot; it performs no runtime or Git-metadata mutation.
