import { readFileSync } from "node:fs";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { buildIntakeApp, IntakeStore } from "@catering/intake-service";
import { buildOfferApp } from "@catering/offer-service";
import { OfferStore } from "../offer-service/src/store.js";

const scriptSource = readFileSync(
  path.resolve(import.meta.dirname, "../scripts/browser-rehearsal/create-offer-case.js"),
  "utf8"
);
const roots: string[] = [];

function loadCreateOfferCase(): () => Promise<{
  caseId: string;
  draftId: string;
  eventSummary: string;
}> {
  return new Function(`return (${scriptSource});`)() as () => Promise<{
    caseId: string;
    draftId: string;
    eventSummary: string;
  }>;
}

afterEach(() => {
  for (const root of roots.splice(0)) {
    rmSync(root, { recursive: true, force: true });
  }
});

describe("browser offer-case creation integration", () => {
  it("persists the AcceptedEventSpec used by the real offer-to-production path", async () => {
    const rootDir = mkdtempSync(path.join(tmpdir(), "catering-browser-offer-case-"));
    roots.push(rootDir);
    const intakeStore = new IntakeStore({ rootDir });
    const offerStore = new OfferStore({ rootDir });
    const intakeApp = buildIntakeApp({
      rootDir,
      store: intakeStore,
      env: { CATERING_DEV_AUTH: "true" }
    });
    const offerApp = buildOfferApp({
      rootDir,
      store: offerStore,
      env: { CATERING_DEV_AUTH: "true" }
    });
    const previousFetch = globalThis.fetch;
    const previousSessionStorage = Object.getOwnPropertyDescriptor(globalThis, "sessionStorage");
    const sessionValues = new Map<string, string>();

    Object.defineProperty(globalThis, "sessionStorage", {
      configurable: true,
      value: {
        getItem: (key: string) => sessionValues.get(key) ?? null,
        setItem: (key: string, value: string) => sessionValues.set(key, value)
      }
    });
    globalThis.fetch = async (input, init) => {
      const requestPath = String(input);
      const isIntake = requestPath.startsWith("/api/intake/");
      const app = isIntake ? intakeApp : offerApp;
      const servicePath = requestPath.replace(/^\/api\/(?:intake|offers)/u, "");
      const headers = Object.fromEntries(new Headers(init?.headers).entries());
      const response = await app.inject({
        method: (init?.method ?? "GET") as "GET" | "POST",
        url: servicePath,
        headers,
        payload: typeof init?.body === "string" ? JSON.parse(init.body) : undefined
      });
      return new Response(response.body, {
        status: response.statusCode,
        headers: { "content-type": "application/json" }
      });
    };

    try {
      const result = await loadCreateOfferCase()();
      const acceptedSpec = await intakeStore.getSpec(
        { businessId: "local" },
        "spec-browser-rehearsal-offer-case"
      );
      const draft = await offerStore.getDraft({ businessId: "local" }, result.draftId);

      expect(acceptedSpec?.specId).toBe("spec-browser-rehearsal-offer-case");
      expect(draft?.proposedEventSpec.specId).toBe(acceptedSpec?.specId);
      expect(result.caseId).toMatch(/^offer-case-/u);
    } finally {
      globalThis.fetch = previousFetch;
      if (previousSessionStorage) {
        Object.defineProperty(globalThis, "sessionStorage", previousSessionStorage);
      } else {
        Object.defineProperty(globalThis, "sessionStorage", { configurable: true, value: undefined });
      }
      await Promise.all([intakeApp.close(), offerApp.close()]);
    }
  });

});
