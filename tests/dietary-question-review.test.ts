import { describe, expect, it } from "vitest";
import { createHash } from "node:crypto";
import type { AcceptedEventSpec, CaseEvent, ProductionDraft } from "@catering/shared-core";
import { buildDietaryQuestionReviewCards, dietaryCardCanFit, projectDietaryQuestionReviews } from "../production-service/src/rules/dietary-question-review.js";

const question = { field: "menuPlan", severity: "medium" as const, message: "Ernährungsangabe für Gericht: vegan. Kennzeichnung vor Freigabe anhand des Rezepts prüfen.", suggestedQuestion: "Welche Ernährungskennzeichnung gilt nach Rezeptprüfung für Gericht?" };
const input = {
  businessId: "business", caseId: "case", draftId: "draft", revision: 2,
  spec: { menuPlan: [{ componentId: "component", label: "Gericht", menuCategory: "vegan" }], uncertainties: [question] } as AcceptedEventSpec
};

describe("dietary question review bindings", () => {
  it("binds the exact question, component, category, case and revision", () => {
    const [card] = buildDietaryQuestionReviewCards(input);
    expect(card).toMatchObject({ decision: "pending", requiredApproval: true, targetId: "component", targetPath: "$.draftArtifacts.eventSpec.uncertainties[0]", riskLevel: "medium" });
    expect(buildDietaryQuestionReviewCards({ ...input, revision: 3 })[0]?.cardId).not.toBe(card?.cardId);
    expect(buildDietaryQuestionReviewCards({ ...input, caseId: "other" })[0]?.cardId).not.toBe(card?.cardId);
    expect(buildDietaryQuestionReviewCards({ ...input, spec: { ...input.spec, menuPlan: [{ ...input.spec.menuPlan[0]!, menuCategory: "classic" }] } })[0]?.cardId).not.toBe(card?.cardId);
  });
  it("keeps ambiguous matches and missing categories blocking", () => {
    expect(buildDietaryQuestionReviewCards({ ...input, spec: { ...input.spec, menuPlan: [...input.spec.menuPlan, input.spec.menuPlan[0]!] } })[0]).toMatchObject({ riskLevel: "blocking", decision: "pending" });
    expect(buildDietaryQuestionReviewCards({ ...input, spec: { ...input.spec, menuPlan: [{ ...input.spec.menuPlan[0]!, menuCategory: undefined }] } })[0]).toMatchObject({ riskLevel: "blocking", decision: "pending" });
    const duplicate = buildDietaryQuestionReviewCards({ ...input, spec: { ...input.spec, uncertainties: [question, question] } });
    expect(duplicate.map(card => card.riskLevel)).toEqual(["blocking", "blocking"]);
    expect(new Set(duplicate.map(card => card.cardId)).size).toBe(2);
  });
  it("bounds card display text while preserving the exact question binding", () => {
    const label = "L".repeat(1100);
    const longQuestion = { ...question, message: `Ernährungsangabe für ${label}: vegan. Kennzeichnung vor Freigabe anhand des Rezepts prüfen.`, suggestedQuestion: `Welche Ernährungskennzeichnung gilt nach Rezeptprüfung für ${label}?` };
    const [card] = buildDietaryQuestionReviewCards({ ...input, spec: { ...input.spec, menuPlan: [{ ...input.spec.menuPlan[0]!, label }], uncertainties: [longQuestion] } });
    expect(card!.title.length).toBeLessThanOrEqual(160);
    expect(card!.summary.length).toBeLessThanOrEqual(1000);
    expect(card!.riskLevel).toBe("medium");
  });
  it("requires the exact current card and case event before projecting confirmation", () => {
    const card = { ...buildDietaryQuestionReviewCards(input)[0]!, decision: "fits" as const, decidedAt: "2026-10-30T10:00:00.000Z" };
    const draft = { draftId: input.draftId, revision: input.revision, reviewCards: [card], draftArtifacts: { eventSpec: input.spec } } as ProductionDraft;
    const eventId = `production-case-event-${createHash("sha256").update(`${input.businessId}\0${input.caseId}\0review_decision\0review:${input.draftId}:${card.cardId}:${card.decidedAt}`).digest("hex")}`;
    const event = { eventId, businessId: input.businessId, caseId: input.caseId, kind: "review_decision", role: "user", artifactId: input.draftId, at: card.decidedAt, text: "Prüfpunkt als „Passt“ bewertet." } as CaseEvent;
    const project = (d: ProductionDraft, e: CaseEvent[]) => projectDietaryQuestionReviews(input.businessId, input.caseId, d, e)[0]?.status;
    expect(project(draft, [event])).toBe("confirmed");
    expect(project(draft, [])).toBe("pending");
    expect(project(draft, [{ ...event, caseId: "other" }])).toBe("pending");
    expect(project({ ...draft, revision: 3 }, [event])).toBe("pending");
    expect(project({ ...draft, reviewCards: [{ ...card, targetId: "other" }] }, [event])).toBe("pending");
    expect(dietaryCardCanFit(input.businessId, input.caseId, draft, card)).toBe(true);
    expect(dietaryCardCanFit(input.businessId, "other", draft, card)).toBe(false);
  });
});
