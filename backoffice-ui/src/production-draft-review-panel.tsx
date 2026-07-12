import { useEffect, useState } from "react";
import {
  applyProductionDraft,
  decideProductionDraft,
  decideProductionDraftReviewCard,
  loadProductionDrafts,
  reviseProductionDraft,
  type ProductionDraft,
  type ProductionDraftReviewCard,
  type ProductionDraftReviewDecision
} from "./api.js";

type ProductionDraftReviewPanelProps = {
  submitting: boolean;
  embedded?: boolean;
  latestOnly?: boolean;
  onDraftChanged?: (appliedSpecId?: string) => Promise<void>;
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

function formatCount(count: number, singular: string, plural: string): string {
  return count === 1 ? `1 ${singular}` : `${count} ${plural}`;
}

function optionalArrayLength(value: unknown): number {
  return Array.isArray(value) ? value.length : 0;
}

export function formatProductionDraftArtifactSummary(draft: ProductionDraft): string {
  const artifacts = draft.draftArtifacts;
  const parts: string[] = [];

  if (artifacts?.eventSpec) {
    parts.push("Eventdaten");
  }
  if (artifacts?.productionPlan) {
    parts.push("Produktionsplan");
  }
  if (artifacts?.purchaseList) {
    parts.push("Einkaufsliste");
  }

  const recipeCount = optionalArrayLength(artifacts?.recipes);
  if (recipeCount > 0) {
    parts.push(formatCount(recipeCount, "Rezeptkarte", "Rezeptkarten"));
  }

  const questionCount = optionalArrayLength(artifacts?.openQuestions);
  if (questionCount > 0) {
    parts.push(formatCount(questionCount, "Rückfrage", "Rückfragen"));
  }

  const noteCount = optionalArrayLength(artifacts?.notes);
  if (noteCount > 0) {
    parts.push(formatCount(noteCount, "Notiz", "Notizen"));
  }

  return parts.length > 0 ? parts.join(", ") : "keine Fachartefakte";
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
  embedded = false,
  latestOnly = false,
  onDraftChanged
}: ProductionDraftReviewPanelProps) {
  const [drafts, setDrafts] = useState<ProductionDraft[]>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string>();
  const [changeEditor, setChangeEditor] = useState<{ draftId: string; cardId: string }>();
  const [changeRequest, setChangeRequest] = useState("");

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
    decision: Exclude<ProductionDraftReviewDecision, "pending">,
    operatorComment?: string
  ) {
    setLoading(true);
    try {
      await decideProductionDraftReviewCard(draftId, cardId, decision, operatorComment);
      setChangeEditor(undefined);
      setChangeRequest("");
      setMessage("Prüfpunkt aktualisiert.");
      await reloadDrafts({ clearMessage: false });
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Prüfpunkt konnte nicht aktualisiert werden.");
    } finally {
      setLoading(false);
    }
  }

  function openChangeEditor(draft: ProductionDraft, card: ProductionDraftReviewCard) {
    setChangeEditor({ draftId: draft.draftId, cardId: card.cardId });
    setChangeRequest(card.operatorComment ?? "");
  }

  async function reviseDraft(draftId: string) {
    setLoading(true);
    try {
      await reviseProductionDraft(draftId);
      setMessage("Neuer KI-Entwurf ist bereit zur Prüfung.");
      await reloadDrafts({ clearMessage: false });
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Änderungen konnten nicht eingearbeitet werden.");
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
      const response = await applyProductionDraft(draftId);
      setMessage("Produktionsentwurf übernommen.");
      await onDraftChanged?.(response.applied?.specId);
      await reloadDrafts({ clearMessage: false });
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Produktionsentwurf konnte nicht übernommen werden.");
    } finally {
      setLoading(false);
    }
  }

  const visibleDrafts = drafts
    .filter((draft) => draft.status === "pending_review" || canApplyProductionDraft(draft))
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt));
  const displayedDrafts = latestOnly ? visibleDrafts.slice(0, 1) : visibleDrafts;

  return (
    <section className={embedded ? "production-draft-review" : "form-panel production-draft-review"} aria-label="Produktionsentwurf-Prüfung">
      {!embedded ? (
        <header>
          <p className="eyebrow">Entwurf ohne Übernahme</p>
          <h3>Produktionsentwürfe prüfen</h3>
          <p className="helper-text">Produktionsentwürfe werden erst nach Prüfung für eine spätere Übernahme vorbereitet.</p>
        </header>
      ) : null}
      {message ? (
        <p className="helper-text" role="status">
          {message}
        </p>
      ) : null}
      {displayedDrafts.length > 0 ? (
        <ul className="item-list compact">
          {displayedDrafts.map((draft) => (
            <li key={draft.draftId}>
              <strong>{eventSpecTitle(draft)}</strong>
              <p className="helper-text">
                {formatProductionDraftSourceLabel(draft)} | {formatProductionDraftStatusLabel(draft.status)} | {formatCount(draft.reviewCards.length, "Prüfpunkt", "Prüfpunkte")}
              </p>
              <p className="helper-text">
                Enthält: {formatProductionDraftArtifactSummary(draft)}.
              </p>
              <ul className="item-list compact">
                {draft.reviewCards.map((card) => (
                  <li key={card.cardId}>
                    <strong>{card.title}</strong>
                    <p className="helper-text">{card.summary}</p>
                    <p className="helper-text">{formatReviewCardMeta(card)}</p>
                    {card.decision === "change_requested" && card.operatorComment && !(
                      changeEditor?.draftId === draft.draftId && changeEditor.cardId === card.cardId
                    ) ? (
                      <p className="production-draft-change-summary">
                        <strong>Änderungswunsch:</strong> {card.operatorComment}
                      </p>
                    ) : null}
                    {draft.status === "pending_review" &&
                    changeEditor?.draftId === draft.draftId && changeEditor.cardId === card.cardId ? (
                      <div className="production-draft-change-editor">
                        <label htmlFor={`change-request-${draft.draftId}-${card.cardId}`}>
                          Was soll geändert werden?
                        </label>
                        <textarea
                          id={`change-request-${draft.draftId}-${card.cardId}`}
                          aria-label="Was soll geändert werden?"
                          value={changeRequest}
                          maxLength={1000}
                          rows={3}
                          onChange={(event) => setChangeRequest(event.currentTarget.value)}
                        />
                        <p className="helper-text">
                          Die KI erstellt daraus einen neuen Entwurf. Der aktuelle Stand wird nicht direkt überschrieben.
                        </p>
                        <div className="action-row">
                          <button
                            disabled={submitting || loading || changeRequest.trim().length === 0}
                            onClick={() => void decideCard(
                              draft.draftId,
                              card.cardId,
                              "change_requested",
                              changeRequest.trim()
                            )}
                          >
                            Änderung vormerken
                          </button>
                          <button
                            className="secondary-button"
                            disabled={submitting || loading}
                            onClick={() => {
                              setChangeEditor(undefined);
                              setChangeRequest("");
                            }}
                          >
                            Abbrechen
                          </button>
                        </div>
                      </div>
                    ) : draft.status === "pending_review" ? (
                      <div className="action-row">
                        {reviewDecisionActions.map((action) => (
                          <button
                            key={action.decision}
                            className="secondary-button"
                            disabled={submitting || loading}
                            onClick={() => {
                              if (action.decision === "change_requested") {
                                openChangeEditor(draft, card);
                                return;
                              }
                              void decideCard(draft.draftId, card.cardId, action.decision);
                            }}
                          >
                            {action.label}
                          </button>
                        ))}
                      </div>
                    ) : null}
                  </li>
                ))}
              </ul>
              {draft.status === "pending_review" && draft.reviewCards.some((card) =>
                card.decision === "change_requested" && Boolean(card.operatorComment?.trim())
              ) ? (
                <div className="production-draft-revision-action">
                  <div>
                    <strong>Änderungen sind vorgemerkt.</strong>
                    <p className="helper-text">
                      Die KI arbeitet alle kommentierten Punkte in einen neuen, erneut zu prüfenden Entwurf ein.
                    </p>
                  </div>
                  <button
                    disabled={submitting || loading}
                    onClick={() => void reviseDraft(draft.draftId)}
                  >
                    Änderungen von KI einarbeiten
                  </button>
                </div>
              ) : null}
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
