import { createPersistentCollection } from "@catering/shared-core";
function isOperationallyArchived(item) {
    return item.operationalArchive?.status === "archived";
}
function activeOnly(items, includeArchived) {
    return includeArchived ? items : items.filter((item) => !isOperationallyArchived(item));
}
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
    async getRequest(requestId) {
        return this.requests.get(requestId);
    }
    async saveSpec(spec) {
        await this.specs.set(spec);
    }
    async getSpec(specId) {
        return this.specs.get(specId);
    }
    async listRequests(options) {
        return activeOnly(await this.requests.list(), options?.includeArchived);
    }
    async listSpecs(options) {
        return activeOnly(await this.specs.list(), options?.includeArchived);
    }
    async archiveRequestContext(input) {
        const request = await this.requests.get(input.requestId);
        if (!request) {
            return {
                request: undefined,
                specs: [],
                alreadyArchived: false
            };
        }
        const archiveState = {
            status: "archived",
            mode: "soft_archive",
            reasonCode: input.reasonCode,
            archivedAt: input.archivedAt,
            archivedBy: input.archivedBy
        };
        const alreadyArchived = isOperationallyArchived(request);
        const archivedRequest = {
            ...request,
            operationalArchive: request.operationalArchive ?? archiveState
        };
        await this.requests.set(archivedRequest);
        const specs = await this.specs.list();
        const relatedSpecs = specs.filter((spec) => spec.sourceLineage.some((source) => source.reference === input.requestId));
        const archivedSpecs = [];
        for (const spec of relatedSpecs) {
            const archivedSpec = {
                ...spec,
                operationalArchive: spec.operationalArchive ?? archiveState
            };
            await this.specs.set(archivedSpec);
            archivedSpecs.push(archivedSpec);
        }
        return {
            request: archivedRequest,
            specs: archivedSpecs,
            alreadyArchived
        };
    }
}
