export interface ProductionMiniPilotCardState {
  eyebrow: string;
  title: string;
  helperText: string;
  steps: Array<{
    title: string;
    body: string;
  }>;
}

export function buildProductionMiniPilotCardState(): ProductionMiniPilotCardState {
  return {
    eyebrow: "Interner Draft-Pilot",
    title: "Produktions-Draft lokal gegen den Mini-Pilot-Rahmen prüfen",
    helperText:
      "Nur benannte interne Operatoren, nur Draft-Ausgaben, keine automatische Übernahme in Produktobjekte oder Freigaben.",
    steps: [
      {
        title: "1. Check auslösen",
        body: "npm run llm:synthetic-live:check:mini-pilot"
      },
      {
        title: "2. Ergebnis lesen",
        body: "Nur bei ready weiterarbeiten; blocked bleibt Stop statt stiller Produktionsfreigabe."
      },
      {
        title: "3. Draft behandeln",
        body: "Draft nur manuell prüfen, fachlich bewerten und bewusst übernehmen."
      }
    ]
  };
}
