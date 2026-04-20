import { mkdtempSync, readFileSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { describe, expect, it } from "vitest";

const repoRoot = path.resolve(__dirname, "..");

function createAuditDir(): string {
  return mkdtempSync(path.join(tmpdir(), "catering-agents-cli-audit-"));
}

function runCli(args: string[], auditDir: string) {
  return spawnSync("npm", ["run", "start:cli", "--", ...args], {
    cwd: repoRoot,
    env: {
      ...process.env,
      CLI_AUDIT_LOG_DIR: auditDir
    },
    encoding: "utf8"
  });
}

function readSingleAuditEntry(auditDir: string) {
  const files = readdirSync(auditDir).filter((file) => file.endsWith(".json"));
  expect(files).toHaveLength(1);
  expect(files[0]).toMatch(/^run-\d{4}-\d{2}-\d{2}-\d{6}-\d{3}.*\.json$/);

  const filePath = path.join(auditDir, files[0]);
  return {
    fileName: files[0],
    entry: JSON.parse(readFileSync(filePath, "utf8"))
  };
}

describe("CLI audit logging", () => {
  it("writes a structured audit log for a completed CLI run", () => {
    const auditDir = createAuditDir();
    const text =
      "Konferenz am 2026-09-18 fuer 120 Teilnehmer mit Lunchbuffet, Caesar Salad Buffet und Filterkaffee Station.";

    try {
      const result = runCli(["--text", text], auditDir);

      expect(result.status).toBe(0);
      const { entry } = readSingleAuditEntry(auditDir);

      expect(entry.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
      expect(entry.mode).toBe("text");
      expect(entry.input.rawArgv).toEqual(["--text", text]);
      expect(entry.input.parameters).toMatchObject({
        mode: "text",
        text
      });
      expect(entry.normalization.readiness.status).toBe("complete");
      expect(Array.isArray(entry.normalization.assumptions)).toBe(true);
      expect(Array.isArray(entry.normalization.uncertainties)).toBe(true);
      expect(entry.finalResult.status).toBe("completed");
      expect(entry.finalResult.productionPlan).toMatchObject({
        readiness: expect.any(Object),
        isFallback: expect.any(Boolean)
      });
      expect(entry.finalResult.purchaseList).toMatchObject({
        itemCount: expect.any(Number),
        groupCount: expect.any(Number)
      });
    } finally {
      rmSync(auditDir, { recursive: true, force: true });
    }
  });

  it("writes a structured audit log even when the CLI run aborts", () => {
    const auditDir = createAuditDir();

    try {
      const result = runCli([], auditDir);

      expect(result.status).toBe(1);
      const { entry } = readSingleAuditEntry(auditDir);

      expect(entry.mode).toBe("text");
      expect(entry.input.parameters.mode).toBe("text");
      expect(entry.finalResult.status).toBe("aborted");
      expect(entry.finalResult.reason).toContain("Freitext-Anfrage");
      expect(entry.normalization).toBeUndefined();
    } finally {
      rmSync(auditDir, { recursive: true, force: true });
    }
  });
});
