// @vitest-environment jsdom
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { groupDishQuestions } from "../backoffice-ui/src/production-question-grouping.js";
import { ProductionQuestionPanel } from "../backoffice-ui/src/production-question-panel.js";
import { menuCategoryQuestion, productionModeQuestion } from "../backoffice-ui/src/production-question-language-state.js";

function panel(editing: boolean) {
  const labels = ["Kürbissuppe", "Hähnchenragout", "Quiche", "Mousse"];
  const menuPlan = labels.map((label, index) => ({componentId: `c${index}`, label}));
  const questions = ["Welche Sonderkost ist zu berücksichtigen?", ...labels.flatMap(label => [menuCategoryQuestion(label), productionModeQuestion(label)])];
  const spec = {specId:"synthetic",event:{type:"dinner",date:"2026-11-13",schedule:[{label:"Service",start:"18:00",end:"21:00"}]},attendees:{expected:80},menuPlan,missingFields:[],uncertainties:[],readiness:{status:"partial"}};
  const states = Object.fromEntries(menuPlan.map(c => [c.componentId,{menuCategory:"",productionMode:"",purchasedElements:"",recipeOverrideId:"",notes:""}]));
  const messages = questions.map((text, i) => ({messageId:`q${i}`,type:"structured_agent_question" as const,role:"agent" as const,title:"Frage",text,questionIndex:i+1}));
  const noop = () => {}; const asyncNoop = async () => {};
  const html = renderToStaticMarkup(<ProductionQuestionPanel questionState={{focusedProductionSpec:spec,focusedSpecReadinessLabel:"Prüfung nötig",currentSpecPurchaseLists:[],productionQuestions:questions,productionAssumptions:[],productionConversationProjection:{sessionId:"synthetic",messages},workbenchSpecFacts:[],intakeRequestDetail:null,filteredSpecs:[],documentPhase:"done",productionWorkspaceCleared:false}} questionActions={{openSpecForQuestions:noop}} submitting={false} editorState={{editingSpecId:editing ? "synthetic" : undefined,editingEventType:"dinner",editingEventDate:"2026-11-13",editingEventSchedule:"18:00-21:00",editingAttendeeCount:"80",editingServiceForm:"buffet",editingMenuItems:labels.join(", "),editingComponentStates:states,hasFocusedSpecEditChanges:true,recipes:[]}} editorActions={{setEditingEventType:noop,setEditingEventDate:noop,setEditingEventSchedule:noop,setEditingAttendeeCount:noop,setEditingServiceForm:noop,setEditingMenuItems:noop,updateEditingComponentState:noop,beginSpecEdit:noop,saveSpecEdit:asyncNoop,createPlan:asyncNoop,resetSpecEdit:noop}} />);
  const node = document.createElement("div"); node.innerHTML = html; return node;
}

describe("production question grouping", () => {
  it("leaves identically named dishes ungrouped and counts unique rows consistently", () => {
    const duplicated = { menuPlan: [{componentId:"a",label:"Quiche"},{componentId:"b",label:"Quiche"}] };
    const questions = [menuCategoryQuestion("Quiche"), productionModeQuestion("Quiche")];
    expect(groupDishQuestions(duplicated,questions)).toEqual({components:[],texts:[],openCount:2});
    const unique = {menuPlan:[{componentId:"a",label:"Quiche"}]};
    expect(groupDishQuestions(unique,["Sonderkost?",...questions]).openCount).toBe(2);
  });
  it("shows the special-diet question and one row per dish before editing", () => {
    const node=panel(false);
    expect(node.textContent).toContain("5 Rückfragen beantworten");
    expect(node.textContent).toContain("Welche Sonderkost ist zu berücksichtigen?");
    expect(node.querySelectorAll('[aria-label="Gerichte zuordnen"] [role="group"]')).toHaveLength(4);
    expect(node.querySelectorAll('[aria-label="Gerichte zuordnen"] select')).toHaveLength(0);
  });
  it("offers one pair of selectors per dish and keeps further details folded", () => {
    const node=panel(true);
    expect(node.querySelectorAll('[aria-label="Gerichte zuordnen"] select')).toHaveLength(8);
    expect(node.querySelectorAll('select[aria-label="Kategorie im Angebot"]')).toHaveLength(4);
    expect(node.querySelectorAll('select[aria-label="Herstellungsart"]')).toHaveLength(4);
    const details = [...node.querySelectorAll("details")].find(item => item.querySelector("summary")?.textContent?.includes("Weitere Angaben"));
    expect(details?.open).toBe(false);
  });
});
