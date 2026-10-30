import { useEffect, useRef, useState } from "react";
import { decideProductionDraftReviewCard, type ProductionDraft } from "./api.js";
import { announceProductionDraftRefresh } from "./production-draft-review-panel.js";
import { productionDraftEntryUrl } from "./production-entry-focus.js";

export function ProductionDietaryQuestionActions({ caseId, draft, question, busy, onChanged }: {
  caseId: string;
  draft: ProductionDraft;
  question: string;
  busy: boolean;
  onChanged?: () => Promise<void>;
}) {
  const reviews = (draft.dietaryQuestionReviews ?? []).filter(item => item.question === question);
  const review = reviews.length === 1 ? reviews[0] : undefined;
  const cards = draft.reviewCards.filter(item => item.cardId === review?.cardId);
  const card = cards.length === 1 ? cards[0] : undefined;
  const spec = draft.draftArtifacts?.eventSpec;
  const uncertainties = Array.isArray(spec?.uncertainties) ? spec.uncertainties : [];
  const components = Array.isArray(spec?.menuPlan) ? spec.menuPlan : [];
  const index = card?.targetPath?.match(/^\$\.draftArtifacts\.eventSpec\.uncertainties\[(\d+)\]$/)?.[1];
  const uncertainty = index === undefined ? undefined : uncertainties[Number(index)] as Record<string, unknown> | undefined;
  const matchingQuestions = uncertainties.filter(item => item && typeof item === "object" && (item as Record<string, unknown>).field === "menuPlan" && (item as Record<string, unknown>).suggestedQuestion === question);
  const matchingComponents = components.filter(item => item && typeof item === "object" && (item as Record<string, unknown>).componentId === card?.targetId) as Array<Record<string, unknown>>;
  const component = matchingComponents.length === 1 ? matchingComponents[0] : undefined;
  const label = component?.label;
  const category = component?.menuCategory;
  const labelMatches = components.filter(item => item && typeof item === "object" && (item as Record<string, unknown>).label === label);
  const categoryLabel = category === "vegan" ? "Vegan" : category === "vegetarian" ? "Vegetarisch" : category === "classic" ? "Klassisch" : undefined;
  const valid = Boolean(review && card && card.kind === "event_data" && card.requiredApproval && card.riskLevel !== "blocking" &&
    typeof label === "string" && question === `Welche Ernährungskennzeichnung gilt nach Rezeptprüfung für ${label}?` &&
    uncertainty?.field === "menuPlan" && uncertainty.suggestedQuestion === question && matchingQuestions.length === 1 &&
    component && labelMatches.length === 1 && categoryLabel);
  const binding = JSON.stringify([caseId, draft.draftId, draft.revision, question, review?.cardId, review?.status, draft.status, category, valid]);
  const generation = useRef({ binding, value: 0 });
  if (generation.current.binding !== binding) generation.current = { binding, value: generation.current.value + 1 };
  const mounted = useRef(false);
  const inFlight = useRef<number | undefined>(undefined);
  const [feedback, setFeedback] = useState<{ generation: number; text: string }>();
  const [working, setWorking] = useState<number>();
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; generation.current.value += 1; }; }, []);

  async function decide(decision: "fits" | "unclear") {
    const current = generation.current.value;
    if (!valid || !review || draft.status !== "pending_review" || busy || inFlight.current === current || feedback?.generation === current) return;
    inFlight.current = current;
    setWorking(current);
    setFeedback(undefined);
    const isCurrent = () => mounted.current && generation.current.value === current;
    try {
      await decideProductionDraftReviewCard(draft.draftId, review.cardId, decision);
      if (!isCurrent()) return;
      announceProductionDraftRefresh();
      await onChanged?.();
    } catch {
      if (isCurrent()) setFeedback({ generation: current, text: "Die Änderung konnte nicht sicher bestätigt werden. Bitte den Auftrag erneut laden und prüfen." });
    } finally {
      if (inFlight.current === current) inFlight.current = undefined;
      if (isCurrent()) setWorking(undefined);
    }
  }

  if (!question.startsWith("Welche Ernährungskennzeichnung gilt nach Rezeptprüfung für ") || !question.endsWith("?") || draft.status !== "pending_review") return null;
  return <div>
    <p>Nur Ernährungskennzeichnung. Allergene und Küchenfreigabe separat prüfen.</p>
    {valid && review?.status === "confirmed" && review.answer ? <p role="status">Gespeichert: {review.answer} bestätigt.</p> : null}
    {valid && review?.status === "pending" && card?.decision === "unclear" ? <p role="status">Als offen markiert. Über „Angaben oder Kennzeichnung ändern“ korrigieren oder später bestätigen.</p> : null}
    {!valid ? <p>Kennzeichnung noch klären</p> : review?.status === "pending" ? <div>
      <button type="button" disabled={busy || working === generation.current.value || feedback?.generation === generation.current.value} onClick={() => void decide("fits")}>{categoryLabel} bestätigen</button>
      <button type="button" className="secondary-button" disabled={busy || working === generation.current.value || feedback?.generation === generation.current.value} onClick={() => void decide("unclear")}>Bleibt offen</button>
    </div> : null}
    {feedback?.generation === generation.current.value ? <p role="alert">{feedback.text} <a href={productionDraftEntryUrl(draft.draftId, caseId)}>Auftrag erneut laden</a></p> : null}
  </div>;
}
