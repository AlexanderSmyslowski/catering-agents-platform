import { validateProductionHandoff, type BusinessContext, type ProductionHandoff } from "@catering/shared-core";
import type { ProductionHandoffReader } from "../ports/production-handoff-reader.js";

export interface HttpProductionHandoffReaderOptions {
  offerServiceUrl: string;
  trustedServiceSecret?: string;
  fetch?: typeof globalThis.fetch;
}

export class HttpProductionHandoffReader implements ProductionHandoffReader {
  private readonly fetcher: typeof globalThis.fetch;
  constructor(private readonly options: HttpProductionHandoffReaderOptions) { this.fetcher = options.fetch ?? globalThis.fetch; }
  async getHandoff(context: BusinessContext, handoffId: string): Promise<ProductionHandoff | undefined> {
    const response = await this.fetcher(`${this.options.offerServiceUrl.replace(/\/$/, "")}/v1/offers/handoffs/${encodeURIComponent(handoffId)}`, { headers: {
      "x-catering-actor-name": "Produktions-Mitarbeiter", "x-catering-business-id": context.businessId,
      ...(this.options.trustedServiceSecret ? { "x-catering-trusted-secret": this.options.trustedServiceSecret } : {})
    } });
    if (response.status === 404) return undefined;
    if (!response.ok) throw new Error("Produktionsübergabe konnte nicht geladen werden.");
    const payload = await response.json() as { handoff?: ProductionHandoff };
    if (!payload.handoff) throw new Error("Produktionsübergabe enthält kein gültiges Handoff-Artefakt.");
    const handoff = validateProductionHandoff(payload.handoff);
    if (handoff.handoffId !== handoffId || handoff.businessId !== context.businessId) {
      throw new Error("Produktionsübergabe passt nicht zur angeforderten Identität.");
    }
    return handoff;
  }
}
