// @vitest-environment jsdom
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, expect, it, vi } from "vitest";
import { ProductionRecipeLibraryPanel } from "../backoffice-ui/src/production-recipe-library-panel.js";
import { previewRecipeFile } from "../backoffice-ui/src/api.js";
vi.mock("../backoffice-ui/src/api.js",()=>({previewRecipeFile:vi.fn(),loadRecipeVisionCapability:vi.fn(async()=>({available:false}))}));
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
it('refreshes an expired image preview only on explicit click and preserves corrections',async()=>{
 const api=await import('../backoffice-ui/src/api.js');
 vi.mocked(api.loadRecipeVisionCapability).mockResolvedValue({available:true,provider:'OpenAI',model:'mock'});
 vi.mocked(previewRecipeFile).mockResolvedValueOnce({text:source,previewToken:'first'}).mockResolvedValueOnce({text:source.replace('200 g','210 g'),previewToken:'second'});
 const {root,props,save}=await mount();
 await act(async()=>root.render(createElement(ProductionRecipeLibraryPanel,{...props,uploadState:{...props.uploadState,recipeFile:new File(['image'],'test.png',{type:'image/png'})}})));
 await act(async()=>document.querySelector<HTMLInputElement>('.recipe-import__confirmation input')!.click());
 await act(async()=>button('Bild mit KI lesen').click());
 await change(document.querySelector<HTMLTextAreaElement>('#recipe-import-text')!,source.replace('200 g','240 g'));
 await change(document.querySelector<HTMLInputElement>('#recipe-import-servings')!,'4');
 await act(async()=>document.querySelector<HTMLInputElement>('#recipe-import-confirmed')!.click());
 save.mockResolvedValueOnce({saved:false,message:'Vorschau abgelaufen'} as never);
 await act(async()=>button('In Rezeptbibliothek speichern').click());
 expect(previewRecipeFile).toHaveBeenCalledTimes(1);
 await act(async()=>button('Bild erneut mit KI lesen').click());
 expect(document.querySelector<HTMLTextAreaElement>('#recipe-import-text')!.value).toContain('240 g');
 expect(document.querySelector<HTMLInputElement>('#recipe-import-servings')!.value).toBe('4');
 expect(document.querySelector<HTMLInputElement>('#recipe-import-confirmed')!.checked).toBe(false);
 expect(document.body.textContent).toContain('neu erkannten Text');
 await act(async()=>button('Verwerfen').click());
 await act(async()=>button('Vorschau verwerfen').click());
 expect(document.querySelector<HTMLInputElement>('.recipe-import__confirmation input')!.checked).toBe(false);
 vi.mocked(previewRecipeFile).mockResolvedValueOnce({text:'Manuelle Übertragung aus der Originaldatei.',previewToken:'manual'});
 await act(async()=>button('Rezept manuell übertragen').click());
 expect(document.querySelector<HTMLTextAreaElement>('#recipe-import-text')!.value).toBe('');
 expect(document.querySelector<HTMLInputElement>('#recipe-import-servings')!.value).toBe('');
});
it('keeps PDF text/manual options without offering PDF vision',async()=>{
 const api=await import('../backoffice-ui/src/api.js');vi.mocked(api.loadRecipeVisionCapability).mockResolvedValue({available:true,provider:'OpenAI',model:'gpt-5.4-2026-03-05'});
 const {root,props}=await mount();await act(async()=>root.render(createElement(ProductionRecipeLibraryPanel,{...props,uploadState:{...props.uploadState,recipeFile:new File(['pdf'],'test.pdf',{type:'application/pdf'})}})));
 expect(button('Datei einlesen')).toBeTruthy();expect(button('Rezept manuell übertragen')).toBeTruthy();expect(button('Bild mit KI lesen')).toBeUndefined();
});
it('keeps an image visible for manual entry, blocks silent file/locale replacement and revokes local preview',async()=>{
 const originalURL=URL;const create=vi.fn(()=> 'blob:synthetic-image');const revoke=vi.fn();
 vi.stubGlobal('URL',class extends originalURL {static createObjectURL=create;static revokeObjectURL=revoke;});
 try {
  const api=await import('../backoffice-ui/src/api.js');vi.mocked(api.loadRecipeVisionCapability).mockResolvedValue({available:false});
  vi.mocked(previewRecipeFile).mockResolvedValue({text:'Manuelle Übertragung aus der Originaldatei.',previewToken:'synthetic'});
  const {root,props}=await mount();const imageFile=new File(['fake'],'rezept.png',{type:'image/png'});
  await act(async()=>root.render(createElement(ProductionRecipeLibraryPanel,{...props,uploadState:{...props.uploadState,recipeFile:imageFile}})));
  expect(button('Datei einlesen')).toBeUndefined();expect(button('Rezept manuell übertragen')).toBeTruthy();
  expect(button('Rezept manuell übertragen').classList.contains('secondary-button')).toBe(false);
  expect(document.body.textContent).toContain('gescannte PDFs kannst du manuell übertragen');
  expect(document.querySelector<HTMLImageElement>('img[alt="Originaldatei zum Abgleichen"]')?.getAttribute('src')).toBe('blob:synthetic-image');
  await act(async()=>button('Rezept manuell übertragen').click());
  expect(document.querySelector<HTMLInputElement>('input[type=file]')!.disabled).toBe(true);
  expect(document.querySelector<HTMLSelectElement>('select')!.disabled).toBe(true);
  expect(document.body.textContent).toContain('zuerst verwerfen');
  await act(async()=>button('Verwerfen').click());
  expect(button('Vorschau verwerfen')).toBeUndefined();
  expect(document.activeElement).toBe(button('Rezept manuell übertragen'));
  await act(async()=>button('Rezept manuell übertragen').click());
  await change(document.querySelector<HTMLTextAreaElement>('#recipe-import-text')!,source);
  await change(document.querySelector<HTMLInputElement>('#recipe-import-servings')!,'4');
  await act(async()=>button('Verwerfen').click());expect(button('Vorschau verwerfen')).toBeTruthy();
  await act(async()=>button('Vorschau verwerfen').click());
  expect(document.activeElement).toBe(button('Rezept manuell übertragen'));
  await act(async()=>root.render(createElement(ProductionRecipeLibraryPanel,{...props,uploadState:{...props.uploadState,recipeFile:null}})));
  expect(revoke).toHaveBeenCalledWith('blob:synthetic-image');
 } finally {vi.unstubAllGlobals();}
});
