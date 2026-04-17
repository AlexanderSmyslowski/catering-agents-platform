import { createPersistentCollection } from "@catering/shared-core";
export class IntakeStore {
    requests;
    specs;
    storageOptions;
    constructor(options) {
        this.storageOptions = options;
        this.requests = createPersistentCollection({
            collectionName: "intake/requests",
            getId: (request) => request.requestId,
            rootDir: options?.rootDir,
            databaseUrl: options?.databaseUrl,
            pgPool: options?.pgPool
        });
        this.specs = createPersistentCollection({
            collectionName: "intake/specs",
            getId: (spec) => spec.specId,
            rootDir: options?.rootDir,
            databaseUrl: options?.databaseUrl,
            pgPool: options?.pgPool
        });
    }
    async saveRequest(request) {
        await this.requests.set(request);
    }
    async saveSpec(spec) {
        await this.specs.set(spec);
    }
    async getRequest(requestId) {
        return this.requests.get(requestId);
    }
    async getSpec(specId) {
        return this.specs.get(specId);
    }
    async listRequests() {
        return this.requests.list();
    }
    async listSpecs() {
        return this.specs.list();
    }
}
