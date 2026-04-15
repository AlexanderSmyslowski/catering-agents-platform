import { describe, expect, it } from "vitest";
import { IntakeStore, buildIntakeApp } from "@catering/intake-service";

describe("intake finalize access", () => {
  it("rejects finalize requests from non-audit operators and allows the audit operator", async () => {
    const app = buildIntakeApp(new IntakeStore());

    const blockedResponse = await app.inject({
      method: "POST",
      url: "/v1/intake/spec-governance/finalize",
      headers: {
        "x-actor-name": "Intake-Mitarbeiter"
      },
      payload: {
        specId: "spec-123"
      }
    });

    expect(blockedResponse.statusCode).toBe(403);
    expect(blockedResponse.json()).toMatchObject({
      message: "Betriebs-/Audit-Operator erforderlich."
    });

    const allowedResponse = await app.inject({
      method: "POST",
      url: "/v1/intake/spec-governance/finalize",
      headers: {
        "x-actor-name": "Betriebs-/Audit-Operator"
      },
      payload: {
        specId: "spec-123",
        confirmCriticalFinalize: true
      }
    });

    expect(allowedResponse.statusCode).toBe(200);
    expect(allowedResponse.json()).toMatchObject({
      ok: true,
      specId: "spec-123",
      confirmCriticalFinalize: true
    });

    await app.close();
  });
});
