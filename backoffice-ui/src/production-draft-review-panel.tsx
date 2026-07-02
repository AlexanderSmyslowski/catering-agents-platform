import { useEffect, useState } from "react";
import {
  applyProductionDraft,
  decideProductionDraft,
  decideProductionDraftReviewCard,
  loadProductionDrafts,
  type ProductionDraft,
  type ProductionDraftReviewCard,
  type ProductionDraftReviewDecision
} from "./api.js";

type ProductionDraftReviewPanelProps = {
  submitting: boolean;
  onDraftChanged?: () => Promise<void>;
};

const reviewDecisionActions = [
  { decision: "fits", label: "Passt" },
  { decision: "change_requested", label: "Änderung nötig" },
  { decision: "unclear", label: "Unklar" },
  { decision: "blocked", label: "Blockiert" }
] as const satisfies readonly {
  decision: Exclude<ProductionDraftReviewDecision, "pending">;
  label: string;
}[];

export function formatProductionDraftStatusLabel(status: ProductionDraft["status"]): string {
  if (status === "pending_review") {
    return "wartet auf Prüfung";
  }
  if (status === "approved") {
    return "freigegeben";
  }
  if (status === "rejected") {
    return "verworfen";
  }
  if (status === "superseded") {
    return "ersetzt";
  }
  return "Status offen";
}

export function formatProductionDraftReviewDecisionLabel(decision: ProductionDraftReviewDecision): string {
  if (decision === "pending") {
    return "offen";
  }
  if (decision === "fits") {
    return "passt";
  }
  if (decision === "change_requested") {
    return "Änderung nötig";
  }
  if (decision === "unclear") {
    return "unklar";
  }
  if (decision === "blocked") {
    return "blockiert";
  }
  return "offen";
}

export function formatProductionDraftSourceLabel(draft: ProductionDraft): string {
  const kind = draft.source?.kind;
  if (kind === "agent_cli") {
    return "Agenten-Entwurf";
  }
  if (kind === "ai_provider") {
    return "KI-Entwurf";
  }
  if (kind === "manual_import") {
    return "manueller Import";
  }
  if (kind === "fixture") {
    return "Testentwurf";
  }
  if (kind === "local_provider") {
    return "lokaler Provider";
  }
  return "Produktionsentwurf";
}

function eventSpecTitle(draft: ProductionDraft): string {
  const eventSpec = draft.draftArtifacts?.eventSpec;
  const event = typeof eventSpec?.event === "object" && eventSpec.event !== null
    ? eventSpec.event as Record<string, unknown>
    : undefined;
  const title = typeof event?.title === "string" ? event.title.trim() : "";
  return title || "Produktionsentwurf";
}

function canApproveProductionDraft(draft: ProductionDraft): boolean {
  return draft.status === "pending_review" &&
    draft.reviewCards.length > 0 &&
    draft.reviewCards.every((card) => card.decision === "fits" && card.riskLevel !== "blocking");
}

function canApplyProductionDraft(draft: ProductionDraft): boolean {
  return draft.status === "approved" && !draft.appliedAt;
}

function formatReviewCardMeta(card: ProductionDraftReviewCard): string {
  return [
    formatProductionDraftReviewDecisionLabel(card.decision),
    card.riskLevel === "blocking" ? "blockierendes Risiko" : undefined,
    card.requiredApproval ? "Freigabe erforderlich" : undefined
  ].filter(Boolean).join(" | ");
}

export function ProductionDraftReviewPanel({
  submitting,
  onDraftChanged
}: ProductionDraftReviewPanelProps) {
  const [drafts, setDrafts] = useState<ProductionDraft[]>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string>();

  async function reloadDrafts(options?: { clearMessage?: boolean }) {
    setLoading(true);
    try {
      const response = await loadProductionDrafts();
      setDrafts(response.items);
      if (options?.clearMessage !== false) {
        setMessage(undefined);
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Produktionsentwürfe konnten nicht geladen werden.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void reloadDrafts();
  }, []);

  async function decideCard(
    draftId: string,
    cardId: string,
    decision: Exclude<ProductionDraftReviewDecision, "pending">
  ) {
    setLoading(true);
    try {
      await decideProductionDraftReviewCard(draftId, cardId, decision);
      setMessage("Prüfpunkt aktualisiert.");
      await reloadDrafts({ clearMessage: false });
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Prüfpunkt konnte nicht aktualisiert werden.");
    } finally {
      setLoading(false);
    }
  }

  async function decideDraft(draftId: string, approve: boolean) {
    setLoading(true);
    try {
      await decideProductionDraft(draftId, approve);
      setMessage(approve ? "Produktionsentwurf freigegeben." : "Produktionsentwurf verworfen.");
      await onDraftChanged?.();
      await reloadDrafts({ clearMessage: false });
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Produktionsentwurf konnte nicht entschieden werden.");
    } finally {
      setLoading(false);
    }
  }

  async function applyDraft(draftId: string) {
    setLoading(true);
    try {
      await applyProductionDraft(draftId);
      setMessage("Produktionsentwurf übernommen.");
      await onDraftChanged?.();
      await reloadDrafts({ clearMessage: false });
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Produktionsentwurf konnte nicht übernommen werden.");
    } finally {
      setLoading(false);
    }
  }

  const visibleDrafts = drafts.filter((draft) =>
    draft.status === "pending_review" || canApplyProductionDraft(draft)
  );

  return (
    <section className="form-panel" aria-label="Produktionsentwurf-Prüfung">
      <header>
        <p className="eyebrow">Entwurf ohne Übernahme</p>
        <h3>Produktionsentwürfe prüfen</h3>
        <p className="helper-text">Produktionsentwürfe werden erst nach Prüfung für eine spätere Übernahme vorbereitet.</p>
      </header>
      {message ? (
        <p className="helper-text" role="status">
          {message}
        </p>
      ) : null}
      {visibleDrafts.length > 0 ? (
        <ul className="item-list compact">
          {visibleDrafts.map((draft) => (
            <li key={draft.draftId}>
              <strong>{eventSpecTitle(draft)}</strong>
              <p className="helper-text">
                {formatProductionDraftSourceLabel(draft)} | {formatProductionDraftStatusLabel(draft.status)} | {draft.reviewCards.length} Prüfpunkte
              </p>
              <ul className="item-list compact">
                {draft.reviewCards.map((card) => (
                  <li key={card.cardId}>
                    <strong>{card.title}</strong>
                    <p className="helper-text">{card.summary}</p>
                    <p className="helper-text">{formatReviewCardMeta(card)}</p>
                    {draft.status === "pending_review" ? (
                      <div className="action-row">
                        {reviewDecisionActions.map((action) => (
                          <button
                            key={action.decision}
                            className="secondary-button"
                            disabled={submitting || loading}
                            onClick={() => void decideCard(draft.draftId, card.cardId, action.decision)}
                          >
                            {action.label}
                          </button>
                        ))}
                      </div>
                    ) : null}
                  </li>
                ))}
              </ul>
              <div className="action-row">
                {draft.status === "pending_review" ? (
                  <>
                    <button
                      className="secondary-button"
                      disabled={submitting || loading || !canApproveProductionDraft(draft)}
                      onClick={() => void decideDraft(draft.draftId, true)}
                    >
                      Entwurf freigeben
                    </button>
                    <button
                      className="secondary-button"
                      disabled={submitting || loading}
                      onClick={() => void decideDraft(draft.draftId, false)}
                    >
                      Entwurf verwerfen
                    </button>
                  </>
                ) : null}
                {canApplyProductionDraft(draft) ? (
                  <button
                    className="secondary-button"
                    disabled={submitting || loading}
                    onClick={() => void applyDraft(draft.draftId)}
                  >
                    Entwurf übernehmen
                  </button>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="helper-text">{loading ? "Produktionsentwürfe werden geladen." : "Keine Produktionsentwürfe zur Prüfung."}</p>
      )}
    </section>
  );
}
