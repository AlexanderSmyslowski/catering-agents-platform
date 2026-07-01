import { describe, expect, it } from "vitest";
import {
  formatClarificationDraftSourceLabel,
  formatClarificationDraftStatusLabel
} from "../backoffice-ui/src/production-clarification-draft-panel.js";
import type { ClarificationDraft } from "../backoffice-ui/src/api.js";

function draft(adapterMode: string): ClarificationDraft {
  return {
    draftId: "draft-1",
    specId: "spec-1",
    questions: [
      {
        text: "Welche Uhrzeit ist verbindlich?",
        reason: "Zeitfenster fehlt.",
        reasonCode: "event.schedule"
      }
    ],
    status: "pending_review",
    createdAt: "2026-07-01T10:00:00.000Z",
    updatedAt: "2026-07-01T10:00:00.000Z",
    modelMetadata: { adapterMode }
  };
}

describe("production clarification draft panel labels", () => {
  it("keeps adapter modes and review status values out of operator-facing draft labels", () => {
    expect(formatClarificationDraftSourceLabel(draft("fixture_only"))).toBe("Offline-Testentwurf");
    expect(formatClarificationDraftSourceLabel(draft("synthetic_live"))).toBe("KI-Entwurf");
    expect(formatClarificationDraftSourceLabel(draft("synthetic_live"))).not.toContain("synthetic_live");
    expect(formatClarificationDraftSourceLabel(draft("fixture_only"))).not.toContain("fixture");

    expect(formatClarificationDraftStatusLabel("pending_review")).toBe("wartet auf Freigabe");
    expect(formatClarificationDraftStatusLabel("approved")).toBe("übernommen");
    expect(formatClarificationDraftStatusLabel("rejected")).toBe("verworfen");
    expect(formatClarificationDraftStatusLabel("pending_review")).not.toContain("pending_review");
  });
});
