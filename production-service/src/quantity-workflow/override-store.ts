import {
  createBusinessScopedPersistentCollection,
  type BusinessContext,
  type CollectionStorageOptions,
  type ConfirmedQuantityOverride
} from "@catering/shared-core";

export class QuantityOverrideStore {
  private readonly collection;

  constructor(options: CollectionStorageOptions = {}) {
    this.collection = createBusinessScopedPersistentCollection<ConfirmedQuantityOverride>({
      collectionName: "production/quantity-overrides",
      getId: (item) => item.overrideId,
      ...options
    });
  }

  async save(context: BusinessContext, override: ConfirmedQuantityOverride): Promise<void> {
    await this.collection.set(context, override);
  }

  async latestFor(
    context: BusinessContext,
    eventSpecId: string,
    componentId: string
  ): Promise<ConfirmedQuantityOverride | undefined> {
    const matches = (await this.collection.list(context))
      .filter((item) => item.eventSpecId === eventSpecId && item.componentId === componentId)
      .sort((left, right) => right.confirmedAt.localeCompare(left.confirmedAt));
    return matches[0];
  }
}
