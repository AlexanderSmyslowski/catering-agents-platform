import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { createEventRequestFromText, normalizeEventRequestToSpec } from "@catering/shared-core";
import { buildIntakeApp } from "../intake-service/src/app.js";
import { IntakeStore } from "../intake-service/src/store.js";

describe("intake answers preserve existing menu allocations", () => {
  it.each([false, true])("retains 55/25/20 portions and component identity when unchanged menu labels are sent: %s", async includeLabels => {
    const rootDir = mkdtempSync(path.join(tmpdir(), "catering-portions-"));
    const store = new IntakeStore({ rootDir });
    const request = createEventRequestFromText({ requestId: "synthetic-portions", channel: "text", rawText: "SYNTHETISCH: Buffet am 13.11.2026 für 100 Gäste mit 55 Portionen Hähnchenragout, 25 Portionen vegetarische Gemüsebratlinge und 20 Portionen veganes Linsenragout." });
    const normalized = normalizeEventRequestToSpec(request, { sourceType: "manual_input", reference: request.requestId, commercialState: "manual" });
    const source = { ...normalized, menuPlan: ["Hähnchenragout", "Gemüsebratlinge", "Linsenragout"].map((label, i) => ({ ...normalized.menuPlan[0]!, label, componentId: `original-${i}`, servings: [55, 25, 20][i]!, productionDecision: { mode: "scratch" as const, notes: "Synthetischer Rechentest" } })) };
    expect(source.menuPlan).toHaveLength(3);
    await store.saveSpec({ businessId: "local" }, source);
    const secret = "synthetic-intake-portions-secret";
    const app = buildIntakeApp({ rootDir, store, trustedActorSecret: secret });
    try {
      const response = await app.inject({ method: "PATCH", url: `/v1/intake/specs/${source.specId}`, headers: { "x-catering-trusted-secret": secret, "x-catering-actor-name": "Intake-Mitarbeiter", "x-catering-business-id": "local" }, payload: {
        attendeeCount: 100, eventSchedule: [{ label: "Service", start: "18:00", end: "22:00" }],
        ...(includeLabels ? { menuItems: source.menuPlan.map(item => item.label) } : {}),
        componentUpdates: [{ componentId: "original-0", menuCategory: "classic", productionStation: "hot-kitchen" }]
      } });
      expect(response.statusCode, response.body).toBe(200);
      const saved = (await store.getSpec({ businessId: "local" }, source.specId))!;
      expect(saved.menuPlan.map(item => item.servings)).toEqual([55, 25, 20]);
      expect(saved.menuPlan.map(item => item.componentId)).toEqual(["original-0", "original-1", "original-2"]);
      expect(saved.menuPlan[0]!.productionStation).toBe("hot-kitchen");
      expect(saved.menuPlan[0]!.productionDecision).toEqual(source.menuPlan[0]!.productionDecision);
      expect(saved.event.schedule).toEqual([{ label: "Service", start: "18:00", end: "22:00" }]);
      for (const productionStation of ["oven", ["hot-kitchen"], {}, 7, null]) {
        const invalid = await app.inject({ method: "PATCH", url: `/v1/intake/specs/${source.specId}`, headers: { "x-catering-trusted-secret": secret, "x-catering-actor-name": "Intake-Mitarbeiter", "x-catering-business-id": "local" }, payload: { componentUpdates: [{ componentId: "original-0", productionStation }] } });
        expect(invalid.statusCode, invalid.body).toBe(422);
        expect(await store.getSpec({ businessId: "local" }, source.specId)).toEqual(saved);
      }
      const cleared = await app.inject({ method: "PATCH", url: `/v1/intake/specs/${source.specId}`, headers: { "x-catering-trusted-secret": secret, "x-catering-actor-name": "Intake-Mitarbeiter", "x-catering-business-id": "local" }, payload: { componentUpdates: [{ componentId: "original-0", notes: "" }] } });
      expect(cleared.statusCode, cleared.body).toBe(200);
      expect(cleared.json().acceptedEventSpec.menuPlan[0].productionDecision.notes).toBe("");
      await store.saveSpec({ businessId: "local" }, { ...saved, menuPlan: [...saved.menuPlan,
        { ...saved.menuPlan[0]!, componentId: "full-guest", servings: 100 },
        { ...saved.menuPlan[0]!, componentId: "missing-quantity", servings: undefined }
      ] });
      const increased = await app.inject({ method: "PATCH", url: `/v1/intake/specs/${source.specId}`, headers: { "x-catering-trusted-secret": secret, "x-catering-actor-name": "Intake-Mitarbeiter", "x-catering-business-id": "local" }, payload: { attendeeCount: 120 } });
      expect(increased.statusCode, increased.body).toBe(200);
      expect(increased.json().acceptedEventSpec.menuPlan.map((item: { servings: number }) => item.servings)).toEqual([55, 25, 20, 120, 120]);

    } finally { await app.close(); }
  });
});
