import { createPersistentCollection, type CollectionStorageOptions, type PersistentCollection } from "./persistence.js";
import type { YieldProfile } from "./types.js";
import { validateYieldProfile } from "./validation.js";

export class YieldProfileLibrary {
  private readonly profiles: PersistentCollection<YieldProfile>;

  constructor(options?: CollectionStorageOptions) {
    this.profiles = createPersistentCollection<YieldProfile>({
      collectionName: "production/yield-profiles",
      getId: (profile) => profile.id,
      validate: validateYieldProfile,
      rootDir: options?.rootDir,
      databaseUrl: options?.databaseUrl,
      pgPool: options?.pgPool
    });
  }

  async list(): Promise<YieldProfile[]> {
    return this.profiles.list();
  }

  async get(id: string): Promise<YieldProfile | undefined> {
    return this.profiles.get(id);
  }

  async save(profile: YieldProfile): Promise<void> {
    await this.profiles.set(profile);
  }

  async getActiveForScope(
    scopeType: YieldProfile["scopeType"],
    scopeId: string
  ): Promise<YieldProfile | undefined> {
    const matches = (await this.profiles.list()).filter(
      (profile) =>
        profile.scopeType === scopeType &&
        profile.scopeId === scopeId &&
        profile.isActive
    );

    return matches.sort((left, right) => right.id.localeCompare(left.id))[0];
  }

  async getActiveIngredientYieldProfile(
    ingredientId: string
  ): Promise<YieldProfile | undefined> {
    return this.getActiveForScope("ingredient", ingredientId);
  }
}
