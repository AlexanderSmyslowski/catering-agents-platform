import { spawnSync } from "node:child_process";
import { chmodSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, test } from "vitest";

const repoRoot = path.resolve(import.meta.dirname, "..");
const deployScript = path.join(repoRoot, "platform-infra/scripts/deploy-hetzner.sh");
const smokeScript = path.join(repoRoot, "platform-infra/scripts/smoke-check.sh");
const caddyfilePath = path.join(repoRoot, "platform-infra/Caddyfile");
const composePath = path.join(repoRoot, "platform-infra/docker-compose.yml");
const envExamplePath = path.join(repoRoot, "platform-infra/.env.example");
const platformReadmePath = path.join(repoRoot, "platform-infra/README.md");
const tempDirs: string[] = [];

function createTempDir(): string {
  const directory = mkdtempSync(path.join(tmpdir(), "catering-hetzner-deploy-"));
  tempDirs.push(directory);
  return directory;
}

function writeExecutable(filePath: string, content: string): void {
  writeFileSync(filePath, content, "utf8");
  chmodSync(filePath, 0o755);
}

function runDeploy(binDir: string, extraEnv: Record<string, string> = {}) {
  return spawnSync("bash", [deployScript], {
    cwd: repoRoot,
    encoding: "utf8",
    env: {
      ...process.env,
      PATH: `${binDir}:${process.env.PATH ?? ""}`,
      DEPLOY_HOST: "deployment.test",
      DEPLOY_BASE_URL: "http://deployment.test",
      ...extraEnv
    }
  });
}

afterEach(() => {
  for (const directory of tempDirs.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
});

describe("Hetzner deployment script", () => {
  test("stops before rsync when the remote environment file is missing", () => {
    const root = createTempDir();
    const binDir = path.join(root, "bin");
    const callLog = path.join(root, "calls.log");
    mkdirSync(binDir);
    writeFileSync(callLog, "", "utf8");
    writeExecutable(
      path.join(binDir, "ssh"),
      "#!/usr/bin/env bash\necho ssh >> \"$CALL_LOG\"\nexit 23\n"
    );
    writeExecutable(
      path.join(binDir, "rsync"),
      "#!/usr/bin/env bash\necho rsync >> \"$CALL_LOG\"\nexit 0\n"
    );

    const result = runDeploy(binDir, { CALL_LOG: callLog });

    expect(result.status).not.toBe(0);
    expect(readFileSync(callLog, "utf8")).toBe("ssh\n");
    expect(`${result.stdout}${result.stderr}`).toContain("Missing platform-infra/.env on server");
  });

  test("excludes the server-only environment file from repository synchronization", () => {
    const root = createTempDir();
    const binDir = path.join(root, "bin");
    const rsyncLog = path.join(root, "rsync.log");
    const sshLog = path.join(root, "ssh.log");
    mkdirSync(binDir);
    writeFileSync(sshLog, "", "utf8");
    writeExecutable(
      path.join(binDir, "ssh"),
      "#!/usr/bin/env bash\nprintf '%s\\n' \"$*\" >> \"$SSH_LOG\"\nexit 0\n"
    );
    writeExecutable(
      path.join(binDir, "rsync"),
      "#!/usr/bin/env bash\nprintf '%s\\n' \"$@\" > \"$RSYNC_LOG\"\nexit 0\n"
    );
    writeExecutable(
      path.join(binDir, "curl"),
      "#!/usr/bin/env bash\nprintf '{\"status\":\"ok\"}'\nexit 0\n"
    );

    const result = runDeploy(binDir, {
      DEPLOY_RSYNC_PATH: "sudo rsync",
      RSYNC_LOG: rsyncLog,
      SSH_LOG: sshLog
    });

    expect(result.status).toBe(0);
    const rsyncArguments = readFileSync(rsyncLog, "utf8");
    expect(rsyncArguments).toContain("platform-infra/.env");
    expect(rsyncArguments).toContain("platform-infra/sites");
    expect(rsyncArguments).toContain("--rsync-path=sudo rsync");
    expect(readFileSync(sshLog, "utf8")).toContain(
      "sudo chmod 755 '/opt/catering-agents-platform'"
    );
  });

  test("rejects an HTML fallback returned from a health endpoint", () => {
    const root = createTempDir();
    const binDir = path.join(root, "bin");
    mkdirSync(binDir);
    writeExecutable(
      path.join(binDir, "curl"),
      "#!/usr/bin/env bash\nprintf '<!doctype html><title>Catering</title>'\nexit 0\n"
    );

    const result = spawnSync("bash", [smokeScript, "https://deployment.test"], {
      cwd: repoRoot,
      encoding: "utf8",
      env: {
        ...process.env,
        PATH: `${binDir}:${process.env.PATH ?? ""}`
      }
    });

    expect(result.status).not.toBe(0);
    expect(`${result.stdout}${result.stderr}`).toContain("did not return service status ok");
  });

  test("retries a transient health failure during service startup", () => {
    const root = createTempDir();
    const binDir = path.join(root, "bin");
    const curlCount = path.join(root, "curl-count");
    mkdirSync(binDir);
    writeFileSync(curlCount, "0\n", "utf8");
    writeExecutable(
      path.join(binDir, "curl"),
      [
        "#!/usr/bin/env bash",
        "count=$(cat \"$CURL_COUNT\")",
        "count=$((count + 1))",
        "printf '%s\\n' \"$count\" > \"$CURL_COUNT\"",
        "if [[ \"$count\" -eq 4 ]]; then exit 22; fi",
        "printf '{\"status\":\"ok\"}'"
      ].join("\n") + "\n"
    );

    const result = spawnSync("bash", [smokeScript, "https://deployment.test"], {
      cwd: repoRoot,
      encoding: "utf8",
      env: {
        ...process.env,
        CURL_COUNT: curlCount,
        PATH: `${binDir}:${process.env.PATH ?? ""}`,
        SMOKE_MAX_ATTEMPTS: "2",
        SMOKE_RETRY_DELAY_SECONDS: "0"
      }
    });

    expect(result.status).toBe(0);
    expect(readFileSync(curlCount, "utf8")).toBe("8\n");
  });

  test("authenticates smoke requests without printing the password", () => {
    const root = createTempDir();
    const binDir = path.join(root, "bin");
    const curlLog = path.join(root, "curl.log");
    mkdirSync(binDir);
    writeFileSync(curlLog, "", "utf8");
    writeExecutable(
      path.join(binDir, "curl"),
      "#!/usr/bin/env bash\nprintf '%s\\n' \"$@\" >> \"$CURL_LOG\"\nprintf '{\"status\":\"ok\"}'\n"
    );

    const result = spawnSync("bash", [smokeScript, "https://deployment.test"], {
      cwd: repoRoot,
      encoding: "utf8",
      env: {
        ...process.env,
        CURL_LOG: curlLog,
        PATH: `${binDir}:${process.env.PATH ?? ""}`,
        SMOKE_BASIC_AUTH_USER: "alexander",
        SMOKE_BASIC_AUTH_PASSWORD: "test-login-secret"
      }
    });

    expect(result.status).toBe(0);
    expect(readFileSync(curlLog, "utf8")).toContain("alexander:test-login-secret");
    expect(`${result.stdout}${result.stderr}`).not.toContain("test-login-secret");
  });

  test("fails closed when only half of the smoke login is configured", () => {
    const root = createTempDir();
    const binDir = path.join(root, "bin");
    mkdirSync(binDir);
    writeExecutable(
      path.join(binDir, "curl"),
      "#!/usr/bin/env bash\nprintf '{\"status\":\"ok\"}'\n"
    );

    const result = spawnSync("bash", [smokeScript, "https://deployment.test"], {
      cwd: repoRoot,
      encoding: "utf8",
      env: {
        ...process.env,
        PATH: `${binDir}:${process.env.PATH ?? ""}`,
        SMOKE_BASIC_AUTH_USER: "alexander",
        SMOKE_BASIC_AUTH_PASSWORD: ""
      }
    });

    expect(result.status).not.toBe(0);
    expect(`${result.stdout}${result.stderr}`).toContain(
      "SMOKE_BASIC_AUTH_USER and SMOKE_BASIC_AUTH_PASSWORD must be set together"
    );
  });

  test("keeps API handlers ahead of the SPA fallback in an explicit Caddy route", () => {
    const caddyfile = readFileSync(caddyfilePath, "utf8");

    expect(caddyfile).toMatch(
      /route\s*\{[\s\S]*handle_path \/api\/intake\/\*[\s\S]*handle\s*\{[\s\S]*try_files/
    );
  });

  test("does not expose Intake internal reader routes through the browser proxy", () => {
    const caddyfile = readFileSync(caddyfilePath, "utf8");
    const internalBlock = caddyfile.indexOf("@intakeInternal path /api/intake/v1/intake/internal/*");
    const intakeProxy = caddyfile.indexOf("handle_path /api/intake/*");

    expect(internalBlock).toBeGreaterThan(-1);
    expect(caddyfile.slice(internalBlock, intakeProxy)).toContain("respond @intakeInternal 404");
    expect(internalBlock).toBeLessThan(intakeProxy);
  });

  test("connects production to Intake only through the internal service URL", () => {
    const compose = readFileSync(composePath, "utf8");
    const productionService = compose.slice(
      compose.indexOf("  production:"),
      compose.indexOf("  exports:")
    );

    expect(productionService).toContain("CATERING_INTAKE_SERVICE_URL: http://intake:3101");
    expect(productionService).toMatch(/depends_on:[\s\S]*intake:[\s\S]*condition: service_started/);
  });

  test("connects Offer to Intake before document-backed drafts can be served", () => {
    const compose = readFileSync(composePath, "utf8");
    const offerService = compose.slice(
      compose.indexOf("  offer:"),
      compose.indexOf("  production:")
    );

    expect(offerService).toContain("CATERING_INTAKE_SERVICE_URL: http://intake:3101");
    expect(offerService).toMatch(/depends_on:[\s\S]*intake:[\s\S]*condition: service_started/);
  });

  test("uses the fixed server-owned Caddy directory protected by deployment sync", () => {
    const caddyfile = readFileSync(caddyfilePath, "utf8");
    const compose = readFileSync(composePath, "utf8");
    const envExample = readFileSync(envExamplePath, "utf8");
    const readme = readFileSync(platformReadmePath, "utf8");

    expect(caddyfile).toContain("import /etc/caddy/sites/*.caddy");
    expect(compose).toContain("./sites:/etc/caddy/sites:ro");
    expect(compose).not.toContain("CADDY_SITES_DIR");
    expect(envExample).not.toContain("CADDY_SITES_DIR");
    expect(readme).not.toContain("CADDY_SITES_DIR");
    expect(readme).toContain("platform-infra/sites");
  });

  test("protects the site and replaces browser identity headers with route-scoped actors", () => {
    const caddyfile = readFileSync(caddyfilePath, "utf8");

    expect(caddyfile).toContain("basic_auth");
    expect(caddyfile).toContain("{$CATERING_BASIC_AUTH_USER} {$CATERING_BASIC_AUTH_PASSWORD_HASH}");
    expect(caddyfile).toContain("header_up -Authorization");
    expect(caddyfile).toContain("header_up -X-Actor-Name");
    expect(caddyfile).toContain("header_up -X-Catering-Business-Id");
    expect(caddyfile).not.toContain("header_up -X-Catering-Actor-Name");
    expect(caddyfile).not.toContain("header_up -X-Catering-Trusted-Secret");
    expect(caddyfile).toContain("header_up X-Catering-Actor-Name {args[0]}");
    expect(caddyfile).toContain("header_up X-Catering-Trusted-Secret {$CATERING_TRUSTED_ACTOR_SECRET}");
    expect(caddyfile).toContain("header_up X-Catering-Business-Id {$CATERING_DEFAULT_BUSINESS_ID}");
    expect(caddyfile).toContain('import trusted_actor_headers "Intake-Mitarbeiter"');
    expect(caddyfile).toContain('import trusted_actor_headers "Angebots-Mitarbeiter"');
    expect(caddyfile).toContain('import trusted_actor_headers "Produktions-Mitarbeiter"');
    expect(caddyfile).toContain('import trusted_actor_headers "Betriebs-/Audit-Operator"');
  });

  test("requires the trusted proxy secret in every runtime service", () => {
    const compose = readFileSync(composePath, "utf8");

    expect(compose.match(/^\s+CATERING_TRUSTED_ACTOR_SECRET:/gm)).toHaveLength(5);
    expect(compose).toContain(
      "CATERING_BASIC_AUTH_USER: ${CATERING_BASIC_AUTH_USER:?Set CATERING_BASIC_AUTH_USER}"
    );
    expect(compose).toContain(
      "CATERING_BASIC_AUTH_PASSWORD_HASH: ${CATERING_BASIC_AUTH_PASSWORD_HASH:?Set CATERING_BASIC_AUTH_PASSWORD_HASH}"
    );
  });
});
