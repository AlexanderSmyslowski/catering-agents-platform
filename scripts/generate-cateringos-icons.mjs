import { readFileSync, writeFileSync } from "node:fs";
import { Resvg } from "@resvg/resvg-js";

const args = process.argv.slice(2);
if (args.length > 1 || (args.length === 1 && args[0] !== "--check")) {
  throw new Error("Usage: node scripts/generate-cateringos-icons.mjs [--check]");
}
const check = args[0] === "--check";
const publicRoot = new URL("../backoffice-ui/public/", import.meta.url);
const master = readFileSync(new URL("favicon.svg", publicRoot));

// Keep the approved geometry intact at every size; the SVG is also the favicon master.
for (const [name, size] of [
  ["favicon-32.png", 32],
  ["apple-touch-icon.png", 180],
  ["icon-192.png", 192],
  ["icon-512.png", 512]
]) {
  const rendered = new Resvg(master, { fitTo: { mode: "width", value: size }, font: { loadSystemFonts: false } }).render();
  if (rendered.width !== size || rendered.height !== size) throw new Error(`Invalid icon dimensions: ${name}`);
  const png = rendered.asPng();
  const target = new URL(name, publicRoot);
  if (check) {
    if (!png.equals(readFileSync(target))) throw new Error(`Icon differs from SVG master: ${name}`);
  } else {
    writeFileSync(target, png);
  }
  console.log(`${check ? "Verified" : "Generated"} ${name} (${size}x${size})`);
}
