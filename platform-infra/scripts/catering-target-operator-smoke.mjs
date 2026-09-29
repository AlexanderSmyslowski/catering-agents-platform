process.stderr.write("TARGET_AUTH_SMOKE_STAGE stage=script_start status=success\n");
const chunks = [];
for await (const chunk of process.stdin) chunks.push(chunk);
const raw = Buffer.concat(chunks).toString("utf8");
if (raw.length === 0 || raw.length > 4096) throw new Error("Smoke credentials are missing or oversized.");

const input = JSON.parse(raw);
const expectedKeys = ["basicPassword", "basicUser", "loginCode", "pin"].sort();
if (
  !input ||
  typeof input !== "object" ||
  Array.isArray(input) ||
  Object.keys(input).sort().join("\0") !== expectedKeys.join("\0") ||
  expectedKeys.some((key) => typeof input[key] !== "string" || input[key].length === 0 || /[\0\r\n]/u.test(input[key]))
) {
  throw new Error("Smoke credential payload is invalid.");
}
process.stderr.write("TARGET_AUTH_SMOKE_STAGE stage=payload_valid status=success\n");

const base = "http://web:8081";
const origin = "https://web:8081";
const authorization = "Basic " + Buffer.from(input.basicUser + ":" + input.basicPassword, "utf8").toString("base64");

async function request(path, init = {}) {
  const headers = new Headers(init.headers);
  headers.set("authorization", authorization);
  headers.set("origin", origin);
  const timeoutSignal = AbortSignal.timeout(20_000);
  try {
    return await fetch(base + path, {
      ...init,
      headers,
      redirect: "manual",
      signal: timeoutSignal
    });
  } catch (error) {
    if (timeoutSignal.aborted) throw new Error("Authenticated smoke request timed out.");
    throw error;
  }
}

const login = await request("/api/intake/v1/auth/login", {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ loginCode: input.loginCode, pin: input.pin })
});
process.stderr.write("TARGET_AUTH_SMOKE_STAGE stage=login_response status=" + String(login.status) + "\n");
if (login.status !== 200) throw new Error("Authenticated smoke login failed.");
process.stderr.write("TARGET_AUTH_SMOKE_STAGE stage=login status=success\n");

const setCookie = typeof login.headers.getSetCookie === "function"
  ? login.headers.getSetCookie()[0]
  : login.headers.get("set-cookie");
const cookie = typeof setCookie === "string" ? setCookie.split(";", 1)[0] : "";
if (!cookie.includes("=")) throw new Error("Authenticated smoke session cookie missing.");

const session = await request("/api/intake/v1/auth/session", { headers: { cookie } });
process.stderr.write("TARGET_AUTH_SMOKE_STAGE stage=session_response status=" + String(session.status) + "\n");
if (session.status !== 200) throw new Error("Authenticated smoke session read failed.");
const sessionBody = await session.json();
if (
  sessionBody?.authenticated !== true ||
  !Array.isArray(sessionBody?.access?.capabilities) ||
  !sessionBody.access.capabilities.includes("production_read")
) {
  throw new Error("Authenticated smoke account lacks production_read.");
}
process.stderr.write("TARGET_AUTH_SMOKE_STAGE stage=session status=success\n");

const plans = await request("/api/production/v1/production/plans", { headers: { cookie } });
process.stderr.write("TARGET_AUTH_SMOKE_STAGE stage=production_read_response status=" + String(plans.status) + "\n");
if (plans.status !== 200) throw new Error("Authenticated production plans read smoke failed.");
await plans.json();
process.stderr.write("TARGET_AUTH_SMOKE_STAGE stage=production_read status=success\n");

process.stdout.write("authenticated_read_smoke_ok\n");
