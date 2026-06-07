import { useMemo, useState } from "react";
import { buildMiniPilotCheckReportState } from "./mini-pilot-check-report-state.js";

export function MiniPilotCheckPanel() {
  const [rawResult, setRawResult] = useState("");
  const reportState = useMemo(() => buildMiniPilotCheckReportState(rawResult), [rawResult]);
  const handleResultInput = (value: string) => {
    setRawResult(value);
  };

  return (
    <div className="search-trace" aria-label="Mini-Pilot-Check-Ergebnis">
      <p className="eyebrow">Mini-Pilot-Check</p>
      <strong>Ready oder blocked direkt im Arbeitsfluss lesen</strong>
      <p className="helper-text">
        JSON-Ausgabe von <code>{reportState.commandLabel}</code> einfuegen; die Oberflaeche fasst Status, Grund und
        naechsten sicheren Schritt lokal zusammen.
      </p>
      <textarea
        aria-label="Mini-Pilot-Check JSON"
        value={rawResult}
        onInput={(event) => handleResultInput(event.currentTarget.value)}
        onChange={(event) => handleResultInput(event.currentTarget.value)}
        placeholder='{"ok":true,"summary":{"status":"ready","reason":"mini_pilot_ready","nextStep":"..."}}'
      />
      <p className="helper-text">Status: {reportState.statusLabel}</p>
      <p className="helper-text">Grund: {reportState.reasonLabel}</p>
      <p className="helper-text">Naechster Schritt: {reportState.nextStepLabel}</p>
      {reportState.errorLabels.length > 0 ? (
        <ul className="item-list compact trace-list">
          {reportState.errorLabels.map((error) => (
            <li key={error}>
              <p className="helper-text">{error}</p>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
