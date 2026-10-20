// @vitest-environment jsdom
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, expect, it, vi } from "vitest";
import { createEventRequestFromText, createOfferDraft } from "@catering/shared-core";
import { App } from "../backoffice-ui/src/App.js";
import { adminSessionResponse } from "./support/catering-session-ui-fixture.js";
let root: Root | undefined;
afterEach(async () => { if(root) await act(async()=>root!.unmount()); root=undefined; document.body.innerHTML=""; vi.unstubAllGlobals(); window.history.replaceState({},"","/"); });
it("keeps the actual App editor through pending/failed reload and acknowledges only the loaded new draft", async () => {
  const draft = createOfferDraft(createEventRequestFromText({requestId:"synthetic-save-flow",channel:"text",rawText:"SYNTHETISCH: Abendbuffet für 100 Gäste am 12.11.2026. 55 Portionen Hähnchen, 25 Portionen Bratlinge, 20 Portionen Linsenragout."}));
  const revised = {...structuredClone(draft),draftId:"saved-event-draft"};
  const summary={caseId:"save-case",product:"offer",displayName:"SYNTHETISCH Speicherprüfung",status:"open",createdAt:"2026-10-20T00:00:00Z",updatedAt:"2026-10-20T00:00:00Z"};
  let afterPost=false;
  let finishReload: ((response:Response)=>void) | undefined;
  let reloadResult: "pending" | "success" = "pending";
  const detail=(current:typeof draft)=>({case:{...summary,schemaVersion:"1.0",businessId:"local",version:1},events:[],currentDraft:current});
  vi.stubGlobal("fetch",vi.fn(async(input:RequestInfo|URL,init?:RequestInit)=>{
    const url=String(input),method=init?.method??"GET";
    if(url.endsWith("/auth/session")) return adminSessionResponse();
    if(url.endsWith("/api/offers/health"))return Response.json({service:"offer-service",status:"ok",timestamp:"",counts:{}});
    if(method==="GET" && url.endsWith("/api/offers/v1/offers/cases"))return Response.json({items:[summary]});
    if(method==="GET" && url.endsWith("/cases/save-case")) {
      if(!afterPost)return Response.json(detail(draft));
      if(reloadResult==="success")return Response.json(detail(revised));
      return new Promise<Response>(resolve=>{finishReload=resolve;});
    }
    if(method==="POST" && url.endsWith(`/drafts/${draft.draftId}/menu`)){afterPost=true;return Response.json(revised,{status:201});}
    if(url.startsWith("/api/intake/v1/intake/specs/"))return Response.json({message:"No live intake in synthetic fixture"},{status:404});
    throw new Error(`Unexpected synthetic request: ${method} ${url}`);
  }));
  const storage = new Map<string,string>();
  const storageMock = {getItem:(key:string)=>storage.get(key)??null,setItem:(key:string,value:string)=>storage.set(key,value),removeItem:(key:string)=>storage.delete(key),clear:()=>storage.clear()};
  Object.defineProperty(window,"localStorage",{configurable:true,value:storageMock});
  Object.defineProperty(window,"sessionStorage",{configurable:true,value:storageMock});
  window.history.replaceState({},"","/angebot");
  const container=document.createElement("div");document.body.append(container);root=createRoot(container);
  await act(async()=>{root!.render(createElement(App));});
  const button=(label:string)=>[...container.querySelectorAll("button")].find(b=>(b.getAttribute("aria-label")??b.textContent)===label)!;
  await act(async()=>{(container.querySelector("button[data-action='open-case']") as HTMLButtonElement).click();});
  await act(async()=>button("Veranstaltungsdaten bearbeiten").click());
  const editor=container.querySelector('[aria-label="Veranstaltungsdaten des Angebots"]')!;
  expect(container.querySelector("[data-action='case-next-action']")?.textContent).not.toContain("Wird ausgeführt");
  await act(async()=>button("Änderungen speichern").click());
  expect(finishReload).toBeDefined();
  expect(editor.isConnected).toBe(true);expect(editor.querySelector("form")).not.toBeNull();
  await act(async()=>finishReload!(Response.json({message:"Netz unterbrochen"},{status:500})));
  expect(editor.isConnected).toBe(true);expect(editor.textContent).toContain("Die neue Fassung wurde gespeichert");
  expect((editor.querySelector('input[type="number"]') as HTMLInputElement).disabled).toBe(true);
  expect(editor.querySelector('input[type="number"]')?.getAttribute("value")).toBe("100");
  reloadResult="success";
  await act(async()=>button("Gespeicherte Fassung laden").click());
  expect(vi.mocked(fetch).mock.calls.filter(([,init])=>init?.method==="POST")).toHaveLength(1);
  expect(editor.isConnected).toBe(true);expect(editor.querySelector("form")).toBeNull();
  expect(editor.querySelector('[role="status"]')?.textContent).toContain("Gespeichert als neue Fassung");
  expect(container.querySelector('a[href*="saved-event-draft/html"]')).not.toBeNull();
});
