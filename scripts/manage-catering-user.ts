import { randomUUID } from "node:crypto";
import { pathToFileURL } from "node:url";
import {
  isMinimalMvpRole,
  type MinimalMvpRole
} from "../shared-core/src/access-control.js";
import { assertBusinessId, type BusinessContext } from "../shared-core/src/business-context.js";
import {
  hashCateringPin,
  normalizeCateringLoginCode
} from "../shared-core/src/catering-pin-crypto.js";
import {
  CateringUserStore,
  createCateringUserRecord,
  type CateringUserRecord
} from "../shared-core/src/catering-user-store.js";
import type { CollectionStorageOptions } from "../shared-core/src/persistence.js";

type ManageCateringUserAction = "create" | "set-pin" | "set-role" | "set-active";

interface CateringCommandOutput {
  write(chunk: string | Uint8Array): unknown;
}

interface CateringProtectedPinInput {
  readonly isTTY?: boolean;
  readonly isRaw?: boolean;
  setRawMode?(enabled: boolean): unknown;
  resume?(): unknown;
  pause?(): unknown;
  on?(event: "data", listener: (chunk: string | Uint8Array) => void): unknown;
  off?(event: "data", listener: (chunk: string | Uint8Array) => void): unknown;
}

export interface TestSafeCateringPinReader {
  readonly kind: "explicit-test-safe-catering-pin-reader";
  readPin(): Promise<string>;
}

export interface ManageCateringUserCommandDependencies {
  env?: Record<string, string | undefined>;
  stdin?: CateringProtectedPinInput;
  stdout?: CateringCommandOutput;
  stderr?: CateringCommandOutput;
  pinReader?: TestSafeCateringPinReader;
  now?: () => Date;
}

interface ParsedCommand {
  action: ManageCateringUserAction;
  values: Readonly<Record<string, string>>;
}

const actionArguments: Record<ManageCateringUserAction, readonly string[]> = {
  create: ["login-code", "display-name", "role"],
  "set-pin": ["user-id"],
  "set-role": ["user-id", "role"],
  "set-active": ["user-id", "active"]
};

function commandError(): Error {
  return new Error("Catering-Benutzerverwaltung fehlgeschlagen.");
}

export function resolveManageCateringUserStorageOptions(
  env: Readonly<Record<string, string | undefined>>
): CollectionStorageOptions {
  const databaseUrl = (env.CATERING_DATABASE_URL ?? env.DATABASE_URL)?.trim();
  if (databaseUrl) return { databaseUrl };

  const rootDir = env.CATERING_DATA_ROOT?.trim();
  if (!rootDir) throw commandError();

  // An explicit empty database URL prevents ambient process variables from
  // redirecting a deliberately file-backed administrative operation.
  return { rootDir, databaseUrl: "" };
}

function assertNoPinTransport(
  argv: readonly string[],
  env: Readonly<Record<string, string | undefined>>
): void {
  if (argv.some((argument) => argument === "--pin" || argument.startsWith("--pin="))) {
    throw commandError();
  }
  if (Object.entries(env).some(([key, value]) => value && /(?:^|_)PIN(?:_|$)/i.test(key))) {
    throw commandError();
  }
}

function parseCommand(argv: readonly string[]): ParsedCommand {
  const action = argv[0];
  if (!action || !Object.hasOwn(actionArguments, action)) throw commandError();

  const values: Record<string, string> = Object.create(null) as Record<string, string>;
  for (let index = 1; index < argv.length; index += 2) {
    const argument = argv[index];
    const value = argv[index + 1];
    if (
      !argument?.startsWith("--")
      || argument.length <= 2
      || !value
      || value.startsWith("--")
    ) {
      throw commandError();
    }
    const key = argument.slice(2);
    if (Object.hasOwn(values, key)) throw commandError();
    values[key] = value;
  }

  const expectedKeys = actionArguments[action as ManageCateringUserAction];
  const actualKeys = Object.keys(values);
  if (
    actualKeys.length !== expectedKeys.length
    || actualKeys.some((key) => !expectedKeys.includes(key))
  ) {
    throw commandError();
  }

  return { action: action as ManageCateringUserAction, values };
}

function requiredValue(values: Readonly<Record<string, string>>, key: string): string {
  const value = values[key]?.trim();
  if (!value) throw commandError();
  return value;
}

function requiredRole(values: Readonly<Record<string, string>>): MinimalMvpRole {
  const role = requiredValue(values, "role");
  if (!isMinimalMvpRole(role)) throw commandError();
  return role;
}

function requiredActive(values: Readonly<Record<string, string>>): boolean {
  const active = requiredValue(values, "active");
  if (active === "true") return true;
  if (active === "false") return false;
  throw commandError();
}

function safeUserOutput(user: CateringUserRecord): Record<string, unknown> {
  return {
    status: "success",
    userId: user.userId,
    loginCode: user.loginCodeCanonical,
    displayName: user.displayName,
    role: user.role,
    active: user.active
  };
}

async function readPinFromProtectedTty(input: CateringProtectedPinInput): Promise<string> {
  if (
    input.isTTY !== true
    || typeof input.setRawMode !== "function"
    || typeof input.on !== "function"
    || typeof input.off !== "function"
  ) {
    throw commandError();
  }
  const setRawMode = input.setRawMode.bind(input);
  const addDataListener = input.on.bind(input);
  const removeDataListener = input.off.bind(input);

  return new Promise<string>((resolve, reject) => {
    const wasRaw = input.isRaw === true;
    let pin = "";
    let settled = false;

    const finish = (result: { pin: string } | { error: Error }) => {
      if (settled) return;
      settled = true;
      removeDataListener("data", onData);
      try {
        setRawMode(wasRaw);
      } finally {
        if (!wasRaw) input.pause?.();
      }
      if ("error" in result) reject(result.error);
      else resolve(result.pin);
    };

    const onData = (chunk: string | Uint8Array) => {
      const text = typeof chunk === "string" ? chunk : Buffer.from(chunk).toString("utf8");
      for (const character of text) {
        if (character === "\u0003" || character === "\u0004") {
          finish({ error: commandError() });
          return;
        }
        if (character === "\r" || character === "\n") {
          finish({ pin });
          return;
        }
        if (character === "\b" || character === "\u007f") {
          pin = pin.slice(0, -1);
          continue;
        }
        if (character >= " " && character !== "\u007f") {
          pin += character;
          if (pin.length > 64) {
            finish({ error: commandError() });
            return;
          }
        }
      }
    };

    try {
      setRawMode(true);
      addDataListener("data", onData);
      input.resume?.();
    } catch {
      finish({ error: commandError() });
    }
  });
}

async function readPin(dependencies: ManageCateringUserCommandDependencies): Promise<string> {
  if (dependencies.pinReader) {
    if (dependencies.pinReader.kind !== "explicit-test-safe-catering-pin-reader") {
      throw commandError();
    }
    return dependencies.pinReader.readPin();
  }
  return readPinFromProtectedTty(dependencies.stdin ?? process.stdin);
}

async function requiredUser(
  store: CateringUserStore,
  context: BusinessContext,
  values: Readonly<Record<string, string>>
): Promise<CateringUserRecord> {
  const user = await store.getById(context, requiredValue(values, "user-id"));
  if (!user) throw commandError();
  return user;
}

async function executeCommand(
  command: ParsedCommand,
  store: CateringUserStore,
  context: BusinessContext,
  dependencies: ManageCateringUserCommandDependencies
): Promise<CateringUserRecord> {
  const now = dependencies.now?.() ?? new Date();
  switch (command.action) {
    case "create": {
      const loginCode = normalizeCateringLoginCode(requiredValue(command.values, "login-code"));
      const displayName = requiredValue(command.values, "display-name");
      const role = requiredRole(command.values);
      const pinHash = await hashCateringPin(await readPin(dependencies));
      const user = createCateringUserRecord({
        businessId: context.businessId,
        userId: randomUUID(),
        loginCode,
        displayName,
        pinHash,
        role,
        active: true,
        now
      });
      if (await store.create(context, user) !== "created") throw commandError();
      return user;
    }
    case "set-pin": {
      const current = await requiredUser(store, context, command.values);
      const pinHash = await hashCateringPin(await readPin(dependencies));
      const result = await store.updateSecurity(context, current, { pinHash }, now);
      if (result.kind !== "updated") throw commandError();
      return result.user;
    }
    case "set-role": {
      const current = await requiredUser(store, context, command.values);
      const result = await store.updateSecurity(context, current, { role: requiredRole(command.values) }, now);
      if (result.kind !== "updated") throw commandError();
      return result.user;
    }
    case "set-active": {
      const current = await requiredUser(store, context, command.values);
      const result = await store.updateSecurity(context, current, { active: requiredActive(command.values) }, now);
      if (result.kind !== "updated") throw commandError();
      return result.user;
    }
  }
}

export function createTestSafeCateringPinReader(
  readPin: () => Promise<string>
): TestSafeCateringPinReader {
  return { kind: "explicit-test-safe-catering-pin-reader", readPin };
}

export async function runManageCateringUserCommand(
  argv: readonly string[],
  dependencies: ManageCateringUserCommandDependencies = {}
): Promise<0 | 1> {
  const env = dependencies.env ?? process.env;
  const stdout = dependencies.stdout ?? process.stdout;
  const stderr = dependencies.stderr ?? process.stderr;
  try {
    assertNoPinTransport(argv, env);
    const command = parseCommand(argv);
    const businessId = env.CATERING_DEFAULT_BUSINESS_ID?.trim();
    if (!businessId) throw commandError();
    const context = { businessId: assertBusinessId(businessId) };
    const storageOptions = resolveManageCateringUserStorageOptions(env);
    const user = await executeCommand(
      command,
      new CateringUserStore(storageOptions),
      context,
      dependencies
    );
    stdout.write(`${JSON.stringify(safeUserOutput(user))}\n`);
    return 0;
  } catch {
    stderr.write(`${JSON.stringify({ status: "error" })}\n`);
    return 1;
  }
}

async function main(): Promise<void> {
  process.exitCode = await runManageCateringUserCommand(process.argv.slice(2));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main();
}
