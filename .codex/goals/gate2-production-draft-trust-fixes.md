# Gate 2 ProductionDraft trust fixes

Ziel: Anonymisierte Realdokumente wahrheitsgemäß kennzeichnen und stille
Ernährungskategorien im ProductionDraft verhindern.

Abnahme:
- Default bleibt `synthetic_or_demo_only`; explizite Service-Konfiguration
  setzt `pseudonymized_approved` bis in Adapter und Audit.
- Ungültige Datenmodus-Konfiguration scheitert klar beim App-Start.
- Eine Kategorie bleibt nur mit einer im Quelltext belegten Evidenzstelle;
  unbelegte Kategorien werden entfernt und als Rückfrage sichtbar.
- Draft-only, Human Approval, Providertransporte und Produktmodelle bleiben
  unverändert.
