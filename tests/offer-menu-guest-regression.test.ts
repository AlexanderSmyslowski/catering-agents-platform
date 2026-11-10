import { describe, expect, it } from "vitest";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { buildOfferApp } from "../offer-service/src/app.js";
import { createEventRequestFromText, normalizeEventRequestToSpec } from "@catering/shared-core";

const headers={"x-catering-trusted-secret":"synthetic-secret","x-catering-actor-name":"Angebots-Mitarbeiter","x-catering-business-id":"alpha"};
const cases=[
  "Angebot für 80 Gäste von 18 bis 21 Uhr mit Kürbissuppe, Hähnchenragout, Quiche und Mousse.",
  "Angebot für 80 Gäste am 20.11.2026 von 18 bis 21 Uhr mit Kürbissuppe, Hähnchenragout, Quiche und Mousse.",
  "Guten Tag, wir planen am 20.11.2026 eine Veranstaltung mit 80 Gästen von 18 bis 21 Uhr. Wir hätten gern Kürbissuppe, Hähnchenragout, Quiche und Mousse. Viele Grüße",
  "Empfang\nDatum: 20.11.2026\n80 Gäste\nZeit: von 18 bis 21 Uhr\nMenü:\n- Kürbissuppe\n- Hähnchenragout\n- Quiche\n- Mousse"
];
const dishes=["Kürbissuppe","Hähnchenragout","Quiche","Mousse"];
describe("synthetische Menü-/Gästeformulierungen",()=>{
  it.each(cases)("übernimmt den ausdrücklichen Menüwunsch bis zur freigegebenen Übergabe: %s",async text=>{
    const app=buildOfferApp({rootDir:mkdtempSync(path.join(tmpdir(),"offer-menu-guests-")),trustedActorSecret:"synthetic-secret",env:{CATERING_DEV_AUTH:"1",CATERING_DEFAULT_BUSINESS_ID:"alpha"}});
    try {
      const c=await app.inject({method:"POST",url:"/v1/offers/cases",headers,payload:{customerName:"Synthetisch"}});expect(c.statusCode).toBe(201);
      const d=await app.inject({method:"POST",url:"/v1/offers/from-text",headers,payload:{caseId:c.json().case.caseId,text}});expect(d.statusCode,d.body).toBe(201);
      const draft=d.json(); expect(draft.proposedEventSpec.attendees.expected).toBe(80);
      if (text.startsWith("Angebot")) {
        expect(draft.eventSummary).toContain("Anlass offen");
        expect(draft.eventSummary).toContain("Serviceform offen");
        expect(draft.serviceModules.map((x:any)=>x.label)).toEqual(dishes);
        expect(draft.customerFacingText).not.toMatch(/Kaffeepause|Besprechung|Croissant/i);
      }
      for(const spec of [draft.proposedEventSpec,...draft.variantSet.map((v:any)=>v.proposedEventSpec)]) {
        expect(spec.menuPlan.map((x:any)=>x.label)).toEqual(dishes);
        expect(spec.menuPlan.every((x:any)=>x.servings===undefined)).toBe(true);
      }
      const selected=draft.variantSet[1];const a=await app.inject({method:"POST",url:`/v1/offers/drafts/${draft.draftId}/decision`,headers,payload:{decision:"approved",revision:draft.revision,variantId:selected.variantId,...(!draft.proposedEventSpec.event.date && {missingEventDateAcknowledged:true})}});expect(a.statusCode,a.body).toBe(201);
      const h=await app.inject({method:"POST",url:`/v1/offers/approved/${a.json().approvedOffer.approvedOfferId}/handoffs`,headers,payload:{}});expect(h.statusCode,h.body).toBe(201);
      expect(h.json().handoff.eventSpecSnapshot.menuPlan.map((x:any)=>x.label)).toEqual(dishes);
      expect(h.json().handoff.eventSpecSnapshot.attendees.expected).toBe(80);
    } finally {await app.close();}
  });
  it("zieht ein ausdrückliches Menü vor Technik vor und erhält zusammengesetzte Gerichtsnamen",()=>{
    const normalize=(rawText:string)=>normalizeEventRequestToSpec(createEventRequestFromText({requestId:"safe",channel:"text",rawText}));
    const spec=normalize("Empfang mit Bühne, Licht und Ton.\nMenü: Kürbissuppe, Quiche und Mousse mit Beeren und Minze");
    expect(spec.menuPlan.map(x=>x.label)).toEqual(["Kürbissuppe","Quiche","Mousse mit Beeren und Minze"]);
    const technical=normalize("Empfang für 80 Gäste mit Bühne, Licht und Ton.");
    expect(technical.menuPlan.some(x=>/Bühne|Licht|Ton/i.test(x.label))).toBe(false);
  });
  it("übernimmt mehr als zwölf explizite Gerichte und lehnt lange Techniklisten nicht als Menü ab",()=>{
    const normalize=(rawText:string)=>normalizeEventRequestToSpec(createEventRequestFromText({requestId:"many",channel:"text",rawText}));
    const dishes=Array.from({length:13},(_,i)=>`Suppe ${String.fromCharCode(65+i)}`);
    expect(normalize("Menü:\n"+dishes.map(x=>"- "+x).join("\n")).menuPlan.map(x=>x.label)).toEqual(dishes);
    expect(()=>normalize("Empfang mit "+Array.from({length:101},()=>"Licht").join(", "))).not.toThrow();
  });
  it("lehnt eine längere Menüauflistung ohne stillen Verlust ab",async()=>{
    const app=buildOfferApp({rootDir:mkdtempSync(path.join(tmpdir(),"offer-menu-limit-")),trustedActorSecret:"synthetic-secret",env:{CATERING_DEV_AUTH:"1",CATERING_DEFAULT_BUSINESS_ID:"alpha"}});
    try { const c=await app.inject({method:"POST",url:"/v1/offers/cases",headers,payload:{}});
      const text="80 Gäste\nMenü:\n"+Array.from({length:101},()=>"- Suppe").join("\n");
      const response=await app.inject({method:"POST",url:"/v1/offers/from-text",headers,payload:{caseId:c.json().case.caseId,text}});
      expect(response.statusCode).toBe(422);expect(response.body).toContain("Mehr als 100 Gerichte");
    } finally {await app.close();}
  });
  it("löst nur die passend geänderten Anlass-/Servicefragen auf",async()=>{
    const {amendOfferEvent}=await import("../offer-service/src/offer-event-revision.js");
    const original=normalizeEventRequestToSpec(createEventRequestFromText({requestId:"event-answers",channel:"text",rawText:cases[0]}));
    original.uncertainties!.push({field:"event.type",severity:"high",message:"Unabhängige Freigabe offen",suggestedQuestion:"Freigabe prüfen?"});
    const edited=amendOfferEvent(original,{eventType:"reception",serviceForm:"buffet"});
    expect(edited.uncertainties?.some(x=>x.suggestedQuestion==="Welcher Anlass gilt?")).toBe(false);
    expect(edited.uncertainties?.some(x=>x.suggestedQuestion==="Welche Serviceform gilt?")).toBe(false);
    expect(edited.uncertainties?.some(x=>x.suggestedQuestion==="Freigabe prüfen?")).toBe(true);
    expect(original.uncertainties?.some(x=>x.suggestedQuestion==="Welcher Anlass gilt?")).toBe(true);
  });
  it("erhält explizite Portionszahlen und lässt Anlass und Service bei reiner Speisenliste offen",()=>{
    const spec=normalizeEventRequestToSpec(createEventRequestFromText({requestId:"portions",channel:"text",rawText:"Für 100 Gäste: 55 Portionen Hähnchenragout, 25 Portionen Gemüsebratlinge und 20 Portionen Linsenragout."}));
    expect(spec.menuPlan.map(x=>x.servings)).toEqual([55,25,20]);
    const unknown=normalizeEventRequestToSpec(createEventRequestFromText({requestId:"unknown",channel:"text",rawText:cases[0]}));
    expect(unknown.uncertainties?.map(x=>x.field)).toEqual(expect.arrayContaining(["event.type","event.serviceForm"]));
  });
});
