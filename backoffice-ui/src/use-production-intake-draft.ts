import { useState } from "react";
import type { IntakeDocumentChannel } from "./api.js";

export function useProductionIntakeDraft() {
  const [intakeText, setIntakeText] = useState("");
  const [intakeFile, setIntakeFile] = useState<File | null>(null);
  const [intakeChannel, setIntakeChannel] = useState<IntakeDocumentChannel>("pdf_upload");
  const [dragActive, setDragActive] = useState(false);

  function resetIntakeDraft() {
    setIntakeFile(null);
    setDragActive(false);
  }

  function startIncomingProductionFile(file: File, channel: IntakeDocumentChannel) {
    setIntakeFile(file);
    setIntakeChannel(channel);
  }

  function completeIncomingProductionFile() {
    setDragActive(false);
  }

  function failIncomingProductionFile(file: File) {
    setIntakeFile(file);
  }

  return {
    intakeText,
    setIntakeText,
    intakeFile,
    setIntakeFile,
    intakeChannel,
    setIntakeChannel,
    dragActive,
    setDragActive,
    resetIntakeDraft,
    startIncomingProductionFile,
    completeIncomingProductionFile,
    failIncomingProductionFile
  };
}
