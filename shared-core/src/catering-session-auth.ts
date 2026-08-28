import { createHmac, timingSafeEqual } from "node:crypto";
import { isDevAuthEnabled, type MinimalMvpRole, type TrustedActor } from "./access-control.js";
import { assertBusinessId, type BusinessId } from "./business-context.js";
import type { CateringUserRecord } from "./catering-user-store.js";

export const CATERING_SESSION_COOKIE = "__Host-catering_session";
export const CATERING_SESSION_ISSUER = "catering-agents-platform";
export const CATERING_SESSION_AUDIENCE = "catering-backoffice";
export const CATERING_SESSION_LIFETIME = "12h";

const ROOT_SECRET_MIN_BYTES = 32;
const JWT_KEY_DOMAIN = "catering-auth-jwt-v1";
const BINDING_KEY_DOMAIN = "catering-auth-binding-v1";
const RATE_LIMIT_KEY_DOMAIN = "catering-auth-rate-limit-v1";
const SESSION_BINDING_DOMAIN = "catering-session-binding-v1\u0000";

export interface CateringSessionClaims {
  sub: string;
  sessionBinding: string;
  iat: number;
  exp: number;
  iss: typeof CATERING_SESSION_ISSUER;
  aud: typeof CATERING_SESSION_AUDIENCE;
  jti?: string;
}

export interface CateringAuthKeys {
  jwtKey: Buffer;
  bindingKey: Buffer;
  rateLimitKey: Buffer;
}

export interface CateringSessionBindingInput {
  userId: string;
  authEpoch: number;
}

function rootSecretBytes(rootSecret: string | Buffer): Buffer {
  const bytes = typeof rootSecret === "string"
    ? Buffer.from(rootSecret, "utf8")
    : Buffer.isBuffer(rootSecret)
      ? Buffer.from(rootSecret)
      : Buffer.alloc(0);
  if (bytes.length < ROOT_SECRET_MIN_BYTES) {
    throw new Error("CATERING_TRUSTED_ACTOR_SECRET muss mindestens 32 UTF-8-Bytes lang sein.");
  }
  return bytes;
}

function deriveKey(rootSecret: Buffer, domain: string): Buffer {
  return createHmac("sha256", rootSecret).update(domain, "utf8").digest();
}

function appendLengthPrefixed(hmac: ReturnType<typeof createHmac>, value: string): void {
  const bytes = Buffer.from(value, "utf8");
  hmac.update(String(bytes.length), "utf8");
  hmac.update(":", "utf8");
  hmac.update(bytes);
}

function isValidAuthEpoch(value: unknown): value is number {
  return Number.isSafeInteger(value) && (value as number) >= 0;
}

export function deriveCateringAuthKeys(rootSecret: string | Buffer): CateringAuthKeys {
  const root = rootSecretBytes(rootSecret);
  return {
    jwtKey: deriveKey(root, JWT_KEY_DOMAIN),
    bindingKey: deriveKey(root, BINDING_KEY_DOMAIN),
    rateLimitKey: deriveKey(root, RATE_LIMIT_KEY_DOMAIN)
  };
}

export function cateringSessionBinding(input: CateringSessionBindingInput, bindingKey: Buffer): string {
  if (
    !input
    || typeof input.userId !== "string"
    || input.userId.length === 0
    || !isValidAuthEpoch(input.authEpoch)
    || !Buffer.isBuffer(bindingKey)
    || bindingKey.length === 0
  ) {
    throw new Error("Ungültige Catering-Sitzungsbindung.");
  }

  const hmac = createHmac("sha256", bindingKey);
  hmac.update(SESSION_BINDING_DOMAIN, "utf8");
  appendLengthPrefixed(hmac, input.userId);
  appendLengthPrefixed(hmac, String(input.authEpoch));
  return hmac.digest("hex");
}

export function matchesCateringSessionBinding(
  actual: unknown,
  input: CateringSessionBindingInput,
  bindingKey: Buffer
): boolean {
  if (typeof actual !== "string" || !/^[a-f0-9]{64}$/.test(actual)) return false;

  const expected = cateringSessionBinding(input, bindingKey);
  return timingSafeEqual(Buffer.from(actual, "hex"), Buffer.from(expected, "hex"));
}

export function createCateringSessionActor(
  user: Pick<CateringUserRecord, "businessId" | "userId" | "role" | "active">
): TrustedActor & { source: "authenticated-session"; trusted: true; role: MinimalMvpRole } {
  if (!user.active) {
    throw new Error("Inaktive Catering-Benutzer dürfen keine Sitzung erhalten.");
  }
  return {
    name: user.userId,
    businessId: assertBusinessId(user.businessId) as BusinessId,
    source: "authenticated-session",
    trusted: true,
    role: user.role
  };
}

export function isCateringSessionMode(env: Record<string, string | undefined>): boolean {
  const hosted = env.CATERING_DEPLOYMENT_PROFILE?.trim().toLowerCase() === "hosted";
  // Nur die explizite Eins aktiviert den historischen Entwicklungsmodus; "true" bleibt absichtlich fail-closed.
  const explicitDevAuth = env.CATERING_DEV_AUTH?.trim() === "1" && isDevAuthEnabled(env);
  return hosted || !explicitDevAuth;
}
