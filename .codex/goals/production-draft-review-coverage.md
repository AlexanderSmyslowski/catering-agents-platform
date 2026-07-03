# ProductionDraft Review Coverage

- Ziel: BYO-AI/Agent-ProductionDrafts muessen jedes uebernehmbare Artefakt reviewbar machen.
- Scope: Import-Gate und Tests; keine Produktobjekt-, Planungs- oder UI-Logik.
- Befund: Ein kompletter KI-Paketentwurf koennte mit zu wenigen Review-Karten importiert werden.
- Erfolg: Import lehnt Entwuerfe ab, wenn EventSpec, Plan, Einkaufsliste oder einzelne Rezepte keine passende Review-Karte haben.
