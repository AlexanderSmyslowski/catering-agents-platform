import type {
  AcceptedEventSpec,
  MenuComponent
} from "@catering/shared-core";
import { hybridClarificationReason } from "./production-sheet-builders.js";
import {
  buildUnresolvedComponentArtifacts,
  type UnresolvedComponentArtifacts
} from "./planning-unresolved-component-artifacts.js";

export type ComponentReadinessArtifactsInput = {
  component: MenuComponent;
  eventSpec: AcceptedEventSpec;
  servings: number;
};

export function buildComponentReadinessArtifacts({
  component,
  eventSpec,
  servings
}: ComponentReadinessArtifactsInput): UnresolvedComponentArtifacts | undefined {
  if (!component.menuCategory) {
    const reason = "Gerichtsklassifikation fehlt. Bitte klassisch, vegetarisch oder vegan festlegen.";
    return buildUnresolvedComponentArtifacts({
      component,
      eventSpec,
      servings,
      reason,
      issue: `Klassifikation für ${component.label} fehlt.`,
      timelineLabel: `${component.label} fachlich klären`
    });
  }

  const productionMode = component.productionDecision?.mode;
  if (!productionMode) {
    const hybridReason = hybridClarificationReason(component);
    const reason =
      hybridReason ??
      "Herstellungsentscheidung fehlt. Bitte Eigenproduktion, Hybrid, Convenience-Zukauf oder Fertigprodukt festlegen.";
    return buildUnresolvedComponentArtifacts({
      component,
      eventSpec,
      servings,
      reason,
      issue: hybridReason
        ? `Herstellungsentscheidung für ${component.label} fehlt (Hybridfall Focaccia).`
        : `Herstellungsentscheidung für ${component.label} fehlt.`,
      timelineLabel: hybridReason ? `${component.label} Hybridfall klären` : `${component.label} Herstellungsart klären`
    });
  }

  const purchasedElements = component.productionDecision?.purchasedElements ?? [];
  if ((productionMode === "hybrid" || productionMode === "convenience_purchase") && purchasedElements.length === 0) {
    const reason =
      "Hybrid-/Convenience-Entscheidung ist gesetzt, aber die zugekauften Bestandteile sind noch nicht benannt.";
    return buildUnresolvedComponentArtifacts({
      component,
      eventSpec,
      servings,
      reason,
      issue: `Zugekaufte Bestandteile für ${component.label} fehlen.`,
      timelineLabel: `${component.label} Beschaffungsanteil klären`
    });
  }

  return undefined;
}
