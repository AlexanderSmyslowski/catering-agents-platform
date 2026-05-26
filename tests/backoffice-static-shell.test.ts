import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("backoffice static shell", () => {
  it("declares a served favicon so browser smokes stay console-clean", () => {
    const html = readFileSync("backoffice-ui/index.html", "utf8");

    expect(html).toContain('<link rel="icon" type="image/svg+xml" href="/favicon.svg" />');
    expect(existsSync("backoffice-ui/public/favicon.svg")).toBe(true);
  });
});
