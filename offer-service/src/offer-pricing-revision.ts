import { createHash } from "node:crypto";
import { calculateOfferPricing, validateOfferDraft, type OfferDraft } from "@catering/shared-core";

export function reviseOfferPricing(source: OfferDraft, caseId: string, variantId: string, input: unknown): OfferDraft {
  const variant = source.variantSet.find(item => item.variantId === variantId);
  if (!variant) throw new Error("Bitte eine vorhandene Angebotsvariante wählen.");
  const guestCount = variant.proposedEventSpec.attendees.expected;
  const pricingSummary = calculateOfferPricing(input, guestCount ?? 0);
  if (pricingSummary.calculation!.lines.some(line => line.directCost !== undefined)) {
    throw new Error("Diese Version kann interne Kosten nur lesen. Zum Speichern eine Version mit Kostenerfassung verwenden.");
  }
  const food = pricingSummary.calculation!.lines.filter(line => line.category === "food");
  if (food.length !== 1 || food[0]!.unit !== "guest" || food[0]!.quantity !== String(guestCount)) {
    throw new Error("Genau ein Speisen-Grundpaket für die Gästezahl dieser Fassung ist erforderlich. Es umfasst das vollständige Menü.");
  }
  const draftId = "draft-pricing-" + createHash("sha256").update(JSON.stringify([
    source.businessId, caseId, source.draftId, source.revision, variantId, pricingSummary.calculation
  ])).digest("hex");
  const proposedEventSpec = {
    ...structuredClone(variant.proposedEventSpec),
    budgetContext: { ...variant.proposedEventSpec.budgetContext, pricingSummary }
  };
  return validateOfferDraft({
    ...source, draftId, revision: 1, proposedEventSpec,
    serviceModules: structuredClone(proposedEventSpec.servicePlan.modules),
    pricingSummary,
    variantSet: [{
      ...variant, variantId: "calculated", label: "Kalkulierte Fassung – " + variant.label,
      estimatedPrice: structuredClone(pricingSummary.subtotal),
      proposedEventSpec: structuredClone(proposedEventSpec)
    }],
    customerFacingText: [
      source.eventSummary,
      "Speisen-Grundpaket für das vollständige Menü dieser Fassung:",
      ...proposedEventSpec.menuPlan.map(item => "- " + item.label + ": " + (item.servings ?? "offene") + " Portionen"),
      "Preisaufstellung netto:",
      ...pricingSummary.calculation!.lines.map(line => "- " + line.label + ": " + line.quantity + " " + line.unit
        + " × " + (line.unitNetCents / 100).toFixed(2) + " EUR = " + (line.netCents / 100).toFixed(2) + " EUR"),
      "Netto gesamt: " + pricingSummary.subtotal.amount.toFixed(2) + " EUR.",
      ...pricingSummary.notes!
    ].join("\n"),
    internalWorkingText: "Preisaufstellung aus " + source.draftId + " / Revision " + source.revision
      + " / Variante " + variantId + ". Vorherige Freigaben gelten nicht für diese neue Fassung.\n" + source.internalWorkingText,
    reviewStatus: {
      ...source.reviewStatus, priceReviewStatus: "review_required", taxReviewStatus: "review_required",
      allergenReviewStatus: "review_required", hygieneTemperatureReviewStatus: "review_required",
      sourceSecured: source.reviewStatus?.sourceSecured ?? false, publishApproved: false
    }
  });
}
