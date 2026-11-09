import { expect, it } from "vitest";
import { createServer } from "node:net";
import { chmodSync, mkdtempSync, rmdirSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { zipSync, strToU8 } from "fflate";
import { scanAndExtractSupplierWorkbook } from "../offer-service/src/supplier-file-scan.js";
const xml = (s: string) => strToU8(s);
const workbook = () =>
  Buffer.from(
    zipSync({
      "[Content_Types].xml": xml(
        '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/></Types>',
      ),
      "_rels/.rels": xml(
        '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="r1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>',
      ),
      "xl/workbook.xml": xml(
        '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Prices" sheetId="1" r:id="r1"/></sheets></workbook>',
      ),
      "xl/_rels/workbook.xml.rels": xml(
        '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="r1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/></Relationships>',
      ),
      "xl/worksheets/sheet1.xml": xml(
        '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData/></worksheet>',
      ),
    }),
  );
it("requires fresh scanner, canary, archive and exact worksheet scans", async () => {
  const freshHome = mkdtempSync(join(homedir(), "supplier-home-"));
  const directory = mkdtempSync(join(freshHome, "supplier-scan-"));
  const path = join(directory, "clamd.sock"),
    scanned: Buffer[] = [];
  let badCanary = false;
  const version = `ClamAV 1.4.0/123/${new Date().toUTCString().replace(/^(\w+), (\d+) (\w+) (\d+) (\d+:\d+:\d+) GMT$/, "$1 $3 $2 $5 $4")}`;
  const server = createServer((socket) => {
    let data = Buffer.alloc(0);
    socket.on("data", (chunk) => {
      data = Buffer.concat([data, chunk]);
      if (data.subarray(0, 9).toString() === "zVERSION\0") {
        socket.write(version + "\0");
        return;
      }
      const prefix = Buffer.from("zINSTREAM\0");
      if (
        data.length < prefix.length ||
        !data.subarray(0, prefix.length).equals(prefix)
      )
        return;
      let off = prefix.length,
        parts: Buffer[] = [];
      while (data.length >= off + 4) {
        const n = data.readUInt32BE(off);
        off += 4;
        if (n === 0) {
          const content = Buffer.concat(parts);
          scanned.push(content);
          socket.write(
            (content.toString().includes("EICAR-STANDARD") && !badCanary
              ? "stream: Eicar FOUND"
              : "stream: OK") + "\0",
          );
          return;
        }
        if (data.length < off + n) return;
        parts.push(data.subarray(off, off + n));
        off += n;
      }
    });
  });
  await new Promise<void>((resolve) => server.listen(path, resolve));
  try {
    const original = workbook();
    const pending = scanAndExtractSupplierWorkbook(original, path);
    original.fill(0);
    const parts = await pending;
    expect(parts.sheet.toString()).toContain("worksheet");
    expect(scanned).toHaveLength(3);
    chmodSync(directory, 0o777);
    await expect(
      scanAndExtractSupplierWorkbook(workbook(), path),
    ).rejects.toThrow("Scanner path is not protected");
    chmodSync(directory, 0o700);
    badCanary = true;
    await expect(
      scanAndExtractSupplierWorkbook(workbook(), path),
    ).rejects.toThrow("canary");
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    rmdirSync(directory);
    rmdirSync(freshHome);
  }
});
