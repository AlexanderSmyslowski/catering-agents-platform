import {
  type CSSProperties,
  type ChangeEvent,
  type DragEvent
} from "react";
import type { IntakeDocumentChannel } from "./api.js";
import type { ProductionAnalysisResult } from "./production-analysis-result-state.js";
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
  analysisResult?: ProductionAnalysisResult;
};

function ProductionAnalysisResultCard({
  analysisResult,
  documentName
}: {
  analysisResult: ProductionAnalysisResult;
  documentName?: string;
}) {
  return (
    <section className="production-analysis-result-card production-analysis-result-card--primary" aria-label="Erkannte Produktionsdaten">
      <div className="production-analysis-result-card__header">
        <div>
          <p className="eyebrow">Analyse abgeschlossen</p>
          <h3>Erkannte Produktionsdaten</h3>
        </div>
        {documentName ? <span className="production-analysis-file-badge">{documentName}</span> : null}
      </div>
      <strong>{analysisResult.title}</strong>
      <p className="helper-text">{analysisResult.statusLine}</p>
      <p className="helper-text">{analysisResult.planLine}</p>
      <div className="production-analysis-result-grid">
        <div>
          <p className="eyebrow">Verständnis des Angebots</p>
          {analysisResult.menuItems.length > 0 ? (
            <ul className="item-list compact production-analysis-menu-list">
              {analysisResult.menuItems.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          ) : (
            <p className="helper-text">Noch keine Gerichte oder Komponenten erkannt.</p>
          )}
        </div>
        <div>
          <p className="eyebrow">Zwingende Rückfragen</p>
          {analysisResult.questionPreviewItems.length > 0 ? (
            <>
              <ul className="item-list compact production-analysis-question-list">
                {analysisResult.questionPreviewItems.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
              {analysisResult.questionPreviewOverflowCount > 0 ? (
                <p className="helper-text">
                  + {analysisResult.questionPreviewOverflowCount} weitere Rückfragen im Rückfragenbereich.
                </p>
              ) : null}
            </>
          ) : (
            <p className="helper-text">Keine blockierenden Rückfragen erkannt.</p>
          )}
        </div>
        <div>
          <p className="eyebrow">Pflichtprüfung</p>
          <ul className="item-list compact production-analysis-checklist">
            {analysisResult.checklistItems.map((item) => (
              <li
                key={item.label}
                className={`production-analysis-checklist__item production-analysis-checklist__item--${item.status}`}
              >
                <span>{item.label}</span>
                <strong>{item.value}</strong>
              </li>
            ))}
          </ul>
        </div>
      </div>
      <p className="helper-text production-analysis-next-step">
        Nächster Produktionsschritt: {analysisResult.nextStepTitle}
      </p>
    </section>
  );
}

export function ProductionInputPanel({
  submitting,
  sourceInput,
  sourceInputActions,
  manualInput,
  manualInputActions,
  analysisResult
}: ProductionInputPanelProps) {
  const panelState = buildProductionInputPanelState({
    submitting,
    sourceInput
  });
  const showPrimaryAnalysisResult = Boolean(panelState.showCompletedProgress && analysisResult);

  const inputControls = (
    <>
      <div className="upload-shortcut-bar">
        <div>
          <p className="eyebrow">Anfrageeingang</p>
          <strong>Kundenanfrage übernehmen</strong>
          <p className="helper-text">
            PDF, E-Mail oder Textdatei auswählen. Maximal {PRODUCTION_DOCUMENT_UPLOAD_LIMIT_LABEL}. Der Inhalt wird als Catering-Anfrage erfasst. Alternativ kannst du den Text unten direkt einfügen.
          </p>
        </div>
        <div className="action-row">
          <button type="button" disabled={submitting} onClick={sourceInputActions.openFilePicker}>
            Datei auswählen
          </button>
        </div>
      </div>
      <header>
        <p className="eyebrow">Eingabequelle</p>
        <h3>Anfrage als Datei übernehmen</h3>
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
        {panelState.showCompletedProgress && !showPrimaryAnalysisResult ? (
          <div className="progress-panel">
            <div
              className="progress-ring progress-ring--done"
              style={{ "--progress-angle": "360deg" } as CSSProperties}
            >
              <span>100%</span>
            </div>
            <div className="progress-panel__content">
              <p className="processing-note processing-note--success">
                Analyse abgeschlossen für {sourceInput.activeDocumentName}.
              </p>
              <div className="progress-bar">
                <div className="progress-bar__fill" style={{ width: "100%" }} />
              </div>
              <p className="helper-text">Die Rückfragen und Ergebnisse wurden aktualisiert.</p>
            </div>
          </div>
        ) : null}
      </div>
      <div className="action-row">
        <select
          className="operator-input"
          value={sourceInput.intakeChannel}
          onChange={(event) => sourceInputActions.setIntakeChannel(event.target.value as IntakeDocumentChannel)}
        >
          <option value="pdf_upload">PDF / Anfrage</option>
          <option value="email">E-Mail</option>
          <option value="text">Textdatei</option>
        </select>
        <button disabled={panelState.submitDocumentDisabled} onClick={() => void sourceInputActions.submitDocument()}>
          Erneut mit ausgewähltem Typ verarbeiten
        </button>
      </div>
      <div className="divider" />
      <header>
        <p className="eyebrow">Texteingabe</p>
        <h3>Kundenanfrage oder Produktionskontext direkt einfügen</h3>
      </header>
      <textarea value={sourceInput.intakeText} onChange={(event) => sourceInputActions.setIntakeText(event.target.value)} />
      <div className="action-row">
        <button disabled={submitting} onClick={() => void sourceInputActions.submitText()}>
          Erfassungstext normalisieren
        </button>
      </div>
      <details className="maintenance-actions">
        <summary>
          <span>Demo-/Wartungsaktionen</span>
          <strong>lokaler Arbeitsstand</strong>
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
      <header>
        <p className="eyebrow">Strukturierte Eingabe</p>
        <h3>Arbeitsauftrag manuell anlegen</h3>
      </header>
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
        Spezifikation anlegen
      </button>
    </>
  );

  return (
    <article className="panel form-panel" aria-label="Arbeitsauftrag und Eingabe">
      {showPrimaryAnalysisResult && analysisResult ? (
        <ProductionAnalysisResultCard
          analysisResult={analysisResult}
          documentName={sourceInput.activeDocumentName}
        />
      ) : null}
      {showPrimaryAnalysisResult ? (
        <details className="production-input-followup">
          <summary>
            <span>Eingabe ändern oder weitere Anfrage laden</span>
            <strong>Datei, Text oder manuelle Spezifikation</strong>
          </summary>
          <div className="production-input-followup__body">{inputControls}</div>
        </details>
      ) : (
        inputControls
      )}
    </article>
  );
}
