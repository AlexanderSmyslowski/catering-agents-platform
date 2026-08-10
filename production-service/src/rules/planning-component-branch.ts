import type { AcceptedEventSpec, BusinessContext } from "@catering/shared-core";
import type { RecipeDiscoveryService } from "../recipe-discovery/service.js";
import {
  appendProcurementPlanningArtifacts,
  appendRecipeBranchPlanningArtifacts,
  appendUnresolvedComponentArtifacts,
  type PlanningArtifactAppender
} from "./planning-artifact-appender.js";
import { buildImplicitBakerPurchasePlanningArtifacts } from "./planning-baker-purchase-artifacts.js";
import { buildComponentReadinessArtifacts } from "./planning-component-readiness-artifacts.js";
import { buildExplicitProcurementPlanningArtifacts } from "./planning-explicit-procurement-artifacts.js";
import { buildRecipeBranchPlanningArtifacts } from "./planning-recipe-branch-artifacts.js";

type MenuPlanComponent = AcceptedEventSpec["menuPlan"][number];

export async function appendPlanningComponentBranchArtifacts(input: {
  eventSpec: AcceptedEventSpec;
  component: MenuPlanComponent;
  servings: number;
  discoveryService: RecipeDiscoveryService;
  context?: BusinessContext;
  persistDiscoveredRecipes?: boolean;
  artifactAppender: PlanningArtifactAppender;
}): Promise<void> {
  const {
    eventSpec,
    component,
    servings,
    discoveryService,
    context = { businessId: "local" },
    persistDiscoveredRecipes = true,
    artifactAppender
  } = input;

  const bakerPurchaseArtifacts = buildImplicitBakerPurchasePlanningArtifacts({
    eventSpec,
    component,
    servings
  });
  if (bakerPurchaseArtifacts?.kind === "unresolved") {
    appendUnresolvedComponentArtifacts(artifactAppender, bakerPurchaseArtifacts.artifacts);
    return;
  }
  if (bakerPurchaseArtifacts?.kind === "procurement") {
    appendProcurementPlanningArtifacts(artifactAppender, bakerPurchaseArtifacts.artifacts);
    return;
  }

  const readinessArtifacts = buildComponentReadinessArtifacts({
    component,
    eventSpec,
    servings
  });
  if (readinessArtifacts) {
    appendUnresolvedComponentArtifacts(artifactAppender, readinessArtifacts);
    return;
  }

  const procurementArtifacts = buildExplicitProcurementPlanningArtifacts({
    eventSpec,
    component,
    servings
  });
  if (procurementArtifacts) {
    appendProcurementPlanningArtifacts(artifactAppender, procurementArtifacts);
    return;
  }

  const recipeBranchArtifacts = await buildRecipeBranchPlanningArtifacts({
    eventSpec,
    component,
      servings,
      discoveryService,
      context,
      persistDiscoveredRecipes
  });
  appendRecipeBranchPlanningArtifacts(artifactAppender, recipeBranchArtifacts);
}
