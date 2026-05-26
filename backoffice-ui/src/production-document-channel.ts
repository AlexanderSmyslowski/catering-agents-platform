import type { IntakeDocumentChannel } from "./api.js";

type NamedDocument = {
  name: string;
};

export function channelForFile(file: NamedDocument): IntakeDocumentChannel {
  const lowerName = file.name.toLowerCase();
  if (lowerName.endsWith(".eml")) {
    return "email";
  }
  if (lowerName.endsWith(".pdf")) {
    return "pdf_upload";
  }
  return "text";
}
