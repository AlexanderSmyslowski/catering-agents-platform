import { useMemo, useState } from "react";
import {
  buildMiniPilotCheckReportState,
  type MiniPilotCheckReportState
} from "./mini-pilot-check-report-state.js";

interface MiniPilotCheckPanelProps {
  rawResult?: string;
  onRawResultChange?: (value: string) => void;
  reportState?: MiniPilotCheckReportState;
}

export function MiniPilotCheckPanel({
  rawResult,
  onRawResultChange,
  reportState
}: MiniPilotCheckPanelProps = {}) {
  const [internalRawResult, setInternalRawResult] = useState("");
  const isControlled = typeof rawResult === "string" && typeof onRawResultChange === "function";
  const effectiveRawResult = isControlled ? rawResult : internalRawResult;
  const effectiveReportState = useMemo(
    () => reportState ?? buildMiniPilotCheckReportState(effectiveRawResult),
    [effectiveRawResult, reportState]
  );
  const handleResultInput = (value: string) => {
    if (isControlled) {
      onRawResultChange(value);
      return;
    }
    setInternalRawResult(value);
  };
  const showClearAction = effectiveRawResult.trim().length > 0;

  return (
    <div className="search-trace" aria-label="Mini-Pilot-Check-Ergebnis">
      <p className="eyebrow">Mini-Pilot-Check</p>
      <strong>Ready oder blocked direkt im Arbeitsfluss lesen</strong>
      <p className="helper-text">
        JSON-Ausgabe von <code>{effectiveReportState.commandLabel}</code> einfuegen; die Oberflaeche fasst Status, Grund und
        naechsten sicheren Schritt lokal zusammen.
      </p>
      <textarea
        aria-label="Mini-Pilot-Check JSON"
        value={effectiveRawResult}
        onInput={(event) => handleResultInput(event.currentTarget.value)}
        onChange={(event) => handleResultInput(event.currentTarget.value)}
        placeholder='{"ok":true,"summary":{"status":"ready","reason":"mini_pilot_ready","nextStep":"..."}}'
      />
      {showClearAction ? (
        <div className="quiet-action-row">
          <button type="button" className="secondary-button" onClick={() => handleResultInput("")}>
            Ergebnis leeren
          </button>
        </div>
      ) : null}
      <p className="helper-text">Status: {effectiveReportState.statusLabel}</p>
      <p className="helper-text">Grund: {effectiveReportState.reasonLabel}</p>
      <p className="helper-text">Naechster Schritt: {effectiveReportState.nextStepLabel}</p>
      {effectiveReportState.errorLabels.length > 0 ? (
        <ul className="item-list compact trace-list">
          {effectiveReportState.errorLabels.map((error) => (
            <li key={error}>
              <p className="helper-text">{error}</p>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
