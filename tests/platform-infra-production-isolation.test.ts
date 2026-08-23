import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, test } from "vitest";

const repoRoot = path.resolve(import.meta.dirname, "..");
const baseComposePath = path.join(repoRoot, "platform-infra/docker-compose.yml");
const productionComposePath = path.join(
  repoRoot,
  "platform-infra/docker-compose.production.yml"
);
const deployScriptPath = path.join(repoRoot, "platform-infra/scripts/deploy-hetzner.sh");

describe("production proxy isolation contract", () => {
  test("keeps the base Compose stack independent of the Zeiterfassung network", () => {
    const baseCompose = readFileSync(baseComposePath, "utf8");

    expect(baseCompose).not.toContain("zeiterfassung_default");
  });

  test("uses a production-only override for the shared proxy network attachment", () => {
    expect(existsSync(productionComposePath)).toBe(true);
    const productionCompose = readFileSync(productionComposePath, "utf8");

    expect(productionCompose).toContain("services:");
    expect(productionCompose).toMatch(/services:\s*[\s\S]*?web:\s*[\s\S]*?networks:/);
    expect(productionCompose).toContain("- default");
    expect(productionCompose).toContain("- zeiterfassung_default");
    expect(productionCompose).toMatch(
      /networks:\s*[\s\S]*?zeiterfassung_default:\s*[\s\S]*?external:\s*true/
    );
    expect(productionCompose).toContain("name: zeiterfassung_default");

    for (const service of ["postgres", "intake", "offer", "production", "exports"]) {
      expect(productionCompose).not.toMatch(new RegExp(`\\n  ${service}:`));
    }
  });

  test("fails closed if the production external network is missing", () => {
    const deployScript = readFileSync(deployScriptPath, "utf8");

    expect(deployScript).toContain("docker network inspect zeiterfassung_default");
    expect(deployScript).toContain(
      "Missing required external Docker network: zeiterfassung_default"
    );
  });

  test("renders the stable production pair read-only and mutates only through the full edge chain", () => {
    const deployScript = readFileSync(deployScriptPath, "utf8");

    expect(deployScript).toMatch(
      /docker compose\s+\\?\s*-f docker-compose\.yml\s+\\?\s*-f docker-compose\.production\.yml\s+\\?\s*config\s+>\/dev\/null/
    );
    expect(deployScript).toMatch(
      /docker compose\s+\\?\s*-f docker-compose\.yml\s+\\?\s*-f docker-compose\.production\.yml\s+\\?\s*-f docker-compose\.edge-cutover\.yml\s+\\?\s*up --build -d/
    );
    expect(deployScript).not.toMatch(/docker compose\s+down/);
    expect(deployScript).not.toMatch(/docker (?:system|network|volume) prune/);
  });
});
