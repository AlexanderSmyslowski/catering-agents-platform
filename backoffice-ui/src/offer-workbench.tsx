import type { ChangeEvent } from "react";
import { offerExportUrl, type IntakeDocumentChannel } from "./api.js";
import { MiniPilotCheckPanel } from "./mini-pilot-check-panel.js";
import type { MiniPilotCheckReportState } from "./mini-pilot-check-report-state.js";
import { shouldShowMiniPilotPanel } from "./mini-pilot-panel-gate.js";
import { buildOfferMiniPilotActionState } from "./offer-mini-pilot-action-state.js";
import { buildOfferMiniPilotCardState } from "./offer-mini-pilot-card-state.js";
import { getSpecLabel } from "./production-language.js";

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
  promoteDraft: (draftId: string, variantId: string) => Promise<void>;
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
  return String(draft.eventSummary ?? "Unbenannter Entwurf");
}

function renderOfferNextStep(draft?: Record<string, unknown>): string {
  if (!draft) {
    return "Jetzt: Kundenanfrage einfügen und einen prüfbaren Entwurf erstellen.";
  }

  return "Jetzt: offene Punkte prüfen und eine Variante übernehmen. Danach kannst du das Angebot exportieren oder an die Produktion übergeben.";
}

function getSpecRequestId(spec: Record<string, unknown>): string {
  const requestId = spec.requestId;
  return typeof requestId === "string" && requestId.trim() ? requestId.trim() : "-";
}

export function OfferConversationalWorkbench({
  submitting,
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
  promoteDraft,
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
  const focusedDraftLabel = renderDraftFocusLabel(focusedDraft);
  const focusedDraftSpec = getDraftProposedSpec(focusedDraft);
  const focusedDraftSource = formatDraftSourceLineage(focusedDraftSpec);
  const summaryActiveSpec = focusedDraftSpec ?? activeSpec;
  const focusedVariants = getDraftVariants(focusedDraft);
  const focusedOpenQuestions = Array.isArray(focusedDraft?.openQuestions)
    ? (focusedDraft.openQuestions as string[])
    : [];

  return (
    <section className="offer-conversation-layout" aria-label="Angebotsagent Conversational Workbench">
      <article className="offer-composer" aria-label="Zentrale Angebotsarbeit">
        <header className="offer-composer__header">
          <p className="eyebrow">Neue Anfrage</p>
          <h3>Kundenanfrage einfügen und Entwurf prüfen</h3>
          <p className="helper-text">
            Die App erstellt einen prüfbaren Angebotsentwurf. Erst eine von dir gewählte Variante wird an die Produktion übergeben.
          </p>
        </header>
        <textarea
          className="offer-composer__textarea"
          aria-label="Kundenanfrage als Text"
          value={offerText}
          onChange={(event) => setOfferText(event.target.value)}
          placeholder="Kundenanfrage oder E-Mail-Text hier einfügen …"
        />
        <div className="offer-composer__next-step">
          <button disabled={submitting} onClick={() => void submitOfferText()}>
            Entwurf aus Text erstellen
          </button>
          <span>{focusedDraft ? `Aktueller Entwurf: ${focusedDraftLabel}` : "Als Nächstes: Anfrage einfügen"}</span>
        </div>
      </article>

      <aside className="offer-calm-summary" aria-label="Kompakte Ergebniszusammenfassung">
        <p className="eyebrow">Zusammenfassung</p>
        <strong>{renderDraftSummary(focusedDraft)}</strong>
        <p className="helper-text">Arbeitsstand: Anfrage, Entwurf, Export und Übergabe bleiben sichtbar.</p>
        <p className="helper-text">
          Grenze: nur interne Demo- oder Testdaten; keine echten Kundendaten, keine externe Freigabe.
        </p>
        <p className="helper-text">
          Bitte vor Freigabe prüfen: keine automatische Preis-, Margen- oder Produktionsfreigabe.
        </p>
        <p className="helper-text">{renderOfferNextStep(focusedDraft)}</p>
        <p className="helper-text">
          Produktionsübergabe: {completeSpecCount} vollständig · {partialSpecCount} teilweise · aktueller Vorgang:{" "}
          {summaryActiveSpec ? `${getSpecLabel(summaryActiveSpec)} (${getReadinessLabel(summaryActiveSpec)})` : "keine"}
        </p>
        <p className="helper-text">
          {focusedDraft
            ? "Export: Angebots-HTML für den aktuellen Entwurf bereit"
            : "Export/Freigabe: noch kein Entwurf, kein Exportartefakt und keine Freigabe vorhanden."}
        </p>
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
              <p>{String(focusedDraft.eventSummary ?? "-")}</p>
              <p className="helper-text">
                Varianten: {focusedVariants.length} · Offene Punkte: {focusedOpenQuestions.length}
              </p>
              {focusedDraftSpec ? (
                <p className="helper-text">
                  Veranstaltungsdaten im Entwurf: {getSpecLabel(focusedDraftSpec)} ({getReadinessLabel(focusedDraftSpec)})
                </p>
              ) : null}
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
                <ul className="item-list compact">
                  {focusedOpenQuestions.map((question) => (
                    <li key={question}>{question}</li>
                  ))}
                </ul>
              ) : (
                <p className="helper-text">Offene Punkte: keine</p>
              )}
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
                {focusedVariants.map((variant) => (
                  <button
                    key={String(variant.variantId)}
                    className="secondary-button"
                    disabled={submitting}
                    onClick={() => void promoteDraft(focusedDraftId, String(variant.variantId))}
                  >
                    {`Variante übernehmen: ${String(variant.label ?? variant.variantId)}`}
                  </button>
                ))}
                <a className="ghost-link" href={offerExportUrl(focusedDraftId)} target="_blank" rel="noreferrer">
                  Angebot exportieren
                </a>
              </div>
              <details className="nested-details">
                <summary>Angebotstexte anzeigen</summary>
                <pre className="detail-pre">{String(focusedDraft.customerFacingText ?? "")}</pre>
                <pre className="detail-pre">{String(focusedDraft.internalWorkingText ?? "")}</pre>
              </details>
            </div>
          ) : (
            <p className="helper-text">Noch kein Entwurf ausgewählt.</p>
          )}
        </details>

        <details className="progressive-panel">
          <summary>
            <span>Weitere Entwürfe</span>
            <strong>{filteredOfferDrafts.length} Entwürfe</strong>
          </summary>
          <ul className="quiet-list">
            {filteredOfferDrafts.map((draft) => (
              <li key={String(draft.draftId)}>
                <button
                  type="button"
                  className="quiet-list__button"
                  disabled={submitting}
                  onClick={() => setSelectedDraftId(String(draft.draftId))}
                >
                  <strong>{String(draft.draftId)}</strong>
                  <span>{renderDraftSummary(draft)}</span>
                </button>
              </li>
            ))}
            {filteredOfferDrafts.length === 0 ? <li>Noch keine Angebotsentwürfe vorhanden.</li> : null}
          </ul>
        </details>

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
              <button disabled={submitting} onClick={() => void submitIntakeText()}>
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
              <button disabled={submitting} onClick={() => void submitIntakeDocument()}>
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
              <button disabled={submitting} onClick={() => void manualActions.submitManualSpec()}>
                Angaben übernehmen
              </button>
            </section>
          </div>
        </details>

        <details className="progressive-panel">
          <summary>
            <span>Für die Produktion übernommene Veranstaltungen</span>
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
                  <button className="secondary-button" disabled={submitting} onClick={() => specEditActions.beginSpecEdit(spec)}>
                    Bearbeiten
                  </button>
                  <a className="button-link button-link--subtle" href="/produktion">
                    Zur Produktion
                  </a>
                </div>
              </li>
            ))}
            {filteredSpecs.length === 0 ? <li>Noch keine Veranstaltungsdaten übernommen.</li> : null}
          </ul>
          {specEdit.editingSpecId ? (
            <div className="compact-edit-form">
              <h3>Veranstaltungsdaten bearbeiten</h3>
              <input value={specEdit.eventType} onChange={(event) => specEditActions.setEventType(event.target.value)} placeholder="Veranstaltungstyp" />
              <input value={specEdit.eventDate} onChange={(event) => specEditActions.setEventDate(event.target.value)} placeholder="Datum" />
              <input value={specEdit.attendeeCount} onChange={(event) => specEditActions.setAttendeeCount(event.target.value)} placeholder="Teilnehmerzahl" />
              <input value={specEdit.serviceForm} onChange={(event) => specEditActions.setServiceForm(event.target.value)} placeholder="Serviceform" />
              <textarea value={specEdit.menuItems} onChange={(event) => specEditActions.setMenuItems(event.target.value)} placeholder="Menüpunkte" />
              <div className="quiet-action-row">
                <button disabled={submitting} onClick={() => void specEditActions.saveSpecEdit()}>
                  Änderungen speichern
                </button>
                <button className="secondary-button" disabled={submitting} onClick={specEditActions.resetSpecEdit}>
                  Abbrechen
                </button>
              </div>
            </div>
          ) : null}
        </details>
      </div>
    </section>
  );
}
