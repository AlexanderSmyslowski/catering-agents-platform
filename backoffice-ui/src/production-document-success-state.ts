import { extractAcceptedSpecId } from "./production-api-response-ids.js";

export type ProductionDocumentSuccessActions = {
  setFocusedProductionSpecId: (specId: string) => void;
  completeIncomingProductionFile: () => void;
  completeDocumentProgress: () => void;
  refreshDashboard: () => Promise<void>;
  setNotice: (message: string) => void;
};

export async function completeProductionStateAfterDocumentSuccess(
  file: File,
  response: Record<string, unknown>,
  actions: ProductionDocumentSuccessActions
) {
  const specId = extractAcceptedSpecId(response);
  if (specId) {
    actions.setFocusedProductionSpecId(specId);
  }
  actions.completeIncomingProductionFile();
  actions.completeDocumentProgress();
  await actions.refreshDashboard();
  actions.setNotice(`Dokument ${file.name} wurde übernommen und analysiert.`);
}

export async function completeProductionDraftStateAfterDocumentSuccess(
  file: File,
  actions: Omit<ProductionDocumentSuccessActions, "setFocusedProductionSpecId">
) {
  actions.completeIncomingProductionFile();
  actions.completeDocumentProgress();
  try {
    await actions.refreshDashboard();
  } catch {
    actions.setNotice(
      `KI-Entwurf für ${file.name} ist bereit zur Prüfung. Die Arbeitsfläche konnte nicht neu geladen werden; bitte lade die Seite neu.`
    );
    return;
  }
  actions.setNotice(`KI-Entwurf für ${file.name} ist bereit zur Prüfung.`);
}
