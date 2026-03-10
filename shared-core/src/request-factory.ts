import type { EventRequest } from "./types.js";
import { SCHEMA_VERSION } from "./types.js";

export function createEventRequestFromText(input: {
  requestId: string;
  channel: EventRequest["source"]["channel"];
  rawText: string;
  sourceRef?: string;
}): EventRequest {
  return {
    schemaVersion: SCHEMA_VERSION,
    requestId: input.requestId,
    source: {
      channel: input.channel,
      receivedAt: new Date().toISOString(),
      sourceRef: input.sourceRef
    },
    rawInputs: [
      {
        kind:
          input.channel === "email"
            ? "email"
            : input.channel === "pdf_upload"
              ? "pdf"
              : "text",
        content: input.rawText
      }
    ]
  };
}
