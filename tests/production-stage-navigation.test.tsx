// @vitest-environment jsdom
import { act, createElement, useState } from "react";
import { createRoot } from "react-dom/client";
import { expect, it } from "vitest";
import { ProductionConversationalWorkbench } from "../backoffice-ui/src/production-workbench.js";

function Draft() {
  const [value, setValue] = useState("");
  return <input aria-label="Entwurf" value={value} onChange={event => setValue(event.target.value)} />;
}

it("keeps drafts when moving between steps and reveals the requested target", async () => {
  const container = document.createElement("div"); document.body.append(container);
  const root = createRoot(container);
  const summary = { activeSpecLabel: "Test", readinessLabel: "-", planStatusLabel: "offen", purchaseStatusLabel: "noch keine Liste", questionCount: 1, answeredQuestionCount: 0, unansweredQuestionCount: 1, productionObjectCount: 0, productionObjectStatusLabel: "noch kein Plan", purchaseListCount: 0, hasActiveContext: true };
  const report = { statusLabel: "", reasonLabel: "", nextStepLabel: "", commandLabel: "", errorLabels: [] };
  try {
    await act(async () => root.render(<ProductionConversationalWorkbench summary={summary} nextStep={{title:"Nächster Schritt",description:"Prüfen"}} miniPilotRawResult="" setMiniPilotRawResult={() => {}} miniPilotReportState={report} slots={{inputSlot:<Draft />,questionsSlot:<button id="question-target">Frage</button>,planningSlot:<p>Planung</p>,productionObjectsSlot:<p>Plan</p>,purchaseListSlot:<p>Einkauf</p>,lowerSlots:<p>Rezepte</p>}} />));
    const input = container.querySelector<HTMLInputElement>('input[aria-label="Entwurf"]')!;
    await act(async () => { Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,"value")!.set!.call(input,"ungespeichert"); input.dispatchEvent(new Event("input",{bubbles:true})); });
    const click = async (label:string) => act(async () => { [...container.querySelectorAll("button")].find(b=>b.textContent?.includes(label))!.click(); });
    await click("Einkauf");
    expect(container.querySelector<HTMLElement>('[data-production-stage="purchase"]')!.hidden).toBe(false);
    await click("Auftrag");
    expect(container.querySelector<HTMLInputElement>('input[aria-label="Entwurf"]')!.value).toBe("ungespeichert");
    await act(async () => window.dispatchEvent(new CustomEvent("production:reveal", { detail:{selector:"#question-target"} })));
    expect(container.querySelector<HTMLElement>('[data-production-stage="questions"]')!.hidden).toBe(false);
  } finally { await act(async () => root.unmount()); container.remove(); }
});

it("does not expose unrelated work when there is no production context", async () => {
  const container=document.createElement("div");document.body.append(container);const root=createRoot(container);
  const summary={activeSpecLabel:"-",readinessLabel:"-",planStatusLabel:"offen",purchaseStatusLabel:"noch keine Liste",questionCount:0,answeredQuestionCount:0,unansweredQuestionCount:0,productionObjectCount:0,productionObjectStatusLabel:"noch kein Plan",purchaseListCount:0};
  const report={statusLabel:"",reasonLabel:"",nextStepLabel:"",commandLabel:"",errorLabels:[]};
  try {
    await act(async()=>root.render(<ProductionConversationalWorkbench summary={summary} nextStep={{title:"",description:""}} miniPilotRawResult="" setMiniPilotRawResult={()=>{}} miniPilotReportState={report} slots={{inputSlot:<p>Quelle</p>,questionsSlot:<p>Fremde Frage</p>,productionObjectsSlot:<p>Fremder Plan</p>,purchaseListSlot:<p>Fremder Einkauf</p>,lowerSlots:<p>Fremdes Rezept</p>}} />));
    expect(container.textContent).not.toContain("Fremde Frage");
    expect(container.textContent).not.toContain("Fremder Plan");
    await act(async()=>[...container.querySelectorAll("button")].find(b=>b.textContent?.includes("Einkauf"))!.click());
    expect(container.textContent).toContain("Bitte zuerst einen Auftrag eingeben oder öffnen.");
    expect(container.textContent).not.toContain("Fremder Einkauf");
  } finally {await act(async()=>root.unmount());container.remove();}
});
