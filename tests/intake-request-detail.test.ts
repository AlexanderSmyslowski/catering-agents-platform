import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { IntakeStore, buildIntakeApp } from "@catering/intake-service";

function createDataRoot(): string {
  return mkdtempSync(path.join(tmpdir(), "catering-agents-"));
}

describe("intake request detail", () => {
  it("returns the stored EventRequest by requestId", async () => {
    const dataRoot = createDataRoot();
    const app = buildIntakeApp(new IntakeStore({ rootDir: dataRoot }));

    try {
      const createResponse = await app.inject({
        method: "POST",
        url: "/v1/intake/normalize",
        payload: {
          requestId: "request-detail-1",
          text: "Konferenz am 2026-05-12 fuer 120 Teilnehmer mit Lunchbuffet und Wasserstation."
        }
      });

      expect(createResponse.statusCode).toBe(201);

      const detailResponse = await app.inject({
        method: "GET",
        url: "/v1/intake/requests/request-detail-1"
      });

      expect(detailResponse.statusCode).toBe(200);
      const requestBody = detailResponse.json() as {
        requestId: string;
        rawInputs: Array<{ kind: string }>;
        source: { channel: string };
      };

      expect(requestBody.requestId).toBe("request-detail-1");
      expect(requestBody.source.channel).toBe("text");
      expect(requestBody.rawInputs[0].kind).toBe("text");

      const missingResponse = await app.inject({
        method: "GET",
        url: "/v1/intake/requests/does-not-exist"
      });

      expect(missingResponse.statusCode).toBe(404);
      expect(missingResponse.json()).toEqual({ message: "EventRequest nicht gefunden." });
    } finally {
      await app.close();
      rmSync(dataRoot, { recursive: true, force: true });
    }
  });
});
