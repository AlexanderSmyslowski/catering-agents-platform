import { describe, expect, it } from "vitest";
import { buildManualSpecInput } from "../backoffice-ui/src/production-manual-spec-input.js";

describe("production manual spec input", () => {
  it("asks to clarify mixed legacy comma and newline lists", () => {
    expect(() => buildManualSpecInput({eventType:"",eventDate:"",attendeeCount:"100",serviceForm:"",customerName:"",venueName:"",notes:"",menuItems:"Salat, Suppe\nDessert"})).toThrow(/Zeile/);
  });

  it("does not split a single counted dish at commas in its name", () => {
    const result = buildManualSpecInput({eventType:"",eventDate:"",attendeeCount:"100",serviceForm:"",customerName:"",venueName:"",notes:"",menuItems:"Creme mit Apfel, Birne – 50 Portionen"});
    expect(result.menuItems).toEqual(["Creme mit Apfel, Birne – 50 Portionen"]);
  });

  it("keeps commas inside a dish when menu positions use separate lines", () => {
    const result = buildManualSpecInput({eventType:"",eventDate:"",attendeeCount:"100",serviceForm:"",customerName:"",venueName:"",notes:"",menuItems:"Creme mit Apfel, Birne – 50 Portionen\nKuchenbar – 50 Stück insgesamt"});
    expect(result.menuItems).toEqual(["Creme mit Apfel, Birne – 50 Portionen", "Kuchenbar – 50 Stück insgesamt"]);
  });

  it("normalizes manual production spec form values for intake creation", () => {
    expect(
      buildManualSpecInput({
        eventType: " Lunch ",
        eventDate: " 2026-06-12 ",
        attendeeCount: " 42 ",
        serviceForm: " Buffet ",
        menuItems: " Hummus, Salat, ",
        customerName: " ACME ",
        venueName: " Loft ",
        notes: " Bitte frueh liefern "
      })
    ).toEqual({
      eventType: "Lunch",
      eventDate: "2026-06-12",
      attendeeCount: 42,
      serviceForm: "Buffet",
      menuItems: ["Hummus", "Salat"],
      customerName: "ACME",
      venueName: "Loft",
      notes: "Bitte frueh liefern"
    });
  });

  it("keeps empty optional fields undefined while preserving an empty menu item list", () => {
    expect(
      buildManualSpecInput({
        eventType: " ",
        eventDate: "",
        attendeeCount: "",
        serviceForm: " ",
        menuItems: " , ",
        customerName: " ",
        venueName: "",
        notes: " "
      })
    ).toEqual({
      eventType: undefined,
      eventDate: undefined,
      attendeeCount: undefined,
      serviceForm: undefined,
      menuItems: [],
      customerName: undefined,
      venueName: undefined,
      notes: undefined
    });
  });
});
