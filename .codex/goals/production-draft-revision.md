# Goal: ProductionDraft-Revision aus Review-Kommentaren

- Phase 4, vor fachlicher Sichtung des realen Entwurfs.
- Bestehende Review-Karten und BYO-Adapter wiederverwenden.
- `change_requested` braucht einen konkreten Operator-Kommentar.
- Revision erzeugt einen neuen `pending_review`-Entwurf.
- Alter Entwurf wird erst nach erfolgreicher Revision `superseded`.
- Keine Spezifikation, kein Plan und keine Einkaufsliste wird geschrieben.
- Providerfehler lassen den Ausgangsentwurf unverändert.
- Audit speichert nur IDs, Zähler und Hashes, keinen Klartext.
- UI zeigt genau eine ruhige Aktion für kommentierte Änderungen.
- Kein echter Kundendatensatz und kein echter Providerlauf im Slice.

## Abnahme

1. Vollständiger Änderungswunsch erzeugt v2 mit `supersedesDraftId`.
2. Fehlender Kommentar oder falscher Status erzeugt keine Revision.
3. Audit, Tests und Browserprobe belegen Draft-only und Rohtextfreiheit.
