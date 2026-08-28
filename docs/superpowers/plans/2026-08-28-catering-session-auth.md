# Catering Session Authentication Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace path- and header-selected human actors with a concrete Catering user session while preserving the existing Gate-B capability and confidentiality contracts.

**Architecture:** Store single-tenant Catering users in the existing business-scoped persistence, authenticate a unique login code plus six-digit scrypt PIN through Intake, and issue a twelve-hour JWT only in a secure HttpOnly cookie. Every service verifies the cookie, reloads the current user and role, checks `active` plus `authEpoch`, and passes the resulting session actor into the unchanged capability matrix. Only explicit local development and narrowly allowlisted internal service principals retain legacy header handling.

**Tech Stack:** TypeScript, Fastify 5, `@fastify/cookie`, `@fastify/jwt`, Node crypto/scrypt/HMAC, existing file/Postgres persistence, React 19, Vitest.

**Spec:** `docs/superpowers/specs/2026-08-28-catering-session-auth-design.md`

## Global Constraints

- Implementation MUST NOT start until the ProductionFeedback visibility P1 in specification section 11 is explicitly approved.
- `userId` is the immutable visitor subject; URL, path, actor header, role header and business header never choose a human actor in session mode.
- Session mode is `deploymentProfile === "hosted" || !isDevAuthEnabled(env)`; Hosted always wins over the dev flag.
- Missing, invalid or stale session in session mode returns HTTP 401 without any trusted-header fallback.
- Browser JWT verification uses `request.jwtVerify({ onlyCookie: true })`; Authorization Bearer is never a browser-session fallback.
- Current `active`, `authEpoch` and `role` are loaded from the User Store for every protected human request.
- `MINIMAL_MVP_ROLE_CAPABILITIES` remains the only capability matrix and its entries remain unchanged.
- The configured single THE-ONE business is server-authoritative; login accepts no `businessId`.
- PIN hashing uses only scrypt N=16384, r=8, p=1, 16-byte salt and 32-byte output; no legacy hash fallback.
- Twelve failures in 15 minutes lock an account for ten minutes; the source budget is 60 failures in 15 minutes.
- Cookie is exactly `__Host-catering_session; HttpOnly; Secure; SameSite=Strict; Path=/` without Domain.
- JWT lifetime is twelve hours without refresh; JWT contains no role, login code, display name, PIN or business context.
- PR #677 and `faf17e8a1def016b4263a7288a81161e14288145` remain the untouched baseline; no work is added to that branch.
- No Caddy, proxy, Docker, Shared Edge, server-isolation, Phase-3, deployment, release or tag changes.
- No public user-management API, external IdP, central cross-product auth service, multi-tenant expansion or UI redesign.
- This Fachturn does not commit, push or open a PR. Git finalization is a separate supervisor-approved turn after exact-candidate review.

## File Structure

### New shared-core units

- `shared-core/src/catering-pin-crypto.ts`: login normalization, six-digit PIN validation and fixed-format scrypt hashing.
- `shared-core/src/catering-user-store.ts`: strict user-record validation, business-scoped persistence, uniqueness, CAS lockout and security-state changes.
- `shared-core/src/catering-login-service.ts`: generic login result, account lockout, bounded source rate limiting and dummy-hash parity.
- `shared-core/src/catering-session-auth.ts`: key derivation, claims, session binding, actor creation and cookie/JWT constants.
- `shared-core/src/catering-request-auth.ts`: request-local actor cache, cookie-only session verification and explicit service-principal allowlists.

### New Intake and UI units

- `intake-service/src/routes/auth-routes.ts`: login, session and logout endpoints.
- `backoffice-ui/src/session-api.ts`: same-origin login/session/logout API without actor headers or token storage.
- `backoffice-ui/src/session-boundary.tsx`: fail-closed startup boundary.
- `backoffice-ui/src/login-view.tsx`: minimal identifier/PIN form and generic error state.
- `scripts/manage-catering-user.ts`: non-network provisioning and security-state updates with PIN from protected stdin/TTY only.

### Existing integration units

- `shared-core/src/access-control.ts`, `shared-core/src/index.ts`
- `intake-service/src/app.ts`, `offer-service/src/app.ts`
- `production-service/src/app.ts`, `print-export/src/index.ts`
- existing internal HTTP gateways and their receiving route guards
- `production-service/src/repositories/production-store.ts`
- `production-service/src/routes/artifact-routes.ts`
- `backoffice-ui/src/api.ts`, `backoffice-ui/src/production-quantity-api.ts`
- `backoffice-ui/src/App.tsx`, `backoffice-ui/src/route-masthead.tsx`

---

### Task 1: Persisted User Store and fixed-format PIN crypto

**Files:**
- Create: `shared-core/src/catering-pin-crypto.ts`
- Create: `shared-core/src/catering-user-store.ts`
- Modify: `shared-core/src/index.ts`
- Test: `tests/catering-pin-crypto.test.ts`
- Test: `tests/catering-user-store.test.ts`

**Interfaces:**
- Produces `normalizeCateringLoginCode`, `assertSixDigitPin`, `hashCateringPin`, `verifyCateringPin`, `CateringUserStore`, `CateringUserRecord` and `createCateringUserRecord`.
- `CateringUserStore` consumes existing `CollectionStorageOptions`, `BusinessContext`, `createBusinessScopedPersistentCollection` and `withBusinessTargetCriticalSection`.
- Later tasks consume this exact store surface:

```ts
type CateringUserLookup =
  | { kind: "missing" }
  | { kind: "unique"; user: CateringUserRecord }
  | { kind: "ambiguous" };

type CateringUserMutation =
  | { kind: "updated"; user: CateringUserRecord }
  | { kind: "conflict" }
  | { kind: "missing" };

class CateringUserStore {
  constructor(options?: CollectionStorageOptions);
  create(context: BusinessContext, user: CateringUserRecord): Promise<"created" | "duplicate_login_code" | "duplicate_user_id">;
  getById(context: BusinessContext, userId: string): Promise<CateringUserRecord | undefined>;
  findByLoginCode(context: BusinessContext, loginCode: string): Promise<CateringUserLookup>;
  replaceExact(context: BusinessContext, expected: CateringUserRecord, replacement: CateringUserRecord): Promise<CateringUserMutation>;
  updateSecurity(context: BusinessContext, expected: CateringUserRecord, change: {
    pinHash?: string;
    role?: MinimalMvpRole;
    active?: boolean;
  }, now: Date): Promise<CateringUserMutation>;
}
```

- [ ] **Step 1: Write the PIN RED tests**

```ts
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
```

- [ ] **Step 2: Run the PIN test and verify RED**

Run: `npx vitest run tests/catering-pin-crypto.test.ts --maxWorkers=1`

Expected: module/export not found before any production implementation exists.

- [ ] **Step 3: Implement the minimal PIN module**

Use Node `randomBytes`, async `scrypt` and `timingSafeEqual`. Parse only the
literal canonical prefix and exact hex lengths. Never pass parsed cost values
into `scrypt`; use compile-time constants. Login codes are trimmed, converted
to ASCII lowercase and accepted only when they match
`^[a-z0-9][a-z0-9._-]{1,63}$`.

- [ ] **Step 4: Run the PIN test and verify GREEN**

Run: `npx vitest run tests/catering-pin-crypto.test.ts --maxWorkers=1`

Expected: all PIN tests pass with no warning or secret output.

- [ ] **Step 5: Write the User Store RED tests**

```ts
it("keeps userId as immutable subject and rejects a duplicate canonical login code", async () => {
  const first = await store.create(context, createCateringUserRecord({
    businessId: "the-one", userId: "user-admin", loginCode: " Admin ",
    displayName: "Admin Test", pinHash, role: "admin", active: true, now
  }));
  const duplicate = await store.create(context, createCateringUserRecord({
    businessId: "the-one", userId: "user-other", loginCode: "admin",
    displayName: "Other", pinHash, role: "read_only_operator", active: true, now
  }));
  expect(first).toBe("created");
  expect(duplicate).toBe("duplicate_login_code");
  expect((await store.findByLoginCode(context, "ADMIN"))).toMatchObject({
    kind: "unique", user: { userId: "user-admin", role: "admin" }
  });
});

it("increments authEpoch once for role, PIN or active changes but not login failures", async () => {
  const before = await requiredUser(store, context, "user-production");
  const failed = await store.replaceExact(context, before, {
    ...before,
    failedLoginCount: before.failedLoginCount + 1,
    version: before.version + 1,
    updatedAt: now.toISOString()
  });
  expect(failed).toMatchObject({ kind: "updated", user: { authEpoch: before.authEpoch } });
  if (failed.kind !== "updated") throw new Error("expected login-state update");
  const changed = await store.updateSecurity(context, failed.user, {
    role: "read_only_operator"
  }, later);
  expect(changed).toMatchObject({ kind: "updated", user: { authEpoch: before.authEpoch + 1 } });
});
```

Also prove business-scope rejection, parallel duplicate creation with exactly
one winner, exact-CAS conflict, invalid stored records and userId lookup.

- [ ] **Step 6: Run the User Store test and verify RED**

Run: `npx vitest run tests/catering-user-store.test.ts --maxWorkers=1`

Expected: missing User Store exports.

- [ ] **Step 7: Implement the minimal User Store**

Use collection `auth/users`, `getId: user => user.userId`, strict validation and
an existing business-target critical section keyed by a SHA-256 login-code
identifier for uniqueness. Recreate the collection with the transactional
queryable inside PostgreSQL critical sections. All updates use
`compareAndSetExact`; no blind `set` is permitted after creation.
For this collection only, create or harden the File-backend leaf directory with
mode `0700` and every temporary, published or replacement record with mode
`0600`, independent of a permissive process umask. Do not change modes for
other collections or the PostgreSQL path.

- [ ] **Step 8: Run Task 1 tests and focused persistence regressions**

Run:

```bash
npx vitest run \
  tests/catering-pin-crypto.test.ts \
  tests/catering-user-store.test.ts \
  tests/stage-a-business-isolation.test.ts \
  tests/unscoped-persistence-import-boundary.test.ts \
  --maxWorkers=1
```

Expected: all selected tests pass.

- [ ] **Step 9: Record the Task 1 checkpoint without Git mutation**

Record RED command/output, GREEN command/output and `git diff --check`; do not
commit, push or modify PR #677.

---

### Task 2: Login service, persisted account lockout and source limiter

**Files:**
- Create: `shared-core/src/catering-login-service.ts`
- Modify: `shared-core/src/index.ts`
- Test: `tests/catering-login-lockout.test.ts`

**Interfaces:**
- Consumes `CateringUserStore`, `verifyCateringPin`, a clock and a bounded source key.
- Produces `CateringLoginService.authenticate({ businessContext, loginCode, pin, sourceKey })` with `success`, `invalid` or `rate_limited` results.
- A success result contains only the current exact `CateringUserRecord`; it does not create a token.

```ts
type CateringLoginResult =
  | { kind: "success"; user: CateringUserRecord }
  | { kind: "invalid" }
  | { kind: "rate_limited"; retryAfterSeconds: number };

interface CateringLoginAttempt {
  businessContext: BusinessContext;
  loginCode: string;
  pin: string;
  sourceKey: string;
}

class CateringLoginService {
  constructor(input: {
    userStore: CateringUserStore;
    rateLimitSecret: Buffer;
    now?: () => Date;
  });
  authenticate(input: CateringLoginAttempt): Promise<CateringLoginResult>;
}
```

- [ ] **Step 1: Write the RED tests for generic failures and lockout**

```ts
it("locks the account on the twelfth failure inside fifteen minutes", async () => {
  for (let attempt = 1; attempt <= 12; attempt += 1) {
    await expect(login.authenticate(input("000000"))).resolves.toMatchObject({ kind: "invalid" });
  }
  const stored = await requiredUser(store, context, userId);
  expect(stored.lockedUntil).toBe("2026-08-28T10:10:00.000Z");
  await expect(login.authenticate(input(validPin))).resolves.toMatchObject({ kind: "invalid" });
});

it("returns the same external result for unknown, inactive, locked and wrong-PIN users", async () => {
  const results = await Promise.all([
    login.authenticate(inputFor("missing", "111111")),
    login.authenticate(inputFor("inactive", "111111")),
    login.authenticate(inputFor("locked", validPin)),
    login.authenticate(inputFor("known", "111111"))
  ]);
  expect(results).toEqual(results.map(() => ({ kind: "invalid" })));
});
```

Also assert dummy-scrypt execution for unknown users and malformed PINs,
including a known account whose real PIN is `000000`, failure-window reset,
bounded limiter eviction, `429`/Retry-After metadata for source exhaustion and
fail-closed behavior on a CAS race after a correct PIN. Prove that attempts
against many different login codes from the same server-derived source exhaust
one shared source bucket, while a different trusted source does not consume
that bucket. Untrusted forwarding headers must not change the source key, and
an unknown source must use the single strict fallback bucket.

- [ ] **Step 2: Run the lockout test and verify RED**

Run: `npx vitest run tests/catering-login-lockout.test.ts --maxWorkers=1`

Expected: missing login-service export.

- [ ] **Step 3: Implement the minimal login service**

Keep account counters persistent and source counters bounded in memory. HMAC
only the normalized, server-derived `sourceKey` before using it as the
in-memory source-limiter key. Login code and account identity must not enter
this key. Do not consume `X-Forwarded-For`; callers supply either a trusted
immediate-source key or the single strict fallback bucket. Reject an already
exhausted source before lookup and KDF. Admit at most four concurrent KDF checks
per process and release every reservation in `finally`; overload is a generic,
short rate-limit response. Every admitted attempt performs exactly one scrypt
check: use the stored canonical hash only for a formally valid six-digit PIN and
a uniquely resolved valid record. A malformed PIN always uses the dummy hash and
can never authenticate; evaluate active/locked status after that work.

- [ ] **Step 4: Run Task 2 tests and Task 1 regression**

Run:

```bash
npx vitest run \
  tests/catering-login-lockout.test.ts \
  tests/catering-pin-crypto.test.ts \
  tests/catering-user-store.test.ts \
  --maxWorkers=1
```

Expected: all tests pass.

- [ ] **Step 5: Record the Task 2 checkpoint without Git mutation**

Record the RED/GREEN evidence and `git diff --check` only.

---

### Task 3: Cookie-only JWT, authEpoch verification and Intake auth routes

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`
- Create: `shared-core/src/catering-session-auth.ts`
- Create: `shared-core/src/catering-request-auth.ts`
- Modify: `shared-core/src/access-control.ts`
- Modify: `shared-core/src/approval-request.ts`
- Modify: `shared-core/src/approval-request-identity.ts`
- Modify: `shared-core/src/schemas/approval-request.ts`
- Modify: `shared-core/src/index.ts`
- Create: `intake-service/src/routes/auth-routes.ts`
- Modify: `intake-service/src/app.ts`
- Test: `tests/catering-session-auth.test.ts`
- Test: `tests/approval-request-contract.test.ts`

**Interfaces:**
- Produces `CATERING_SESSION_COOKIE`, `deriveCateringAuthKeys`, `cateringSessionBinding`, `createCateringSessionActor`, `isCateringSessionMode` and request-local session verification.
- Adds `authenticated-session` as a trusted human source and an optional server-only `role` to `TrustedActor`.
- Intake exposes `/v1/auth/login`, `/v1/auth/session`, `/v1/auth/logout`.

```ts
interface CateringSessionClaims {
  sub: string;
  sessionBinding: string;
  iat: number;
  exp: number;
  iss: "catering-agents-platform";
  aud: "catering-backoffice";
  jti?: string;
}

interface CateringRequestAuth {
  sessionMode: boolean;
  authenticateSession(request: CateringJwtRequest): Promise<TrustedActor>;
  attachActor(request: object, actor: TrustedActor): void;
  actorForRequest(request: object): TrustedActor;
}
```

- [ ] **Step 1: Write the cookie/JWT RED tests before adding dependencies**

```ts
it("sets only the secure host cookie and never returns a token", async () => {
  const response = await app.inject({
    method: "POST", url: "/v1/auth/login", headers: sameOriginHeaders,
    payload: { loginCode: "admin", pin: "482731" }
  });
  expect(response.statusCode).toBe(200);
  expect(response.headers["set-cookie"]).toContain("__Host-catering_session=");
  expect(response.headers["set-cookie"]).toContain("HttpOnly");
  expect(response.headers["set-cookie"]).toContain("Secure");
  expect(response.headers["set-cookie"]).toContain("SameSite=Strict");
  expect(response.json()).not.toHaveProperty("token");
});

it("rejects a valid JWT in Authorization when the session cookie is absent", async () => {
  const response = await app.inject({
    method: "GET", url: "/v1/auth/session",
    headers: { authorization: `Bearer ${validToken}` }
  });
  expect(response.statusCode).toBe(401);
});
```

Also prove wrong issuer/audience, expired token, invalid binding, missing subject,
inactive user, changed role, changed PIN, changed `authEpoch`, reactivation not
reviving an old cookie, generic login errors and logout cookie clearing.

- [ ] **Step 2: Run the session test and verify RED**

Run: `npx vitest run tests/catering-session-auth.test.ts --maxWorkers=1`

Expected: auth routes and session exports do not exist.

- [ ] **Step 3: Add the minimal reviewed Fastify dependencies**

Run: `npm install @fastify/cookie@^11.1.2 @fastify/jwt@^10.2.2`

Verify the resolved versions support Fastify 5. Do not add any other package.

- [ ] **Step 4: Implement key derivation, claims and cookie-only verifier**

Use domain labels `catering-auth-jwt-v1`, `catering-auth-binding-v1` and
`catering-auth-rate-limit-v1`. Require a root secret of at least 32 UTF-8 bytes.
Configure issuer `catering-agents-platform`, audience `catering-backoffice` and
expiry `12h`. Register `@fastify/cookie` first and `@fastify/jwt` second with
the explicit cookie configuration
`cookie: { cookieName: CATERING_SESSION_COOKIE, signed: false }`; only after
both plugins are ready may the Session-`onRequest`-Guard be registered. Every
verification calls:

```ts
await request.jwtVerify<CateringSessionClaims>({ onlyCookie: true });
```

Load the User Store after JWT verification, recompute `sessionBinding` from the
current `authEpoch`, check `active`, then create the session actor. Never read a
role from JWT claims or request headers.

The cross-service regression must prove that the exact cookie issued by Intake
is accepted by Offer, Production and Print/Export. Missing or invalid cookies
and a valid Bearer token without that cookie remain HTTP 401 in every service.

- [ ] **Step 5: Implement Intake login/session/logout**

`POST /v1/auth/login` requires matching Origin/Host, invokes the Login Service,
signs claims and sets the cookie. `GET /v1/auth/session` returns only:

```ts
{
  authenticated: true,
  user: { userId, displayName },
  access: { capabilities: MinimalMvpCapability[] }
}
```

`POST /v1/auth/logout` requires a valid cookie plus matching Origin/Host and
clears the cookie. No endpoint returns pinHash, login code, role authority or
JWT.

- [ ] **Step 6: Accept authenticated-session for human approvals only**

`resolveMinimalMvpRoleFromTrustedActor` reads `actor.role` only when source is
`authenticated-session`. `assertTrustedFinalApprovalActor` accepts the session
source with a valid explicit role, while existing dev, service and untrusted
sources remain rejected. `createApprovalRequestRecord` requires its supplied
role to equal the current session actor role, and the schema/semantic validator
accepts the persisted session source. A caller cannot bind a session user to a
different approval role. Do not change `MINIMAL_MVP_ROLE_CAPABILITIES`.

- [ ] **Step 7: Run Task 3 tests and approval regressions**

Run:

```bash
npx vitest run \
  tests/catering-session-auth.test.ts \
  tests/access-control.test.ts \
  tests/approval-request-contract.test.ts \
  tests/offer-approval-request.test.ts \
  tests/approved-production-spec.test.ts \
  --maxWorkers=1
```

Expected: all tests pass; Authorization-only remains 401.

- [ ] **Step 8: Record the Task 3 checkpoint without Git mutation**

Record dependency delta, RED/GREEN evidence and `git diff --check`.

---

### Task 4: Public route session boundary and narrow internal service principals

**Files:**
- Modify: `intake-service/src/app.ts`
- Modify: `offer-service/src/app.ts`
- Modify: `production-service/src/app.ts`
- Modify: `print-export/src/index.ts`
- Modify: `intake-service/src/routes/work-item-routes.ts`
- Modify: `intake-service/src/routes/source-document-routes.ts`
- Modify: `offer-service/src/gateways/http-source-document-metadata-reader.ts`
- Modify: `production-service/src/gateways/http-intake-records-port.ts`
- Modify: `production-service/src/gateways/http-source-document-reader.ts`
- Modify: `production-service/src/gateways/http-production-handoff-reader.ts`
- Test: `tests/hosted-session-actor-boundary.test.ts`
- Test: `tests/internal-service-principal-auth.test.ts`
- Test: `tests/catering-auth-route-classification.test.ts`
- Modify: `tests/task-1-hosted-actor-boundary.test.ts`
- Modify: `tests/hosted-secret-startup.test.ts`
- Modify: `tests/stage-a-business-isolation.test.ts`

**Interfaces:**
- Each app registers, in order, cookie support, JWT support bound to
  `CATERING_SESSION_COOKIE`, the Session-`onRequest`-Guard and a request-local
  actor cache.
- Existing synchronous `actorForRequest(request)` call sites read only the actor cached by the app-level `onRequest` boundary.
- Public product routes require a session in session mode; explicit local dev retains the old resolver.
- Internal principals are accepted only for exact method/path/service triples.

- [ ] **Step 1: Write one RED matrix test across all four apps**

For each app, send a protected request with no cookie and all historical Caddy
headers, including the correct trusted secret. Assert HTTP 401 before the first
store read/write. Repeat with a valid Authorization Bearer token but no cookie.

Then use a Production cookie plus forged Administrator headers on Offer and
commercial export paths. Assert the session role remains Production and the
response is 403 or server-redacted according to the existing Gate-B contract.
Use the cookie obtained from the real Intake login unchanged in Offer,
Production and Print/Export to prove the shared registration contract.

- [ ] **Step 2: Run the boundary test and verify RED**

Run: `npx vitest run tests/hosted-session-actor-boundary.test.ts --maxWorkers=1`

Expected: current Caddy headers still select actors, so the no-cookie cases do
not satisfy the new 401 contract.

- [ ] **Step 3: Implement session-first app boundaries**

For every app:

1. `/health` is public;
2. Intake auth routes follow Task 3 rules;
3. in explicit dev mode, use the existing resolver;
4. in session mode, first test only the service-specific internal allowlist;
5. otherwise require the cookie-only session actor;
6. store the chosen actor once per request;
7. all route capability checks consume that cached actor.

Never catch a session error and call `createTrustedActorResolver` afterward.

- [ ] **Step 4: Write and run internal-principal RED tests**

Prove these exact contracts:

```text
Offer-Service -> GET /v1/intake/internal/requests/:requestId
Offer-Service -> GET /v1/intake/internal/source-documents/:documentId

Production-Service -> GET /v1/intake/internal/requests/:requestId
Production-Service -> GET /v1/intake/internal/specs/:specId
Production-Service -> GET /v1/intake/internal/source-documents/:documentId
Production-Service -> GET /v1/intake/internal/source-documents/:documentId/content
Production-Service -> PUT /v1/intake/internal/specs/:specId
Production-Service -> PUT /v1/intake/internal/specs/:specId/replacement

Production-Service -> GET /v1/offers/handoffs/:handoffId
```

A valid service principal on a public create/decision/export route must not
receive human capability. For every listed triplet, neighboring method, path
and service name must fail. A browser request with Caddy human headers must not
become a service principal.

- [ ] **Step 5: Implement the narrow service allowlists**

Reuse the existing trusted secret comparison and exact service names. Do not
create service roles or add service entries to the capability matrix. Bind an
accepted service principal to the server-configured business; ignore any
incoming business header as a context selector.

- [ ] **Step 6: Add the route-classification contract**

Introspect each Fastify app after `ready()` and assert every registered `/v1`
route is one of: public auth, protected session product route, or exact internal
service route. Include the four historically missing routes:

```text
GET  /v1/production/cases/:caseId/quantity-workflow
POST /v1/production/cases/:caseId/quantity-workflow/:componentId/preview
POST /v1/production/cases/:caseId/quantity-workflow/:componentId/confirm
GET  /v1/exports/production-folders/:planId/html
```

- [ ] **Step 7: Migrate existing Hosted assertions without weakening them**

`task-1-hosted-actor-boundary` must assert 401 and no store access for a missing
session, not successful proxy identity. `hosted-secret-startup` uses a 32-byte
test secret. `stage-a-business-isolation` provisions separate configured app
instances and obtains session cookies without accepting client business IDs.

Existing local header tests must set `CATERING_DEV_AUTH=1` explicitly. Tests
that prove fail-closed behavior set `CATERING_DEV_AUTH=0` explicitly.

- [ ] **Step 8: Run Task 4 and Gate-B API regressions**

Run:

```bash
npx vitest run \
  tests/hosted-session-actor-boundary.test.ts \
  tests/internal-service-principal-auth.test.ts \
  tests/catering-auth-route-classification.test.ts \
  tests/task-1-hosted-actor-boundary.test.ts \
  tests/hosted-secret-startup.test.ts \
  tests/stage-a-business-isolation.test.ts \
  tests/admin-api-access.test.ts \
  tests/intake-commercial-access.test.ts \
  tests/production-commercial-access.test.ts \
  tests/read-only-production-access.test.ts \
  tests/print-export-commercial-access.test.ts \
  tests/production-audit-access.test.ts \
  --maxWorkers=1
```

Expected: all tests pass with the original Gate-B redactions intact.

- [ ] **Step 9: Record the Task 4 checkpoint without Git mutation**

Record RED/GREEN evidence and `git diff --check`.

---

### Task 5: Immutable ProductionFeedback visibility provenance

**Files:**
- Modify: `production-service/src/repositories/production-store.ts`
- Modify: `production-service/src/routes/artifact-routes.ts`
- Modify: `tests/production-feedback-confidentiality.test.ts`

**Interfaces:**
- Adds `ProductionFeedbackVisibility = "operational" | "commercial"` and optional persisted `visibility` for legacy compatibility.
- New session-origin drafts require immutable visibility derived solely from the creator's existing `commercial` capability.
- Historical trusted-proxy records retain the current exact compatibility rule; all other unclassified records fail closed for noncommercial readers.

- [ ] **Step 1: Write the P1 RED tests**

```ts
it("keeps session-origin operational feedback visible after the creator role changes", async () => {
  const created = await createFeedbackWithSession(productionCookie, operationalPayload());
  expect(created.visibility).toBe("operational");
  await changeUserRole(createdByUserId, "read_only_operator");
  expect(await listAsProduction()).toContainEqual(expect.objectContaining({ feedbackId: created.feedbackId }));
});

it("never exposes session-origin commercial feedback after an admin is downgraded", async () => {
  const created = await createFeedbackWithSession(adminCookie, commercialPayload());
  expect(created.visibility).toBe("commercial");
  await changeUserRole(adminUserId, "production_operator");
  expect((await listAsProduction()).body).not.toContain(commercialSentinel);
});
```

Also prove decision-only changes preserve visibility exactly, session records
without visibility are rejected or hidden fail-closed, and no text heuristic is
used. Add a direct storage-boundary RED test for both
`operational -> commercial` and `commercial -> operational` replacement. Add a
controlled concurrency RED in which two handlers read the same `pending_review`
snapshot: the first terminal decision succeeds, the second receives `409`, and
the first state remains persisted.

- [ ] **Step 2: Run the feedback test and verify RED**

Run: `npx vitest run tests/production-feedback-confidentiality.test.ts --maxWorkers=1`

Expected: session user IDs cannot satisfy the current actor-name reconstruction.

- [ ] **Step 3: Implement the minimal visibility snapshot**

At draft creation:

```ts
visibility: hasMinimalMvpCapability(actor, "commercial")
  ? "commercial"
  : "operational"
```

Do not infer from feedback text. Preserve the field through approval/rejection.
For noncommercial readers, allow only explicit `operational` or the exact
existing trusted-proxy legacy path. Admin/commercial capability may read both.
The repository uses insert/exact-CAS semantics and rejects every attempt to
change an already persisted visibility value. A decision must use the exact
`pending_review` snapshot read by its handler as the CAS expectation; it must not
reload a newer record and silently adopt that record as the expected state.

- [ ] **Step 4: Run feedback and Gate-B confidentiality regressions**

Run:

```bash
npx vitest run \
  tests/production-feedback-confidentiality.test.ts \
  tests/production-clarification-decision-confidentiality.test.ts \
  tests/production-commercial-access.test.ts \
  tests/read-only-production-access.test.ts \
  --maxWorkers=1
```

Expected: all tests pass and the commercial sentinel never appears for a
noncommercial session.

- [ ] **Step 5: Record the Task 5 checkpoint without Git mutation**

Record RED/GREEN evidence and `git diff --check`.

---

### Task 6: UI login, session boundary and logout

**Files:**
- Create: `backoffice-ui/src/session-api.ts`
- Create: `backoffice-ui/src/session-boundary.tsx`
- Create: `backoffice-ui/src/login-view.tsx`
- Modify: `backoffice-ui/src/App.tsx`
- Modify: `backoffice-ui/src/api.ts`
- Modify: `backoffice-ui/src/production-quantity-api.ts`
- Modify: `backoffice-ui/src/route-masthead.tsx`
- Modify or remove only where no longer used: `backoffice-ui/src/use-operator-name-state.ts`
- Test: `tests/catering-login-ui.test.tsx`
- Modify: `tests/backoffice-api.test.ts`
- Modify: `tests/backoffice-production-quantity-api.test.ts`
- Modify: `tests/read-only-production-ui.test.tsx`

**Interfaces:**
- `loadCateringSession`, `loginCateringUser`, `logoutCateringUser` use same-origin cookies and no identity headers.
- `SessionBoundary` renders `LoginView`, an authenticated child, or a generic unavailable state.
- Fachloader mount only after successful session resolution.

- [ ] **Step 1: Write the UI RED tests**

Prove:

- initial 401 renders only Kennung/PIN login and triggers no Fachloader;
- successful login never exposes or stores a token and then loads `/auth/session`;
- session failure or unclear payload never mounts Offer/Production workbench;
- logout clears authenticated UI and no Fachmutation follows;
- all Browserrequests omit `x-actor-name`, trusted actor, subject, role and business identity headers;
- Production and Read-only still consume the server-authoritative access context.

- [ ] **Step 2: Run the UI tests and verify RED**

Run:

```bash
npx vitest run \
  tests/catering-login-ui.test.tsx \
  tests/backoffice-api.test.ts \
  tests/backoffice-production-quantity-api.test.ts \
  tests/read-only-production-ui.test.tsx \
  --maxWorkers=1
```

Expected: login/session components are missing and existing API clients still
emit actor headers.

- [ ] **Step 3: Implement the minimal session UI**

Use `credentials: "same-origin"`; never return or persist a token. Keep existing
workbench components unchanged. Replace the editable operator identity control
with read-only `displayName` plus Logout. German login errors stay generic and
do not reveal account state. Logout closes the Fachrequest gate and removes
Fachdata immediately, but shows Login only after a successful server response.
Network or HTTP failure keeps a blocking retry state with neither Fachdata nor
Login visible.

- [ ] **Step 4: Preserve explicit local development**

In `CATERING_DEV_AUTH=1`, `/auth/session` may expose the existing server-resolved
dev actor context so the current local rehearsal remains usable. The UI itself
still sends no actor header; any dev proxy actor remains an explicit local
server concern and cannot run when Hosted is active.

- [ ] **Step 5: Run UI and browser-contract regressions**

Run:

```bash
npx vitest run \
  tests/catering-login-ui.test.tsx \
  tests/backoffice-api.test.ts \
  tests/backoffice-production-quantity-api.test.ts \
  tests/read-only-production-ui.test.tsx \
  tests/backoffice-route-smoke.test.ts \
  tests/linux-browser-rehearsal-contract.test.ts \
  --maxWorkers=1
```

Expected: all selected tests pass without actor headers from browser code.

- [ ] **Step 6: Record the Task 6 checkpoint without Git mutation**

Record RED/GREEN evidence and `git diff --check`.

---

### Task 7: Provisioning, Hosted role corridor and concrete-user audit

**Files:**
- Create: `scripts/manage-catering-user.ts`
- Create: `scripts/manage-catering-user` as the only supported, npm-free local launcher
- Test: `tests/manage-catering-user-command.test.ts`
- Create: `tests/catering-hosted-session-e2e.test.ts`
- Create: `tests/catering-session-audit.test.ts`
- Reuse without weakening: existing Gate-B API/UI/export tests

**Interfaces:**
- CLI supports create, set-pin, set-role and set-active against the configured single business.
- PIN is read from protected stdin/TTY, never argv, environment, stdout or audit.
- The operator launcher invokes the repository-local `tsx` binary directly. There is no
  `npm run`, `npm exec` or `npx` entry because those wrappers can log rejected argv values
  before the CLI can fail closed.
- Hosted E2E uses the real Intake login endpoint and the same cookie across the four app instances.

- [ ] **Step 1: Write provisioning RED tests**

Prove argv/env PINs are rejected, non-TTY/non-protected input fails closed unless
the test injects the explicit safe reader, duplicate login codes fail, and role,
PIN or active updates increment `authEpoch`. Assert stdout/stderr contain no PIN
or hash sentinel. Invoke the real npm-free launcher from a foreign working
directory and prove that a rejected synthetic argv PIN reaches neither output,
npm debug logs nor persistence.

- [ ] **Step 2: Run the command test and verify RED**

Run: `npx vitest run tests/manage-catering-user-command.test.ts --maxWorkers=1`

Expected: command does not exist.

- [ ] **Step 3: Implement the minimal non-network command**

Use the same User Store and PIN module as the server. No HTTP listener, default
account, seed credential or environment PIN is allowed. Display only stable
userId, login code, display name, role, active state and success/failure status.
The launcher must resolve the repository-local `node_modules/.bin/tsx` and must
not fall back to npm, npx, PATH resolution or a network install.
Resolve storage exactly like the services: prefer `CATERING_DATABASE_URL`, then
`DATABASE_URL`; only without either use an explicit `CATERING_DATA_ROOT`. Pass
the selected target explicitly so ambient process variables cannot redirect a
file-backed administration command.

- [ ] **Step 4: Write the three-role Hosted E2E RED test**

Create synthetic Admin, `production_operator` and `read_only_operator` users in
the shared store. Login each through Intake, carry only its returned cookie, and
exercise direct API, UI loader contract, exports and audit.

Required assertions:

| Role | API/UI | Export | Audit |
|---|---|---|---|
| Admin | allowed existing scopes | commercial allowed | sees concrete action `userId` |
| Production | kitchen/mengen/review/production allowed, no commercial fields | only existing redacted operational export | no audit escalation; Admin sees its `userId` |
| Read-only | redacted Production reads, no action | blocked | no decision and no audit escalation |

Add Cross-Path Production -> Offer/export 403, no-cookie Caddy headers -> 401,
forged Admin headers beside low-role cookie -> no elevation, forged low header
beside Admin cookie -> no downgrade, and Authorization-only -> 401.

- [ ] **Step 5: Write the Audit RED test**

After a permitted Production action, read Audit as Admin and assert:

```ts
expect(entry.actor).toEqual({
  name: productionUser.userId,
  source: "authenticated-session"
});
expect(JSON.stringify(entry)).not.toContain(productionUser.pinHash);
expect(JSON.stringify(entry)).not.toContain("__Host-catering_session");
```

- [ ] **Step 6: Implement only missing E2E wiring**

Do not add role logic to the test or UI. Fix only genuine product integration
gaps exposed by the RED corridor. Any new P0/P1 receives its own minimal RED
before a fix; P2/P3 are recorded and not implemented.

- [ ] **Step 7: Run the full Gate-B Auth corridor**

Run:

```bash
npx vitest run \
  tests/catering-pin-crypto.test.ts \
  tests/catering-user-store.test.ts \
  tests/catering-login-lockout.test.ts \
  tests/catering-session-auth.test.ts \
  tests/hosted-session-actor-boundary.test.ts \
  tests/internal-service-principal-auth.test.ts \
  tests/catering-auth-route-classification.test.ts \
  tests/catering-login-ui.test.tsx \
  tests/catering-hosted-session-e2e.test.ts \
  tests/catering-session-audit.test.ts \
  tests/manage-catering-user-command.test.ts \
  tests/admin-api-access.test.ts \
  tests/intake-commercial-access.test.ts \
  tests/production-commercial-access.test.ts \
  tests/read-only-production-access.test.ts \
  tests/print-export-commercial-access.test.ts \
  tests/production-audit-access.test.ts \
  tests/read-only-production-ui.test.tsx \
  tests/production-feedback-confidentiality.test.ts \
  --maxWorkers=1
```

Expected: zero failures, no commercial sentinel leak and concrete session
`userId` in Audit.

- [ ] **Step 8: Record the Task 7 checkpoint without Git mutation**

Record the full corridor output and `git diff --check`.

---

### Task 8: Exact-candidate verification and independent review

**Files:**
- No files are created or modified in this task.

**Interfaces:**
- Consumes the exact worktree candidate.
- Produces a reproducible file scope, Full-Index patch hash, test evidence and independent P0/P1 judgment for supervisor review.

- [ ] **Step 1: Run formatting and type/build gates**

Run:

```bash
git diff --check
npx tsc --noEmit
npm --workspace @catering/backoffice-ui run build
```

Expected: exit 0 for every command.

- [ ] **Step 2: Run the full Gate-B Auth corridor again**

Run the exact Task 7 command fresh. Expected: zero failures.

- [ ] **Step 3: Run the full repository suite once**

Run: `npm test -- --maxWorkers=1`

If the pre-existing Phase-3/Post-Cutover test again times out or hangs, record
its exact files and output separately. Do not repair, suppress or reinterpret it
as Auth evidence. All product/auth tests must still terminalize green.

- [ ] **Step 4: Run the browser rehearsal as a regression, not Hosted evidence**

Run: `npm run browser:rehearsal`

Expected: local dev rehearsal succeeds. Its `CATERING_DEV_AUTH=1` result is not
used to close Gate B Hosted-E2E.

- [ ] **Step 5: Verify scope and candidate identity**

Run:

```bash
git status --short
git diff --name-status
git diff --stat
git diff --check
git diff --binary HEAD | shasum -a 256
```

Record exact HEAD, file list and Full-Index patch hash. Verify no file below
`platform-infra`, `edge-infra`, deployment workflows or PR #677 was changed.

- [ ] **Step 6: Dispatch independent exact-candidate review**

The reviewer receives the spec, this plan, exact HEAD, exact patch hash, full
scope and fresh evidence. Required judgment:

```text
P0 count
P1 count
header/path/Bearer fallback status
current-role/authEpoch enforcement status
Admin/Production/Read-only API/UI/export/audit status
ProductionFeedback visibility status
Gate-B product Hosted-E2E readiness
```

- [ ] **Step 7: Stop before Git finalization**

Report exact candidate and review to the Supervisor. Do not commit, push, open
or update a PR, merge, deploy, release or tag without the separate Git-
finalization and later deployment approvals.

## Test Matrix Summary

| Contract | RED anchor | Required GREEN evidence |
|---|---|---|
| Unique persisted user subject | `catering-user-store` | File/Postgres collection, duplicate race, CAS and business scope |
| Six-digit PIN | `catering-pin-crypto` | fixed scrypt format, timing-safe verify, invalid formats fail closed |
| Lockout/rate limit | `catering-login-lockout` | 12/15m, 10m lock, 60/15m source, pre-KDF source rejection, four concurrent KDFs, dummy hash, no enumeration |
| Cookie-only session | `catering-session-auth` | secure cookie, no token body/storage, Bearer-only 401 |
| Current role/active/epoch | `catering-session-auth` | role/PIN/active changes invalidate old cookie immediately |
| No Caddy/header fallback | `hosted-session-actor-boundary` | no cookie + every legacy header = 401 before data access |
| Route completeness | `catering-auth-route-classification` | every `/v1` route classified; quantity/folder gaps covered |
| Internal service calls | `internal-service-principal-auth` | exact service/method/path allowlists only |
| Existing Gate-B redaction | current Gate-B API/export/UI tests | unchanged price, action and export boundaries |
| Feedback provenance | `production-feedback-confidentiality` | storage-enforced immutable operational/commercial visibility; role drift safe |
| UI login | `catering-login-ui` | fail-closed before loaders, no actor header, no token storage, logout failure stays blocked |
| Three real roles | `catering-hosted-session-e2e` | Admin, Production, Read-only through same login/cookie path |
| Visitor audit | `catering-session-audit` | exact `userId`, no PIN/hash/cookie leak |
| Operational provisioning | `manage-catering-user-command` | no network/API, no PIN argv/env/output, authEpoch updates, same explicit DB/file target as services |
