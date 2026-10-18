import { spawn } from "node:child_process";
import { describe, expect, it } from "vitest";

async function runOwnedCommand(command: string, args: string[], timeoutMs: number) {
  return new Promise<{ status: number | null; stdout: string; stderr: string; error?: Error; closed: boolean }>((resolve) => {
    const child = spawn(command, args, { detached: true, stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "", stderr = "", error: Error | undefined;
    let bytes = 0, finished = false;
    let drain: ReturnType<typeof setTimeout> | undefined;
    const finish = (status: number | null, closed: boolean) => {
      if (finished) return;
      finished = true;
      clearTimeout(deadline);
      if (drain) clearTimeout(drain);
      resolve({ status, stdout, stderr, error, closed });
    };
    const abort = (reason: Error) => {
      error ??= reason;
      // Only this newly spawned test group is ours. Strace also owns the
      // separately sessioned tracees through its required kill-on-exit option.
      if (child.pid) {
        try { process.kill(-child.pid, "SIGKILL"); }
        catch (failure) { if ((failure as NodeJS.ErrnoException).code !== "ESRCH") error = failure as Error; }
      }
      drain ??= setTimeout(() => {
        child.stdout.destroy();
        child.stderr.destroy();
        finish(null, false);
      }, 1000);
    };
    const deadline = setTimeout(() => abort(new Error("Owned synthetic command exceeded its deadline")), timeoutMs);
    child.stdout.on("data", (chunk: Buffer) => {
      bytes += chunk.length;
      if (bytes > 2 * 1024 * 1024) return abort(new Error("Synthetic output exceeded 2 MiB"));
      stdout += chunk.toString();
    });
    child.stderr.on("data", (chunk: Buffer) => {
      bytes += chunk.length;
      if (bytes > 2 * 1024 * 1024) return abort(new Error("Synthetic output exceeded 2 MiB"));
      stderr += chunk.toString();
      process.stderr.write(chunk);
    });
    child.on("error", (failure) => { error = failure; finish(null, true); });
    child.on("close", (status) => finish(status, true));
  });
}

describe("synthetic Catering observer contracts", () => {
  it("bounds inherited output pipes and kills only its own synthetic descendants", async () => {
    const code = "require('node:child_process').spawn(process.execPath, ['-e', 'setInterval(() => {}, 1000)'], {stdio:'inherit'}); console.log('synthetic descendant started'); setInterval(() => {}, 1000);";
    const started = Date.now();
    const result = await runOwnedCommand(process.execPath, ["-e", code], 1000);
    expect(result.stdout).toContain("synthetic descendant started");
    expect(result.error?.message).toContain("exceeded its deadline");
    expect(result.closed).toBe(true);
    expect(Date.now() - started).toBeLessThan(4000);
  }, 5000);

  it("runs real local validators with simulated units and heartbeat transport", async () => {
    const result = await runOwnedCommand("python3", ["-B", "-u", "tests/catering_backup_observer_test.py"], 180000);
    expect(result.error, result.error?.message).toBeUndefined();
    expect(result.closed).toBe(true);
    expect(result.status, result.stdout + result.stderr).toBe(0);
    expect(result.stderr).toMatch(/Ran \d+ tests/);
    expect(result.stderr).not.toMatch(/skipped=/);
  }, 190000);
});
