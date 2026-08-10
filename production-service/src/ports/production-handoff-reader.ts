import type { BusinessContext, ProductionHandoff } from "@catering/shared-core";

export interface ProductionHandoffReader {
  getHandoff(context: BusinessContext, handoffId: string): Promise<ProductionHandoff | undefined>;
}
