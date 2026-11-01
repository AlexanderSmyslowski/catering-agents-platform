import { describe, it, expect, vi } from 'vitest';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { buildProductionApp } from '../production-service/src/app.js';
const secret='synthetic-vision-test-secret-only';
const headers={'x-catering-trusted-secret':secret,'x-catering-actor-name':'Administrator','x-catering-business-id':'local'};
const png=Buffer.from('89504e470d0a1a0a0000000d494844520000000a00000014080600000000000000','hex');
const text='Reis\nZutaten\n200 g Reis\nZubereitung\nGaren.\nAllergene\nMilch';
function multipart(fields:Record<string,string>, file:Buffer=png, mime='image/png', filename='recipe.png') {
 const boundary='test-boundary-vision'; const chunks:Buffer[]=[];
 for(const [key,value] of Object.entries(fields)) chunks.push(Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="${key}"\r\n\r\n${value}\r\n`));
 chunks.push(Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="${filename}"\r\nContent-Type: ${mime}\r\n\r\n`),file,Buffer.from(`\r\n--${boundary}--\r\n`));
 return {payload:Buffer.concat(chunks),headers:{...headers,'content-type':`multipart/form-data; boundary=${boundary}`}};
}
function setup(approved:boolean, endpoint="https://api.openai.com/v1/responses", overrides:Record<string,string | undefined> = {}) {
 const root=mkdtempSync(path.join(tmpdir(),'vision-route-')); const approval=path.join(root,'approval.json');
 writeFileSync(approval,JSON.stringify({approvalId:'synthetic',businessId:'local',providerKind:'openai',allowedDataClasses:['personal_confidential'],allowedPurposes:approved?['recipe_image_extraction']:['production_draft_extraction'],allowedModels:['gpt-5.4-2026-03-05'],allowedCapabilities:approved?['recipe_image_understanding']:['document_understanding'],allowedRegions:['eu'],allowedEndpoints:[endpoint],maxCostEurPerCall:1,retentionPolicy:'test',trainingUse:'contractually_excluded',legalBasisReference:'synthetic',approvedBy:'test',approvedAt:'2025-01-01T00:00:00Z',expiresAt:'2099-01-01T00:00:00Z'}),{mode:0o600});
 const env={CATERING_DEV_AUTH:'1',CATERING_SYNTHETIC_LLM_SLICE:'1',CATERING_LLM_PROVIDER:'openai',CATERING_LLM_MODEL:'gpt-5.4-2026-03-05',CATERING_LLM_API_KEY:'synthetic',CATERING_RECIPE_VISION_CAPABILITY:'recipe_image_understanding',CATERING_RECIPE_VISION_TARIFF_PROFILE:'openai-gpt-5.4-high-v1',CATERING_RECIPE_VISION_TARIFF_VERIFIED_UNTIL:new Date(Date.now()+86400000).toISOString(),CATERING_RECIPE_VISION_USD_EUR_BOUND:'1.5',CATERING_RECIPE_VISION_MAX_COST_EUR:'1',CATERING_RECIPE_VISION_DATA_MODE:'pseudonymized_approved',CATERING_LLM_PROCESSING_REGION:'eu',CATERING_LLM_MAX_ESTIMATED_COST_EUR:'0',CATERING_LLM_RETENTION_POLICY:'test',CATERING_LLM_TRAINING_USE:'contractually_excluded',CATERING_LLM_BASE_URL:endpoint,CATERING_LLM_PROCESSING_APPROVAL_FILE:approval,...overrides};
 return buildProductionApp({env,trustedActorSecret:secret,dataRoot:root});
}
function syntheticPdf(pages:number):Buffer {
 const objs=['<< /Type /Catalog /Pages 2 0 R >>',`<< /Type /Pages /Kids [${Array.from({length:pages},(_,i)=>`${i+3} 0 R`).join(' ')}] /Count ${pages} >>`,...Array.from({length:pages},()=>`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << >> /Contents ${pages+3} 0 R >>`),'<< /Length 0 >>\nstream\n\nendstream'];
 let pdf='%PDF-1.4\n';const offsets:number[]=[];objs.forEach((o,i)=>{offsets.push(Buffer.byteLength(pdf));pdf+=`${i+1} 0 obj\n${o}\nendobj\n`;});const x=Buffer.byteLength(pdf);pdf+=`xref\n0 ${objs.length+1}\n0000000000 65535 f \n`;for(const o of offsets)pdf+=`${String(o).padStart(10,'0')} 00000 n \n`;return Buffer.from(pdf+`trailer\n<< /Size ${objs.length+1} /Root 1 0 R >>\nstartxref\n${x}\n%%EOF\n`);
}
describe('recipe vision',()=>{
 it('denies an absent image tariff or too-small image ceiling before any fetch',async()=>{for(const overrides of [{CATERING_RECIPE_VISION_TARIFF_PROFILE:''},{CATERING_RECIPE_VISION_MAX_COST_EUR:'0.0001'}]){const app=setup(true,undefined,overrides);const fetch=vi.fn();vi.stubGlobal('fetch',fetch);try{const res=await app.inject({method:'POST',url:'/v1/production/recipes/upload?preview=true&vision=true',...multipart({})});expect(res.statusCode).toBe(422);expect(fetch).not.toHaveBeenCalled();}finally{await app.close();vi.unstubAllGlobals();}}});
 it('rejects even approved HTTP endpoints before provider transmission',async()=>{const app=setup(true,'http://api.openai.com/v1/responses');const fetch=vi.fn();vi.stubGlobal('fetch',fetch);try{const cap=await app.inject({url:'/v1/production/recipes/vision-capability',headers});expect(cap.json().available).toBe(false);const res=await app.inject({method:'POST',url:'/v1/production/recipes/upload?preview=true&vision=true',...multipart({})});expect(res.statusCode).toBe(422);expect(fetch).not.toHaveBeenCalled();}finally{await app.close();vi.unstubAllGlobals();}});
 it('bounds scanned PDF pages before provider transmission and supports manual entry without provider approval',async()=>{
  const app=setup(true);const fetch=vi.fn(async()=>new Response(JSON.stringify({output_text:JSON.stringify({text})}),{status:200}));vi.stubGlobal('fetch',fetch);
  try {const many=await app.inject({method:'POST',url:'/v1/production/recipes/upload?preview=true&vision=true',...multipart({},syntheticPdf(5),'application/pdf','recipe.pdf')});expect(many.statusCode).toBe(422);expect(fetch).not.toHaveBeenCalled();
   const one=await app.inject({method:'POST',url:'/v1/production/recipes/upload?preview=true&vision=true',...multipart({},syntheticPdf(1),'application/pdf','recipe.pdf')});expect(one.statusCode).toBe(422);expect(fetch).not.toHaveBeenCalled();
   const manual=await app.inject({method:'POST',url:'/v1/production/recipes/upload?preview=true&manual=true',...multipart({})});expect(manual.statusCode).toBe(200);expect(fetch).not.toHaveBeenCalled();
  }finally{await app.close();vi.unstubAllGlobals();}
 });

 it('denies before transmitting bytes when only the text purpose was approved',async()=>{
  const app=setup(false);const fetch=vi.fn();vi.stubGlobal('fetch',fetch);
  try {const noRole=await app.inject({url:'/v1/production/recipes/vision-capability',headers:{'x-catering-trusted-secret':secret,'x-catering-business-id':'local','x-catering-actor-name':'Leser'}});expect(noRole.statusCode).toBe(403);const cap=await app.inject({url:'/v1/production/recipes/vision-capability',headers});expect(cap.json().available).toBe(false);const res=await app.inject({method:'POST',url:'/v1/production/recipes/upload?preview=true&vision=true',...multipart({})});expect(res.statusCode).toBe(422);expect(fetch).not.toHaveBeenCalled();}finally{await app.close();vi.unstubAllGlobals();}
 });
 it('transcribes only after approval and saves reviewed text without another provider call',async()=>{
  const app=setup(true);const fetch=vi.fn(async()=>new Response(JSON.stringify({output_text:JSON.stringify({text})}),{status:200}));vi.stubGlobal('fetch',fetch);
  try {const cap=await app.inject({url:'/v1/production/recipes/vision-capability',headers});expect(cap.json().available).toBe(true);
   const preview=await app.inject({method:'POST',url:'/v1/production/recipes/upload?preview=true&vision=true',...multipart({})});expect(preview.statusCode).toBe(200);const candidate=preview.json().preview;expect(candidate.text).toBe(text);expect(fetch).toHaveBeenCalledTimes(1);
   const review={text:text.replace('200 g','240 g'),servings:4,confirmed:true,previewToken:candidate.previewToken};
   const altered=await app.inject({method:'POST',url:'/v1/production/recipes/upload',...multipart({review:JSON.stringify(review)},Buffer.concat([png,Buffer.from('x')]))});expect(altered.statusCode).toBe(422);
   const save=await app.inject({method:'POST',url:'/v1/production/recipes/upload',...multipart({review:JSON.stringify(review)})});expect(save.statusCode).toBe(201);expect(save.json().recipe.allergens).toContain('milk');expect(save.json().recipe.source.approvalState).toBe('review_required');expect(fetch).toHaveBeenCalledTimes(1);
  }finally{await app.close();vi.unstubAllGlobals();}
 });
});

it('binds a manual preview to the verified user and the exact authenticated session',async()=>{
 const {createHmac}=await import('node:crypto');
 const {CateringUserStore,createCateringUserRecord}=await import('../shared-core/src/catering-user-store.js');
 const {hashCateringPin}=await import('../shared-core/src/catering-pin-crypto.js');
 const {deriveCateringAuthKeys,cateringSessionBinding,CATERING_SESSION_COOKIE}=await import('../shared-core/src/catering-session-auth.js');
 const root=mkdtempSync(path.join(tmpdir(),'vision-session-'));const userStore=new CateringUserStore({rootDir:root});
 const users=await Promise.all(['alpha','beta'].map(async name=>createCateringUserRecord({businessId:'local',userId:name,loginCode:name,displayName:name,pinHash:await hashCateringPin('482731'),role:'admin',active:true,now:new Date()})));
 for(const user of users)expect(await userStore.create({businessId:'local'},user)).toBe('created');
 const app=buildProductionApp({dataRoot:root,userStore,env:{CATERING_TRUSTED_ACTOR_SECRET:secret},trustedActorSecret:secret});const keys=deriveCateringAuthKeys(secret);
 function token(i:number,jti:string){const user=users[i]!;const now=Math.floor(Date.now()/1000);const enc=(x:object)=>Buffer.from(JSON.stringify(x)).toString('base64url');const body=`${enc({alg:'HS256',typ:'JWT'})}.${enc({sub:user.userId,sessionBinding:cateringSessionBinding({userId:user.userId,authEpoch:user.authEpoch},keys.bindingKey),iat:now-1,exp:now+3600,iss:'catering-agents-platform',aud:'catering-backoffice',jti})}`;return `${body}.${createHmac('sha256',keys.jwtKey).update(body).digest('base64url')}`;}
 function form(session:string,fields:Record<string,string>){const body=multipart(fields);return {...body,headers:{...body.headers,cookie:`${CATERING_SESSION_COOKIE}=${session}`,host:'catering.test',origin:'https://catering.test'}};}
 try {const a=token(0,'session-a'),otherSession=token(0,'session-b'),otherUser=token(1,'session-c');
  const preview=await app.inject({method:'POST',url:'/v1/production/recipes/upload?preview=true&manual=true',...form(a,{})});expect(preview.statusCode).toBe(200);
  const review=JSON.stringify({text,servings:4,confirmed:true,previewToken:preview.json().preview.previewToken});
  for(const wrong of [otherSession,otherUser]){const rejected=await app.inject({method:'POST',url:'/v1/production/recipes/upload',...form(wrong,{review})});expect(rejected.statusCode).toBe(422);}
  const accepted=await app.inject({method:'POST',url:'/v1/production/recipes/upload',...form(a,{review})});expect(accepted.statusCode).toBe(201);
 }finally{await app.close();}
});
