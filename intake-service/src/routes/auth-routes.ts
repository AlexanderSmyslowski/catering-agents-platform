import type { FastifyInstance, FastifyRequest } from "fastify";
import {
  CATERING_SESSION_COOKIE,
  CateringLoginService,
  CateringUserStore,
  MINIMAL_MVP_CAPABILITIES,
  cateringSessionBinding,
  hasMinimalMvpCapability,
  type BusinessContext,
  type CateringAuthKeys,
  type CateringRequestAuth,
  type CateringSessionClaims,
  type TrustedActor
} from "@catering/shared-core";

interface LoginBody {
  loginCode?: unknown;
  pin?: unknown;
}

export interface RegisterCateringAuthRoutesInput {
  app: FastifyInstance;
  userStore: CateringUserStore;
  loginService: CateringLoginService;
  requestAuth: CateringRequestAuth;
  authKeys: CateringAuthKeys;
  businessContext: BusinessContext;
}

export interface RegisterCateringDevSessionRouteInput {
  app: FastifyInstance;
  actorForRequest: (request: FastifyRequest) => TrustedActor;
}

function sameOrigin(request: FastifyRequest): boolean {
  const origin = request.headers.origin;
  const host = request.headers.host;
  if (typeof origin !== "string" || typeof host !== "string" || host.trim().length === 0) return false;
  try {
    const parsed = new URL(origin);
    return parsed.protocol === "https:" && parsed.host.toLowerCase() === host.trim().toLowerCase();
  } catch {
    return false;
  }
}

function immediateSourceKey(request: FastifyRequest): string {
  // Raw socket address deliberately bypasses all forwarded-header parsing and is the sole login-rate-limit input.
  const remoteAddress = request.raw.socket.remoteAddress;
  return typeof remoteAddress === "string" && remoteAddress.length > 0 ? `socket:${remoteAddress}` : "";
}

function loginBody(body: unknown): LoginBody {
  if (!body || typeof body !== "object" || Array.isArray(body)) return {};
  const candidate = body as Record<string, unknown>;
  return {
    loginCode: candidate.loginCode,
    pin: candidate.pin
  };
}

function sessionResponse(user: { userId: string; displayName: string }, actor: TrustedActor) {
  return {
    authenticated: true,
    user: { userId: user.userId, displayName: user.displayName },
    access: {
      capabilities: MINIMAL_MVP_CAPABILITIES.filter((capability) => hasMinimalMvpCapability(actor, capability))
    }
  };
}

function cookieOptions() {
  return {
    httpOnly: true,
    secure: true,
    sameSite: "strict" as const,
    path: "/"
  };
}

/** Keep the explicit local proxy rehearsal usable without creating a second login path. */
export function registerCateringDevSessionRoute(input: RegisterCateringDevSessionRouteInput): void {
  input.app.get("/v1/auth/session", async (request, reply) => {
    const actor = input.actorForRequest(request);
    return reply.code(200).send(sessionResponse({
      userId: actor.name,
      displayName: actor.name
    }, actor));
  });
}

export function registerCateringAuthRoutes(input: RegisterCateringAuthRoutesInput): void {
  const { app } = input;

  app.post<{ Body: LoginBody }>("/v1/auth/login", async (request, reply) => {
    if (!sameOrigin(request)) return reply.code(403).send({ message: "Ungültige Anfrage." });

    const body = loginBody(request.body);
    const result = await input.loginService.authenticate({
      businessContext: input.businessContext,
      loginCode: typeof body.loginCode === "string" ? body.loginCode : "",
      pin: typeof body.pin === "string" ? body.pin : "",
      sourceKey: immediateSourceKey(request)
    });
    if (result.kind !== "success") {
      if (result.kind === "rate_limited") reply.header("retry-after", String(result.retryAfterSeconds));
      return reply.code(result.kind === "rate_limited" ? 429 : 401).send({ message: "Anmeldung nicht möglich." });
    }

    const claims: Omit<CateringSessionClaims, "iat" | "exp"> = {
      sub: result.user.userId,
      sessionBinding: cateringSessionBinding(
        { userId: result.user.userId, authEpoch: result.user.authEpoch },
        input.authKeys.bindingKey
      ),
      iss: "catering-agents-platform",
      aud: "catering-backoffice"
    };
    const token = app.jwt.sign(claims);
    const actor: TrustedActor = {
      name: result.user.userId,
      businessId: result.user.businessId,
      source: "authenticated-session",
      trusted: true,
      role: result.user.role
    };
    return reply
      .setCookie(CATERING_SESSION_COOKIE, token, cookieOptions())
      .code(200)
      .send(sessionResponse(result.user, actor));
  });

  app.get("/v1/auth/session", async (request, reply) => {
    const actor = input.requestAuth.actorForRequest(request);
    const user = await input.userStore.getById(input.businessContext, actor.name);
    if (!user || !user.active || user.role !== actor.role) {
      return reply.code(401).send({ message: "Ungültige Sitzung." });
    }
    return reply.code(200).send(sessionResponse(user, actor));
  });

  app.post("/v1/auth/logout", async (request, reply) => {
    input.requestAuth.actorForRequest(request);
    if (!sameOrigin(request)) return reply.code(403).send({ message: "Ungültige Anfrage." });
    return reply.clearCookie(CATERING_SESSION_COOKIE, cookieOptions()).code(204).send();
  });
}
