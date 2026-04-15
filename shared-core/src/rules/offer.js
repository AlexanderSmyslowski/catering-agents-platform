import { moduleCatalog, eventTypeDefaults } from "../taxonomies/defaults.js";
import { SCHEMA_VERSION } from "../types.js";
import { normalizeEventRequestToSpec } from "./normalization.js";
import { priceModules } from "./pricing.js";
function materializeModules(spec) {
    const defaultModules = eventTypeDefaults[spec.servicePlan.eventType]?.modules ?? [];
    const selectedModuleIds = [...new Set(defaultModules)];
    return selectedModuleIds.reduce((modules, moduleId) => {
        const entry = moduleCatalog[moduleId];
        if (!entry) {
            return modules;
        }
        modules.push({
            moduleId,
            label: entry.label,
            category: entry.category,
            quantity: entry.pricingModel === "flat" ? 1 : spec.attendees.expected,
            pricing: {
                amount: entry.amount,
                currency: "EUR"
            }
        });
        return modules;
    }, []);
}
function adjustVariant(spec, tier) {
    const multiplier = tier === "premium" ? 1.2 : tier === "economy" ? 0.9 : 1;
    const menuPlan = spec.menuPlan.map((component) => ({
        ...component,
        label: tier === "premium"
            ? `${component.label} mit Premium-Finish`
            : tier === "economy"
                ? `${component.label} kompakt`
                : component.label
    }));
    const servicePlan = {
        ...spec.servicePlan,
        staffingStyle: tier === "premium"
            ? "full_service_plus"
            : tier === "economy"
                ? "lean_service"
                : spec.servicePlan.staffingStyle
    };
    const budgetContext = spec.budgetContext?.pricingSummary
        ? {
            ...spec.budgetContext,
            pricingSummary: {
                ...spec.budgetContext.pricingSummary,
                subtotal: {
                    amount: Number((spec.budgetContext.pricingSummary.subtotal.amount * multiplier).toFixed(2)),
                    currency: "EUR"
                }
            }
        }
        : spec.budgetContext;
    return {
        ...spec,
        menuPlan,
        servicePlan,
        budgetContext
    };
}
export function createOfferDraft(request) {
    const baseSpec = normalizeEventRequestToSpec(request, {
        sourceType: "offer_service",
        reference: request.requestId,
        commercialState: "quoted"
    });
    const modules = materializeModules(baseSpec);
    const pricingSummary = priceModules(modules, baseSpec.attendees.expected);
    const proposedEventSpec = {
        ...baseSpec,
        servicePlan: {
            ...baseSpec.servicePlan,
            modules
        },
        budgetContext: {
            pricingSummary
        }
    };
    const variants = [
        ["economy", "Wirtschaftlich"],
        ["standard", "Ausgewogen"],
        ["premium", "Premium"]
    ].map(([qualityTier, label], index) => ({
        variantId: `variant-${index + 1}`,
        label,
        qualityTier: qualityTier,
        estimatedPrice: {
            amount: Number((pricingSummary.subtotal.amount *
                (qualityTier === "premium" ? 1.2 : qualityTier === "economy" ? 0.9 : 1)).toFixed(2)),
            currency: "EUR"
        },
        moduleIds: modules.map((module) => module.moduleId),
        proposedEventSpec: adjustVariant(proposedEventSpec, qualityTier)
    }));
    const assumptions = [
        ...(proposedEventSpec.assumptions ?? []),
        {
            code: "offer_modules_defaulted",
            message: "Offer modules derived from event type defaults and current attendee count.",
            applied: true
        }
    ];
    const openQuestions = [
        ...(proposedEventSpec.missingFields ?? []),
        ...(proposedEventSpec.uncertainties ?? []).map((uncertainty) => uncertainty.suggestedQuestion ?? uncertainty.message)
    ];
    const eventSummary = `${proposedEventSpec.servicePlan.eventType} fuer ${proposedEventSpec.attendees.expected ?? "offene"} Teilnehmer in ${proposedEventSpec.event.serviceForm ?? proposedEventSpec.servicePlan.serviceForm}.`;
    const customerFacingText = [
        `Vielen Dank fuer Ihre Anfrage fuer ein ${proposedEventSpec.servicePlan.eventType}.`,
        `Wir schlagen ein ${proposedEventSpec.servicePlan.serviceForm} mit folgenden Leistungsbausteinen vor:`,
        ...modules.map((module) => `- ${module.label}`),
        `Gesamtschaetzung: ${pricingSummary.subtotal.amount.toFixed(2)} EUR.`
    ].join("\n");
    const internalWorkingText = [
        `Draft-ID: draft-${request.requestId}`,
        `Status: ${proposedEventSpec.readiness.status}`,
        ...(openQuestions.length > 0 ? ["Offene Punkte:", ...openQuestions.map((item) => `- ${item}`)] : [])
    ].join("\n");
    return {
        schemaVersion: SCHEMA_VERSION,
        draftId: `draft-${request.requestId}`,
        eventSummary,
        serviceModules: modules,
        pricingSummary,
        assumptions,
        openQuestions,
        variantSet: variants,
        customerFacingText,
        internalWorkingText,
        proposedEventSpec
    };
}
export function promoteOfferVariant(draft, variantId) {
    const variant = draft.variantSet.find((item) => item.variantId === variantId) ??
        draft.variantSet.find((item) => item.qualityTier === "standard") ??
        draft.variantSet[0];
    return {
        ...variant.proposedEventSpec,
        specId: `${draft.draftId}-${variant.variantId}`,
        lifecycle: {
            commercialState: "quoted"
        },
        sourceLineage: [
            {
                sourceType: "offer_service",
                reference: draft.draftId
            }
        ]
    };
}
