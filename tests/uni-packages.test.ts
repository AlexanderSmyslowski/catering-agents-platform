import { describe, expect, it } from "vitest";
import {
  estimateUniSideCosts,
  loadUniRequestPackages,
  selectUniPackages,
  UNI_STAFF_HOURLY
} from "../shared-core/src/rules/uni-packages.js";

describe("Uni Rahmenvertrag packages", () => {
  it("loads the six request packages from the Uni data fixture", () => {
    const packages = loadUniRequestPackages();

    expect(packages.map((item) => item.id)).toEqual([
      "uni_conference_drinks_allday",
      "uni_coffee_breaks",
      "uni_quick_lunch",
      "uni_lunch_buffet_warm",
      "uni_reception_gettogether",
      "uni_dinner_buffet"
    ]);
    expect(packages).toHaveLength(6);
    expect(packages.every((item) => item.cluster === "Uni-Rahmenvertrag")).toBe(true);
    expect(packages.find((item) => item.id === "uni_dinner_buffet")?.premium_variant).toEqual({
      name: "Dinner-Buffet Premium (Tapas/Klassisch)",
      price_band_pp: [45, 65]
    });
  });

  it("filters by minimum pax and optional event type", () => {
    expect(selectUniPackages({ pax: 10 }).map((item) => item.id)).toEqual([]);
    expect(selectUniPackages({ pax: 12 }).map((item) => item.id)).toEqual(["uni_quick_lunch"]);
    expect(selectUniPackages({ eventType: "Poster Session", pax: 200 }).map((item) => item.id)).toContain(
      "uni_reception_gettogether"
    );
    expect(selectUniPackages({ pax: 50 }).map((item) => item.id)).toEqual([
      "uni_conference_drinks_allday",
      "uni_coffee_breaks",
      "uni_quick_lunch",
      "uni_lunch_buffet_warm",
      "uni_reception_gettogether",
      "uni_dinner_buffet"
    ]);
  });

  it("matches event types case-insensitively as substrings", () => {
    expect(selectUniPackages({ eventType: "poster", pax: 200 }).map((item) => item.id)).toEqual([
      "uni_reception_gettogether"
    ]);
    expect(selectUniPackages({ eventType: "tagung mit mittagessen", pax: 50 }).map((item) => item.id)).toEqual([
      "uni_lunch_buffet_warm"
    ]);
  });

  it("estimates Uni side costs with the documented transport ladder and staff rate", () => {
    expect(UNI_STAFF_HOURLY).toBe(45.55);
    expect(estimateUniSideCosts({ deliveries: 1, staffHours: 19.5 })).toEqual({
      transport: 150,
      staff: 888.23,
      total: 1038.23
    });
    expect(estimateUniSideCosts({ deliveries: 3, staffHours: 0 })).toEqual({
      transport: 450,
      staff: 0,
      total: 450
    });
    expect(estimateUniSideCosts({ deliveries: 4, staffHours: 1 })).toEqual({
      transport: 600,
      staff: 45.55,
      total: 645.55
    });
  });
});
