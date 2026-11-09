import { generateKeyPairSync } from "node:crypto";
import { dkimSign } from "mailauth/lib/dkim/sign";
import { expect, it } from "vitest";
import { verifyPriceMail } from "../offer-service/src/price-mail-auth.js";

it("binds the configured supplier, MIME interpretation and subject to the signed message", async () => {
  const keys = generateKeyPairSync("rsa", { modulusLength: 2048 });
  const publicDns = async () => [
    [
      "v=DKIM1; k=rsa; p=" +
        keys.publicKey
          .export({ format: "der", type: "spki" })
          .toString("base64"),
    ],
  ];
  const sender = "order@example.test";
  const body =
    "From: " +
    sender +
    "\r\nSubject: Daily list\r\nContent-Type: text/plain\r\n\r\n2.40\r\n";
  async function signed(headers: string) {
    const signature = await dkimSign(body, {
      headerList: headers,
      signatureData: [
        {
          signingDomain: "example.test",
          selector: "supplier",
          privateKey: keys.privateKey.export({ format: "pem", type: "pkcs8" }),
        },
      ],
    });
    expect(signature.errors).toHaveLength(0);
    return signature.signatures + body;
  }
  const original = await signed("From:Subject:Content-Type");
  expect(
    await verifyPriceMail(Buffer.from(original), sender, true, publicDns),
  ).toBe(true);
  for (const changed of [
    original.replace("2.40", "9.99"),
    "From: " + sender + "\r\n" + original,
    original.replace("text/plain", "text/html"),
    await signed("From:Content-Type"),
  ]) {
    expect(
      await verifyPriceMail(Buffer.from(changed), sender, true, publicDns),
    ).toBe(false);
  }
  expect(
    await verifyPriceMail(
      Buffer.from(original),
      "other@example.test",
      true,
      publicDns,
    ),
  ).toBe(false);
});
