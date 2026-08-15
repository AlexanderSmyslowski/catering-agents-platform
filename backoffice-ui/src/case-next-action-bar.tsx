import type { ReactNode } from "react";
import type { CaseNextAction } from "./case-next-action.js";

export type CaseNextActionBarProps = {
  action: CaseNextAction;
  onAction: (action: CaseNextAction) => void | Promise<void>;
  disabled?: boolean;
  busy?: boolean;
  error?: string;
  children?: ReactNode;
};

const phaseLabels = ["Quelle", "KI-Entwurf", "Prüfung", "Plan"] as const;

function phaseForAction(action: CaseNextAction): number {
  switch (action.kind) {
    case "add_source":
      return 0;
    case "review_draft":
    case "request_revision":
      return 1;
    case "approve_offer":
    case "send_handoff":
    case "inspect_handoff":
    case "approve_production":
      return 2;
    case "apply_approved":
    case "inspect_result":
    case "complete":
      return 3;
  }
}

export function CaseNextActionBar({
  action,
  onAction,
  disabled = false,
  busy = false,
  error,
  children
}: CaseNextActionBarProps) {
  const terminal = action.kind === "complete";
  const activePhase = phaseForAction(action);

  return (
    <aside className="case-next-action-bar" aria-label="Nächster Schritt" data-testid="case-next-action-bar">
      <ol className="case-next-action-bar__phases" aria-label="Arbeitsstand">
        {phaseLabels.map((label, index) => (
          <li key={label} aria-current={!terminal && index === activePhase ? "step" : undefined}>
            <span className="case-next-action-bar__phase-number">{index + 1}</span>
            <span>{label}</span>
          </li>
        ))}
      </ol>
      <div className="case-next-action-bar__command">
        {terminal ? (
          <p className="case-next-action-bar__complete" data-state="complete">{action.label}</p>
        ) : (
          <button
            type="button"
            className="button button--primary"
            data-action="case-next-action"
            disabled={disabled || busy}
            onClick={() => void onAction(action)}
          >
            {busy ? "Wird ausgeführt …" : action.label}
          </button>
        )}
        {children}
      </div>
      {error ? <p className="case-next-action-bar__error" role="alert">{error}</p> : null}
    </aside>
  );
}
