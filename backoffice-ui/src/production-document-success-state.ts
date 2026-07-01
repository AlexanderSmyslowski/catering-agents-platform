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
  actions.setNotice(
    `Dokument ${file.name} ist zur Prüfung übernommen. Erkannte Produktionsgrundlage prüfen, Rückfragen klären und danach Berechnung starten; keine automatische Produktionsfreigabe.`
  );
}
