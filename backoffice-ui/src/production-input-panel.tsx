import {
  type CSSProperties,
  type ChangeEvent,
  type DragEvent
} from "react";
import type { IntakeDocumentChannel } from "./api.js";

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
};

function formatEta(seconds: number): string {
  if (seconds <= 1) {
    return "weniger als 1 Sekunde";
  }
  return `${seconds} Sekunden`;
}

export function ProductionInputPanel({
  submitting,
  sourceInput,
  sourceInputActions,
  manualInput,
  manualInputActions
}: ProductionInputPanelProps) {
  const clearWorkspaceDisabled = submitting || !sourceInput.canClearWorkspace;
  const archiveCurrentIntakeDisabled = submitting || !sourceInput.canArchiveCurrentIntake;
  const submitDocumentDisabled = submitting || !sourceInput.intakeFile;

  return (
    <article className="panel form-panel" aria-label="Arbeitsauftrag und Eingabe">
      <div className="upload-shortcut-bar">
        <div>
          <p className="eyebrow">Chat-Eingang</p>
          <strong>+ Angebot hinzufügen</strong>
          <p className="helper-text">
            Ronak-Angebot per Datei, Drag & Drop oder Text in den Produktionsagenten geben. Bestehende Spezifikationspfade bleiben führend.
          </p>
        </div>
        <div className="action-row">
          <button type="button" disabled={submitting} onClick={sourceInputActions.openFilePicker}>
            + Angebot hinzufügen
          </button>
          <button
            type="button"
            className="secondary-button destructive-button"
            disabled={clearWorkspaceDisabled}
            title={sourceInput.clearWorkspaceTitle}
            onClick={sourceInputActions.clearWorkspace}
          >
            Arbeitsbereich lokal leeren
            {sourceInput.clearWorkspaceContextLabel ? (
              <span className="visually-hidden"> für {sourceInput.clearWorkspaceContextLabel}</span>
            ) : null}
          </button>
          <button
            type="button"
            className="secondary-button destructive-button"
            disabled={archiveCurrentIntakeDisabled}
            title={sourceInput.archiveCurrentIntakeTitle}
            onClick={() => void sourceInputActions.archiveCurrentIntake()}
          >
            Fehlupload archivieren
            {sourceInput.archiveCurrentIntakeContextLabel ? (
              <span className="visually-hidden"> für {sourceInput.archiveCurrentIntakeContextLabel}</span>
            ) : null}
          </button>
        </div>
      </div>
      <header>
        <p className="eyebrow">Eingabequelle</p>
        <h3>Angebot als Datei übernehmen</h3>
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
        <strong>Angebot hier ablegen oder über + auswählen</strong>
        <p className="helper-text">
          Sichtbarer Import-Anker für PDF, E-Mail und Textdateien; Verarbeitung erfolgt über die bestehenden Intake- und Spezifikationspfade.
        </p>
        <span className="drag-drop-zone__cta">+ Angebot auswählen</span>
      </label>
      <div className="activity-slot">
        {sourceInput.intakeFile ? <p className="helper-text">Ausgewählt: {sourceInput.intakeFile.name}</p> : null}
        {sourceInput.documentPhase === "analysing" && sourceInput.activeDocumentName ? (
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
              <p className="helper-text">
                Geschätzte Restzeit: {formatEta(sourceInput.documentEtaSeconds ?? 1)}
              </p>
            </div>
          </div>
        ) : null}
        {sourceInput.documentPhase === "done" && sourceInput.activeDocumentName ? (
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
          <option value="pdf_upload">PDF / Angebot</option>
          <option value="email">E-Mail</option>
          <option value="text">Textdatei</option>
        </select>
        <button disabled={submitDocumentDisabled} onClick={() => void sourceInputActions.submitDocument()}>
          Erneut mit ausgewähltem Typ verarbeiten
        </button>
      </div>
      <div className="divider" />
      <header>
        <p className="eyebrow">Texteingabe</p>
        <h3>Angebot oder Produktionskontext direkt einfügen</h3>
      </header>
      <textarea value={sourceInput.intakeText} onChange={(event) => sourceInputActions.setIntakeText(event.target.value)} />
      <div className="action-row">
        <button disabled={submitting} onClick={() => void sourceInputActions.submitText()}>
          Erfassungstext normalisieren
        </button>
      </div>
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
    </article>
  );
}
