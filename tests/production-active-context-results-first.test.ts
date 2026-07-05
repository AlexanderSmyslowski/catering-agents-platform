import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const styles = readFileSync("backoffice-ui/src/styles.css", "utf8");

function orderFor(selector: string): number {
  const escapedSelector = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = new RegExp(`${escapedSelector}\\s*\\{[^}]*order:\\s*(-?\\d+);`, "m").exec(styles);
  if (!match?.[1]) {
    throw new Error(`Missing order rule for ${selector}`);
  }
  return Number(match[1]);
}

describe("production active context upload-first layout", () => {
  it("keeps the upload composer before active production context and utility zones", () => {
    expect(orderFor(".production-conversation-layout--active-context .production-composer")).toBe(0);
    expect(orderFor(".production-conversation-layout--active-context .production-calm-summary")).toBe(1);
    expect(orderFor(".production-conversation-layout--active-context .production-progressive-zone")).toBe(2);
    expect(orderFor(".production-conversation-layout--active-context .production-objects-zone")).toBe(3);
    expect(orderFor(".production-conversation-layout--active-context .production-purchase-zone")).toBe(4);
    expect(orderFor(".production-conversation-layout--active-context .production-lower-zones")).toBe(5);
  });
});
