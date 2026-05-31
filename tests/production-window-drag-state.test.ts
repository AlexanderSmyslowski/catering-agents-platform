import { describe, expect, it } from "vitest";
import {
  getProductionWindowDropFile,
  shouldActivateProductionWindowDrag,
  shouldClearProductionWindowDrag
} from "../backoffice-ui/src/production-window-drag-state.js";

describe("production window drag state", () => {
  it("activates the production drop affordance only for file drags", () => {
    expect(
      shouldActivateProductionWindowDrag({
        dataTransfer: {
          types: {
            includes: (type: string) => type === "Files"
          }
        }
      })
    ).toBe(true);

    expect(
      shouldActivateProductionWindowDrag({
        dataTransfer: {
          types: {
            includes: () => false
          }
        }
      })
    ).toBe(false);
    expect(shouldActivateProductionWindowDrag({ dataTransfer: null })).toBe(false);
  });

  it("extracts the first dropped file and keeps empty drops inert", () => {
    const file = new File(["Angebot"], "angebot.pdf", { type: "application/pdf" });

    expect(
      getProductionWindowDropFile({
        dataTransfer: {
          files: [file]
        }
      })
    ).toBe(file);
    expect(
      getProductionWindowDropFile({
        dataTransfer: {
          files: []
        }
      })
    ).toBeUndefined();
    expect(getProductionWindowDropFile({})).toBeUndefined();
  });

  it("clears the drag affordance when the pointer leaves the window", () => {
    expect(shouldClearProductionWindowDrag({ relatedTarget: null })).toBe(true);
    expect(shouldClearProductionWindowDrag({ relatedTarget: new EventTarget() })).toBe(false);
  });
});
