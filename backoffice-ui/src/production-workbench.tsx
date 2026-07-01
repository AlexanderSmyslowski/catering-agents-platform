import { useEffect, useRef, type ReactNode } from "react";
import { MiniPilotCheckPanel } from "./mini-pilot-check-panel.js";
import type { MiniPilotCheckReportState } from "./mini-pilot-check-report-state.js";
import { shouldShowMiniPilotPanel } from "./mini-pilot-panel-gate.js";
import { buildProductionMiniPilotCardState } from "./production-mini-pilot-card-state.js";
import { buildProductionWorkbenchOutputAnchorState } from "./production-workbench-output-anchor-state.js";

export type ProductionWorkbenchSummary = {
  activeSpecLabel: string;
  activeTechnicalContextLabel?: string;
  specFacts?: Array<{
    label: string;
    value: string;
  }>;
  assuranceFacts?: Array<{
    label: string;
    value: string;
  }>;
  dossierMetrics?: {
    answeredQuestionCount: number;
    questionPreview?: string;
    assumptionCount: number;
    assumptionPreview?: string;
    productionBatchCount: number;
    kitchenSheetCount: number;
    recipeSelectionCount: number;
    purchaseItemCount: number;
    exportStatusLabel?: string;
  };
  readinessLabel: string;
  planStatusLabel: string;
  purchaseStatusLabel: string;
  questionCount: number;
  answeredQuestionCount: number;
  unansweredQuestionCount: number;
  productionObjectCount: number;
  productionObjectStatusLabel: string;
  purchaseListCount: number;
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
  return productionObjectStatusLabel
    .replace("unzureichend", "Prüfung nötig")
    .replace("vollständig", "vollständig, Freigabe nicht erteilt");
}

function formatCount(value: number, singular: string, plural: string): string {
  return value === 1 ? `1 ${singular}` : `${value} ${plural}`;
}

function buildMandatoryCheckText(input: {
  hasVisibleProductionWork: boolean;
  openVisibleQuestionCount: number;
  questionPreview?: string;
  assumptionCount?: number;
}): string | undefined {
  if (!input.hasVisibleProductionWork) {
    return undefined;
  }

  const questionPreview = input.questionPreview?.trim();
  if (input.openVisibleQuestionCount > 0) {
    const questionLabel = formatCount(input.openVisibleQuestionCount, "offene Rückfrage", "offene Rückfragen");
    return questionPreview
      ? `Pflichtprüfung: ${questionLabel} vor Berechnung klären; nächste Frage: ${questionPreview}`
      : `Pflichtprüfung: ${questionLabel} vor Berechnung klären.`;
  }

  const assumptionCount = input.assumptionCount ?? 0;
  if (assumptionCount > 0) {
    const assumptionLabel = formatCount(assumptionCount, "Annahme", "Annahmen");
    return `Pflichtprüfung: keine offenen Rückfragen sichtbar; ${assumptionLabel} vor Freigabe fachlich prüfen.`;
  }

  return "Pflichtprüfung: keine offenen Rückfragen sichtbar; Annahmen und Festlegungen vor Freigabe fachlich prüfen.";
}

function buildArtifactFact(input: {
  dossierMetrics?: ProductionWorkbenchSummary["dossierMetrics"];
  productionObjectCount: number;
  purchaseListCount: number;
}): { label: string; value: string } | undefined {
  const parts: string[] = [];
  const productionBatchCount = input.dossierMetrics?.productionBatchCount ?? 0;
  const kitchenSheetCount = input.dossierMetrics?.kitchenSheetCount ?? 0;
  const purchaseItemCount = input.dossierMetrics?.purchaseItemCount;

  if (productionBatchCount > 0) {
    parts.push(formatCount(productionBatchCount, "Mengenkalkulation", "Mengenkalkulationen"));
  } else if (input.productionObjectCount > 0) {
    parts.push(formatCount(input.productionObjectCount, "Produktionsplan", "Produktionspläne"));
  }

  if (kitchenSheetCount > 0) {
    parts.push(formatCount(kitchenSheetCount, "Küchen-/Arbeitsblatt", "Küchen-/Arbeitsblätter"));
  }

  if (typeof purchaseItemCount === "number" && purchaseItemCount > 0) {
    parts.push(formatCount(purchaseItemCount, "Einkaufsposition", "Einkaufspositionen"));
  } else if (input.purchaseListCount > 0) {
    const purchaseListLabel = formatCount(input.purchaseListCount, "Einkaufsliste", "Einkaufslisten");
    if (typeof purchaseItemCount === "number") {
      parts.push(`${purchaseListLabel} · 0 Einkaufspositionen`);
    } else {
      parts.push(purchaseListLabel);
    }
  }

  return parts.length > 0 ? { label: "Artefakte", value: parts.join(" · ") } : undefined;
}

function selectPrimaryProductionFacts(
  specFacts: NonNullable<ProductionWorkbenchSummary["specFacts"]>,
  input: {
    activeSpecLabel: string;
    dossierMetrics?: ProductionWorkbenchSummary["dossierMetrics"];
    productionObjectCount: number;
    purchaseListCount: number;
  }
): NonNullable<ProductionWorkbenchSummary["specFacts"]> {
  const preferredLabels = ["Veranstaltung", "Datum", "Personen", "Speisen"];
  const selected = preferredLabels
    .map((label) => specFacts.find((fact) => fact.label === label))
    .filter((fact): fact is { label: string; value: string } => Boolean(fact));
  const artifactFact = buildArtifactFact(input);
  const withArtifacts = (facts: NonNullable<ProductionWorkbenchSummary["specFacts"]>) =>
    artifactFact ? [...facts, artifactFact] : facts;

  if (selected.length > 0) {
    return withArtifacts(selected);
  }
  const fallbackFacts = specFacts.slice(0, 4);
  if (fallbackFacts.length > 0) {
    return withArtifacts(fallbackFacts);
  }
  const fallbackLabel = input.activeSpecLabel.trim();
  return withArtifacts(fallbackLabel ? [{ label: "Vorgang", value: fallbackLabel }] : []);
}

export function ProductionConversationalWorkbench({
  summary,
  nextStep,
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
    specFacts = [],
    assuranceFacts = [],
    dossierMetrics
  } = summary;
  const openVisibleQuestionCount = countOpenVisibleQuestions(
    questionCount,
    answeredQuestionCount,
    unansweredQuestionCount
  );
  const productionOutputAnchor = buildProductionWorkbenchOutputAnchorState({
    specFactCount: specFacts.length,
    questionCount,
    dossierMetrics,
    productionObjectCount,
    purchaseListCount
  });
  const hasVisibleProductionWork =
    specFacts.length > 0 ||
    questionCount > 0 ||
    answeredQuestionCount > 0 ||
    productionObjectCount > 0 ||
    purchaseListCount > 0;
  const productionResultsRef = useRef<HTMLDivElement>(null);
  const previousHasVisibleProductionWork = useRef(hasVisibleProductionWork);
  const inputSlot = hasVisibleProductionWork ? (
    <details className="progressive-panel production-input-collapse">
      <summary>
        <span>Anfrageeingang</span>
        {" "}
        <strong>Neue Eingabe oder Korrektur</strong>
      </summary>
      <div className="progressive-panel__body">{slots.inputSlot}</div>
    </details>
  ) : (
    slots.inputSlot
  );
  const composerEyebrow = hasVisibleProductionWork ? "Produktionsarbeitsstand" : "Anfrageeingang";
  const composerTitle = hasVisibleProductionWork
    ? "Prüfbare Produktionsgrundlage"
    : "Was braucht die Produktion als Nächstes?";
  const composerHelperText = hasVisibleProductionWork
    ? "Rückfragen, Pläne, Einkaufslisten und Exporte erscheinen im aktuellen Vorgang nach Verfügbarkeit."
    : "Anfrage als Datei oder Text einfügen; die Produktion zeigt Rückfragen, Status, Produktionsplan, Einkaufsliste und Exporte.";
  const primarySpecFacts = selectPrimaryProductionFacts(specFacts, {
    activeSpecLabel,
    dossierMetrics,
    productionObjectCount,
    purchaseListCount
  });
  const nextStepQuestionPreview =
    questionCount > 0 ? (dossierMetrics?.questionPreview?.trim() ?? "") : "";
  const mandatoryCheckText = buildMandatoryCheckText({
    hasVisibleProductionWork,
    openVisibleQuestionCount,
    questionPreview: nextStepQuestionPreview,
    assumptionCount: dossierMetrics?.assumptionCount
  });

  useEffect(() => {
    const becameVisible = hasVisibleProductionWork && !previousHasVisibleProductionWork.current;
    previousHasVisibleProductionWork.current = hasVisibleProductionWork;

    if (!becameVisible) {
      return;
    }

    const target = productionResultsRef.current;
    target?.scrollIntoView?.({ block: "start", behavior: "smooth" });
    target?.focus({ preventScroll: true });
  }, [hasVisibleProductionWork]);

  return (
    <section className="production-conversation-layout" aria-label="Produktionsagent Conversational Workbench">
      <article
        className={hasVisibleProductionWork ? "production-composer production-composer--compact" : "production-composer"}
        aria-label="Zentrale Produktionsarbeit"
      >
        <header className="production-composer__header">
          <p className="eyebrow">{composerEyebrow}</p>
          <h3>{composerTitle}</h3>
          <p className="helper-text">{composerHelperText}</p>
          {hasVisibleProductionWork && primarySpecFacts.length > 0 ? (
            <>
              <p className="eyebrow production-primary-facts-label">Erkannte Grundlage</p>
              <dl className="production-primary-facts" aria-label="Sofort sichtbare Produktionsdaten">
                {primarySpecFacts.map((fact) => (
                  <div key={fact.label}>
                    <dt>{fact.label}</dt>
                    <dd>{fact.value}</dd>
                  </div>
                ))}
              </dl>
            </>
          ) : null}
          <div className="production-next-step" aria-label="Nächster Produktionsschritt">
            <p className="eyebrow">Nächster Schritt</p>
            <strong>{nextStep.title}</strong>
            <p className="helper-text">{nextStep.description}</p>
            {mandatoryCheckText ? <p className="helper-text">{mandatoryCheckText}</p> : null}
          </div>
        </header>
        {hasVisibleProductionWork ? null : inputSlot}
      </article>

      <div
        ref={productionResultsRef}
        className="production-objects-zone"
        tabIndex={-1}
        aria-label="Aktuelle Produktionsergebnisse"
      >
        <article className="production-output-anchor" aria-label="Status der Produktionsarbeit">
          <p className="eyebrow">Ergebnisstatus</p>
          <h3>{productionOutputAnchor.title}</h3>
          <p className="helper-text">{productionOutputAnchor.description}</p>
          <p className="helper-text">{productionOutputAnchor.grouping}</p>
          {specFacts.length > 0 ? (
            <>
              <p className="eyebrow production-output-facts-label">Erkannte Eckdaten</p>
              <dl className="spec-fact-grid production-output-facts" aria-label="Erkannte Produktionsdaten">
                {specFacts.map((fact) => (
                  <div key={fact.label} className="spec-fact">
                    <dt>{fact.label}</dt>
                    <dd>{fact.value}</dd>
                  </div>
                ))}
              </dl>
            </>
          ) : null}
          {hasVisibleProductionWork && assuranceFacts.length > 0 ? (
            <>
              <p className="eyebrow production-output-facts-label">Kontrolle</p>
              <dl className="spec-fact-grid production-output-facts" aria-label="Kontrolle der Produktionsdaten">
                {assuranceFacts.map((fact) => (
                  <div key={fact.label} className="spec-fact">
                    <dt>{fact.label}</dt>
                    <dd>{fact.value}</dd>
                  </div>
                ))}
              </dl>
            </>
          ) : null}
          <details className="production-output-checklist-panel" open={hasVisibleProductionWork}>
            <summary>
              <span>Produktionsmappe-Status</span>
              {" "}
              <strong>{hasVisibleProductionWork ? "9 Prüfpunkte sichtbar" : "9 Prüfpunkte anzeigen"}</strong>
            </summary>
            <ol className="production-output-checklist" aria-label="Produktionsmappe-Status">
              {productionOutputAnchor.reviewItems.map((item, index) => (
                <li key={item.label}>
                  <span className="production-output-checklist__number" aria-hidden="true">{index + 1}</span>
                  <span className="production-output-checklist__body">
                    <strong>{item.label}</strong>
                    <span>{item.status}</span>
                  </span>
                </li>
              ))}
            </ol>
          </details>
        </article>
        <details className="progressive-panel production-objects-panel" open={productionObjectCount > 0}>
          <summary>
            <span>Produktionsplan</span>
            {" "}
            <strong>{productionObjectStatusLabel}</strong>
          </summary>
          <div className="progressive-panel__body">{slots.productionObjectsSlot}</div>
        </details>
      </div>

      <div className="production-purchase-zone">
        <details className="progressive-panel production-purchase-panel" open={purchaseListCount > 0}>
          <summary>
            <span>Einkaufsliste</span>
            {" "}
            <strong>{purchaseStatusLabel}</strong>
          </summary>
          <div className="progressive-panel__body">{slots.purchaseListSlot}</div>
        </details>
      </div>

      <aside className="production-calm-summary" aria-label="Kompakte Produktionszusammenfassung">
        <p className="eyebrow">Aktiver Produktionsauftrag</p>
        <strong>{activeSpecLabel}</strong>
        <p className="helper-text">
          Status: {formatOperatorReadiness(readinessLabel)} · Rückfragen: offen {openVisibleQuestionCount} · beantwortet{" "}
          {answeredQuestionCount}
        </p>
        <p className="helper-text">
          Plan: {formatOperatorPlanStatus(planStatusLabel)} · Einkaufsliste: {purchaseStatusLabel}
        </p>
        <p className="helper-text">Produktionsergebnis: {formatOperatorProductionObjects(productionObjectStatusLabel)}</p>
        <p className="helper-text">Freigabe: nicht erteilt.</p>
        <details className="technical-context-details">
          <summary>Freigabegrenzen</summary>
          <p className="helper-text">
            Interner Arbeitsstand: Produktion, Einkauf, Exporte, Herkunft und offene Punkte bleiben sichtbar.
          </p>
          <p className="helper-text">
            Bitte vor Freigabe prüfen: keine automatische Allergen-, Preis- oder Margenfreigabe.
          </p>
          <p className="helper-text">
            Grenze: nur interne Demo- oder Testdaten; keine externen Kunden und keine Produktionsfreigabe.
          </p>
        </details>
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

      <div className="production-progressive-zone">
        <details className="progressive-panel" open={questionCount > 0}>
          <summary>
            <span>Rückfragen und Antworten</span>
            {" "}
            <strong>offen {openVisibleQuestionCount} · beantwortet {answeredQuestionCount}</strong>
          </summary>
          <div className="progressive-panel__body">{slots.questionsSlot}</div>
        </details>
      </div>

      {hasVisibleProductionWork ? <div className="production-input-zone">{inputSlot}</div> : null}

      <div className="production-lower-zones">{slots.lowerSlots}</div>
    </section>
  );
}
