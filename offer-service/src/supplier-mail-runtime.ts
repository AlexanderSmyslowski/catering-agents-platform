import { constants } from "node:fs";
import { open } from "node:fs/promises";
import { createHash } from "node:crypto";
import { assertBusinessId, type BusinessContext } from "@catering/shared-core";
import {
  fetchMailboxRaw,
  listMailboxMessages,
  listMailboxUidBatch,
  fetchMailboxSenderRaw,
  type MailboxConfig,
  type MailboxResolver,
} from "./supplier-mailbox.js";
import { parseSupplierMessage } from "./supplier-mail-message.js";
import { scanAndExtractSupplierWorkbook } from "./supplier-file-scan.js";
import {
  inspectSupplierTable,
  parseSupplierTable,
  type SupplierTableMapping,
} from "./supplier-table.js";
import { verifyPriceMail } from "./price-mail-auth.js";
import {
  SupplierSourceStore,
  type SupplierSourceRecord,
} from "./supplier-source-store.js";
import type { SupplierSourceAdapter } from "./supplier-source-routes.js";

type Mailbox = MailboxConfig & {
  id: string;
  businessId: string;
  label: string;
  generation: string;
};
type Settings = {
  scannerSocket: string;
  intervalMs: number;
  mailboxes: Mailbox[];
};
type Selection = { uidValidity: string; uid: number; part: string };

export async function readSupplierMailSettings(
  path: string,
): Promise<Settings> {
  const file = await open(path, constants.O_RDONLY | constants.O_NOFOLLOW);
  try {
    const stat = await file.stat();
    if (
      !stat.isFile() ||
      (stat.mode & 0o077) !== 0 ||
      (typeof process.getuid === "function" && stat.uid !== process.getuid()) ||
      stat.size > 100_000
    )
      throw new Error(
        "Supplier mailbox configuration must be a private owned file",
      );
    const config = JSON.parse(await file.readFile("utf8")) as Settings;
    if (
      !config ||
      typeof config.scannerSocket !== "string" ||
      !config.scannerSocket.startsWith("/") ||
      !Number.isSafeInteger(config.intervalMs) ||
      config.intervalMs < 60_000 ||
      !Array.isArray(config.mailboxes) ||
      config.mailboxes.length > 100
    )
      throw new Error("Invalid supplier mailbox configuration");
    const seen = new Set<string>();
    for (const box of config.mailboxes) {
      assertBusinessId(box.businessId);
      if (
        !/^[\w-]{1,80}$/.test(box.id) ||
        typeof box.label !== "string" ||
        box.label.length > 120 ||
        !/^[A-Za-z0-9.-]{1,253}$/.test(box.host) ||
        !Number.isInteger(box.port) ||
        box.port < 1 ||
        box.port > 65535 ||
        typeof box.user !== "string" ||
        !box.user ||
        typeof box.password !== "string" ||
        !box.password ||
        !/^[A-Za-z0-9_-]{32,128}$/.test(box.generation) ||
        (box.mailbox !== undefined && box.mailbox !== "INBOX")
      )
        throw new Error("Invalid supplier mailbox configuration");
      const key = JSON.stringify([box.businessId, box.id]);
      if (seen.has(key)) throw new Error("Duplicate supplier mailbox");
      seen.add(key);
    }
    return config;
  } finally {
    await file.close();
  }
}

export function createSupplierMailRuntime(
  settings: Settings,
  store: SupplierSourceStore,
  leaseIsLive: () => boolean = () => true,
) {
  const assertLease = () => {
    if (!leaseIsLive()) throw new Error("Supplier mailbox lease lost");
  };
  const boxFor = (ctx: BusinessContext, id: string) => {
    assertLease();
    const box = settings.mailboxes.find(
      (b) => b.businessId === ctx.businessId && b.id === id,
    );
    if (!box) throw new Error("Mailbox not authorized");
    return box;
  };
  const binding = (box: Mailbox) =>
    createHash("sha256")
      .update(
        JSON.stringify([
          box.businessId,
          box.id,
          box.generation,
          box.host,
          box.port,
          box.user,
          box.mailbox ?? "INBOX",
        ]),
      )
      .digest("hex");
  const resolver =
    (ctx: BusinessContext): MailboxResolver =>
    async (id) =>
      boxFor(ctx, id);
  const selected = async (
    ctx: BusinessContext,
    id: string,
    selection: Selection,
    sender: string,
    subject?: string,
  ) => {
    const raw = await fetchMailboxSenderRaw(
      resolver(ctx),
      id,
      selection.uidValidity,
      selection.uid,
      sender,
    );
    const message = await parseSupplierMessage(raw);
    if (
      message.from !== sender ||
      (subject && !message.subject.includes(subject))
    )
      throw new Error("Sender or subject does not match selection");
    const attachment = message.attachments.find(
      (a) => a.part === selection.part,
    );
    if (!attachment) throw new Error("Attachment not found");
    const parts = await scanAndExtractSupplierWorkbook(
      attachment.content,
      settings.scannerSocket,
    );
    return { raw, message, attachment, parts };
  };
  const adapter: SupplierSourceAdapter = {
    mailboxBinding: async (ctx, id) => binding(boxFor(ctx, id)),
    listMailboxes: async (ctx) =>
      settings.mailboxes
        .filter((b) => b.businessId === ctx.businessId)
        .map(({ id, label }) => ({ id, label })),
    listMessages: (ctx, id, sender) =>
      listMailboxMessages(resolver(ctx), id, sender),
    inspect: async (ctx, id, selection, sender) =>
      inspectSupplierTable((await selected(ctx, id, selection, sender)).parts),
    parse: async (ctx, id, selection, columns, sender, subject) => {
      const item = await selected(ctx, id, selection, sender, subject);
      const result = parseSupplierTable(
        item.parts,
        columns as SupplierTableMapping,
      );
      return {
        bytes: item.attachment.content,
        rows: result.rows,
        senderAuthenticated: false,
        complete: !result.ambiguous,
        skipped: result.skipped,
        ...(result.validFrom ? { validFrom: result.validFrom } : {}),
      };
    },
  };
  let stopping = false,
    timer: ReturnType<typeof setTimeout> | undefined,
    current: Promise<void> | undefined;
  const runSource = async (
    ctx: BusinessContext,
    source: SupplierSourceRecord,
  ) => {
    const id = source.config.mailboxId,
      mailboxBinding = binding(boxFor(ctx, id));
    if (!source.active || source.config.mailboxBinding !== mailboxBinding)
      return;
    const expected = source.poll && {
      uidValidity: source.poll.uidValidity,
      lastUid: source.poll.lastUid,
    };
    assertLease();
    const batch = await listMailboxUidBatch(
      resolver(ctx),
      id,
      source.config.sender,
      expected,
    );
    const record = async (
      next: { uidValidity: string; lastUid: number },
      status: "ok" | "stalled",
      prev = expected,
    ) =>
      store.recordPoll(ctx, source.id, {
        configVersion: source.configVersion,
        mailboxBinding,
        expected: prev,
        next,
        status,
      });
    if (expected && expected.uidValidity !== batch.uidValidity) {
      await record(expected, "stalled");
      return;
    }
    let cursor = expected;
    try {
      for (const uid of batch.uids) {
        if (stopping) return;
        assertLease();
        const raw = await fetchMailboxRaw(
          resolver(ctx),
          id,
          batch.uidValidity,
          uid,
        );
        const message = await parseSupplierMessage(raw);
        if (
          message.from === source.config.sender &&
          (!source.config.subject ||
            message.subject.includes(source.config.subject))
        ) {
          const verified = await verifyPriceMail(
            raw,
            source.config.sender,
            Boolean(source.config.subject),
          );
          for (const attachment of message.attachments) {
            if (!/\.xlsx$/i.test(attachment.filename)) continue;
            const parts = await scanAndExtractSupplierWorkbook(
              attachment.content,
              settings.scannerSocket,
            );
            const result = parseSupplierTable(
              parts,
              source.config.columns as SupplierTableMapping,
            );
            assertLease();
            const currentSource = await store.get(ctx, source.id);
            if (
              !currentSource?.active ||
              currentSource.configVersion !== source.configVersion ||
              currentSource.config.mailboxBinding !== mailboxBinding
            )
              throw new Error("Source authorization changed");
            const documentKey = JSON.stringify([
              id,
              batch.uidValidity,
              uid,
              attachment.part,
            ]);
            assertLease();
            const staged = await store.stage(ctx, source.id, {
              documentKey,
              bytes: attachment.content,
              rows: result.rows,
              senderAuthenticated: verified,
              complete: !result.ambiguous,
              skipped: result.skipped,
              configVersion: source.configVersion,
              mailboxBinding,
              automatic: true,
              ...(result.validFrom ? { validFrom: result.validFrom } : {}),
            });
            const preview = staged.previews.find(
              (p) =>
                p.documentKey === documentKey &&
                p.configVersion === source.configVersion,
            );
            if (
              preview &&
              verified &&
              !result.ambiguous &&
              source.config.autoApply
            ) {
              try {
                assertLease();
                await store.apply(ctx, source.id, preview.id, true, undefined, {
                  configVersion: source.configVersion,
                  mailboxBinding,
                });
              } catch {
                /* Guarded updates remain available for manual review. */
              }
            }
          }
        }
        await record(
          { uidValidity: batch.uidValidity, lastUid: uid },
          "ok",
          cursor,
        );
        cursor = { uidValidity: batch.uidValidity, lastUid: uid };
      }
      if ((cursor?.lastUid ?? 0) < batch.nextUid)
        await record(
          { uidValidity: batch.uidValidity, lastUid: batch.nextUid },
          "ok",
          cursor,
        );
    } catch (error) {
      const next = cursor ?? { uidValidity: batch.uidValidity, lastUid: 0 };
      await record(next, "stalled", cursor).catch(() => {});
      throw error;
    }
  };
  const poll = async () => {
    const businesses = [
      ...new Set(settings.mailboxes.map((b) => b.businessId)),
    ];
    for (const businessId of businesses) {
      const ctx = { businessId };
      for (const source of await store.list(ctx)) {
        if (stopping) return;
        try {
          await runSource(ctx, source);
        } catch {
          try {
            const mailboxBinding = binding(
              boxFor(ctx, source.config.mailboxId),
            );
            await store.recordPollFailure(ctx, source.id, {
              configVersion: source.configVersion,
              mailboxBinding,
            });
          } catch {
            /* No private mail or credential details enter status. */
          }
        }
      }
    }
  };
  const cycle = () => {
    current = poll()
      .catch(() => {})
      .finally(() => {
        current = undefined;
        if (!stopping) timer = setTimeout(cycle, settings.intervalMs);
      });
  };
  return {
    adapter,
    pollOnce: poll,
    start() {
      if (!timer && !current && !stopping) cycle();
    },
    async stop() {
      stopping = true;
      if (timer) clearTimeout(timer);
      await current;
    },
  };
}
