import type { ChangeEvent } from "react";

export type RecipeReviewCounts = {
  approved: number;
  reviewRequired: number;
  rejected: number;
};

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
  uploadRecipe: (target: "offer" | "production") => Promise<void>;
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

function translateRecipeTier(value?: string): string {
  const labels: Record<string, string> = {
    internal_verified: "intern verifiziert",
    digitized_cookbook: "digitalisiertes Kochbuch",
    internal_approved: "intern freigegeben",
    internet_fallback: "Internet-Ausweichquelle"
  };
  return value ? labels[value] ?? value : "-";
}

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
          {recipeReviewCounts.rejected} abgelehnt · {recipeCount} Rezepte insgesamt · Review-Actions bleiben in der
          Bibliothek unverändert.
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
          <input
            value={recipeName}
            onChange={(event) => setRecipeName(event.target.value)}
            placeholder="Optionaler Rezeptname"
          />
          <input
            className="file-input"
            type="file"
            accept=".pdf,.txt,.md,text/plain,application/pdf"
            onChange={(event: ChangeEvent<HTMLInputElement>) => setRecipeFile(event.target.files?.[0] ?? null)}
          />
          <div className="action-row">
            <button disabled={submitting} onClick={() => void uploadRecipe("offer")}>
              Über Angebotsagent speichern
            </button>
            <button disabled={submitting} onClick={() => void uploadRecipe("production")}>
              Über Produktionsagent speichern
            </button>
          </div>
          {recipeFile ? <p className="helper-text">Ausgewählt: {recipeFile.name}</p> : null}
          <div className="divider" />
          <header>
            <p className="eyebrow">Rezeptbestand</p>
            <h3>Freigaben, Herkunft und Internet-Ausweichquellen</h3>
          </header>
          <ul className="item-list compact">
            {filteredRecipes.slice(0, 12).map((recipe) => (
              <li key={String(recipe.recipeId)}>
                <strong>{String(recipe.name)}</strong>
                <p>
                  {translateRecipeTier(String((recipe.source as Record<string, unknown>)?.tier ?? "-"))} ·{" "}
                  {translateApprovalState(String((recipe.source as Record<string, unknown>)?.approvalState ?? "-"))}
                </p>
                <div className="action-row">
                  <button
                    className="secondary-button"
                    disabled={submitting}
                    onClick={() => void reviewRecipe("production", String(recipe.recipeId), "approve")}
                  >
                    Freigeben
                  </button>
                  <button
                    className="secondary-button"
                    disabled={submitting}
                    onClick={() => void reviewRecipe("production", String(recipe.recipeId), "verify")}
                  >
                    Verifizieren
                  </button>
                  <button
                    className="secondary-button destructive-button"
                    disabled={submitting}
                    onClick={() => void reviewRecipe("production", String(recipe.recipeId), "reject")}
                  >
                    Ablehnen
                  </button>
                </div>
              </li>
            ))}
            {filteredRecipes.length === 0 ? <li>Noch keine Rezepte vorhanden.</li> : null}
          </ul>
        </div>
      </details>
    </>
  );
}
