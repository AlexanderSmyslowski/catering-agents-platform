import { describe, it, expect, vi } from 'vitest';
import { imageDimensions, signRecipePreview, verifyRecipePreview } from '../production-service/src/recipe-vision.js';

describe('recipe image boundary', () => {
  it('rejects mismatched signatures and oversized image dimensions', () => {
    const png=Buffer.from('89504e470d0a1a0a0000000d494844520000000a00000014080600000000000000','hex');
    expect(imageDimensions(png,'image/png')).toEqual({width:10,height:20});
    expect(imageDimensions(Buffer.from('ffd8ffc0000b080014000a01011100ffd9','hex'),'image/jpeg')).toEqual({width:10,height:20});
    expect(()=>imageDimensions(png,'image/jpeg')).toThrow();
    const huge=Buffer.from(png); huge.writeUInt32BE(100000,16);
    expect(()=>imageDimensions(huge,'image/png')).toThrow();
  });
  it('binds authenticated preview text to business, file and expiry', () => {
    const token=signRecipePreview({businessId:'business-a',fileHash:'a'.repeat(64),actorBinding:'a'.repeat(64),text:'Allergene Milch',now:1000},'synthetic-vision-test-secret-only');
    expect(verifyRecipePreview(token,{businessId:'business-a',fileHash:'a'.repeat(64),actorBinding:'a'.repeat(64),now:1001},'synthetic-vision-test-secret-only')).toBe('Allergene Milch');
    expect(()=>verifyRecipePreview(token,{businessId:'business-b',fileHash:'a'.repeat(64),actorBinding:'a'.repeat(64),now:1001},'synthetic-vision-test-secret-only')).toThrow();
    expect(()=>verifyRecipePreview(token,{businessId:'business-a',fileHash:'b'.repeat(64),actorBinding:'a'.repeat(64),now:1001},'synthetic-vision-test-secret-only')).toThrow();
    expect(()=>verifyRecipePreview(token,{businessId:'business-a',fileHash:'a'.repeat(64),actorBinding:'a'.repeat(64),now:1000+900001},'synthetic-vision-test-secret-only')).toThrow();
    expect(()=>verifyRecipePreview(token,{businessId:'business-a',fileHash:'a'.repeat(64),actorBinding:'b'.repeat(64),now:1001},'synthetic-vision-test-secret-only')).toThrow();
    expect(()=>verifyRecipePreview(token+'x',{businessId:'business-a',fileHash:'a'.repeat(64),actorBinding:'a'.repeat(64),now:1001},'synthetic-vision-test-secret-only')).toThrow();
  });
});

import { recipeVisionCapability } from '../shared-core/src/byo-llm-runtime.js';
it('does not permit image processing without a distinct server-owned approval', () => {
  const result=recipeVisionCapability({},'business-a');
  expect(result.available).toBe(false);
});

import { requestRecipeImageTranscription } from '../shared-core/src/llm-readiness-openai-transport.js';
it('uses bounded vision payload and rejects malformed output', async () => {
  let observed:RequestInit|undefined;
  const fetchImpl=async (_url:string|URL|Request, init?:RequestInit) => { observed=init; return new Response(JSON.stringify({output_text:JSON.stringify({text:'200 g Reis'})}),{status:200}); };
  expect(await requestRecipeImageTranscription({apiKey:'fake',model:'fake',endpoint:'https://example.invalid',content:Buffer.from('fake'),mimeType:'image/png',fetchImpl})).toBe('200 g Reis');
  expect(observed?.redirect).toBe('error');
  const request=JSON.parse(String(observed?.body));
  expect(request.input[1].content[1].type).toBe('input_image');
  const bad=async()=>new Response(JSON.stringify({output_text:'not-json'}),{status:200});
  await expect(requestRecipeImageTranscription({apiKey:'fake',model:'fake',endpoint:'https://example.invalid',content:Buffer.from('fake'),mimeType:'image/png',fetchImpl:bad})).rejects.toThrow();
  const never=vi.fn();
  for(const endpoint of ['http://example.invalid','https://name:password@example.invalid','https://example.invalid/#fragment'])
    await expect(requestRecipeImageTranscription({apiKey:'fake',model:'fake',endpoint,content:Buffer.from('fake'),mimeType:'image/png',fetchImpl:never})).rejects.toThrow();
  expect(never).not.toHaveBeenCalled();
});

import { recipeImageCostBound } from '../shared-core/src/byo-llm-runtime.js';
it('requires current image-specific tariff, a supported snapshot and positive cost bound',()=>{
 const env={CATERING_LLM_MODEL:'gpt-5.4-2026-03-05',CATERING_RECIPE_VISION_TARIFF_PROFILE:'openai-gpt-5.4-high-v1',CATERING_RECIPE_VISION_TARIFF_VERIFIED_UNTIL:new Date(Date.now()+86400000).toISOString(),CATERING_RECIPE_VISION_USD_EUR_BOUND:'1.5',CATERING_RECIPE_VISION_MAX_COST_EUR:'1'};
 const bound=recipeImageCostBound(env,1000,1000);expect(bound).toBeGreaterThan(0);
 expect(recipeImageCostBound({...env,CATERING_LLM_MODEL:'unknown'},1000,1000)).toBeUndefined();
 expect(recipeImageCostBound({...env,CATERING_RECIPE_VISION_MAX_COST_EUR:'0'},1000,1000)).toBeUndefined();
 expect(recipeImageCostBound({...env,CATERING_RECIPE_VISION_TARIFF_PROFILE:''},1000,1000)).toBeUndefined();
 expect(recipeImageCostBound({...env,CATERING_RECIPE_VISION_TARIFF_VERIFIED_UNTIL:'2020-01-01T00:00:00Z'},1000,1000)).toBeUndefined();
 expect(recipeImageCostBound(env,10001,10)).toBeUndefined();
});
