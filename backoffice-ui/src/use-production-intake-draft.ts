import { useState } from "react";
import type { IntakeDocumentChannel } from "./api.js";

const defaultProductionIntakeText =
  "Konferenz am 2026-06-18 für 90 Teilnehmer mit Lunchbuffet, Tomatensuppe und Kaffeestation.";

export function useProductionIntakeDraft() {
  const [intakeText, setIntakeText] = useState(defaultProductionIntakeText);
  const [intakeFile, setIntakeFile] = useState<File | null>(null);
  const [intakeChannel, setIntakeChannel] = useState<IntakeDocumentChannel>("pdf_upload");
  const [dragActive, setDragActive] = useState(false);
  const [uploadResultSpec, setUploadResultSpec] = useState<Record<string, unknown>>();

  function resetIntakeDraft() {
    setIntakeFile(null);
    setDragActive(false);
    setUploadResultSpec(undefined);
  }

  function startIncomingProductionFile(file: File, channel: IntakeDocumentChannel) {
    setIntakeFile(file);
    setIntakeChannel(channel);
    setUploadResultSpec(undefined);
  }

  function completeIncomingProductionFile(resultSpec?: Record<string, unknown>) {
    setIntakeFile(null);
    setDragActive(false);
    setUploadResultSpec(resultSpec);
  }

  function failIncomingProductionFile(file: File) {
    setIntakeFile(file);
    setUploadResultSpec(undefined);
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
    uploadResultSpec,
    resetIntakeDraft,
    startIncomingProductionFile,
    completeIncomingProductionFile,
    failIncomingProductionFile
  };
}
