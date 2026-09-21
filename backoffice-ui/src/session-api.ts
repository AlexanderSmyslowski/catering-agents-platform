import {
  MINIMAL_MVP_CAPABILITIES,
  type MinimalMvpCapability
} from "../../shared-core/src/access-control.js";

export type CateringSession = {
  authenticated: true;
  user: {
    userId: string;
    displayName: string;
  };
  access: {
    capabilities: MinimalMvpCapability[];
  };
};

export type CateringSessionResolution =
  | { kind: "authenticated"; session: CateringSession }
  | { kind: "unauthenticated" }
  | { kind: "unavailable" };

const SESSION_ENDPOINT = "/api/intake/v1/auth/session";
const LOGIN_ENDPOINT = "/api/intake/v1/auth/login";
const LOGOUT_ENDPOINT = "/api/intake/v1/auth/logout";
const ALLOWED_CAPABILITIES = new Set<string>(MINIMAL_MVP_CAPABILITIES);

// `undefined` keeps direct helpers usable before a SessionBoundary has ever
// managed them. `null` records an explicit deactivation and stays fail-closed
// until a newly authenticated session activates a fresh controller.
let authenticatedRequestController: AbortController | null | undefined;
const sessionInvalidationListeners = new Set<() => void>();

function sessionEndedError(): Error {
  return new Error("Die Sitzung wurde beendet.");
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasExactKeys(value: Record<string, unknown>, expected: string[]): boolean {
  const actual = Object.keys(value).sort();
  return actual.length === expected.length && actual.every((key, index) => key === [...expected].sort()[index]);
}

function parseSession(payload: unknown): CateringSession | undefined {
  if (!isRecord(payload) || !hasExactKeys(payload, ["authenticated", "user", "access"])) return undefined;
  if (payload.authenticated !== true || !isRecord(payload.user) || !isRecord(payload.access)) return undefined;
  if (!hasExactKeys(payload.user, ["userId", "displayName"]) || !hasExactKeys(payload.access, ["capabilities"])) {
    return undefined;
  }

  const userId = typeof payload.user.userId === "string" ? payload.user.userId.trim() : "";
  const displayName = typeof payload.user.displayName === "string" ? payload.user.displayName.trim() : "";
  const capabilities = payload.access.capabilities;
  if (
    !userId ||
    !displayName ||
    !Array.isArray(capabilities) ||
    capabilities.some((capability) => typeof capability !== "string" || !ALLOWED_CAPABILITIES.has(capability)) ||
    new Set(capabilities).size !== capabilities.length
  ) {
    return undefined;
  }

  const validatedCapabilities = capabilities as MinimalMvpCapability[];
  return {
    authenticated: true,
    user: { userId, displayName },
    access: { capabilities: [...validatedCapabilities] }
  };
}

function isBrowserIdentityHeader(name: string): boolean {
  const normalized = name.toLowerCase();
  return normalized === "authorization" ||
    normalized === "proxy-authorization" ||
    normalized === "x-actor-name" ||
    normalized.startsWith("x-catering-") ||
    /(?:^|[-_])(?:actor|subject|role|business|identity|principal|trusted|user-id|userid)(?:$|[-_])/u.test(normalized);
}

function sanitizedHeaders(headersInit?: HeadersInit, includeJsonContentType = false): Headers {
  const headers = new Headers(headersInit);
  const forbiddenNames = [...headers.keys()].filter(isBrowserIdentityHeader);
  for (const name of forbiddenNames) headers.delete(name);
  if (includeJsonContentType && !headers.has("content-type")) {
    headers.set("content-type", "application/json");
  }
  return headers;
}

export function buildCateringBrowserRequestInit(
  init: RequestInit = {},
  options: { includeJsonContentType?: boolean; sessionBound?: boolean } = {}
): RequestInit {
  const requestInit: RequestInit = {
    ...init,
    credentials: "same-origin",
    headers: sanitizedHeaders(init.headers, options.includeJsonContentType)
  };
  if (options.sessionBound && authenticatedRequestController === null) {
    throw sessionEndedError();
  }
  if (options.sessionBound && authenticatedRequestController) {
    requestInit.signal = authenticatedRequestController.signal;
  }
  return requestInit;
}

/** Start a fresh cancellation scope only after the server has resolved a valid session. */
export function activateCateringSessionRequests(): void {
  authenticatedRequestController?.abort();
  authenticatedRequestController = new AbortController();
}

/** Abort in-flight Fachrequests before the authenticated UI is removed on logout. */
export function deactivateCateringSessionRequests(): void {
  authenticatedRequestController?.abort();
  authenticatedRequestController = null;
}

/** Let the boundary discard authenticated UI when a Fachservice rejects the current session. */
export function subscribeCateringSessionInvalidation(listener: () => void): () => void {
  sessionInvalidationListeners.add(listener);
  return () => sessionInvalidationListeners.delete(listener);
}

/** Fail closed on an expired Fachrequest without letting an old aborted request invalidate a newer session. */
export function assertCateringSessionBoundResponse(
  response: Response,
  signal?: AbortSignal | null
): void {
  if (signal?.aborted) throw sessionEndedError();
  if (response.status !== 401) return;

  deactivateCateringSessionRequests();
  for (const listener of [...sessionInvalidationListeners]) listener();
  throw sessionEndedError();
}

export async function resolveCateringSession(): Promise<CateringSessionResolution> {
  try {
    const response = await fetch(SESSION_ENDPOINT, buildCateringBrowserRequestInit());
    if (response.status === 401) return { kind: "unauthenticated" };
    if (!response.ok) return { kind: "unavailable" };
    const session = parseSession(await response.json());
    return session ? { kind: "authenticated", session } : { kind: "unavailable" };
  } catch {
    return { kind: "unavailable" };
  }
}

export async function loginToCatering(input: { loginCode: string; pin: string }): Promise<void> {
  const response = await fetch(LOGIN_ENDPOINT, buildCateringBrowserRequestInit({
    method: "POST",
    body: JSON.stringify({ loginCode: input.loginCode, pin: input.pin })
  }, { includeJsonContentType: true }));
  if (!response.ok) throw new Error("Anmeldung nicht möglich.");
  // The login payload is deliberately ignored; GET /auth/session is the sole browser authority.
}

export async function logoutFromCatering(): Promise<void> {
  const response = await fetch(LOGOUT_ENDPOINT, buildCateringBrowserRequestInit({ method: "POST" }));
  if (!response.ok) throw new Error("Abmeldung nicht möglich.");
}
