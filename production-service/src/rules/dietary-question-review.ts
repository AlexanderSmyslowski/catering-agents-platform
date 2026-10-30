import { createHash } from "node:crypto";
import type { AcceptedEventSpec, CaseEvent, ProductionDraft, ProductionDraftReviewCard } from "@catering/shared-core";

/** Cards bind a single extraction question and the currently stated category to one revision. */
export function buildDietaryQuestionReviewCards(input: {
  businessId: string;
  caseId: string;
  draftId: string;
  revision: number;
  spec: AcceptedEventSpec;
}): ProductionDraftReviewCard[] {
  const prefix = "Welche Ernährungskennzeichnung gilt nach Rezeptprüfung für ";
  return (input.spec.uncertainties ?? []).flatMap((question, index) => {
    const prompt = question.suggestedQuestion;
    if (question.field !== "menuPlan" || !prompt?.startsWith(prefix) || !prompt.endsWith("?")) return [];
    const label = prompt.slice(prefix.length, -1);
    const knownExtraction = question.severity === "medium" &&
      question.message.startsWith(`Ernährungsangabe für ${label}: `) &&
      question.message.endsWith(". Kennzeichnung vor Freigabe anhand des Rezepts prüfen.");
    const matches = input.spec.menuPlan.filter(component => component.label === label);
    const questionMatches = (input.spec.uncertainties ?? []).filter(item => item.field === "menuPlan" && item.suggestedQuestion === prompt);
    const component = matches.length === 1 ? matches[0] : undefined;
    const category = component?.menuCategory;
    const valid = Boolean(knownExtraction && questionMatches.length === 1 && component && input.spec.menuPlan.filter(item => item.componentId === component.componentId).length === 1 && ["classic", "vegetarian", "vegan"].includes(category ?? ""));
    const fingerprint = createHash("sha256").update(JSON.stringify([
      input.businessId, input.caseId, input.draftId, input.revision, question,
      component?.componentId ?? null, category ?? null, index
    ])).digest("hex");
    return [{
      cardId: `dietary-question-${fingerprint}`,
      kind: "event_data" as const,
      title: valid ? `Ernährungskennzeichnung: ${label}`.slice(0, 160) : "Ernährungskennzeichnung noch offen",
      summary: (valid ? `${prompt} Angegebene Kategorie: ${category}. Keine Allergen- oder Küchenfreigabe.` : `${prompt} Gericht oder Kategorie ist nicht eindeutig; die Frage bleibt offen.`).slice(0, 1000),
      decision: "pending" as const,
      targetPath: `$.draftArtifacts.eventSpec.uncertainties[${index}]`,
      ...(component ? { targetId: component.componentId } : {}),
      riskLevel: valid ? "medium" as const : "blocking" as const,
      requiredApproval: true
    }];
  });
}

export function dietaryCardCanFit(businessId: string, caseId: string | undefined, draft: ProductionDraft, card: ProductionDraftReviewCard): boolean {
  const spec = draft.draftArtifacts.eventSpec;
  if (!caseId || !spec) return false;
  const expected = buildDietaryQuestionReviewCards({ businessId, caseId, draftId: draft.draftId, revision: draft.revision, spec }).find(item => item.cardId === card.cardId);
  return Boolean(expected && expected.riskLevel !== "blocking" && draft.reviewCards.filter(item => item.cardId === card.cardId).length === 1 &&
    card.kind === expected.kind && card.targetPath === expected.targetPath && card.targetId === expected.targetId &&
    card.riskLevel === expected.riskLevel && card.requiredApproval === true);
}

export function projectDietaryQuestionReviews(businessId: string, caseId: string, draft: ProductionDraft, events: CaseEvent[]) {
  const spec = draft.draftArtifacts.eventSpec;
  if (!spec) return [];
  return buildDietaryQuestionReviewCards({ businessId, caseId, draftId: draft.draftId, revision: draft.revision, spec }).map(expected => {
    const index = Number(expected.targetPath?.match(/\[(\d+)\]$/)?.[1]);
    const question = spec.uncertainties?.[index]?.suggestedQuestion ?? "";
    const matches = draft.reviewCards.filter(card => card.cardId === expected.cardId);
    const card = matches.length === 1 ? matches[0] : undefined;
    const identity = card?.decidedAt && `review:${draft.draftId}:${card.cardId}:${card.decidedAt}`;
    const eventId = identity && `production-case-event-${createHash("sha256").update(`${businessId}\0${caseId}\0review_decision\0${identity}`).digest("hex")}`;
    const confirmed = expected.riskLevel !== "blocking" && card?.decision === "fits" &&
      card.kind === expected.kind && card.targetPath === expected.targetPath && card.targetId === expected.targetId &&
      card.riskLevel === expected.riskLevel && card.requiredApproval === true &&
      events.some(event => event.eventId === eventId && event.businessId === businessId && event.caseId === caseId &&
        event.kind === "review_decision" && event.role === "user" && event.artifactId === draft.draftId &&
        event.at === card.decidedAt && event.text === "Prüfpunkt als „Passt“ bewertet.");
    const category = spec.menuPlan.find(component => component.componentId === expected.targetId)?.menuCategory;
    const answer = category === "classic" ? "Klassisch" : category === "vegetarian" ? "Vegetarisch" : category === "vegan" ? "Vegan" : undefined;
    return { question, cardId: expected.cardId, status: confirmed ? "confirmed" as const : "pending" as const, ...(confirmed && answer ? { answer } : {}) };
  });
}
