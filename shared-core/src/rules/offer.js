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
function packageModules(packagePreset, attendeeCount) {
    const foodModules = packagePreset.food_modules ?? [];
    const serviceModules = packagePreset.service_modules ?? [];
    return [
        ...foodModules.map((label, index) => ({
            moduleId: `${packagePreset.id}-food-${index + 1}`,
            label,
            category: "food",
            quantity: attendeeCount
        })),
        ...serviceModules.map((label, index) => ({
            moduleId: `${packagePreset.id}-service-${index + 1}`,
            label,
            category: "service",
            quantity: 1
        }))
    ];
}
function packagePricingSummary(packagePreset, attendeeCount) {
    const [from, to] = packagePreset.price_band_pp;
    const midpoint = Number(((from + to) / 2).toFixed(2));
    return {
        subtotal: {
            amount: Number((midpoint * attendeeCount).toFixed(2)),
            currency: "EUR"
        },
        perPerson: {
            amount: midpoint,
            currency: "EUR"
        },
        notes: [
            `Arbeitsband aus kuratiertem App-Transfer-Paket: ${from.toFixed(2)}-${to.toFixed(2)} EUR p.P.`,
            "Preisband, Netto/Brutto und MwSt. sind pruefpflichtig."
        ]
    };
}
function reviewRequiredStatus() {
    return {
        priceReviewStatus: "review_required",
        taxReviewStatus: "review_required",
        allergenReviewStatus: "review_required",
        hygieneTemperatureReviewStatus: "review_required",
        sourceSecured: true,
        publishApproved: false
    };
}
function createPortfolioMapping(packagePreset) {
    const [from, to] = packagePreset.price_band_pp;
    const evidenceSummary = packagePreset.source_evidence
        ? [
            packagePreset.source_evidence.records_cluster_total
                ? `${packagePreset.source_evidence.records_cluster_total} kuratierte Cluster-Datensaetze`
                : undefined,
            packagePreset.source_evidence.records_cluster_2025_2026
                ? `${packagePreset.source_evidence.records_cluster_2025_2026} Datensaetze 2025/2026`
                : undefined
        ]
            .filter(Boolean)
            .join("; ")
        : undefined;
    return {
        packageId: packagePreset.id,
        packageName: packagePreset.name,
        source: "curated_app_transfer",
        minPax: packagePreset.min_pax,
        workingBandPerPerson: {
            from,
            to,
            currency: "EUR"
        },
        evidenceSummary
    };
}
function createProductionHandoff(draftId, specId, packagePreset, reviewStatus) {
    return {
        handoffId: `handoff-${draftId}`,
        draftId,
        specId,
        status: "review_required",
        sourcePackageId: packagePreset.id,
        reviewStatus,
        customerOfferVisible: true,
        internalCalculationVisible: false
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
export function createCuratedOfferDraft(request, packagePreset) {
    const baseDraft = createOfferDraft(request);
    const attendeeCount = baseDraft.proposedEventSpec.attendees.expected ?? 0;
    const modules = packageModules(packagePreset, attendeeCount);
    const pricingSummary = packagePricingSummary(packagePreset, attendeeCount);
    const reviewStatus = reviewRequiredStatus();
    const portfolioMapping = createPortfolioMapping(packagePreset);
    const menuPlan = (packagePreset.food_modules ?? []).map((label, index) => ({
        componentId: `${packagePreset.id}-menu-${index + 1}`,
        label,
        serviceStyle: baseDraft.proposedEventSpec.servicePlan.serviceForm,
        servings: attendeeCount
    }));
    const proposedEventSpec = {
        ...baseDraft.proposedEventSpec,
        servicePlan: {
            ...baseDraft.proposedEventSpec.servicePlan,
            modules
        },
        menuPlan,
        budgetContext: {
            ...(baseDraft.proposedEventSpec.budgetContext ?? {}),
            pricingSummary
        },
        productionConstraints: [
            ...(baseDraft.proposedEventSpec.productionConstraints ?? []),
            "Angebotspreise, MwSt., Allergene, Hygiene/Temperaturfuehrung und Logistik vor Produktion pruefen."
        ]
    };
    const variants = [
        ["economy", "Unteres Arbeitsband", packagePreset.price_band_pp[0]],
        ["standard", "Mitte Arbeitsband", pricingSummary.perPerson?.amount ?? packagePreset.price_band_pp[0]],
        ["premium", "Oberes Arbeitsband", packagePreset.price_band_pp[1]]
    ].map(([qualityTier, label, perPerson], index) => ({
        variantId: `variant-${index + 1}`,
        label,
        qualityTier,
        estimatedPrice: {
            amount: Number((perPerson * attendeeCount).toFixed(2)),
            currency: "EUR"
        },
        moduleIds: modules.map((module) => module.moduleId),
        proposedEventSpec: {
            ...proposedEventSpec,
            budgetContext: {
                ...proposedEventSpec.budgetContext,
                pricingSummary: {
                    ...pricingSummary,
                    subtotal: {
                        amount: Number((perPerson * attendeeCount).toFixed(2)),
                        currency: "EUR"
                    },
                    perPerson: {
                        amount: perPerson,
                        currency: "EUR"
                    }
                }
            }
        }
    }));
    const draftId = baseDraft.draftId;
    return {
        ...baseDraft,
        eventSummary: `${packagePreset.name} fuer ${attendeeCount} Teilnehmer.`,
        serviceModules: modules,
        pricingSummary,
        assumptions: [
            ...baseDraft.assumptions,
            {
                code: "curated_app_transfer_offer_package",
                message: `Offer draft mapped from curated App-Transfer package ${packagePreset.id}.`,
                applied: true
            }
        ],
        openQuestions: [
            ...baseDraft.openQuestions,
            "Preisband, Netto/Brutto und MwSt. fachlich pruefen.",
            "Allergene, Hygiene, Temperaturfuehrung und Standzeiten pruefen.",
            "Logistik, Equipment und Personalumfang pruefen."
        ],
        variantSet: variants,
        customerFacingText: [
            `Vielen Dank fuer Ihre Anfrage. Wir schlagen ${packagePreset.name} vor.`,
            `Leistungsrahmen:`,
            ...modules.map((module) => `- ${module.label}`),
            `Arbeitsband: ${packagePreset.price_band_pp[0].toFixed(2)}-${packagePreset.price_band_pp[1].toFixed(2)} EUR p.P.`,
            `Voraussichtliche Gesamtschaetzung: ${pricingSummary.subtotal.amount.toFixed(2)} EUR.`
        ].join("\n"),
        internalWorkingText: [
            `Draft-ID: ${draftId}`,
            `Portfolio-Paket: ${packagePreset.id}`,
            "Quelle: kuratierter App-Transfer-Ordner",
            `Pruefstatus Preis: ${reviewStatus.priceReviewStatus}`,
            `Pruefstatus MwSt.: ${reviewStatus.taxReviewStatus}`,
            `Pruefstatus Allergene: ${reviewStatus.allergenReviewStatus}`,
            `Pruefstatus Hygiene/Temperatur: ${reviewStatus.hygieneTemperatureReviewStatus}`,
            "Publish-Freigabe: false"
        ].join("\n"),
        proposedEventSpec,
        portfolioMapping,
        reviewStatus,
        productionHandoff: createProductionHandoff(draftId, proposedEventSpec.specId, packagePreset, reviewStatus)
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
