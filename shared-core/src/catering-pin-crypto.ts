import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from "node:crypto";

const SCRYPT_COST = 16_384;
const SCRYPT_BLOCK_SIZE = 8;
const SCRYPT_PARALLELIZATION = 1;
const SCRYPT_SALT_BYTES = 16;
const SCRYPT_KEY_BYTES = 32;
const SIX_ASCII_DIGITS = /^[0-9]{6}$/;
const ASCII_TEXT = /^[\x00-\x7F]*$/;
const CATERING_LOGIN_CODE = /^[a-z0-9][a-z0-9._-]{1,63}$/;
const CANONICAL_SCRYPT_HASH = /^scrypt\$16384\$8\$1\$([0-9a-f]{32})\$([0-9a-f]{64})$/;

function deriveCateringPin(pin: string, salt: Buffer): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scryptCallback(
      pin,
      salt,
      SCRYPT_KEY_BYTES,
      {
        N: SCRYPT_COST,
        r: SCRYPT_BLOCK_SIZE,
        p: SCRYPT_PARALLELIZATION
      },
      (error, derived) => {
        if (error) {
          reject(error);
          return;
        }
        resolve(derived);
      }
    );
  });
}

export function normalizeCateringLoginCode(loginCode: string): string {
  const trimmed = typeof loginCode === "string" ? loginCode.trim() : "";
  if (!ASCII_TEXT.test(trimmed)) {
    throw new Error("Anmeldecode ist ungültig.");
  }
  const canonical = trimmed.replace(/[A-Z]/g, (character) => character.toLowerCase());
  if (!CATERING_LOGIN_CODE.test(canonical)) {
    throw new Error("Anmeldecode ist ungültig.");
  }

  return canonical;
}

export function assertSixDigitPin(pin: string): void {
  if (typeof pin !== "string" || !SIX_ASCII_DIGITS.test(pin)) {
    throw new Error("PIN muss genau sechs Ziffern enthalten.");
  }
}

export async function hashCateringPin(pin: string): Promise<string> {
  assertSixDigitPin(pin);
  const salt = randomBytes(SCRYPT_SALT_BYTES);
  const derived = await deriveCateringPin(pin, salt);

  return `scrypt$${SCRYPT_COST}$${SCRYPT_BLOCK_SIZE}$${SCRYPT_PARALLELIZATION}$${salt.toString("hex")}$${derived.toString("hex")}`;
}

export async function verifyCateringPin(pin: string, storedHash: string): Promise<boolean> {
  if (typeof pin !== "string" || !SIX_ASCII_DIGITS.test(pin)) return false;
  const parsed = typeof storedHash === "string" ? CANONICAL_SCRYPT_HASH.exec(storedHash) : null;
  if (!parsed) return false;

  try {
    const expected = Buffer.from(parsed[2], "hex");
    const actual = await deriveCateringPin(pin, Buffer.from(parsed[1], "hex"));

    return actual.length === expected.length && timingSafeEqual(actual, expected);
  } catch {
    return false;
  }
}
