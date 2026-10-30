import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { createEventRequestFromManualForm, normalizeEventRequestToSpec, parseUploadedRecipeText } from "@catering/shared-core";
import { buildProductionApp } from "../production-service/src/app.js";
import { buildOfferApp } from "../offer-service/src/app.js";
import { buildIntakeApp } from "../intake-service/src/app.js";

const text = (amount = "2500", preparation = "In 50 Portionen aufteilen.") => `Referenzrezept\n50 Portionen\nZutaten\n${amount} g Apfel\n2 g Zimt\nZubereitung\n1. ${preparation}`;
const headers = { "x-catering-trusted-secret": "synthetic-reference-import", "x-catering-actor-name": "Administrator", "x-catering-business-id": "local" };

describe("historical reference import regressions", () => {
  it.each([
    ["de", "2.500", 2500], ["de", "1.234,5", 1234.5], ["de", "1,5", 1.5],
    ["en", "2,500", 2500], ["en", "1,234.5", 1234.5], ["en", "2.5", 2.5],
    [undefined, "2", 2], [undefined, "0.500", 0.5], [undefined, "2,5", 2.5],
    [undefined, "2 500", 2500]
  ] as const)("reads %s number %s without a silent factor change", (numberFormat, amount, expected) => {
    const recipe = parseUploadedRecipeText({ text: text(amount, "Alles mischen."), numberFormat });
    expect(recipe.ingredients[0]!.quantity).toEqual({ amount: expected, unit: "g" });
    expect(recipe.ingredients[1]!.quantity).toEqual({ amount: 2, unit: "g" });
    expect(recipe.source.approvalState).toBe("review_required");
  });
  it.each(["2.500", "2,500", "2 50", "1.23.4", "-5", "1/0"])("rejects ambiguous or malformed amount %s", amount => {
    expect(() => parseUploadedRecipeText({ text: text(amount, "Alles mischen.") })).toThrow();
  });
  it.each(["19 g / 3 g Salz / Pfeffer", "ca. 288 g Wasser", "bis 26 ml Zitronensaft", "1 – 2 EL Öl", "2 - 3 Eier", "1 EL bis 2 EL Öl"])("does not silently invent a quantity for %s", line => {
    expect(() => parseUploadedRecipeText({text:`Referenz\n50 Portionen\nZutaten\n${line}\nZubereitung\nMischen.`,numberFormat:"de"})).toThrow();
  });
  it("does not overwrite an import when the operator changes its numeric interpretation", () => {
    const de = parseUploadedRecipeText({text:text("2.500", "Mischen."), numberFormat:"de"});
    const en = parseUploadedRecipeText({text:text("2.500", "Mischen."), numberFormat:"en"});
    expect(de.recipeId).not.toBe(en.recipeId);
    expect(de.ingredients[0]!.quantity.amount).toBe(2500);
    expect(en.ingredients[0]!.quantity.amount).toBe(2.5);
  });
  it("takes the declared yield from the head, not ordinary preparation prose", () => {
    const recipe = parseUploadedRecipeText({ text: text() });
    expect(recipe.baseYield.servings).toBe(50);
    expect(recipe.steps[0]!.instruction).toContain("50 Portionen");
  });
  it.each(["50 Portionen abfüllen und kühlen.", "- 50 Portionen abfüllen"])("keeps ordinary preparation prose out of yield declarations: %s", instruction => {
    const recipe = parseUploadedRecipeText({text:text().replace("1. In 50 Portionen aufteilen.",instruction)});
    expect(recipe.baseYield.servings).toBe(50);
  });
  it.each(["40-50 Portionen", "Portionen: viele", "45 Portionen"])("retains fail-closed contradictory yield protection for %s", declaration => {
    expect(() => parseUploadedRecipeText({text:text().replace("Zutaten", declaration+"\nZutaten")})).toThrow();
  });
  it("does not use the default yield when only preparation prose mentions a yield", () => {
    expect(() => parseUploadedRecipeText({text:text().replace("50 Portionen\nZutaten", "Zutaten")})).toThrow();
  });
  it("keeps explicit standalone contradictory yield declarations after preparation blocked", () => {
    expect(() => parseUploadedRecipeText({text:text()+"\nPortionen: 25"})).toThrow();
  });
  it("preserves different explicit menu counts in manual intake", () => {
    const request = createEventRequestFromManualForm({requestId:"synthetic-counts",attendeeCount:100,eventType:"reception",menuItems:["Apfelcreme – 50 Portionen", "Kuchenbar – 50 Stück insgesamt", "55 Portionen Hähnchenragout", "Linsenragout: 20 Portionen", "Salat"]});
    const spec = normalizeEventRequestToSpec(request);
    expect(spec.menuPlan.map(x=>x.servings)).toEqual([50,50,55,20,100]);
  });
  it.each(["Apfelcreme – 40-50 Portionen", "Apfelcreme – 0 Portionen", "Vegane Gäste: 20 Portionen", "-50 Portionen Apfelcreme", "40-50 Portionen Apfelcreme", "Apfelcreme: 40-50 Portionen", "Apfelcreme – 40 – 50 Portionen", "Apfelcreme 40 – 50 Portionen", "Hummus – 50 Portionen, Salat – 30 Portionen", "Hummus – 50\u00a0Portionen, Salat – 30\u00a0Portionen", "Hummus – 50\u202fPortionen, Salat – 30\u202fPortionen", "Hummus 50Portionen, Salat 30Portionen", "Salat\u2009–\u200930\u2009–\u200940\u2009Portionen", "Salat\u2007–\u200730\u2007–\u200740\u2007Portionen"])("does not replace unclear/group menu count %s with guests", label => {
    expect(() => normalizeEventRequestToSpec(createEventRequestFromManualForm({requestId:"synthetic-unclear",attendeeCount:100,menuItems:[label]}))).toThrow();
  });
  it.each([["production", (rootDir: string) => buildProductionApp({dataRoot:rootDir,trustedActorSecret:headers["x-catering-trusted-secret"],env:{CATERING_DEV_AUTH:"1"}})], ["offers", (rootDir: string) => buildOfferApp({rootDir,trustedActorSecret:headers["x-catering-trusted-secret"],env:{CATERING_DEV_AUTH:"1"}})]] as const)("returns a correctable input error and persists nothing for %s recipe ambiguity", async (target, build) => {
    const app=build(mkdtempSync(path.join(tmpdir(),"reference-recipe-error-")));
    try {
      const response=await app.inject({method:"POST",url:`/v1/${target}/recipes/import-text`,headers,payload:{text:text("2.500","Mischen.")}});
      expect(response.statusCode,response.body).toBe(422);
      expect(response.json().message).toMatch(/Zahlenformat|Menge/);
      const valid=await app.inject({method:"POST",url:`/v1/${target}/recipes/import-text`,headers,payload:{text:text("2.500"),numberFormat:"de"}});
      expect(valid.statusCode,valid.body).toBe(201);
      expect(valid.json().recipe.ingredients[0].quantity.amount).toBe(2500);
    } finally { await app.close(); }
  });
  it.each([["production", (rootDir: string) => buildProductionApp({dataRoot:rootDir,trustedActorSecret:headers["x-catering-trusted-secret"],env:{CATERING_DEV_AUTH:"1"}})], ["offers", (rootDir: string) => buildOfferApp({rootDir,trustedActorSecret:headers["x-catering-trusted-secret"],env:{CATERING_DEV_AUTH:"1"}})]] as const)("uses the chosen numeric format in the real %s multipart route", async (target, build) => {
    const app=build(mkdtempSync(path.join(tmpdir(),"reference-multipart-")));
    try {
      const url=await app.listen({host:"127.0.0.1",port:0});
      const form = new FormData(); form.append("numberFormat", "de"); form.append("file",new Blob([text("2.500")],{type:"text/plain"}),"synthetic-reference.txt");
      const response = await fetch(`${url}/v1/${target}/recipes/upload`,{method:"POST",body:form,headers:Object.fromEntries(Object.entries(headers).filter(([key])=>key!=="Content-Type"))});
      expect(response.status).toBe(201);
      const result=await response.json(); expect(result.recipe.ingredients[0].quantity.amount).toBe(2500);
    } finally { await app.close(); }
  });
  it("rejects an ambiguous manual count through HTTP instead of creating wrong quantities", async () => {
    const app=buildIntakeApp({rootDir:mkdtempSync(path.join(tmpdir(),"reference-manual-error-")),trustedActorSecret:headers["x-catering-trusted-secret"],env:{CATERING_DEV_AUTH:"1"}});
    try {
      const response=await app.inject({method:"POST",url:"/v1/intake/specs/manual",headers,payload:{attendeeCount:100,menuItems:["Creme – 40-50 Portionen"]}});
      expect(response.statusCode,response.body).toBe(422);
    } finally { await app.close(); }
  });
});
