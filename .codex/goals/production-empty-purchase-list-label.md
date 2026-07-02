# Production Empty Purchase List Label

- Ziel: Leere Einkaufslisten im Produktionsarbeitsstand ehrlich als ohne Positionen anzeigen.
- Scope: Backoffice-Anzeigestate und Tests; keine API-, Schema- oder Planungslogik.
- Beobachtung: Browser-Probe zeigte im ersten Produktionsbild "Einkauf: 1 Liste · 0 Positionen".
- Erfolg: Zusammenfassung und Panel zeigen "Liste ohne Positionen" bzw. "Keine Einkaufspositionen ermittelt.".
