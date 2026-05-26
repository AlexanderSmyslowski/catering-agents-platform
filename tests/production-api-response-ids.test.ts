import { describe, expect, it } from "vitest";
import {
  extractAcceptedSpecId,
  extractProductionPlanId
} from "../backoffice-ui/src/production-api-response-ids.js";

describe("production api response ids", () => {
  it("extracts accepted spec ids only from the expected response shape", () => {
    expect(
      extractAcceptedSpecId({
        acceptedEventSpec: {
          specId: "spec-123"
        }
      })
    ).toBe("spec-123");
    expect(extractAcceptedSpecId({ acceptedEventSpec: { specId: 123 } })).toBeUndefined();
    expect(extractAcceptedSpecId({})).toBeUndefined();
  });

  it("extracts production plan ids only from the expected response shape", () => {
    expect(
      extractProductionPlanId({
        productionPlan: {
          planId: "plan-123"
        }
      })
    ).toBe("plan-123");
    expect(extractProductionPlanId({ productionPlan: { planId: 123 } })).toBeUndefined();
    expect(extractProductionPlanId({})).toBeUndefined();
  });
});
