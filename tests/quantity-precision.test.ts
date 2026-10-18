import { describe, expect, it } from "vitest";
import { aggregatePurchaseList, applyNonlinearProductionScaling, internalRecipes, scaleRecipe, toProductionBatch, type AcceptedEventSpec, type ProductionBatch, type ProductionPlan, type Recipe } from "@catering/shared-core";
import { renderProductionFolderHtml, renderProductionPlanHtml, renderPurchaseListCsv } from "@catering/print-export";

function model(amount = 0.001, unit = "kg"): Recipe {
  return { ...structuredClone(internalRecipes[0]!), recipeId: "synthetic-cinnamon-precision", name: "Synthetisches Fruchtkompott",
    source: { ...internalRecipes[0]!.source, approvalState: "review_required" },
    steps: [{ index:1,instruction:"Synthetische Mengenannahme; keine Küchenfreigabe." }],
    baseYield: { servings: 10, unit: "servings" },
    ingredients: [{ ingredientId: "cinnamon", name: "Zimt", quantity: { amount, unit }, group: "misc" }] };
}
function batch(recipe = model(), servings = 20, componentId = "compote"): ProductionBatch {
  return { ...toProductionBatch(recipe, componentId, servings), batchId: "batch-"+componentId, station: "cold", prepWindow: "T-1", gnPlan: [] };
}

describe("quantity precision through production, purchasing and print", () => {
  it("exports precise German Excel quantities while preserving the original CSV contract", () => {
    const list = aggregatePurchaseList("excel-precision", [batch(model(), 20)]);
    const original = renderPurchaseListCsv(list);
    const excel = renderPurchaseListCsv(list, "excel-de");
    expect(original).toContain('"0.002","kg","0.002","kg"');
    expect(original).not.toContain("Küchenmenge");
    expect(excel.startsWith("\uFEFF")).toBe(true);
    expect(excel).toContain('"Warengruppe";"Artikel";"Normalisierte Menge"');
    expect(excel).toContain('"0,002";"kg";"0,002";"kg";"2 g"');
    expect(excel.split("\r\n")).toHaveLength(2);
    expect(list.items[0]!.purchaseQty).toBe(0.002);
  });

  it("keeps formula-looking and quoted source text inert in the Excel export", () => {
    const list = aggregatePurchaseList("excel-inert-text", [batch(model(), 20)]);
    list.items[0]!.displayName = '=SUM(1;1)';
    list.items[0]!.supplierHint = '\t@SUM(1+1)';
    list.items[0]!.sourceRecipes = ['Quelle "A"; zweite Zeile\nmit Text'];
    const excel = renderPurchaseListCsv(list, "excel-de");
    expect(excel).toContain(`"'=SUM(1;1)"`);
    expect(excel).toContain(`"'\t@SUM(1+1)"`);
    expect(excel).toContain('"Quelle ""A""; zweite Zeile\nmit Text"');
  });

  it("retains2g in kg and exact fractional ingredients without a percentage surcharge", () => {
    expect(scaleRecipe(model(),20).ingredients[0]!.quantity.amount).toBe(0.002);
    expect(scaleRecipe(model(0.15,"l"),55).ingredients[0]!.quantity.amount).toBe(0.825);
    expect(scaleRecipe(model(0.03,"l"),55).ingredients[0]!.quantity.amount).toBe(0.165);
    expect(scaleRecipe(model(0.000001),20).ingredients[0]!.quantity.amount).toBe(0.000002);
  });
  it("keeps a reviewed nonlinear adjustment positive without changing its approval rules", () => {
    const recipe=model();
    const result=applyNonlinearProductionScaling({recipe,targetServings:20,rules:[{
      ruleId:"synthetic-small-factor",recipeId:recipe.recipeId,ingredientId:"cinnamon",minServings:20,maxServings:20,
      model:{kind:"factor",factor:0.5},rationale:"Synthetic precision regression",supportingObservationIds:["synthetic"],
      reviewStatus:"approved",approvedBy:"synthetic-reviewer",approvedAt:"2026-10-17T18:00:00Z"
    }]});
    expect(result.effectiveRecipe.ingredients[0]!.quantity.amount).toBe(0.001);
  });
  it("sums contributions before display rounding and preserves normalized/purchase quantities", () => {
    const list = aggregatePurchaseList("precision", [batch(model(),20),batch(model(),5,"compote-2")]);
    expect(list.items).toHaveLength(1);
    expect(list.items[0]).toMatchObject({ normalizedQty:0.0025,normalizedUnit:"kg",purchaseQty:0.0025,purchaseUnit:"kg" });
    const converted=aggregatePurchaseList("precision-grams",[batch(model(500.001,"g"),20)]);
    expect(converted.items[0]).toMatchObject({normalizedQty:1000.002,normalizedUnit:"g",purchaseQty:1.000002,purchaseUnit:"kg"});
  });
  it("does not leave floating point accumulation noise in consolidated quantities", () => {
    const list=aggregatePurchaseList("precision-sum",[batch(model(0.1),10),batch(model(0.2),10,"second")]);
    expect(list.items[0]!.normalizedQty).toBe(0.3);
    expect(list.items[0]!.purchaseQty).toBe(0.3);
  });
  it("retains small positive quantities in CSV, recipe cards, kitchen sheets and printed purchasing", () => {
    const recipe=model(); const b=batch(recipe);
    const spec: AcceptedEventSpec={schemaVersion:"1.0.0",specId:"precision",lifecycle:{commercialState:"accepted"},readiness:{status:"complete",reasons:[]},sourceLineage:[],
      event:{date:"2026-11-12",serviceForm:"buffet"},attendees:{expected:100},servicePlan:{eventType:"reception",serviceForm:"buffet",modules:[]},menuPlan:[{componentId:"compote",label:recipe.name,servings:20}]};
    const plan: ProductionPlan={schemaVersion:"1.0.0",planId:"plan-precision",eventSpecId:spec.specId,readiness:{status:"complete",reasons:[]},
      productionBatches:[b],timeline:[],kitchenSheets:[{title:recipe.name,componentId:b.componentId,recipeId:recipe.recipeId,productionQty:b.scaledYield,ingredients:b.ingredients,steps:b.steps,instructions:[],station:b.station,prepWindow:b.prepWindow}],
      recipeSelections:[{componentId:b.componentId,recipeId:recipe.recipeId,selectionReason:"synthetic",autoUsedInternetRecipe:false}],unresolvedItems:[]};
    const list=aggregatePurchaseList(spec.specId,[b]);
    expect(renderPurchaseListCsv(list)).toContain('"0.002","kg","0.002","kg"');
    const folder=renderProductionFolderHtml({spec,plan,recipes:[recipe],purchaseLists:[list]});
    expect(folder.match(/0,002 kg/g)!.length).toBeGreaterThanOrEqual(2);
    expect(renderProductionPlanHtml(plan,spec)).toContain("0,002 kg");
    const tinyRecipe=model(0.000000001);const tiny=batch(tinyRecipe);
    const tinyFolder=renderProductionFolderHtml({spec,plan:{...plan,productionBatches:[tiny],kitchenSheets:[]},recipes:[tinyRecipe],purchaseLists:[aggregatePurchaseList(spec.specId,[tiny])]});
    expect(tinyFolder).toContain("0,000000002 kg");
    expect(renderProductionPlanHtml({...plan,kitchenSheets:[{...plan.kitchenSheets[0]!,ingredients:tiny.ingredients}],productionBatches:[tiny]},spec)).toContain("0,000000002 kg");
  });
});
