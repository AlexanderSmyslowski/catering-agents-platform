import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { SupplierSourceStore, type SupplierSourceConfig } from "../offer-service/src/supplier-source-store.js";

const config: SupplierSourceConfig = { name: "Beispiel", mailboxId: "mailbox", sender: "supplier@example.com", columns: {}, articleMappings: [], autoApply: true, mailboxBinding: "binding" };
const row = { article: "A1", description: "Mehl", quantity: "5", unit: "kg", price: "10.00" };
const context = { businessId: "local" };
const mappings = [{ article: "A1", ingredientKey: "mehl", quantity:"5", unit:"kg" }];

describe("supplier price source", () => {
  it("atomically approves a server-bound preview and rejects replay collisions", async () => {
    const store = new SupplierSourceStore({ rootDir: mkdtempSync(path.join(tmpdir(), "supplier-source-")) });
    const source = await store.create(context, config);
    const input = { documentKey: JSON.stringify(["mailbox","1",1,"1"]), bytes: Buffer.from("sample"), rows: [row], senderAuthenticated: false, complete:true, skipped:[], mailboxBinding: "binding", configVersion: 1 };
    const staged = await store.stage(context, source.id, input);
    const preview = staged.previews[0]!;
    await expect(store.apply(context, source.id, preview.id, true, undefined, {configVersion:1,mailboxBinding:"binding"})).rejects.toThrow();
    const approved = await store.apply(context, source.id, preview.id, false, mappings, {configVersion:1,mailboxBinding:"binding"});
    expect(approved.prices).toHaveLength(1);
    expect(approved.prices[0]).toMatchObject({quantity:"5",unit:"kg",rawQuantity:"5",rawUnit:"kg"});
    await expect(store.stage(context, source.id, {...input, documentKey:"other", mailboxBinding:"replaced"})).rejects.toThrow();
    expect((await store.apply(context, source.id, preview.id, false, mappings, {configVersion:1,mailboxBinding:"binding"})).prices).toHaveLength(1);
    expect((await store.stage(context, source.id, input)).previews).toHaveLength(1);
    await expect(store.stage(context, source.id, { ...input, bytes: Buffer.from("other") })).rejects.toThrow();
    expect(await store.get({ businessId: "other" }, source.id)).toBeUndefined();
  });
  it("invalidates stale previews on configuration change and rejects ambiguous bases", async () => {
    const store = new SupplierSourceStore({ rootDir: mkdtempSync(path.join(tmpdir(), "supplier-source-")) });
    const source = await store.create(context, config);
    const input = { documentKey: JSON.stringify(["mailbox","1",1,"1"]), bytes: Buffer.from("sample"), rows: [{ ...row, quantity: "5 kg", unit: "Kolli" }], senderAuthenticated: false, complete:true, skipped:[], mailboxBinding: "binding", configVersion: 1 };
    const staged = await store.stage(context, source.id, input);
    await expect(store.apply(context, source.id, staged.previews[0]!.id, false, [{...mappings[0]!, quantity:"5 kg"}], {configVersion:1,mailboxBinding:"binding"})).rejects.toThrow();
    await store.configure(context, source.id, config, 1);
    await expect(store.apply(context, source.id, staged.previews[0]!.id, false, mappings, {configVersion:1,mailboxBinding:"binding"})).rejects.toThrow();
  });
  it("requires verified dated observations and rejects automatic pack drift", async () => {
    const store = new SupplierSourceStore({ rootDir: mkdtempSync(path.join(tmpdir(), "supplier-source-")) });
    const source = await store.create(context, config);
    const first = await store.stage(context, source.id, { documentKey:JSON.stringify(["mailbox","1",1,"1"]), bytes:Buffer.from("first"), rows:[row], senderAuthenticated:false, complete:true, skipped:[], mailboxBinding:"binding", configVersion:1 });
    await store.apply(context, source.id, first.previews[0]!.id, false, mappings, {configVersion:1,mailboxBinding:"binding"});
    const changed = await store.stage(context, source.id, { documentKey:"next", bytes:Buffer.from("next"), rows:[{...row,quantity:"10"}], senderAuthenticated:true, complete:true, skipped:[], mailboxBinding:"binding", configVersion:1, validFrom:"2026-11-01" });
    await expect(store.apply(context, source.id, changed.previews[1]!.id, true, undefined, {configVersion:1,mailboxBinding:"binding"})).rejects.toThrow();
    expect((await store.get(context, source.id))!.prices).toHaveLength(1);
    expect((await store.get(context,source.id))!.poll).toMatchObject({uidValidity:"1",lastUid:1});
    await expect(store.recordPoll(context, source.id, {mailboxBinding:"binding", configVersion:1, expected:{uidValidity:"1",lastUid:1}, next:{uidValidity:"1",lastUid:2}, status:"stalled"})).rejects.toThrow();
    await store.recordPoll(context, source.id, {mailboxBinding:"binding", configVersion:1, expected:{uidValidity:"1",lastUid:1}, next:{uidValidity:"1",lastUid:2}, status:"ok"});
    await expect(store.recordPoll(context, source.id, {mailboxBinding:"binding", configVersion:1, expected:{uidValidity:"1",lastUid:0}, next:{uidValidity:"1",lastUid:2}, status:"ok"})).rejects.toThrow();
    await store.pause(context, source.id);
    await expect(store.recordPoll(context, source.id, {mailboxBinding:"binding", configVersion:1, expected:{uidValidity:"1",lastUid:2}, next:{uidValidity:"1",lastUid:3}, status:"ok"})).rejects.toThrow();
    expect((await store.get(context, source.id))!.active).toBe(false);
  });

  it("applies only complete, authenticated and comparable dated updates within 25 percent", async () => {
    const store = new SupplierSourceStore({rootDir: mkdtempSync(path.join(tmpdir(), "supplier-source-"))});
    const source = await store.create(context, config);
    const stage = (documentKey:string, price:string, validFrom:string, complete=true) => store.stage(context, source.id, {documentKey:JSON.stringify(["mailbox","1",({one:1,two:2,three:3,four:4} as Record<string,number>)[documentKey],"1"]),bytes:Buffer.from(documentKey),rows:[{...row,price}],senderAuthenticated:true,complete,skipped:[],configVersion:1,mailboxBinding:"binding",validFrom});
    const initial = await stage("one","10","2026-01-01");
    await store.apply(context,source.id,initial.previews[0]!.id,false,mappings,{configVersion:1,mailboxBinding:"binding"});
    const normal = await stage("two","12","2026-02-01");
    await store.apply(context,source.id,normal.previews[1]!.id,true,undefined,{configVersion:1,mailboxBinding:"binding"});
    const anomaly = await stage("three","20","2026-03-01");
    await expect(store.apply(context,source.id,anomaly.previews[2]!.id,true,undefined,{configVersion:1,mailboxBinding:"binding"})).rejects.toThrow();
    const partial = await stage("four","12","2026-03-02",false);
    await expect(store.apply(context,source.id,partial.previews[3]!.id,true,undefined,{configVersion:1,mailboxBinding:"binding"})).rejects.toThrow();
    await store.pause(context,source.id);
    await expect(store.apply(context,source.id,partial.previews[3]!.id,false,mappings,{configVersion:1,mailboxBinding:"binding"})).rejects.toThrow();
  });

  it("invalidates an in-flight preview even when setup was not active", async () => {
    const store = new SupplierSourceStore({rootDir:mkdtempSync(path.join(tmpdir(), "supplier-source-"))});
    const source = await store.create(context, config);
    await store.pause(context, source.id);
    await expect(store.stage(context,source.id,{documentKey:"late",bytes:Buffer.from("late"),rows:[row],senderAuthenticated:false,complete:true, skipped:[],configVersion:1,mailboxBinding:"binding"})).rejects.toThrow();
  });

  it("allows unrelated identifiable skips, retains absent mappings and blocks skipped mapped articles", async () => {
    const store = new SupplierSourceStore({rootDir:mkdtempSync(path.join(tmpdir(), "supplier-source-"))});
    const source = await store.create(context,config), expected={configVersion:1,mailboxBinding:"binding"};
    const stage = (id:string,rows:typeof row[],skipped:Array<{row:number;reason:string;article?:string}>,date:string) => store.stage(context,source.id,{documentKey:JSON.stringify(["mailbox","1",({first:1,next:2,third:3,bad:4,unknown:5} as Record<string,number>)[id],"1"]),bytes:Buffer.from(id),rows,skipped,senderAuthenticated:true,complete:true,...expected,validFrom:date});
    const first=await stage("first",[row,{...row,article:"B",description:"Rice"}],[],"2026-01-01");
    await store.apply(context,source.id,first.previews[0]!.id,false,[...mappings,{article:"B",ingredientKey:"rice",quantity:"5",unit:"kg"}],expected);
    const next=await stage("next",[{...row,price:"12"}],[{row:4,article:"OTHER",reason:"no price"}],"2026-02-01");
    await store.apply(context,source.id,next.previews[1]!.id,true,undefined,expected);
    const third=await stage("third",[row],[],"2026-03-01");
    const approved=await store.apply(context,source.id,third.previews[2]!.id,false,mappings,expected);
    expect(approved.publishedMappings!.map(x=>x.article).sort()).toEqual(["A1","B"]);
    expect(approved.prices.some(x=>x.article==="B")).toBe(true);
    const bad=await stage("bad",[row],[{row:4,article:"B",reason:"no price"}],"2026-04-01");
    const partiallyApplied = await store.apply(context,source.id,bad.previews[3]!.id,true,undefined,expected);
    expect(partiallyApplied.prices.filter(p=>p.previewId === bad.previews[3]!.id).map(p=>p.article)).toEqual(["A1"]);
    expect(partiallyApplied.previews[3]!.skipped?.[0]?.article).toBe("B");
    const resumed = await store.apply(context,source.id,bad.previews[3]!.id,false,mappings,expected);
    expect(resumed.prices).toHaveLength(partiallyApplied.prices.length);
    expect(resumed.prices.filter(p=>p.article === "B")).toHaveLength(1);
    const unknown=await stage("unknown",[row],[{row:5,reason:"identity unknown"}],"2026-05-01");
    await expect(store.apply(context,source.id,unknown.previews[4]!.id,true,undefined,expected)).rejects.toThrow();
    await store.recordPollFailure(context,source.id,expected);
    expect((await store.get(context,source.id))!.pollStatus).toBe("stalled");
  });

  it("starts polling after the approved sample and never advances it on later review", async () => {
    const store = new SupplierSourceStore({rootDir:mkdtempSync(path.join(tmpdir(), "supplier-source-"))});
    const source = await store.create(context,config), expected={configVersion:1,mailboxBinding:"binding"};
    const stage = (uid:number) => store.stage(context,source.id,{documentKey:JSON.stringify(["mailbox","42",uid,"1"]),bytes:Buffer.from(String(uid)),rows:[row],skipped:[],complete:true,senderAuthenticated:false,...expected});
    const first=await stage(9000); await store.apply(context,source.id,first.previews[0]!.id,false,mappings,expected);
    expect((await store.get(context,source.id))!.poll).toMatchObject({uidValidity:"42",lastUid:9000});
    const later=await stage(9500); await store.apply(context,source.id,later.previews[1]!.id,false,mappings,expected);
    expect((await store.get(context,source.id))!.poll).toMatchObject({uidValidity:"42",lastUid:9000});
    await store.configure(context,source.id,config,1);
    const rebind=await store.stage(context,source.id,{documentKey:JSON.stringify(["mailbox","43",8,"1"]),bytes:Buffer.from("new"),rows:[row],skipped:[],complete:true,senderAuthenticated:false,configVersion:2,mailboxBinding:"binding"});
    await store.apply(context,source.id,rebind.previews[2]!.id,false,mappings,{configVersion:2,mailboxBinding:"binding"});
    expect((await store.get(context,source.id))!.poll).toMatchObject({uidValidity:"43",lastUid:8});
  });

  it("does not publish a changed pack with an explicitly removed mapping, and keeps absent prices", async () => {
    const store = new SupplierSourceStore({rootDir:mkdtempSync(path.join(tmpdir(), "supplier-source-"))});
    const source = await store.create(context,config), expected={configVersion:1,mailboxBinding:"binding"};
    const stage = (uid:number, rows:typeof row[]) => store.stage(context,source.id,{documentKey:JSON.stringify(["mailbox","1",uid,"1"]),bytes:Buffer.from(String(uid)),rows,skipped:[],complete:true,senderAuthenticated:false,...expected});
    const first = await stage(1,[row,{...row,article:"B",description:"Rice"}]);
    await store.apply(context,source.id,first.previews[0]!.id,false,[...mappings,{article:"B",ingredientKey:"rice",quantity:"5",unit:"kg"}],expected);
    const changed = await stage(2,[{...row,quantity:"10",price:"99"}]);
    const removed = await store.apply(context,source.id,changed.previews[1]!.id,false,[],expected,["A1"]);
    expect(removed.prices.filter(p=>p.article==="A1")).toHaveLength(1);
    expect(removed.config.articleMappings.map(m=>m.article)).toEqual(["B"]);
    expect(removed.publishedMappings!.map(m=>m.article)).toEqual(["B"]);
    expect(removed.prices.some(p=>p.article==="B")).toBe(true);
    await store.configure(context,source.id,config,1);
    const rebound=await store.stage(context,source.id,{documentKey:JSON.stringify(["mailbox","2",1,"1"]),bytes:Buffer.from("rebound"),rows:[row],skipped:[],complete:true,senderAuthenticated:false,configVersion:2,mailboxBinding:"binding"});
    const reapproved=await store.apply(context,source.id,rebound.previews[2]!.id,false,mappings,{configVersion:2,mailboxBinding:"binding"});
    expect(reapproved.publishedMappings!.some(m=>m.article==="B")).toBe(true);
  });
  it("keeps unselected rows open and discards them without changing published prices", async () => {
    const store = new SupplierSourceStore({rootDir:mkdtempSync(path.join(tmpdir(), "supplier-source-"))});
    const source = await store.create(context,config), expected={configVersion:1,mailboxBinding:"binding"};
    const staged = await store.stage(context,source.id,{documentKey:JSON.stringify(["mailbox","1",1,"1"]),bytes:Buffer.from("1"),rows:[row,{...row,article:"B"}],skipped:[],complete:true,senderAuthenticated:false,...expected});
    const partial = await store.apply(context,source.id,staged.previews[0]!.id,false,mappings,expected);
    expect(partial.previews[0]!.appliedAt).toBeUndefined();
    expect(partial.previews[0]!.appliedArticles).toEqual(["A1"]);
    await expect(store.apply(context,source.id,partial.previews[0]!.id,false,[{...mappings[0]!,quantity:"10"}],expected)).rejects.toThrow("neue Vorschau");
    await expect(store.discard(context,source.id,partial.previews[0]!.id,{...expected,sourceVersion:partial.version-1})).rejects.toThrow();
    const discarded = await store.discard(context,source.id,partial.previews[0]!.id,{...expected,sourceVersion:partial.version});
    expect(discarded.previews[0]!.discardedAt).toBeDefined();
    expect(discarded.prices).toEqual(partial.prices);
    await expect(store.apply(context,source.id,partial.previews[0]!.id,false,mappings,expected)).rejects.toThrow();
  });

  it("rejects approvals and edits based on a superseded source version", async () => {
    const store = new SupplierSourceStore({rootDir:mkdtempSync(path.join(tmpdir(), "supplier-source-"))});
    const source=await store.create(context,config);
    const staged=await store.stage(context,source.id,{documentKey:JSON.stringify(["mailbox","1",1,"1"]),bytes:Buffer.from("first"),rows:[row],skipped:[],complete:true,senderAuthenticated:false,configVersion:1,mailboxBinding:"binding"});
    await store.stage(context,source.id,{documentKey:JSON.stringify(["mailbox","1",2,"1"]),bytes:Buffer.from("second"),rows:[row],skipped:[],complete:true,senderAuthenticated:false,configVersion:1,mailboxBinding:"binding"});
    await expect(store.apply(context,source.id,staged.previews[0]!.id,false,mappings,{configVersion:1,mailboxBinding:"binding",sourceVersion:staged.version})).rejects.toThrow("Quellenversion");
    await store.configure(context,source.id,config,1);
    await expect(store.configure(context,source.id,config,1)).rejects.toThrow("Quellenversion");
    expect((await store.get(context,source.id))!.prices).toEqual([]);
  });

});
