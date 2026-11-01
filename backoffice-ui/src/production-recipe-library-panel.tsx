import { useRef, useState, type ChangeEvent } from "react";
import type { RecipeNumberFormat } from "../../shared-core/src/recipe-library.js";
import type { RecipeReviewCounts } from "./production-recipe-review-state.js";

export type { RecipeReviewCounts } from "./production-recipe-review-state.js";

export type ProductionRecipeStatusState = {
  recipeReviewStatusLabel: string;
  recipeUsageStatusLabel: string;
  recipeReviewCounts: RecipeReviewCounts;
  recipeCount: number;
};

export type ProductionRecipeUploadState = {
  recipeName: string;
  recipeFile: File | null;
};

export type ProductionRecipeLibraryState = {
  filteredRecipes: Array<Record<string, unknown>>;
};

export type ProductionRecipeActions = {
  setRecipeName: (value: string) => void;
  setRecipeFile: (file: File | null) => void;
  uploadRecipe: (target: "offer" | "production", numberFormat?: RecipeNumberFormat) => Promise<void>;
  reviewRecipe: (
    target: "offer" | "production",
    recipeId: string,
    decision: "approve" | "verify" | "reject"
  ) => Promise<void>;
};

type ProductionRecipeLibraryPanelProps = {
  statusState: ProductionRecipeStatusState;
  uploadState: ProductionRecipeUploadState;
  libraryState: ProductionRecipeLibraryState;
  recipeActions: ProductionRecipeActions;
  submitting: boolean;
};

/** The source tier is a provenance class, not an approval state. In particular
 * "internal_approved" is assigned to every own upload, also while the separate
 * library approval state still requires review. */
export function translateRecipeTier(value?: string): string {
  const labels: Record<string, string> = {
    internal_verified: "eigene Rezeptsammlung, verifiziert",
    digitized_cookbook: "digitalisiertes Kochbuch",
    internal_approved: "eigene Rezeptsammlung",
    internet_fallback: "Internet-Ausweichquelle"
  };
  return value ? labels[value] ?? value : "-";
}

type LibraryDecision = "approve" | "verify" | "reject";

const decisionQuestion: Record<LibraryDecision, string> = {
  approve: "in der Bibliothek freigeben",
  verify: "in der Bibliothek verifizieren und damit freigeben",
  reject: "in der Bibliothek ablehnen"
};

function translateApprovalState(value?: string): string {
  const labels: Record<string, string> = {
    approved_internal: "intern freigegeben",
    auto_usable: "automatisch nutzbar",
    review_required: "Prüfung nötig",
    rejected: "abgelehnt"
  };
  return value ? labels[value] ?? value : "-";
}

export function ProductionRecipeLibraryPanel({
  statusState,
  uploadState,
  libraryState,
  recipeActions,
  submitting
}: ProductionRecipeLibraryPanelProps) {
  const { recipeReviewStatusLabel, recipeUsageStatusLabel, recipeReviewCounts, recipeCount } = statusState;
  const { recipeName, recipeFile } = uploadState;
  const [decisionTarget, setDecisionTarget] = useState<{ recipeId: string; decision: LibraryDecision }>();
  const [deciding, setDeciding] = useState(false);
  const decidingRef = useRef(false);
  const [numberFormat, setNumberFormat] = useState<RecipeNumberFormat | "">("");
  const { filteredRecipes } = libraryState;
  const { setRecipeName, setRecipeFile, uploadRecipe, reviewRecipe } = recipeActions;

  return (
    <>
      <article className="recipe-review-status-zone" aria-label="Rezeptprüfung">
        <div>
          <p className="eyebrow">Rezeptprüfung</p>
          <h3>{recipeReviewStatusLabel}</h3>
          <p className="helper-text">{recipeUsageStatusLabel}</p>
        </div>
        <p className="helper-text">
          {recipeReviewCounts.rejected} abgelehnt · {recipeCount} Rezepte insgesamt ·
          Bibliotheksfreigaben gelten unabhängig von der Freigabe für einen Auftrag.
        </p>
      </article>

      <details className="panel secondary-panel secondary-rail-details">
        <summary>
          <span className="eyebrow">Rezeptbibliothek</span>
          <span className="subsection-title">Rezepte verwalten</span>
          <span className="helper-text">
            {recipeCount} Rezepte · {recipeReviewCounts.approved} freigegeben · {recipeReviewCounts.reviewRequired} Prüfung nötig
          </span>
        </summary>
        <div className="secondary-rail-details__content form-panel">
          <header>
            <p className="eyebrow">Rezeptupload</p>
            <h3>Zusätzliche Rezepte in die Küchenbibliothek übernehmen</h3>
          </header>
          <label className="field-block"><span>Rezeptname (optional)</span><input
            value={recipeName}
            onChange={(event) => setRecipeName(event.target.value)}
            placeholder="Optionaler Rezeptname"
          /></label>
          <label className="field-block"><span>Rezeptdatei</span><input
            className="file-input"
            type="file"
            accept=".pdf,.txt,.md,text/plain,application/pdf"
            onChange={(event: ChangeEvent<HTMLInputElement>) => { setRecipeFile(event.target.files?.[0] ?? null); setNumberFormat(""); }}
          /></label>
          <label className="field-block">
            <span>Zahlenformat der Rezeptdatei</span>
            <select value={numberFormat} disabled={submitting || !recipeFile} onChange={event => setNumberFormat(event.target.value as RecipeNumberFormat | "")}>
              <option value="">Nicht festgelegt</option>
              <option value="de">Deutsch · 1.234,5</option>
              <option value="en">Englisch · 1,234.5</option>
            </select>
            <span className="helper-text">Wähle das Format aus deiner Datei. Ohne Auswahl werden mehrdeutige Mengen nicht übernommen.</span>
          </label>
          <div className="action-row">
            <button disabled={submitting || !recipeFile} onClick={() => void uploadRecipe("offer", numberFormat || undefined)}>
              Für Angebote speichern
            </button>
            <button disabled={submitting || !recipeFile} onClick={() => void uploadRecipe("production", numberFormat || undefined)}>
              Für Produktion speichern
            </button>
          </div>
          {recipeFile ? <p className="helper-text">Ausgewählt: {recipeFile.name}</p> : null}
          <div className="divider" />
          <header>
            <p className="eyebrow">Rezeptbestand</p>
            <h3>Freigaben, Herkunft und Internet-Ausweichquellen</h3>
            <p className="helper-text">
              Der Bibliotheksstatus zeigt, ob ein Rezept freigegeben ist; die Herkunft sagt nur, woher es stammt.
              „Verifizieren“ gibt ein Rezept frei und kennzeichnet es zusätzlich als intern verifiziert.
            </p>
          </header>
          <ul className="item-list compact">
            {filteredRecipes.slice(0, 12).map((recipe) => (
              <li key={String(recipe.recipeId)}>
                <strong>{String(recipe.name)}</strong>
                <p>
                  Bibliotheksstatus: {translateApprovalState(String((recipe.source as Record<string, unknown>)?.approvalState ?? "-"))} ·{" "}
                  Herkunft: {translateRecipeTier(String((recipe.source as Record<string, unknown>)?.tier ?? "-"))}
                </p>
                <div className="action-row">
                  <button
                    className="secondary-button"
                    disabled={submitting}
                    onClick={() => setDecisionTarget({ recipeId: String(recipe.recipeId), decision: "approve" })}
                  >
                    Freigeben
                  </button>
                  <button
                    className="secondary-button"
                    disabled={submitting}
                    onClick={() => setDecisionTarget({ recipeId: String(recipe.recipeId), decision: "verify" })}
                  >
                    Verifizieren
                  </button>
                  <button
                    className="secondary-button destructive-button"
                    disabled={submitting}
                    onClick={() => setDecisionTarget({ recipeId: String(recipe.recipeId), decision: "reject" })}
                  >
                    Ablehnen
                  </button>
                </div>
                {decisionTarget?.recipeId === String(recipe.recipeId) ? <div className="production-discard-confirmation" role="group" aria-label="Bibliotheksentscheidung bestätigen">
                  <p>„{String(recipe.name)}“ {decisionQuestion[decisionTarget.decision]}?</p>
                  {decisionTarget.decision === "reject" ? null : <p className="helper-text">Die Bibliotheksfreigabe ersetzt nicht die Freigabe für einen Auftrag.</p>}
                  <button type="button" disabled={submitting || deciding} onClick={() => {
                    if (decidingRef.current) return;
                    decidingRef.current = true; setDeciding(true);
                    void reviewRecipe("production", decisionTarget.recipeId, decisionTarget.decision).finally(() => { decidingRef.current = false; setDeciding(false); setDecisionTarget(undefined); });
                  }}>Bestätigen</button>
                  <button type="button" className="secondary-button" disabled={submitting || deciding} onClick={() => setDecisionTarget(undefined)}>Abbrechen</button>
                </div> : null}
              </li>
            ))}
            {filteredRecipes.length === 0 ? <li>Noch keine Rezepte vorhanden.</li> : null}
          </ul>
        </div>
      </details>
    </>
  );
}
