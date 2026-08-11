import type { BusinessContext, ProductionHandoff } from "@catering/shared-core";

export interface ProductionHandoffReader {
  get(context: BusinessContext, handoffId: string): Promise<ProductionHandoff | undefined>;
}
