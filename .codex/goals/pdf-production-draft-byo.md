# Slice 2.1: PDF to ProductionDraft via BYO

Goal: route the approved anonymized PDF through the existing BYO draft-only
boundary into ProductionDraft review cards, without silent component loss.

Inputs:
- PDF: `data/gate1/angebot_flying_buffet_45p_anonymisiert.pdf`
- Provider budget: 10 EUR / 100 requests for this slice; external dashboard
  hard limit: 20 EUR/month.

Acceptance:
- Every buffet component named in the PDF appears as a review card or an
  explicit `open_question`; nothing disappears silently.
- Near-miss dishes such as Vitello Tonnato and Kokos-Cheesecake are not
  auto-mapped to unrelated recipe seeds without review evidence.
- Draft-only/no-raw-logging boundaries remain intact; approved apply remains
  the only product-object materialization path.
