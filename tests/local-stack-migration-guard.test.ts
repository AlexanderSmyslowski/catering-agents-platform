import {
  chmodSync,
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  writeFileSync
} from "node:fs";
import { rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { afterEach, describe, expect, it } from "vitest";

const roots: string[] = [];

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

describe("local stack migration guard", () => {
  it("refuses to migrate while an existing local stack session can still write legacy data", () => {
    const root = mkdtempSync(path.join(tmpdir(), "catering-local-stack-migration-guard-"));
    roots.push(root);
    const scriptsDir = path.join(root, "scripts");
    const binDir = path.join(root, "bin");
    const npmMarker = path.join(root, "npm-called");
    mkdirSync(scriptsDir, { recursive: true });
    mkdirSync(binDir, { recursive: true });
    const startScript = path.join(scriptsDir, "start-local-stack.sh");
    copyFileSync("scripts/start-local-stack.sh", startScript);

    const screen = path.join(binDir, "screen");
    writeFileSync(screen, [
      "#!/bin/sh",
      "if [ \"${1:-}\" = \"-ls\" ]; then",
      "  printf 'There is a screen on:\\n\\t123.catering-production\\t(Detached)\\n'",
      "fi"
    ].join("\n"));
    chmodSync(screen, 0o755);

    const npm = path.join(binDir, "npm");
    writeFileSync(npm, `#!/bin/sh\nprintf called >${JSON.stringify(npmMarker)}\nexit 99\n`);
    chmodSync(npm, 0o755);

    const result = spawnSync("bash", [startScript], {
      cwd: root,
      encoding: "utf8",
      env: {
        ...process.env,
        PATH: `${binDir}:${process.env.PATH ?? ""}`,
        CATERING_DATA_ROOT: path.join(root, "data")
      }
    });

    expect(result.status).toBe(1);
    expect(result.stderr).toContain("npm run local:stop");
    expect(existsSync(npmMarker)).toBe(false);
  });
});
