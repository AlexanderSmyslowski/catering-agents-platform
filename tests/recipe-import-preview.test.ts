import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { parseUploadedRecipeText, scaleRecipe } from "@catering/shared-core";
import { buildProductionApp } from "../production-service/src/app.js";
import { buildOfferApp } from "../offer-service/src/app.js";

const headers = { "x-catering-trusted-secret": "synthetic-recipe-review", "x-catering-actor-name": "Administrator", "x-catering-business-id": "local" };
const source = "Synthetischer Reis\nZutaten\n200 g Reis\n0,08 g Zimt\nZubereitung\nGaren.\nAllergene\nMilch";
const review = { text: source, servings: 4, confirmed: true as const };
const builders = [
  ["production", (root: string) => buildProductionApp({dataRoot: root, trustedActorSecret: headers["x-catering-trusted-secret"], env:{CATERING_DEV_AUTH:"1"}})],
  ["offers", (root: string) => buildOfferApp({rootDir: root, trustedActorSecret: headers["x-catering-trusted-secret"], env:{CATERING_DEV_AUTH:"1"}})]
] as const;

for (const [target, build] of builders) describe(`${target} recipe import review`, () => {
  it("previews missing yield without persisting, then saves explicitly reviewed quantities and original provenance", async () => {
    const app = build(mkdtempSync(path.join(tmpdir(), "recipe-review-")));
    try {
      const url = await app.listen({host:"127.0.0.1", port:0});
      const form = (reviewed?: unknown) => { const f=new FormData(); f.append("numberFormat","de"); if(reviewed !== undefined) f.append("review",JSON.stringify(reviewed)); f.append("file",new Blob([source],{type:"text/plain"}),"synthetic-reis.txt"); return f; };
      const preview = await fetch(`${url}/v1/${target}/recipes/upload?preview=true`,{method:"POST",headers,body:form()});
      expect(preview.status).toBe(200);
      const candidate = (await preview.json()).preview;
      expect(candidate.text).toBe(source);
      expect(candidate.servings).toBeUndefined();
      expect(candidate.issue).toMatch(/Portionen/);
      expect((await app.inject({url:`/v1/${target}/recipes`,headers})).json().items).toHaveLength(0);
      const save = await fetch(`${url}/v1/${target}/recipes/upload`,{method:"POST",headers,body:form(review)});
      expect(save.status).toBe(201);
      const recipe = (await save.json()).recipe;
      expect(recipe.baseYield.servings).toBe(4);
      expect(recipe.source.approvalState).toBe("review_required");
      expect(recipe.source.sourceMetadata.filename).toBe("synthetic-reis.txt");
      expect(recipe.allergens).toContain("milk");
      const scaled = scaleRecipe(recipe,100);
      expect(scaled.ingredients.map(x=>x.quantity.amount)).toEqual([5000,2]);
      expect((await app.inject({url:`/v1/${target}/recipes`,headers})).json().items).toHaveLength(1);
    } finally { await app.close(); }
  });
  it("requires review even when original yield is unambiguous",async()=>{
    const app=build(mkdtempSync(path.join(tmpdir(),"recipe-confirmation-")));
    try {const result=await app.inject({method:"POST",url:`/v1/${target}/recipes/import-text`,headers,payload:{text:"4 Portionen\n"+source}});expect(result.statusCode).toBe(422);expect((await app.inject({url:`/v1/${target}/recipes`,headers})).json().items).toHaveLength(0);}finally{await app.close();}
  });
  it("rejects an unreviewed missing yield without a library entry", async () => {
    const app=build(mkdtempSync(path.join(tmpdir(),"recipe-missing-yield-")));
    try {const result=await app.inject({method:"POST",url:`/v1/${target}/recipes/import-text`,headers,payload:{text:source}});expect(result.statusCode).toBe(422);expect((await app.inject({url:`/v1/${target}/recipes`,headers})).json().items).toHaveLength(0);}finally{await app.close();}
  });
});

describe("explicit recipe corrections", () => {
  it("does not overwrite a different original source after the same correction",()=>{
    const withMilk=parseUploadedRecipeText({filename:"same.txt",text:source,review});
    const withoutMilk=parseUploadedRecipeText({filename:"same.txt",text:source.replace("Milch","Senf"),review});
    expect(withMilk.recipeId).not.toBe(withoutMilk.recipeId);
  });
  it("keeps yield declarations out of fallback ingredient lines",()=>{
    const r=parseUploadedRecipeText({text:"Synthetischer Reis\n4 Portionen\n200 g Reis\nZubereitung\nGaren."});
    expect(r.ingredients.map(i=>i.name)).toEqual(["Reis"]);
  });

  it.each(["Salz", "Salz fein", "2 Salz", "g Salz"])("does not invent amount or unit for %s", line => {
    expect(()=>parseUploadedRecipeText({text:source,review:{...review,text:source.replace("200 g Reis",line)}})).toThrow();
  });
  it("retains original allergen hints when corrected text omits them",()=>{
    const recipe=parseUploadedRecipeText({text:source,review:{...review,text:source.replace("\nAllergene\nMilch","")}});
    expect(recipe.allergens).toContain("milk");
  });

  it("keeps corrected servings in recipe identity and does not silently overwrite another scale", () => {
    const four=parseUploadedRecipeText({text:source,review});
    const eight=parseUploadedRecipeText({text:source,review:{...review,servings:8}});
    expect(four.recipeId).not.toBe(eight.recipeId);
    expect(four.scalingRules.batchSize).toBe(4);
  });
  it.each([0,-1,1.5,10000,NaN])("rejects invalid confirmed original servings %s", servings => {expect(()=>parseUploadedRecipeText({text:source,review:{...review,servings}})).toThrow();});
  it("rejects absent confirmation and preserves quantity ambiguity checks",()=>{
    expect(()=>parseUploadedRecipeText({text:source,review:{...review,confirmed:false}})).toThrow();
    expect(()=>parseUploadedRecipeText({text:source,review:{...review,text:source.replace("200 g","2.500 g")}})).toThrow(/Menge|Zahlenformat/);
  });
});
