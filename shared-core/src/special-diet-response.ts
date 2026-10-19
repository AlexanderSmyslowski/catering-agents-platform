import type { AcceptedEventSpec, Uncertainty } from "./types.js";

export function isExtractedSpecialDietQuestion(question: Uncertainty): boolean {
  return question.field === "productionConstraints" && question.severity === "medium" &&
    question.message === "Angefragte Sonderkostfälle benötigen eine gesonderte fachliche Klärung." &&
    question.suggestedQuestion === "Welche Maßnahmen und Freigaben gelten für die angefragten Sonderkostfälle?";
}

export function recordSpecialDietResponse(spec: AcceptedEventSpec, answer: unknown, actorName: string): AcceptedEventSpec {
  if (typeof answer !== "string" || !answer.trim() || answer.length > 500) {
    throw new Error("Sonderkost-Antwort benötigt 1–500 Zeichen.");
  }
  if (!spec.uncertainties?.some(isExtractedSpecialDietQuestion)) {
    throw new Error("Diese Fassung enthält keine durch dieses Feld beantwortbare Sonderkost-Rückfrage.");
  }
  // This records the operator's clarification. It does not assert free-from
  // suitability, alter the menu, or replace the subsequent mandatory review.
  return {
    ...spec,
    uncertainties: spec.uncertainties.filter(question => !isExtractedSpecialDietQuestion(question)),
    productionConstraints: [...(spec.productionConstraints ?? []),
      `Sonderkost-Antwort von ${actorName}: ${answer.trim()} — Keine Allergen- oder Küchenfreigabe.`]
  };
}

// Apply replays only this bounded revision shape. It must not permit arbitrary
// constraint deletion or the disappearance of independently authored risks.
export function replaySpecialDietResponse(previous: AcceptedEventSpec, next: AcceptedEventSpec): AcceptedEventSpec | undefined {
  const before = previous.productionConstraints ?? [];
  const after = next.productionConstraints ?? [];
  if (after.length !== before.length + 1 || !before.every((value, index) => value === after[index])) return undefined;
  const match = /^Sonderkost-Antwort von ([^\r\n]+?): ([\s\S]+) — Keine Allergen- oder Küchenfreigabe\.$/.exec(after.at(-1)!);
  if (!match) return undefined;
  try { return recordSpecialDietResponse(previous, match[2], match[1]); }
  catch { return undefined; }
}
