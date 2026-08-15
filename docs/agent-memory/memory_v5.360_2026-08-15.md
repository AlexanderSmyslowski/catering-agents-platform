# Stage-A-Task-12-Milestone-Snapshot – 2026-08-15

## Verbindlicher Kandidatenstand

- Repository: `AlexanderSmyslowski/catering-agents-platform`
- PR: `#612`
- Branch: `loop/stage-a-complete-chain`
- Kandidaten-Head: `2b2b05d5a57ab216fe31fbe599f4a114983e5c89`
- PR-Basis: `66f354c7715e766b59d9f6407638c05da5ad3394`
- Status: Kandidat im offenen PR; keine Merge-, Release- oder Deploymentfreigabe.

## Stage-A-Task-12-Abschluss im Kandidaten

- Die lokale End-to-End-Kette ist über die echten Angebots- und Produktionsgrenzen belegt: Quelle/Intake, Angebotsentwurf, menschliche Prüfung und Freigabe, unveränderliche Übergabe, Produktionsentwurf, Prüfung/Freigabe, Apply, Plan, Rezeptkarten, Einkaufsliste und Produktionsmappe.
- Die lokale Business-Scope-Migration ist idempotent im Datei- und PostgreSQL-Testmodus abgesichert. Route-, Store-, Export- und Auditdaten bleiben businessgebunden; gleiche fachliche IDs dürfen keinen Cross-Business-Export erzeugen.
- Reload, Suche, Revision, sichere Kopie und die getrennten Angebots-/Produktionsoberflächen sind über UI-/App-Verträge abgedeckt. Freigegebene Kompatibilitätspfade wurden erst nach grünen Ersatzverträgen entfernt.
- `hostedMultiBusinessReady` ist erst nach der vollständigen Isolationsmatrix codefest gesetzt und nicht über ein Umgebungsflag umgehbar.

## Nachweise und Grenzen

- Fokussierte Regressionen: `6/6`.
- Task-12-Vertragsgruppe: `183/183`.
- Serielle Vollsuite: `328` Testdateien bestanden, `1` übersprungen; `1.938` Tests bestanden, `14` dokumentierte Skips.
- TypeScript, Build und `git diff --check`: grün; lokale Parallelitäts-/Runnergrenzen bleiben separat klassifiziert.
- GitHub-CI Run `31885498716`: `build-and-test` Job `95014094943` und `browser-rehearsal` Job `95014094880`, beide terminal erfolgreich.
- Keine echten Provideraufrufe, keine Produktionsdaten, keine produktive Datenmigration und kein Deployment.

## Handoff-Status

Der ältere Kontrollpunkt-Hinweis aus Version 5.353, Aufgaben 8 bis 12 seien noch nicht begonnen beziehungsweise blockiert, bleibt als historische Spur unverändert erhalten. Für den PR-#612-Kandidaten ist er durch diesen versionierten Snapshot und den Eintrag 5.360 überholt. Die nächste Entscheidung ist die unabhängige Review und erst danach ein separater Git-/Merge-Turn.
