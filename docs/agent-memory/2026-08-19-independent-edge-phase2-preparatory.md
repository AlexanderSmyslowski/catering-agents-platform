# Independent shared edge – Phase 2 preparatory milestone

Date: 2026-08-19
Status: preparatory candidate; no public cutover
PR: #633
Branch: `infra/independent-edge-phase2-20260818`

## Scope completed in the candidate

- `shared-edge` is an application-independent Caddy Compose project. Its lifecycle is separate from Catering, Zeiterfassung and EventOS.
- The production deployment workflow is rehearsal-only. The rehearsal override binds the candidate exclusively to `127.0.0.1:18080`; it does not bind 80/443 and therefore cannot replace the currently serving public proxy.
- The edge joins the existing compatibility networks `platform-infra_default` and `zeiterfassung_default` only for the transition. No application containers, databases, application volumes or Docker socket are owned by the edge project.
- Zeiterfassung rehearsal identity is checked locally through the candidate listener with the real Host header and requires HTTP 200 plus JSON `ok=true`. The public smoke also validates `/healthz`, `/readyz` and `/api/public/config` semantically.
- Catering reuses the established application smoke suite. The independent edge reaches the application-owned Catering Caddy over `https://web:443` with `CATERING_PUBLIC_HOST` as TLS SNI, avoiding the inner HTTP-to-HTTPS redirect while preserving Basic Auth.
- EventOS is routed to `commcats-eventos-app:3045` through the existing platform compatibility network.
- Caddy validation runs through the Compose `edge` service so only its explicit environment whitelist reaches the validator. The protected server `.env` is not injected wholesale into a generic validation container.
- A pre-mutation rollback snapshot is recorded when a previous edge deployment exists. Post-start failures restore only `shared-edge`; application projects are not started, stopped, recreated or removed by edge rollback.
- An env-only bootstrap directory is explicitly treated as no previous edge deployment.
- Every direct or workflow-driven edge deployment acquires the remote edge-specific `${EDGE_DEPLOY_PATH}.deploy-lock` before the rollback snapshot and holds it through source sync, candidate start, smoke checks and deployment-manifest publication. Concurrent host-level edge deployments therefore fail closed.

## Explicit non-goals / still blocked

- Merging this preparatory slice is not a public cutover.
- Ports 80/443 remain with the existing serving proxy until a separately reviewed and explicitly executed cutover task.
- No application deployment, database migration, data mutation, application-volume change or release is part of this milestone.
- The compatibility networks are transitional; final per-application ingress/private-network separation remains later work.

## Verification gate before merge and rehearsal

The candidate must have an exact-head green `build-and-test` job and green `browser-rehearsal`, all Codex review findings resolved on the exact head, and no new unresolved deploy-safety finding. Only after merge may the dedicated production workflow run in `EDGE_MODE=rehearsal`; cutover remains blocked.
