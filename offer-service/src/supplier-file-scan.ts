import { createConnection } from "node:net";
import { lstat } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

let tail: Promise<void> = Promise.resolve();
let waiting = 0;
async function exclusive<T>(operation: () => Promise<T>): Promise<T> {
  if (waiting >= 4) throw new Error("Scanner capacity reached");
  waiting++;
  const before = tail;
  let release!: () => void;
  tail = new Promise<void>((resolve) => {
    release = resolve;
  });
  let queueTimer: ReturnType<typeof setTimeout> | undefined;
  try {
    await Promise.race([
      before,
      new Promise<never>((_, reject) => {
        queueTimer = setTimeout(
          () => reject(new Error("Scanner queue timeout")),
          15_000,
        );
      }),
    ]);
  } catch (error) {
    void before.finally(() => {
      waiting--;
      release();
    });
    throw error;
  } finally {
    if (queueTimer) clearTimeout(queueTimer);
  }
  try {
    return await operation();
  } finally {
    waiting--;
    release();
  }
}
async function command(
  socketPath: string,
  name: "VERSION" | "INSTREAM",
  deadline: number,
  bytes?: Buffer,
): Promise<string> {
  return new Promise((resolve, reject) => {
    const socket = createConnection({ path: socketPath });
    let response = "",
      done = false;
    const timer = setTimeout(
      () => finish(new Error("Scanner deadline exceeded")),
      Math.max(1, deadline - Date.now()),
    );
    const finish = (error?: Error) => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      socket.destroy();
      error ? reject(error) : resolve(response.slice(0, -1));
    };
    socket.setTimeout(20_000, () => finish(new Error("Scanner timeout")));
    socket.on("error", () => finish(new Error("Scanner unavailable")));
    socket.on("data", (chunk) => {
      response += chunk.toString("ascii");
      if (response.length > 1024) finish(new Error("Scanner response invalid"));
      else if (response.includes("\0")) {
        if (
          !response.endsWith("\0") ||
          response.indexOf("\0") !== response.length - 1
        )
          finish(new Error("Scanner response invalid"));
        else finish();
      }
    });
    socket.on("end", () => finish(new Error("Scanner response incomplete")));
    socket.on("connect", () => {
      socket.write(`z${name}\0`);
      if (bytes) {
        for (let i = 0; i < bytes.length; i += 65_536) {
          const part = bytes.subarray(i, i + 65_536),
            length = Buffer.alloc(4);
          length.writeUInt32BE(part.length);
          socket.write(length);
          socket.write(part);
        }
        socket.write(Buffer.alloc(4));
      }
    });
  });
}
function version(value: string) {
  const match =
    /^ClamAV ([0-9]+\.[0-9]+\.[0-9]+(?:[-+][A-Za-z0-9.-]+)?)\/([0-9]+)\/([A-Z][a-z]{2} [A-Z][a-z]{2} [ 0-9][0-9] [0-9]{2}:[0-9]{2}:[0-9]{2} [0-9]{4})$/.exec(
      value,
    );
  const timestamp = match && Date.parse(match[3]!);
  if (
    !timestamp ||
    timestamp > Date.now() ||
    Date.now() - timestamp > 7 * 86400000
  )
    throw new Error("Scanner signatures unavailable or stale");
}
async function extract(
  bytes: Buffer,
  deadline: number,
): Promise<{ sheet: Buffer; sharedStrings?: Buffer }> {
  const script = fileURLToPath(
    new URL("../../scripts/supplier-xlsx-parts.py", import.meta.url),
  );
  const output = await new Promise<string>((resolve, reject) => {
    const child = spawn("/usr/bin/python3", ["-I", "-B", script], {
      stdio: ["pipe", "pipe", "ignore"],
    });
    let result = "",
      done = false;
    const finish = (error?: Error) => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      if (error) {
        child.kill();
        reject(error);
      } else resolve(result);
    };
    const timer = setTimeout(
      () => finish(new Error("Workbook extraction timed out")),
      Math.max(1, Math.min(10_000, deadline - Date.now())),
    );
    child.on("error", () =>
      finish(new Error("Workbook extractor unavailable")),
    );
    child.stdout.on("data", (chunk) => {
      result += chunk.toString();
      if (result.length > 6_000_000)
        finish(new Error("Workbook output too large"));
    });
    child.on("close", (code) =>
      finish(code === 0 ? undefined : new Error("Workbook rejected")),
    );
    child.stdin.on("error", () => {});
    child.stdin.end(bytes);
  });
  const parsed = JSON.parse(output) as {
    parts: Array<{ name: string; data: string }>;
  };
  if (!Array.isArray(parsed.parts) || parsed.parts.length > 2)
    throw new Error("Invalid workbook parts");
  const parts = new Map(
    parsed.parts.map((p) => [p.name, Buffer.from(p.data, "base64")]),
  );
  const sheet = parts.get("xl/worksheets/sheet1.xml"),
    strings = parts.get("xl/sharedStrings.xml");
  if (
    !sheet ||
    sheet.length > 2_097_152 ||
    (strings && strings.length > 2_097_152)
  )
    throw new Error("Invalid workbook parts");
  return { sheet, ...(strings ? { sharedStrings: strings } : {}) };
}
/** The socket must be a trusted local daemon; scan both container and exact parsed parts. */
export async function scanAndExtractSupplierWorkbook(
  bytes: Buffer,
  socketPath: string,
) {
  if (!socketPath.startsWith("/") || !bytes.length || bytes.length > 5_000_000)
    throw new Error("Invalid scanner configuration or workbook");
  const snapshot = Buffer.from(bytes);
  return exclusive(async () => {
    let location = resolve(socketPath);
    const expectedUid =
      typeof process.getuid === "function" ? process.getuid() : -1;
    let isSocket = true;
    while (true) {
      const entry = await lstat(location);
      if (
        (isSocket ? !entry.isSocket() : !entry.isDirectory()) ||
        (entry.uid !== 0 && entry.uid !== expectedUid) ||
        (entry.mode & 0o022) !== 0
      )
        throw new Error("Scanner path is not protected");
      const parent = dirname(location);
      if (parent === location) break;
      location = parent;
      isSocket = false;
    }
    const deadline = Date.now() + 60_000;
    const before = await command(socketPath, "VERSION", deadline);
    version(before);
    const eicar = Buffer.from(
      [
        "X5O!P%@AP[4",
        "\\PZX54(P^)7CC)7}$",
        "EICAR-STANDARD-ANTIVIRUS-TEST-FILE!",
        "$H+H*",
      ].join(""),
      "ascii",
    );
    if (
      !/^stream: [!-~][ -~]{0,510} FOUND$/.test(
        await command(socketPath, "INSTREAM", deadline, eicar),
      )
    )
      throw new Error("Scanner canary failed");
    if (
      (await command(socketPath, "INSTREAM", deadline, snapshot)) !==
      "stream: OK"
    )
      throw new Error("Workbook scan failed");
    const parts = await extract(snapshot, deadline);
    for (const part of [parts.sheet, parts.sharedStrings])
      if (
        part &&
        (await command(socketPath, "INSTREAM", deadline, part)) !== "stream: OK"
      )
        throw new Error("Workbook part scan failed");
    const after = await command(socketPath, "VERSION", deadline);
    version(after);
    if (after !== before) throw new Error("Scanner changed during scan");
    return parts;
  });
}
