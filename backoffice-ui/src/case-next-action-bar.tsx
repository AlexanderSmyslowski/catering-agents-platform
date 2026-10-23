import type { ReactNode } from "react";
import type { CaseNextAction } from "./case-next-action.js";

export type CaseNextActionBarProps = {
  product?: "offer" | "production";
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
  product,
  onAction,
  disabled = false,
  busy = false,
  error,
  children
}: CaseNextActionBarProps) {
  const terminal = action.kind === "complete";
  const activePhase = phaseForAction(action);
  const labels = product ? ["Anfrage", "Entwurf", "Prüfung", "Unterlagen"] : phaseLabels;
  const taskLabel = product && action.kind === "add_source" ? (product === "offer" ? "Kundenanfrage eingeben" : "Angebot oder Auftrag eingeben")
    : product === "production" && action.kind === "inspect_result" ? "Plan und Einkauf anzeigen"
    : product && action.kind === "review_draft" ? (product === "offer" ? "Angebot prüfen" : "Produktionsentwurf prüfen") : action.label;
  const hints: Record<CaseNextAction["kind"], string> = {
    add_source: product === "offer" ? "Kundenanfrage als Text oder Datei einfügen." : "Angebot oder Auftragsbeschreibung einfügen.",
    review_draft: product === "offer" ? "Offene Punkte, Menü und Kalkulation im Entwurf prüfen." : "Erkannte Angaben und Küchenplanung prüfen. Noch keine fachliche Freigabe.",
    request_revision: "Änderungswünsche sind notiert. Eine neue Fassung erstellen.",
    approve_offer: "Gibt die Variante intern frei. Die Übergabe an die Küche ist ein eigener Schritt.",
    send_handoff: "Das freigegebene Angebot als Produktionsauftrag an die Küche übergeben.",
    inspect_handoff: "Die Küche plant im Produktionsauftrag weiter. Änderungen am Angebot brauchen eine neue Fassung und Freigabe.",
    approve_production: "Mengen, Rückfragen und Küchenhinweise prüfen, dann intern freigeben.",
    apply_approved: "Erstellt Produktionsplan und Einkaufsliste aus dem freigegebenen Stand.",
    inspect_result: "Vorhandene Unterlagen öffnen. Fehlende Ergebnisse und fachliche Hinweise bleiben dort sichtbar.",
    complete: "Dieser Bearbeitungsschritt ist gespeichert. Offene fachliche Prüfungen bleiben vor der tatsächlichen Produktion erforderlich."
  };

  return (
    <aside className="case-next-action-bar" aria-label="Nächster Schritt" data-testid="case-next-action-bar">
      {product ? <div className="case-next-action-bar__guidance"><h2>Nächster Schritt</h2><p>{disabled ? "Änderungen zuerst speichern oder abbrechen." : hints[action.kind]}</p></div> : null}
      {product && !terminal ? <p className="case-next-action-bar__mobile-phase">{`Schritt ${activePhase + 1} von 4 · ${labels[activePhase]}`}</p> : null}
      <ol className="case-next-action-bar__phases" aria-label="Arbeitsstand">
        {labels.map((label, index) => (
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
            {busy ? "Wird ausgeführt …" : taskLabel}
          </button>
        )}
        {children}
      </div>
      {error ? <p className="case-next-action-bar__error" role="alert">{error}</p> : null}
    </aside>
  );
}
