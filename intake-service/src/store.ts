import {
  FileBackedCollection,
  type AcceptedEventSpec,
  type EventRequest
} from "@catering/shared-core";

export class IntakeStore {
  private readonly requests: FileBackedCollection<EventRequest>;

  private readonly specs: FileBackedCollection<AcceptedEventSpec>;

  constructor(options?: { dataRoot?: string }) {
    this.requests = new FileBackedCollection({
      collectionName: "intake/requests",
      getId: (request) => request.requestId,
      rootDir: options?.dataRoot
    });
    this.specs = new FileBackedCollection({
      collectionName: "intake/specs",
      getId: (spec) => spec.specId,
      rootDir: options?.dataRoot
    });
  }

  saveRequest(request: EventRequest): void {
    this.requests.set(request);
  }

  saveSpec(spec: AcceptedEventSpec): void {
    this.specs.set(spec);
  }

  getSpec(specId: string): AcceptedEventSpec | undefined {
    return this.specs.get(specId);
  }

  listRequests(): EventRequest[] {
    return this.requests.list();
  }

  listSpecs(): AcceptedEventSpec[] {
    return this.specs.list();
  }
}
