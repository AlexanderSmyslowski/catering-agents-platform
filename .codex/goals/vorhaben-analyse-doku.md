# Vorhaben-Analyse + Uni-Paket-Doku committen

## Objective

Die beiden am 2026-06-12 erstellten Produkt-Dokumente in die Historie bringen:
`docs/product/VORHABEN_ANALYSE_2026-06-12.md` (Aufwand-Ertrag-Analyse, LLM-Pfad,
Konfigurator-Weiche, 12-Slice-Roadmap) und
`docs/product/UNI_RAHMENVERTRAG_ANFRAGE_PAKETE_2026-06-12.md` (Paket-Destillat
aus dem GDrive-Rahmenvertragsmaterial).

## Context

Beide Dateien lagen untracked im Working Tree. Vor dem Commit wurden zwei in der
Sichtung (2026-06-13) gefundene Punkte korrigiert:

1. Berichtskopf datiert den inzwischen erfolgten Merge des
   Uni-Rahmenvertrag-Datenlayers (`1aebd6d` / `92259af`) nach.
2. Anhang A: Slice 5 (Batch-Klassifikation) hing fälschlich an Slice 2
   (Hetzner-Deploy) — die Klassifikation ist ein lokales Offline-Script und
   hat keine Deploy-Abhängigkeit.

## Constraints

Reiner Doku-PR, kein Produkt-/Test-Code. Doku-Budget-Regel greift nicht
(explizit Doku-PR). Draft-PR, kein Merge — Alexander mergt.

## Validation

- `npx vitest run` grün (Suite unverändert, keine Code-Dateien berührt).
- `git diff --check` sauber, Diff enthält ausschließlich die zwei Dokumente
  und dieses Goal-File.
