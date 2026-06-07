export interface HomeMiniPilotCardState {
  eyebrow: string;
  title: string;
  helperText: string;
  steps: Array<{
    title: string;
    body: string;
  }>;
}

export function buildHomeMiniPilotCardState(): HomeMiniPilotCardState {
  return {
    eyebrow: "Interner Mini-Pilot",
    title: "Draft-Probe lokal und kontrolliert prüfen",
    helperText:
      "Nur für benannte interne Operatoren, nur Draft-Ausgaben, keine automatische Produktänderung.",
    steps: [
      {
        title: "1. Kompakter Check",
        body: "npm run llm:synthetic-live:check:mini-pilot"
      },
      {
        title: "2. Status lesen",
        body: "ready oder blocked mit Grund und nächstem sicheren Schritt direkt im JSON-Ergebnis."
      },
      {
        title: "3. Draft behandeln",
        body: "Ergebnisse nur manuell prüfen und bewusst übernehmen; keine automatische Schreibwirkung."
      }
    ]
  };
}
