import { expect, it, vi } from "vitest";
const mock = vi.hoisted(() => ({
  verify: vi.fn(async () => true),
  scan: vi.fn(async (_bytes: Buffer, _path: string) => {}),
  parse: vi.fn(() => ({
    rows: [
      {
        article: "A",
        description: "Rice",
        quantity: "1",
        unit: "kg",
        price: "10",
      },
    ],
    skipped: [],
    ambiguous: false,
    validFrom: "2026-11-01",
  })),
  raw: Buffer.from("signed mail"),
  attachment: Buffer.from("signed attachment"),
}));
vi.mock("../offer-service/src/supplier-mailbox.js", () => ({
  listMailboxMessages: vi.fn(async () => []),
  listMailboxUidBatch: vi.fn(async () => ({
    uidValidity: "10",
    uids: [7],
    nextUid: 7,
  })),
  fetchMailboxRaw: vi.fn(async () => mock.raw),
  fetchMailboxSenderRaw: vi.fn(async () => mock.raw),
}));
vi.mock("../offer-service/src/supplier-mail-message.js", () => ({
  parseSupplierMessage: vi.fn(async (raw: Buffer) => {
    if (raw !== mock.raw) throw new Error("different message");
    return {
      from: "supplier@example.org",
      subject: "Prices",
      attachments: [
        {
          part: "1",
          filename: "prices.xlsx",
          contentType: "application/xlsx",
          content: mock.attachment,
        },
      ],
    };
  }),
}));
vi.mock("../offer-service/src/supplier-file-scan.js", () => ({
  scanAndExtractSupplierWorkbook: vi.fn(async (...args: [Buffer, string]) => {
    await mock.scan(...args);
    return { sheet: Buffer.from("sheet") };
  }),
}));
vi.mock("../offer-service/src/supplier-table.js", () => ({
  parseSupplierTable: mock.parse,
  inspectSupplierTable: vi.fn(),
}));
vi.mock("../offer-service/src/price-mail-auth.js", () => ({
  verifyPriceMail: mock.verify,
}));
import { createSupplierMailRuntime } from "../offer-service/src/supplier-mail-runtime.js";
import type { SupplierSourceStore } from "../offer-service/src/supplier-source-store.js";
it("stages only scanned bytes from the verified raw message and records the cursor", async () => {
  const box = {
    businessId: "tenant",
    id: "m",
    label: "Mailbox",
    generation: "x".repeat(32),
    host: "mail.example.org",
    port: 993,
    user: "user",
    password: "secret",
  };
  let source: any;
  const stage = vi.fn(async (_ctx, _id, input) => ({
    previews: [
      { id: "preview", documentKey: input.documentKey, configVersion: 1 },
    ],
  }));
  const apply = vi.fn(async () => ({}));
  const recordPoll = vi.fn(async () => ({}));
  const store = {
    list: vi.fn(async () => [source]),
    get: vi.fn(async () => source),
    stage,
    apply,
    recordPoll,
  } as unknown as SupplierSourceStore;
  const runtime = createSupplierMailRuntime(
    { scannerSocket: "/tmp/fake", intervalMs: 60_000, mailboxes: [box] },
    store,
  );
  const binding = await runtime.adapter.mailboxBinding(
    { businessId: "tenant" },
    "m",
  );
  await expect(
    runtime.adapter.mailboxBinding({ businessId: "other" }, "m"),
  ).rejects.toThrow();
  source = {
    id: "s",
    active: true,
    configVersion: 1,
    config: {
      mailboxId: "m",
      mailboxBinding: binding,
      sender: "supplier@example.org",
      subject: "Prices",
      autoApply: true,
      columns: {},
    },
    previews: [],
    prices: [],
  };
  await runtime.pollOnce();
  expect(mock.verify).toHaveBeenCalledWith(
    mock.raw,
    "supplier@example.org",
    true,
  );
  expect(mock.scan).toHaveBeenCalledWith(mock.attachment, "/tmp/fake");
  expect(stage).toHaveBeenCalledWith(
    { businessId: "tenant" },
    "s",
    expect.objectContaining({
      bytes: mock.attachment,
      senderAuthenticated: true,
      complete: true,
      mailboxBinding: binding,
    }),
  );
  expect(apply).toHaveBeenCalledOnce();
  expect(recordPoll).toHaveBeenCalledWith(
    { businessId: "tenant" },
    "s",
    expect.objectContaining({
      next: { uidValidity: "10", lastUid: 7 },
      status: "ok",
    }),
  );
});
it("does not stage or advance on failed scanner", async () => {
  mock.scan.mockRejectedValueOnce(new Error("unavailable"));
  const box = {
    businessId: "tenant",
    id: "m",
    label: "Mailbox",
    generation: "x".repeat(32),
    host: "mail.example.org",
    port: 993,
    user: "u",
    password: "p",
  };
  let source: any;
  const stage = vi.fn(),
    recordPoll = vi.fn(async () => ({}));
  const store = {
    list: async () => [source],
    get: async () => source,
    stage,
    recordPoll,
  } as unknown as SupplierSourceStore;
  const runtime = createSupplierMailRuntime(
    { scannerSocket: "/tmp/fake", intervalMs: 60_000, mailboxes: [box] },
    store,
  );
  source = {
    id: "s",
    active: true,
    configVersion: 1,
    config: {
      mailboxId: "m",
      mailboxBinding: await runtime.adapter.mailboxBinding(
        { businessId: "tenant" },
        "m",
      ),
      sender: "supplier@example.org",
      autoApply: true,
      columns: {},
    },
  };
  await runtime.pollOnce();
  expect(stage).not.toHaveBeenCalled();
  expect(recordPoll).toHaveBeenCalledWith(
    { businessId: "tenant" },
    "s",
    expect.objectContaining({
      next: { uidValidity: "10", lastUid: 0 },
      status: "stalled",
    }),
  );
});

it("rejects a selected message with the wrong subject before scanning", async () => {
  const box = {
    businessId: "tenant",
    id: "m",
    label: "Mailbox",
    generation: "x".repeat(32),
    host: "mail.example.org",
    port: 993,
    user: "u",
    password: "p",
  };
  const runtime = createSupplierMailRuntime(
    { scannerSocket: "/tmp/fake", intervalMs: 60_000, mailboxes: [box] },
    {} as SupplierSourceStore,
  );
  mock.scan.mockClear();
  await expect(
    runtime.adapter.parse(
      { businessId: "tenant" },
      "m",
      { uidValidity: "10", uid: 7, part: "1" },
      {},
      "supplier@example.org",
      "wrong subject",
    ),
  ).rejects.toThrow("subject does not match");
  expect(mock.scan).not.toHaveBeenCalled();
});
