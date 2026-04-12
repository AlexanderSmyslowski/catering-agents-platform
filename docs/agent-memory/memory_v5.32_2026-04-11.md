# memory snapshot

source: memory.md
version: 5.32
date: 2026-04-11
repo: AlexanderSmyslowski/catering-agents-platform
status: owned-memory-foundation-planned

## Snapshot-Zweck
Versionierter Zwischenstand fuer Handoff und Rueckgriff: aus dem laufenden Produktfortschritt wird jetzt zusaetzlich ein Architekturstrang fuer modellagnostische Memory- und Harness-Grundlagen abgeleitet.

## Strategische Schlussfolgerung
- Das Produkt darf langfristig nicht nur aus UI- und Flow-Verbesserungen bestehen.
- Fuer ein wirklich modellagnostisches Produkt muessen Harness, Memory und Skills in eigener Kontrolle bleiben.
- Memory darf nicht primaer in fremden API-Zustaenden oder proprietaeren Harnesses liegen.
- Es braucht eine eigene, offene, server-/rechnerseitige Memory-Grundlage.

## Neuer paralleler Buildstrang
### Owned Memory & Harness Foundation
Ziel:
- eigene Kontrolle ueber Kontext, Langzeitwissen, Arbeitslogik und wiederverwendbare Skills
- Trennung zwischen Session Context, Operational Memory und Long-Term Memory
- offene und portable Formate fuer Wissen, Resolver und Skills

## Naechster sinnvoller Schritt
### Phase M1 - Memory-Architektur definieren
Inhalt:
- Memory-Ebenen festlegen
- Ownership und Speicherorte definieren
- Memory-Objekte benennen
- Read-/Write-Regeln festlegen
- Resolver-Prinzip definieren
- Skill-Prinzipien fuer wiederkehrende Prozesse festhalten

## Einordnung zum bisherigen Produktpfad
- Der laufende Produktions- und Governance-Fortschritt bleibt gueltig.
- Es wird nichts davon zurueckgebaut.
- Der neue Strang ergaenzt den Produktpfad architektonisch und schafft die Grundlage fuer langfristige Differenzierung und Modellunabhaengigkeit.
