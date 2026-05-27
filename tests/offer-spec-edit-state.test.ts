import { describe, expect, it } from "vitest";
import {
  buildOfferSpecEditActions,
  buildOfferSpecEditState,
  type OfferSpecEditActionsInput
} from "../backoffice-ui/src/offer-spec-edit-state.js";

describe("offer spec edit state", () => {
  it("maps offer spec edit fields without changing form values", () => {
    const state = buildOfferSpecEditState({
      editingSpecId: "spec-angebot-1",
      eventType: " Lunch ",
      eventDate: " 2026-07-01 ",
      attendeeCount: " 35 ",
      serviceForm: " Buffet ",
      menuItems: " Curry, Dessert "
    });

    expect(state).toEqual({
      editingSpecId: "spec-angebot-1",
      eventType: " Lunch ",
      eventDate: " 2026-07-01 ",
      attendeeCount: " 35 ",
      serviceForm: " Buffet ",
      menuItems: " Curry, Dessert "
    });
  });

  it("keeps the optional editing spec id undefined", () => {
    const state = buildOfferSpecEditState({
      eventType: "",
      eventDate: "",
      attendeeCount: "",
      serviceForm: "",
      menuItems: ""
    });

    expect(state.editingSpecId).toBeUndefined();
    expect(state).toEqual({
      editingSpecId: undefined,
      eventType: "",
      eventDate: "",
      attendeeCount: "",
      serviceForm: "",
      menuItems: ""
    });
  });

  it("maps offer spec edit action references without wrapping callbacks", () => {
    const actions: OfferSpecEditActionsInput = {
      beginSpecEdit: (_spec) => undefined,
      setEventType: (_value) => undefined,
      setEventDate: (_value) => undefined,
      setAttendeeCount: (_value) => undefined,
      setServiceForm: (_value) => undefined,
      setMenuItems: (_value) => undefined,
      saveSpecEdit: async () => undefined,
      resetSpecEdit: () => undefined
    };

    expect(buildOfferSpecEditActions(actions)).toEqual(actions);
  });
});
