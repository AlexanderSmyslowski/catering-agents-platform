import { useEffect, useState } from "react";
import {
  createClarificationDraft,
  decideClarificationDraft,
  loadClarificationDrafts,
  type ClarificationDraft
} from "./api.js";

type ProductionClarificationDraftPanelProps = {
  specId?: string;
  submitting: boolean;
  onDraftChanged?: () => Promise<void>;
};

export function formatClarificationDraftSourceLabel(draft: ClarificationDraft): string {
  return draft.modelMetadata?.adapterMode === "fixture_only"
    ? "Offline-Testentwurf"
    : "KI-Entwurf";
}

export function formatClarificationDraftStatusLabel(status: ClarificationDraft["status"]): string {
  if (status === "pending_review") {
    return "wartet auf Freigabe";
  }
  if (status === "approved") {
    return "übernommen";
  }
  if (status === "rejected") {
    return "verworfen";
  }
  return "Status offen";
}

function shouldShowLlmDraftsPanel(): boolean {
  const env = (import.meta as ImportMeta & { env?: Record<string, string | undefined> }).env;
  return env?.VITE_SHOW_LLM_DRAFTS === "1";
}

export function ProductionClarificationDraftPanel({
  specId,
  submitting,
  onDraftChanged
}: ProductionClarificationDraftPanelProps) {
  const [drafts, setDrafts] = useState<ClarificationDraft[]>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string>();

  const showPanel = shouldShowLlmDraftsPanel();

  async function reloadDrafts() {
    if (!specId) {
      setDrafts([]);
      return;
    }

    setLoading(true);
    try {
      const response = await loadClarificationDrafts(specId);
      setDrafts(response.items);
      setMessage(undefined);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "KI-Entwürfe konnten nicht geladen werden.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!showPanel) {
      return;
    }

    void reloadDrafts();
  }, [showPanel, specId]);

  if (!showPanel || !specId) {
    return null;
  }

  const pendingDrafts = drafts.filter((draft) => draft.status === "pending_review");

  async function generateDraft() {
    if (!specId) {
      return;
    }

    setLoading(true);
    try {
      await createClarificationDraft(specId);
      setMessage("KI-Rückfragen-Entwurf erzeugt.");
      await reloadDrafts();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "KI-Rückfragen-Entwurf konnte nicht erzeugt werden.");
    } finally {
      setLoading(false);
    }
  }

  async function decideDraft(draftId: string, approve: boolean) {
    setLoading(true);
    try {
      await decideClarificationDraft(draftId, approve);
      setMessage(approve ? "KI-Rückfragen-Entwurf übernommen." : "KI-Rückfragen-Entwurf verworfen.");
      await onDraftChanged?.();
      await reloadDrafts();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "KI-Rückfragen-Entwurf konnte nicht entschieden werden.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="form-panel" aria-label="KI-Rückfragen-Entwürfe">
      <header>
        <p className="eyebrow">Draft-only</p>
        <h3>KI-Rückfragen-Entwürfe</h3>
        <p className="helper-text">KI-Entwurf — wird erst nach Freigabe Teil der Spezifikation.</p>
      </header>
      <div className="action-row">
        <button
          className="secondary-button"
          disabled={submitting || loading}
          onClick={() => void generateDraft()}
        >
          KI-Rückfragen-Entwurf erzeugen
        </button>
      </div>
      {message ? (
        <p className="helper-text" role="status">
          {message}
        </p>
      ) : null}
      {pendingDrafts.length > 0 ? (
        <ul className="item-list compact">
          {pendingDrafts.map((draft) => (
            <li key={draft.draftId}>
              <strong>{draft.questions[0]?.text ?? "Rückfragen-Entwurf"}</strong>
              <p className="helper-text">
                {formatClarificationDraftSourceLabel(draft)} · {formatClarificationDraftStatusLabel(draft.status)}
              </p>
              <div className="action-row">
                <button
                  className="secondary-button"
                  disabled={submitting || loading}
                  onClick={() => void decideDraft(draft.draftId, true)}
                >
                  Übernehmen
                </button>
                <button
                  className="secondary-button"
                  disabled={submitting || loading}
                  onClick={() => void decideDraft(draft.draftId, false)}
                >
                  Verwerfen
                </button>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="helper-text">Keine offenen KI-Rückfragen-Entwürfe.</p>
      )}
    </section>
  );
}
