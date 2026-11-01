// @vitest-environment jsdom
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, expect, it, vi } from "vitest";
import { ProductionRecipeLibraryPanel } from "../backoffice-ui/src/production-recipe-library-panel.js";
import { previewRecipeFile } from "../backoffice-ui/src/api.js";
vi.mock("../backoffice-ui/src/api.js",()=>({previewRecipeFile:vi.fn()}));
const roots:ReturnType<typeof createRoot>[]=[];
afterEach(()=>{for(const r of roots.splice(0))act(()=>r.unmount());vi.clearAllMocks();document.body.innerHTML="";});
const source="Synthetisches Rezept\nZutaten\n200 g Reis\n0,08 g Zimt\nZubereitung\nGaren.";
const file=new File([source],"synthetic.txt",{type:"text/plain"});
const button=(label:string)=>Array.from(document.querySelectorAll("button")).find(x=>x.textContent===label)!;
async function mount(){const root=createRoot(document.body.appendChild(document.createElement("div")));roots.push(root);const save=vi.fn(async():Promise<boolean|{saved:boolean;message?:string}>=>true);const props={statusState:{recipeReviewStatusLabel:"Prüfung nötig",recipeUsageStatusLabel:"",recipeReviewCounts:{approved:0,rejected:0,reviewRequired:0},recipeCount:0},uploadState:{recipeName:"",recipeFile:file},libraryState:{filteredRecipes:[]},recipeActions:{setRecipeName:vi.fn(),setRecipeFile:vi.fn(),uploadRecipe:save,reviewRecipe:vi.fn(async()=>{})},submitting:false};await act(async()=>root.render(createElement(ProductionRecipeLibraryPanel,props)));return {root,save,props};}
async function change(node:HTMLInputElement|HTMLTextAreaElement,value:string){await act(async()=>{const proto=node instanceof HTMLTextAreaElement?HTMLTextAreaElement.prototype:HTMLInputElement.prototype;Object.getOwnPropertyDescriptor(proto,"value")!.set!.call(node,value);node.dispatchEvent(new Event("input",{bubbles:true}));});}
it("reads without saving, requires explicit original servings and confirmation, keeps corrections after failure",async()=>{
 vi.mocked(previewRecipeFile).mockResolvedValue({text:source,servings:8});
 const {save}=await mount();
 expect(button("Datei einlesen")).toBeTruthy();
 await act(async()=>button("Datei einlesen").click());
 expect(save).not.toHaveBeenCalled();
 const servings=document.querySelector<HTMLInputElement>('#recipe-import-servings')!;
 expect(servings.value).toBe("");
 await act(async()=>button("In Rezeptbibliothek speichern").click());expect(save).not.toHaveBeenCalled();expect(document.activeElement).toBe(servings);
 await change(servings,"4");
 const text=document.querySelector<HTMLTextAreaElement>('#recipe-import-text')!;
 await change(text,source.replace("200 g","240 g"));
 await act(async()=>document.querySelector<HTMLInputElement>('#recipe-import-confirmed')!.click());
 save.mockResolvedValueOnce({saved:false,message:"Menge ist nicht eindeutig."});
 await act(async()=>button("In Rezeptbibliothek speichern").click());
 expect(save).toHaveBeenLastCalledWith("production",undefined,{text:source.replace("200 g","240 g"),servings:4,confirmed:true});
 expect(text.value).toContain("240 g");expect(document.body.textContent).toContain("Eingaben sind erhalten");expect(document.querySelector('section[aria-label="Rezept aus Datei übernehmen"]')!.textContent).toContain("Menge ist nicht eindeutig.");
 await change(text,source);expect(document.querySelector<HTMLInputElement>('#recipe-import-confirmed')!.checked).toBe(false);
});
it("ignores a late preview when its original file has changed",async()=>{
 let finish!:(v:{text:string})=>void;vi.mocked(previewRecipeFile).mockImplementationOnce(()=>new Promise(resolve=>{finish=resolve;}));
 const {root,props,save}=await mount();
 await act(async()=>button("Datei einlesen").click());
 await act(async()=>root.render(createElement(ProductionRecipeLibraryPanel,{...props,uploadState:{...props.uploadState,recipeFile:new File(["Andere Vorlage"],"other.txt")}})));
 await act(async()=>finish({text:source}));
 expect(document.querySelector('#recipe-import-text')).toBeNull();expect(save).not.toHaveBeenCalled();
});
