import { simpleParser } from "mailparser";

export interface ParsedSupplierMessage {
  from: string;
  subject: string;
  attachments: Array<{
    part: string;
    filename: string;
    contentType: string;
    content: Buffer;
  }>;
}

/** Extract only from the exact bytes whose signature is verified by the caller. */
export async function parseSupplierMessage(
  raw: Buffer,
): Promise<ParsedSupplierMessage> {
  if (!Buffer.isBuffer(raw) || raw.length === 0 || raw.length > 5_000_000)
    throw new Error("Message size invalid");
  const parsed = await simpleParser(raw, {
    skipHtmlToText: true,
    skipTextToHtml: true,
    skipImageLinks: true,
    maxHtmlLengthToParse: 0,
  });
  const addresses = parsed.from?.value ?? [];
  if (addresses.length !== 1 || !addresses[0]?.address)
    throw new Error("Ambiguous sender");
  if (parsed.attachments.length > 40) throw new Error("Too many attachments");
  let total = 0;
  const attachments = parsed.attachments.map((attachment, index) => {
    total += attachment.content.length;
    if (total > 5_000_000 || attachment.content.length > 5_000_000)
      throw new Error("Attachments too large");
    return {
      part: String(index + 1),
      filename: (attachment.filename ?? "attachment").slice(0, 255),
      contentType: attachment.contentType.slice(0, 100),
      content: attachment.content,
    };
  });
  const from = addresses[0].address;
  const at = from.lastIndexOf("@");
  if (at < 1) throw new Error("Invalid sender");
  return {
    from: from.slice(0, at) + "@" + from.slice(at + 1).toLowerCase(),
    subject: (parsed.subject ?? "").slice(0, 500),
    attachments,
  };
}
