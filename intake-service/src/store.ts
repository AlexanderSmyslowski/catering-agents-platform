import type { AcceptedEventSpec, EventRequest } from "@catering/shared-core";

export class IntakeStore {
  private readonly requests = new Map<string, EventRequest>();

  private readonly specs = new Map<string, AcceptedEventSpec>();

  saveRequest(request: EventRequest): void {
    this.requests.set(request.requestId, request);
  }

  saveSpec(spec: AcceptedEventSpec): void {
    this.specs.set(spec.specId, spec);
  }

  getSpec(specId: string): AcceptedEventSpec | undefined {
    return this.specs.get(specId);
  }
}

