import { expect, it } from "vitest";
import { parseSupplierMessage } from "../offer-service/src/supplier-mail-message.js";
it("extracts bytes from the supplied message and rejects ambiguous senders", async () => {
  const raw = Buffer.from(
    'From: supplier@example.org\r\nSubject: Prices\r\nMIME-Version: 1.0\r\nContent-Type: multipart/mixed; boundary="abc"\r\n\r\n--abc\r\nContent-Type: application/octet-stream; name="p.xlsx"\r\nContent-Disposition: attachment; filename="p.xlsx"\r\nContent-Transfer-Encoding: base64\r\n\r\nYWJj\r\n--abc--\r\n',
  );
  const parsed = await parseSupplierMessage(raw);
  expect(parsed).toMatchObject({
    from: "supplier@example.org",
    subject: "Prices",
    attachments: [
      { part: "1", filename: "p.xlsx", content: Buffer.from("abc") },
    ],
  });
  await expect(
    parseSupplierMessage(
      Buffer.from("From: a@example.org, b@example.org\r\n\r\nx"),
    ),
  ).rejects.toThrow("Ambiguous");
});
