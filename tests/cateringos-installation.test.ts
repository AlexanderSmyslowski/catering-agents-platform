import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { JSDOM } from "jsdom";
import { describe, expect, it } from "vitest";

const publicRoot = path.resolve("backoffice-ui/public");
const html = () => new JSDOM(readFileSync("backoffice-ui/index.html", "utf8")).window.document;
const manifest = () => JSON.parse(readFileSync(path.join(publicRoot, "manifest.webmanifest"), "utf8"));
const asset = (url: string) => {
  expect(url).toMatch(/^\/(?!\/)/);
  const resolved = path.resolve(publicRoot, `.${url}`);
  expect(resolved.startsWith(`${publicRoot}${path.sep}`)).toBe(true);
  expect(existsSync(resolved)).toBe(true);
  return resolved;
};

describe("CateringOS installation contract", () => {
  it("exposes the app identity and a credentialed manifest to browsers before login", () => {
    const document = html();
    expect(document.title).toBe("CateringOS");
    const link = document.querySelector('link[rel="manifest"]');
    expect(link?.getAttribute("href")).toBe("/manifest.webmanifest");
    expect(link?.getAttribute("crossorigin")).toBe("use-credentials");
    expect(document.querySelector('meta[name="theme-color"]')?.getAttribute("content")).toMatch(/^#[0-9a-f]{6}$/i);
    expect(document.querySelector('meta[name="viewport"]')?.getAttribute("content")).toBe("width=device-width, initial-scale=1.0");
    for (const [name, content] of [
      ["apple-mobile-web-app-title", "CateringOS"],
      ["apple-mobile-web-app-capable", "yes"],
      ["apple-mobile-web-app-status-bar-style", "default"]
    ]) {
      expect(document.querySelector(`meta[name="${name}"]`)?.getAttribute("content")).toBe(content);
    }
  });

  it("launches the existing root in a standalone window and keeps every product route in scope", () => {
    expect(existsSync(path.join(publicRoot, "manifest.webmanifest"))).toBe(true);
    const app = manifest();
    expect(app).toMatchObject({ name: "CateringOS", short_name: "CateringOS", id: "/", start_url: "/", scope: "/", display: "standalone" });
    for (const origin of ["https://catering.the-one.catering", "http://localhost:3200"]) {
      const start = new URL(app.start_url, origin);
      const scope = new URL(app.scope, origin);
      expect(start.origin).toBe(origin);
      expect(start.search).toBe("");
      for (const route of ["/", "/angebot", "/produktion"]) {
        expect(new URL(route, origin).pathname.startsWith(scope.pathname)).toBe(true);
      }
    }
    expect(app.theme_color).toBe(html().querySelector('meta[name="theme-color"]')?.getAttribute("content"));
    expect(app.background_color).toMatch(/^#[0-9a-f]{6}$/i);
    expect(app.prefer_related_applications).not.toBe(true);
  });

  it("provides real PNGs at the declared install, Apple touch and fallback favicon sizes", () => {
    expect(existsSync(path.join(publicRoot, "manifest.webmanifest"))).toBe(true);
    const app = manifest();
    expect(app.icons.map((icon: { sizes: string }) => icon.sizes)).toEqual(expect.arrayContaining(["192x192", "512x512"]));
    const document = html();
    const icons = [
      ...app.icons,
      { src: document.querySelector('link[rel="apple-touch-icon"]')?.getAttribute("href"), sizes: "180x180", type: "image/png", purpose: "any" },
      { src: document.querySelector('link[rel="icon"][type="image/png"]')?.getAttribute("href"), sizes: "32x32", type: "image/png", purpose: "any" }
    ];
    for (const icon of icons) {
      expect(icon.type).toBe("image/png");
      expect(icon.purpose).toBe("any");
      const bytes = readFileSync(asset(icon.src));
      expect(bytes.subarray(0, 8)).toEqual(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
      const [width, height] = icon.sizes.split("x").map(Number);
      expect(bytes.readUInt32BE(16)).toBe(width);
      expect(bytes.readUInt32BE(20)).toBe(height);
    }
    asset(document.querySelector('link[rel="icon"][type="image/svg+xml"]')!.getAttribute("href")!);
  });

  it("keeps every raster asset reproducible from the approved SVG master", () => {
    expect(existsSync("scripts/generate-cateringos-icons.mjs")).toBe(true);
    expect(() => execFileSync(process.execPath, ["scripts/generate-cateringos-icons.mjs", "--check"], { stdio: "pipe" })).not.toThrow();
  });
});
