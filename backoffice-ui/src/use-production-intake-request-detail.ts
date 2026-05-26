import { useEffect, useState } from "react";
import {
  loadIntakeRequestDetail,
  type IntakeRequestDetail
} from "./api.js";

export type ProductionIntakeRequestDetailLoader = (requestId: string) => Promise<IntakeRequestDetail>;

export type UseProductionIntakeRequestDetailOptions = {
  currentIntakeRequestId?: string;
  loadDetail?: ProductionIntakeRequestDetailLoader;
};

export function useProductionIntakeRequestDetail({
  currentIntakeRequestId,
  loadDetail = loadIntakeRequestDetail
}: UseProductionIntakeRequestDetailOptions) {
  const [intakeRequestDetail, setIntakeRequestDetail] = useState<IntakeRequestDetail | null>(null);
  const [intakeRequestDetailError, setIntakeRequestDetailError] = useState<string>();

  function resetIntakeRequestDetail() {
    setIntakeRequestDetail(null);
    setIntakeRequestDetailError(undefined);
  }

  useEffect(() => {
    if (!currentIntakeRequestId) {
      resetIntakeRequestDetail();
      return;
    }

    let cancelled = false;
    setIntakeRequestDetail(null);
    setIntakeRequestDetailError(undefined);

    void loadDetail(currentIntakeRequestId)
      .then((detail) => {
        if (!cancelled) {
          setIntakeRequestDetail(detail);
        }
      })
      .catch((fetchError) => {
        if (!cancelled) {
          setIntakeRequestDetailError(
            `Die ursprüngliche Intake-Anfrage konnte nicht geladen werden: ${String(
              (fetchError as Error).message ?? fetchError
            )}`
          );
        }
      });

    return () => {
      cancelled = true;
    };
  }, [currentIntakeRequestId, loadDetail]);

  return {
    intakeRequestDetail,
    intakeRequestDetailError,
    resetIntakeRequestDetail
  };
}
