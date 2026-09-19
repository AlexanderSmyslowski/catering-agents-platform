# Memory Snapshot v5.378 – 2026-09-04

## Catering Backup/Restore A3

- Die Attestationsprüfung erfasst pro Validierung genau eine unveränderliche
  Produktionsadressgeneration: live Interfaceadressen, die verpflichtende
  externe Angabe (`none` oder kanonische IP-CSV), Endpoint-Auflösung und ihre
  Digests werden gemeinsam an die Leaf-Prüfungen weitergereicht. Lokale,
  reservierte oder mit der Produktionsmenge überlappende Endpointantworten
  bleiben fail-closed.
- `verified_at`/`valid_until` bilden eine erneuerbare, maximal 30 Tage gültige
  Betreiberattestation. Backup verlangt 21.600 Sekunden und Restore 18.000
  Sekunden Restgültigkeit; RPO bleibt davon getrennt. Backup liest die
  Repository-ID unmittelbar vor dem geheimnistragenden Snapshot neu.
- Sichere Restic- und Record-Reader bleiben descriptor-/inodegebunden. Die
  fokussierten Mutantentests weisen lstat/open-Races sowie ein Pfad-Reopen
  zwischen Hash und Parse zurück.

Dieser Snapshot beschreibt ausschließlich den lokalen, ungemergten A3-Kandidaten.
Es wurden keine Git-Metadaten, externen Systeme, Secrets, Docker-, Restic-,
SSH- oder Produktionsziele verändert oder angesprochen.
