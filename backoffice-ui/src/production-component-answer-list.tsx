import type { ComponentEditState } from "./production-answer-types.js";
import { ProductionComponentAnswerCard } from "./production-component-answer-card.js";

type ProductionComponentAnswerListProps = {
  canEditPurchasedQuantities?: boolean;
  attendeeCount?: number;
  menuPlan: unknown;
  editingComponentStates: Record<string, ComponentEditState>;
  recipes: Array<Record<string, unknown>>;
  updateEditingComponentState: (componentId: string, patch: Partial<ComponentEditState>) => void;
};

export function ProductionComponentAnswerList({
  canEditPurchasedQuantities = false,
  attendeeCount,
  menuPlan,
  editingComponentStates,
  recipes,
  updateEditingComponentState
}: ProductionComponentAnswerListProps) {
  if (!Array.isArray(menuPlan) || menuPlan.length === 0) {
    return null;
  }

  return (
    <>
      <div className="divider" />
      <header>
        <p className="eyebrow">Gericht für Gericht</p>
        <h4 className="subsection-title">Klassifikation und Herstellungsart festlegen</h4>
      </header>
      <div className="component-answer-list">
        {menuPlan.map((entry) => {
          const component = entry as Record<string, unknown>;
          const componentId = String(component.componentId ?? "");
          const state = editingComponentStates[componentId] ?? {
            menuCategory: "",
            productionMode: "",
            purchasedElements: "",
            recipeOverrideId: "",
            notes: ""
          };
          const componentLabel = String(component.label ?? componentId);

          return (
            <ProductionComponentAnswerCard
              canEditPurchasedQuantities={canEditPurchasedQuantities}
              key={componentId}
              attendeeCount={attendeeCount}
              componentId={componentId}
              componentLabel={componentLabel}
              recipes={recipes}
              state={state}
              updateEditingComponentState={updateEditingComponentState}
            />
          );
        })}
      </div>
    </>
  );
}
