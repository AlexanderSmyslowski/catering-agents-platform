import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const docPath = "docs/architecture/PA60_LLM_RUNTIME_CONVERSATION_SESSION_DECISION_FRAME.md";
const doc = existsSync(docPath) ? readFileSync(docPath, "utf8") : "";
const readme = readFileSync("README.md", "utf8");
const testing = readFileSync("TESTING.md", "utf8");
const memory = readFileSync("memory.md", "utf8");

describe("PA60 LLM runtime/conversation session decision frame", () => {
  it("anchors the next runtime frame as documentation-only and not runtime work", () => {
    expect(existsSync(docPath)).toBe(true);
    expect(doc).toContain("PA60 LLM Runtime-/ConversationSession-Entscheidungsrahmen");
    expect(doc).toContain("Status: Entscheidungsvorlage und Vertragstest, keine neue Runtime-Implementierung");
    expect(doc).toContain("kein Deployment");
    expect(doc).toContain("keine neue Runtime-Conversation");
    expect(doc).toContain("keine neue API");
    expect(doc).toContain("keine Persistenz");
    expect(doc).toContain("keine Migration");
    expect(doc).toContain("keine echten Daten");
    expect(doc).toContain("keine Produktschreibwirkung");
  });

  it("uses the projection boundary and existing sister frames as leading anchors", () => {
    for (const anchor of [
      "`ProductionConversationProjection` bleibt die bestehende read-only Projektion",
      "die LLM-Readiness-Vertraege bleiben bisher ohne Runtime-`ConversationSession`",
      "PA58 hat Human Approval und Operator-Handover geklaert",
      "PA59 hat danach die Tool-/Write-Effect-Grenzen festgezogen",
      "bestehende Projektionen und vorhandene Objekte bleiben fuehrend"
    ]) {
      expect(doc).toContain(anchor);
    }
  });

  it("recommends keeping the first released draft path free of a new conversation runtime", () => {
    for (const anchor of [
      "Option A:",
      "Option B:",
      "Option C:",
      "Minimale sichere Bedingungen fuer Option B:",
      "Klare Empfehlung:",
      "Option B in der kleinsten moeglichen Form",
      "keine neue Runtime-`ConversationSession` fuer den ersten freigegebenen Draft-Pfad",
      "keine neue Chat-/Session-API, keine Session-Persistenz",
      "keine automatische Uebertragung aus einer hypothetischen Session in `AcceptedEventSpec`",
      "keine neue API, keine Persistenz, keine Produktschreibwirkung"
    ]) {
      expect(doc).toContain(anchor);
    }
  });

  it("keeps the new frame discoverable from core references", () => {
    expect(readme).toContain(docPath);
    expect(testing).toContain(docPath);
    expect(testing).toContain("tests/pa60-llm-runtime-conversation-session-decision-frame.test.ts");
    expect(memory).toContain(docPath);
  });
});
