import { spawnSync } from "node:child_process";
import {
  accessSync,
  constants,
  existsSync,
  mkdtempSync,
  readFileSync,
  readdirSync
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  createTestSafeCateringPinReader,
  resolveManageCateringUserStorageOptions,
  runManageCateringUserCommand,
  type ManageCateringUserCommandDependencies
} from "../scripts/manage-catering-user.js";
import { isMinimalMvpRole } from "../shared-core/src/access-control.js";
import { verifyCateringPin } from "../shared-core/src/catering-pin-crypto.js";
import { CateringUserStore } from "../shared-core/src/catering-user-store.js";

const businessId = "the-one";
const originalPin = "482731";
const replacementPin = "947162";
const repositoryRoot = path.resolve(import.meta.dirname, "..");

class TextSink {
  value = "";

  write(chunk: string | Uint8Array): boolean {
    this.value += typeof chunk === "string" ? chunk : Buffer.from(chunk).toString("utf8");
    return true;
  }
}

function commandHarness(pin?: string) {
  const dataRoot = mkdtempSync(path.join(tmpdir(), "manage-catering-user-command-"));
  const stdout = new TextSink();
  const stderr = new TextSink();
  const dependencies: ManageCateringUserCommandDependencies = {
    env: {
      CATERING_DEFAULT_BUSINESS_ID: businessId,
      CATERING_DATA_ROOT: dataRoot
    },
    stdout,
    stderr,
    now: () => new Date("2026-08-28T10:00:00.000Z"),
    ...(pin === undefined ? {} : { pinReader: createTestSafeCateringPinReader(async () => pin) })
  };

  return {
    dataRoot,
    stdout,
    stderr,
    dependencies,
    run: (argv: readonly string[]) => runManageCateringUserCommand(argv, dependencies),
    store: new CateringUserStore({ rootDir: dataRoot })
  };
}

function createArgs(loginCode = "admin") {
  return [
    "create",
    "--login-code", loginCode,
    "--display-name", "Admin Test",
    "--role", "admin"
  ] as const;
}

function successLines(value: string): Array<Record<string, unknown>> {
  return value
    .trim()
    .split("\n")
    .filter(Boolean)
    .map((line) => JSON.parse(line) as Record<string, unknown>);
}

describe("manage Catering user command", () => {
  it("targets the same explicit database or file store as the Catering services", () => {
    expect(resolveManageCateringUserStorageOptions({
      CATERING_DATABASE_URL: " postgresql://catering.example/gate_b "
    })).toEqual({ databaseUrl: "postgresql://catering.example/gate_b" });

    expect(resolveManageCateringUserStorageOptions({
      CATERING_DATABASE_URL: "postgresql://catering.example/primary",
      DATABASE_URL: "postgresql://catering.example/fallback",
      CATERING_DATA_ROOT: "/srv/catering/data"
    })).toEqual({ databaseUrl: "postgresql://catering.example/primary" });

    expect(resolveManageCateringUserStorageOptions({
      DATABASE_URL: " postgresql://catering.example/fallback "
    })).toEqual({ databaseUrl: "postgresql://catering.example/fallback" });

    expect(resolveManageCateringUserStorageOptions({
      CATERING_DATA_ROOT: " /srv/catering/data "
    })).toEqual({
      rootDir: "/srv/catering/data",
      databaseUrl: ""
    });

    expect(() => resolveManageCateringUserStorageOptions({})).toThrow(
      "Catering-Benutzerverwaltung fehlgeschlagen."
    );
  });

  it("uses an npm-free launcher that cannot echo or log a rejected argv PIN", async () => {
    const packageJson = JSON.parse(
      readFileSync(path.join(repositoryRoot, "package.json"), "utf8")
    ) as { scripts?: Record<string, string> };
    expect(packageJson.scripts?.["manage:catering-user"]).toBeUndefined();

    const launcher = path.join(repositoryRoot, "scripts", "manage-catering-user");
    expect(() => accessSync(launcher, constants.X_OK)).not.toThrow();
    const dataRoot = mkdtempSync(path.join(tmpdir(), "manage-catering-user-entrypoint-"));
    const foreignCwd = mkdtempSync(path.join(tmpdir(), "manage-catering-user-cwd-"));
    const npmCache = mkdtempSync(path.join(tmpdir(), "manage-catering-user-npm-cache-"));
    const result = spawnSync(
      launcher,
      [...createArgs(), "--pin", originalPin],
      {
        cwd: foreignCwd,
        encoding: "utf8",
        env: {
          PATH: process.env.PATH ?? "",
          NPM_CONFIG_CACHE: npmCache,
          CATERING_DEFAULT_BUSINESS_ID: businessId,
          CATERING_DATA_ROOT: dataRoot
        }
      }
    );

    expect(result.status).toBe(1);
    expect(`${result.stdout}${result.stderr}`).toBe(`${JSON.stringify({ status: "error" })}\n`);
    expect(`${result.stdout}${result.stderr}`).not.toContain(originalPin);
    expect(existsSync(path.join(npmCache, "_logs"))
      ? readdirSync(path.join(npmCache, "_logs"))
      : []).toEqual([]);
    await expect(new CateringUserStore({ rootDir: dataRoot }).findByLoginCode(
      { businessId },
      "admin"
    )).resolves.toEqual({ kind: "missing" });
  });

  it("rejects a PIN supplied through argv without reading or persisting it", async () => {
    let readerCalls = 0;
    const harness = commandHarness();
    harness.dependencies.pinReader = createTestSafeCateringPinReader(async () => {
      readerCalls += 1;
      return originalPin;
    });

    await expect(harness.run([...createArgs(), "--pin", originalPin])).resolves.toBe(1);

    expect(readerCalls).toBe(0);
    await expect(harness.store.findByLoginCode({ businessId }, "admin")).resolves.toEqual({ kind: "missing" });
    expect(`${harness.stdout.value}${harness.stderr.value}`).not.toContain(originalPin);
  });

  it("rejects a PIN supplied through the environment without reading or persisting it", async () => {
    let readerCalls = 0;
    const harness = commandHarness();
    harness.dependencies.env = {
      ...harness.dependencies.env,
      CATERING_PIN: originalPin
    };
    harness.dependencies.pinReader = createTestSafeCateringPinReader(async () => {
      readerCalls += 1;
      return replacementPin;
    });

    await expect(harness.run(createArgs())).resolves.toBe(1);

    expect(readerCalls).toBe(0);
    await expect(harness.store.findByLoginCode({ businessId }, "admin")).resolves.toEqual({ kind: "missing" });
    expect(`${harness.stdout.value}${harness.stderr.value}`).not.toContain(originalPin);
  });

  it("fails closed for non-TTY PIN input unless a test injects the explicit safe reader", async () => {
    const blocked = commandHarness();
    blocked.dependencies.stdin = { isTTY: false };

    await expect(blocked.run(createArgs())).resolves.toBe(1);
    await expect(blocked.store.findByLoginCode({ businessId }, "admin")).resolves.toEqual({ kind: "missing" });

    const injected = commandHarness(originalPin);
    await expect(injected.run(createArgs())).resolves.toBe(0);
    await expect(injected.store.findByLoginCode({ businessId }, "admin")).resolves.toMatchObject({
      kind: "unique",
      user: {
        loginCodeCanonical: "admin",
        displayName: "Admin Test",
        role: "admin",
        active: true,
        authEpoch: 0
      }
    });
  });

  it("rejects duplicate canonical login codes without exposing either PIN or the stored hash", async () => {
    const harness = commandHarness(originalPin);
    await expect(harness.run(createArgs(" Admin "))).resolves.toBe(0);
    const found = await harness.store.findByLoginCode({ businessId }, "admin");
    if (found.kind !== "unique") throw new Error("expected the first user");

    harness.dependencies.pinReader = createTestSafeCateringPinReader(async () => replacementPin);
    await expect(harness.run(createArgs("ADMIN"))).resolves.toBe(1);

    const output = `${harness.stdout.value}${harness.stderr.value}`;
    expect(output).not.toContain(originalPin);
    expect(output).not.toContain(replacementPin);
    expect(output).not.toContain(found.user.pinHash);
  });

  it("uses canonical roles and the User Store security CAS for role, PIN and active updates", async () => {
    const harness = commandHarness(originalPin);
    await expect(harness.run(createArgs("operator"))).resolves.toBe(0);
    const created = await harness.store.findByLoginCode({ businessId }, "operator");
    if (created.kind !== "unique") throw new Error("expected created user");

    await expect(harness.run([
      "set-role", "--user-id", created.user.userId, "--role", "production_operator"
    ])).resolves.toBe(0);
    const afterRole = await harness.store.getById({ businessId }, created.user.userId);
    expect(afterRole).toMatchObject({ role: "production_operator", authEpoch: 1 });

    harness.dependencies.pinReader = createTestSafeCateringPinReader(async () => replacementPin);
    await expect(harness.run([
      "set-pin", "--user-id", created.user.userId
    ])).resolves.toBe(0);
    const afterPin = await harness.store.getById({ businessId }, created.user.userId);
    expect(afterPin).toMatchObject({ authEpoch: 2 });
    if (!afterPin) throw new Error("expected user after PIN update");
    await expect(verifyCateringPin(replacementPin, afterPin.pinHash)).resolves.toBe(true);
    await expect(verifyCateringPin(originalPin, afterPin.pinHash)).resolves.toBe(false);

    await expect(harness.run([
      "set-active", "--user-id", created.user.userId, "--active", "false"
    ])).resolves.toBe(0);
    await expect(harness.store.getById({ businessId }, created.user.userId)).resolves.toMatchObject({
      active: false,
      authEpoch: 3
    });

    for (const line of successLines(harness.stdout.value)) {
      expect(Object.keys(line).sort()).toEqual([
        "active", "displayName", "loginCode", "role", "status", "userId"
      ]);
      expect(line.status).toBe("success");
      expect(isMinimalMvpRole(String(line.role))).toBe(true);
    }
    const output = `${harness.stdout.value}${harness.stderr.value}`;
    expect(output).not.toContain(originalPin);
    expect(output).not.toContain(replacementPin);
    expect(output).not.toContain(afterPin.pinHash);
  });

  it("rejects non-canonical roles without changing an existing user", async () => {
    const harness = commandHarness(originalPin);
    await expect(harness.run(createArgs("operator"))).resolves.toBe(0);
    const created = await harness.store.findByLoginCode({ businessId }, "operator");
    if (created.kind !== "unique") throw new Error("expected created user");

    await expect(harness.run([
      "set-role", "--user-id", created.user.userId, "--role", "Administrator"
    ])).resolves.toBe(1);

    await expect(harness.store.getById({ businessId }, created.user.userId)).resolves.toMatchObject({
      role: "admin",
      authEpoch: 0
    });
  });
});
