import { describe, expect, it } from "vitest";
import {
  buildProductionPlanComponentMap,
  buildWorkbenchSpecFacts,
  canArchiveCurrentIntake,
  canClearProductionWorkspace,
  countClarificationAnswerStatuses,
  countPurchaseListItems,
  formatActiveProductionContextLabel,
  formatProductionHandoffContextLabel,
  formatProductionHandoffExportLabel,
  formatProductionIntakeOriginLabel,
  formatProductionContextId,
  formatProductionTechnicalContextLabel,
  formatProductionObjectStatusLabel,
  formatProductionPlanStatusLabel,
  formatProductionReadinessLabel,
  formatProductionTimingWindow,
  formatStructuredProductionAnswerSummary,
  lookupProductionSpecById,
  formatPurchaseZoneStatusLabel,
  selectArchivedProductionItems,
  selectProductionArtifactSpecIds,
  selectCurrentProductionItems,
  selectProductionPlanById,
  selectFocusedProductionSpec,
  selectProductionIntakeRequestId,
  selectProductionNextStep,
  selectProductionPlanSpec,
  selectProductionWorkbenchPlan,
  translateReadiness
} from "../backoffice-ui/src/production-route-state.js";

describe("production route state", () => {
  const acceptedSpecs = [
    { specId: "spec-old", label: "old" },
    { specId: "spec-current", label: "current" },
    { specId: "spec-other", label: "other" }
  ];

  it("clears the focused production spec when the workspace is cleared", () => {
    expect(
      selectFocusedProductionSpec({
        acceptedSpecs,
        filteredSpecs: acceptedSpecs,
        focusedProductionSpecId: "spec-current",
        productionWorkspaceCleared: true,
        route: "production",
        searchText: ""
      })
    ).toBeUndefined();
  });

  it("keeps active production search constrained to filtered specs", () => {
    const filteredSpecs = [{ specId: "spec-current", label: "current" }];

    expect(
      selectFocusedProductionSpec({
        acceptedSpecs,
        filteredSpecs,
        focusedProductionSpecId: "spec-other",
        productionWorkspaceCleared: false,
        route: "production",
        searchText: "current"
      })
    ).toBe(filteredSpecs[0]);
  });

  it("falls back to the latest accepted spec when production search is not active", () => {
    expect(
      selectFocusedProductionSpec({
        acceptedSpecs,
        filteredSpecs: [],
        productionWorkspaceCleared: false,
        route: "home",
        searchText: ""
      })
    ).toBe(acceptedSpecs[2]);
  });

  it("does not focus an unrelated accepted spec when production artifacts have no visible spec", () => {
    expect(
      selectFocusedProductionSpec({
        acceptedSpecs,
        filteredSpecs: acceptedSpecs,
        productionArtifactSpecIds: ["spec-plan-only"],
        productionWorkspaceCleared: false,
        route: "production",
        searchText: ""
      })
    ).toBeUndefined();
  });

  it("keeps the latest accepted spec when any visible spec matches production artifacts", () => {
    expect(
      selectFocusedProductionSpec({
        acceptedSpecs,
        filteredSpecs: acceptedSpecs,
        productionArtifactSpecIds: ["spec-current"],
        productionWorkspaceCleared: false,
        route: "production",
        searchText: ""
      })
    ).toBe(acceptedSpecs[2]);
  });

  it("splits current and archived production items by focused spec", () => {
    const items = [
      { id: "plan-a", eventSpecId: "spec-current" },
      { id: "plan-b", eventSpecId: "spec-other" },
      { id: "plan-c", eventSpecId: " spec-current " }
    ];

    expect(
      selectCurrentProductionItems({
        currentProductionSpecId: "spec-current",
        items,
        productionWorkspaceCleared: false
      }).map((item) => item.id)
    ).toEqual(["plan-a", "plan-c"]);
    expect(
      selectArchivedProductionItems({
        currentProductionSpecId: "spec-current",
        items,
        productionWorkspaceCleared: false
      }).map((item) => item.id)
    ).toEqual(["plan-b"]);
  });

  it("looks up production specs with normalized ids for visible artifact labels", () => {
    const spec = { specId: "spec-current" };
    const specsById = new Map([["spec-current", spec]]);

    expect(lookupProductionSpecById(specsById, " spec-current ")).toBe(spec);
    expect(lookupProductionSpecById(specsById, "   ")).toBeUndefined();
    expect(lookupProductionSpecById(specsById, undefined)).toBeUndefined();
  });

  it("formats visible production context ids without stale whitespace", () => {
    expect(formatProductionContextId(" plan-1 ")).toBe("plan-1");
    expect(formatProductionContextId("   ", " spec-fallback ")).toBe("spec-fallback");
    expect(formatProductionContextId(undefined, "   ")).toBe("-");
  });

  it("keeps production item selectors empty when the workspace is cleared", () => {
    const items = [{ id: "plan-a", eventSpecId: "spec-current" }];

    expect(
      selectCurrentProductionItems({
        currentProductionSpecId: "spec-current",
        items,
        productionWorkspaceCleared: true
      })
    ).toEqual([]);
    expect(
      selectArchivedProductionItems({
        currentProductionSpecId: "spec-current",
        items,
        productionWorkspaceCleared: true
      })
    ).toEqual([]);
  });

  it("keeps the previous unscoped production item fallback when no spec is focused", () => {
    const items = [
      { id: "plan-a", eventSpecId: "spec-current" },
      { id: "plan-b", eventSpecId: "spec-other" }
    ];

    expect(
      selectCurrentProductionItems({
        currentProductionSpecId: "",
        items,
        productionWorkspaceCleared: false
      })
    ).toBe(items);
    expect(
      selectArchivedProductionItems({
        currentProductionSpecId: "",
        items,
        productionWorkspaceCleared: false
      })
    ).toEqual([]);
  });

  it("selects the existing production workbench plan priority", () => {
    const currentSpecPlans = [
      { planId: "plan-current-selected", eventSpecId: "spec-current" },
      { planId: "plan-current-first", eventSpecId: "spec-current" }
    ];
    const orderedPlans = [
      { planId: "plan-other-selected", eventSpecId: "spec-other" },
      ...currentSpecPlans,
      { planId: "plan-unscoped", eventSpecId: "spec-archived" }
    ];

    expect(
      selectProductionWorkbenchPlan({
        currentProductionSpecId: "spec-current",
        currentSpecPlans,
        orderedPlans,
        productionWorkspaceCleared: true,
        selectedPlanId: "plan-current-selected"
      })
    ).toBeUndefined();
    expect(
      selectProductionWorkbenchPlan({
        currentProductionSpecId: "spec-current",
        currentSpecPlans,
        orderedPlans,
        productionWorkspaceCleared: false,
        selectedPlanId: " plan-current-selected "
      })
    ).toBe(currentSpecPlans[0]);
    expect(
      selectProductionWorkbenchPlan({
        currentProductionSpecId: "spec-current",
        currentSpecPlans,
        orderedPlans,
        productionWorkspaceCleared: false,
        selectedPlanId: "plan-other-selected"
      })
    ).toBe(orderedPlans[0]);
    expect(
      selectProductionWorkbenchPlan({
        currentProductionSpecId: "spec-current",
        currentSpecPlans,
        orderedPlans,
        productionWorkspaceCleared: false
      })
    ).toBe(currentSpecPlans[0]);
    expect(
      selectProductionWorkbenchPlan({
        currentProductionSpecId: "spec-current",
        currentSpecPlans: [],
        orderedPlans,
        productionWorkspaceCleared: false
      })
    ).toBeUndefined();
    expect(
      selectProductionWorkbenchPlan({
        currentProductionSpecId: "",
        currentSpecPlans: [],
        orderedPlans,
        productionWorkspaceCleared: false
      })
    ).toBe(orderedPlans[0]);
  });

  it("shares normalized selected plan lookup across current and ordered plan scopes", () => {
    const orderedPlans = [
      { planId: "plan-current", eventSpecId: "spec-current" },
      { planId: " plan-other ", eventSpecId: "spec-other" }
    ];

    expect(
      selectProductionPlanById({
        plans: orderedPlans,
        selectedPlanId: "plan-other"
      })
    ).toBe(orderedPlans[1]);
    expect(
      selectProductionPlanById({
        plans: orderedPlans,
        selectedPlanId: "   "
      })
    ).toBeUndefined();
    expect(
      selectProductionPlanById({
        plans: orderedPlans
      })
    ).toBeUndefined();
  });

  it("selects a production plan spec and maps its menu components", () => {
    const spec = {
      specId: "spec-current",
      menuPlan: [
        { componentId: "starter", title: "Vorspeise" },
        { componentId: 42, title: "Dessert" },
        { title: "ohne ID" }
      ]
    };
    const specsById = new Map([[String(spec.specId), spec]]);

    expect(selectProductionPlanSpec({ specsById })).toBeUndefined();
    expect(
      selectProductionPlanSpec({
        selectedPlan: { planId: "plan-1", eventSpecId: " spec-current " },
        specsById
      })
    ).toBe(spec);
    expect(
      selectProductionPlanSpec({
        selectedPlan: { planId: "plan-2", eventSpecId: "missing" },
        specsById
      })
    ).toBeUndefined();

    const components = buildProductionPlanComponentMap(spec);
    expect(components.get("starter")).toBe(spec.menuPlan[0]);
    expect(components.get("42")).toBe(spec.menuPlan[1]);
    expect(components.get("")).toBe(spec.menuPlan[2]);
    expect(buildProductionPlanComponentMap({ menuPlan: "invalid" }).size).toBe(0);
    expect(buildProductionPlanComponentMap().size).toBe(0);
  });

  it("keeps Fehlupload archive availability tied to an active intake context", () => {
    expect(
      canArchiveCurrentIntake({
        currentIntakeRequestId: "request-1",
        productionWorkspaceCleared: false
      })
    ).toBe(true);
    expect(
      canArchiveCurrentIntake({
        currentIntakeRequestId: "request-1",
        productionWorkspaceCleared: true
      })
    ).toBe(false);
    expect(
      canArchiveCurrentIntake({
        currentIntakeRequestId: "   ",
        productionWorkspaceCleared: false
      })
    ).toBe(false);
    expect(canArchiveCurrentIntake({ productionWorkspaceCleared: false })).toBe(false);
  });

  it("selects the existing production next-step sequence", () => {
    expect(
      selectProductionNextStep({
        hasFocusedProductionSpec: false,
        questionCount: 0,
        hasSelectedPlan: true,
        purchaseListCount: 1
      }).title
    ).toBe("Produktionsarbeit prüfen");
    expect(
      selectProductionNextStep({
        hasFocusedProductionSpec: false,
        questionCount: 0,
        hasSelectedPlan: false,
        purchaseListCount: 0
      }).title
    ).toBe("Auftrag einfügen oder Datei ablegen");
    expect(
      selectProductionNextStep({
        hasFocusedProductionSpec: true,
        questionCount: 2,
        hasSelectedPlan: false,
        purchaseListCount: 0
      }).title
    ).toBe("Rückfragen beantworten");
    expect(
      selectProductionNextStep({
        hasFocusedProductionSpec: true,
        questionCount: 0,
        hasSelectedPlan: false,
        purchaseListCount: 0
      }).title
    ).toBe("Produktionsplan berechnen");
    expect(
      selectProductionNextStep({
        hasFocusedProductionSpec: true,
        questionCount: 0,
        hasSelectedPlan: true,
        purchaseListCount: 0
      }).title
    ).toBe("Einkaufsliste noch offen");
    expect(
      selectProductionNextStep({
        hasFocusedProductionSpec: true,
        questionCount: 0,
        hasSelectedPlan: true,
        purchaseListCount: 1
      }).title
    ).toBe("Produktionsarbeit prüfen");
  });

  it("formats the existing active production context labels", () => {
    expect(
      formatActiveProductionContextLabel({
        focusedProductionSpecLabel: "Lunch · 80 Teilnehmer · 2026-03-04",
        productionWorkspaceCleared: false
      })
    ).toBe("Lunch · 80 Teilnehmer · 2026-03-04");
    expect(
      formatActiveProductionContextLabel({
        selectedPlan: { planId: "plan-123" },
        selectedPlanSpecLabel: "Lunch · 80 Teilnehmer · 2026-03-04",
        productionWorkspaceCleared: false
      })
    ).toBe("Lunch · 80 Teilnehmer · 2026-03-04");
    expect(
      formatActiveProductionContextLabel({
        selectedPlan: { planId: "plan-123", eventSpecId: "spec-123" },
        productionWorkspaceCleared: false
      })
    ).toBe("Produktionsplan aus gespeicherter Spezifikation");
    expect(
      formatActiveProductionContextLabel({
        selectedPlan: { planId: " plan-123 ", eventSpecId: " spec-123 " },
        productionWorkspaceCleared: false
      })
    ).toBe("Produktionsplan aus gespeicherter Spezifikation");
    expect(
      formatActiveProductionContextLabel({
        selectedPlan: { planId: "plan-123", eventSpecId: "   " },
        productionWorkspaceCleared: false
      })
    ).toBe("Produktionsplan ohne fokussierte Spezifikation");
    expect(
      formatProductionTechnicalContextLabel({
        selectedPlan: { planId: "plan-123", eventSpecId: "spec-123" },
        productionWorkspaceCleared: false
      })
    ).toBe("Plan plan-123 · Spezifikation spec-123");
    expect(
      formatProductionTechnicalContextLabel({
        selectedPlan: { planId: "plan-123" },
        selectedPlanSpecLabel: "Lunch · 80 Teilnehmer · 2026-03-04",
        productionWorkspaceCleared: false
      })
    ).toBe("Plan plan-123 · Spezifikation Lunch · 80 Teilnehmer · 2026-03-04");
    expect(
      formatActiveProductionContextLabel({
        productionWorkspaceCleared: true
      })
    ).toBe("Kein aktiver Vorgang");
    expect(
      formatActiveProductionContextLabel({
        productionWorkspaceCleared: false
      })
    ).toBe("Noch kein aktiver Vorgang");
  });

  it("keeps the existing clear-workspace affordance conditions", () => {
    const idleInput = {
      hasFocusedProductionSpec: false,
      hasSelectedPlan: false,
      hasIntakeFile: false,
      hasActiveDocumentName: false,
      documentPhase: "idle",
      planPhase: "idle",
      hasFocusedProductionSpecId: false,
      hasSelectedPlanId: false
    };

    expect(canClearProductionWorkspace(idleInput)).toBe(false);
    expect(canClearProductionWorkspace({ ...idleInput, hasFocusedProductionSpec: true })).toBe(true);
    expect(canClearProductionWorkspace({ ...idleInput, hasSelectedPlan: true })).toBe(true);
    expect(canClearProductionWorkspace({ ...idleInput, hasIntakeFile: true })).toBe(true);
    expect(canClearProductionWorkspace({ ...idleInput, hasActiveDocumentName: true })).toBe(true);
    expect(canClearProductionWorkspace({ ...idleInput, documentPhase: "analysing" })).toBe(true);
    expect(canClearProductionWorkspace({ ...idleInput, planPhase: "planning" })).toBe(true);
    expect(canClearProductionWorkspace({ ...idleInput, hasFocusedProductionSpecId: true })).toBe(true);
    expect(canClearProductionWorkspace({ ...idleInput, hasSelectedPlanId: true })).toBe(true);
  });

  it("counts purchase list items from totals or item arrays", () => {
    expect(
      countPurchaseListItems([
        { totals: { itemCount: 3 }, items: [{}, {}] },
        { items: [{}, {}, {}] },
        { totals: { itemCount: "invalid" } }
      ])
    ).toBe(6);
  });

  it("formats purchase zone and handoff export labels", () => {
    expect(formatPurchaseZoneStatusLabel({ purchaseListCount: 0, itemCount: 0 })).toBe("noch keine Liste");
    expect(formatPurchaseZoneStatusLabel({ purchaseListCount: 1, itemCount: 4 })).toBe("1 Liste · 4 Positionen");
    expect(formatPurchaseZoneStatusLabel({ purchaseListCount: 2, itemCount: 9 })).toBe("2 Listen · 9 Positionen");

    expect(formatProductionHandoffExportLabel({ hasSelectedPlan: false, purchaseListCount: 0 })).toBe(
      "Produktionsblatt offen · Einkaufsliste offen"
    );
    expect(formatProductionHandoffExportLabel({ hasSelectedPlan: true, purchaseListCount: 1 })).toBe(
      "Produktionsblatt vorhanden · Einkaufsliste vorhanden"
    );
  });

  it("formats intake origin and handoff context labels", () => {
    expect(
      formatProductionIntakeOriginLabel({
        intakeRequestDetail: {
          requestId: "request-1",
          source: { channel: "text", receivedAt: "2026-05-26T01:00:00.000Z" }
        }
      })
    ).toBe("text · 2026-05-26T01:00:00.000Z · request-1");
    expect(formatProductionIntakeOriginLabel({ currentIntakeRequestId: "request-2" })).toBe(
      "Intake-Anfrage request-2"
    );
    expect(formatProductionIntakeOriginLabel({ currentIntakeRequestId: " request-2 " })).toBe(
      "Intake-Anfrage request-2"
    );
    expect(formatProductionIntakeOriginLabel({ currentIntakeRequestId: "   " })).toBe(
      "kein Intake-Ursprung verknüpft"
    );
    expect(formatProductionIntakeOriginLabel({})).toBe("kein Intake-Ursprung verknüpft");

    expect(
      formatProductionHandoffContextLabel({
        selectedPlan: { planId: "plan-1", eventSpecId: "spec-1" },
        selectedPlanSpec: { specId: "spec-fallback" },
        purchaseLists: [{ purchaseListId: "purchase-1" }]
      })
    ).toBe("planId plan-1 · specId spec-1 · purchaseListId purchase-1");
    expect(
      formatProductionHandoffContextLabel({
        selectedPlan: { planId: "plan-2" },
        selectedPlanSpec: { specId: "spec-fallback" },
        purchaseLists: []
      })
    ).toBe("planId plan-2 · specId spec-fallback");
    expect(
      formatProductionHandoffContextLabel({
        selectedPlan: { planId: " plan-3 ", eventSpecId: "   " },
        selectedPlanSpec: { specId: " spec-fallback " },
        purchaseLists: [{ purchaseListId: " purchase-3 " }]
      })
    ).toBe("planId plan-3 · specId spec-fallback · purchaseListId purchase-3");
    expect(formatProductionHandoffContextLabel({ purchaseLists: [] })).toBeUndefined();
  });

  it("formats production timing and readiness labels", () => {
    expect(translateReadiness("complete")).toBe("vollständig");
    expect(translateReadiness("partial")).toBe("teilweise vollständig");
    expect(translateReadiness("insufficient")).toBe("unzureichend");
    expect(translateReadiness("custom")).toBe("custom");
    expect(translateReadiness()).toBe("-");

    expect(formatProductionReadinessLabel({ readiness: { status: "complete" } })).toBe("vollständig");
    expect(formatProductionReadinessLabel({ readiness: { status: "partial" } })).toBe("teilweise vollständig");
    expect(formatProductionReadinessLabel({})).toBe("-");
    expect(formatProductionReadinessLabel()).toBe("-");
    expect(formatProductionPlanStatusLabel({ readiness: { status: "complete" } })).toBe("vollständig");
    expect(formatProductionPlanStatusLabel()).toBe("offen");
    expect(
      formatProductionObjectStatusLabel({
        currentSpecPlanCount: 2,
        selectedPlan: { readiness: { status: "complete" } }
      })
    ).toBe("2 Pläne · vollständig");
    expect(
      formatProductionObjectStatusLabel({
        currentSpecPlanCount: 1,
        selectedPlan: { readiness: { status: "complete" } }
      })
    ).toBe("1 Plan · vollständig");
    expect(formatProductionObjectStatusLabel({ currentSpecPlanCount: 2 })).toBe("2 Pläne");
    expect(formatProductionObjectStatusLabel({ currentSpecPlanCount: 0 })).toBe("noch kein Plan");

    expect(formatProductionTimingWindow()).toBe("Terminfenster: noch zu bestätigen");
    expect(formatProductionTimingWindow({ event: { date: "2026-03-04" } })).toBe("Datum: 2026-03-04");
    expect(
      formatProductionTimingWindow({
        event: {
          schedule: [{ label: "Service", start: "12:00", end: "13:00" }]
        }
      })
    ).toBe("Terminfenster: Service 12:00–13:00");
    expect(
      formatProductionTimingWindow({
        event: {
          date: "2026-03-04",
          schedule: [{ label: "Aufbau", start: "09:00", end: "11:30" }]
        }
      })
    ).toBe("Datum: 2026-03-04 · Terminfenster: Aufbau 09:00–11:30");
  });

  it("formats production answer summaries and selects intake request ids", () => {
    expect(formatStructuredProductionAnswerSummary()).toBeUndefined();
    expect(
      formatStructuredProductionAnswerSummary({
        event: { type: "business_lunch", date: "2026-03-04" },
        attendees: { expected: 120 },
        servicePlan: { serviceForm: "buffet" }
      })
    ).toBe("Veranstaltung: business_lunch · Datum: 2026-03-04 · Teilnehmerzahl: 120 Personen · Serviceform: Buffet");
    expect(formatStructuredProductionAnswerSummary({ event: {} })).toBeUndefined();

    expect(selectProductionIntakeRequestId({ requestId: " request-1 " })).toBe("request-1");
    expect(
      selectProductionIntakeRequestId({
        sourceLineage: [
          { sourceType: "recipe", reference: "ignored" },
          { sourceType: "pdf", reference: "request-from-pdf" }
        ]
      })
    ).toBe("request-from-pdf");
    expect(
      selectProductionIntakeRequestId({
        sourceLineage: [{ sourceType: "recipe", reference: "ignored" }]
      })
    ).toBeUndefined();
    expect(selectProductionIntakeRequestId(undefined)).toBeUndefined();
  });

  it("selects unique production artifact spec ids from plans and purchase lists", () => {
    expect(
      selectProductionArtifactSpecIds([
        { eventSpecId: "spec-a" },
        { eventSpecId: "spec-b" },
        { eventSpecId: " spec-a " },
        { eventSpecId: "   " },
        { eventSpecId: "" },
        { eventSpecId: undefined },
        { other: "ignored" }
      ])
    ).toEqual(["spec-a", "spec-b"]);
  });

  it("builds workbench spec facts from the focused production spec", () => {
    expect(buildWorkbenchSpecFacts()).toEqual([]);
    expect(
      buildWorkbenchSpecFacts({
        readiness: { status: "complete" },
        event: {
          date: "2026-03-04",
          schedule: [{ label: "Service", start: "12:00", end: "13:00" }]
        },
        attendees: {
          expected: 120
        },
        servicePlan: {
          serviceForm: "buffet"
        },
        menuPlan: [{ componentId: "a" }, { componentId: "b" }]
      })
    ).toEqual([
      { label: "Status", value: "vollständig" },
      { label: "Zeit", value: "Datum: 2026-03-04 · Terminfenster: Service 12:00–13:00" },
      { label: "Gäste", value: "120 Personen" },
      { label: "Service", value: "Buffet" },
      { label: "Menü", value: "2 Komponenten" }
    ]);
  });

  it("counts clarification answer statuses from conversation messages", () => {
    expect(
      countClarificationAnswerStatuses([
        { clarificationAnswerStatus: "answered" },
        { clarificationAnswerStatus: "unanswered" },
        { clarificationAnswerStatus: "unanswered" },
        { clarificationAnswerStatus: "ignored" },
        {}
      ])
    ).toEqual({ answered: 1, unanswered: 2 });
    expect(countClarificationAnswerStatuses([])).toEqual({ answered: 0, unanswered: 0 });
  });
});
