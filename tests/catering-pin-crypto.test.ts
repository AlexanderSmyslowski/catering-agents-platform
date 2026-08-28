import { describe, expect, it } from "vitest";
import {
  assertSixDigitPin,
  hashCateringPin,
  normalizeCateringLoginCode,
  verifyCateringPin
} from "../shared-core/src/catering-pin-crypto.js";

describe("Catering PIN crypto", () => {
  it("normalizes supported login codes and rejects non-canonical values", () => {
    expect(normalizeCateringLoginCode(" Admin.01 ")).toBe("admin.01");
    expect(normalizeCateringLoginCode("op_42-test")).toBe("op_42-test");
    expect(() => normalizeCateringLoginCode("a")).toThrow();
    expect(() => normalizeCateringLoginCode("admin name")).toThrow();
    expect(() => normalizeCateringLoginCode("äadmin")).toThrow();
  });

  it("rejects Unicode aliases before normalizing ASCII casing", () => {
    expect(normalizeCateringLoginCode("ADMIN")).toBe("admin");
    expect(() => normalizeCateringLoginCode("Kadmin")).toThrow("Anmeldecode ist ungültig.");
  });

  it("asserts exactly six ASCII digits", () => {
    expect(() => assertSixDigitPin("482731")).not.toThrow();
    expect(() => assertSixDigitPin("１２３４５６")).toThrow("PIN muss genau sechs Ziffern enthalten.");
  });

  it("hashes and verifies exactly six ASCII digits with the canonical scrypt format", async () => {
    const hash = await hashCateringPin("482731");

    expect(hash).toMatch(/^scrypt\$16384\$8\$1\$[0-9a-f]{32}\$[0-9a-f]{64}$/);
    await expect(verifyCateringPin("482731", hash)).resolves.toBe(true);
    await expect(verifyCateringPin("482732", hash)).resolves.toBe(false);
  });

  it.each(["12345", "1234567", "１２３４５６", "12a456"])(
    "rejects non-canonical PIN %s",
    async (pin) => expect(hashCateringPin(pin)).rejects.toThrow("PIN muss genau sechs Ziffern enthalten.")
  );

  it.each([
    "sha256$legacy",
    "scrypt$32768$8$1$00112233445566778899aabbccddeeff$" + "00".repeat(32),
    "scrypt$16384$8$1$broken$broken"
  ])("fails closed for unsupported stored hash %s", async (storedHash) => {
    await expect(verifyCateringPin("482731", storedHash)).resolves.toBe(false);
  });
});
