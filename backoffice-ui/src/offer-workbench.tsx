import { OfferEventEditor } from "./offer-event-editor.js";
import { OfferPricingEditor } from "./offer-pricing-editor.js";
import type { PricingSummary } from "@catering/shared-core";
import { OfferMenuEditor } from "./offer-menu-editor.js";
import { useEffect, useMemo, useState, type ChangeEvent } from "react";
import { offerExportUrl, type IntakeDocumentChannel } from "./api.js";
import { MiniPilotCheckPanel } from "./mini-pilot-check-panel.js";
import type { MiniPilotCheckReportState } from "./mini-pilot-check-report-state.js";
import { shouldShowMiniPilotPanel } from "./mini-pilot-panel-gate.js";
import { buildOfferMiniPilotActionState } from "./offer-mini-pilot-action-state.js";
import { buildOfferMiniPilotCardState } from "./offer-mini-pilot-card-state.js";
import { getSpecLabel } from "./production-language.js";
import type { OfferApprovalBinding } from "./offer-approval-action.js";

type ManualSpecInput = {
  eventType: string;
  eventDate: string;
  attendeeCount: string;
  serviceForm: string;
  menuItems: string;
  customerName: string;
  venueName: string;
  notes: string;
};

type ManualSpecActions = {
  setEventType: (value: string) => void;
  setEventDate: (value: string) => void;
  setAttendeeCount: (value: string) => void;
  setServiceForm: (value: string) => void;
  setMenuItems: (value: string) => void;
  setCustomerName: (value: string) => void;
  setVenueName: (value: string) => void;
  setNotes: (value: string) => void;
  submitManualSpec: () => Promise<void>;
};

type SpecEditInput = {
  editingSpecId?: string;
  eventType: string;
  eventDate: string;
  attendeeCount: string;
  serviceForm: string;
  menuItems: string;
};

type SpecEditActions = {
  beginSpecEdit: (spec: Record<string, unknown>) => void;
  setEventType: (value: string) => void;
  setEventDate: (value: string) => void;
  setAttendeeCount: (value: string) => void;
  setServiceForm: (value: string) => void;
  setMenuItems: (value: string) => void;
  saveSpecEdit: () => Promise<void>;
  resetSpecEdit: () => void;
};

export type OfferWorkbenchProps = {
  submitting: boolean;
  hasActiveOfferCase?: boolean;
  latestSourceLabel: string;
  offerText: string;
  setOfferText: (value: string) => void;
  submitOfferText: () => Promise<void>;
  intakeText: string;
  setIntakeText: (value: string) => void;
  submitIntakeText: () => Promise<void>;
  intakeChannel: IntakeDocumentChannel;
  setIntakeChannel: (value: IntakeDocumentChannel) => void;
  intakeFile: File | null;
  setIntakeFile: (file: File | null) => void;
  submitIntakeDocument: () => Promise<void>;
  manualInput: ManualSpecInput;
  manualActions: ManualSpecActions;
  filteredOfferDrafts: Array<Record<string, unknown>>;
  activeDraft?: Record<string, unknown>;
  selectedDraft?: Record<string, unknown>;
  setSelectedDraftId: (draftId: string) => void;
  selectedVariantId?: string;
  setSelectedVariantId?: (variantId: string | undefined) => void;
  approveDraft: (draftId: string, revision: number, variantId: string) => Promise<void>;
  onMenuEditingChange?: (editing: boolean) => void;
  onMenuSaved?: (draftId: string) => Promise<void>;
  approvalBinding?: OfferApprovalBinding;
  openProductionHandoff?: (handoffId: string) => Promise<void>;
  createHandoff?: (offerDraftId: string, offerDraftRevision: number, approvedOfferId: string) => Promise<void>;
  filteredSpecs: Array<Record<string, unknown>>;
  activeSpec?: Record<string, unknown>;
  completeSpecCount: number;
  partialSpecCount: number;
  miniPilotRawResult: string;
  setMiniPilotRawResult: (value: string) => void;
  miniPilotReportState: MiniPilotCheckReportState;
  miniPilotStorageHintLabel?: string;
  specEdit: SpecEditInput;
  specEditActions: SpecEditActions;
};

function translateReadiness(value?: string): string {
  const labels: Record<string, string> = {
    complete: "vollständig",
    partial: "teilweise vollständig",
    insufficient: "unzureichend"
  };
  return value ? labels[value] ?? value : "-";
}

function getReadinessLabel(spec?: Record<string, unknown>): string {
  return translateReadiness(String((spec?.readiness as Record<string, unknown> | undefined)?.status ?? "-"));
}

function countDraftOpenQuestions(draft?: Record<string, unknown>): number {
  return Array.isArray(draft?.openQuestions) ? draft.openQuestions.length : 0;
}

function getDraftVariants(draft?: Record<string, unknown>): Array<Record<string, unknown>> {
  return Array.isArray(draft?.variantSet) ? (draft.variantSet as Array<Record<string, unknown>>) : [];
}

function getDraftId(draft?: Record<string, unknown>): string {
  return draft ? String(draft.draftId ?? "-") : "kein Entwurf";
}

function getDraftRevision(draft?: Record<string, unknown>): number | undefined {
  const revision = draft?.revision;
  return Number.isInteger(revision) && Number(revision) > 0 ? Number(revision) : undefined;
}

function getDraftProposedSpec(draft?: Record<string, unknown>): Record<string, unknown> | undefined {
  const proposedSpec = draft?.proposedEventSpec;
  return proposedSpec && typeof proposedSpec === "object" && !Array.isArray(proposedSpec)
    ? (proposedSpec as Record<string, unknown>)
    : undefined;
}

function formatDraftSourceLineage(spec?: Record<string, unknown>): string | undefined {
  const sourceLineage = spec?.sourceLineage;
  if (!Array.isArray(sourceLineage) || sourceLineage.length === 0) {
    return undefined;
  }

  const firstSource = sourceLineage[0] as Record<string, unknown>;
  const sourceType = typeof firstSource.sourceType === "string" ? firstSource.sourceType : "Quelle";
  const reference = typeof firstSource.reference === "string" && firstSource.reference.trim() ? firstSource.reference : "-";
  return `${sourceType}: ${reference}`;
}

function formatOfferSummaryCount(count: number, singular: string, plural: string): string {
  return count === 1 ? `1 ${singular}` : `${count} ${plural}`;
}

function renderDraftSummary(draft?: Record<string, unknown>): string {
  if (!draft) {
    return "Noch kein Angebotsentwurf vorhanden.";
  }
  const variants = getDraftVariants(draft).length;
  const questions = countDraftOpenQuestions(draft);
  return `${String(draft.eventSummary ?? "Unbenannter Entwurf")} · ${formatOfferSummaryCount(variants, "Variante", "Varianten")} · ${formatOfferSummaryCount(questions, "offener Punkt", "offene Punkte")}`;
}

function renderDraftFocusLabel(draft?: Record<string, unknown>): string {
  if (!draft) {
    return "kein Entwurf";
  }
  const spec = getDraftProposedSpec(draft);
  const customer = String((spec?.customer as Record<string, unknown> | undefined)?.name ?? "").trim();
  return spec && customer
    ? `${customer} · ${getSpecLabel(spec)}`
    : String(draft.eventSummary ?? "Unbenannter Entwurf");
}

function getSpecRequestId(spec: Record<string, unknown>): string {
  const requestId = spec.requestId;
  return typeof requestId === "string" && requestId.trim() ? requestId.trim() : "-";
}

export function OfferConversationalWorkbench({
  submitting,
  hasActiveOfferCase,
  latestSourceLabel,
  offerText,
  setOfferText,
  submitOfferText,
  intakeText,
  setIntakeText,
  submitIntakeText,
  intakeChannel,
  setIntakeChannel,
  intakeFile,
  setIntakeFile,
  submitIntakeDocument,
  manualInput,
  manualActions,
  filteredOfferDrafts,
  activeDraft,
  selectedDraft,
  setSelectedDraftId,
  selectedVariantId,
  setSelectedVariantId = () => undefined,
  approveDraft,
  approvalBinding,
  openProductionHandoff,
  onMenuSaved,
  onMenuEditingChange,
  createHandoff,
  filteredSpecs,
  activeSpec,
  completeSpecCount,
  partialSpecCount,
  miniPilotRawResult,
  setMiniPilotRawResult,
  miniPilotReportState,
  miniPilotStorageHintLabel,
  specEdit,
  specEditActions
}: OfferWorkbenchProps) {
  const miniPilotActionState = buildOfferMiniPilotActionState(miniPilotReportState, miniPilotStorageHintLabel);
  const showMiniPilotActionClear = miniPilotRawResult.trim().length > 0;
  const showMiniPilotPanel = shouldShowMiniPilotPanel();
  const focusedDraft = selectedDraft ?? activeDraft;
  const miniPilotCard = buildOfferMiniPilotCardState();
  const focusedDraftId = getDraftId(focusedDraft);
  const focusedDraftRevision = getDraftRevision(focusedDraft);
  const focusedApprovalBinding = approvalBinding?.offerDraftId === focusedDraftId
    && approvalBinding.offerDraftRevision === focusedDraftRevision
    ? approvalBinding
    : undefined;
  const focusedHandoffId = focusedApprovalBinding?.handoffId;
  const focusedDraftSpec = getDraftProposedSpec(focusedDraft);
  const focusedDraftSource = formatDraftSourceLineage(focusedDraftSpec);
  const summaryActiveSpec = focusedDraftSpec ?? activeSpec;
  const focusedVariants = getDraftVariants(focusedDraft);
  const focusedPricing = focusedDraft?.pricingSummary as PricingSummary | undefined;
  const incompletePricingTax = Boolean(focusedPricing?.calculationRequired || (focusedPricing?.calculation && focusedPricing.calculation.grossCents === undefined));
  const focusedOpenQuestions = Array.isArray(focusedDraft?.openQuestions)
    ? (focusedDraft.openQuestions as string[])
    : [];
  const [editingMenu, setEditingMenu] = useState(false);
  const [editingEvent, setEditingEvent] = useState(false);
  const [editingPricing, setEditingPricing] = useState(false);
  useEffect(() => { setEditingMenu(false); setEditingPricing(false); setEditingEvent(false); onMenuEditingChange?.(false); }, [focusedDraftId]);
  const [historySearch, setHistorySearch] = useState("");
  const visibleOfferDrafts = useMemo(() => {
    const query = historySearch.trim().toLowerCase();
    if (!query) {
      return [...filteredOfferDrafts].reverse();
    }
    return [...filteredOfferDrafts]
      .reverse()
      .filter((draft) => `${renderDraftFocusLabel(draft)} ${renderDraftSummary(draft)}`.toLowerCase().includes(query));
  }, [filteredOfferDrafts, historySearch]);

  return (
    <section className="offer-conversation-layout" aria-label="Angebotsagent Conversational Workbench">
      <details className="offer-composer" aria-label="Zentrale Angebotsarbeit" open={!hasActiveOfferCase && !focusedDraft}>
        <summary>{hasActiveOfferCase || focusedDraft ? "Weitere Unterlage zu diesem Auftrag" : "Neue Kundenanfrage"}</summary>
        <header className="offer-composer__header">

          <h3>{hasActiveOfferCase || focusedDraft ? "Text oder Datei ergänzen" : "Kundenanfrage einfügen"}</h3>
          <p className="helper-text">
            Die App erstellt einen prüfbaren Angebotsentwurf. Eine Variante wird erst intern freigegeben und anschließend ausdrücklich an die Produktion übergeben.
          </p>
        </header>
        {!hasActiveOfferCase && !focusedDraft ? (
          <div className="field-label">
            <label htmlFor="offer-customer-name">Kunde / Auftraggeber für die Textanfrage</label>
            <input
              id="offer-customer-name"
              aria-describedby="offer-customer-help"
              value={manualInput.customerName}
              onChange={(event) => manualActions.setCustomerName(event.target.value)}
              maxLength={320}
              disabled={submitting}
              placeholder="Organisation oder Testkennung"
              autoComplete="organization"
            />
            <span id="offer-customer-help" className="helper-text">Damit du den Auftrag später in Angebot und Produktion wiederfindest.</span>
          </div>
        ) : null}
        <textarea
          className="offer-composer__textarea"
          aria-label="Kundenanfrage als Text"
          value={offerText}
          onChange={(event) => setOfferText(event.target.value)}
          placeholder="Kundenanfrage oder E-Mail-Text hier einfügen …"
        />
        <div className="quiet-action-row" aria-label="Anfrage als Datei übernehmen">
          <label className="secondary-button">
            Datei auswählen
            <input
              className="visually-hidden"
              aria-label="Anfragedatei auswählen"
              type="file"
              accept=".pdf,.txt,.md,.eml,text/plain,message/rfc822,application/pdf"
              onChange={(event: ChangeEvent<HTMLInputElement>) => {
                setIntakeChannel("pdf_upload");
                setIntakeFile(event.target.files?.[0] ?? null);
              }}
            />
          </label>
          {intakeFile ? <span>{intakeFile.name}</span> : null}
          {intakeFile ? (
            <button disabled={submitting || editingMenu || editingPricing || editingEvent} onClick={() => void submitIntakeDocument()}>
              Datei als Anfrage erfassen
            </button>
          ) : null}
        </div>
        <div className="offer-composer__next-step">
          <button disabled={submitting || editingMenu || editingPricing || editingEvent || !offerText.trim()} onClick={() => void submitOfferText()}>
            Entwurf aus Text erstellen
          </button>

        </div>
      </details>



      {focusedDraft ? (
        <>
          <aside className="offer-calm-summary" aria-label="Kompakte Ergebniszusammenfassung" tabIndex={-1}>
            <h3>Auftragsstand</h3>
            <strong>{renderDraftSummary(focusedDraft)}</strong>
            <dl className="order-status-facts" role="status">
              <div><dt>Angebot</dt><dd>{focusedApprovalBinding ? "Intern freigegeben" : "Noch nicht freigegeben"}</dd></div>
              <div><dt>Küche</dt><dd>{focusedHandoffId ? "Übergeben – Planung im Produktionsauftrag" : "Noch nicht übergeben"}</dd></div>
              <div><dt>Unterlagen</dt><dd>{editingMenu || editingPricing || editingEvent ? "Nach dem Speichern verfügbar" : incompletePricingTax || !focusedPricing?.calculation ? "Export als Entwurf; Kalkulation unvollständig" : "Angebot zum Drucken und Exportieren verfügbar"}</dd></div>
            </dl>
            <section className="order-safety-notes" aria-label="Vor jeder Freigabe prüfen">
              <h4>Vor jeder Freigabe prüfen</h4>
              <p>Nur interne Demo- oder Testdaten; keine echten Kundendaten, keine externe Freigabe.</p>
              <p>Keine automatische Preis-, Margen- oder Produktionsfreigabe.</p>
              {incompletePricingTax ? <p>Kalkulation unvollständig. Preise und Steuer vor Freigabe erfassen.</p> : null}
            </section>
            {focusedDraft || summaryActiveSpec || focusedDraftSource || latestSourceLabel ? (
              <details className="technical-context-details">
                <summary>Technische Details</summary>
                <p className="helper-text">Entwurf: {focusedDraftId}</p>
                {focusedDraftSource ? <p className="helper-text">Entwurfs-Quelle: {focusedDraftSource}</p> : null}
                <p className="helper-text">Quelle: {focusedDraftSource ?? latestSourceLabel}</p>
                {summaryActiveSpec ? (
                  <p className="helper-text">
                    Aktive Spezifikation: {String(summaryActiveSpec.specId ?? "-")} ({getReadinessLabel(summaryActiveSpec)})
                  </p>
                ) : null}
              </details>
            ) : null}
            {showMiniPilotPanel ? (
              <>
                <div className="search-trace" aria-label="Interner Draft-Pilot">
                  <p className="eyebrow">{miniPilotCard.eyebrow}</p>
                  <strong>{miniPilotCard.title}</strong>
                  <p className="helper-text">{miniPilotCard.helperText}</p>
                  <ul className="item-list trace-list">
                    {miniPilotCard.steps.map((step) => (
                      <li key={step.title}>
                        <strong>{step.title}</strong>
                        <p className="helper-text">{step.body}</p>
                      </li>
                    ))}
                  </ul>
                </div>
                <MiniPilotCheckPanel
                  rawResult={miniPilotRawResult}
                  onRawResultChange={setMiniPilotRawResult}
                  reportState={miniPilotReportState}
                  storageHintLabel={miniPilotStorageHintLabel}
                />
              </>
            ) : null}
          </aside>

          <div className="offer-progressive-zone">
        <details className="progressive-panel" open={Boolean(focusedDraft)}>
          <summary>
            <span>Angebotsentwurf prüfen</span>
            <strong>
              {focusedDraft
                ? `${formatOfferSummaryCount(focusedVariants.length, "Variante", "Varianten")} · ${formatOfferSummaryCount(focusedOpenQuestions.length, "offener Punkt", "offene Punkte")}`
                : "noch kein Entwurf"}
            </strong>
          </summary>
          {focusedDraft ? (
            <div className="progressive-panel__body">
              {focusedDraftSpec || focusedDraftSource ? (
                <details className="technical-context-details">
                  <summary>Technische Details</summary>
                  {focusedDraftSpec ? (
                    <p className="helper-text">
                      Entwurfs-Spec: {String(focusedDraftSpec.specId ?? "-")} ({getReadinessLabel(focusedDraftSpec)})
                    </p>
                  ) : null}
                  {focusedDraftSource ? <p className="helper-text">Entwurfs-Quelle: {focusedDraftSource}</p> : null}
                </details>
              ) : null}
              {focusedOpenQuestions.length > 0 ? (
                <section aria-label="Offene Punkte"><h3>Offene Punkte ({focusedOpenQuestions.length})</h3><ul className="item-list compact">
                  {focusedOpenQuestions.map((question) => (
                    <li key={question}>{question}</li>
                  ))}
                </ul></section>
              ) : (
                <p className="helper-text">Offene Punkte: keine</p>
              )}
        {focusedDraftSpec?.event && focusedDraftSpec.servicePlan && onMenuSaved ? <OfferEventEditor
          draftId={focusedDraftId} revision={focusedDraftRevision ?? 1}
          spec={focusedDraftSpec as unknown as import("@catering/shared-core").AcceptedEventSpec}
          disabled={submitting || editingPricing || editingMenu}
          onEditingChange={value => { setEditingEvent(value); onMenuEditingChange?.(value || editingMenu || editingPricing); }}
          onSaved={onMenuSaved}
        /> : null}
              {onMenuSaved && focusedDraftRevision !== undefined ? (
                <OfferMenuEditor
                  key={focusedDraftId}
                  draftId={focusedDraftId}
                  revision={focusedDraftRevision}
                  menuPlan={Array.isArray(focusedDraftSpec?.menuPlan) ? focusedDraftSpec.menuPlan as Array<Record<string, unknown>> : []}
                  onSaved={onMenuSaved}
                  disabled={submitting || editingPricing || editingEvent}
                  onEditingChange={(editing) => { setEditingMenu(editing); onMenuEditingChange?.(editing || editingPricing || editingEvent); }}
                />
              ) : null}
              {onMenuSaved && focusedDraftRevision !== undefined ? (
                <OfferPricingEditor key={"pricing-" + focusedDraftId} draftId={focusedDraftId} revision={focusedDraftRevision}
                  variants={focusedVariants.map(item => ({ variantId: String(item.variantId), label: String(item.label),
                    guests: Number((item.proposedEventSpec as { attendees?: { expected?: number } } | undefined)?.attendees?.expected ?? 0),
                    menuPlan: (item.proposedEventSpec as { menuPlan?: Array<Record<string, unknown>> } | undefined)?.menuPlan }))}
                  menuPlan={Array.isArray(focusedDraftSpec?.menuPlan) ? focusedDraftSpec.menuPlan as Array<Record<string, unknown>> : []}
                  pricingSummary={focusedDraft?.pricingSummary as PricingSummary | undefined}
                  onSaved={onMenuSaved} disabled={submitting || editingMenu || editingEvent}
                  onEditingChange={editing => { setEditingPricing(editing); onMenuEditingChange?.(editing || editingMenu || editingEvent); }} />
              ) : null}
              {showMiniPilotPanel ? (
                <div className="search-trace" aria-label="Mini-Pilot-Status vor Uebernahme">
                  <p className="eyebrow">{miniPilotActionState.eyebrow}</p>
                  <strong>{miniPilotActionState.title}</strong>
                  <p className="helper-text">{miniPilotActionState.statusLabel}</p>
                  <p className="helper-text">{miniPilotActionState.reasonLabel}</p>
                  {miniPilotActionState.trustLabel ? (
                    <p className="helper-text">{miniPilotActionState.trustLabel}</p>
                  ) : null}
                  {miniPilotActionState.provenanceLabel ? (
                    <p className="helper-text">{miniPilotActionState.provenanceLabel}</p>
                  ) : null}
                  {miniPilotActionState.cautionLabel ? (
                    <p className="helper-text">{miniPilotActionState.cautionLabel}</p>
                  ) : null}
                  <p className="helper-text">{miniPilotActionState.helperText}</p>
                  <p className="helper-text">
                    Lokaler Check: <code>{miniPilotActionState.commandLabel}</code>
                  </p>
                  {showMiniPilotActionClear ? (
                    <div className="quiet-action-row">
                      <button
                        type="button"
                        className="secondary-button"
                        onClick={() => setMiniPilotRawResult("")}
                      >
                        Mini-Pilot-Stand leeren
                      </button>
                    </div>
                  ) : null}
                </div>
              ) : null}
              <div className="quiet-action-row">
                {!focusedApprovalBinding && focusedVariants.map((variant) => {
                  const variantId = String(variant.variantId);
                  return (
                    <button
                      key={variantId}
                      className="secondary-button"
                      aria-pressed={selectedVariantId === variantId}
                      disabled={submitting || editingMenu || editingPricing || editingEvent || incompletePricingTax || focusedDraftRevision === undefined}
                      onClick={() => {
                        setSelectedVariantId(variantId);
                        if (focusedDraftRevision !== undefined) {
                          void approveDraft(focusedDraftId, focusedDraftRevision, variantId);
                        }
                      }}
                    >
                      {`Variante freigeben: ${String(variant.label ?? variantId)}`}
                    </button>
                  );
                })}
                {editingMenu || editingPricing || editingEvent ? (
                  <span className="helper-text">Vor dem Export Änderungen speichern oder verwerfen.</span>
                ) : (
                  <a className="ghost-link" href={offerExportUrl(focusedDraftId)} target="_blank" rel="noreferrer">
                    Angebot exportieren
                  </a>
                )}
                {(focusedApprovalBinding || focusedHandoffId) ? <details className="technical-context-details"><summary>Übergabeaktionen anzeigen</summary>
                {focusedApprovalBinding && !focusedHandoffId && createHandoff ? (
                  <button
                    className="secondary-button"
                    disabled={submitting || editingMenu || editingPricing || editingEvent}
                    onClick={() => void createHandoff(focusedDraftId, focusedApprovalBinding.offerDraftRevision, focusedApprovalBinding.approvedOfferId)}
                  >
                    An Produktion übergeben
                  </button>
                ) : null}
                {focusedHandoffId && openProductionHandoff ? (
                  <button
                    className="secondary-button"
                    disabled={submitting || editingMenu || editingPricing || editingEvent}
                    onClick={() => void openProductionHandoff(focusedHandoffId)}
                  >
                    Produktionsauftrag öffnen
                  </button>
                ) : null}
                </details> : null}
              </div>
              <details className="nested-details">
                <summary>Angebotstexte anzeigen</summary>
                {focusedPricing?.calculation ? <pre className="detail-pre">{String(focusedDraft.customerFacingText ?? "")}</pre> : <p>Kein Kundentext freigegeben: Leistungsumfang und Preisaufstellung zuerst erfassen. Automatische Paketvorschläge sind keine bestätigten Leistungen.</p>}
                <pre className="detail-pre">{String(focusedDraft.internalWorkingText ?? "")}</pre>
              </details>
            </div>
          ) : (
            <p className="helper-text">Noch kein Entwurf ausgewählt.</p>
          )}
        </details>

      {filteredOfferDrafts.length > 1 ? (
        <details className="panel secondary-workspace offer-history-details">
          <summary>

            <span className="subsection-title">Fassungen dieses Auftrags</span>
            <span className="helper-text">
              {filteredOfferDrafts.length === 1 ? "1 Entwurf" : `${filteredOfferDrafts.length} Entwürfe`}
            </span>
          </summary>
          <div className="secondary-workspace__content">
            <input
              className="search"
              aria-label="Angebotsentwürfe durchsuchen"
              placeholder="Kunde, Anlass, Datum oder Personen suchen"
              value={historySearch}
              onChange={(event) => setHistorySearch(event.target.value)}
            />
            <ul className="quiet-list">
              {visibleOfferDrafts.map((draft) => (
                <li key={String(draft.draftId)}>
                  <button
                    type="button"
                    className="quiet-list__button"
                    disabled={submitting || editingMenu || editingPricing || editingEvent}
                    onClick={() => setSelectedDraftId(String(draft.draftId))}
                  >
                    <strong>{renderDraftFocusLabel(draft)}</strong>
                    <span>{renderDraftSummary(draft)}</span>
                  </button>
                </li>
              ))}
              {visibleOfferDrafts.length === 0 ? <li>Keine passenden Entwürfe gefunden.</li> : null}
            </ul>
          </div>
        </details>
      ) : null}

        <details className="progressive-panel">
          <summary>
            <span>Alternative Erfassung</span>
            <strong>Text, Datei oder manuelle Angaben</strong>
          </summary>
          <div className="progressive-panel__body compact-form-grid">
            <section>
              <h3>Anfrage als Text übernehmen</h3>
              <p className="helper-text">Für kopierte E-Mails oder Notizen, die zuerst als Anfrage erfasst werden sollen.</p>
              <textarea
                aria-label="Anfrage zur Erfassung"
                value={intakeText}
                onChange={(event) => setIntakeText(event.target.value)}
                placeholder="Anfragetext einfügen"
              />
              <button disabled={submitting || editingMenu || editingPricing || editingEvent} onClick={() => void submitIntakeText()}>
                Text als Anfrage übernehmen
              </button>
            </section>
            <section>
              <h3>Anfrage aus Datei übernehmen</h3>
              <p className="helper-text">Für ein PDF-Angebot, eine E-Mail-Datei oder eine Textdatei.</p>
              <label htmlFor="offer-intake-channel">Dateityp</label>
              <select
                id="offer-intake-channel"
                className="operator-input"
                value={intakeChannel}
                onChange={(event) => setIntakeChannel(event.target.value as IntakeDocumentChannel)}
              >
                <option value="pdf_upload">PDF / Angebot</option>
                <option value="email">E-Mail</option>
                <option value="text">Textdatei</option>
              </select>
              <input
                className="file-input"
                aria-label="Anfragedatei auswählen"
                type="file"
                accept=".pdf,.txt,.md,.eml,text/plain,message/rfc822,application/pdf"
                onChange={(event: ChangeEvent<HTMLInputElement>) => setIntakeFile(event.target.files?.[0] ?? null)}
              />
              <button disabled={submitting || editingMenu || editingPricing || editingEvent} onClick={() => void submitIntakeDocument()}>
                Datei als Anfrage übernehmen
              </button>
              {intakeFile ? <p className="helper-text">Ausgewählt: {intakeFile.name}</p> : null}
            </section>
            <section>
              <h3>Veranstaltungsdaten manuell eingeben</h3>
              <p className="helper-text">Nur nutzen, wenn keine Kundenanfrage als Text oder Datei vorliegt.</p>
              <input value={manualInput.eventType} onChange={(event) => manualActions.setEventType(event.target.value)} placeholder="Veranstaltungstyp" />
              <input value={manualInput.eventDate} onChange={(event) => manualActions.setEventDate(event.target.value)} placeholder="Datum" />
              <input value={manualInput.attendeeCount} onChange={(event) => manualActions.setAttendeeCount(event.target.value)} placeholder="Teilnehmerzahl" />
              <input value={manualInput.serviceForm} onChange={(event) => manualActions.setServiceForm(event.target.value)} placeholder="Serviceform" />
              <input value={manualInput.menuItems} onChange={(event) => manualActions.setMenuItems(event.target.value)} placeholder="Menüpunkte" />
              <input value={manualInput.customerName} onChange={(event) => manualActions.setCustomerName(event.target.value)} placeholder="Kundenname" />
              <input value={manualInput.venueName} onChange={(event) => manualActions.setVenueName(event.target.value)} placeholder="Ort" />
              <textarea value={manualInput.notes} onChange={(event) => manualActions.setNotes(event.target.value)} placeholder="Interne Notizen" />
              <button disabled={submitting || editingMenu || editingPricing || editingEvent} onClick={() => void manualActions.submitManualSpec()}>
                Angaben übernehmen
              </button>
            </section>
          </div>
        </details>

        <details className="progressive-panel">
          <summary>
            <span>Erfasste Veranstaltungsdaten</span>
            <span>Erfasste Daten: {completeSpecCount} vollständig · {partialSpecCount} teilweise</span>
            <strong>{formatOfferSummaryCount(filteredSpecs.length, "Vorgang", "Vorgänge")}</strong>
          </summary>
          <ul className="quiet-list">
            {filteredSpecs.map((spec) => (
              <li key={String(spec.specId)} className="quiet-list__row">
                <div>
                  <strong>{getSpecLabel(spec)}</strong>
                  <span>Status: {getReadinessLabel(spec)}</span>
                  <details className="technical-context-details">
                    <summary>Technische Details</summary>
                    <span>specId: {String(spec.specId ?? "-")}</span>
                    <span>requestId: {getSpecRequestId(spec)}</span>
                  </details>
                </div>
                <div className="quiet-action-row">
                  {!focusedDraft ? <button className="secondary-button" disabled={submitting || editingMenu || editingPricing || editingEvent} onClick={() => specEditActions.beginSpecEdit(spec)}>
                    Bearbeiten
                  </button> : <span className="helper-text">Unveränderter Anfrageursprung. Veranstaltungsdaten oben am Angebot als neue Fassung bearbeiten.</span>}
                  <span className="helper-text">Die Produktionsübergabe erfolgt am freigegebenen Angebotsentwurf.</span>
                </div>
              </li>
            ))}
            {filteredSpecs.length === 0 ? <li>Noch keine Veranstaltungsdaten übernommen.</li> : null}
          </ul>
          {!focusedDraft && specEdit.editingSpecId ? (
            <div className="compact-edit-form">
              <h3>Veranstaltungsdaten bearbeiten</h3>
              <input value={specEdit.eventType} onChange={(event) => specEditActions.setEventType(event.target.value)} placeholder="Veranstaltungstyp" />
              <input value={specEdit.eventDate} onChange={(event) => specEditActions.setEventDate(event.target.value)} placeholder="Datum" />
              <input value={specEdit.attendeeCount} onChange={(event) => specEditActions.setAttendeeCount(event.target.value)} placeholder="Teilnehmerzahl" />
              <input value={specEdit.serviceForm} onChange={(event) => specEditActions.setServiceForm(event.target.value)} placeholder="Serviceform" />
              <textarea value={specEdit.menuItems} onChange={(event) => specEditActions.setMenuItems(event.target.value)} placeholder="Menüpunkte" />
              <div className="quiet-action-row">
                <button disabled={submitting || editingMenu || editingPricing || editingEvent} onClick={() => void specEditActions.saveSpecEdit()}>
                  Änderungen speichern
                </button>
                <button className="secondary-button" disabled={submitting || editingMenu || editingPricing || editingEvent} onClick={specEditActions.resetSpecEdit}>
                  Abbrechen
                </button>
              </div>
            </div>
          ) : null}
        </details>
          </div>
        </>
      ) : null}
    </section>
  );
}
