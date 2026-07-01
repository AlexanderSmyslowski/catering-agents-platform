import { extractAcceptedSpecId } from "./production-api-response-ids.js";

export type ProductionDocumentSuccessActions = {
  setFocusedProductionSpecId: (specId: string) => void;
  completeIncomingProductionFile: (resultSpec?: Record<string, unknown>) => void;
  completeDocumentProgress: () => void;
  refreshDashboard: () => Promise<void>;
  setNotice: (message: string) => void;
};

function extractAcceptedSpec(payload: Record<string, unknown>): Record<string, unknown> | undefined {
  const spec = payload.acceptedEventSpec;
  return spec && typeof spec === "object" && !Array.isArray(spec) ? (spec as Record<string, unknown>) : undefined;
}

export async function completeProductionStateAfterDocumentSuccess(
  file: File,
  response: Record<string, unknown>,
  actions: ProductionDocumentSuccessActions
) {
  const specId = extractAcceptedSpecId(response);
  const acceptedSpec = extractAcceptedSpec(response);
  if (specId) {
    actions.setFocusedProductionSpecId(specId);
  }
  actions.completeIncomingProductionFile(acceptedSpec);
  actions.completeDocumentProgress();
  await actions.refreshDashboard();
  actions.setNotice(`Dokument ${file.name} wurde übernommen und analysiert.`);
}
