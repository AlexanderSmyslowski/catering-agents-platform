import { createPersistentCollection, type CollectionStorageOptions, type PersistentCollection } from "./persistence.js";
import type { PurchasingUnitProfile } from "./types.js";
import { validatePurchasingUnitProfile } from "./validation.js";

export class PurchasingUnitProfileLibrary {
  private readonly profiles: PersistentCollection<PurchasingUnitProfile>;

  constructor(options?: CollectionStorageOptions) {
    this.profiles = createPersistentCollection<PurchasingUnitProfile>({
      collectionName: "production/purchasing-unit-profiles",
      getId: (profile) => profile.id,
      validate: validatePurchasingUnitProfile,
      rootDir: options?.rootDir,
      databaseUrl: options?.databaseUrl,
      pgPool: options?.pgPool
    });
  }

  async list(): Promise<PurchasingUnitProfile[]> {
    return this.profiles.list();
  }

  async get(id: string): Promise<PurchasingUnitProfile | undefined> {
    return this.profiles.get(id);
  }

  async save(profile: PurchasingUnitProfile): Promise<void> {
    await this.profiles.set(profile);
  }

  async getActiveIngredientPurchasingUnitProfile(
    ingredientId: string,
    baseUnit?: string
  ): Promise<PurchasingUnitProfile | undefined> {
    const matches = (await this.profiles.list()).filter(
      (profile) =>
        profile.scopeType === "ingredient" &&
        profile.scopeId === ingredientId &&
        profile.isActive &&
        (!baseUnit || profile.baseUnit === baseUnit)
    );

    return matches.sort((left, right) => right.id.localeCompare(left.id))[0];
  }
}
