import { createHash } from "node:crypto";
import { chmodSync, copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";

const roots: string[] = [];
function executable(file: string, content: string): void {
  writeFileSync(file, `#!/bin/bash\n${content}\n`);
  chmodSync(file, 0o755);
}
function harness() {
  const root = realpathSync(mkdtempSync(path.join(tmpdir(), "catering-owner.[test]-")));
  roots.push(root);
  const bin = path.join(root, "bin");
  mkdirSync(bin);
  mkdirSync(path.join(root, "scripts"));
  mkdirSync(path.join(root, ".runtime/local-stack"), { recursive: true });
  for (const name of ["start", "stop", "status"]) {
    copyFileSync(`scripts/${name}-local-stack.sh`, path.join(root, `scripts/${name}-local-stack.sh`));
  }
  const namespace = `catering-${createHash("sha256").update(root).digest("hex").slice(0, 24)}`;
  const events = path.join(root, "events");
  writeFileSync(events, "");
  // Keep all process and supervisor effects inside the harness, including bash's kill builtin.
  const bashEnv = path.join(root, "bash-env");
  writeFileSync(bashEnv, 'kill() { printf "kill:%s\\n" "$*" >>"$EVENTS"; }\n');
  executable(path.join(bin, "screen"), 'if [[ "$1" == "-ls" ]]; then cat "$SCREEN_LIST"; else printf "screen:%s\\n" "$*" >>"$EVENTS"; fi');
  executable(path.join(bin, "launchctl"), 'printf "launchctl:%s\\n" "$*" >>"$EVENTS"; exit 1');
  executable(path.join(bin, "rm"), 'printf "rm:%s\\n" "$*" >>"$EVENTS"');
  executable(path.join(bin, "sleep"), "exit 0");
  executable(path.join(bin, "curl"), "exit 1");
  executable(path.join(bin, "pgrep"), 'printf "901\\n902\\n903\\n"');
  executable(path.join(bin, "ps"), 'cat "$PROCESS_LIST"');
  executable(path.join(bin, "lsof"), 'case "$*" in *"-p 901"*) printf "n%s\\n" "$OWNER_ROOT" ;; *"-p 902"*) printf "n%s/.worktrees/foreign\\n" "$OWNER_ROOT" ;; *"-p 903"*) printf "n%s\\n" "$OWNER_ROOT" ;; *) exit 1 ;; esac');
  const screenList = path.join(root, "screens");
  writeFileSync(screenList, `  101.catering-production\t(Detached)\n  102.${namespace}-production\t(Detached)\n  103.${namespace}-production-other\t(Detached)\n  104.catering-foreign-ui\t(Detached)\n`);
  const processList = path.join(root, "processes");
  writeFileSync(processList, `901 node ${root}/node_modules/tsx/dist/cli.mjs production-service/src/server.ts\n902 node ${root}/node_modules/tsx/dist/cli.mjs production-service/src/server.ts\n903 node ${root}/.worktrees/foreign/node_modules/tsx/dist/cli.mjs production-service/src/server.ts\n`);
  const marker = path.join(root, ".runtime/local-stack/data-root.txt");
  const data = path.join(root, "synthetic-data.json");
  writeFileSync(data, '{"fixture":"preserve"}\n');
  writeFileSync(marker, `${data}\n`);
  return { root, namespace, events, marker, data, env: { ...process.env, PATH: `${bin}:${process.env.PATH}`, BASH_ENV: bashEnv, EVENTS: events, SCREEN_LIST: screenList, PROCESS_LIST: processList, OWNER_ROOT: root } };
}
afterEach(() => {
  for (const root of roots.splice(0)) spawnSync("/usr/bin/trash", [root]);
});
describe("local stack ownership", () => {
  it("starts all services in the same namespace used by status and stop", () => {
    const h = harness();
    writeFileSync(h.env.SCREEN_LIST, "");
    writeFileSync(h.env.PROCESS_LIST, "");
    executable(path.join(h.root, "bin/node"), "exit 0");
    const result = spawnSync("bash", [path.join(h.root, "scripts/start-local-stack.sh")], {
      env: {
        ...h.env,
        CATERING_LLM_PROVIDER: "fixture",
        CATERING_DATA_ROOT: path.join(h.root, "fresh-data"),
        CATERING_LOCAL_START_LOCK_FILE: path.join(h.root, "startup.lock"),
        CATERING_LOCAL_START_ATTEMPTS: "1"
      },
      encoding: "utf8"
    });
    // Fake screen records launches without executing commands; health must remain unavailable.
    expect(result.status, result.stderr).toBe(1);
    expect(result.stderr).toContain("Intake wurde nicht rechtzeitig erreichbar");
    const events = readFileSync(h.events, "utf8");
    const launched = [...events.matchAll(/^screen:-dmS (\S+) /gm)].map((match) => match[1]);
    expect(launched).toEqual(["intake", "offer", "production", "exports", "ui"].map((service) => `${h.namespace}-${service}`));
  });
  it("stops only its exact worktree sessions and orphan service processes, preserving foreign supervisors and data", () => {
    const h = harness();
    const result = spawnSync("bash", [path.join(h.root, "scripts/stop-local-stack.sh")], { env: h.env, encoding: "utf8" });
    expect(result.status, result.stderr).toBe(0);
    const events = readFileSync(h.events, "utf8");
    expect(events).not.toMatch(/launchctl:|rm:/);
    expect(events.split("\n").filter((line) => line.startsWith("screen:"))).toEqual([`screen:-S 102.${h.namespace}-production -X quit`]);
    expect(events.split("\n").filter((line) => line.startsWith("kill:"))).toEqual(["kill:901"]);
    expect(readFileSync(h.data, "utf8")).toBe('{"fixture":"preserve"}\n');
    if (process.platform === "darwin") expect(existsSync(h.marker)).toBe(false);
  });
  it("reports only the owning worktree screen sessions", () => {
    const h = harness();
    const result = spawnSync("bash", [path.join(h.root, "scripts/status-local-stack.sh")], { env: h.env, encoding: "utf8" });
    expect(result.status, result.stderr).toBe(0);
    expect(result.stdout).toContain(`Produktion: läuft in screen (${h.namespace}-production)`);
    expect(result.stdout).toContain("UI: gestoppt");
  });
});
