import { createHmac, generateKeyPairSync } from "node:crypto";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { expect, it, vi } from "vitest";
import { dkimSign } from "mailauth/lib/dkim/sign";

const seam = vi.hoisted(() => ({messages:new Map<number, Buffer>(), dns: undefined as undefined | (() => Promise<string[][]>), max:2}));
vi.mock("../offer-service/src/supplier-mailbox.js", () => ({
  listMailboxMessages: async () => [...seam.messages.keys()].map(uid => ({uidValidity:"10",uid,subject:"Prices",from:"supplier@example.test",date:null,attachments:[{part:"1",filename:"list.xlsx",contentType:"application/xlsx",size:100}]})),
  fetchMailboxSenderRaw: async (_resolver:unknown,_id:unknown,_validity:unknown,uid:number,sender:string) => { if (sender !== "supplier@example.test" || !seam.messages.has(uid)) throw new Error("Sender mismatch"); return seam.messages.get(uid)!; },
  listMailboxUidBatch: async (_resolver:unknown,_id:unknown,_sender:string,cursor?:{lastUid:number}) => ({uidValidity:"10",uids:[...seam.messages.keys()].filter(uid => uid > (cursor?.lastUid ?? 0) && uid <= seam.max),nextUid:seam.max}),
  fetchMailboxRaw: async (_resolver:unknown,_id:unknown,_validity:unknown,uid:number) => seam.messages.get(uid)!
}));
vi.mock("../offer-service/src/supplier-file-scan.js", () => ({scanAndExtractSupplierWorkbook:async (bytes:Buffer) => ({sheet:bytes})}));
vi.mock("../offer-service/src/price-mail-auth.js", async importOriginal => {
  const original = await importOriginal<typeof import("../offer-service/src/price-mail-auth.js")>();
  return {verifyPriceMail: (raw:Buffer,sender:string,subject:boolean) => original.verifyPriceMail(raw,sender,subject,seam.dns)};
});
import { buildOfferApp } from "../offer-service/src/app.js";
import { SupplierSourceStore } from "../offer-service/src/supplier-source-store.js";
import { createSupplierMailRuntime } from "../offer-service/src/supplier-mail-runtime.js";
import { CateringUserStore, createCateringUserRecord } from "../shared-core/src/catering-user-store.js";
import { hashCateringPin } from "../shared-core/src/catering-pin-crypto.js";
import { CATERING_SESSION_COOKIE, cateringSessionBinding, deriveCateringAuthKeys } from "../shared-core/src/catering-session-auth.js";

it("accepts a signed comparable follow-up, keeps replay idempotent, and leaves pack drift for review", async () => {
  const keys = generateKeyPairSync("rsa",{modulusLength:2048});
  seam.dns = async () => [["v=DKIM1; k=rsa; p="+keys.publicKey.export({format:"der",type:"spki"}).toString("base64")]];
  const cell = (ref:string, text:string) => `<c r="${ref}" t="inlineStr"><is><t>${text}</t></is></c>`;
  async function message(price:string, date:string, quantity="5 kg") {
    const xml = `<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData><row r="1">${cell("A1",date)}</row><row r="2">${cell("A2","Article")}${cell("B2","Name")}${cell("C2","Pack")}${cell("D2","Unit")}${cell("E2","Price")}</row><row r="3">${cell("A3","A")}${cell("B3","Flour")}${cell("C3",quantity)}${cell("D3","Box")}<c r="E3"><v>${price}</v></c></row></sheetData></worksheet>`;
    const body = `From: supplier@example.test\r\nSubject: Prices\r\nMIME-Version: 1.0\r\nContent-Type: multipart/mixed; boundary="boundary"\r\n\r\n--boundary\r\nContent-Type: application/xlsx\r\nContent-Disposition: attachment; filename="list.xlsx"\r\nContent-Transfer-Encoding: base64\r\n\r\n${Buffer.from(xml).toString("base64")}\r\n--boundary--\r\n`;
    const sig = await dkimSign(body,{headerList:"From:Subject:MIME-Version:Content-Type",signatureData:[{signingDomain:"example.test",selector:"supplier",privateKey:keys.privateKey.export({format:"pem",type:"pkcs8"})}]});
    expect(sig.errors).toHaveLength(0); return Buffer.from(sig.signatures+body);
  }
  seam.messages = new Map([[1,await message("10","2026-01-01")],[2,await message("12","2026-02-01")],[3,await message("12","2026-03-01","10 kg")]]);
  const rootDir = mkdtempSync(path.join(tmpdir(),"supplier-integration-"));
  const store = new SupplierSourceStore({rootDir});
  const ctx = {businessId:"tenant"};
  const runtime = createSupplierMailRuntime({scannerSocket:"/unused",intervalMs:60_000,mailboxes:[{businessId:"tenant",id:"mail",label:"Mailbox",generation:"x".repeat(32),host:"mail.example.test",port:993,user:"user",password:"private"}]},store);
  const users = new CateringUserStore({rootDir});
  const secret="integration-session-secret-123456789";
  async function cookie(role:"admin"|"read_only_operator") {
    const user = createCateringUserRecord({businessId:"tenant",userId:role,loginCode:role,displayName:role,pinHash:await hashCateringPin("482731"),role,active:true,now:new Date()});
    await users.create(ctx,user);
    const keys = deriveCateringAuthKeys(secret), now=Math.floor(Date.now()/1000), encode=(x:unknown)=>Buffer.from(JSON.stringify(x)).toString("base64url");
    const unsigned = `${encode({alg:"HS256",typ:"JWT"})}.${encode({sub:user.userId,sessionBinding:cateringSessionBinding({userId:user.userId,authEpoch:user.authEpoch},keys.bindingKey),iat:now-1,exp:now+3600,iss:"catering-agents-platform",aud:"catering-backoffice"})}`;
    return `${CATERING_SESSION_COOKIE}=${unsigned}.${createHmac("sha256",keys.jwtKey).update(unsigned).digest("base64url")}`;
  }
  const admin=await cookie("admin"), reader=await cookie("read_only_operator");
  const app=buildOfferApp({rootDir,userStore:users,supplierSourceStore:store,supplierSourceAdapter:runtime.adapter,env:{CATERING_DEFAULT_BUSINESS_ID:"tenant",CATERING_TRUSTED_ACTOR_SECRET:secret}});
  const base="/v1/offers/supplier-sources", headers={cookie:admin,host:"catering.test",origin:"https://catering.test"};
  expect((await app.inject({method:"GET",url:base,headers:{cookie:reader}})).statusCode).toBe(403);
  expect((await app.inject({method:"GET",url:base})).statusCode).toBe(403);
  const columns={headerRow:2,columns:{article:"A",description:"B",quantity:"C",unit:"D",price:"E"},headers:{article:"Article",description:"Name",quantity:"Pack",unit:"Unit",price:"Price"},validFrom:{row:1,column:"A",format:"iso"}};
  const created=await app.inject({method:"POST",url:base,headers,payload:{name:"Supplier",mailboxId:"mail",sender:"supplier@example.test",columns,autoApply:true}});
  expect(created.statusCode).toBe(200); expect(created.body).not.toContain("mailboxBinding");
  const id=created.json().source.id;
  const sample=await app.inject({method:"POST",url:`${base}/${id}/preview`,headers,payload:{uidValidity:"10",uid:1,part:"1"}});
  expect(sample.statusCode).toBe(200);
  const approval=await app.inject({method:"POST",url:`${base}/${id}/activate`,headers,payload:{previewId:sample.json().preview.id,expectedSourceVersion:sample.json().preview.sourceVersion,expectedConfigVersion:sample.json().preview.configVersion,articleMappings:[{article:"A",ingredientKey:"flour",quantity:"5",unit:"kg"}]}});
  expect(approval.statusCode).toBe(200);
  expect((await store.get(ctx,id))!.poll).toMatchObject({uidValidity:"10",lastUid:1});
  const caseResponse = await app.inject({method:"POST",url:"/v1/offers/cases",headers,payload:{eventTypeLabel:"Business Lunch",attendeeCount:35}});
  expect(caseResponse.statusCode).toBe(201);
  const draftResponse = await app.inject({method:"POST",url:"/v1/offers/from-text",headers,payload:{caseId:caseResponse.json().case.caseId,text:"Business Lunch fuer 35 Personen."}});
  expect(draftResponse.statusCode).toBe(201);
  const draft = draftResponse.json();
  const decision = await app.inject({method:"POST",url:`/v1/offers/drafts/${draft.draftId}/decision`,headers,payload:{ missingEventDateAcknowledged: true,decision:"approved",revision:1,variantId:draft.variantSet[0].variantId}});
  expect(decision.statusCode).toBe(201);
  const approvedId = decision.json().approvedOffer.approvedOfferId;
  const { OfferStore } = await import("../offer-service/src/store.js");
  const quoteStore = new OfferStore({rootDir});
  const releasedSnapshot = await quoteStore.getApprovedOffer(ctx,approvedId);
  expect(releasedSnapshot).toBeDefined();
  await runtime.pollOnce();
  expect(await quoteStore.getApprovedOffer(ctx,approvedId)).toEqual(releasedSnapshot);
  let prices=(await app.inject({method:"GET",url:`${base}/prices?ingredient=FLOUR`,headers})).json().prices;
  expect(prices).toHaveLength(1); expect(prices[0].price).toBe("12");
  await runtime.pollOnce(); expect((await store.get(ctx,id))!.prices).toHaveLength(2);
  seam.max=3; await runtime.pollOnce();
  prices=(await app.inject({method:"GET",url:`${base}/prices?ingredient=FLOUR`,headers})).json().prices;
  expect(prices[0].price).toBe("12");
  expect((await store.get(ctx,id))!.previews.filter(p=>!p.appliedAt)).toHaveLength(1);
  expect(await store.get({businessId:"other"},id)).toBeUndefined();
  await app.close();
});
