import { ImapFlow } from "imapflow";
import { parseSupplierMessage } from "./supplier-mail-message.js";

// The resolver is configured by the operator; callers must never supply connection details.
export type MailboxConfig = {
  host: string;
  port: number;
  user: string;
  password: string;
  mailbox?: string;
};
export type MailboxResolver = (mailboxId: string) => Promise<MailboxConfig>;
export type MailAttachment = {
  part: string;
  filename: string;
  contentType: string;
  size: number;
};
export type MailSample = {
  uidValidity: string;
  uid: number;
  subject: string;
  from: string;
  date: string | null;
  attachments: MailAttachment[];
  authentication: "unverified";
  senderAuthenticated: false;
};
const MAX_ATTACHMENT = 5_000_000;
const MAX_MESSAGES = 30;

async function withMailbox<T>(
  resolve: MailboxResolver,
  mailboxId: string,
  operation: (
    client: ImapFlow,
    validity: string,
    exists: number,
    uidNext: number,
  ) => Promise<T>,
): Promise<T> {
  const config = await resolve(mailboxId);
  const client = new ImapFlow({
    host: config.host,
    port: config.port,
    secure: true,
    auth: { user: config.user, pass: config.password },
    logger: false,
    disableAutoIdle: true,
    disableCompression: true,
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
    socketTimeout: 20_000,
  });
  client.on("error", () => {});
  try {
    await client.connect();
    if (config.mailbox && config.mailbox !== "INBOX")
      throw new Error("Only INBOX is supported");
    const lock = await client.getMailboxLock("INBOX", {
      readOnly: true,
    });
    try {
      const mailbox = client.mailbox;
      if (
        !mailbox ||
        !mailbox.uidValidity ||
        !Number.isSafeInteger(mailbox.uidNext) ||
        mailbox.uidNext < 1
      )
        throw new Error("Mailbox identity unavailable");
      return await operation(
        client,
        mailbox.uidValidity.toString(),
        mailbox.exists,
        mailbox.uidNext,
      );
    } finally {
      lock.release();
    }
  } finally {
    client.close();
  }
}

function validateSender(sender: string): void {
  if (
    typeof sender !== "string" ||
    sender.length > 254 ||
    !/^[^\s<>@]+@[^\s<>@]+$/.test(sender)
  )
    throw new Error("Invalid sender");
}

async function searchSender(
  client: ImapFlow,
  sender: string,
  start: number,
  end: number,
): Promise<number[]> {
  validateSender(sender);
  if (start > end) return [];
  const result = await client.search(
    { from: sender, uid: `${start}:${end}` },
    { uid: true },
  );
  if (!Array.isArray(result)) throw new Error("Mailbox search failed");
  return [
    ...new Set(
      result.filter(
        (uid) => Number.isSafeInteger(uid) && uid >= start && uid <= end,
      ),
    ),
  ].sort((a, b) => a - b);
}

export async function fetchMailboxSenderRaw(
  resolve: MailboxResolver,
  mailboxId: string,
  uidValidity: string,
  uid: number,
  sender: string,
): Promise<Buffer> {
  validateSender(sender);
  if (!/^\d{1,20}$/.test(uidValidity) || !Number.isSafeInteger(uid) || uid < 1)
    throw new Error("Invalid mailbox selection");
  return withMailbox(resolve, mailboxId, async (client, currentValidity) => {
    if (uidValidity !== currentValidity)
      throw new Error("Mailbox identity changed");
    if (!(await searchSender(client, sender, uid, uid)).includes(uid))
      throw new Error("Sender does not match selection");
    return fetchRawFromClient(client, uid);
  });
}

export async function listMailboxMessages(
  resolve: MailboxResolver,
  mailboxId: string,
  sender: string,
): Promise<MailSample[]> {
  validateSender(sender);
  return withMailbox(
    resolve,
    mailboxId,
    async (client, uidValidity, exists, uidNext) => {
      if (!exists || uidNext <= 1) return [];
      const uids = (
        await searchSender(
          client,
          sender,
          Math.max(1, uidNext - 1000),
          uidNext - 1,
        )
      )
        .slice(-MAX_MESSAGES)
        .reverse();
      const samples: MailSample[] = [];
      for (const uid of uids) {
        try {
          const raw = await fetchRawFromClient(client, uid);
          const parsed = await parseSupplierMessage(raw);
          if (parsed.from !== sender) continue;
          samples.push({
            uidValidity,
            uid,
            subject: parsed.subject,
            from: parsed.from,
            date: null,
            attachments: parsed.attachments.map((a) => ({
              part: a.part,
              filename: a.filename,
              contentType: a.contentType,
              size: a.content.length,
            })),
            authentication: "unverified",
            senderAuthenticated: false,
          });
        } catch {
          /* Unreadable samples do not prevent browsing other matching messages. */
        }
      }
      return samples;
    },
  );
}

export async function listMailboxUidBatch(
  resolve: MailboxResolver,
  mailboxId: string,
  sender: string,
  cursor?: { uidValidity: string; lastUid: number },
): Promise<{ uidValidity: string; uids: number[]; nextUid: number }> {
  validateSender(sender);
  return withMailbox(
    resolve,
    mailboxId,
    async (client, uidValidity, _exists, uidNext) => {
      if (cursor && cursor.uidValidity !== uidValidity)
        return { uidValidity, uids: [], nextUid: 0 };
      const start = (cursor?.lastUid ?? 0) + 1;
      if (start >= uidNext)
        return { uidValidity, uids: [], nextUid: start - 1 };
      const end = Math.min(start + 999, uidNext - 1);
      const uids = (await searchSender(client, sender, start, end)).slice(
        0,
        30,
      );
      return {
        uidValidity,
        uids,
        nextUid: uids.length === 30 ? uids[uids.length - 1]! : end,
      };
    },
  );
}

async function fetchRawFromClient(
  client: ImapFlow,
  uid: number,
): Promise<Buffer> {
  const message = await client.fetchOne(
    String(uid),
    { size: true },
    { uid: true },
  );
  if (
    !message ||
    !Number.isSafeInteger(message.size) ||
    message.size! < 1 ||
    message.size! > MAX_ATTACHMENT
  )
    throw new Error("Message unavailable or too large");
  const download = await client.download(String(uid), undefined, {
    uid: true,
    maxBytes: MAX_ATTACHMENT + 1,
  });
  if (!download.content) throw new Error("Message unavailable");
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of download.content) {
    const data = Buffer.from(chunk);
    size += data.length;
    if (size > MAX_ATTACHMENT) {
      download.content.destroy();
      throw new Error("Message too large");
    }
    chunks.push(data);
  }
  if (size !== message.size) throw new Error("Message size changed");
  return Buffer.concat(chunks);
}

// Fetch the exact RFC 822 bytes for signature verification, bounded before and during download.
export async function fetchMailboxRaw(
  resolve: MailboxResolver,
  mailboxId: string,
  uidValidity: string,
  uid: number,
): Promise<Buffer> {
  if (!/^\d+$/.test(uidValidity) || !Number.isSafeInteger(uid) || uid < 1)
    throw new Error("Invalid mailbox selection");
  return withMailbox(resolve, mailboxId, async (client, currentValidity) => {
    if (uidValidity !== currentValidity)
      throw new Error("Mailbox identity changed");
    return fetchRawFromClient(client, uid);
  });
}
