import {
  type CSSProperties,
  type ChangeEvent,
  type DragEvent
} from "react";
import type { IntakeDocumentChannel, IntakeRequestDetail } from "./api.js";
import { PRODUCTION_DOCUMENT_UPLOAD_LIMIT_LABEL } from "./production-document-upload-limit.js";
import { buildProductionInputPanelState } from "./production-input-panel-state.js";

export type ProductionManualInputValues = {
  eventType: string;
  eventDate: string;
  attendeeCount: string;
  serviceForm: string;
  menuItems: string;
  customerName: string;
  venueName: string;
  notes: string;
};

export type ProductionManualInputActions = {
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

export type ProductionSourceInputValues = {
  dragActive: boolean;
  intakeFile: File | null;
  intakeChannel: IntakeDocumentChannel;
  documentPhase: "idle" | "analysing" | "done";
  activeDocumentName?: string;
  documentProgress: number;
  documentEtaSeconds?: number;
  intakeText: string;
  canClearWorkspace: boolean;
  canArchiveCurrentIntake: boolean;
  clearWorkspaceContextLabel?: string;
  archiveCurrentIntakeContextLabel?: string;
  clearWorkspaceTitle: string;
  archiveCurrentIntakeTitle: string;
};

export type ProductionSourceInputActions = {
  uploadInputRef: { current: HTMLInputElement | null };
  setDragActive: (active: boolean) => void;
  setIntakeChannel: (channel: IntakeDocumentChannel) => void;
  setIntakeText: (value: string) => void;
  openFilePicker: () => void;
  clearWorkspace: () => void;
  archiveCurrentIntake: () => Promise<void>;
  handleDrop: (event: DragEvent<HTMLLabelElement>) => void;
  handleFileSelection: (event: ChangeEvent<HTMLInputElement>) => void;
  submitDocument: () => Promise<void>;
  submitText: () => Promise<void>;
};

type ProductionInputPanelProps = {
  submitting: boolean;
  sourceInput: ProductionSourceInputValues;
  sourceInputActions: ProductionSourceInputActions;
  manualInput: ProductionManualInputValues;
  manualInputActions: ProductionManualInputActions;
  focusedProductionSpec?: Record<string, unknown>;
  hasActiveProductionContext?: boolean;
  productionQuestions?: string[];
  productionAssumptions?: string[];
  intakeRequestDetail?: IntakeRequestDetail | null;
};

const preflightStatusLabels = {
  checked: "erkannt",
  open: "offen",
  review: "prüfen"
} as const;

const snapshotStatusLabels = {
  checked: "erkannt",
  open: "offen",
  review: "prüfen"
} as const;

function buildUploadReviewAction(summary: NonNullable<ReturnType<typeof buildProductionInputPanelState>["uploadResultSummary"]>) {
  if (summary.openItems.length > 0) {
    return {
      title: `${summary.openItems.length === 1 ? "1 Rückfrage beantworten" : `${summary.openItems.length} Rückfragen beantworten`}`,
      description: "Beantworte die offenen Punkte direkt im Rückfragenbereich. Danach kann der Produktionsplan berechnet werden.",
      cta: "Zu den Rückfragen",
      href: "#production-question-panel"
    };
  }

  if (summary.sourceCheckItems.length > 0) {
    return {
      title: "Quelle prüfen",
      description: "Die Datei wurde gelesen, aber die Texterkennung braucht eine kurze Bestätigung vor der Berechnung.",
      cta: "Zur Quellenprüfung",
      href: "#production-question-panel"
    };
  }

  if (summary.menuItems.length > 0) {
    return {
      title: "Erkannte Komponenten prüfen",
      description: "Prüfe Herstellungsart und Rezeptbezug. Danach startest du bewusst die Berechnung.",
      cta: "Komponenten prüfen",
      href: "#production-question-panel"
    };
  }

  return {
    title: "Eckdaten ergänzen",
    description: "Die Datei wurde verarbeitet, aber es fehlen noch belastbare Gerichte oder Eckdaten.",
    cta: "Zur Prüfung",
    href: "#production-question-panel"
  };
}

export function ProductionInputPanel({
  submitting,
  sourceInput,
  sourceInputActions,
  manualInput,
  manualInputActions,
  focusedProductionSpec,
  hasActiveProductionContext,
  productionQuestions,
  productionAssumptions,
  intakeRequestDetail
}: ProductionInputPanelProps) {
  const panelState = buildProductionInputPanelState({
    submitting,
    sourceInput,
    focusedProductionSpec,
    productionQuestions,
    productionAssumptions,
    intakeRequestDetail
  });
  const hasUploadResultSummary = Boolean(panelState.uploadResultSummary);
  const completedDocument = panelState.showCompletedProgress;
  const hasFocusedProductionContext = Boolean(focusedProductionSpec) || Boolean(hasActiveProductionContext);
  const compactInputMode = hasUploadResultSummary || completedDocument;
  const secondaryInputsOpen = !compactInputMode && !hasFocusedProductionContext;
  const uploadReviewAction = panelState.uploadResultSummary
    ? buildUploadReviewAction(panelState.uploadResultSummary)
    : undefined;

  return (
    <article className="panel form-panel" aria-label="Arbeitsauftrag und Eingabe">
      {compactInputMode ? (
        <input
          ref={sourceInputActions.uploadInputRef}
          className="visually-hidden"
          type="file"
          aria-hidden="true"
          hidden
          tabIndex={-1}
          accept=".pdf,.txt,.md,.eml,text/plain,message/rfc822,application/pdf"
          onChange={sourceInputActions.handleFileSelection}
        />
      ) : null}
      {compactInputMode ? (
        <div className="upload-shortcut-bar upload-shortcut-bar--compact">
          <div>
            <p className="eyebrow">Anfrageeingang</p>
            <strong>Weitere Anfrage übernehmen</strong>
            <p className="helper-text">
              PDF, E-Mail oder Textdatei auswählen. Maximal {PRODUCTION_DOCUMENT_UPLOAD_LIMIT_LABEL}. Der aktuelle Vorgang bleibt im Arbeitsbereich sichtbar.
            </p>
          </div>
          <div className="action-row">
            <button type="button" disabled={submitting} onClick={sourceInputActions.openFilePicker}>
              Datei auswählen
            </button>
          </div>
        </div>
      ) : null}
      {!compactInputMode ? (
        <>
          <header>
            <p className="eyebrow">Eingabequelle</p>
            <h3>Kundenanfrage übernehmen</h3>
          </header>
          <label
            className={sourceInput.dragActive ? "drag-drop-zone drag-drop-zone--active" : "drag-drop-zone"}
            onDragOver={(event) => {
              event.preventDefault();
              sourceInputActions.setDragActive(true);
            }}
            onDragLeave={() => sourceInputActions.setDragActive(false)}
            onDrop={sourceInputActions.handleDrop}
          >
            <input
              ref={sourceInputActions.uploadInputRef}
              className="visually-hidden"
              type="file"
              accept=".pdf,.txt,.md,.eml,text/plain,message/rfc822,application/pdf"
              onChange={sourceInputActions.handleFileSelection}
            />
            <span className="eyebrow">Drag & Drop</span>
            <strong>Datei hier ablegen oder Dateiauswahl öffnen</strong>
            <p className="helper-text">
              Unterstützt PDF, E-Mail und Textdateien bis {PRODUCTION_DOCUMENT_UPLOAD_LIMIT_LABEL}. Nach der Auswahl erscheint der Dateiname hier, danach bewusst verarbeiten.
            </p>
            <span className="drag-drop-zone__cta">Datei auswählen</span>
          </label>
        </>
      ) : null}
      <div className="activity-slot">
        {panelState.selectedFileName ? <p className="helper-text">Ausgewählt: {panelState.selectedFileName}</p> : null}
        {panelState.showAnalysingProgress ? (
          <div className="progress-panel">
            <div
              className="progress-ring"
              style={
                {
                  "--progress-angle": `${Math.max(0, Math.min(sourceInput.documentProgress, 100)) * 3.6}deg`
                } as CSSProperties
              }
            >
              <span>{sourceInput.documentProgress}%</span>
            </div>
            <div className="progress-panel__content">
              <p className="processing-note">Analyse läuft für {sourceInput.activeDocumentName} ...</p>
              <div className="progress-bar">
                <div
                  className="progress-bar__fill"
                  style={{ width: `${Math.max(0, Math.min(sourceInput.documentProgress, 100))}%` }}
                />
              </div>
              <p className="helper-text">Geschätzte Restzeit: {panelState.documentEtaLabel}</p>
            </div>
          </div>
        ) : null}
        {panelState.showCompletedProgress ? (
          <div className="upload-complete-panel">
            <div className="progress-panel__content">
              <p className="processing-note processing-note--success">
                Analyse abgeschlossen für {sourceInput.activeDocumentName}.
              </p>
              <p className="helper-text">{panelState.completedProgressHelperLabel}</p>
              {panelState.uploadResultSummary ? (
                <div className="upload-result-summary" aria-label="Erkannte Produktionsdaten">
                  <div>
                    <p className="eyebrow">KI-Entwurf aus Angebot</p>
                    <strong>{panelState.uploadResultSummary.eventLabel}</strong>
                    <p className="helper-text">{panelState.uploadResultSummary.summaryLabel}</p>
                  </div>
                  <div className="upload-result-snapshot" aria-label="Sofortübersicht Produktionsdaten">
                    {panelState.uploadResultSummary.snapshotItems.map((item) => (
                      <div key={item.key} className={`upload-result-snapshot__item upload-result-snapshot__item--${item.status}`}>
                        <span>{item.label}</span>
                        <strong>{item.value}</strong>
                        <small>{snapshotStatusLabels[item.status]}</small>
                      </div>
                    ))}
                  </div>
                  {uploadReviewAction ? (
                    <div className="upload-review-action" aria-label="Nächste Prüfung">
                      <div>
                        <p className="eyebrow">Jetzt prüfen</p>
                        <strong>{uploadReviewAction.title}</strong>
                        <p className="helper-text">{uploadReviewAction.description}</p>
                      </div>
                      <a className="button-link" href={uploadReviewAction.href}>
                        {uploadReviewAction.cta}
                      </a>
                    </div>
                  ) : null}
                  <details className="upload-result-review-details">
                    <summary>Erkannte Komponenten und Prüfpunkte anzeigen</summary>
                    <div>
                      <p className="helper-text">Gerichte und Komponenten:</p>
                      {panelState.uploadResultSummary.menuItems.length > 0 ? (
                        <ul className="item-list compact">
                          {panelState.uploadResultSummary.menuItems.map((item) => (
                            <li key={item.key}>
                              <strong>{item.label}</strong>
                              <p className="helper-text">{item.detailLabel}</p>
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p className="helper-text">Noch keine Gerichte erkannt.</p>
                      )}
                    </div>
                    <div>
                      <p className="helper-text">Offen vor Produktion:</p>
                      {panelState.uploadResultSummary.openItems.length > 0 ? (
                        <ul className="item-list compact">
                          {panelState.uploadResultSummary.openItems.map((item) => (
                            <li key={item}>{item}</li>
                          ))}
                        </ul>
                      ) : (
                        <p className="helper-text">Keine blockierenden Rückfragen erkannt.</p>
                      )}
                    </div>
                    <div>
                      <p className="helper-text">Vorprüfung vor Berechnung:</p>
                      <ul className="item-list compact upload-preflight-list">
                        {panelState.uploadResultSummary.preflightItems.map((item) => (
                          <li key={item.key}>
                            <span className={`preflight-status preflight-status--${item.status}`}>
                              {preflightStatusLabels[item.status]}
                            </span>
                            <strong>{item.label}</strong>
                            <p className="helper-text">{item.detailLabel}</p>
                          </li>
                        ))}
                      </ul>
                    </div>
                    {panelState.uploadResultSummary.assumptionItems.length > 0 ? (
                      <div>
                        <p className="helper-text">Annahmen:</p>
                        <ul className="item-list compact">
                          {panelState.uploadResultSummary.assumptionItems.slice(0, 3).map((item) => (
                            <li key={item}>{item}</li>
                          ))}
                        </ul>
                      </div>
                    ) : null}
                    <div>
                      <p className="helper-text">Stand der Produktionsartefakte:</p>
                      <ul className="item-list compact">
                        {panelState.uploadResultSummary.artifactStatusItems.map((item) => (
                          <li key={item}>{item}</li>
                        ))}
                      </ul>
                    </div>
                    {panelState.uploadResultSummary.sourceCheckItems.length > 0 ? (
                      <div>
                        <p className="helper-text">Quellenprüfung:</p>
                        <ul className="item-list compact">
                          {panelState.uploadResultSummary.sourceCheckItems.map((item) => (
                            <li key={item}>{item}</li>
                          ))}
                        </ul>
                      </div>
                    ) : null}
                  </details>
                </div>
              ) : null}
            </div>
          </div>
        ) : null}
      </div>
      {compactInputMode ? (
        <details className="source-retry-details">
          <summary>Quelle erneut auswerten</summary>
          <p className="helper-text">
            Nur nutzen, wenn die Datei als falscher Quellentyp erkannt wurde oder du die gleiche Datei bewusst erneut verarbeiten willst.
          </p>
          <div className="action-row">
            <select
              className="operator-input"
              aria-label="Quellentyp für erneute Auswertung"
              value={sourceInput.intakeChannel}
              onChange={(event) => sourceInputActions.setIntakeChannel(event.target.value as IntakeDocumentChannel)}
            >
              <option value="pdf_upload">PDF-Datei</option>
              <option value="email">E-Mail</option>
              <option value="text">Textdatei</option>
            </select>
            <button disabled={panelState.submitDocumentDisabled} onClick={() => void sourceInputActions.submitDocument()}>
              Datei erneut auswerten
            </button>
          </div>
        </details>
      ) : (
        <div className="action-row">
          <select
            className="operator-input"
            aria-label="Quellentyp"
            value={sourceInput.intakeChannel}
            onChange={(event) => sourceInputActions.setIntakeChannel(event.target.value as IntakeDocumentChannel)}
          >
            <option value="pdf_upload">PDF-Datei</option>
            <option value="email">E-Mail</option>
            <option value="text">Textdatei</option>
          </select>
          <button disabled={panelState.submitDocumentDisabled} onClick={() => void sourceInputActions.submitDocument()}>
            Datei auswerten
          </button>
        </div>
      )}
      <details className="secondary-workspace production-secondary-inputs" open={secondaryInputsOpen}>
        <summary>
          <span>{compactInputMode ? "Optionale Korrektur" : "Weitere Eingabe ohne Datei"}</span>
          <strong>{compactInputMode ? "nur wenn die PDF-Analyse falsch ist" : "Text oder manuelle Anlage"}</strong>
        </summary>
        <div className="secondary-workspace__content">
          <div className="divider" />
          <header>
            <p className="eyebrow">{compactInputMode ? "Korrektur zur PDF" : "Texteingabe"}</p>
            <h3>{compactInputMode ? "PDF-Analyse mit einer Notiz ergänzen" : "Kundenanfrage direkt einfügen"}</h3>
            <p className="helper-text">
              {compactInputMode
                ? "Dieses Feld ergänzt die aktuelle PDF. Es ersetzt die Datei nicht und ist nur nötig, wenn erkannte Angaben korrigiert werden sollen."
                : "Nutze diesen Weg, wenn keine Datei vorliegt. Für PDFs bleibt der Datei-Upload der normale Start."}
            </p>
          </header>
          <textarea
            value={sourceInput.intakeText}
            onChange={(event) => sourceInputActions.setIntakeText(event.target.value)}
            placeholder="Beispiel: Bitte 120 statt 100 Gäste berücksichtigen; Dessert entfällt."
          />
          <div className="action-row">
            <button disabled={submitting} onClick={() => void sourceInputActions.submitText()}>
              {compactInputMode ? "Korrektur auswerten" : "Text auswerten"}
            </button>
          </div>
          <details className="maintenance-actions">
            <summary>
              <span>Lokale Hilfen</span>
              <strong>nur für Demo- und Fehlupload-Fälle</strong>
            </summary>
            <div className="maintenance-actions__body">
              <p className="helper-text">
                Diese Aktionen sind nur für lokale Demo- und Korrekturfälle. Sie erstellen kein Angebot und geben nichts frei.
              </p>
              <div className="action-row">
                <button
                  type="button"
                  className="secondary-button destructive-button"
                  disabled={panelState.clearWorkspaceDisabled}
                  title={sourceInput.clearWorkspaceTitle}
                  onClick={sourceInputActions.clearWorkspace}
                >
                  Demo-Arbeitsstand zurücksetzen
                  {sourceInput.clearWorkspaceContextLabel ? (
                    <span className="visually-hidden"> für {sourceInput.clearWorkspaceContextLabel}</span>
                  ) : null}
                </button>
                <button
                  type="button"
                  className="secondary-button destructive-button"
                  disabled={panelState.archiveCurrentIntakeDisabled}
                  title={sourceInput.archiveCurrentIntakeTitle}
                  onClick={() => void sourceInputActions.archiveCurrentIntake()}
                >
                  Fehlgeschlagenen Demo-Upload ausblenden
                  {sourceInput.archiveCurrentIntakeContextLabel ? (
                    <span className="visually-hidden"> für {sourceInput.archiveCurrentIntakeContextLabel}</span>
                  ) : null}
                </button>
              </div>
            </div>
          </details>
          <div className="divider" />
          <details className="manual-entry-details">
            <summary>
              <span>Kein PDF?</span>
              <strong>Auftrag manuell erfassen</strong>
            </summary>
            <div className="manual-entry-details__body">
              <input
                value={manualInput.eventType}
                onChange={(event) => manualInputActions.setEventType(event.target.value)}
                placeholder="Veranstaltungstyp, z. B. Konferenz"
              />
              <input
                value={manualInput.eventDate}
                onChange={(event) => manualInputActions.setEventDate(event.target.value)}
                placeholder="Datum, z. B. 2026-10-10"
              />
              <input
                value={manualInput.attendeeCount}
                onChange={(event) => manualInputActions.setAttendeeCount(event.target.value)}
                placeholder="Teilnehmerzahl"
              />
              <input
                value={manualInput.serviceForm}
                onChange={(event) => manualInputActions.setServiceForm(event.target.value)}
                placeholder="Serviceform, z. B. Buffet"
              />
              <input
                value={manualInput.menuItems}
                onChange={(event) => manualInputActions.setMenuItems(event.target.value)}
                placeholder="Menüpunkte, durch Komma getrennt"
              />
              <input
                value={manualInput.customerName}
                onChange={(event) => manualInputActions.setCustomerName(event.target.value)}
                placeholder="Kundenname"
              />
              <input
                value={manualInput.venueName}
                onChange={(event) => manualInputActions.setVenueName(event.target.value)}
                placeholder="Ort oder Veranstaltungsort"
              />
              <textarea
                value={manualInput.notes}
                onChange={(event) => manualInputActions.setNotes(event.target.value)}
                placeholder="Interne Notizen oder Einschränkungen"
              />
              <button disabled={submitting} onClick={() => void manualInputActions.submitManualSpec()}>
                Manuellen Auftrag anlegen
              </button>
            </div>
          </details>
        </div>
      </details>
    </article>
  );
}
