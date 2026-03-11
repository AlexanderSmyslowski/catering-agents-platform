import { createEventRequestFromText, extractTextFromDocument } from "@catering/shared-core";

export function buildEventRequestFromText(input: {
  requestId: string;
  channel: Parameters<typeof createEventRequestFromText>[0]["channel"];
  rawText: string;
  sourceRef?: string;
}) {
  return createEventRequestFromText(input);
}

export { extractTextFromDocument };
