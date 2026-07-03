# Goal: Empty purchase handoff honesty

- Reproduced after #537: purchase panel says an empty list has no positions, but handoff still says "Einkaufsliste vorhanden".
- Fix only the production handoff/status presentation so empty purchase-list shells are labelled "Einkaufsliste ohne Positionen".
- Keep non-empty purchase lists labelled "Einkaufsliste vorhanden".
- Do not change backend exports, persistence, purchase-list schemas, or calculation logic.
- Validate with focused state and route tests plus full gate.
