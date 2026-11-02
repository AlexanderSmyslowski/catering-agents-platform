import { describe, expect, it } from "vitest";
import fastUri from "fast-uri";

describe("fast-uri security advisories", () => {
  it("does not turn a percent-encoded scheme into an active scheme", () => {
    expect(fastUri.normalize("%6Aavascript:alert(1)")).not.toMatch(/^javascript:/i);
    expect(fastUri.equal("%68ttp://a/", "http://a/")).toBe(false);
  });

  it("preserves a relative path when normalizing it", () => {
    expect(fastUri.normalize("../x")).toBe("../x");
  });

  it("escapes a first-segment colon for suffix references", () => {
    expect(fastUri.normalize("javascript:alert(1)", { reference: "suffix", scheme: "x" })).toBe("javascript%3Aalert(1)");
  });

  it("rejects an authority with an ambiguous second at-sign", () => {
    const parsed = fastUri.parse("http://a@b@evil.example/");
    expect(parsed.error).toBeTruthy();
    expect(parsed.host).not.toBe("evil.example");
  });
});
