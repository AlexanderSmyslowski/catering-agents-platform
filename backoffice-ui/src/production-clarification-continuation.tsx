import { useEffect, useRef, useState } from "react";
import { createProductionClarificationFollowup, prepareProductionDraft, type LastAppliedProductionSnapshot, type ProductionDraft } from "./api.js";
import { announceProductionDraftReview } from "./production-draft-review-panel.js";
import { productionDraftEntryUrl } from "./production-entry-focus.js";

type Props = {
  caseId?: string;
  draft?: ProductionDraft;
  applied?: boolean;
  openQuestionCount: number;
  lastApplied?: LastAppliedProductionSnapshot;
  busy: boolean;
  onChanged?: () => Promise<void>;
};

export function ProductionClarificationContinuation({ caseId, draft, applied, openQuestionCount, lastApplied, busy, onChanged }: Props) {
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string>();
  const [refreshRequired, setRefreshRequired] = useState(false);
  const mounted = useRef(true);
  const operation = useRef(false);
  const identity = JSON.stringify([caseId, draft?.draftId, draft?.revision, draft?.status, applied, lastApplied?.draftId, lastApplied?.draftRevision, lastApplied?.approvedProductionSpecId]);
  const binding = useRef({ identity, generation: 0 });
  if (binding.current.identity !== identity) {
    binding.current = { identity, generation: binding.current.generation + 1 };
  }
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  useEffect(() => { setMessage(undefined); setRefreshRequired(false); }, [caseId, draft?.draftId]);

  async function createFollowup() {
    if (operation.current || busy || refreshRequired || !canContinue || !caseId || !draft) return;
    const generation = binding.current.generation;
    const current = () => mounted.current && binding.current.generation === generation;
    operation.current = true; setSaving(true); setMessage(undefined);
    try {
      const response = await createProductionClarificationFollowup(draft.draftId, { caseId, expectedRevision: draft.revision! });
      if (!current()) return;
      const child = response.draft;
      if (!child || child.status !== "pending_review" || child.revision !== draft.revision! + 1 || child.supersedesDraftId !== draft.draftId) {
        throw new Error("Die neue Prüffassung konnte nicht eindeutig zugeordnet werden.");
      }
      window.history.replaceState(window.history.state, "", productionDraftEntryUrl(child.draftId, caseId));
      announceProductionDraftReview(child.draftId);
      setMessage(openQuestionCount > 0 ? "Neue Prüffassung erstellt. Jetzt vorbereiten und die Rückfragen einzeln prüfen." : "Neue Prüffassung erstellt. Mengen und Rezepte müssen erneut geprüft werden; Plan und Einkauf benötigen erneut Freigabe und Übernahme.");
      await onChanged?.();
    } catch {
      if (current()) {
        setRefreshRequired(true);
        setMessage("Der neue Stand konnte nicht sicher bestätigt werden. Lade den Auftrag erneut, bevor du die Aktion wiederholst.");
      }
    } finally {
      operation.current = false;
      if (mounted.current) setSaving(false);
    }
  }

  async function prepareRevision() {
    if (operation.current || refreshRequired || !caseId || !draft || draft.status !== "pending_review") return;
    const generation = binding.current.generation;
    const current = () => mounted.current && binding.current.generation === generation;
    operation.current = true; setSaving(true); setMessage(undefined);
    try {
      const { draft: prepared } = await prepareProductionDraft(draft.draftId);
      if (!current()) return;
      if (prepared.status !== "pending_review" || prepared.supersedesDraftId !== draft.draftId || prepared.revision !== draft.revision! + 1) throw new Error("Fassung nicht zugeordnet");
      window.history.replaceState(window.history.state, "", productionDraftEntryUrl(prepared.draftId, caseId));
      announceProductionDraftReview(prepared.draftId);
      setMessage(openQuestionCount > 0 ? "Prüffassung vorbereitet. Jetzt die Rückfragen einzeln prüfen und beantworten." : "Prüffassung vorbereitet. Jetzt Plan und Einkauf prüfen.");
      await onChanged?.();
    } catch {
      if (current()) {
        setRefreshRequired(true);
        setMessage("Die Vorbereitung konnte nicht sicher abgeschlossen werden. Lade den Auftrag erneut. Prüfe danach Rezeptgrundlage und Mengen für diese Fassung.");
      }
    } finally {
      operation.current = false;
      if (mounted.current) setSaving(false);
    }
  }

  const canContinue = Boolean(caseId && draft?.status === "approved" && Number.isSafeInteger(draft.revision) && draft.revision! > 0 && applied && typeof lastApplied?.approvedProductionSpecId === "string" && Boolean(lastApplied.approvedProductionSpecId.trim()) && lastApplied?.draftId === draft.draftId && lastApplied.draftRevision === draft.revision);
  const historical = lastApplied && lastApplied.draftId !== draft?.draftId;
  const canPrepare = Boolean(historical && draft?.status === "pending_review" && draft.draftArtifacts?.eventSpec &&
    !draft.draftArtifacts.productionPlan && !draft.draftArtifacts.purchaseList);
  const historyQuery = caseId ? `?snapshotCaseId=${encodeURIComponent(caseId)}` : "";
  return <>
    {canContinue ? <section id="production-clarification-continuation" tabIndex={-1} className="production-continuation" aria-label={openQuestionCount > 0 ? "Rückfragen in einer neuen Prüffassung klären" : "Planung anpassen"}>
      <h3>{openQuestionCount > 0 ? "Offene Rückfragen klären" : "Planung anpassen"}</h3>
      <p>{openQuestionCount > 0 ? "Der übernommene Stand bleibt unverändert. Antworten werden in einer neuen Prüffassung gespeichert und anschließend erneut geprüft und freigegeben." : "Der bisherige Plan bleibt erhalten. Änderungen werden in einer neuen Prüffassung erneut geprüft, freigegeben und übernommen."}</p>
      <button className={openQuestionCount > 0 ? undefined : "secondary-button"} disabled={busy || saving || refreshRequired} onClick={() => void createFollowup()}>{saving ? "Prüffassung wird angelegt …" : openQuestionCount > 0 ? "Rückfragen in neuer Prüffassung beantworten" : "Neue Prüffassung erstellen"}</button>
    </section> : null}
    {canPrepare ? <section id="production-clarification-continuation" tabIndex={-1} className="production-continuation" aria-label="Neue Prüffassung vorbereiten">
      <h3>Prüffassung vorbereiten</h3>
      <p>Prüfe zuerst Rezeptgrundlage und Mengen für diese Fassung. {openQuestionCount > 0 ? "Danach werden Plan, Einkauf und die einzeln beantwortbaren Rückfragen zur Prüfung vorbereitet." : "Danach werden Plan und Einkauf zur Prüfung vorbereitet."}</p>
      <div className="action-row">
        <a href="#production-planning-evidence">Rezeptgrundlage und Mengen prüfen</a>
        <button disabled={busy || saving || refreshRequired} onClick={() => void prepareRevision()}>{saving ? "Wird vorbereitet …" : "Prüffassung vorbereiten"}</button>
      </div>
    </section> : null}
    {historical && caseId ? <section className="production-last-applied" aria-label="Bisherige Produktionsunterlagen">
      <h4>Letzter übernommener Stand · Fassung {lastApplied.draftRevision}</h4>
      <p>Diese Unterlagen gehören zur früheren übernommenen Fassung. Sie enthalten noch keine Änderungen der offenen Prüffassung.</p>
      <ul className="production-history-links">
        <li><a target="_blank" rel="noopener noreferrer" href={`/api/exports/v1/exports/production-plans/${encodeURIComponent(lastApplied.productionPlan.planId)}/html${historyQuery}`}>Bisherigen Produktionsplan öffnen</a></li>
        <li><a target="_blank" rel="noopener noreferrer" href={`/api/exports/v1/exports/production-folders/${encodeURIComponent(lastApplied.productionPlan.planId)}/html${historyQuery}`}>Bisherige Produktionsmappe öffnen</a></li>
        <li><a target="_blank" rel="noopener noreferrer" href={`/api/exports/v1/exports/purchase-lists/${encodeURIComponent(lastApplied.purchaseList.purchaseListId)}/csv${historyQuery}&format=excel-de`}>Bisherige Einkaufsliste herunterladen</a></li>
      </ul>
    </section> : null}
    {message ? <div role="status"><p>{message}</p><a href={productionDraftEntryUrl(draft?.draftId, caseId)}>Auftrag erneut laden</a></div> : null}
  </>;
}
