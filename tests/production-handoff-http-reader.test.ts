import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { describe, expect, it } from "vitest";
import { HttpProductionHandoffReader } from "../production-service/src/gateways/http-production-handoff-reader.js";

async function listen(server: Server): Promise<string> {
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  const address = server.address() as AddressInfo;
  return `http://127.0.0.1:${address.port}`;
}

async function close(server: Server): Promise<void> {
  server.closeAllConnections?.();
  await new Promise<void>((resolve, reject) => {
    server.close((error) => error ? reject(error) : resolve());
  });
}

describe("HTTP production handoff reader", () => {
  it("does not follow redirects or forward the trusted service identity to another origin", async () => {
    const targetRequests: Array<{ businessId: string | undefined; secret: string | undefined }> = [];
    const target = createServer((request, response) => {
      targetRequests.push({
        businessId: request.headers["x-catering-business-id"] as string | undefined,
        secret: request.headers["x-catering-trusted-secret"] as string | undefined
      });
      response.writeHead(502);
      response.end();
    });
    const targetUrl = await listen(target);
    const redirector = createServer((_request, response) => {
      response.writeHead(302, { location: `${targetUrl}/credential-capture` });
      response.end();
    });
    const redirectorUrl = await listen(redirector);
    const reader = new HttpProductionHandoffReader({
      offerServiceUrl: redirectorUrl,
      trustedServiceSecret: "trusted-service-secret"
    });

    try {
      await expect(reader.getHandoff({ businessId: "local" }, "handoff-redirect-probe"))
        .rejects.toThrow("Produktionsübergabe konnte nicht geladen werden.");
      expect(targetRequests).toEqual([]);
    } finally {
      await Promise.all([close(redirector), close(target)]);
    }
  });
});
