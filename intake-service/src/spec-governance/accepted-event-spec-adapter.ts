import { validateAcceptedEventSpec, type AcceptedEventSpec } from "@catering/shared-core";
import { IntakeStore } from "../store.js";

export interface AcceptedEventSpecPersistenceAdapter<TDocument> {
  loadCurrentDocument(specId: string): Promise<TDocument>;
  persistCurrentDocument(specId: string, document: TDocument): Promise<TDocument>;
}

export class IntakeStoreAcceptedEventSpecAdapter
  implements AcceptedEventSpecPersistenceAdapter<AcceptedEventSpec>
{
  constructor(private readonly store: IntakeStore) {}

  async loadCurrentDocument(specId: string): Promise<AcceptedEventSpec> {
    const spec = await this.store.getSpec(specId);
    if (!spec) {
      throw new Error(`AcceptedEventSpec nicht gefunden: ${specId}`);
    }

    return validateAcceptedEventSpec(spec);
  }

  async persistCurrentDocument(specId: string, document: AcceptedEventSpec): Promise<AcceptedEventSpec> {
    if (document.specId !== specId) {
      throw new Error(`Spec-ID passt nicht zum Persistierziel: ${document.specId} != ${specId}`);
    }

    const normalized = validateAcceptedEventSpec(document);
    await this.store.saveSpec(normalized);
    return normalized;
  }
}
