import { moduleCatalog } from "../taxonomies/defaults.js";
function money(amount) {
    return {
        amount: Number(amount.toFixed(2)),
        currency: "EUR"
    };
}
export function priceModules(modules, attendees) {
    const subtotal = modules.reduce((sum, module) => {
        const catalogEntry = moduleCatalog[module.moduleId];
        if (!catalogEntry) {
            return sum;
        }
        const amount = catalogEntry.pricingModel === "per_person"
            ? catalogEntry.amount * (attendees ?? 0)
            : catalogEntry.amount * (module.quantity ?? 1);
        return sum + amount;
    }, 0);
    return {
        subtotal: money(subtotal),
        perPerson: attendees && attendees > 0 ? money(subtotal / attendees) : undefined,
        notes: attendees ? [`Calculated for ${attendees} attendees.`] : ["Missing attendee count."]
    };
}
