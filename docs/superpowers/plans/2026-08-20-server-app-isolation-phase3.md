# Server Isolation Phase 3: App-Specific Ingress and Private Networks

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:executing-plans` (or `superpowers:subagent-driven-development`) to execute this plan task-by-task. Every implementation task starts with its failing regression contract, uses checkbox tracking, and stops on a failed gate.

**Goal:** Replace the Phase-2 compatibility-network attachments with six explicitly owned application networks while preserving the public contracts and proving that an app deployment cannot recreate, disconnect, restart, or overwrite another app.

**Architecture:** Migrate one application at a time, in the order Catering, Zeiterfassung, EventOS. Each public web/application endpoint is reachable from the independent `shared-edge` project only through its own `*_ingress` network. The app's web/application process also joins its own `*_private` network; databases, workers, intake services, and other internal processes join only that private network. The migration is additive first: old compatibility networks remain in place until the new path is proven and a separate, explicitly gated edge-only removal is approved. Each application/deployment owner creates and owns its two named networks; Shared Edge is only a consumer of the three ingress networks and never creates, owns, removes, or tears down an app network.

**Tech Stack:** Docker Compose, Docker networks/DNS, Caddy, Bash, GitHub Actions, Vitest contract tests, `curl`, and read-only Docker inspection.

**Authoritative inputs:**

- `docs/superpowers/specs/2026-08-18-server-app-isolation-design.md`
- `docs/superpowers/plans/2026-08-18-independent-edge-phase2.md`
- the executable Compose, Caddy, deploy, workflow, and smoke sources at the current `origin/main` commit

**Planning boundary:** This file is the Phase-3 evidence and implementation plan only. Creating or changing a network, starting Compose, changing Caddy, deploying, cutting over DNS/ports, or removing a compatibility network requires a later, separately approved execution turn. This turn must remain documentation-only and must not modify runtime files, Git metadata, or the Shared Edge state.

---

## 1. Evidence-first inventory of the current contract

### 1.1 Evidence boundary and authority rule

The inventory below was read from `origin/main` at `6703d2aa9bb426c7f44d6601306dc623219741be` (the current `main` ref when this plan was prepared). The repository contains the Catering and Shared Edge sources, but no Zeiterfassung or EventOS Compose/deploy source. A missing source is an explicit execution blocker: before any implementation step for either external app, its owner must provide the current authoritative repository path, immutable source revision, exact Compose/deploy/rollback file set, rendered Compose contract, and a read-only live inventory reconciled against that contract. The comparison result is part of the preflight manifest; a source or live-contract mismatch stops the app phase. This repository and its edge references may record the current upstream consumer contract, but they do not invent or substitute runtime truth for either app. No generic service name such as `app` or `web` may be invented to fill the gap.

When the Phase-2 prose plan disagrees with executable `origin/main`, the executable Compose/Caddy/deploy source, the owner-authoritative external app contract, and a successful read-only runtime DNS/port probe are authoritative. The Phase-2 plan still contains the historical `web:80` and `app:3040` examples; the current edge source uses `http://web:8081` and `zeiterfassung-app-1:3040`. `web:80` and `app:3040` are not current runtime truth and must be rejected by the active target contract. This drift is a required RED-test and preflight check, not permission to silently rename an upstream.

### 1.2 Compose projects, services, networks, and aliases

| Scope | Compose/deploy source present in this repository | Current project identity | Services/containers evidenced | Current network membership | Exact names/aliases evidenced | Edge reachability and private-only boundary |
|---|---|---|---|---|---|---|
| Catering | `platform-infra/docker-compose.yml`; production override `platform-infra/docker-compose.production.yml`; cutover override `platform-infra/docker-compose.edge-cutover.yml`; deploy scripts under `platform-infra/scripts/` | The effective production project is `platform-infra`: targeted scripts pin `-p platform-infra`, while the full deploy relies on running from the `platform-infra` directory. The base YAML has no `name:` and no top-level `networks:` declaration, so Phase 3 must pin the project explicitly everywhere. | `postgres`, `intake`, `offer`, `production`, `exports`, `web` | Base Compose's implicit project `default` network is observed as `platform-infra_default` in the deployment contracts. Production `web` additionally joins external `zeiterfassung_default`. | No explicit Compose `aliases:` block exists. The service DNS names used by the app Caddy are exactly `postgres`, `intake`, `offer`, `production`, `exports`; the public web service is exactly `web`. | Only `web` is an edge upstream. `postgres`, `intake`, `offer`, `production`, and `exports` are private-only. `web` must also retain private reachability because its Caddy proxies to the internal services. |
| Zeiterfassung | No Zeiterfassung Compose, Caddy, deploy, or rollback file exists in this repository. Current references are in `edge-infra/`, Phase-2 documents, and smoke contracts; these are consumer-side evidence only. | No project name is declared here. The observed runtime container is `zeiterfassung-app-1`; this is not evidence of a Compose project name. | At least the container `zeiterfassung-app-1` is evidenced. The complete web/app, database, worker, intake, and internal-service inventory is unavailable in this repository until the owner supplies it. | The current compatibility path is `zeiterfassung_default`; `shared-edge` and the production Catering `web` attach to it during Phase 2. This repository does not treat that text as a substitute for the owner's current live inventory. | The executable edge default is `zeiterfassung-app-1:3040`. The legacy `app:3040` appears only in the edge migration guard and stale Phase-2 prose; it is not an approved target alias. | The current consumer-side upstream is `zeiterfassung-app-1:3040` for `zeit.the-one.catering`. The owner must identify and reconcile the exact public web/app service, every private-only service, and its deploy/rollback contract before migration; an unknown member or alias fails closed. |
| EventOS | No EventOS/CommCats Compose, Caddy, deploy, or rollback file exists in this repository. Current references are in `edge-infra/`, Phase-2 documents, and smoke contracts; these are consumer-side evidence only. | No project name is declared here. The observed runtime container is `commcats-eventos-app`; this is not evidence of a Compose project name. | At least the container `commcats-eventos-app` is evidenced. The complete web/app, database, worker, and internal-service inventory is unavailable in this repository until the owner supplies it. | Phase-2 documentation records EventOS as reachable through the existing `platform-infra_default` compatibility network. No EventOS-specific network is declared in the current edge Compose, and this documentation is not runtime truth without owner/live reconciliation. | The executable edge default is `commcats-eventos-app:3045`; no explicit network alias declaration is present here. | The current consumer-side upstream is `commcats-eventos-app:3045` for `eventos.commcats.de`. The owner must identify and reconcile the exact public web/app service, every private-only service, and its deploy/rollback contract before migration; an unknown member or alias fails closed. |
| Shared Edge (infrastructure, not an app) | `edge-infra/docker-compose.yml`, `docker-compose.rehearsal.yml`, `Caddyfile`, `.env.example`, `scripts/validate.sh`, `scripts/deploy-hetzner.sh`, `scripts/cutover-hetzner.sh`, `scripts/smoke-all.sh` | Explicit `name: shared-edge`; deploy scripts also use `docker compose -p shared-edge`. | One service, `edge`, with volumes `edge_caddy_data` and `edge_caddy_config`. | Currently attached to external `platform-infra_default` and `zeiterfassung_default`; it is not attached to a private/database network. | Caddy routes only the named environment upstreams: `http://web:8081`, `zeiterfassung-app-1:3040`, and `commcats-eventos-app:3045`. | It owns public host ports 80/443 in cutover mode. In the Phase-3 end state it may attach only to `catering_ingress`, `zt_ingress`, and `eventos_ingress`, never to any `*_private` network or old compatibility network. |

Explicit alias result: there are no `aliases:` declarations in the repository's Compose files. The names above are service keys or externally observed container/DNS names. The migration must preserve the exact current names through explicit, owner-approved network aliases or atomically update the edge environment and tests; it must never assume a generic `app` or `web` alias for Zeiterfassung or EventOS.

### 1.3 Current port and upstream contracts

| Contract | Current evidence | Phase-3 preservation rule |
|---|---|---|
| Catering application listener | `platform-infra/Caddyfile` listens on `:80` (the configured site) and an internal HTTP listener `:8081`; the edge defaults to `CATERING_APP_UPSTREAM=http://web:8081`. Base Compose maps `${HTTP_PORT:-8080}:80` and `${HTTPS_PORT:-8443}:443`; the cutover override clears host port bindings with `ports: !reset []`. | Keep the edge's exact internal HTTP identity and path semantics. A network migration may not introduce a TLS hop, change Basic Auth, or expose an internal service directly. Any upstream change requires a new RED contract and owner-approved evidence. |
| Catering internal service ports | The Compose environment and Caddy routes bind `postgres:5432`, `intake:3101`, `offer:3102`, `production:3103`, and `exports:3104` by service DNS; none of these services publishes a host port. | Keep these names and ports private on `catering_private`; the edge must never route to them or receive their credentials. |
| Zeiterfassung public route | `ZEITERFASSUNG_PUBLIC_HOST=zeit.the-one.catering`; `ZEITERFASSUNG_UPSTREAM=zeiterfassung-app-1:3040`. The smoke contract requires `/healthz`, `/readyz`, and `/api/public/config`, with the expected identity JSON. | Preserve the exact host, port, and response identity while moving the endpoint to `zt_ingress`. Do not substitute the historical `app:3040` literal without a live owner-authorized DNS proof. |
| EventOS public route | `EVENTOS_PUBLIC_HOST=eventos.commcats.de`; `EVENTOS_UPSTREAM=commcats-eventos-app:3045`; smoke checks `/`. | Preserve the exact host, port, and expected successful response while moving the endpoint to `eventos_ingress`. |
| Shared Edge listener | `edge-infra/docker-compose.yml` owns `80:80` and `443:443` in cutover mode; rehearsal uses the loopback listener `127.0.0.1:18080:80`. | Keep rehearsal and production port ownership separate. A Phase-3 network change must not be used as an implicit Shared-Edge/DNS cutover. |

### 1.4 Current deploy and rollback contracts

| Owner | Current contract | Evidence and Phase-3 implication |
|---|---|---|
| Catering full deploy | `platform-infra/scripts/deploy-hetzner.sh` requires SSH/rsync, checks `platform-infra/.env` and `zeiterfassung_default`, snapshots a rollback tarball while excluding data, `.env`, and sites, syncs the repository while preserving protected state, runs the base plus production override (and only the explicit cutover override when `EDGE_EXTERNAL=true`), runs `platform-infra/scripts/smoke-check.sh`, and writes `.deploy-manifest`. | The current script has a transitional cross-app network prerequisite and does not use an explicit `-p` on every Compose invocation. Phase 3 must make the project/file set explicit and remove the cross-app prerequisite only after the new Catering ingress is proven. No `down`, prune, DB/volume/secret migration, or app-code change is allowed. |
| Catering web-only deploy | `platform-infra/scripts/deploy-web-listener-hetzner.sh` uses `-p platform-infra`, captures the current web image, snapshots source, rebuilds/recreates only `web`, probes `web:8081` for exact `intake-service` identity, and restores the prior image on failure. | It is an app-owned rollback path. Phase 3 must extend its pre/post inventory to include foreign container IDs and restart counts and must not let a web-only action detach the edge or another app. |
| Shared Edge deploy | `edge-infra/scripts/deploy-hetzner.sh` validates local Compose/Caddy before remote write, acquires an edge-specific lock, checks the two compatibility networks, snapshots only the edge source, syncs only `edge-infra/` while preserving `.env`, starts only `shared-edge`, probes the rehearsal listener or all public hosts, and restores only the prior Shared Edge candidate on failure. | Phase 3 changes this source only in a separately approved infrastructure implementation. It must replace old-network checks with the additive/new-network checks at the appropriate stage and must fail closed if a private network or unexpected container is attached. |
| Shared Edge cutover | `edge-infra/scripts/cutover-hetzner.sh` rehearses first, captures the listed Catering/Zeiterfassung/EventOS container IDs, releases Catering's public bindings, starts the edge, compares before/after IDs, and restores Catering's web port ownership on failure. | The current proof compares IDs but not restart counts. Phase 3 requires both `Id` and `RestartCount` in every before/after manifest; the old script must not be treated as satisfying that stronger contract. |
| Workflows | `.github/workflows/deploy-edge-production.yml` and `.github/workflows/cutover-edge-production.yml` both serialize on `shared-edge-production-deploy` and call the edge entrypoints; `.github/workflows/deploy-production.yml` and `.github/workflows/deploy-catering-web-listener.yml` serialize on `catering-production-deploy` and call the platform entrypoints. The edge workflow uses `/opt/shared-edge` and `/opt/shared-edge-rollbacks`; Catering paths come from protected workflow inputs. | No workflow is changed in this documentation turn. A later implementation must keep one app migration per change and one independent rollback/lock per owner. |
| Zeiterfassung/EventOS deploy | No owner deploy or rollback source exists in this repository. | The Phase-3 preflight must receive the authoritative external file set, Compose project name, lock, rollback point, and smoke commands. Missing or contradictory evidence blocks that app; no guessed path or generic alias is permitted. |

---

## 2. Target state and ownership matrix

### 2.1 Required networks

| Network | Target members | Network owner / lifecycle authority | Shared Edge membership | Prohibited members |
|---|---|---|---|---|
| `catering_ingress` | Catering `web` and only the exact public HTTP endpoint it owns | Catering deployment owner creates, labels, and may remove it only after all owner deletion gates; Shared Edge never owns or removes it | Consumer only | `postgres`, `intake`, `offer`, `production`, `exports`, any database/worker, and any other app |
| `catering_private` | Catering `web` plus `postgres`, `intake`, `offer`, `production`, `exports` so the existing internal Caddy routes continue to resolve | Catering deployment owner creates, labels, and may remove it only after all owner deletion gates | No | `edge`, Zeiterfassung, EventOS, and all unrelated containers |
| `zt_ingress` | The exact owner-confirmed Zeiterfassung web/app endpoint represented today by `zeiterfassung-app-1:3040` | Zeiterfassung deployment owner/contract creates, labels, and may remove it only after all owner deletion gates; Shared Edge never owns or removes it | Consumer only | Zeiterfassung databases, workers, intake/internal services, and all other apps |
| `zt_private` | The owner-confirmed Zeiterfassung database, worker, intake, and internal services; the public web/app process may also join it for internal dependencies | Zeiterfassung deployment owner/contract creates, labels, and may remove it only after all owner deletion gates | No | `edge`, Catering, EventOS, and any public-only edge process |
| `eventos_ingress` | The exact owner-confirmed EventOS web/app endpoint represented today by `commcats-eventos-app:3045` | EventOS deployment owner/contract creates, labels, and may remove it only after all owner deletion gates; Shared Edge never owns or removes it | Consumer only | EventOS databases, workers, intake/internal services, and all other apps |
| `eventos_private` | The owner-confirmed EventOS database, worker, intake, and internal services; the public web/app process may also join it for internal dependencies | EventOS deployment owner/contract creates, labels, and may remove it only after all owner deletion gates | No | `edge`, Catering, Zeiterfassung, and any public-only edge process |

The final `shared-edge` Compose source must declare and attach exactly `catering_ingress`, `zt_ingress`, and `eventos_ingress` as external networks. It must not declare or attach `platform-infra_default`, `zeiterfassung_default`, `catering_private`, `zt_private`, or `eventos_private`. Shared Edge is only a consumer of the three ingress networks: it may add or remove its own attachment under its own lock, but it may not create, label as owner, delete, or otherwise tear down any app-owned ingress/private network. Each app's ingress network must have a stable, owner-approved identity and must not be removed by an app rollback while the edge is attached.

Network lifecycle contract: each app owner creates its two named networks once with the exact name and an owner label, then both the app Compose source and the edge source consume the networks as explicit external networks. This keeps network IDs stable across app recreation and prevents a generic Compose teardown from deleting an ingress network that the edge still needs. Only the owning app/deployment contract may remove its network, and only after the last-consumer, cutover, rollback-retention, and zero-consumer deletion gates below are satisfied. Network creation, ownership labels, and the no-delete rule must be verified in the preflight manifest; network cleanup is outside this phase.

### 2.2 Stable DNS and port identities

- Catering keeps the exact public endpoint `web:8081` on `catering_ingress`; the private-side service names remain `postgres`, `intake`, `offer`, `production`, and `exports`.
- Zeiterfassung keeps `zeiterfassung-app-1:3040` until the owner proves an explicit replacement. A legacy `app` name is not a target.
- EventOS keeps `commcats-eventos-app:3045` until the owner proves an explicit replacement.
- If an app's Compose service key differs from its currently observed container/DNS name, the app-owned Compose source must declare that exact ingress alias and a container-from-edge DNS probe must pass before the old path is removed.
- No database, volume, secret, release identity, hostname, HTTP path, Basic Auth, TLS, or application-code contract changes are part of Phase 3.

---

## 3. Non-negotiable execution gates

These gates apply to every network, Compose, Caddy, deploy-script, workflow, or rollback change in this plan.

1. **Read-only preflight:** record the exact Compose project name, file list, service list, network IDs, network labels, container IDs, `RestartCount`, volume names/IDs, secret names (never values), host port bindings, upstream host/port, and rollback location. A missing external app source or an unknown network member stops the run.
2. **TDD first:** add or update the failing contract test before changing a runtime or deploy file. Run the RED test and record the expected failure. Implement the smallest network-only change, then run the focused GREEN test and the existing regression group.
3. **Explicit ownership:** every Compose invocation uses an explicit project name and explicit file list. No `docker compose down`, host-wide removal, prune, unscoped `docker rm`, `docker network rm`, volume migration, secret copy, or generic “restart all” command is allowed. The app/deployment owner alone creates or removes its `*_ingress`/`*_private` networks after the owner gates; Shared Edge may only consume/detach its own ingress membership.
4. **Additive before removal:** create/verify the app's new ingress/private networks and add memberships while the old compatibility network remains. Keep the old path available through the smoke gate and a rollback window. Removal is a later, separate, one-network-at-a-time operation, and the last compatibility consumer may not be detached until its replacement is attached, target-network DNS/port/identity checks pass, and the current consumer is removed in a controlled owner-scoped step.
5. **Rollback path:** if any additive membership, edge attachment, app deploy, smoke, or invariant gate fails, remove only the newly added membership owned by the current operation and restore the old proven membership/path. Never delete or recreate a foreign network/container/volume/secret. Keep the old membership until successful cutover, the rollback retention window, and all deletion gates have passed.
6. **Fail closed:** reject network-name collisions, unexpected labels/owners, missing external networks, duplicate or changed upstream definitions, unresolved DNS, private-network edge membership, changed protected volume/secret identities, or any foreign ID/restart-count delta. Do not repair an unknown state ad hoc.
7. **One app at a time:** a change may mutate only the current app and, when separately locked and reviewed, the edge attachment required to verify that app. Never migrate two application projects in one Compose operation or one rollback.
8. **Foreign-container invariant:** before and after every foreign-app-related change—including an app membership change, edge attach/detach, app deploy, compatibility detach, cutover, or rollback—capture and compare the exact container `Id` and `RestartCount` for every foreign app container. The exact current known set includes `zeiterfassung-app-1`, `commcats-eventos-app`, and Catering's `postgres`, `intake`, `offer`, `production`, and `exports`; the external app manifests may add more. Any unapproved ID or restart-count change is a failed deployment and fails closed.
9. **All-hostname smoke:** after every network creation, app membership change, edge attachment, app deploy, compatibility-network detach, or rollback, run all managed host checks: Zeiterfassung `/healthz`, `/readyz`, `/api/public/config` with identity validation; EventOS `/`; and the full Catering UI/API/health suite. A local rehearsal must use the candidate listener and real Host headers; it must not mistake the existing public proxy for the candidate.
10. **Protected state invariant:** verify that database volumes, Caddy volumes, app volumes, secret names/IDs, and release metadata are unchanged. Network-only migration must not rebuild or copy persistent data or secrets.
11. **Evidence before promotion:** write a non-sensitive manifest of pre/post IDs, restart counts, network IDs/members, Compose config hash, upstreams, smoke results, rollback archive, and exact changed paths. Do not promote, detach the last compatibility consumer, or remove an old network without a complete manifest.

---

## 4. Ordered implementation sequence

### Phase 3.0 — Read-only preflight and RED contracts

- [ ] Verify that the source ref is the intended current `main` and that the working tree has no unreviewed runtime change. Record the Phase-3 plan and the two authoritative architecture documents.
- [ ] Add failing contract coverage before any runtime edit. The tests must parse or inspect the exact Compose/deploy sources and assert:
  - all six target network names are present in the intended app/edge file set;
  - the edge has exactly the three `*_ingress` attachments and no private/temporary network in the final variant;
  - Catering's exact service memberships are `web` on ingress+private and the five internal services on private only;
  - ZT/EventOS memberships use owner-confirmed service names, not generic `app`/`web` assumptions;
  - current executable upstreams remain `http://web:8081`, `zeiterfassung-app-1:3040`, and `commcats-eventos-app:3045` until an atomic, tested owner-approved change; active target config must reject `web:80` and `app:3040` as stale Phase-2 prose, not runtime truth;
  - project names, explicit Compose file sets, per-app locks, rollback scope, no-destructive-command rules, and ID-plus-restart-count checks are present;
  - all-host smoke commands are invoked after each mutation stage;
  - no database/volume/secret migration or application source path is in scope.
- [ ] Run the RED tests and record the failure. Do not create a network or invoke Compose as part of this step.
- [ ] Obtain owner-authoritative Compose/deploy inventories from the Zeiterfassung and EventOS repositories before any implementation for either app. Record each repository path/URL and immutable revision, exact Compose/deploy/rollback file hashes, explicit project name and file set, rendered `docker compose ... config` services/networks, explicit aliases, current live network IDs/members, private-only services, port/upstream contracts, deploy lock, rollback point, and smoke commands. Compare each owner contract with the executable edge consumer contract and the read-only live inventory; record the diff and stop that app's phase on missing, stale, contradictory, or unreviewed evidence. Do not infer runtime truth from this repository, a container name, or the Phase-2 prose plan.

### Phase 3.1 — Catering pilot (first and independently rollbackable)

- [ ] Capture the Catering preflight manifest: explicit `platform-infra` file set; service/container IDs and restart counts; `platform-infra_default` and `zeiterfassung_default` IDs/members; `postgres_data`, `caddy_data`, and `caddy_config` identities; protected secret names; current host bindings; and exact `web:8081` upstream.
- [ ] Create/verify `catering_ingress` and `catering_private` additively. Validate labels/ownership and stable network IDs. Do not remove either compatibility network.
- [ ] Change only the Catering Compose/deploy contract so `web` joins `catering_ingress` and `catering_private`, while `postgres`, `intake`, `offer`, `production`, and `exports` join only `catering_private`. Keep the prior compatibility membership/path available throughout additive migration and the rollback window; do not make `zeiterfassung_default` a new dependency.
- [ ] Deploy only the explicit `platform-infra` project and file set with the app lock. The command must never touch the Shared Edge project or a foreign app. Run `docker compose ... config` before mutation and assert that no protected volume/secret identity changes.
- [ ] Add `catering_ingress` to the edge as an additive attachment, keeping `platform-infra_default` and `zeiterfassung_default` temporarily. Validate Caddy and resolve `web:8081` from the edge container on the new network.
- [ ] Run the all-hostname smoke suite from the candidate listener/public path as appropriate, including Catering's exact intake/offers/production/exports health identities. Abort and use the Catering-only rollback if any route is unresolved or returns the wrong identity.
- [ ] Before and after every Catering-related app or edge membership/deploy/detach change, capture and compare foreign application container `Id` and `RestartCount`. Catering-owned `web` may change only when the network addition requires it; Catering's internal services, Zeiterfassung, EventOS, and the edge must remain unchanged unless explicitly recorded as owned by the current step.
- [ ] After a green observation window and a separate approval, remove Catering's `web` attachment to `zeiterfassung_default` and its obsolete default-network membership in separate, reversible operations. First prove that `catering_ingress` is attached, resolves `web:8081`, and passes all-host smokes; then remove only the current owner-scoped membership. Re-run all-host smokes and the invariant manifest after each operation. Do not remove the global compatibility networks yet.
- [ ] Prove independent rollback: while the old path is still retained, remove only newly added Catering memberships if a gate fails and restore the prior Catering Compose file set/memberships. Leave Shared Edge, Zeiterfassung, EventOS, volumes, secrets, and data untouched; never delete a foreign network or container. Re-run all-host smokes and record both successful migration and rollback evidence before proceeding.

### Phase 3.2 — Zeiterfassung (second, after the Catering pilot evidence is green)

- [ ] Re-run the read-only preflight against the owner-supplied Zeiterfassung repository and immutable revision. Reconcile its executable Compose/deploy contract and live inventory with the edge consumer record before any mutation. Confirm the exact project/file set and that the owner-confirmed public endpoint is resolvable; retain `zeiterfassung-app-1:3040` unless the owner has explicitly changed and tested the contract, and reject stale `app:3040` as runtime truth.
- [ ] Add failing Zeiterfassung-specific network/ownership tests before changing its source. The tests must identify the exact public web/app service and every private-only service from the owner inventory; missing service classification is a hard failure.
- [ ] Create/verify `zt_ingress` and `zt_private` additively. Attach only the exact public endpoint to `zt_ingress`; place the app's database, worker, intake, and internal services only on `zt_private`; retain `zeiterfassung_default` for rollback.
- [ ] Deploy only the explicit Zeiterfassung project/file set under its own lock. Validate Compose, network membership, aliases, port 3040, volumes/secrets, and rollback point before mutation. Never run Catering or EventOS Compose commands. Capture foreign app container `Id` and `RestartCount` immediately before and after this owner-scoped change; any delta fails closed.
- [ ] Add `zt_ingress` to the edge as a separately locked additive edge change while retaining `zeiterfassung_default`. Probe `zeiterfassung-app-1:3040` from the candidate edge and run all-hostname smokes with identity checks.
- [ ] Compare every foreign container `Id` and `RestartCount` (Catering, EventOS, and the edge) and protected state after each Zeiterfassung app or edge membership change. Any delta fails closed and triggers Zeiterfassung-only rollback: remove only the newly added Zeiterfassung/edge membership and restore the old proven path, without deleting foreign networks or containers, followed by all-host smokes.
- [ ] After green evidence and separate approval, detach the edge and the migrated Zeiterfassung public service from `zeiterfassung_default` in separate owner-scoped operations. Keep the old path and network available until the rollback retention window expires and every removal gate, including an immediate zero-consumer recheck, is met.

### Phase 3.3 — EventOS (third, after Catering and Zeiterfassung evidence is green)

- [ ] Re-run the read-only preflight against the owner-supplied EventOS/CommCats repository and immutable revision. Reconcile its executable Compose/deploy contract and live inventory with the edge consumer record before any mutation. Confirm the exact project/file set and owner-confirmed public endpoint; retain `commcats-eventos-app:3045` unless the owner explicitly changes and tests the contract, and do not infer a Compose service from the container name.
- [ ] Add failing EventOS-specific network/ownership tests before changing its source. The tests must classify the public web/app service and all database/worker/intake/internal services from the owner inventory.
- [ ] Create/verify `eventos_ingress` and `eventos_private` additively. Attach only the exact public endpoint to `eventos_ingress`; place all non-public services only on `eventos_private`; retain `platform-infra_default` for rollback.
- [ ] Deploy only the explicit EventOS project/file set under its own lock. Validate Compose, alias/DNS, port 3045, volumes/secrets, rollback point, and absence of foreign mutations. Capture foreign app container `Id` and `RestartCount` immediately before and after this owner-scoped change; any delta fails closed.
- [ ] Add `eventos_ingress` to the edge as a separately locked additive edge change while retaining `platform-infra_default`. Probe `commcats-eventos-app:3045` from the candidate edge and run all-hostname smokes.
- [ ] Compare all foreign container `Id` and `RestartCount` values (Catering, Zeiterfassung, and the edge) and protected state after each EventOS app or edge membership change. Any delta fails closed and triggers EventOS-only rollback: remove only the newly added EventOS/edge membership and restore the old proven path, without deleting foreign networks or containers, followed by all-host smokes.
- [ ] After green evidence and separate approval, detach EventOS and the edge from `platform-infra_default` in separate owner-scoped operations. Keep the old path and network available until the rollback retention window expires. Do not remove `platform-infra_default` until the removal checklist below is complete.

### Phase 3.4 — Remove temporary Shared Edge attachments, one network at a time

This is a later, edge-only change, not part of any app migration or the current documentation turn. The order is:

1. Remove `zeiterfassung_default` from `shared-edge` only after the Zeiterfassung route is green through `zt_ingress`, Catering no longer depends on that network, the edge membership inspection shows no required service there, and the complete rollback manifest is retained.
2. Remove `platform-infra_default` from `shared-edge` only after Catering is green through `catering_ingress`, EventOS is green through `eventos_ingress`, no remaining app or edge upstream is resolved through the old network, and the complete rollback manifest is retained.

Compatibility-network hard gate: no compatibility network may be removed while any required consumer remains on it. For the last evidenced consumer, the owner must first attach it additively to its owner-created target network, prove target-network DNS/port/identity and all-host smoke success, and only then remove that consumer's old membership in a controlled, owner-scoped operation. Immediately before any Docker network deletion is even considered, repeat `docker network inspect` and require a fresh zero-consumer result with no unknown members; a non-zero or unknown result fails closed. Shared Edge may detach only its own membership under the edge lock; it may not delete an app-owned network. The network owner alone may perform a later deletion after the deletion gates, retention window, rollback evidence, and separate approval are complete. Network deletion is outside this Phase-3 documentation turn.

For each network, all of the following are mandatory before the removal command is even constructed:

- [ ] `docker network inspect` proves the old network ID and membership list; there are no unknown containers and no required app endpoint remains on it.
- [ ] The last evidenced consumer was already migrated additively to its owner-created target network, target DNS/port/identity checks and all-host smokes passed, and that consumer was then removed from the compatibility network in a separately recorded, controlled operation. No compatibility network is removed before this sequence.
- [ ] `docker compose -p shared-edge ... config` contains exactly the three `*_ingress` networks and no old/private network.
- [ ] The edge container resolves all three exact upstreams on their dedicated ingress networks and cannot resolve a private service.
- [ ] All-hostname smokes pass twice: once immediately after the additive migration and once after an edge restart/rehearsal using the new networks.
- [ ] Before/after manifests prove unchanged foreign container `Id` and `RestartCount`, and protected volume/secret identities are unchanged.
- [ ] The app-specific rollback archive, edge rollback archive, and retention window are recorded; an operator has separately approved the removal.
- [ ] Immediately before any deletion command, repeat `docker network inspect` and record a fresh zero-consumer/no-unknown-member result. If any consumer remains, stop; do not delete or detach blindly.
- [ ] Only the `shared-edge` project is changed by the edge detach. Shared Edge remains a consumer only; the old Docker network is not deleted in this step. Any later deletion is owner-only, separately approved, and outside this plan turn.

### Phase 3.5 — Phase-4 handoff for deployment-ownership gates

Phase 3 is complete only when the following handoff packet is available for Phase 4:

- [ ] A versioned ownership matrix maps each Compose project, file set, service, container, network, volume, secret name, lock, release manifest, and rollback point to exactly one owner.
- [ ] The final edge Compose/config evidence shows only `catering_ingress`, `zt_ingress`, and `eventos_ingress`; no private or compatibility network is attached.
- [ ] Each app's preflight/postflight contract proves explicit project/file selection, no destructive cross-project commands, network ID/label checks, and before/after container ID plus `RestartCount` invariants.
- [ ] Each app has a separately tested rollback that does not start, stop, recreate, remove, or reconfigure another app or the edge.
- [ ] All-host smoke results and exact upstream/DNS/port evidence are attached for every migration and compatibility-network detach.
- [ ] The remaining Phase-4 work is explicitly separated: deployment ownership gates, lock contention behavior, unknown-resource fail-closed behavior, and deliberate one-app rehearsal. No Phase-4 gate is inferred merely from a green application health check.

---

## 5. Verification commands for the eventual implementation

The implementation turn must run these serially and record the output without secrets or response bodies containing protected data:

1. Focused RED then GREEN contract tests for the current app/network stage, followed by the existing edge/platform infrastructure contract tests.
2. `docker compose -p platform-infra -f docker-compose.yml -f docker-compose.production.yml --env-file .env config` for Catering, the equivalent owner-recorded explicit project/file command for Zeiterfassung and EventOS, and `docker compose -p shared-edge -f docker-compose.yml --env-file .env config` for the edge, using non-secret validation environments.
3. Caddy configuration validation through the Compose edge service, not an unwhitelisted protected `.env` injection.
4. Read-only Docker checks for network IDs/labels/memberships, container IDs and `RestartCount`, port bindings, volume IDs, secret names, and Compose labels before and after each mutation.
5. Candidate-listener probes with the real Host header, then the complete all-hostname smoke suite after every infrastructure change.
6. The repository's normal typecheck/build/test gates after the focused infrastructure group; a live production deploy is not implied by a passing local suite.
7. `git diff --check` and a changed-path allowlist proving that no application source, database migration, volume/secret material, Shared-Edge/DNS cutover, or unrelated project file was changed.

An implementation must stop and roll back if any command is unavailable, any expected service/network is absent, an unknown container appears, a foreign ID or restart count changes, a private service is reachable from the edge, or any smoke returns an unexpected identity/status.

---

## 6. Explicit non-goals and open risks

### Non-goals

- No runtime, Compose, Caddy, deploy, workflow, DNS, port, TLS, ACME, Docker network, database, volume, secret, or application-code change is made by this plan turn.
- No simultaneous migration of multiple applications.
- No persistence or secret migration, schema change, image/release change, or new service-discovery system.
- No Shared-Edge public cutover or deletion of a compatibility network.

### Open risks that must be resolved before execution

1. **Missing external inventories:** this repository does not contain the Zeiterfassung or EventOS Compose/deploy sources, full service lists, project names, explicit aliases, private-network membership, locks, or rollback paths. Their owner-authoritative manifests are a hard prerequisite.
2. **Phase-2 prose drift:** the Phase-2 plan still says `web:80` and `app:3040`, while executable `origin/main` and regression tests say `http://web:8081` and `zeiterfassung-app-1:3040`. Phase 3 must preserve executable contracts and add a reviewed correction before any alias change.
3. **Restart-count evidence gap:** the current cutover orchestrator compares container IDs but does not prove `RestartCount` stability. Phase 3 must add the stronger manifest before treating any migration as green.
4. **Compatibility-network ownership:** `platform-infra_default` currently carries Catering and the EventOS compatibility route, while `zeiterfassung_default` is a transitional cross-project attachment. Their membership must be observed on the real host; no cleanup based solely on repository text is safe.
5. **Network lifecycle ownership:** Docker ingress network IDs must remain stable while the edge is attached. The app deployment owners must agree who creates, labels, backs up, and eventually removes each named network; an app `down` that removes an ingress network is a fail-closed violation.
6. **Public hostname configuration:** the production Catering hostname is protected environment state. The plan records the tested example `catering.the-one.catering` but does not authorize copying or changing the protected value.
7. **Rollback retention:** old networks and rollback archives must remain available long enough to reverse one app without bringing another app down. The exact retention window is an operational approval input, not a reason to remove the compatibility networks early.

## Self-review

- The required order is explicit: Catering, then Zeiterfassung, then EventOS.
- The target contains exactly the six requested networks and limits the final Shared Edge to the three ingress networks.
- Current services, project/file evidence, aliases, ports, upstreams, deploy/rollback contracts, and the absence of external app sources are called out without inventing generic names.
- Every implementation stage is regression-test-first, additive, fail-closed, single-app, independently rollbackable, and followed by all-host smokes and foreign ID/restart-count checks.
- Temporary-network removal criteria and the Phase-4 ownership-gate handoff are explicit.
- This document does not authorize or perform a runtime or Git mutation.
