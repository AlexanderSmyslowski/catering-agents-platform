// @vitest-environment jsdom
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it } from "vitest";
import { useRecipeUploadDraft } from "../backoffice-ui/src/use-recipe-upload-draft.js";

type RecipeUploadDraft = ReturnType<typeof useRecipeUploadDraft>;

const roots: Array<ReturnType<typeof createRoot>> = [];

afterEach(() => {
  for (const root of roots.splice(0)) {
    act(() => {
      root.unmount();
    });
  }
  document.body.innerHTML = "";
});

function renderRecipeUploadDraft() {
  let draft: RecipeUploadDraft | undefined;
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  roots.push(root);

  function Probe() {
    draft = useRecipeUploadDraft();
    return null;
  }

  act(() => {
    root.render(createElement(Probe));
  });

  return {
    get draft() {
      if (!draft) {
        throw new Error("Recipe upload draft hook did not render.");
      }
      return draft;
    }
  };
}

describe("useRecipeUploadDraft", () => {
  it("starts empty and tracks the selected recipe file by reference", () => {
    const probe = renderRecipeUploadDraft();
    const file = new File(["Rezept"], "rezept.txt", { type: "text/plain" });

    expect(probe.draft.recipeName).toBe("");
    expect(probe.draft.recipeFile).toBeNull();

    act(() => {
      probe.draft.setRecipeName("Hummus");
      probe.draft.setRecipeFile(file);
    });

    expect(probe.draft.recipeName).toBe("Hummus");
    expect(probe.draft.recipeFile).toBe(file);
  });

  it("clears name and file together after a successful upload", () => {
    const probe = renderRecipeUploadDraft();
    const file = new File(["Rezept"], "rezept.txt");

    act(() => {
      probe.draft.setRecipeName("Focaccia");
      probe.draft.setRecipeFile(file);
    });
    act(() => {
      probe.draft.clearRecipeUploadDraft();
    });

    expect(probe.draft.recipeName).toBe("");
    expect(probe.draft.recipeFile).toBeNull();
  });
});
