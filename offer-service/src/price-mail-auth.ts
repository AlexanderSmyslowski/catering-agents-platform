import { Resolver } from "node:dns/promises";
import { dkimVerify } from "mailauth/lib/dkim/verify";

type LookupTxt = (name: string) => Promise<string[][]>;

/** False leaves the price list available for personal review. No mailbox headers establish trust on their own. */
export async function verifyPriceMail(
  raw: Buffer,
  sender: string,
  requireSubject: boolean,
  lookupTxt?: LookupTxt,
): Promise<boolean> {
  const at = sender.lastIndexOf("@");
  if (at <= 0 || raw.length > 5_000_000) return false;
  const domain = sender.slice(at + 1).toLowerCase();
  const boundary = raw.indexOf("\r\n\r\n");
  if (boundary < 0 || boundary > 65_536) return false;
  const headers = raw
    .subarray(0, boundary)
    .toString("latin1")
    .split(/\r\n(?![ \t])/);
  const names = headers.map((line) =>
    line.slice(0, line.indexOf(":")).toLowerCase(),
  );
  const signatures = names.filter((key) => key === "dkim-signature").length;
  if (!signatures || signatures > 4 || names.length > 250) return false;
  const required = ["from", "content-type"];
  if (requireSubject) required.push("subject");
  for (const optional of [
    "mime-version",
    "content-transfer-encoding",
    "content-disposition",
  ]) {
    if (names.includes(optional)) required.push(optional);
  }
  if (required.some((key) => names.filter((name) => name === key).length !== 1))
    return false;
  const resolver = new Resolver({ timeout: 1500, tries: 1 });
  const timer = setTimeout(() => resolver.cancel(), 4500);
  try {
    const evidence = await dkimVerify(raw, {
      strict: true,
      minBitLength: 1024,
      rejectRsaSha1: true,
      resolver: async (host, type) => {
        if (
          type !== "TXT" ||
          !host.toLowerCase().endsWith("._domainkey." + domain)
        )
          throw new Error("Unrelated key");
        return lookupTxt ? lookupTxt(host) : resolver.resolveTxt(host);
      },
    });
    if (
      evidence.fromFields !== 1 ||
      evidence.fromSyntax !== "valid" ||
      evidence.headerFrom.length !== 1
    )
      return false;
    const actual = evidence.headerFrom[0];
    if (
      actual.slice(0, actual.lastIndexOf("@")) !== sender.slice(0, at) ||
      actual.slice(actual.lastIndexOf("@") + 1).toLowerCase() !== domain
    )
      return false;
    return evidence.results.some((result) => {
      const signed = new Set(
        result.signingHeaders?.headers.map((line) =>
          line.slice(0, line.indexOf(":")).toLowerCase(),
        ),
      );
      return (
        result.status.result === "pass" &&
        result.signingDomain?.toLowerCase() === domain &&
        ["rsa-sha256", "ed25519-sha256"].includes(result.algo ?? "") &&
        result.canonBodyLengthLimited === false &&
        result.signatureTimeValid !== false &&
        required.every((key) => signed.has(key))
      );
    });
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
    resolver.cancel();
  }
}
