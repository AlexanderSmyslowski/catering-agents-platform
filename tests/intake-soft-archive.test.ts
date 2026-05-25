import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { AuditLogStore } from "@catering/shared-core";
import { IntakeStore, buildIntakeApp } from "@catering/intake-service";

function createDataRoot(): string {
  return mkdtempSync(path.join(tmpdir(), "catering-intake-archive-"));
}

describe("intake soft archive", () => {
  it("takes a failed upload context out of active intake lists without hard-deleting it", async () => {
    const dataRoot = createDataRoot();
    const auditLog = new AuditLogStore({ rootDir: dataRoot });
    const app = buildIntakeApp({
      rootDir: dataRoot,
      store: new IntakeStore({ rootDir: dataRoot }),
      auditLog
    });

    try {
      const createResponse = await app.inject({
        method: "POST",
        url: "/v1/intake/documents",
        payload: {
          requestId: "fehlupload-archive-1",
          channel: "pdf_upload",
          documents: [
            {
              filename: "falsches-testangebot.txt",
              mimeType: "text/plain",
              contentBase64: Buffer.from(
                "Meeting am 2026-08-14 fuer 35 Teilnehmer mit Kaffeepause und Croissants.",
                "utf8"
              ).toString("base64")
            }
          ]
        }
      });

      expect(createResponse.statusCode).toBe(201);
      const created = createResponse.json() as {
        eventRequest: { requestId: string };
        acceptedEventSpec: { specId: string };
      };

      const archiveResponse = await app.inject({
        method: "POST",
        url: "/v1/intake/requests/fehlupload-archive-1/archive",
        payload: {
          reasonCode: "wrong_upload"
        }
      });

      expect(archiveResponse.statusCode).toBe(200);
      const archived = archiveResponse.json() as {
        eventRequest: {
          requestId: string;
          operationalArchive?: {
            status: string;
            mode: string;
            reasonCode: string;
            archivedBy: string;
          };
        };
        archivedSpecIds: string[];
        hardDeleted: boolean;
      };

      expect(archived.eventRequest.requestId).toBe(created.eventRequest.requestId);
      expect(archived.eventRequest.operationalArchive).toMatchObject({
        status: "archived",
        mode: "soft_archive",
        reasonCode: "wrong_upload",
        archivedBy: "Intake-Mitarbeiter"
      });
      expect(archived.archivedSpecIds).toEqual([created.acceptedEventSpec.specId]);
      expect(archived.hardDeleted).toBe(false);

      const activeRequests = (await app.inject({
        method: "GET",
        url: "/v1/intake/requests"
      })).json() as { items: Array<{ requestId: string }> };
      expect(activeRequests.items.map((item) => item.requestId)).not.toContain("fehlupload-archive-1");

      const activeSpecs = (await app.inject({
        method: "GET",
        url: "/v1/intake/specs"
      })).json() as { items: Array<{ specId: string }> };
      expect(activeSpecs.items.map((item) => item.specId)).not.toContain(created.acceptedEventSpec.specId);

      const allRequests = (await app.inject({
        method: "GET",
        url: "/v1/intake/requests?includeArchived=true"
      })).json() as { items: Array<{ requestId: string }> };
      expect(allRequests.items.map((item) => item.requestId)).toContain("fehlupload-archive-1");

      const detailResponse = await app.inject({
        method: "GET",
        url: "/v1/intake/requests/fehlupload-archive-1"
      });
      expect(detailResponse.statusCode).toBe(200);
      expect(detailResponse.json().operationalArchive).toMatchObject({
        status: "archived",
        mode: "soft_archive",
        reasonCode: "wrong_upload"
      });

      const specDetailResponse = await app.inject({
        method: "GET",
        url: `/v1/intake/specs/${created.acceptedEventSpec.specId}`
      });
      expect(specDetailResponse.statusCode).toBe(200);
      expect(specDetailResponse.json().operationalArchive).toMatchObject({
        status: "archived",
        mode: "soft_archive",
        reasonCode: "wrong_upload"
      });

      const auditEvents = await auditLog.listRecent(10);
      expect(auditEvents).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            action: "intake.request_soft_archived",
            entityType: "EventRequest",
            entityId: "fehlupload-archive-1",
            details: expect.objectContaining({
              requestId: "fehlupload-archive-1",
              reasonCode: "wrong_upload",
              archivedSpecCount: 1,
              hardDeleted: false
            })
          })
        ])
      );
    } finally {
      await app.close();
      rmSync(dataRoot, { recursive: true, force: true });
    }
  });

  it("rejects unknown archive reason codes", async () => {
    const dataRoot = createDataRoot();
    const app = buildIntakeApp(new IntakeStore({ rootDir: dataRoot }));

    try {
      const response = await app.inject({
        method: "POST",
        url: "/v1/intake/requests/does-not-matter/archive",
        payload: {
          reasonCode: "contains-free-text"
        }
      });

      expect(response.statusCode).toBe(400);
      expect(response.json()).toEqual({
        message:
          "reasonCode muss wrong_upload, duplicate_test_data oder operator_rehearsal_cleanup sein."
      });
    } finally {
      await app.close();
      rmSync(dataRoot, { recursive: true, force: true });
    }
  });
});
