# Snapshot: Catering Backup/Restore v5.379

date: 2026-09-05
project: catering-agents-platform
status: local candidate; no merge or operational execution

## Bound contract

- The versioned scope is exactly `postgres,sites,platform-caddy,shared-edge-caddy`.
- Backup creates one non-verbose Restic stdin stream with relative internal component paths and no local Caddy archive.
- The exact Restic readback binds a whole-stream checksum, the PostgreSQL dump checksum, and six non-secret Caddy/Sites component checksums. Restore recomputes the six component checksums from the isolated restored tree before the probe.
- A versioned artifact carries the component bindings; receipt and final evidence carry the same non-secret bindings after restore and cleanup.

## Evidence boundary

Only hermetic fixtures were used. No real Docker, Restic, SSH, systemd, host, production, commit, push, or pull-request operation occurred. Secret values and sensitive file contents were not stored in this snapshot.

## Open gates

True executable PostgreSQL/Caddy capture and collector integration, complete descriptor/attestation revalidation at every promotion, and platform Compose evidence remain separate gates for a later review.
