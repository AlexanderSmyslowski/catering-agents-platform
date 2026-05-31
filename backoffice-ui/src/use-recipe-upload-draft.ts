import { useState } from "react";

export function useRecipeUploadDraft() {
  const [recipeName, setRecipeName] = useState("");
  const [recipeFile, setRecipeFile] = useState<File | null>(null);

  function clearRecipeUploadDraft() {
    setRecipeName("");
    setRecipeFile(null);
  }

  return {
    recipeName,
    setRecipeName,
    recipeFile,
    setRecipeFile,
    clearRecipeUploadDraft
  };
}
