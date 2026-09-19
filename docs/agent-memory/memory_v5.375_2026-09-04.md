# memory snapshot v5.375 – 2026-09-04

## Snapshot-Zweck

Dokumentation des lokalen Catering-Backup-/Restore-Kandidaten nach der
Variante-A-Vertragsfortschreibung. Der Snapshot ist eine nicht-sensitive
Handoff-Notiz und keine Betriebs- oder Freigabeerklärung.

## Geprüfter Vertragsstand

- Caddy-Secretdaten bleiben ausschließlich im verschlüsselten Off-host-
  Restic-Snapshot. Der Backupweg verwendet einen einzigen kanonischen
  `--stdin`-Tar-Stream ohne lokale Caddy-Archive oder Klartext-Bundles.
- Backup publiziert zuerst versionierten Candidate und Pointer; Restore erzeugt
  erst nach isolierter Prüfung einen versionierten Receipt und einen
  snapshotunabhängigen Repository-Status. Die autoritative Evidence ist der
  letzte atomare Promotionsschritt.
- Restore nutzt den systemd-managed flüchtigen root-only Pfad
  `/run/catering-backup`; Backup, Restore und ihre systemd-Units bleiben
  getrennte Verträge.
- `docs/operations/CATERING_BACKUP_RESTORE.md` nennt Installations-/Recordpfade,
  nicht-sensitive Eingaben, Identitätsbindungen und getrennte Betreiber-Gates.
  `docs/superpowers/plans/2026-09-03-catering-backup-restore-slice.md` führt die
  gemeinsame Primitive `platform-infra/backup/catering-backup-common.sh` und
  deren Syntax-/ShellCheck-Prüfung.

## Grenzen

Der Stand ist ein lokaler, ungemergter Repository-Kandidat. Es wurden keine
Produktionssysteme, Hosts, Container, Restic-Repositories, systemd-Units oder
Secrets betrieben bzw. materialisiert; keine Git-Abschlussaktion erfolgte.
