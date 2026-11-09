import { afterEach, describe, expect, it, vi } from "vitest";
import { Readable } from "node:stream";

const state = vi.hoisted(() => ({
  validity: 42n,
  uidNext: 36,
  exists: 35,
  searchQuery: null as unknown,
  lockPath: "",
  searchResult: [31],
  closed: 0,
  messageSize: 4,
  download: vi.fn(),
  structure: {
    part: "2",
    type: "application/xml",
    size: 10,
    dispositionParameters: { filename: "invoice.xml" },
  },
}));
vi.mock("imapflow", () => ({
  ImapFlow: class {
    mailbox = {
      uidValidity: state.validity,
      exists: state.exists,
      uidNext: state.uidNext,
    };
    on() {}
    async connect() {}
    close() {
      state.closed++;
    }
    async getMailboxLock(path: string) {
      state.lockPath = path;
      return { release() {} };
    }
    async search(query: unknown) {
      state.searchQuery = query;
      return state.searchResult;
    }
    async fetchOne() {
      return { bodyStructure: state.structure, size: state.messageSize };
    }
    async download() {
      return state.download();
    }
  },
}));
import {
  fetchMailboxRaw,
  listMailboxMessages,
  listMailboxUidBatch,
  fetchMailboxSenderRaw,
} from "../offer-service/src/supplier-mailbox.js";
const resolve = async () => ({
  host: "mail.example.org",
  port: 993,
  user: "user",
  password: "secret",
});
afterEach(() => {
  vi.useRealTimers();
  state.validity = 42n;
  state.uidNext = 36;
  state.searchResult = [31];
  state.closed = 0;
  state.messageSize = 4;
  state.download.mockReset();
});

describe("supplier mailbox", () => {
  it("limits samples and identifies them without trusting From", async () => {
    const raw = Buffer.from(
      "From: supplier@example.org\r\nSubject: Price\r\nContent-Type: application/octet-stream; name=invoice.xml\r\nContent-Disposition: attachment; filename=invoice.xml\r\n\r\ntest",
    );
    state.messageSize = raw.length;
    state.download.mockReturnValue({ content: Readable.from([raw]) });
    const messages = await listMailboxMessages(
      resolve,
      "mailbox",
      "supplier@example.org",
    );
    expect(state.searchQuery).toEqual({
      from: "supplier@example.org",
      uid: "1:35",
    });
    expect(state.lockPath).toBe("INBOX");
    expect(messages[0]).toMatchObject({
      uidValidity: "42",
      uid: 31,
      date: null,
      senderAuthenticated: false,
      authentication: "unverified",
      attachments: [{ part: "1" }],
    });
    expect(JSON.stringify(messages)).not.toContain("secret");
    expect(state.closed).toBe(1);
  });
  it("fetches up to 30 matching messages through the same read-only connection", async () => {
    const raw = Buffer.from(
      "From: supplier@example.org\r\nSubject: Price\r\n\r\nbody",
    );
    state.messageSize = raw.length;
    state.searchResult = [31, 32];
    state.download.mockImplementation(() => ({
      content: Readable.from([raw]),
    }));
    const messages = await listMailboxMessages(
      resolve,
      "mailbox",
      "supplier@example.org",
    );
    expect(messages.map((message) => message.uid)).toEqual([32, 31]);
    expect(state.closed).toBe(1);
    expect(state.download).toHaveBeenCalledTimes(2);
  });
  it("requires exact parsed sender despite broad IMAP FROM matching", async () => {
    const raw = Buffer.from(
      "From: other-supplier@example.org\r\nSubject: Price\r\n\r\nbody",
    );
    state.messageSize = raw.length;
    state.download.mockReturnValue({ content: Readable.from([raw]) });
    expect(
      await listMailboxMessages(resolve, "mailbox", "supplier@example.org"),
    ).toEqual([]);
    await expect(
      listMailboxMessages(resolve, "mailbox", "bad\r\naddress"),
    ).rejects.toThrow("Invalid sender");
  });
  it("preserves local-part case while comparing canonical domains", async () => {
    const raw = Buffer.from(
      "From: Supplier@EXAMPLE.ORG\r\nSubject: Price\r\n\r\nbody",
    );
    state.messageSize = raw.length;
    state.download.mockImplementation(() => ({
      content: Readable.from([raw]),
    }));
    expect(
      (await listMailboxMessages(resolve, "mailbox", "Supplier@example.org"))[0]
        ?.from,
    ).toBe("Supplier@example.org");
    expect(
      await listMailboxMessages(resolve, "mailbox", "supplier@example.org"),
    ).toEqual([]);
  });
  it("uses a bounded sender-specific UID window and preserves backlog", async () => {
    state.uidNext = 2500;
    state.searchResult = [100, 201, 300, 1200, 1201, 2400];
    const batch = await listMailboxUidBatch(
      resolve,
      "mailbox",
      "supplier@example.org",
      { uidValidity: "42", lastUid: 200 },
    );
    expect(state.searchQuery).toEqual({
      from: "supplier@example.org",
      uid: "201:1200",
    });
    expect(batch).toEqual({
      uidValidity: "42",
      uids: [201, 300, 1200],
      nextUid: 1200,
    });
    state.searchResult = [];
    await expect(
      fetchMailboxSenderRaw(
        resolve,
        "mailbox",
        "42",
        31,
        "supplier@example.org",
      ),
    ).rejects.toThrow("Sender does not match");
    expect(state.searchQuery).toEqual({
      from: "supplier@example.org",
      uid: "31:31",
    });
  });
  it("rejects a changed mailbox identity and enforces the raw download limit", async () => {
    await expect(fetchMailboxRaw(resolve, "mailbox", "41", 31)).rejects.toThrow(
      "identity changed",
    );
    state.download.mockReturnValue({
      content: Readable.from([Buffer.alloc(5_000_001)]),
    });
    await expect(fetchMailboxRaw(resolve, "mailbox", "42", 31)).rejects.toThrow(
      "too large",
    );
    expect(state.closed).toBe(2);
  });
  it("searches and fetches a selected UID in one connection", async () => {
    state.download.mockReturnValue({
      content: Readable.from([Buffer.from("test")]),
    });
    expect(
      await fetchMailboxSenderRaw(
        resolve,
        "mailbox",
        "42",
        31,
        "supplier@example.org",
      ),
    ).toEqual(Buffer.from("test"));
    expect(state.searchQuery).toEqual({
      from: "supplier@example.org",
      uid: "31:31",
    });
    expect(state.closed).toBe(1);
  });
  it("fetches complete raw bytes only for the same mailbox identity", async () => {
    state.download.mockReturnValue({
      content: Readable.from([Buffer.from("test")]),
    });
    expect(await fetchMailboxRaw(resolve, "mailbox", "42", 31)).toEqual(
      Buffer.from("test"),
    );
    state.download.mockReturnValue({
      content: Readable.from([Buffer.from("bad")]),
    });
    await expect(fetchMailboxRaw(resolve, "mailbox", "42", 31)).rejects.toThrow(
      "size changed",
    );
  });
});
