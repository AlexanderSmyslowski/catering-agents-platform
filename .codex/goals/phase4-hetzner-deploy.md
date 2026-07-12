# Goal: Phase 4.1 Hetzner-Deployment

- Deploy the current `main` state to the existing Hetzner instance.
- Preserve server-only configuration and provide a rollback snapshot.
- Use only synthetic or anonymized data for the deployment smoke.
- Do not enable real customer data or a production pilot.

Acceptance:
- Missing remote `.env` stops before repository synchronization.
- Repository synchronization cannot delete the remote `.env`.
- Public UI and all four service health endpoints pass after deploy.
- Protected routes remain inaccessible without an operator context.
