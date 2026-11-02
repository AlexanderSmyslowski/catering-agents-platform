import { describe, expect, it } from "vitest";
import { extractTextFromDocument } from "../shared-core/src/document-text.js";

const extract = (content: Buffer) => extractTextFromDocument({
  filename: "recipe.pdf", mimeType: "application/pdf", content
});

function blankPdf(): Buffer {
  const objects = ["<< /Type /Catalog /Pages 2 0 R >>", "<< /Type /Pages /Kids [3 0 R] /Count 1 >>", "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << >> /Contents 4 0 R >>", "<< /Length 0 >>\nstream\n\nendstream"];
  let pdf = "%PDF-1.4\n";
  const offsets = objects.map((object, index) => {
    const offset = Buffer.byteLength(pdf);
    pdf += `${index + 1} 0 obj\n${object}\nendobj\n`;
    return offset;
  });
  const xref = Buffer.byteLength(pdf);
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (const offset of offsets) pdf += `${String(offset).padStart(10, "0")} 00000 n \n`;
  return Buffer.from(pdf + `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`);
}

describe("PDF document extraction", () => {
  it("extracts a valid text PDF including portions and quantities", async () => {
    const content = Buffer.from("JVBERi0xLjMKJZOMi54gUmVwb3J0TGFiIEdlbmVyYXRlZCBQREYgZG9jdW1lbnQgKG9wZW5zb3VyY2UpCjEgMCBvYmoKPDwKL0YxIDIgMCBSCj4+CmVuZG9iagoyIDAgb2JqCjw8Ci9CYXNlRm9udCAvSGVsdmV0aWNhIC9FbmNvZGluZyAvV2luQW5zaUVuY29kaW5nIC9OYW1lIC9GMSAvU3VidHlwZSAvVHlwZTEgL1R5cGUgL0ZvbnQKPj4KZW5kb2JqCjMgMCBvYmoKPDwKL0NvbnRlbnRzIDcgMCBSIC9NZWRpYUJveCBbIDAgMCA1OTUgODQyIF0gL1BhcmVudCA2IDAgUiAvUmVzb3VyY2VzIDw8Ci9Gb250IDEgMCBSIC9Qcm9jU2V0IFsgL1BERiAvVGV4dCAvSW1hZ2VCIC9JbWFnZUMgL0ltYWdlSSBdCj4+IC9Sb3RhdGUgMCAvVHJhbnMgPDwKCj4+IAogIC9UeXBlIC9QYWdlCj4+CmVuZG9iago0IDAgb2JqCjw8Ci9QYWdlTW9kZSAvVXNlTm9uZSAvUGFnZXMgNiAwIFIgL1R5cGUgL0NhdGFsb2cKPj4KZW5kb2JqCjUgMCBvYmoKPDwKL0F1dGhvciAoYW5vbnltb3VzKSAvQ3JlYXRpb25EYXRlIChEOjIwMjYxMTAxMTgwODQ4KzAxJzAwJykgL0NyZWF0b3IgKGFub255bW91cykgL0tleXdvcmRzICgpIC9Nb2REYXRlIChEOjIwMjYxMTAxMTgwODQ4KzAxJzAwJykgL1Byb2R1Y2VyIChSZXBvcnRMYWIgUERGIExpYnJhcnkgLSBcKG9wZW5zb3VyY2VcKSkgCiAgL1N1YmplY3QgKHVuc3BlY2lmaWVkKSAvVGl0bGUgKHVudGl0bGVkKSAvVHJhcHBlZCAvRmFsc2UKPj4KZW5kb2JqCjYgMCBvYmoKPDwKL0NvdW50IDEgL0tpZHMgWyAzIDAgUiBdIC9UeXBlIC9QYWdlcwo+PgplbmRvYmoKNyAwIG9iago8PAovTGVuZ3RoIDQzOAo+PgpzdHJlYW0KMSAwIDAgMSAwIDAgY20gIEJUIC9GMSAxMiBUZiAxNC40IFRMIEVUCkJUIC9GMSAxNCBUZiAxNi44IFRMIEVUCkJUIDEgMCAwIDEgNTUgNzgwIFRtIChTWU5USEVUSVNDSEVSIFJFWkVQVElNUE9SVFRFU1QpIFRqIFQqIEVUCkJUIDEgMCAwIDEgNTUgNzUyIFRtICg0IFBvcnRpb25lbikgVGogVCogRVQKQlQgMSAwIDAgMSA1NSA3MjQgVG0gKFp1dGF0ZW46KSBUaiBUKiBFVApCVCAxIDAgMCAxIDU1IDY5NiBUbSAoMjAwIGcgUmVpcykgVGogVCogRVQKQlQgMSAwIDAgMSA1NSA2NjggVG0gKDAsMDggZyBaaW10KSBUaiBUKiBFVApCVCAxIDAgMCAxIDU1IDY0MCBUbSAoWnViZXJlaXR1bmc6KSBUaiBUKiBFVApCVCAxIDAgMCAxIDU1IDYxMiBUbSAoMS4gUmVpcyBuYWNoIFBhY2t1bmdzYW53ZWlzdW5nIHp1YmVyZWl0ZW4gdW5kIFppbXQgenVnZWJlbi4pIFRqIFQqIEVUCiAKZW5kc3RyZWFtCmVuZG9iagp4cmVmCjAgOAowMDAwMDAwMDAwIDY1NTM1IGYgCjAwMDAwMDAwNjEgMDAwMDAgbiAKMDAwMDAwMDA5MiAwMDAwMCBuIAowMDAwMDAwMTk5IDAwMDAwIG4gCjAwMDAwMDAzOTIgMDAwMDAgbiAKMDAwMDAwMDQ2MCAwMDAwMCBuIAowMDAwMDAwNzIxIDAwMDAwIG4gCjAwMDAwMDA3ODAgMDAwMDAgbiAKdHJhaWxlcgo8PAovSUQgCls8NDdhNTVlYjcyMDFlYjBmMzQxZWI3MTNmMWEwODk1M2Y+PDQ3YTU1ZWI3MjAxZWIwZjM0MWViNzEzZjFhMDg5NTNmPl0KJSBSZXBvcnRMYWIgZ2VuZXJhdGVkIFBERiBkb2N1bWVudCAtLSBkaWdlc3QgKG9wZW5zb3VyY2UpCgovSW5mbyA1IDAgUgovUm9vdCA0IDAgUgovU2l6ZSA4Cj4+CnN0YXJ0eHJlZgoxMjY4CiUlRU9GCg==", "base64");
    const text = await extract(content);
    expect(text).toContain("4 Portionen");
    expect(text).toContain("200 g Reis");
    expect(text).toContain("0,08 g Zimt");
    expect(text).not.toContain("%PDF");
  });

  it("returns empty for an unreadable PDF instead of exposing raw bytes", async () => {
    expect(await extract(Buffer.from("%PDF-1.4\nThis is not extractable PDF content\n%%EOF"))).toBe("");
  });

  it("does not expose raw PDF bytes when the MIME type is uppercase", async () => {
    const text = await extractTextFromDocument({ filename: "recipe.pdf", mimeType: "APPLICATION/PDF", content: Buffer.from("%PDF-1.4\nThis is not extractable PDF content\n%%EOF") });
    expect(text).toBe("");
  });

  it("returns empty for a valid PDF without a text layer", async () => {
    expect(await extract(blankPdf())).toBe("");
  });

  it("preserves normal text document extraction", async () => {
    expect(await extractTextFromDocument({ filename: "recipe.txt", mimeType: "text/plain", content: Buffer.from("4 Portionen\n200 g Reis") })).toBe("4 Portionen\n200 g Reis");
  });
});
