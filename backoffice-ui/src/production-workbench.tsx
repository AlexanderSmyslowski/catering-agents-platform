import { useEffect, useRef, useState, type MouseEvent, type ReactNode } from "react";
import { MiniPilotCheckPanel } from "./mini-pilot-check-panel.js";
import type { MiniPilotCheckReportState } from "./mini-pilot-check-report-state.js";
import { shouldShowMiniPilotPanel } from "./mini-pilot-panel-gate.js";
import { buildProductionMiniPilotCardState } from "./production-mini-pilot-card-state.js";
import { buildProductionWorkbenchOutputAnchorState } from "./production-workbench-output-anchor-state.js";

const productionStages = [
  { id: "input", label: "Auftrag" },
  { id: "questions", label: "Rückfragen" },
  { id: "planning", label: "Rezepte und Mengen" },
  { id: "production", label: "Produktionsplan" },
  { id: "purchase", label: "Einkauf" },
  { id: "resources", label: "Übergabe und Rezepte" }
] as const;
type ProductionStage = (typeof productionStages)[number]["id"];
function isProductionStage(value: string | undefined): value is ProductionStage {
  return productionStages.some(item => item.id === value);
}

export type ProductionWorkbenchSummary = {
  approvalState?: "pending" | "approved" | "applied";
  productionNotes?: string[];
  /** Raw note strings not shown verbatim above (identifiers, combined duplicates). */
  productionNoteLineage?: string[];
  hasActiveContext?: boolean;
  hasHistoricalApplied?: boolean;
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
  planningSlot?: ReactNode;
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
  hasHistoricalApplied?: boolean;
}): Array<{ label: string; value: string }> {
  return [
    {
      label: "Status",
      value: input.approvalState === "applied"
        ? input.openVisibleQuestionCount > 0
          ? `Plan übernommen · ${input.openVisibleQuestionCount} fachliche ${input.openVisibleQuestionCount === 1 ? "Rückfrage offen" : "Rückfragen offen"}`
          : `Plan übernommen · Angaben: ${formatOperatorReadiness(input.readinessLabel)}`
        : formatOperatorReadiness(input.readinessLabel)
    },
    {
      label: "Rückfragen",
      value: `offen ${input.openVisibleQuestionCount} · beantwortet ${input.answeredQuestionCount}`
    },
    {
      label: "Plan",
      value: input.hasHistoricalApplied && input.planStatusLabel === "offen" ? "neue Fassung: noch kein Plan · bisheriger Plan bleibt verfügbar" : formatOperatorPlanStatus(input.planStatusLabel)
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
      label: "Freigabe für diesen Auftrag",
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
  const [stage, setStage] = useState<ProductionStage>("input");
  const rootRef = useRef<HTMLElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    function reveal(event: Event) {
      const detail = (event as CustomEvent<{ selector?: string; id?: string }>).detail;
      let target: Element | null = detail?.id ? document.getElementById(detail.id) : null;
      if (!target && detail?.selector) {
        try { target = rootRef.current?.querySelector(detail.selector) ?? null; } catch { return; }
      }
      if (!target || !rootRef.current?.contains(target)) return;
      const next = target?.closest<HTMLElement>("[data-production-stage]")?.dataset.productionStage;
      if (isProductionStage(next)) setStage(next);
    }
    window.addEventListener("production:reveal", reveal);
    return () => window.removeEventListener("production:reveal", reveal);
  }, []);

  function revealLink(event: MouseEvent<HTMLElement>) {
    const link = (event.target as Element).closest<HTMLAnchorElement>('a[href^="#production-"]');
    const id = link?.getAttribute("href")?.slice(1);
    const target = id ? document.getElementById(id) : null;
    const next = target?.closest<HTMLElement>("[data-production-stage]")?.dataset.productionStage;
    if (!target || !isProductionStage(next) || next === stage) return;
    event.preventDefault();
    setStage(next);
    requestAnimationFrame(() => {
      for (let parent = target.parentElement; parent; parent = parent.parentElement) {
        if (parent instanceof HTMLDetailsElement) parent.open = true;
      }
      target.focus({ preventScroll: true });
      target.scrollIntoView?.({ block: "start", inline: "nearest", behavior: "auto" });
    });
  }

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
    productionObjectStatusLabel,
    hasHistoricalApplied: summary.hasHistoricalApplied
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
    <section ref={rootRef} className={layoutClassName} aria-label="Produktionsagent Conversational Workbench" onClickCapture={revealLink}>
      <nav className="production-stage-nav" aria-label="Produktionsschritte">
        {productionStages.map((item, index) => (
          <button key={item.id} type="button" aria-current={stage === item.id ? "step" : undefined}
            onClick={() => { setStage(item.id); requestAnimationFrame(() => headingRef.current?.focus()); }}>
            <span aria-hidden="true">{index + 1}</span>{item.label}
          </button>
        ))}
      </nav>
      <header className="production-stage-heading">
        <h3 ref={headingRef} tabIndex={-1}>{productionStages.find(item => item.id === stage)?.label}</h3>
      </header>
      {hasActiveContext ? (
        <>
          <details className="production-calm-summary" aria-label="Kompakte Produktionszusammenfassung">
            <summary>Auftragsstand und Hinweise</summary>
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

            {activeTechnicalContextLabel || summary.productionNoteLineage?.length ? (
              <details className="technical-context-details">
                <summary>Technische Details</summary>
                {activeTechnicalContextLabel ? <p className="helper-text">{activeTechnicalContextLabel}</p> : null}
                {summary.productionNoteLineage?.length ? <>
                  <p className="helper-text">Ursprüngliche Hinweistexte:</p>
                  <ul className="item-list compact">{summary.productionNoteLineage.map(note => <li key={note} className="helper-text">{note}</li>)}</ul>
                </> : null}
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
          </details>
        </>
      ) : null}
      {hasActiveContext ? (
          <div className="production-progressive-zone production-stage-panel" data-production-stage="questions" hidden={stage !== "questions"}>
        <details className="progressive-panel" open={questionCount > 0}>
          <summary>
            <span>Rückfragen und Antworten</span>
            <strong>offen {openVisibleQuestionCount} · beantwortet {answeredQuestionCount}</strong>
          </summary>
          <div className="progressive-panel__body">{slots.questionsSlot}</div>
        </details>
          </div>
      ) : null}
      <div className="production-stage-panel" data-production-stage="input" hidden={stage !== "input"}>{inputPanel}</div>
      {hasActiveContext ? (
        <>
          <div className="production-objects-zone production-stage-panel" data-production-stage="production" hidden={stage !== "production"}>
        <article
          id={productionOutputAnchorId}
          className="production-output-anchor"
          aria-label="Ergebnisse der Produktion"
        >

          <h3>{summary.hasHistoricalApplied ? "Neue Prüffassung vorbereiten" : productionOutputAnchor.title}</h3>
          <p className="helper-text">{summary.hasHistoricalApplied ? "Für die neue Prüffassung sind Plan und Einkauf noch nicht vorbereitet." : productionOutputAnchor.description}</p>
          <p className="helper-text">{summary.hasHistoricalApplied ? "Den bisherigen Plan und die bisherigen Unterlagen findest du oben." : productionOutputAnchor.grouping}</p>
        </article>
        <details className="progressive-panel production-objects-panel" open={productionObjectCount > 0}>
          <summary>
            <span>Produktionsplan</span>
            <strong>{productionObjectStatusLabel}</strong>
          </summary>
          <div className="progressive-panel__body">{slots.productionObjectsSlot}</div>
        </details>
          </div>

          <div className="production-purchase-zone production-stage-panel" data-production-stage="purchase" hidden={stage !== "purchase"}>
        <details className="progressive-panel production-purchase-panel" open={purchaseListCount > 0}>
          <summary>
            <span>Einkaufsliste</span>
            <strong>{purchaseStatusLabel}</strong>
          </summary>
          <div className="progressive-panel__body">{slots.purchaseListSlot}</div>
        </details>
          </div>

          {slots.planningSlot ? <div className="production-planning-zone production-stage-panel" data-production-stage="planning" hidden={stage !== "planning"}>{slots.planningSlot}</div> : null}
          <div className="production-lower-zones production-stage-panel" data-production-stage="resources" hidden={stage !== "resources"}>{slots.lowerSlots}</div>
        </>
      ) : stage !== "input" ? <p className="helper-text">Bitte zuerst einen Auftrag eingeben oder öffnen. Danach stehen die zugehörigen Arbeitsschritte hier bereit.</p> : null}
    </section>
  );
}
