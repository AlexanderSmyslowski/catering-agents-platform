import { createHmac, timingSafeEqual } from 'node:crypto';

const maxImagePixels = 24_000_000;
const maxImageDimension = 10_000;
const previewLifetimeMs = 15 * 60_000;

/** Inspect headers without decoding pixels; limits also apply to compressed images. */
export function imageDimensions(content: Buffer, mimeType: string): {width:number; height:number} {
  let width = 0, height = 0;
  if (mimeType === 'image/png' && content.length >= 33 && content.subarray(0,8).equals(Buffer.from('89504e470d0a1a0a','hex')) && content.readUInt32BE(8) === 13 && content.toString('ascii',12,16) === 'IHDR') {
    width=content.readUInt32BE(16); height=content.readUInt32BE(20);
  } else if (mimeType === 'image/jpeg' && content.length >= 4 && content[0] === 0xff && content[1] === 0xd8) {
    let offset=2;
    while (offset+4 <= content.length) {
      if (content[offset++] !== 0xff) break;
      while (content[offset] === 0xff) offset++;
      const marker=content[offset++];
      if (marker === undefined || marker === 0xda || marker === 0xd9) break;
      if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) continue;
      if (offset+2 > content.length) break;
      const size=content.readUInt16BE(offset);
      if (size < 2 || offset+size > content.length) break;
      if ([0xc0,0xc1,0xc2,0xc3,0xc5,0xc6,0xc7,0xc9,0xca,0xcb,0xcd,0xce,0xcf].includes(marker)) {
        if (size < 8) break;
        height=content.readUInt16BE(offset+3); width=content.readUInt16BE(offset+5); break;
      }
      offset+=size;
    }
  }
  if (!width || !height || width>maxImageDimension || height>maxImageDimension || width*height>maxImagePixels) {
    throw Object.assign(new Error('Bildformat oder Bildgröße nicht unterstützt. Bitte ein kleineres JPEG oder PNG wählen.'),{statusCode:422});
  }
  return {width,height};
}

type PreviewInput = {businessId:string;fileHash:string;actorBinding:string;text:string;now:number};
type PreviewContext = Omit<PreviewInput,'text'>;
function previewKey(secret:string): Buffer {
  if (Buffer.byteLength(secret,'utf8') < 32) throw new Error('Bildvorschau ist nicht konfiguriert.');
  return createHmac('sha256',secret).update('catering:recipe-image-preview:v1').digest();
}
function previewError(): Error { return Object.assign(new Error('Bildvorschau ist ungültig oder abgelaufen. Bitte erneut einlesen.'),{statusCode:422}); }
export function signRecipePreview(input: PreviewInput, secret:string): string {
  if (!input.text.trim() || Buffer.byteLength(input.text,'utf8') > 64*1024 || !/^[0-9a-f]{64}$/.test(input.fileHash) || !/^[0-9a-f]{64}$/.test(input.actorBinding)) throw previewError();
  const body=Buffer.from(JSON.stringify({businessId:input.businessId,fileHash:input.fileHash,actorBinding:input.actorBinding,text:input.text,expiresAt:input.now+previewLifetimeMs})).toString('base64url');
  const signature=createHmac('sha256',previewKey(secret)).update(body).digest('base64url');
  return `${body}.${signature}`;
}
export function verifyRecipePreview(token:string,input:PreviewContext,secret:string): string {
  if (typeof token !== 'string' || token.length>100_000 || !/^[0-9a-f]{64}$/.test(input.actorBinding)) throw previewError();
  const parts=token.split('.');
  if (parts.length!==2 || !/^[\w-]+$/.test(parts[0]!) || !/^[\w-]{43}$/.test(parts[1]!)) throw previewError();
  const expected=createHmac('sha256',previewKey(secret)).update(parts[0]!).digest();
  const actual=Buffer.from(parts[1]!,'base64url');
  if (actual.length!==expected.length || !timingSafeEqual(actual,expected)) throw previewError();
  let payload: unknown;
  try { payload=JSON.parse(Buffer.from(parts[0]!,'base64url').toString('utf8')); } catch { throw previewError(); }
  const item=payload as {businessId?:unknown;fileHash?:unknown;actorBinding?:unknown;text?:unknown;expiresAt?:unknown};
  if (!item || item.businessId!==input.businessId || item.fileHash!==input.fileHash || item.actorBinding!==input.actorBinding || typeof item.expiresAt!=='number' || !Number.isSafeInteger(item.expiresAt) || item.expiresAt<=input.now || item.expiresAt>input.now+previewLifetimeMs || typeof item.text!=='string' || !item.text.trim() || Buffer.byteLength(item.text,'utf8')>64*1024) throw previewError();
  return item.text;
}
