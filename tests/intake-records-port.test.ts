import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  createEventRequestFromText,
  normalizeEventRequestToSpec,
  type AcceptedEventSpec
} from "@catering/shared-core";
import { buildIntakeApp } from "../intake-service/src/app.js";
import { IntakeStore } from "../intake-service/src/store.js";
import { HttpIntakeRecordsPort } from "../production-service/src/gateways/http-intake-records-port.js";

const sharedSecret = "intake-records-service-secret-20260828";
const alpha = { businessId: "alpha" };

function requestAndSpec(id: string) {
  const eventRequest = createEventRequestFromText({
    requestId: id,
    channel: "text",
    rawText: "Empfang für 40 Personen am 12.09.2026."
  });
  const acceptedEventSpec = normalizeEventRequestToSpec(eventRequest, {
    sourceType: "manual_input",
    reference: eventRequest.requestId,
    commercialState: "manual"
  });
  return { eventRequest, acceptedEventSpec };
}

function changedSpec(spec: AcceptedEventSpec, title: string): AcceptedEventSpec {
  return {
    ...structuredClone(spec),
    event: { ...spec.event, title }
  };
}

function injectedFetch(app: ReturnType<typeof buildIntakeApp>): typeof fetch {
  return async (input, init) => {
    const url = new URL(String(input));
    const response = await app.inject({
      method: (init?.method ?? "GET") as "GET",
      url: `${url.pathname}${url.search}`,
      headers: Object.fromEntries(new Headers(init?.headers).entries()),
      payload: init?.body as string | undefined
    });
    return new Response(Uint8Array.from(response.rawPayload).buffer, {
      status: response.statusCode,
      headers: response.headers as HeadersInit
    });
  };
}

describe("production intake records port", () => {
  it("binds Production-Service to the configured business and ignores its incoming business header", async () => {
    const rootDir = mkdtempSync(path.join(tmpdir(), "intake-record-port-read-"));
    const store = new IntakeStore({ rootDir });
    const { eventRequest, acceptedEventSpec } = requestAndSpec("request-alpha");
    await store.saveRequest(alpha, eventRequest);
    await store.saveSpec(alpha, acceptedEventSpec);
    const app = buildIntakeApp({
      rootDir,
      store,
      trustedActorSecret: sharedSecret,
      env: {
        CATERING_DEFAULT_BUSINESS_ID: "alpha",
        CATERING_TRUSTED_ACTOR_SECRET: sharedSecret
      }
    });
    const port = new HttpIntakeRecordsPort({
      intakeServiceUrl: "http://intake.internal",
      trustedServiceSecret: sharedSecret,
      fetch: injectedFetch(app)
    });

    await expect(port.getRequest(alpha, eventRequest.requestId)).resolves.toEqual(eventRequest);
    await expect(port.getSpec(alpha, acceptedEventSpec.specId)).resolves.toEqual(acceptedEventSpec);
    await expect(port.getSpec({ businessId: "beta" }, acceptedEventSpec.specId))
      .resolves.toEqual(acceptedEventSpec);

    const wrongActor = await app.inject({
      method: "GET",
      url: `/v1/intake/internal/specs/${acceptedEventSpec.specId}`,
      headers: {
        "x-catering-trusted-secret": sharedSecret,
        "x-catering-actor-name": "Intake-Mitarbeiter",
        "x-catering-business-id": "alpha"
      }
    });
    expect(wrongActor.statusCode).toBe(401);
    await app.close();
  });

  it("inserts idempotently and refuses a different record under the same spec id", async () => {
    const rootDir = mkdtempSync(path.join(tmpdir(), "intake-record-port-insert-"));
    const store = new IntakeStore({ rootDir });
    const app = buildIntakeApp({
      rootDir,
      store,
      trustedActorSecret: sharedSecret,
      env: {
        CATERING_DEFAULT_BUSINESS_ID: "alpha",
        CATERING_TRUSTED_ACTOR_SECRET: sharedSecret
      }
    });
    const port = new HttpIntakeRecordsPort({
      intakeServiceUrl: "http://intake.internal",
      trustedServiceSecret: sharedSecret,
      fetch: injectedFetch(app)
    });
    const { acceptedEventSpec } = requestAndSpec("request-insert");

    await expect(port.insertSpec(alpha, acceptedEventSpec)).resolves.toBe("created");
    await expect(port.insertSpec(alpha, acceptedEventSpec)).resolves.toBe("same_content");
    await expect(port.insertSpec(alpha, changedSpec(acceptedEventSpec, "Anderer Auftrag")))
      .rejects.toThrow("AcceptedEventSpec");
    await expect(store.getSpec(alpha, acceptedEventSpec.specId)).resolves.toEqual(acceptedEventSpec);
    await app.close();
  });

  it("conditionally replaces a spec, supports retry, and rejects a stale expected snapshot", async () => {
    const rootDir = mkdtempSync(path.join(tmpdir(), "intake-record-port-replace-"));
    const store = new IntakeStore({ rootDir });
    const app = buildIntakeApp({
      rootDir,
      store,
      trustedActorSecret: sharedSecret,
      env: {
        CATERING_DEFAULT_BUSINESS_ID: "alpha",
        CATERING_TRUSTED_ACTOR_SECRET: sharedSecret
      }
    });
    const port = new HttpIntakeRecordsPort({
      intakeServiceUrl: "http://intake.internal",
      trustedServiceSecret: sharedSecret,
      fetch: injectedFetch(app)
    });
    const { acceptedEventSpec } = requestAndSpec("request-replace");
    const replacement = changedSpec(acceptedEventSpec, "Geprüfter Empfang");
    await store.saveSpec(alpha, acceptedEventSpec);

    await expect(port.replaceSpec(alpha, acceptedEventSpec, replacement)).resolves.toBe("updated");
    await expect(port.replaceSpec(alpha, acceptedEventSpec, replacement)).resolves.toBe("same_content");

    const differentReplacement = changedSpec(acceptedEventSpec, "Veralteter Schreibversuch");
    await expect(port.replaceSpec(alpha, acceptedEventSpec, differentReplacement))
      .rejects.toThrow("zwischenzeitlich geändert");
    await expect(store.getSpec(alpha, acceptedEventSpec.specId)).resolves.toEqual(replacement);
    await app.close();
  });
});
