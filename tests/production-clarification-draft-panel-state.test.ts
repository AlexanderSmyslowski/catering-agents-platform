import { describe, expect, it } from "vitest";
import { formatClarificationDraftStatusLabel } from "../backoffice-ui/src/production-clarification-draft-panel.js";

describe("production clarification draft panel state", () => {
  it("uses operator-facing German labels for draft review states", () => {
    expect(formatClarificationDraftStatusLabel("pending_review")).toBe("Prüfung offen");
    expect(formatClarificationDraftStatusLabel("approved")).toBe("übernommen");
    expect(formatClarificationDraftStatusLabel("rejected")).toBe("verworfen");
  });
});
