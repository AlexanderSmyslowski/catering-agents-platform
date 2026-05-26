import type { ChangeEvent } from "react";
import { offerExportUrl, type IntakeDocumentChannel } from "./api.js";
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

type OfferWorkbenchProps = {
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

function renderDraftSummary(draft?: Record<string, unknown>): string {
  if (!draft) {
    return "Noch kein Angebotsentwurf vorhanden.";
  }
  const variants = getDraftVariants(draft).length;
  const questions = countDraftOpenQuestions(draft);
  return `${String(draft.eventSummary ?? "Unbenannter Entwurf")} · ${variants} Varianten · ${questions} offene Punkte`;
}

function renderOfferNextStep(draft?: Record<string, unknown>): string {
  if (!draft) {
    return "Nächster Angebotsschritt: Anfrage einfügen oder Demo über Start nutzen, dann Entwurf prüfen.";
  }

  return `Nächster Angebotsschritt: Entwurf ${getDraftId(draft)} prüfen, Variante übernehmen, Angebots-HTML exportieren und zur Produktion wechseln.`;
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
  specEdit,
  specEditActions
}: OfferWorkbenchProps) {
  const focusedDraft = selectedDraft ?? activeDraft;
  const focusedDraftId = getDraftId(focusedDraft);
  const focusedDraftSpec = getDraftProposedSpec(focusedDraft);
  const focusedDraftSource = formatDraftSourceLineage(focusedDraftSpec);
  const summarySourceLabel = focusedDraftSource ?? latestSourceLabel;
  const summaryActiveSpec = focusedDraftSpec ?? activeSpec;
  const focusedVariants = getDraftVariants(focusedDraft);
  const focusedOpenQuestions = Array.isArray(focusedDraft?.openQuestions)
    ? (focusedDraft.openQuestions as string[])
    : [];

  return (
    <section className="offer-conversation-layout" aria-label="Angebotsagent Conversational Workbench">
      <article className="offer-composer" aria-label="Zentrale Angebotsarbeit">
        <header className="offer-composer__header">
          <p className="eyebrow">Angebotsarbeit</p>
          <h3>Kundenanfrage einfügen und ruhigen Entwurf erzeugen</h3>
          <p className="helper-text">
            Primärfläche für die Anfrage. Bestehende strukturierte Daten bleiben darunter prüfbar, aber nicht im Vordergrund.
          </p>
        </header>
        <textarea
          className="offer-composer__textarea"
          value={offerText}
          onChange={(event) => setOfferText(event.target.value)}
          placeholder="Kundenanfrage, E-Mail oder Angebotsnotiz hier einfügen ..."
        />
        <div className="offer-composer__next-step">
          <button disabled={submitting} onClick={() => void submitOfferText()}>
            Angebotsentwurf erzeugen
          </button>
          <span>{focusedDraft ? `Aktueller Fokus: ${focusedDraftId}` : "Nächster Schritt: Anfrage einfügen"}</span>
        </div>
      </article>

      <aside className="offer-calm-summary" aria-label="Kompakte Ergebniszusammenfassung">
        <p className="eyebrow">Zusammenfassung</p>
        <strong>{renderDraftSummary(focusedDraft)}</strong>
        <p className="helper-text">Quelle: {summarySourceLabel}</p>
        <p className="helper-text">Interner Beta-Schritt: Anfrage, Entwurf, Export und Übergabe bleiben nachvollziehbar.</p>
        <p className="helper-text">
          Synthetische Beta-Grenze: Entwürfe und Exporte nur intern prüfen; keine echten Kunden-/Produktionsdaten,
          keine externe Freigabe, keine Produktions- oder Compliance-Freigabe.
        </p>
        <p className="helper-text">
          Reviewer-Hinweis: nur fiktive P7-Szenarioangaben nutzen; Evidenz als Route, Erwartung, Beobachtung und Beleg notieren.
        </p>
        <p className="helper-text">{renderOfferNextStep(focusedDraft)}</p>
        <p className="helper-text">
          Übergabe: {completeSpecCount} vollständig · {partialSpecCount} teilweise · aktive Spezifikation:{" "}
          {summaryActiveSpec ? `${String(summaryActiveSpec.specId ?? "-")} (${getReadinessLabel(summaryActiveSpec)})` : "keine"}
        </p>
        <p className="helper-text">
          {focusedDraft
            ? `Export: Angebots-HTML für ${focusedDraftId} bereit`
            : "Export/Freigabe: noch kein Entwurf, kein Exportartefakt und keine Freigabe vorhanden."}
        </p>
      </aside>

      <div className="offer-progressive-zone">
        <details className="progressive-panel" open={Boolean(focusedDraft)}>
          <summary>
            <span>Ausgewählter Entwurf</span>
            <strong>{focusedDraftId}</strong>
          </summary>
          {focusedDraft ? (
            <div className="progressive-panel__body">
              <p>{String(focusedDraft.eventSummary ?? "-")}</p>
              <p className="helper-text">
                Varianten: {focusedVariants.length} · Offene Punkte: {focusedOpenQuestions.length}
              </p>
              {focusedDraftSpec ? (
                <p className="helper-text">
                  Entwurfs-Spec: {String(focusedDraftSpec.specId ?? "-")} ({getReadinessLabel(focusedDraftSpec)})
                </p>
              ) : null}
              {focusedDraftSource ? <p className="helper-text">Entwurfs-Quelle: {focusedDraftSource}</p> : null}
              {focusedOpenQuestions.length > 0 ? (
                <ul className="item-list compact">
                  {focusedOpenQuestions.map((question) => (
                    <li key={question}>{question}</li>
                  ))}
                </ul>
              ) : (
                <p className="helper-text">Offene Punkte: keine</p>
              )}
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
                <summary>Entwurfstexte anzeigen</summary>
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
            <span>Entwurfsübersicht</span>
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
            <span>Weitere Eingabewege</span>
            <strong>Intake, Datei, Direkterfassung</strong>
          </summary>
          <div className="progressive-panel__body compact-form-grid">
            <section>
              <p className="eyebrow">Kundenanfrage normalisieren</p>
              <textarea value={intakeText} onChange={(event) => setIntakeText(event.target.value)} />
              <button disabled={submitting} onClick={() => void submitIntakeText()}>
                Erfassungstext normalisieren
              </button>
            </section>
            <section>
              <p className="eyebrow">Dokument übernehmen</p>
              <select
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
                type="file"
                accept=".pdf,.txt,.md,.eml,text/plain,message/rfc822,application/pdf"
                onChange={(event: ChangeEvent<HTMLInputElement>) => setIntakeFile(event.target.files?.[0] ?? null)}
              />
              <button disabled={submitting} onClick={() => void submitIntakeDocument()}>
                Dokument normalisieren
              </button>
              {intakeFile ? <p className="helper-text">Ausgewählt: {intakeFile.name}</p> : null}
            </section>
            <section>
              <p className="eyebrow">Strukturierte Direkterfassung</p>
              <input value={manualInput.eventType} onChange={(event) => manualActions.setEventType(event.target.value)} placeholder="Veranstaltungstyp" />
              <input value={manualInput.eventDate} onChange={(event) => manualActions.setEventDate(event.target.value)} placeholder="Datum" />
              <input value={manualInput.attendeeCount} onChange={(event) => manualActions.setAttendeeCount(event.target.value)} placeholder="Teilnehmerzahl" />
              <input value={manualInput.serviceForm} onChange={(event) => manualActions.setServiceForm(event.target.value)} placeholder="Serviceform" />
              <input value={manualInput.menuItems} onChange={(event) => manualActions.setMenuItems(event.target.value)} placeholder="Menüpunkte" />
              <input value={manualInput.customerName} onChange={(event) => manualActions.setCustomerName(event.target.value)} placeholder="Kundenname" />
              <input value={manualInput.venueName} onChange={(event) => manualActions.setVenueName(event.target.value)} placeholder="Ort" />
              <textarea value={manualInput.notes} onChange={(event) => manualActions.setNotes(event.target.value)} placeholder="Interne Notizen" />
              <button disabled={submitting} onClick={() => void manualActions.submitManualSpec()}>
                Spezifikation anlegen
              </button>
            </section>
          </div>
        </details>

        <details className="progressive-panel">
          <summary>
            <span>Operative Übergabe und Audit</span>
            <strong>{filteredSpecs.length} Spezifikationen</strong>
          </summary>
          <ul className="quiet-list">
            {filteredSpecs.map((spec) => (
              <li key={String(spec.specId)} className="quiet-list__row">
                <div>
                  <strong>{getSpecLabel(spec)}</strong>
                  <span>Status: {getReadinessLabel(spec)}</span>
                  <span>specId: {String(spec.specId ?? "-")}</span>
                  <span>requestId: {getSpecRequestId(spec)}</span>
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
            {filteredSpecs.length === 0 ? <li>Noch keine Spezifikationen vorhanden.</li> : null}
          </ul>
          {specEdit.editingSpecId ? (
            <div className="compact-edit-form">
              <p className="eyebrow">Spezifikation bearbeiten</p>
              <h3>{specEdit.editingSpecId}</h3>
              <input value={specEdit.eventType} onChange={(event) => specEditActions.setEventType(event.target.value)} placeholder="Veranstaltungstyp" />
              <input value={specEdit.eventDate} onChange={(event) => specEditActions.setEventDate(event.target.value)} placeholder="Datum" />
              <input value={specEdit.attendeeCount} onChange={(event) => specEditActions.setAttendeeCount(event.target.value)} placeholder="Teilnehmerzahl" />
              <input value={specEdit.serviceForm} onChange={(event) => specEditActions.setServiceForm(event.target.value)} placeholder="Serviceform" />
              <textarea value={specEdit.menuItems} onChange={(event) => specEditActions.setMenuItems(event.target.value)} placeholder="Menüpunkte" />
              <div className="quiet-action-row">
                <button disabled={submitting} onClick={() => void specEditActions.saveSpecEdit()}>
                  Spezifikation speichern
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
