import Fastify from "fastify";
import { mkdtempSync } from "node:fs";
import path from "node:path";
import { tmpdir } from "node:os";
import { expect, it, vi } from "vitest";
import { SupplierSourceStore } from "../offer-service/src/supplier-source-store.js";
import { registerSupplierSourceRoutes } from "../offer-service/src/supplier-source-routes.js";
import type { TrustedActor } from "../shared-core/src/access-control.js";

it("binds preview to selected server attachment and isolates sources by business", async () => {
  const app = Fastify();
  let actor: TrustedActor = { name:"Admin", businessId:"local", source:"authenticated-session", trusted:true, role:"admin" };
  let binding = "binding";
  const listMessages = vi.fn(async () => [{uidValidity:"1",uid:2,subject:"Preise",from:"Supplier <supplier@example.com>",attachments:[{part:"1"}]}]);
  registerSupplierSourceRoutes(app, { store: new SupplierSourceStore({rootDir:mkdtempSync(path.join(tmpdir(), "source-routes-"))}), actorForRequest: () => actor, adapter: {
    mailboxBinding: async () => binding,
    listMailboxes: async context => context.businessId === "local" ? [{id:"mail",label:"Postfach"}] : [],
    listMessages,
    inspect: async () => ({headers: []}),
    parse: async () => ({bytes:Buffer.from("real"),senderAuthenticated:false,complete:true, skipped:[],rows:[{article:"A",description:"Mehl",quantity:"5",unit:"kg",price:"10"}]})
  }});
  const base = "/v1/offers/supplier-sources";
  const created = await app.inject({method:"POST",url:base,payload:{name:"Lieferant",mailboxId:"mail",sender:"supplier@example.com",columns:{},autoApply:false}});
  expect(created.statusCode).toBe(200);
  const id = created.json().source.id;
  const preview = await app.inject({method:"POST",url:`${base}/${id}/preview`,payload:{uidValidity:"1",uid:2,part:"1",rows:[{price:"0.01"}]}});
  expect(preview.statusCode).toBe(400);
  const validPreview = await app.inject({method:"POST",url:`${base}/${id}/preview`,payload:{uidValidity:"1",uid:2,part:"1"}});
  expect(validPreview.json().preview.rows[0].price).toBe("10");
  expect(listMessages).not.toHaveBeenCalled();
  binding = "changed";
  expect((await app.inject({method:"POST",url:`${base}/${id}/activate`,payload:{previewId:validPreview.json().preview.id,expectedSourceVersion:validPreview.json().preview.sourceVersion,expectedConfigVersion:validPreview.json().preview.configVersion,articleMappings:[{article:"A",ingredientKey:"mehl",quantity:"5",unit:"kg"}]}})).statusCode).toBe(400);
  binding = "binding";
  const activate = await app.inject({method:"POST",url:`${base}/${id}/activate`,payload:{previewId:validPreview.json().preview.id,expectedSourceVersion:validPreview.json().preview.sourceVersion,expectedConfigVersion:validPreview.json().preview.configVersion,articleMappings:[{article:"A",ingredientKey:"mehl",quantity:"5",unit:"kg"}]}});
  expect(activate.statusCode).toBe(200);
  expect((await app.inject({method:"GET",url:`${base}/prices`})).json().prices[0].price).toBe("10");
  actor = {...actor,businessId:"other"};
  expect((await app.inject({method:"GET",url:base})).json().sources).toEqual([]);
  expect((await app.inject({method:"POST",url:`${base}/${id}/preview`,payload:{uidValidity:"1",uid:2,part:"1"}})).statusCode).toBe(400);
  actor = {...actor,source:"dev-default"};
  expect((await app.inject({method:"GET",url:base})).statusCode).toBe(403);
  await app.close();
});

it("keeps stored prices readable when no mailbox is configured", async () => {
  const { disabledSupplierSourceAdapter } = await import("../offer-service/src/supplier-source-routes.js");
  const rootDir = mkdtempSync(path.join(tmpdir(), "source-disabled-"));
  const app = Fastify();
  const actor: TrustedActor = { name:"Admin", businessId:"local", source:"authenticated-session", trusted:true, role:"admin" };
  const store = new SupplierSourceStore({rootDir});
  await store.create({businessId:"local"},{name:"Saved",mailboxId:"mail",mailboxBinding:"old",sender:"supplier@example.com",columns:{},articleMappings:[],autoApply:false});
  registerSupplierSourceRoutes(app,{store,adapter:disabledSupplierSourceAdapter,actorForRequest:()=>actor});
  expect((await app.inject({method:"GET",url:"/v1/offers/supplier-sources"})).json().sources).toHaveLength(1);
  expect((await app.inject({method:"GET",url:"/v1/offers/supplier-sources/prices"})).statusCode).toBe(200);
  expect((await app.inject({method:"GET",url:"/v1/offers/supplier-sources/mailboxes"})).json().mailboxes).toEqual([]);
  expect((await app.inject({method:"POST",url:"/v1/offers/supplier-sources",payload:{name:"N",mailboxId:"mail",sender:"a@example.org",columns:{},autoApply:false}})).statusCode).toBe(400);
  await app.close();
});

it("restricts mailbox and configuration to administrators while allowing commercial price reads", async () => {
  const app = Fastify();
  const actor: TrustedActor = {name:"Offer",businessId:"local",source:"authenticated-session",trusted:true,role:"offer_operator"};
  const mailbox = vi.fn(async () => [{id:"m",label:"Mailbox"}]);
  registerSupplierSourceRoutes(app,{store:new SupplierSourceStore({rootDir:mkdtempSync(path.join(tmpdir(),"source-roles-"))}),actorForRequest:()=>actor,adapter:{listMailboxes:mailbox,mailboxBinding:async()=>"binding",listMessages:async()=>[],inspect:async()=>({}),parse:async()=>({bytes:Buffer.from("x"),rows:[],senderAuthenticated:false,complete:true,skipped:[]})}});
  for (const [method,url] of [["GET","/v1/offers/supplier-sources"],["GET","/v1/offers/supplier-sources/mailboxes"],["GET","/v1/offers/supplier-sources/mailboxes/m/messages?sender=supplier%40example.org"],["GET","/v1/offers/supplier-sources/s/previews"],["POST","/v1/offers/supplier-sources/s/pause"]] as const) {
    expect((await app.inject({method,url})).statusCode).toBe(403);
  }
  expect(mailbox).not.toHaveBeenCalled();
  expect((await app.inject({method:"GET",url:"/v1/offers/supplier-sources/prices"})).statusCode).toBe(200);
  await app.close();
});

it("requires the sender during sample search and workbook inspection", async () => {
  const app=Fastify(), senderSearch=vi.fn(async () => []), inspect=vi.fn(async () => ({rows:[]}));
  const actor:TrustedActor={name:"Admin",businessId:"local",source:"authenticated-session",trusted:true,role:"admin"};
  registerSupplierSourceRoutes(app,{store:new SupplierSourceStore({rootDir:mkdtempSync(path.join(tmpdir(),"source-search-"))}),actorForRequest:()=>actor,adapter:{listMailboxes:async()=>[{id:"m",label:"Mailbox"}],mailboxBinding:async()=>"binding",listMessages:senderSearch,inspect,parse:async()=>({bytes:Buffer.from("x"),rows:[],senderAuthenticated:false,complete:true,skipped:[]})}});
  expect((await app.inject({method:"GET",url:"/v1/offers/supplier-sources/mailboxes/m/messages"})).statusCode).toBe(400);
  expect(senderSearch).not.toHaveBeenCalled();
  expect((await app.inject({method:"GET",url:"/v1/offers/supplier-sources/mailboxes/m/messages?sender=Supplier%40EXAMPLE.ORG"})).statusCode).toBe(200);
  expect(senderSearch).toHaveBeenCalledWith({businessId:"local"},"m","Supplier@example.org");
  expect((await app.inject({method:"POST",url:"/v1/offers/supplier-sources/mailboxes/m/columns",payload:{uidValidity:"1",uid:2,part:"1"}})).statusCode).toBe(400);
  expect((await app.inject({method:"POST",url:"/v1/offers/supplier-sources/mailboxes/m/columns",payload:{uidValidity:"1",uid:2,part:"1",sender:"Supplier@EXAMPLE.ORG"}})).statusCode).toBe(200);
  expect(inspect).toHaveBeenCalledWith({businessId:"local"},"m",{uidValidity:"1",uid:2,part:"1"},"Supplier@example.org");
  await app.close();
});

it("ranks a later undated reviewed price by observation and rejects stale configuration edits", async () => {
  const app = Fastify();
  const actor: TrustedActor = {name:"Admin",businessId:"local",source:"authenticated-session",trusted:true,role:"admin"};
  const store = new SupplierSourceStore({rootDir:mkdtempSync(path.join(tmpdir(),"source-date-"))});
  const adapter = {mailboxBinding:async()=>"binding",listMailboxes:async()=>[{id:"mail",label:"Mailbox"}],listMessages:async()=>[],inspect:async()=>({}),parse:async()=>({bytes:Buffer.from(""),rows:[],senderAuthenticated:false,complete:false,skipped:[]})};
  registerSupplierSourceRoutes(app,{store,adapter,actorForRequest:()=>actor});
  const ctx={businessId:"local"}, config={name:"Supplier",mailboxId:"mail",mailboxBinding:"binding",sender:"s@example.com",columns:{},articleMappings:[],autoApply:false};
  const source=await store.create(ctx,config), mapping=[{article:"A",ingredientKey:"Mehl",quantity:"5",unit:"kg"}], expected={configVersion:1,mailboxBinding:"binding"};
  const stage= (uid:number,price:string,validFrom?:string) => store.stage(ctx,source.id,{documentKey:JSON.stringify(["mail","1",uid,"1"]),bytes:Buffer.from(String(uid)),rows:[{article:"A",description:"Mehl",quantity:"5",unit:"kg",price}],senderAuthenticated:false,complete:true,skipped:[],...expected,...(validFrom?{validFrom}:{})});
  const dated=await stage(1,"10","2020-01-01"); await store.apply(ctx,source.id,dated.previews[0]!.id,false,mapping,expected);
  const latest=await stage(2,"12"); await store.apply(ctx,source.id,latest.previews[1]!.id,false,mapping,expected);
  const result=await app.inject({method:"GET",url:"/v1/offers/supplier-sources/prices?ingredient=mehl"});
  expect(result.json().prices[0].price).toBe("12");
  const edit={name:"Supplier",mailboxId:"mail",sender:"s@example.com",columns:{},autoApply:false,expectedConfigVersion:1};
  expect((await app.inject({method:"PUT",url:`/v1/offers/supplier-sources/${source.id}`,payload:edit})).statusCode).toBe(200);
  expect((await app.inject({method:"PUT",url:`/v1/offers/supplier-sources/${source.id}`,payload:edit})).statusCode).toBe(409);
  await app.close();
});
