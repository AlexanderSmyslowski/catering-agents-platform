# Snapshot: target02-Operationskandidat, 2026-10-05

Memory-Version 5.429. Entwicklungsbasis `9c09aa981a1724b2cd23fc6353c38b53a0fc177b`;
Arbeitsbranch `codex/cateringos-target02-bootstrap`. Unabhängiger Review und Annahme ausstehend.

Umgesetzt: explizite Zielauswahl prod-1/prod-02, Operations-root-Vertrag, neue getrennte
P4-Archivwiederverwendungsbindung mit historischem Quellmanifest, durchgängiger Target-
Transport in Stage-/Release-/Rollbackprüfung, hostlokale Bootstrapphasen und eigener
Initial-Receipt ohne erfundene Vorgängerimages. Fehlgeschlagener erster Appstart behält
die Schreibgrenze; automatische Wiederholung bleibt gesperrt.

Produkt ausschließlich `9ce4fbc96a5dd877f2cd2f00588a22be861306b9`, historische Quell-Ops
`b1e3d44573bf6fe6d3c8e46861792a592535e856`, PG17.9/Schema3. Der neue Operations-SHA
ist erst nach regulärer Annahme festzulegen. PWA/Main ist kein Migrationsprodukt.

Der neue Code besitzt synthetische Regressionen für Default/Opt-in, falsche Ziele und
Commits, immutable Quellbytes, erforderliche Inventare, Quellwriter, Images/Isolation,
First-write/Retrygrenze und den tatsächlichen Initial-Receipt-Verbrauch in Stage sowie
Release-State. Bestehende prod-1-Regressionen bleiben erhalten. Testnachweise sind lokale
Codebelege, keine Laufzeit-/Hostannahme.

Offen: unabhängige Spezifikations-/Qualitäts-/Risikoprüfung, automatische PR-CI,
reguläre Operationsannahme, Zugriff/Wartungsfenster/Ressourcen, vollständiges geprüftes
Quellinventar und vollständige Sicherungen samt Rollen/Ownern/ACLs/Auth/Dateimetadaten,
PG-/Edge-Archive, spätere echte Migration/Restoreprobe, geplante Backup-OnSuccess-Kette,
produktiver Writer sowie DNS/TLS. Der normale Produktions-Preflight bleibt unverändert
streng und akzeptiert die isolierte Erstinstallation noch nicht als Produktivbetrieb.

Keine Serververbindung, realer Bundlebau, Transfer, Stage/Apply, Docker-Imagebau/-pull,
Restore, Timer-/Heartbeatstart, DNS-Änderung, Merge oder Hub-Writeback.

Ausführbare spätere Reihenfolge und geschützte Eingabeverträge:
[Bootstrap-Runbook](../operations/CATERING_TARGET02_BOOTSTRAP.md).

## Reviewkorrektur 5.430

Auf Reviewbasis `a933fe06…` wurden drei konkrete Important-Lücken korrigiert:
PG-Container-/Datenmountidentität bleibt von Restore über First-write bis zur finalen
Verifikation gebunden; die dauerhafte Publikation synchronisiert Elternverzeichnisse;
langsame Prüfungen erlauben keine nachfolgenden Mutationen außerhalb der bestätigten
Paket-/Zugangs-/Source-Fencing-Fenster. Legitime Zielwrites verändern weiter den DB-Inhalt.
Erneuter unabhängiger Review und CI sind erforderlich; keine reale Ausführung.
