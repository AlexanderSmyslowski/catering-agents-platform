import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { buildIntakeApp, IntakeStore } from "@catering/intake-service";

function createDataRoot(): string {
  return mkdtempSync(path.join(tmpdir(), "catering-agents-intake-request-"));
}

const createdRoots: string[] = [];

afterEach(() => {
  while (createdRoots.length > 0) {
    const root = createdRoots.pop();
    if (root) {
      rmSync(root, { recursive: true, force: true });
    }
  }
});

describe("intake request detail endpoint", () => {
  it("returns a persisted intake request by requestId", async () => {
    const dataRoot = createDataRoot();
    createdRoots.push(dataRoot);
    const app = buildIntakeApp(new IntakeStore({ rootDir: dataRoot }));

    const createResponse = await app.inject({
      method: "POST",
      url: "/v1/intake/normalize",
      payload: {
        requestId: "request-detail-1",
        text: "Konferenz am 2026-05-12 fuer 80 Teilnehmer mit Lunchbuffet."
      }
    });

    expect(createResponse.statusCode).toBe(201);

    const detailResponse = await app.inject({
      method: "GET",
      url: "/v1/intake/requests/request-detail-1"
    });

    expect(detailResponse.statusCode).toBe(200);
    expect(detailResponse.json().requestId).toBe("request-detail-1");
    expect(detailResponse.json().source.channel).toBe("text");

    await app.close();
  });

  it("returns 404 for an unknown intake request", async () => {
    const dataRoot = createDataRoot();
    createdRoots.push(dataRoot);
    const app = buildIntakeApp(new IntakeStore({ rootDir: dataRoot }));

    const detailResponse = await app.inject({
      method: "GET",
      url: "/v1/intake/requests/unknown-request"
    });

    expect(detailResponse.statusCode).toBe(404);
    expect(detailResponse.json().message).toBe("Intake-Anfrage nicht gefunden.");

    await app.close();
  });
});
