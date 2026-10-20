import type { ReactNode } from "react";
import { MiniPilotCheckPanel } from "./mini-pilot-check-panel.js";
import type { MiniPilotCheckReportState } from "./mini-pilot-check-report-state.js";
import { shouldShowMiniPilotPanel } from "./mini-pilot-panel-gate.js";
import { buildProductionMiniPilotCardState } from "./production-mini-pilot-card-state.js";
import { buildProductionWorkbenchOutputAnchorState } from "./production-workbench-output-anchor-state.js";

export type ProductionWorkbenchSummary = {
  approvalState?: "pending" | "approved" | "applied";
  productionNotes?: string[];
  hasActiveContext?: boolean;
  activeSpecLabel: string;
  activeTechnicalContextLabel?: string;
  readinessLabel: string;
  planStatusLabel: string;
  purchaseStatusLabel: string;
  questionCount: number;
  answeredQuestionCount: number;
  unansweredQuestionCount: number;
  productionObjectCount: number;
  productionObjectStatusLabel: string;
  purchaseListCount: number;
  purchaseItemCount?: number;
};

export type ProductionWorkbenchNextStep = {
  title: string;
  description: string;
};

export type ProductionWorkbenchSlots = {
  inputSlot: ReactNode;
  questionsSlot: ReactNode;
  productionObjectsSlot: ReactNode;
  purchaseListSlot: ReactNode;
  lowerSlots: ReactNode;
};

type ProductionConversationalWorkbenchProps = {
  summary: ProductionWorkbenchSummary;
  nextStep: ProductionWorkbenchNextStep;
  miniPilotRawResult: string;
  setMiniPilotRawResult: (value: string) => void;
  miniPilotReportState: MiniPilotCheckReportState;
  miniPilotStorageHintLabel?: string;
  slots: ProductionWorkbenchSlots;
};

function countOpenVisibleQuestions(
  questionCount: number,
  answeredQuestionCount: number,
  fallbackUnansweredQuestionCount: number
): number {
  if (questionCount > 0) {
    return Math.max(0, questionCount - answeredQuestionCount);
  }
  return Math.max(0, fallbackUnansweredQuestionCount);
}

function formatOperatorReadiness(readinessLabel: string): string {
  if (readinessLabel === "-" || readinessLabel === "unzureichend") {
    return "Prüfung nötig";
  }
  if (readinessLabel === "teilweise vollständig") {
    return "teilweise geklärt";
  }
  return readinessLabel;
}

function formatOperatorPlanStatus(planStatusLabel: string): string {
  if (planStatusLabel === "wird geladen") {
    return "wird geladen";
  }
  if (planStatusLabel === "offen") {
    return "noch nicht vorhanden";
  }
  if (planStatusLabel === "unzureichend") {
    return "vorhanden, Prüfung nötig";
  }
  return `vorhanden, ${planStatusLabel}`;
}

function formatOperatorProductionObjects(productionObjectStatusLabel: string): string {
  if (productionObjectStatusLabel === "noch kein Plan") {
    return "noch kein Produktionsplan";
  }
  return productionObjectStatusLabel.replace("unzureichend", "Prüfung nötig");
}

function buildProductionSummaryFacts(input: {
  approvalState?: ProductionWorkbenchSummary["approvalState"];
  readinessLabel: string;
  openVisibleQuestionCount: number;
  answeredQuestionCount: number;
  planStatusLabel: string;
  purchaseStatusLabel: string;
  productionObjectStatusLabel: string;
}): Array<{ label: string; value: string }> {
  return [
    {
      label: "Status",
      value: formatOperatorReadiness(input.readinessLabel)
    },
    {
      label: "Rückfragen",
      value: `offen ${input.openVisibleQuestionCount} · beantwortet ${input.answeredQuestionCount}`
    },
    {
      label: "Plan",
      value: formatOperatorPlanStatus(input.planStatusLabel)
    },
    {
      label: "Einkauf",
      value: input.purchaseStatusLabel
    },
    {
      label: "Ergebnis",
      value: formatOperatorProductionObjects(input.productionObjectStatusLabel)
    },
    {
      label: "Interne Produktionsfreigabe",
      value: input.approvalState === "applied" ? "erteilt · übernommen"
        : input.approvalState === "approved" ? "erteilt · Übernahme ausstehend" : "nicht erteilt"
    }
  ];
}

function hasVisibleProductionContext(input: {
  answeredQuestionCount: number;
  openVisibleQuestionCount: number;
  planStatusLabel: string;
  productionObjectCount: number;
  purchaseListCount: number;
  purchaseStatusLabel: string;
}): boolean {
  return input.openVisibleQuestionCount > 0 ||
    input.answeredQuestionCount > 0 ||
    input.productionObjectCount > 0 ||
    input.purchaseListCount > 0 ||
    (input.planStatusLabel !== "offen" && input.planStatusLabel !== "wird geladen") ||
    (input.purchaseStatusLabel !== "noch keine Liste" && input.purchaseStatusLabel !== "Einkaufslisten werden geladen");
}

export function ProductionConversationalWorkbench({
  summary,
  miniPilotRawResult,
  setMiniPilotRawResult,
  miniPilotReportState,
  miniPilotStorageHintLabel,
  slots
}: ProductionConversationalWorkbenchProps) {
  const miniPilotCard = buildProductionMiniPilotCardState();
  const showMiniPilotPanel = shouldShowMiniPilotPanel();
  const {
    activeSpecLabel,
    activeTechnicalContextLabel,
    readinessLabel,
    planStatusLabel,
    purchaseStatusLabel,
    questionCount,
    answeredQuestionCount,
    unansweredQuestionCount,
    productionObjectCount,
    productionObjectStatusLabel,
    purchaseListCount,
    purchaseItemCount
  } = summary;
  const openVisibleQuestionCount = countOpenVisibleQuestions(
    questionCount,
    answeredQuestionCount,
    unansweredQuestionCount
  );
  const productionOutputAnchor = buildProductionWorkbenchOutputAnchorState({
    productionObjectCount,
    purchaseListCount,
    purchaseItemCount,
    planStatusLabel
  });
  const productionOutputAnchorId = "production-output-anchor";
  const summaryFacts = buildProductionSummaryFacts({
    approvalState: summary.approvalState,
    readinessLabel,
    openVisibleQuestionCount,
    answeredQuestionCount,
    planStatusLabel,
    purchaseStatusLabel,
    productionObjectStatusLabel
  });
  const hasActiveContext = Boolean(summary.hasActiveContext) || hasVisibleProductionContext({
    answeredQuestionCount,
    openVisibleQuestionCount,
    planStatusLabel,
    productionObjectCount,
    purchaseListCount,
    purchaseStatusLabel
  });
  const layoutClassName = hasActiveContext
    ? "production-conversation-layout production-conversation-layout--active-context"
    : "production-conversation-layout";

  const inputPanel = (
      <article className="production-composer" aria-label="Zentrale Produktionsarbeit">
        {!hasActiveContext ? <header className="production-composer__header">

          <h3>Angebot hochladen oder Auftrag beschreiben</h3>
          <p className="helper-text">
            Quelle einfügen, dann prüfst du die erkannten Daten. Produktionsplan, Einkaufsliste und Exporte entstehen erst nach diesem Review.
          </p>
        </header> : null}
        {slots.inputSlot}
      </article>
  );

  return (
    <section className={layoutClassName} aria-label="Produktionsagent Conversational Workbench">
      {hasActiveContext ? (
        <>
          <aside className="production-calm-summary" aria-label="Kompakte Produktionszusammenfassung">
            <h3>{summary.hasActiveContext ? "Auftragsstand Küche" : "Bestandsdaten im Hintergrund"}</h3>
            <strong>{activeSpecLabel}</strong>
            {!summary.hasActiveContext ? <p className="helper-text">Kontext aus Demo, Bestand oder vorherigem Lauf. Für einen neuen Auftrag zuerst eine Datei oder Texteingabe übernehmen.</p> : null}
            {summary.productionNotes?.length ? <section aria-label="Auftrags- und Küchenhinweise"><h4>Auftrags- und Küchenhinweise</h4><p>Vorgaben separat prüfen. Dies ist keine Sonderkost-, Allergen- oder Hygienefreigabe.</p><ul>{summary.productionNotes.map(note => <li key={note}>{note}</li>)}</ul></section> : null}
            <ul className="production-calm-summary__facts" aria-label="Datenstand Produktionsauftrag">
              {summaryFacts.map((fact) => (
                <li key={fact.label}>
                  <span>{fact.label}: </span>
                  <strong>{fact.value}</strong>
                </li>
              ))}
            </ul>
            <p className="helper-text">
              Mengen, Herkunft, Allergene, Preise und Freigabegrenzen bleiben vor Produktion zu prüfen.
            </p>

            {activeTechnicalContextLabel ? (
              <details className="technical-context-details">
                <summary>Technische Details</summary>
                <p className="helper-text">{activeTechnicalContextLabel}</p>
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
        </>
      ) : null}
      {inputPanel}
      {hasActiveContext ? (
        <>
          <div className="production-progressive-zone">
        <details className="progressive-panel" open={questionCount > 0}>
          <summary>
            <span>Rückfragen und Antworten</span>
            <strong>offen {openVisibleQuestionCount} · beantwortet {answeredQuestionCount}</strong>
          </summary>
          <div className="progressive-panel__body">{slots.questionsSlot}</div>
        </details>
          </div>

          <div className="production-objects-zone">
        <article
          id={productionOutputAnchorId}
          className="production-output-anchor"
          aria-label="Ergebnisse der Produktion"
        >

          <h3>{productionOutputAnchor.title}</h3>
          <p className="helper-text">{productionOutputAnchor.description}</p>
          <p className="helper-text">{productionOutputAnchor.grouping}</p>
        </article>
        <details className="progressive-panel production-objects-panel" open={productionObjectCount > 0}>
          <summary>
            <span>Produktionsplan</span>
            <strong>{productionObjectStatusLabel}</strong>
          </summary>
          <div className="progressive-panel__body">{slots.productionObjectsSlot}</div>
        </details>
          </div>

          <div className="production-purchase-zone">
        <details className="progressive-panel production-purchase-panel" open={purchaseListCount > 0}>
          <summary>
            <span>Einkaufsliste</span>
            <strong>{purchaseStatusLabel}</strong>
          </summary>
          <div className="progressive-panel__body">{slots.purchaseListSlot}</div>
        </details>
          </div>

          <div className="production-lower-zones">{slots.lowerSlots}</div>
        </>
      ) : null}
    </section>
  );
}
