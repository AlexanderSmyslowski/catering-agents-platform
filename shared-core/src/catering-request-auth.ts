import cookie from "@fastify/cookie";
import jwt from "@fastify/jwt";
import { createHash, timingSafeEqual } from "node:crypto";
import type { FastifyInstance, FastifyRequest } from "fastify";
import type { BusinessContext } from "./business-context.js";
import type { CateringUserStore } from "./catering-user-store.js";
import {
  CATERING_SESSION_AUDIENCE,
  CATERING_SESSION_COOKIE,
  CATERING_SESSION_ISSUER,
  CATERING_SESSION_LIFETIME,
  createCateringSessionActor,
  matchesCateringSessionBinding,
  type CateringAuthKeys,
  type CateringSessionClaims
} from "./catering-session-auth.js";
import type { TrustedActor } from "./access-control.js";

export interface CateringJwtRequest {
  jwtVerify<Claims extends object>(options: { onlyCookie: true }): Promise<Claims>;
}

export interface CateringRequestAuth {
  sessionMode: boolean;
  authenticateSession(request: CateringJwtRequest): Promise<TrustedActor>;
  attachActor(request: object, actor: TrustedActor): void;
  actorForRequest(request: object): TrustedActor;
}

export interface RegisterCateringRequestAuthInput {
  app: FastifyInstance;
  sessionMode: boolean;
  userStore: CateringUserStore;
  businessContext: BusinessContext;
  authKeys: CateringAuthKeys;
  isPublicRequest: (request: FastifyRequest) => boolean;
  isInternalServiceRequest?: (request: FastifyRequest) => boolean;
  internalServiceActorForRequest?: (request: FastifyRequest) => TrustedActor | undefined;
}

export type CateringServiceTarget = "intake-service" | "offer-service" | "production-service" | "print-export";

interface CateringInternalServiceRoute {
  targetService: CateringServiceTarget;
  actorName: "Offer-Service" | "Production-Service";
  method: "GET" | "PUT";
  pathTemplate: string;
}

export const CATERING_INTERNAL_SERVICE_ROUTES: readonly CateringInternalServiceRoute[] = [
  { targetService: "intake-service", actorName: "Offer-Service", method: "GET", pathTemplate: "/v1/intake/internal/requests/:requestId" },
  { targetService: "intake-service", actorName: "Offer-Service", method: "GET", pathTemplate: "/v1/intake/internal/source-documents/:documentId" },
  { targetService: "intake-service", actorName: "Production-Service", method: "GET", pathTemplate: "/v1/intake/internal/requests/:requestId" },
  { targetService: "intake-service", actorName: "Production-Service", method: "GET", pathTemplate: "/v1/intake/internal/specs/:specId" },
  { targetService: "intake-service", actorName: "Production-Service", method: "GET", pathTemplate: "/v1/intake/internal/source-documents/:documentId" },
  { targetService: "intake-service", actorName: "Production-Service", method: "GET", pathTemplate: "/v1/intake/internal/source-documents/:documentId/content" },
  { targetService: "intake-service", actorName: "Production-Service", method: "PUT", pathTemplate: "/v1/intake/internal/specs/:specId" },
  { targetService: "intake-service", actorName: "Production-Service", method: "PUT", pathTemplate: "/v1/intake/internal/specs/:specId/replacement" },
  { targetService: "offer-service", actorName: "Production-Service", method: "GET", pathTemplate: "/v1/offers/handoffs/:handoffId" }
] as const;

export type CateringRouteAuthClassification =
  | "public-health"
  | "public-auth"
  | "internal-service"
  | "protected-session"
  | "deny";

function singleHeaderValue(value: string | string[] | undefined): string | undefined {
  if (typeof value === "string") return value;
  return Array.isArray(value) && value.length === 1 ? value[0] : undefined;
}

function pathMatchesTemplate(pathname: string, template: string): boolean {
  const pathSegments = pathname.split("/").filter(Boolean);
  const templateSegments = template.split("/").filter(Boolean);
  return pathSegments.length === templateSegments.length
    && templateSegments.every((segment, index) => segment.startsWith(":") || segment === pathSegments[index]);
}

export function classifyCateringRouteAuth(input: {
  targetService: CateringServiceTarget;
  method: string;
  pathname: string;
}): CateringRouteAuthClassification {
  if (input.pathname === "/health" && (input.method === "GET" || input.method === "HEAD")) {
    return "public-health";
  }
  if (
    input.targetService === "intake-service"
    && input.method === "POST"
    && input.pathname === "/v1/auth/login"
  ) {
    return "public-auth";
  }
  if (CATERING_INTERNAL_SERVICE_ROUTES.some((route) =>
    route.targetService === "intake-service"
    && route.targetService === input.targetService
    && route.method === input.method
    && pathMatchesTemplate(input.pathname, route.pathTemplate)
  )) {
    return "internal-service";
  }
  // Every current and future product route remains session-protected until explicitly classified otherwise.
  if (input.pathname.startsWith("/v1/")) return "protected-session";
  return "deny";
}

function matchesTrustedSecret(actual: string | undefined, expected: string): boolean {
  if (!actual || !expected) return false;
  // Hashing both inputs first keeps the timing-safe comparison at a fixed length even for malformed values.
  const actualHash = createHash("sha256").update(actual, "utf8").digest();
  const expectedHash = createHash("sha256").update(expected, "utf8").digest();
  return timingSafeEqual(actualHash, expectedHash);
}

function requiresSameOrigin(method: string): boolean {
  return method !== "GET" && method !== "HEAD" && method !== "OPTIONS";
}

function hasMatchingHttpsOrigin(request: Pick<FastifyRequest, "headers">): boolean {
  const origin = singleHeaderValue(request.headers.origin);
  const host = singleHeaderValue(request.headers.host)?.trim();
  if (!origin || !host) return false;
  try {
    const parsed = new URL(origin);
    return parsed.protocol === "https:" && parsed.host.toLowerCase() === host.toLowerCase();
  } catch {
    return false;
  }
}

export function createCateringInternalServiceActorResolver(input: {
  targetService: CateringServiceTarget;
  trustedActorSecret: string;
  businessContext: BusinessContext;
}): (request: Pick<FastifyRequest, "method" | "url" | "headers">) => TrustedActor | undefined {
  return (request) => {
    const pathname = request.url.split("?", 1)[0] ?? "";
    const actorName = singleHeaderValue(request.headers["x-catering-actor-name"])?.trim();
    const suppliedSecret = singleHeaderValue(request.headers["x-catering-trusted-secret"])?.trim();
    const matchedRoute = CATERING_INTERNAL_SERVICE_ROUTES.find((route) =>
      route.targetService === input.targetService
      && route.method === request.method
      && route.actorName === actorName
      && pathMatchesTemplate(pathname, route.pathTemplate)
    );
    if (!matchedRoute || !matchesTrustedSecret(suppliedSecret, input.trustedActorSecret.trim())) return undefined;

    return {
      name: matchedRoute.actorName,
      businessId: input.businessContext.businessId,
      source: "service-default",
      trusted: true
    };
  };
}

function sessionError(): Error {
  return new Error("Ungültige Sitzung.");
}

function isSessionClaims(value: unknown): value is CateringSessionClaims {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const claims = value as Partial<CateringSessionClaims>;
  return (
    typeof claims.sub === "string"
    && claims.sub.length > 0
    && typeof claims.sessionBinding === "string"
    && typeof claims.iat === "number"
    && typeof claims.exp === "number"
    && claims.iss === CATERING_SESSION_ISSUER
    && claims.aud === CATERING_SESSION_AUDIENCE
    && (claims.jti === undefined || typeof claims.jti === "string")
  );
}

export function createCateringRequestAuth(input: {
  sessionMode: boolean;
  userStore: CateringUserStore;
  businessContext: BusinessContext;
  authKeys: CateringAuthKeys;
}): CateringRequestAuth {
  const actors = new WeakMap<object, TrustedActor>();

  return {
    sessionMode: input.sessionMode,
    async authenticateSession(request) {
      if (!input.sessionMode) throw sessionError();

      let claims: CateringSessionClaims;
      try {
        // onlyCookie forbids the @fastify/jwt Authorization fallback even when a Bearer value is present.
        claims = await request.jwtVerify<CateringSessionClaims>({ onlyCookie: true });
      } catch {
        throw sessionError();
      }
      if (!isSessionClaims(claims)) throw sessionError();

      try {
        const user = await input.userStore.getById(input.businessContext, claims.sub);
        if (
          !user
          || !user.active
          || !matchesCateringSessionBinding(
            claims.sessionBinding,
            { userId: user.userId, authEpoch: user.authEpoch },
            input.authKeys.bindingKey
          )
        ) {
          throw sessionError();
        }
        return createCateringSessionActor(user);
      } catch {
        throw sessionError();
      }
    },
    attachActor(request, actor) {
      actors.set(request, actor);
    },
    actorForRequest(request) {
      const actor = actors.get(request);
      if (!actor) throw sessionError();
      return actor;
    }
  };
}

export function registerCateringRequestAuth(input: RegisterCateringRequestAuthInput): CateringRequestAuth {
  const requestAuth = createCateringRequestAuth(input);
  if (!input.sessionMode) return requestAuth;

  // Cookie parsing must run before the JWT plugin and the session guard reads the parsed cookie only afterwards.
  input.app.register(cookie);
  input.app.register(jwt, {
    secret: input.authKeys.jwtKey,
    cookie: { cookieName: CATERING_SESSION_COOKIE, signed: false },
    sign: {
      expiresIn: CATERING_SESSION_LIFETIME,
      iss: CATERING_SESSION_ISSUER,
      aud: CATERING_SESSION_AUDIENCE
    },
    verify: {
      algorithms: ["HS256"],
      allowedIss: CATERING_SESSION_ISSUER,
      allowedAud: CATERING_SESSION_AUDIENCE,
      requiredClaims: ["sub", "sessionBinding", "iat", "exp", "iss", "aud"]
    }
  });
  input.app.addHook("onRequest", async (request, reply) => {
    if (input.isPublicRequest(request)) return;
    const internalActor = input.internalServiceActorForRequest?.(request);
    if (internalActor) {
      requestAuth.attachActor(request, internalActor);
      return;
    }
    if (input.isInternalServiceRequest?.(request)) {
      return reply.code(401).send({ message: "Ungültiger interner Dienstzugriff." });
    }
    try {
      const actor = await requestAuth.authenticateSession(request);
      if (requiresSameOrigin(request.method) && !hasMatchingHttpsOrigin(request)) {
        return reply.code(403).send({ message: "Same-Origin-Anfrage erforderlich." });
      }
      requestAuth.attachActor(request, actor);
    } catch {
      return reply.code(401).send({ message: "Ungültige Sitzung." });
    }
  });
  return requestAuth;
}
